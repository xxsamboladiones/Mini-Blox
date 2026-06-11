import * as THREE from "three";
import { disposeObject3D } from "./ObjectFactory";
import { applyWeaponAttachment, getWeaponAttachmentConfig } from "./WeaponAttachment";
import type { WeaponAttackType } from "../shared/types/ItemSchema";

export type PlayerAnimationState = "idle" | "move" | "airborne" | "attack" | "defeated";

export interface PlayerAnimatorOptions {
  root: THREE.Object3D;
  body?: THREE.Object3D;
  head?: THREE.Object3D;
  leftArm?: THREE.Object3D;
  rightArm?: THREE.Object3D;
  leftLeg?: THREE.Object3D;
  rightLeg?: THREE.Object3D;
  weaponSlot?: THREE.Object3D;
}

export interface PlayerAnimationInput {
  deltaSeconds: number;
  isMoving: boolean;
  isGrounded: boolean;
  verticalVelocity?: number;
  isAttacking?: boolean;
  attackProgress?: number;
  equippedWeaponId?: string | null;
  isDefeated?: boolean;
  lookYaw?: number;
  rootYaw?: number;
}

const DEFAULT_ATTACK_DURATION = 0.34;
const FORWARD_ARM_X = 1;
const BACKWARD_ARM_X = -1;

export class PlayerAnimator {
  private walkCycle = 0;
  private idleTime = 0;
  private attackTimer = 0;
  private attackDuration = DEFAULT_ATTACK_DURATION;
  private attackType: WeaponAttackType = "slash";
  private attackWeaponId: string | null = null;
  private jumpStretch = 0;
  private landSquash = 0;
  private respawnPulse = 0;
  private damagePulse = 0;
  private wasGrounded = true;
  private weaponVisual: THREE.Object3D | null = null;

  constructor(private readonly options: PlayerAnimatorOptions) {}

  update(input: PlayerAnimationInput): PlayerAnimationState {
    const delta = Math.min(Math.max(input.deltaSeconds, 0), 0.05);
    const isDefeated = input.isDefeated === true;
    const isGrounded = input.isGrounded && !isDefeated;

    if (!this.wasGrounded && isGrounded) {
      this.landSquash = Math.max(this.landSquash, 1);
    }
    this.wasGrounded = isGrounded;

    if (!isGrounded && (input.verticalVelocity ?? 0) > 0.8) {
      this.jumpStretch = Math.max(this.jumpStretch, 0.65);
    }

    const state = this.resolveState(input, isDefeated, isGrounded);
    this.updateTimers(delta);
    this.applyPose(input, state, delta);
    this.applyScale(delta);
    return state;
  }

  playAttack(
    attackType: WeaponAttackType = "slash",
    weaponId: string | null | undefined = null,
    durationSeconds = DEFAULT_ATTACK_DURATION
  ): void {
    this.attackType = attackType;
    this.attackWeaponId = weaponId ?? null;
    this.attackDuration = Math.max(0.18, Math.min(0.65, durationSeconds));
    this.attackTimer = this.attackDuration;
  }

  attachWeapon(weapon: THREE.Object3D | null, weaponId?: string | null): void {
    if (this.weaponVisual) {
      this.weaponVisual.removeFromParent();
      disposeObject3D(this.weaponVisual);
      this.weaponVisual = null;
    }

    if (!weapon) {
      return;
    }

    if (this.options.weaponSlot) {
      this.options.weaponSlot.rotation.set(0, 0, 0);
      this.options.weaponSlot.scale.set(1, 1, 1);
    }

    applyWeaponAttachment(weapon, weaponId);
    (this.options.weaponSlot ?? this.options.rightArm)?.add(weapon);
    weapon.updateMatrixWorld(true);
    this.weaponVisual = weapon;
  }

  playJumpFeedback(strength = 1): void {
    this.jumpStretch = Math.max(this.jumpStretch, strength);
  }

  playRespawnFeedback(): void {
    this.respawnPulse = 1;
    this.landSquash = Math.max(this.landSquash, 0.75);
    this.attackTimer = 0;
  }

  playDamageFeedback(): void {
    this.damagePulse = 1;
  }

  resetPose(): void {
    this.walkCycle = 0;
    this.idleTime = 0;
    this.attackTimer = 0;
    this.jumpStretch = 0;
    this.landSquash = 0;
    this.respawnPulse = 0;
    this.damagePulse = 0;
    this.wasGrounded = true;
    this.options.root.scale.set(1, 1, 1);
    this.setPoseImmediate(getNeutralPose());
  }

  dispose(): void {
    this.attachWeapon(null);
  }

  private resolveState(
    input: PlayerAnimationInput,
    isDefeated: boolean,
    isGrounded: boolean
  ): PlayerAnimationState {
    if (isDefeated) {
      return "defeated";
    }

    if (this.attackTimer > 0 || input.isAttacking === true) {
      return "attack";
    }

    if (!isGrounded) {
      return "airborne";
    }

    return input.isMoving ? "move" : "idle";
  }

  private updateTimers(deltaSeconds: number): void {
    this.attackTimer = Math.max(0, this.attackTimer - deltaSeconds);
    this.jumpStretch = THREE.MathUtils.damp(this.jumpStretch, 0, 7, deltaSeconds);
    this.landSquash = THREE.MathUtils.damp(this.landSquash, 0, 10, deltaSeconds);
    this.respawnPulse = THREE.MathUtils.damp(this.respawnPulse, 0, 5, deltaSeconds);
    this.damagePulse = THREE.MathUtils.damp(this.damagePulse, 0, 8, deltaSeconds);
  }

  private applyPose(
    input: PlayerAnimationInput,
    state: PlayerAnimationState,
    deltaSeconds: number
  ): void {
    const pose = this.getBasePose(input, state, deltaSeconds);

    if (state === "attack") {
      applyAttackPose(pose, {
        attackType: this.attackType,
        weaponId: this.attackWeaponId ?? input.equippedWeaponId,
        progress: this.getAttackProgress(input),
      });
    }

    this.dampToPose(pose, deltaSeconds);
  }

  private getBasePose(
    input: PlayerAnimationInput,
    state: PlayerAnimationState,
    deltaSeconds: number
  ): AvatarPose {
    if (state === "defeated") {
      return {
        ...getNeutralPose(),
        body: { x: -0.28, y: 0, z: 0 },
        head: { x: 0.16, y: 0, z: 0 },
        leftArm: { x: 0.48 * FORWARD_ARM_X, y: 0, z: -0.18 },
        rightArm: { x: 0.62 * FORWARD_ARM_X, y: 0, z: 0.18 },
        leftLeg: { x: 0.16 * FORWARD_ARM_X, y: 0, z: 0 },
        rightLeg: { x: 0.16 * BACKWARD_ARM_X, y: 0, z: 0 },
      };
    }

    this.idleTime += deltaSeconds;

    if (input.isMoving) {
      this.walkCycle += deltaSeconds * 12;
    } else {
      this.walkCycle = THREE.MathUtils.damp(this.walkCycle, 0, 8, deltaSeconds);
    }

    const swing = input.isMoving ? Math.sin(this.walkCycle) * 0.46 : 0;
    const counterSwing = input.isMoving ? Math.cos(this.walkCycle) * 0.06 : 0;
    const idle = input.isMoving ? 0 : Math.sin(this.idleTime * 2.2) * 0.025;
    const airborne = !input.isGrounded;
    const pose = getNeutralPose();

    if (airborne) {
      const falling = (input.verticalVelocity ?? 0) < -0.25;
      pose.leftArm.x = falling ? 0.18 * FORWARD_ARM_X : 0.35 * FORWARD_ARM_X;
      pose.rightArm.x = falling ? 0.18 * FORWARD_ARM_X : 0.35 * FORWARD_ARM_X;
      pose.leftLeg.x = falling ? 0.18 : 0.12;
      pose.rightLeg.x = falling ? -0.18 : -0.12;
      pose.body.x = falling ? 0.02 : -0.06;
    } else {
      pose.leftArm.x = -swing + idle;
      pose.rightArm.x = swing + idle;
      pose.leftLeg.x = swing;
      pose.rightLeg.x = -swing;
      pose.body.x = 0;
    }

    pose.leftArm.z = -0.08 - counterSwing;
    pose.rightArm.z = 0.08 - counterSwing;
    pose.head.y = getRelativeLookYaw(input);
    pose.headOffsetY = 1.55 + Math.abs(swing) * 0.025;
    return pose;
  }

  private getAttackProgress(input: PlayerAnimationInput): number {
    if (typeof input.attackProgress === "number" && Number.isFinite(input.attackProgress)) {
      return Math.max(0, Math.min(1, input.attackProgress));
    }

    if (this.attackDuration <= 0) {
      return 1;
    }

    return 1 - this.attackTimer / this.attackDuration;
  }

  private dampToPose(pose: AvatarPose, deltaSeconds: number): void {
    dampRotation(this.options.body, pose.body, 10, deltaSeconds);
    dampRotation(this.options.head, pose.head, 8, deltaSeconds);
    dampRotation(this.options.leftArm, pose.leftArm, 12, deltaSeconds);
    dampRotation(this.options.rightArm, pose.rightArm, 16, deltaSeconds);
    dampRotation(this.options.leftLeg, pose.leftLeg, 12, deltaSeconds);
    dampRotation(this.options.rightLeg, pose.rightLeg, 12, deltaSeconds);

    if (this.options.head && typeof pose.headOffsetY === "number") {
      this.options.head.position.y = THREE.MathUtils.damp(
        this.options.head.position.y,
        pose.headOffsetY,
        10,
        deltaSeconds
      );
    }
  }

  private setPoseImmediate(pose: AvatarPose): void {
    setRotation(this.options.body, pose.body);
    setRotation(this.options.head, pose.head);
    setRotation(this.options.leftArm, pose.leftArm);
    setRotation(this.options.rightArm, pose.rightArm);
    setRotation(this.options.leftLeg, pose.leftLeg);
    setRotation(this.options.rightLeg, pose.rightLeg);

    if (this.options.head) {
      this.options.head.position.y = pose.headOffsetY ?? 1.55;
    }
  }

  private applyScale(deltaSeconds: number): void {
    const stretch = this.jumpStretch;
    const squash = this.landSquash;
    const respawn = Math.sin(this.respawnPulse * Math.PI) * 0.12;
    const damage = Math.sin(this.damagePulse * Math.PI) * 0.08;

    this.options.root.scale.set(
      1 + squash * 0.08 + respawn + damage,
      1 + stretch * 0.16 - squash * 0.14 + respawn * 0.35,
      1 + squash * 0.08 + respawn + damage
    );

    if (this.respawnPulse <= 0.001 && this.damagePulse <= 0.001 && this.landSquash <= 0.001) {
      this.options.root.scale.x = THREE.MathUtils.damp(
        this.options.root.scale.x,
        1,
        10,
        deltaSeconds
      );
      this.options.root.scale.z = THREE.MathUtils.damp(
        this.options.root.scale.z,
        1,
        10,
        deltaSeconds
      );
    }
  }
}

type PoseRotation = { x: number; y: number; z: number };

type AvatarPose = {
  body: PoseRotation;
  head: PoseRotation;
  leftArm: PoseRotation;
  rightArm: PoseRotation;
  leftLeg: PoseRotation;
  rightLeg: PoseRotation;
  headOffsetY?: number;
};

function getNeutralPose(): AvatarPose {
  return {
    body: { x: 0, y: 0, z: 0 },
    head: { x: 0, y: 0, z: 0 },
    leftArm: { x: 0, y: 0, z: -0.08 },
    rightArm: { x: 0, y: 0, z: 0.08 },
    leftLeg: { x: 0, y: 0, z: 0 },
    rightLeg: { x: 0, y: 0, z: 0 },
    headOffsetY: 1.55,
  };
}

function applyAttackPose(
  pose: AvatarPose,
  options: {
    attackType: WeaponAttackType;
    weaponId?: string | null;
    progress: number;
  }
): void {
  const progress = Math.max(0, Math.min(1, options.progress));
  const arc = Math.sin(progress * Math.PI);
  const windup = Math.sin(Math.min(progress, 0.5) * Math.PI);
  const attachment = getWeaponAttachmentConfig(options.weaponId);

  switch (options.attackType) {
    case "overhead":
      pose.rightArm.x = 2.08 - arc * 0.9;
      pose.rightArm.y = 0.04;
      pose.rightArm.z = -0.08 - arc * 0.16;
      pose.body.x = -0.05 + arc * 0.08;
      pose.leftArm.x = 0.28;
      break;
    case "stab":
      pose.rightArm.x = 1.0 + arc * 0.26;
      pose.rightArm.y = -0.16;
      pose.rightArm.z = -0.12 - arc * 0.16;
      pose.body.y = -0.04 + arc * 0.08;
      pose.leftArm.x = 0.16;
      break;
    case "shoot":
      pose.rightArm.x = 1.22 + windup * 0.08;
      pose.rightArm.y = -0.06 + arc * 0.06;
      pose.rightArm.z = -0.06;
      pose.leftArm.x = 0.55;
      pose.leftArm.z = -0.18;
      break;
    case "slash":
    default:
      pose.rightArm.x = 1.12 + arc * 0.68;
      pose.rightArm.y = -0.22 + arc * 0.24;
      pose.rightArm.z = -0.32 - arc * 0.2;
      pose.body.y = -0.08 + arc * 0.18;
      pose.leftArm.x = 0.12;
      break;
  }

  if (attachment.kind === "dagger") {
    pose.rightArm.x -= 0.2;
    pose.rightArm.z += 0.08;
  } else if (attachment.kind === "hammer") {
    pose.rightArm.x += 0.18;
    pose.body.x += 0.06 * arc;
  }
}

function getRelativeLookYaw(input: PlayerAnimationInput): number {
  if (typeof input.lookYaw !== "number" || typeof input.rootYaw !== "number") {
    return 0;
  }

  return THREE.MathUtils.clamp(normalizeAngle(input.lookYaw - input.rootYaw), -0.45, 0.45);
}

function dampRotation(
  object: THREE.Object3D | undefined,
  target: PoseRotation,
  lambda: number,
  deltaSeconds: number
): void {
  if (!object) {
    return;
  }

  object.rotation.x = THREE.MathUtils.damp(object.rotation.x, target.x, lambda, deltaSeconds);
  object.rotation.y = dampAngle(object.rotation.y, target.y, lambda, deltaSeconds);
  object.rotation.z = THREE.MathUtils.damp(object.rotation.z, target.z, lambda, deltaSeconds);
}

function setRotation(object: THREE.Object3D | undefined, target: PoseRotation): void {
  if (!object) {
    return;
  }

  object.rotation.set(target.x, target.y, target.z);
}

function dampAngle(current: number, target: number, lambda: number, deltaSeconds: number): number {
  return current + normalizeAngle(target - current) * (1 - Math.exp(-lambda * deltaSeconds));
}

function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
