import * as THREE from "three";

type ThirdPersonCameraControllerOptions = {
  camera: THREE.PerspectiveCamera;
  container: HTMLElement;
  domElement: HTMLElement;
  getTargetPosition: () => THREE.Vector3;
  objectViews: Map<string, THREE.Object3D>;
  getInteractionHint: (objectId: string) => string | null;
  interact: (objectId: string) => boolean;
  onPrimaryAction?: () => void;
};

export class ThirdPersonCameraController {
  private readonly raycaster = new THREE.Raycaster();
  private readonly crosshair = document.createElement("div");
  private readonly hint = document.createElement("div");
  private yaw = 0;
  private pitch = 0.24;
  private active = false;
  private locked = false;
  private softLocked = false;
  private currentTargetId: string | null = null;

  constructor(private readonly options: ThirdPersonCameraControllerOptions) {
    this.raycaster.far = INTERACTION_DISTANCE;
    this.crosshair.className = "runtime-crosshair";
    this.hint.className = "runtime-interaction-hint";
    this.hint.textContent = "";
    this.options.container.append(this.crosshair, this.hint);
  }

  start(): void {
    if (this.active) {
      return;
    }

    this.active = true;
    this.options.domElement.addEventListener("click", this.handleClick);
    document.addEventListener("pointerlockchange", this.handlePointerLockChange);
    document.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("keydown", this.handleKeyDown);
    this.updateOverlay();
  }

  stop(): void {
    if (!this.active) {
      return;
    }

    this.active = false;
    this.options.domElement.removeEventListener("click", this.handleClick);
    document.removeEventListener("pointerlockchange", this.handlePointerLockChange);
    document.removeEventListener("mousemove", this.handleMouseMove);
    window.removeEventListener("keydown", this.handleKeyDown);
    this.currentTargetId = null;

    if (document.pointerLockElement === this.options.domElement && typeof document.exitPointerLock === "function") {
      document.exitPointerLock();
    }

    this.locked = false;
    this.softLocked = false;
    this.updateOverlay();
  }

  dispose(): void {
    this.stop();
    this.crosshair.remove();
    this.hint.remove();
  }

  reset(): void {
    this.updateCamera();
  }

  releasePointerLock(): void {
    if (document.pointerLockElement === this.options.domElement && typeof document.exitPointerLock === "function") {
      document.exitPointerLock();
    }

    this.locked = false;
    this.softLocked = false;
    this.updateOverlay();
  }

  update(): void {
    if (!this.active) {
      return;
    }

    this.updateCamera();
    this.updateInteractionTarget();
    this.updateOverlay();
  }

  getYaw(): number {
    return this.yaw;
  }

  private updateCamera(): void {
    const target = this.options.getTargetPosition().add(new THREE.Vector3(0, TARGET_HEIGHT, 0));
    const forward = getForwardFromYaw(this.yaw);
    const horizontalDistance = CAMERA_DISTANCE * Math.cos(this.pitch);
    const cameraPosition = target
      .clone()
      .addScaledVector(forward, -horizontalDistance)
      .add(new THREE.Vector3(0, CAMERA_HEIGHT + Math.sin(this.pitch) * CAMERA_DISTANCE, 0));

    this.options.camera.position.lerp(cameraPosition, 0.35);
    const lookTarget = target.clone().addScaledVector(forward, LOOK_AHEAD);
    this.options.camera.lookAt(lookTarget);
  }

  private updateInteractionTarget(): void {
    const hit = this.findInteractiveHit();
    this.currentTargetId = hit;
  }

  private findInteractiveHit(): string | null {
    const rootObjects = [...this.options.objectViews.values()].filter((view) => view.visible);
    this.raycaster.setFromCamera(CENTER_SCREEN, this.options.camera);

    for (const hit of this.raycaster.intersectObjects(rootObjects, true)) {
      const objectId = getMapObjectId(hit.object);

      if (!objectId || hit.distance > INTERACTION_DISTANCE) {
        continue;
      }

      if (this.options.getInteractionHint(objectId)) {
        return objectId;
      }
    }

    return null;
  }

  private updateOverlay(): void {
    this.crosshair.classList.toggle("visible", this.active);
    this.crosshair.classList.toggle("locked", this.locked);

    const hint = this.currentTargetId ? this.options.getInteractionHint(this.currentTargetId) : null;
    this.hint.textContent = hint ? `${hint} - Pressione E para interagir` : "";
    this.hint.classList.toggle("visible", Boolean(hint));
  }

  private readonly handleClick = (): void => {
    if (!this.active) {
      return;
    }

    if (this.locked || document.pointerLockElement === this.options.domElement) {
      this.options.onPrimaryAction?.();
      return;
    }

    this.options.domElement.focus();

    if (typeof this.options.domElement.requestPointerLock === "function") {
      this.options.domElement.requestPointerLock();
      window.setTimeout(() => {
        if (this.active && document.pointerLockElement !== this.options.domElement) {
          this.softLocked = true;
          this.locked = true;
          this.updateOverlay();
        }
      }, 120);
    } else {
      this.softLocked = true;
      this.locked = true;
      this.updateOverlay();
    }
  };

  private readonly handlePointerLockChange = (): void => {
    this.locked = this.softLocked || document.pointerLockElement === this.options.domElement;
    this.updateOverlay();
  };

  private readonly handleMouseMove = (event: MouseEvent): void => {
    if (!this.active || !this.locked) {
      return;
    }

    this.yaw -= event.movementX * MOUSE_SENSITIVITY;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch + event.movementY * MOUSE_SENSITIVITY,
      MIN_PITCH,
      MAX_PITCH
    );
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.active || !this.locked || event.code.toLowerCase() !== "keye") {
      return;
    }

    if (!this.currentTargetId) {
      return;
    }

    event.preventDefault();
    this.options.interact(this.currentTargetId);
  };
}

export function getForwardFromYaw(yaw: number): THREE.Vector3 {
  return new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
}

function getMapObjectId(object: THREE.Object3D): string | null {
  const value = object.userData.mapObjectId;
  return typeof value === "string" ? value : null;
}

const CENTER_SCREEN = new THREE.Vector2(0, 0);
const CAMERA_DISTANCE = 5.4;
const CAMERA_HEIGHT = 1.15;
const TARGET_HEIGHT = 1.1;
const LOOK_AHEAD = 2.4;
const INTERACTION_DISTANCE = 6;
const MOUSE_SENSITIVITY = 0.0024;
const MIN_PITCH = -0.35;
const MAX_PITCH = 0.85;
