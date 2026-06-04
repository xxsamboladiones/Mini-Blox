import * as THREE from "three";
import { disposeObject3D } from "./ObjectFactory";
import { PhysicsSystem } from "./PhysicsSystem";
import { LocalProfileStorage, type AvatarColors } from "../storage/LocalProfileStorage";
import type { Vector3 } from "../shared/types/ObjectSchema";

type AvatarParts = {
  body: THREE.Mesh;
  head: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
};

export class PlayerController {
  private readonly keys = new Set<string>();
  private readonly player = new THREE.Group();
  private readonly velocity = new THREE.Vector3();
  private readonly playerSize = new THREE.Vector3(0.72, 1.8, 0.72);
  private readonly avatar: AvatarParts;
  private readonly teamMarker: THREE.Mesh;
  private active = false;
  private grounded = false;
  private jumpRequested = false;
  private walkCycle = 0;
  private externalCameraControl = false;
  private viewYaw: number | null = null;
  private jumpStretch = 0;
  private landSquash = 0;
  private respawnPulse = 0;
  private attackPulse = 0;
  private maxHealth = DEFAULT_MAX_HEALTH;
  private health = DEFAULT_MAX_HEALTH;
  private dead = false;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly domElement: HTMLElement,
    private physicsSystem: PhysicsSystem | null = null
  ) {
    this.avatar = createAvatar(LocalProfileStorage.getProfile().avatarColors);
    this.teamMarker = new THREE.Mesh(
      new THREE.TorusGeometry(0.54, 0.045, 8, 32),
      new THREE.MeshStandardMaterial({
        color: "#ffffff",
        roughness: 0.35,
        emissive: "#ffffff",
        emissiveIntensity: 0.18,
      })
    );
    this.teamMarker.rotation.x = Math.PI / 2;
    this.teamMarker.position.y = 0.08;
    this.teamMarker.visible = false;
    this.player.add(
      this.teamMarker,
      this.avatar.body,
      this.avatar.head,
      this.avatar.leftArm,
      this.avatar.rightArm,
      this.avatar.leftLeg,
      this.avatar.rightLeg
    );
    this.player.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }

  setPhysicsSystem(physicsSystem: PhysicsSystem | null): void {
    this.physicsSystem = physicsSystem;
  }

  setExternalCameraControl(enabled: boolean): void {
    this.externalCameraControl = enabled;
  }

  setViewYaw(yaw: number): void {
    this.viewYaw = yaw;
  }

  setTeamColor(color: string | null): void {
    this.teamMarker.visible = Boolean(color);

    if (color && this.teamMarker.material instanceof THREE.MeshStandardMaterial) {
      this.teamMarker.material.color.set(color);
      this.teamMarker.material.emissive.set(color);
      this.teamMarker.material.needsUpdate = true;
    }
  }

  start(spawnPoint: Vector3): void {
    if (!this.active) {
      window.addEventListener("keydown", this.handleKeyDown);
      window.addEventListener("keyup", this.handleKeyUp);
      window.addEventListener("blur", this.handleWindowBlur);
      this.scene.add(this.player);
      this.active = true;
    }

    this.keys.clear();
    this.jumpRequested = false;
    this.jumpStretch = 0;
    this.landSquash = 0;
    this.respawnPulse = 0;
    this.attackPulse = 0;
    this.player.scale.set(1, 1, 1);
    this.resetHealth();
    this.setPosition(spawnPoint);
    this.resetVelocity();
    if (!this.externalCameraControl) {
      this.focusCamera(1);
    }
    this.domElement.focus();
  }

  stop(): void {
    if (!this.active) {
      return;
    }

    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.handleWindowBlur);
    this.scene.remove(this.player);
    this.keys.clear();
    this.jumpRequested = false;
    this.resetVelocity();
    this.player.scale.set(1, 1, 1);
    this.attackPulse = 0;
    this.active = false;
  }

  dispose(): void {
    this.stop();
    disposeObject3D(this.player);
  }

  update(deltaSeconds: number): void {
    if (!this.active) {
      return;
    }

    const delta = Math.min(deltaSeconds, 0.05);
    const direction = this.getMovementDirection();
    const moving = direction.lengthSq() > 0;
    const speed =
      this.keys.has("shiftleft") || this.keys.has("shiftright") ? RUN_SPEED : WALK_SPEED;
    const wasGrounded = this.grounded;

    if (moving) {
      direction.normalize();
      this.velocity.x = direction.x * speed;
      this.velocity.z = direction.z * speed;
      if (!this.externalCameraControl) {
        this.faceDirection(direction, delta);
      }
      this.walkCycle += delta * speed * 3.5;
    } else {
      this.velocity.x = THREE.MathUtils.damp(this.velocity.x, 0, 18, delta);
      this.velocity.z = THREE.MathUtils.damp(this.velocity.z, 0, 18, delta);
      this.walkCycle = THREE.MathUtils.damp(this.walkCycle, 0, 8, delta);
    }

    if (this.jumpRequested && this.grounded) {
      this.velocity.y = JUMP_SPEED;
      this.grounded = false;
      this.jumpStretch = 1;
    }

    this.jumpRequested = false;
    this.velocity.y += GRAVITY * delta;

    if (this.physicsSystem) {
      const result = this.physicsSystem.movePlayer(
        {
          position: this.player.position,
          velocity: this.velocity,
          size: this.playerSize,
        },
        delta
      );
      this.player.position.copy(result.position);
      this.velocity.copy(result.velocity);
      this.grounded = result.grounded;
    } else {
      this.player.position.addScaledVector(this.velocity, delta);
      this.grounded = false;
    }

    if (!wasGrounded && this.grounded) {
      this.landSquash = Math.max(this.landSquash, 1);
    }

    this.animateAvatar(moving, delta);

    if (this.externalCameraControl && this.viewYaw !== null) {
      this.player.rotation.y = dampAngle(this.player.rotation.y, this.viewYaw, 14, delta);
    } else {
      this.focusCamera(0.12);
    }
  }

  getPosition(): Vector3 {
    return {
      x: this.player.position.x,
      y: this.player.position.y,
      z: this.player.position.z,
    };
  }

  getForwardDirection(): THREE.Vector3 {
    return new THREE.Vector3(
      -Math.sin(this.player.rotation.y),
      0,
      -Math.cos(this.player.rotation.y)
    ).normalize();
  }

  getHealth(): number {
    return this.health;
  }

  getMaxHealth(): number {
    return this.maxHealth;
  }

  damage(amount: number): number {
    if (!Number.isFinite(amount) || amount <= 0 || this.dead) {
      return this.health;
    }

    this.health = Math.max(0, this.health - amount);
    this.dead = this.health <= 0;
    return this.health;
  }

  heal(amount: number): number {
    if (!Number.isFinite(amount) || amount <= 0) {
      return this.health;
    }

    this.health = Math.min(this.maxHealth, this.health + amount);
    this.dead = false;
    return this.health;
  }

  resetHealth(): void {
    this.maxHealth = DEFAULT_MAX_HEALTH;
    this.health = this.maxHealth;
    this.dead = false;
  }

  isDead(): boolean {
    return this.dead;
  }

  setPosition(position: Vector3): void {
    this.player.position.set(position.x, position.y, position.z);
    this.grounded = this.physicsSystem
      ? this.physicsSystem.getGroundInfo(this.player.position, this.playerSize).grounded
      : false;
    if (!this.externalCameraControl) {
      this.focusCamera(1);
    }
  }

  getBounds(): THREE.Box3 {
    if (this.physicsSystem) {
      return this.physicsSystem.getPlayerBounds(this.player.position, this.playerSize);
    }

    return new THREE.Box3().setFromCenterAndSize(
      this.player.position.clone().add(new THREE.Vector3(0, this.playerSize.y / 2, 0)),
      this.playerSize
    );
  }

  resetVelocity(): void {
    this.velocity.set(0, 0, 0);
    this.jumpRequested = false;
  }

  applyImpulseY(force: number): void {
    if (!Number.isFinite(force)) {
      return;
    }

    this.velocity.y = Math.max(this.velocity.y, force);
    this.grounded = false;
    this.jumpRequested = false;
    this.playJumpPadFeedback();
  }

  isGrounded(): boolean {
    return this.grounded;
  }

  playJumpPadFeedback(): void {
    this.jumpStretch = 1.15;
  }

  playRespawnFeedback(): void {
    this.respawnPulse = 1;
    this.landSquash = 0.8;
  }

  playAttackFeedback(): void {
    this.attackPulse = 1;
  }

  private getMovementDirection(): THREE.Vector3 {
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;

    if (forward.lengthSq() === 0) {
      forward.set(0, 0, -1);
    }

    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, UP).normalize();
    const direction = new THREE.Vector3();

    if (this.keys.has("keyw") || this.keys.has("arrowup")) {
      direction.add(forward);
    }

    if (this.keys.has("keys") || this.keys.has("arrowdown")) {
      direction.sub(forward);
    }

    if (this.keys.has("keya") || this.keys.has("arrowleft")) {
      direction.sub(right);
    }

    if (this.keys.has("keyd") || this.keys.has("arrowright")) {
      direction.add(right);
    }

    return direction;
  }

  private faceDirection(direction: THREE.Vector3, deltaSeconds: number): void {
    const targetYaw = Math.atan2(direction.x, direction.z) + Math.PI;
    this.player.rotation.y = dampAngle(this.player.rotation.y, targetYaw, 14, deltaSeconds);
  }

  private animateAvatar(isMoving: boolean, deltaSeconds: number): void {
    const swing = isMoving ? Math.sin(this.walkCycle) * 0.46 : 0;
    const counterSwing = isMoving ? Math.cos(this.walkCycle) * 0.06 : 0;
    const idle = isMoving ? 0 : Math.sin(performance.now() * 0.002) * 0.025;

    if (!this.grounded) {
      this.avatar.leftArm.rotation.x = THREE.MathUtils.damp(
        this.avatar.leftArm.rotation.x,
        -0.35,
        12,
        deltaSeconds
      );
      this.avatar.rightArm.rotation.x = THREE.MathUtils.damp(
        this.avatar.rightArm.rotation.x,
        -0.35,
        12,
        deltaSeconds
      );
      this.avatar.leftLeg.rotation.x = THREE.MathUtils.damp(
        this.avatar.leftLeg.rotation.x,
        0.12,
        12,
        deltaSeconds
      );
      this.avatar.rightLeg.rotation.x = THREE.MathUtils.damp(
        this.avatar.rightLeg.rotation.x,
        -0.12,
        12,
        deltaSeconds
      );
      this.avatar.body.rotation.x = THREE.MathUtils.damp(
        this.avatar.body.rotation.x,
        -0.06,
        10,
        deltaSeconds
      );
    } else {
      this.avatar.leftArm.rotation.x = THREE.MathUtils.damp(
        this.avatar.leftArm.rotation.x,
        -swing + idle,
        12,
        deltaSeconds
      );
      this.avatar.rightArm.rotation.x = THREE.MathUtils.damp(
        this.avatar.rightArm.rotation.x,
        swing + idle,
        12,
        deltaSeconds
      );
      this.avatar.leftLeg.rotation.x = THREE.MathUtils.damp(
        this.avatar.leftLeg.rotation.x,
        swing,
        12,
        deltaSeconds
      );
      this.avatar.rightLeg.rotation.x = THREE.MathUtils.damp(
        this.avatar.rightLeg.rotation.x,
        -swing,
        12,
        deltaSeconds
      );
      this.avatar.body.rotation.x = THREE.MathUtils.damp(
        this.avatar.body.rotation.x,
        0,
        10,
        deltaSeconds
      );
    }

    this.avatar.leftArm.rotation.z = THREE.MathUtils.damp(
      this.avatar.leftArm.rotation.z,
      -0.08 - counterSwing,
      10,
      deltaSeconds
    );
    this.avatar.rightArm.rotation.z = THREE.MathUtils.damp(
      this.avatar.rightArm.rotation.z,
      0.08 - counterSwing,
      10,
      deltaSeconds
    );
    this.avatar.head.position.y = THREE.MathUtils.damp(
      this.avatar.head.position.y,
      1.55 + Math.abs(swing) * 0.025,
      10,
      deltaSeconds
    );

    if (this.attackPulse > 0.01) {
      const attack = Math.sin(this.attackPulse * Math.PI);
      this.avatar.rightArm.rotation.x = THREE.MathUtils.damp(
        this.avatar.rightArm.rotation.x,
        -1.15 - attack * 0.65,
        20,
        deltaSeconds
      );
      this.avatar.rightArm.rotation.z = THREE.MathUtils.damp(
        this.avatar.rightArm.rotation.z,
        -0.35,
        18,
        deltaSeconds
      );
    }

    const cameraForward = new THREE.Vector3();
    this.camera.getWorldDirection(cameraForward);
    cameraForward.y = 0;

    if (cameraForward.lengthSq() > 0) {
      cameraForward.normalize();
      const cameraYaw = Math.atan2(cameraForward.x, cameraForward.z) + Math.PI;
      const relativeYaw = THREE.MathUtils.clamp(
        normalizeAngle(cameraYaw - this.player.rotation.y),
        -0.45,
        0.45
      );
      this.avatar.head.rotation.y = dampAngle(
        this.avatar.head.rotation.y,
        relativeYaw,
        8,
        deltaSeconds
      );
    }

    this.applyBodyFeedback(deltaSeconds);
  }

  private applyBodyFeedback(deltaSeconds: number): void {
    this.jumpStretch = THREE.MathUtils.damp(this.jumpStretch, 0, 7, deltaSeconds);
    this.landSquash = THREE.MathUtils.damp(this.landSquash, 0, 10, deltaSeconds);
    this.respawnPulse = THREE.MathUtils.damp(this.respawnPulse, 0, 5, deltaSeconds);
    this.attackPulse = THREE.MathUtils.damp(this.attackPulse, 0, 8, deltaSeconds);

    const stretch = this.jumpStretch;
    const squash = this.landSquash;
    const pulse = Math.sin(this.respawnPulse * Math.PI) * 0.12;
    this.player.scale.set(
      1 + squash * 0.08 + pulse,
      1 + stretch * 0.16 - squash * 0.14 + pulse * 0.35,
      1 + squash * 0.08 + pulse
    );
  }

  private focusCamera(alpha: number): void {
    const desired = this.player.position.clone().add(CAMERA_OFFSET);
    this.camera.position.lerp(desired, alpha);
    this.camera.lookAt(
      this.player.position.x,
      this.player.position.y + CAMERA_TARGET_HEIGHT,
      this.player.position.z
    );
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    const code = event.code.toLowerCase();

    if (MOVEMENT_KEYS.has(code)) {
      event.preventDefault();

      if (code === "space" && !this.keys.has(code)) {
        this.jumpRequested = true;
      }

      this.keys.add(code);
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code.toLowerCase());
  };

  private readonly handleWindowBlur = (): void => {
    this.keys.clear();
    this.jumpRequested = false;
  };
}

function createAvatar(colors: AvatarColors): AvatarParts {
  const shirt = new THREE.MeshStandardMaterial({ color: colors.body, roughness: 0.55 });
  const skin = new THREE.MeshStandardMaterial({ color: colors.head, roughness: 0.5 });
  const sleeves = new THREE.MeshStandardMaterial({ color: colors.arms, roughness: 0.55 });
  const pants = new THREE.MeshStandardMaterial({ color: colors.legs, roughness: 0.62 });
  const shoe = new THREE.MeshStandardMaterial({ color: "#111827", roughness: 0.75 });
  const face = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.4 });
  const mouthMaterial = new THREE.MeshStandardMaterial({ color: "#7f1d1d", roughness: 0.5 });
  const beltMaterial = new THREE.MeshStandardMaterial({ color: "#111827", roughness: 0.65 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.76, 0.42), shirt);
  body.position.y = 1.04;

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.08, 0.44), beltMaterial);
  belt.position.y = -0.31;
  body.add(belt);

  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.44), skin);
  collar.position.y = 0.43;
  body.add(collar);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.52, 0.56), skin);
  head.position.y = 1.55;

  const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.085, 0.035), face);
  leftEye.position.set(-0.13, 0.055, -0.292);
  const rightEye = leftEye.clone();
  rightEye.position.x = 0.13;

  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.035, 0.035), mouthMaterial);
  mouth.position.set(0, -0.11, -0.292);

  const leftBrow = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, 0.035), face);
  leftBrow.position.set(-0.13, 0.145, -0.294);
  leftBrow.rotation.z = 0.12;
  const rightBrow = leftBrow.clone();
  rightBrow.position.x = 0.13;
  rightBrow.rotation.z = -0.12;
  head.add(leftEye, rightEye, mouth, leftBrow, rightBrow);

  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.68, 0.24), sleeves);
  leftArm.position.set(-0.54, 1.04, 0);
  const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.24), skin);
  leftHand.position.y = -0.42;
  leftArm.add(leftHand);

  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.68, 0.24), sleeves);
  rightArm.position.set(0.54, 1.04, 0);
  const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.24), skin);
  rightHand.position.y = -0.42;
  rightArm.add(rightHand);

  const leftLeg = createLeg(pants, shoe);
  leftLeg.position.x = -0.19;

  const rightLeg = createLeg(pants, shoe);
  rightLeg.position.x = 0.19;

  return { body, head, leftArm, rightArm, leftLeg, rightLeg };
}

function createLeg(pants: THREE.Material, shoe: THREE.Material): THREE.Mesh {
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.28), pants);
  leg.position.y = 0.36;

  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.14, 0.42), shoe);
  foot.position.set(0, -0.35, -0.08);
  leg.add(foot);

  return leg;
}

function dampAngle(current: number, target: number, lambda: number, deltaSeconds: number): number {
  return current + normalizeAngle(target - current) * (1 - Math.exp(-lambda * deltaSeconds));
}

function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

const UP = new THREE.Vector3(0, 1, 0);
const CAMERA_OFFSET = new THREE.Vector3(5, 4, 6);
const CAMERA_TARGET_HEIGHT = 0.95;
const WALK_SPEED = 4.5;
const RUN_SPEED = 7;
const JUMP_SPEED = 7.4;
const GRAVITY = -20;
const DEFAULT_MAX_HEALTH = 100;

const MOVEMENT_KEYS = new Set([
  "keyw",
  "keya",
  "keys",
  "keyd",
  "arrowup",
  "arrowleft",
  "arrowdown",
  "arrowright",
  "shiftleft",
  "shiftright",
  "space",
]);
