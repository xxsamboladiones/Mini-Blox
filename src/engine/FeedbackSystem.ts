import * as THREE from "three";
import type { Vector3 } from "../shared/types/ObjectSchema";

export type FeedbackCue =
  | "coinCollect"
  | "checkpoint"
  | "jumpPad"
  | "teleport"
  | "door"
  | "button"
  | "attack"
  | "damage"
  | "death"
  | "victory"
  | "key"
  | "item"
  | "npc"
  | "objective"
  | "disappearingBlock"
  | "message";

type WorldEffect = {
  object: THREE.Object3D;
  age: number;
  duration: number;
  startScale: number;
  endScale: number;
  riseSpeed: number;
};

type DomEffect = {
  element: HTMLElement;
  age: number;
  duration: number;
  distance: number;
};

export class FeedbackSystem {
  private readonly layer = document.createElement("div");
  private readonly worldEffects: WorldEffect[] = [];
  private readonly domEffects: DomEffect[] = [];

  constructor(
    private readonly world: THREE.Group,
    private readonly container: HTMLElement
  ) {
    this.layer.className = "runtime-feedback-layer";
    this.container.append(this.layer);
  }

  spawn(cue: FeedbackCue, position?: Vector3, label?: string): void {
    if (cue === "damage" || cue === "death") {
      this.flash("danger");
    } else if (cue === "victory") {
      this.flash("victory");
    } else if (cue === "teleport") {
      this.flash("teleport");
    }

    if (cue === "coinCollect") {
      this.spawnFloatingText(label ?? "+1", "coin");
    } else if (cue === "key") {
      this.spawnFloatingText(label ?? "Chave", "key");
    } else if (cue === "item") {
      this.spawnFloatingText(label ?? "Item", "item");
    } else if (cue === "objective") {
      this.spawnFloatingText(label ?? "Objetivo", "objective");
    } else if (cue === "npc") {
      this.spawnFloatingText(label ?? "NPC", "item");
    } else if (cue === "death") {
      this.spawnFloatingText("Respawn", "danger");
    } else if (cue === "victory") {
      this.spawnFloatingText("Vitoria!", "victory");
    }

    if (!position) {
      return;
    }

    const object = this.createWorldObject(cue, position);

    if (!object) {
      return;
    }

    this.world.add(object);
    this.worldEffects.push({
      object,
      age: 0,
      duration: getDuration(cue),
      startScale: getStartScale(cue),
      endScale: getEndScale(cue),
      riseSpeed: cue === "coinCollect" || cue === "key" || cue === "item" ? 0.7 : 0.12,
    });
  }

  update(deltaSeconds: number): void {
    for (let index = this.worldEffects.length - 1; index >= 0; index -= 1) {
      const effect = this.worldEffects[index];
      effect.age += deltaSeconds;
      const progress = Math.min(1, effect.age / effect.duration);
      const eased = easeOut(progress);
      const scale = THREE.MathUtils.lerp(effect.startScale, effect.endScale, eased);
      effect.object.scale.setScalar(scale);
      effect.object.position.y += effect.riseSpeed * deltaSeconds;
      setObjectOpacity(effect.object, 1 - eased);

      if (progress >= 1) {
        this.world.remove(effect.object);
        disposeEffectObject(effect.object);
        this.worldEffects.splice(index, 1);
      }
    }

    for (let index = this.domEffects.length - 1; index >= 0; index -= 1) {
      const effect = this.domEffects[index];
      effect.age += deltaSeconds;
      const progress = Math.min(1, effect.age / effect.duration);
      const eased = easeOut(progress);
      effect.element.style.opacity = String(1 - progress);
      effect.element.style.transform = `translate(-50%, ${-effect.distance * eased}px)`;

      if (progress >= 1) {
        effect.element.remove();
        this.domEffects.splice(index, 1);
      }
    }
  }

  dispose(): void {
    this.clear();
    this.layer.remove();
  }

  clear(): void {
    for (const effect of this.worldEffects) {
      this.world.remove(effect.object);
      disposeEffectObject(effect.object);
    }

    this.worldEffects.length = 0;
    this.domEffects.forEach((effect) => effect.element.remove());
    this.domEffects.length = 0;
  }

  private createWorldObject(cue: FeedbackCue, position: Vector3): THREE.Object3D | null {
    const color = getCueColor(cue);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const origin = new THREE.Vector3(position.x, position.y, position.z);

    if (cue === "jumpPad") {
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.7, 4), material);
      arrow.position.copy(origin).add(new THREE.Vector3(0, 1, 0));
      arrow.rotation.y = Math.PI / 4;
      return arrow;
    }

    if (cue === "teleport") {
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.7, 20, 12), material);
      sphere.position.copy(origin).add(new THREE.Vector3(0, 0.7, 0));
      return sphere;
    }

    if (cue === "door" || cue === "button" || cue === "disappearingBlock" || cue === "attack") {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), material);
      box.position.copy(origin).add(new THREE.Vector3(0, 0.5, 0));
      return box;
    }

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.055, 8, 36), material);
    ring.position.copy(origin).add(new THREE.Vector3(0, 0.7, 0));
    ring.rotation.x = Math.PI / 2;
    return ring;
  }

  private flash(kind: "danger" | "teleport" | "victory"): void {
    const element = document.createElement("div");
    element.className = `runtime-feedback-flash ${kind}`;
    this.layer.append(element);
    window.setTimeout(() => element.remove(), 360);
  }

  private spawnFloatingText(
    text: string,
    kind: "coin" | "key" | "item" | "objective" | "danger" | "victory"
  ): void {
    const element = document.createElement("div");
    element.className = `runtime-floating-feedback ${kind}`;
    element.textContent = text;
    this.layer.append(element);
    this.domEffects.push({
      element,
      age: 0,
      duration: 0.9,
      distance: 42,
    });
  }
}

function getCueColor(cue: FeedbackCue): string {
  switch (cue) {
    case "coinCollect":
      return "#ffd166";
    case "checkpoint":
      return "#22c55e";
    case "jumpPad":
      return "#39ff14";
    case "teleport":
      return "#8b5cf6";
    case "door":
      return "#60a5fa";
    case "button":
      return "#f97316";
    case "attack":
      return "#f8fafc";
    case "damage":
    case "death":
      return "#ef4444";
    case "victory":
      return "#22c55e";
    case "key":
      return "#3b82f6";
    case "item":
      return "#06b6d4";
    case "npc":
      return "#4ecdc4";
    case "objective":
      return "#22c55e";
    case "disappearingBlock":
      return "#f59e0b";
    case "message":
      return "#94a3b8";
    default:
      return "#ffffff";
  }
}

function getDuration(cue: FeedbackCue): number {
  return cue === "teleport" || cue === "victory" || cue === "objective" ? 0.65 : 0.48;
}

function getStartScale(cue: FeedbackCue): number {
  return cue === "coinCollect" || cue === "key" || cue === "item" || cue === "objective"
    ? 0.4
    : 0.65;
}

function getEndScale(cue: FeedbackCue): number {
  return cue === "door" || cue === "button" ? 1.7 : 2.2;
}

function setObjectOpacity(object: THREE.Object3D, opacity: number): void {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh) && !(child instanceof THREE.Sprite)) {
      return;
    }

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      material.opacity = Math.max(0, opacity);
      material.transparent = true;
      material.needsUpdate = true;
    });
  });
}

function disposeEffectObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh) && !(child instanceof THREE.Sprite)) {
      return;
    }

    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
    }

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      const withMap = material as THREE.Material & { map?: THREE.Texture | null };
      withMap.map?.dispose();
      material.dispose();
    });
  });
}

function easeOut(value: number): number {
  return 1 - Math.pow(1 - value, 3);
}
