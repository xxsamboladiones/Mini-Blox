import * as THREE from "three";
import type { PlayerNetState } from "../shared/types/MultiplayerSchema.js";
import type { WeaponAttackType } from "../shared/types/ItemSchema.js";
import { PlayerAnimator } from "./PlayerAnimator.js";
import { createWeaponVisual } from "./WeaponVisualFactory.js";

type RemoteAvatarParts = {
  root: THREE.Group;
  body: THREE.Mesh;
  head: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  weaponSlot: THREE.Group;
};

export class RemotePlayerView {
  private mesh: THREE.Group;
  private targetPosition: THREE.Vector3;
  private targetRotationY: number;
  private nameLabel: THREE.Sprite;
  private readonly avatar: RemoteAvatarParts;
  private readonly animator: PlayerAnimator;
  private equippedWeaponId: string | null = null;

  constructor(
    private readonly playerId: string,
    private readonly playerName: string,
    private readonly teamId: string | null,
    private readonly clientId: string
  ) {
    this.avatar = this.createAvatar();
    this.mesh = this.avatar.root;
    this.targetPosition = new THREE.Vector3(0, 0, 0);
    this.targetRotationY = 0;
    this.nameLabel = this.createNameLabel();
    this.animator = new PlayerAnimator({
      root: this.mesh,
      body: this.avatar.body,
      head: this.avatar.head,
      leftArm: this.avatar.leftArm,
      rightArm: this.avatar.rightArm,
      leftLeg: this.avatar.leftLeg,
      rightLeg: this.avatar.rightLeg,
      weaponSlot: this.avatar.weaponSlot,
    });
  }

  private createAvatar(): RemoteAvatarParts {
    const group = new THREE.Group();

    const color = this.getPlayerColor();

    const headGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const headMaterial = new THREE.MeshLambertMaterial({ color: "#f2c49b" });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.5;
    group.add(head);

    const bodyGeometry = new THREE.BoxGeometry(0.5, 0.75, 0.3);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 1;
    group.add(body);

    const armGeometry = new THREE.BoxGeometry(0.15, 0.75, 0.15);
    const armMaterial = new THREE.MeshLambertMaterial({ color: "#f2c49b" });
    const leftArm = new THREE.Mesh(armGeometry, armMaterial);
    leftArm.position.set(-0.35, 1, 0);
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeometry, armMaterial);
    rightArm.position.set(0.35, 1, 0);
    const weaponSlot = new THREE.Group();
    weaponSlot.position.set(0, -0.42, -0.09);
    rightArm.add(weaponSlot);
    group.add(rightArm);

    const legGeometry = new THREE.BoxGeometry(0.2, 0.75, 0.2);
    const legMaterial = new THREE.MeshLambertMaterial({ color: "#1f2937" });
    const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
    leftLeg.position.set(-0.15, 0.25, 0);
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
    rightLeg.position.set(0.15, 0.25, 0);
    group.add(rightLeg);

    return { root: group, body, head, leftArm, rightArm, leftLeg, rightLeg, weaponSlot };
  }

  private createNameLabel(): THREE.Sprite {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
      return new THREE.Sprite(new THREE.SpriteMaterial());
    }

    canvas.width = 256;
    canvas.height = 64;

    context.fillStyle = "rgba(0, 0, 0, 0.5)";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.font = "bold 24px Arial";
    context.fillStyle = "white";
    context.textAlign = "center";
    context.fillText(this.playerName, canvas.width / 2, canvas.height / 2 + 8);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2, 0.5, 1);
    sprite.position.y = 2.2;

    return sprite;
  }

  private getPlayerColor(): string {
    if (this.teamId) {
      const colors: Record<string, string> = {
        red: "#ef4444",
        blue: "#3b82f6",
        green: "#22c55e",
        yellow: "#eab308",
      };
      return colors[this.teamId] || "#3b82f6";
    }

    const hash = this.hashClientId(this.clientId);
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 50%)`;
  }

  private hashClientId(clientId: string): number {
    let hash = 0;
    for (let i = 0; i < clientId.length; i++) {
      const char = clientId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  update(deltaTime: number): void {
    const safeDelta = Math.min(Math.max(deltaTime, 0), 0.05);
    const previousPosition = this.mesh.position.clone();
    const lerpFactor = Math.min(1, 10 * safeDelta);

    this.mesh.position.lerp(this.targetPosition, lerpFactor);
    this.mesh.rotation.y = THREE.MathUtils.lerp(
      this.mesh.rotation.y,
      this.targetRotationY,
      lerpFactor
    );
    const horizontalStep = Math.hypot(
      this.mesh.position.x - previousPosition.x,
      this.mesh.position.z - previousPosition.z
    );
    const verticalVelocity =
      (this.mesh.position.y - previousPosition.y) / Math.max(safeDelta, 0.001);
    const isAirborne = Math.abs(this.targetPosition.y - this.mesh.position.y) > 0.08;
    this.animator.update({
      deltaSeconds: safeDelta,
      isMoving: horizontalStep / Math.max(safeDelta, 0.001) > 0.08,
      isGrounded: !isAirborne,
      verticalVelocity,
      equippedWeaponId: this.equippedWeaponId,
      isDefeated: !this.mesh.visible,
    });

    this.nameLabel.position.copy(this.mesh.position);
    this.nameLabel.position.y += 2.2;
  }

  updateState(state: PlayerNetState): void {
    this.targetPosition.set(state.position.x, state.position.y, state.position.z);
    this.targetRotationY = state.rotationY;
    this.mesh.visible = state.isAlive;
    this.setEquippedWeapon(state.equippedWeaponId);
  }

  setEquippedWeapon(weaponId: string | null): void {
    if (this.equippedWeaponId === weaponId) {
      return;
    }

    this.equippedWeaponId = weaponId;

    this.animator.attachWeapon(null);

    if (!weaponId) {
      return;
    }

    const visual = createWeaponVisual(weaponId);
    this.animator.attachWeapon(visual, weaponId);
  }

  playAttackFeedback(type: WeaponAttackType = "slash"): void {
    this.animator.playAttack(type, this.equippedWeaponId);
  }

  playDamageFeedback(): void {
    this.animator.playDamageFeedback();
  }

  playRespawnFeedback(): void {
    this.animator.playRespawnFeedback();
    this.mesh.visible = true;
  }

  addToScene(scene: THREE.Scene): void {
    scene.add(this.mesh);
    scene.add(this.nameLabel);
  }

  removeFromScene(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    scene.remove(this.nameLabel);
  }

  dispose(): void {
    this.animator.dispose();
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });

    if (this.nameLabel.material instanceof THREE.Material) {
      this.nameLabel.material.map?.dispose();
      this.nameLabel.material.dispose();
    }
  }

  getPlayerId(): string {
    return this.playerId;
  }
}
