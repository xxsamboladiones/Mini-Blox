import * as THREE from "three";
import type { PlayerNetState } from "../shared/types/MultiplayerSchema.js";
import type { WeaponAttackType } from "../shared/types/ItemSchema.js";
import { disposeObject3D } from "./ObjectFactory.js";
import { createWeaponVisual } from "./WeaponVisualFactory.js";

export class RemotePlayerView {
  private mesh: THREE.Group;
  private targetPosition: THREE.Vector3;
  private targetRotationY: number;
  private nameLabel: THREE.Sprite;
  private rightArm: THREE.Mesh | null = null;
  private equippedWeaponId: string | null = null;
  private weaponVisual: THREE.Object3D | null = null;
  private damagePulse = 0;
  private respawnPulse = 0;
  private attackPulse = 0;
  private attackType: WeaponAttackType = "slash";

  constructor(
    private readonly playerId: string,
    private readonly playerName: string,
    private readonly teamId: string | null,
    private readonly clientId: string
  ) {
    this.mesh = this.createAvatar();
    this.targetPosition = new THREE.Vector3(0, 0, 0);
    this.targetRotationY = 0;
    this.nameLabel = this.createNameLabel();
  }

  private createAvatar(): THREE.Group {
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
    this.rightArm = rightArm;
    group.add(rightArm);

    const legGeometry = new THREE.BoxGeometry(0.2, 0.75, 0.2);
    const legMaterial = new THREE.MeshLambertMaterial({ color: "#1f2937" });
    const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
    leftLeg.position.set(-0.15, 0.25, 0);
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
    rightLeg.position.set(0.15, 0.25, 0);
    group.add(rightLeg);

    return group;
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
    const lerpFactor = 10 * deltaTime;

    this.mesh.position.lerp(this.targetPosition, lerpFactor);
    this.mesh.rotation.y = THREE.MathUtils.lerp(
      this.mesh.rotation.y,
      this.targetRotationY,
      lerpFactor
    );
    this.damagePulse = THREE.MathUtils.damp(this.damagePulse, 0, 8, deltaTime);
    this.respawnPulse = THREE.MathUtils.damp(this.respawnPulse, 0, 5, deltaTime);
    this.attackPulse = THREE.MathUtils.damp(this.attackPulse, 0, 8, deltaTime);
    this.animateRightArm(deltaTime);
    const pulse =
      Math.sin(this.damagePulse * Math.PI) * 0.18 + Math.sin(this.respawnPulse * Math.PI) * 0.12;
    this.mesh.scale.setScalar(1 + Math.max(0, pulse));

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

    if (this.weaponVisual && this.rightArm) {
      this.rightArm.remove(this.weaponVisual);
      disposeObject3D(this.weaponVisual);
      this.weaponVisual = null;
    }

    if (!weaponId || !this.rightArm) {
      return;
    }

    const visual = createWeaponVisual(weaponId);
    visual.position.set(0, -0.48, -0.12);
    visual.rotation.set(-0.08, 0, 0);
    this.rightArm.add(visual);
    this.weaponVisual = visual;
  }

  playAttackFeedback(type: WeaponAttackType = "slash"): void {
    this.attackType = type;
    this.attackPulse = 1;
  }

  playDamageFeedback(): void {
    this.damagePulse = 1;
  }

  playRespawnFeedback(): void {
    this.respawnPulse = 1;
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
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });

    if (this.nameLabel.material instanceof THREE.Material) {
      this.nameLabel.material.dispose();
    }
  }

  getPlayerId(): string {
    return this.playerId;
  }

  private animateRightArm(deltaTime: number): void {
    if (!this.rightArm) {
      return;
    }

    this.rightArm.rotation.x = THREE.MathUtils.damp(this.rightArm.rotation.x, 0, 10, deltaTime);
    this.rightArm.rotation.y = THREE.MathUtils.damp(this.rightArm.rotation.y, 0, 10, deltaTime);
    this.rightArm.rotation.z = THREE.MathUtils.damp(this.rightArm.rotation.z, 0.08, 10, deltaTime);

    if (this.attackPulse <= 0.01) {
      return;
    }

    const attack = Math.sin(this.attackPulse * Math.PI);
    const target = getAttackArmPose(this.attackType, attack);
    this.rightArm.rotation.x = THREE.MathUtils.damp(
      this.rightArm.rotation.x,
      target.x,
      18,
      deltaTime
    );
    this.rightArm.rotation.y = THREE.MathUtils.damp(
      this.rightArm.rotation.y,
      target.y,
      18,
      deltaTime
    );
    this.rightArm.rotation.z = THREE.MathUtils.damp(
      this.rightArm.rotation.z,
      target.z,
      18,
      deltaTime
    );
  }
}

function getAttackArmPose(
  type: WeaponAttackType,
  attack: number
): { x: number; y: number; z: number } {
  switch (type) {
    case "overhead":
      return { x: -2 + attack * 0.8, y: 0.05, z: -0.1 - attack * 0.18 };
    case "stab":
      return { x: -1 - attack * 0.24, y: -0.12, z: -0.15 - attack * 0.16 };
    case "shoot":
      return { x: -1.28, y: -0.06 + attack * 0.08, z: -0.08 };
    case "slash":
    default:
      return { x: -1.1 - attack * 0.6, y: -0.2 + attack * 0.22, z: -0.32 - attack * 0.18 };
  }
}
