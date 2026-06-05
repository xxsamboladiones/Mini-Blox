import * as THREE from "three";
import { getWeaponDefinition, normalizeWeaponId } from "../shared/ItemCatalog";

type WeaponVisualOptions = {
  forPickup?: boolean;
};

export function createWeaponVisual(
  weaponId: string | null | undefined,
  options: WeaponVisualOptions = {}
): THREE.Object3D {
  const normalized = normalizeWeaponId(weaponId) ?? "basic_sword";
  const group = new THREE.Group();
  group.userData.weaponVisual = normalized;

  if (normalized === "heavy_hammer") {
    addHammer(group);
  } else if (normalized === "dagger") {
    addDagger(group);
  } else if (normalized === "blaster") {
    addBlaster(group);
  } else {
    addSword(group);
  }

  if (options.forPickup) {
    group.scale.setScalar(normalized === "heavy_hammer" ? 0.92 : 1);
    group.rotation.set(0, Math.PI / 5, -Math.PI / 8);
  }

  return group;
}

export function createWeaponProjectileVisual(weaponId: string | null | undefined): THREE.Object3D {
  const definition = getWeaponDefinition(weaponId);
  const color = definition?.color ?? "#38bdf8";
  const group = new THREE.Group();
  group.userData.weaponProjectile = normalizeWeaponId(weaponId) ?? "blaster";

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 12, 8),
    createMaterial(color, {
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.85,
      roughness: 0.28,
      metalness: 0.05,
    })
  );
  const trail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.11, 0.62, 10),
    createMaterial(color, {
      transparent: true,
      opacity: 0.58,
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.42,
      roughness: 0.4,
    })
  );
  trail.rotation.x = Math.PI / 2;
  trail.position.z = 0.28;
  group.add(core, trail);
  return group;
}

function addSword(group: THREE.Group): void {
  const bladeMaterial = createMaterial("#dbeafe", { metalness: 0.42, roughness: 0.28 });
  const edgeMaterial = createMaterial("#93c5fd", { metalness: 0.34, roughness: 0.3 });
  const hiltMaterial = createMaterial("#334155", { metalness: 0.18, roughness: 0.48 });

  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.84, 0.055), bladeMaterial);
  blade.position.y = -0.42;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.078, 0.18, 4), bladeMaterial);
  tip.position.y = -0.93;
  tip.rotation.y = Math.PI / 4;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.055, 0.09), hiltMaterial);
  guard.position.y = 0.03;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.28, 8), hiltMaterial);
  grip.position.y = 0.18;
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.72, 0.068), edgeMaterial);
  edge.position.set(0.066, -0.42, 0);
  group.add(blade, tip, guard, grip, edge);
}

function addHammer(group: THREE.Group): void {
  const headMaterial = createMaterial("#64748b", { metalness: 0.34, roughness: 0.44 });
  const bandMaterial = createMaterial("#f59e0b", { metalness: 0.2, roughness: 0.36 });
  const handleMaterial = createMaterial("#7c2d12", { roughness: 0.72 });

  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.78, 8), handleMaterial);
  handle.position.y = -0.28;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.26, 0.28), headMaterial);
  head.position.y = -0.78;
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.3, 0.32), bandMaterial);
  band.position.y = -0.78;
  group.add(handle, head, band);
}

function addDagger(group: THREE.Group): void {
  const bladeMaterial = createMaterial("#e0f2fe", { metalness: 0.38, roughness: 0.24 });
  const hiltMaterial = createMaterial("#166534", { metalness: 0.12, roughness: 0.5 });

  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.46, 0.045), bladeMaterial);
  blade.position.y = -0.25;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.058, 0.13, 4), bladeMaterial);
  tip.position.y = -0.55;
  tip.rotation.y = Math.PI / 4;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.045, 0.075), hiltMaterial);
  guard.position.y = 0.02;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.042, 0.22, 8), hiltMaterial);
  grip.position.y = 0.14;
  group.add(blade, tip, guard, grip);
}

function addBlaster(group: THREE.Group): void {
  const bodyMaterial = createMaterial("#0f172a", { metalness: 0.18, roughness: 0.48 });
  const accentMaterial = createMaterial("#06b6d4", {
    emissive: new THREE.Color("#06b6d4"),
    emissiveIntensity: 0.28,
    roughness: 0.28,
  });
  const gripMaterial = createMaterial("#334155", { roughness: 0.62 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.54), bodyMaterial);
  body.position.set(0, -0.08, -0.22);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.42, 12), accentMaterial);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, -0.08, -0.62);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.34, 0.11), gripMaterial);
  grip.position.set(0, 0.1, -0.08);
  grip.rotation.x = -0.32;
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.055, 0.18), accentMaterial);
  sight.position.set(0, -0.22, -0.25);
  group.add(body, barrel, grip, sight);
}

function createMaterial(
  color: string,
  options: Partial<THREE.MeshStandardMaterialParameters> = {}
): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ color, ...options });
  material.userData.fixedColor = true;
  return material;
}
