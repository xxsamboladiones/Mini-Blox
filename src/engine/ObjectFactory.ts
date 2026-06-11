import * as THREE from "three";
import { getItemDefinition, isWeaponItemId } from "../shared/ItemCatalog";
import { getObjectCatalogItem } from "../shared/ObjectCatalog";
import type { MapObject, Vector3 } from "../shared/types/ObjectSchema";
import { createWeaponVisual } from "./WeaponVisualFactory";

type VisualMaterial = "default" | "metal" | "glass" | "glow" | "rubber" | "ice";
type StandardMaterialOptions = Partial<THREE.MeshStandardMaterialParameters>;

export function createMapObject3D(mapObject: MapObject): THREE.Object3D {
  const object = createPrimitive(mapObject);
  applyObjectTransformToThree(object, mapObject);
  stampMapObject3D(object, mapObject.id);
  return object;
}

export function applyObjectTransformToThree(object3D: THREE.Object3D, mapObject: MapObject): void {
  const rotation = mapObject.rotation ?? { x: 0, y: 0, z: 0 };
  const scale = mapObject.scale ?? { x: 1, y: 1, z: 1 };

  object3D.position.set(mapObject.position.x, mapObject.position.y, mapObject.position.z);
  object3D.rotation.set(rotation.x, rotation.y, rotation.z);
  object3D.scale.set(scale.x, scale.y, scale.z);
  object3D.name = mapObject.name ?? mapObject.id;
}

export function applyObjectAppearanceToThree(object3D: THREE.Object3D, mapObject: MapObject): void {
  object3D.traverse((child) => {
    if (child instanceof THREE.PointLight && child.userData.lampLight) {
      updateLampLight(child, mapObject);
      return;
    }

    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    const materials = Array.isArray(child.material) ? child.material : [child.material];

    if (child.userData.requiredKeyLock) {
      child.visible =
        typeof mapObject.properties?.requiredKeyId === "string" &&
        mapObject.properties.requiredKeyId.trim().length > 0;
    }

    for (const material of materials) {
      if (material.userData.signText) {
        updateSignTextMaterial(material, mapObject);
      }

      if (material.userData.fixedColor) {
        continue;
      }

      if (material instanceof THREE.MeshStandardMaterial) {
        applyMaterialSettings(material, mapObject, getBaseMaterialOptions(material));
      }
    }
  });
}

export function syncMapObjectFromThree(mapObject: MapObject, object3D: THREE.Object3D): MapObject {
  mapObject.position = toVector3(object3D.position);
  mapObject.rotation = toVector3(object3D.rotation);
  mapObject.scale = toVector3(object3D.scale);
  return mapObject;
}

export function stampMapObject3D(object3D: THREE.Object3D, mapObjectId: string): void {
  object3D.userData.mapObjectId = mapObjectId;
  object3D.traverse((child) => {
    child.userData.mapObjectId = mapObjectId;
  });
}

export function disposeObject3D(object3D: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();

  object3D.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    geometries.add(child.geometry);

    if (Array.isArray(child.material)) {
      child.material.forEach((material) => materials.add(material));
    } else {
      materials.add(child.material);
    }
  });

  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => disposeMaterial(material));
}

function createPrimitive(mapObject: MapObject): THREE.Object3D {
  switch (mapObject.type) {
    case "ramp":
      return new THREE.Mesh(createRampGeometry(), createMaterial(mapObject));
    case "platform":
      return createPlatformObject(mapObject);
    case "movingPlatform":
      return createMovingPlatformObject(mapObject);
    case "disappearingBlock":
      return createDisappearingBlockObject(mapObject);
    case "jumpPad":
      return createJumpPadObject(mapObject);
    case "spawn":
      return createSpawnObject(mapObject);
    case "damage":
      return createDamageZoneObject(mapObject);
    case "teleporter":
      return createTeleporterObject(mapObject);
    case "messageZone":
      return createMessageZoneObject(mapObject);
    case "checkpoint":
      return createCheckpointObject(mapObject);
    case "coin":
      return createCoinObject(mapObject);
    case "key":
      return createKeyObject(mapObject);
    case "door":
      return createDoorObject(mapObject);
    case "button":
      return createButtonObject(mapObject);
    case "finish":
    case "goal":
      return createFinishObject(mapObject);
    case "npc":
      return createNpcObject(mapObject);
    case "enemy":
      return createEnemyObject(mapObject);
    case "itemSpawner":
      return createItemSpawnerObject(mapObject);
    case "teamSpawn":
      return createTeamSpawnObject(mapObject);
    case "capturePoint":
      return createCapturePointObject(mapObject);
    case "tycoonOwnerClaim":
      return createTycoonClaimObject(mapObject);
    case "tycoonGenerator":
      return createTycoonGeneratorObject(mapObject);
    case "tycoonCollector":
      return createTycoonCollectorObject(mapObject);
    case "tycoonBuyButton":
      return createTycoonBuyButtonObject(mapObject);
    case "tycoonUnlockable":
      return createTycoonUnlockableObject(mapObject);
    case "tycoonUpgrade":
      return createTycoonUpgradeObject(mapObject);
    case "tycoonBarrier":
      return createTycoonBarrierObject(mapObject);
    case "itemPickup":
      return createItemPickupObject(mapObject);
    case "tree":
      return createTreeObject(mapObject);
    case "rock":
      return createRockObject(mapObject);
    case "crate":
      return createCrateObject(mapObject);
    case "barrel":
      return createBarrelObject(mapObject);
    case "sign":
      return createSignObject(mapObject);
    case "lamp":
      return createLampObject(mapObject);
    case "arch":
      return createArchObject(mapObject);
    case "pillar":
      return createPillarObject(mapObject);
    case "model":
      return createModelPlaceholder(mapObject);
    case "cube":
    default:
      return createBlockObject(mapObject);
  }
}

function createBlockObject(mapObject: MapObject): THREE.Object3D {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    createMaterial(mapObject, {
      roughness: 0.64,
      metalness: 0.03,
    })
  );
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(0.96, 0.035, 0.96),
    createMaterial(mapObject, {
      color: "#ffffff",
      transparent: true,
      opacity: 0.14,
      roughness: 0.5,
    })
  );
  cap.position.y = 0.515;
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(1.02, 0.035, 1.02),
    createMaterial(mapObject, {
      color: "#0f172a",
      transparent: true,
      opacity: 0.18,
      roughness: 0.8,
    })
  );
  base.position.y = -0.515;
  group.add(body, cap, base);
  return group;
}

function createPlatformObject(mapObject: MapObject): THREE.Object3D {
  const group = new THREE.Group();
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    createMaterial(mapObject, {
      roughness: 0.62,
      metalness: 0.04,
    })
  );
  const trimMaterial = new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.74 });
  trimMaterial.userData.fixedColor = true;

  const front = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.12, 0.08), trimMaterial);
  front.position.set(0, 0.08, -0.52);
  const back = front.clone();
  back.position.z = 0.52;
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 1.04), trimMaterial);
  left.position.set(-0.52, 0.08, 0);
  const right = left.clone();
  right.position.x = 0.52;

  group.add(deck, front, back, left, right);
  return group;
}

function createDamageZoneObject(mapObject: MapObject): THREE.Object3D {
  const group = new THREE.Group();
  const zone = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    createMaterial(mapObject, {
      transparent: true,
      opacity: 0.34,
      emissive: new THREE.Color("#7f1111"),
      emissiveIntensity: 0.25,
    })
  );
  const stripeMaterial = new THREE.MeshStandardMaterial({
    color: "#111827",
    roughness: 0.7,
    emissive: "#450a0a",
    emissiveIntensity: 0.12,
  });
  stripeMaterial.userData.fixedColor = true;

  for (let index = -2; index <= 2; index += 1) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 1.16), stripeMaterial);
    stripe.position.set(index * 0.22, 0.54, 0);
    stripe.rotation.z = Math.PI / 5;
    group.add(stripe);
  }

  group.add(zone);
  return group;
}

function createMovingPlatformObject(mapObject: MapObject): THREE.Object3D {
  const group = new THREE.Group();
  const material = createMaterial(mapObject, {
    metalness: 0.08,
    roughness: 0.45,
  });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  const railMaterial = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.72 });
  railMaterial.userData.fixedColor = true;
  const railA = new THREE.Mesh(new THREE.BoxGeometry(1, 0.08, 0.08), railMaterial);
  const railB = railA.clone();
  railA.position.set(0, 0.58, -0.42);
  railB.position.set(0, 0.58, 0.42);
  group.add(deck, railA, railB);
  return group;
}

function createDisappearingBlockObject(mapObject: MapObject): THREE.Object3D {
  const group = new THREE.Group();
  const material = createMaterial(mapObject, { transparent: true, opacity: 0.72 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  const stripeMaterial = new THREE.MeshStandardMaterial({ color: "#111827", roughness: 0.8 });
  stripeMaterial.userData.fixedColor = true;

  for (let index = -1; index <= 1; index += 1) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.04, 1.04), stripeMaterial);
    stripe.position.x = index * 0.28;
    stripe.rotation.z = Math.PI / 8;
    group.add(stripe);
  }

  group.add(body);
  return group;
}

function createJumpPadObject(mapObject: MapObject): THREE.Object3D {
  const group = new THREE.Group();
  const material = createMaterial(mapObject, {
    emissive: new THREE.Color("#14532d"),
    emissiveIntensity: 0.22,
  });
  const basePlateMaterial = new THREE.MeshStandardMaterial({
    color: "#0f172a",
    roughness: 0.7,
    metalness: 0.12,
  });
  basePlateMaterial.userData.fixedColor = true;
  const base = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  const basePlate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 1.1), basePlateMaterial);
  basePlate.position.y = -0.5;

  const arrowMaterial = new THREE.MeshStandardMaterial({
    color: "#dcfce7",
    emissive: "#22c55e",
    emissiveIntensity: 0.28,
    roughness: 0.42,
  });
  arrowMaterial.userData.fixedColor = true;
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.62, 4), arrowMaterial);
  arrow.position.y = 0.84;
  arrow.rotation.y = Math.PI / 4;

  const springMaterial = new THREE.MeshStandardMaterial({
    color: "#334155",
    roughness: 0.5,
    metalness: 0.35,
  });
  springMaterial.userData.fixedColor = true;
  for (const x of [-0.34, 0.34]) {
    const spring = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.46, 8),
      springMaterial
    );
    spring.position.set(x, 0.18, -0.34);
    group.add(spring);
  }

  group.add(basePlate, base, arrow);
  return group;
}

function createRampGeometry(): THREE.BufferGeometry {
  const vertices = new Float32Array([
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5,
    0.5,
  ]);

  const indices = [0, 2, 1, 1, 2, 3, 2, 4, 3, 3, 4, 5, 0, 1, 5, 0, 5, 4, 0, 4, 2, 1, 3, 5];

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createSpawnObject(mapObject: MapObject): THREE.Object3D {
  const group = new THREE.Group();
  const material = createMaterial(mapObject, { transparent: true, opacity: 0.9 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.78, 0.08, 36), material);
  base.position.y = -0.03;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.035, 8, 36), material);
  ring.position.y = 0.08;
  ring.rotation.x = Math.PI / 2;

  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.55, 4), material);
  arrow.position.y = 0.45;
  arrow.rotation.y = Math.PI / 4;

  group.add(base, ring, arrow);
  return group;
}

function createCheckpointObject(mapObject: MapObject): THREE.Object3D {
  const group = new THREE.Group();
  const material = createMaterial(mapObject);
  const poleMaterial = new THREE.MeshStandardMaterial({
    color: "#475569",
    roughness: 0.6,
    metalness: 0.18,
  });
  poleMaterial.userData.fixedColor = true;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.12, 16), poleMaterial);
  base.position.y = 0.06;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.8, 10), poleMaterial);
  pole.position.y = 0.55;

  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.42, 0.05), material);
  flag.position.set(0.35, 1.2, 0);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), material);
  tip.position.y = 1.48;

  group.add(base, pole, flag, tip);
  return group;
}

function createCoinObject(mapObject: MapObject): THREE.Object3D {
  const material = createMaterial(mapObject, {
    metalness: 0.35,
    roughness: 0.28,
    emissive: new THREE.Color("#6f4e00"),
    emissiveIntensity: 0.18,
  });
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.1, 36), material);
  coin.rotation.x = Math.PI / 2;
  const group = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.025, 8, 36), material);
  rim.rotation.x = Math.PI / 2;
  const mark = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.11, 0.42),
    new THREE.MeshStandardMaterial({ color: "#fff7ad", roughness: 0.22, metalness: 0.12 })
  );
  mark.material.userData.fixedColor = true;
  mark.rotation.x = Math.PI / 2;
  group.add(coin, rim, mark);
  return group;
}

function createTeleporterObject(mapObject: MapObject): THREE.Object3D {
  const group = new THREE.Group();
  const material = createMaterial(mapObject, {
    transparent: true,
    opacity: 0.82,
    emissive: new THREE.Color("#4c1d95"),
    emissiveIntensity: 0.35,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 10, 48), material);
  ring.rotation.x = Math.PI / 2;
  const upperRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 8, 40), material);
  upperRing.position.y = 1.22;
  upperRing.rotation.x = Math.PI / 2;

  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 32), material);
  core.position.y = 0.04;

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.42, 1.3, 28, 1, true),
    createMaterial(mapObject, { transparent: true, opacity: 0.26 })
  );
  beam.position.y = 0.65;

  const postMaterial = new THREE.MeshStandardMaterial({
    color: "#1e1b4b",
    roughness: 0.58,
    metalness: 0.22,
    emissive: "#312e81",
    emissiveIntensity: 0.08,
  });
  postMaterial.userData.fixedColor = true;
  for (const [x, z] of [
    [-0.5, -0.5],
    [0.5, -0.5],
    [-0.5, 0.5],
    [0.5, 0.5],
  ] as const) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.15, 8), postMaterial);
    post.position.set(x, 0.58, z);
    group.add(post);
  }

  group.add(core, ring, upperRing, beam);
  return group;
}

function createMessageZoneObject(mapObject: MapObject): THREE.Object3D {
  const group = new THREE.Group();
  const zone = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    createMaterial(mapObject, { transparent: true, opacity: 0.18, wireframe: true })
  );
  const marker = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.48),
    createMaterial(mapObject, { transparent: true, opacity: 0.5, side: THREE.DoubleSide })
  );
  marker.position.y = 0.72;
  group.add(zone, marker);
  return group;
}

function createKeyObject(mapObject: MapObject): THREE.Object3D {
  const group = new THREE.Group();
  const material = createMaterial(mapObject, {
    metalness: 0.22,
    roughness: 0.32,
    emissive: new THREE.Color("#1d4ed8"),
    emissiveIntensity: 0.18,
  });
  const head = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.055, 10, 28), material);
  head.rotation.x = Math.PI / 2;
  head.position.x = -0.22;

  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.1, 0.1), material);
  shaft.position.x = 0.18;

  const toothA = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.1), material);
  toothA.position.set(0.44, -0.1, 0);
  const toothB = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.1), material);
  toothB.position.set(0.6, -0.08, 0);

  group.position.y = 0.45;
  group.rotation.z = -0.18;
  group.add(head, shaft, toothA, toothB);
  return group;
}

function createDoorObject(mapObject: MapObject): THREE.Object3D {
  const group = new THREE.Group();
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), createMaterial(mapObject));
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: "#2f3542",
    roughness: 0.72,
  });
  frameMaterial.userData.fixedColor = true;
  const leftJamb = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.16, 1.16), frameMaterial);
  leftJamb.position.x = -0.56;
  const rightJamb = leftJamb.clone();
  rightJamb.position.x = 0.56;
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.1, 1.16), frameMaterial);
  lintel.position.y = 0.56;
  const sill = lintel.clone();
  sill.position.y = -0.56;
  group.add(leftJamb, rightJamb, lintel, sill, panel);

  const handleMaterial = new THREE.MeshStandardMaterial({
    color: "#e5e7eb",
    metalness: 0.38,
    roughness: 0.34,
  });
  handleMaterial.userData.fixedColor = true;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.2, 12), handleMaterial);
  handle.rotation.x = Math.PI / 2;
  handle.position.set(0.34, -0.02, -0.58);
  group.add(handle);

  const lockMaterial = new THREE.MeshStandardMaterial({
    color: "#facc15",
    metalness: 0.25,
    roughness: 0.38,
  });
  lockMaterial.userData.fixedColor = true;
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.08), lockMaterial);
  lock.position.set(0.33, 0, -0.58);
  lock.userData.requiredKeyLock = true;
  lock.visible =
    typeof mapObject.properties?.requiredKeyId === "string" &&
    mapObject.properties.requiredKeyId.trim().length > 0;
  group.add(lock);

  const stripeMaterial = new THREE.MeshStandardMaterial({
    color: "#fef3c7",
    transparent: true,
    opacity: 0.72,
    roughness: 0.44,
  });
  stripeMaterial.userData.fixedColor = true;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.14, 0.04), stripeMaterial);
  stripe.position.set(-0.24, 0, -0.525);
  stripe.rotation.z = -0.42;
  group.add(stripe);

  return group;
}

function createButtonObject(mapObject: MapObject): THREE.Object3D {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 0.12, 24),
    new THREE.MeshStandardMaterial({ color: "#343a40", roughness: 0.8 })
  );
  base.material.userData.fixedColor = true;
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.38, 0.16, 24),
    createMaterial(mapObject)
  );
  top.position.y = 0.12;
  const rimMaterial = new THREE.MeshStandardMaterial({
    color: "#111827",
    roughness: 0.62,
    metalness: 0.18,
  });
  rimMaterial.userData.fixedColor = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.035, 8, 24), rimMaterial);
  rim.position.y = 0.2;
  rim.rotation.x = Math.PI / 2;
  const indicator = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.035, 0.12),
    new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.28 })
  );
  indicator.material.userData.fixedColor = true;
  indicator.position.y = 0.23;
  group.add(base, top, rim, indicator);
  return group;
}

function createFinishObject(mapObject: MapObject): THREE.Object3D {
  const group = new THREE.Group();
  const material = createMaterial(mapObject, {
    emissive: new THREE.Color("#0f7a42"),
    emissiveIntensity: 0.28,
  });
  const torus = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.06, 10, 42), material);
  torus.rotation.x = Math.PI / 2;

  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.38), material);
  core.position.y = 0.45;
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), material);
  crown.position.y = 0.95;

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.5, 0.18, 24),
    new THREE.MeshStandardMaterial({ color: "#14532d", roughness: 0.6 })
  );
  base.material.userData.fixedColor = true;
  base.position.y = -0.38;

  group.add(base, torus, core, crown);
  return group;
}

function createNpcObject(mapObject: MapObject): THREE.Object3D {
  const group = new THREE.Group();
  const material = createMaterial(mapObject, { roughness: 0.58 });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.62 });
  darkMaterial.userData.fixedColor = true;
  const skinMaterial = new THREE.MeshStandardMaterial({ color: "#f3d1b0", roughness: 0.55 });
  skinMaterial.userData.fixedColor = true;
  const bubbleMaterial = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    roughness: 0.42,
    transparent: true,
    opacity: 0.9,
  });
  bubbleMaterial.userData.fixedColor = true;

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.56, 0.08, 18),
    new THREE.MeshStandardMaterial({ color: "#0f766e", roughness: 0.72 })
  );
  base.material.userData.fixedColor = true;
  base.position.y = 0.04;

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.46), material);
  body.position.y = 0.8;

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.52, 0.56), skinMaterial);
  head.position.y = 1.36;

  const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.035), darkMaterial);
  leftEye.position.set(-0.13, 1.42, -0.3);
  const rightEye = leftEye.clone();
  rightEye.position.x = 0.13;
  const smile = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 0.035), darkMaterial);
  smile.position.set(0, 1.26, -0.3);

  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.22), material);
  leftArm.position.set(-0.46, 0.78, -0.02);
  leftArm.rotation.z = 0.1;
  const rightArm = leftArm.clone();
  rightArm.position.x = 0.46;
  rightArm.rotation.z = -0.1;
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.58, 0.24), darkMaterial);
  leftLeg.position.set(-0.18, 0.32, 0);
  const rightLeg = leftLeg.clone();
  rightLeg.position.x = 0.18;

  const bubble = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.32, 0.04), bubbleMaterial);
  bubble.position.set(0.42, 1.82, -0.18);
  const bubbleTail = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.16, 3), bubbleMaterial);
  bubbleTail.position.set(0.18, 1.62, -0.18);
  bubbleTail.rotation.z = Math.PI;

  group.add(
    base,
    body,
    head,
    leftEye,
    rightEye,
    smile,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    bubble,
    bubbleTail
  );
  return group;
}

function createEnemyObject(mapObject: MapObject): THREE.Object3D {
  const group = new THREE.Group();
  const material = createMaterial(mapObject, {
    roughness: 0.68,
    emissive: new THREE.Color("#3f0000"),
    emissiveIntensity: 0.08,
  });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: "#111827", roughness: 0.72 });
  darkMaterial.userData.fixedColor = true;
  const eyeMaterial = new THREE.MeshStandardMaterial({
    color: "#fee2e2",
    emissive: "#ef4444",
    emissiveIntensity: 0.5,
    roughness: 0.36,
  });
  eyeMaterial.userData.fixedColor = true;

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.86, 0.52), material);
  body.position.y = 0.8;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.54, 0.62), material);
  head.position.y = 1.38;
  const leftHorn = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.36, 4), darkMaterial);
  leftHorn.position.set(-0.26, 1.74, -0.04);
  leftHorn.rotation.z = 0.25;
  const rightHorn = leftHorn.clone();
  rightHorn.position.x = 0.26;
  rightHorn.rotation.z = -0.25;

  const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.035), eyeMaterial);
  leftEye.position.set(-0.16, 1.43, -0.325);
  const rightEye = leftEye.clone();
  rightEye.position.x = 0.16;
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.055, 0.035), darkMaterial);
  mouth.position.set(0, 1.24, -0.325);

  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.66, 0.24), darkMaterial);
  leftArm.position.set(-0.52, 0.86, -0.02);
  leftArm.rotation.z = 0.08;
  const rightArm = leftArm.clone();
  rightArm.position.x = 0.52;
  rightArm.rotation.z = -0.08;
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.6, 0.26), darkMaterial);
  leftLeg.position.set(-0.22, 0.3, 0);
  const rightLeg = leftLeg.clone();
  rightLeg.position.x = 0.22;

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.58, 0.64, 0.08, 18),
    new THREE.MeshStandardMaterial({ color: "#450a0a", roughness: 0.82 })
  );
  base.material.userData.fixedColor = true;
  base.position.y = 0.04;

  group.add(
    base,
    body,
    head,
    leftHorn,
    rightHorn,
    leftEye,
    rightEye,
    mouth,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg
  );
  return group;
}

function createItemSpawnerObject(mapObject: MapObject): THREE.Object3D {
  const group = new THREE.Group();
  const material = createMaterial(mapObject, {
    emissive: new THREE.Color("#045f6f"),
    emissiveIntensity: 0.18,
  });
  const baseMaterial = new THREE.MeshStandardMaterial({ color: "#1f2937", roughness: 0.76 });
  baseMaterial.userData.fixedColor = true;

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.56, 0.16, 24), baseMaterial);
  base.position.y = 0.08;

  const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.48), material);
  beacon.position.y = 0.52;
  beacon.rotation.y = Math.PI / 4;

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 8, 32), material);
  ring.position.y = 0.3;
  ring.rotation.x = Math.PI / 2;

  const antennaMaterial = new THREE.MeshStandardMaterial({
    color: "#e0f2fe",
    roughness: 0.36,
    metalness: 0.18,
  });
  antennaMaterial.userData.fixedColor = true;
  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.48, 8),
    antennaMaterial
  );
  antenna.position.y = 0.96;
  const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), material);
  antennaTip.position.y = 1.22;

  group.add(base, ring, beacon, antenna, antennaTip);
  return group;
}

function createTeamSpawnObject(mapObject: MapObject): THREE.Object3D {
  const group = new THREE.Group();
  const material = createMaterial(mapObject, { transparent: true, opacity: 0.92 });
  const poleMaterial = new THREE.MeshStandardMaterial({
    color: "#1f2937",
    roughness: 0.68,
    metalness: 0.16,
  });
  poleMaterial.userData.fixedColor = true;

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 0.12, 28), material);
  base.position.y = 0.06;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.035, 8, 36), material);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.18;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 1.45, 10), poleMaterial);
  pole.position.y = 0.78;
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.42, 0.05), material);
  flag.position.set(0.36, 1.18, 0);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), material);
  tip.position.y = 1.52;

  group.add(base, ring, pole, flag, tip);
  return group;
}

function createCapturePointObject(mapObject: MapObject): THREE.Object3D {
  const group = new THREE.Group();
  const material = createMaterial(mapObject, {
    transparent: true,
    opacity: 0.68,
    emissive: new THREE.Color("#7c4a00"),
    emissiveIntensity: 0.2,
  });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: "#111827", roughness: 0.75 });
  darkMaterial.userData.fixedColor = true;

  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.82, 0.12, 36), material);
  plate.position.y = 0.06;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.045, 8, 44), material);
  ring.position.y = 0.2;
  ring.rotation.x = Math.PI / 2;
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.72, 18), darkMaterial);
  pillar.position.y = 0.45;
  const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.34), material);
  beacon.position.y = 0.92;
  const radiusHalo = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.012, 6, 64),
    createMaterial(mapObject, { transparent: true, opacity: 0.34, side: THREE.DoubleSide })
  );
  radiusHalo.position.y = 0.025;
  radiusHalo.rotation.x = Math.PI / 2;

  group.add(plate, ring, pillar, beacon, radiusHalo);
  return group;
}

function createTycoonClaimObject(mapObject: MapObject): THREE.Object3D {
  const group = new THREE.Group();
  const material = createMaterial(mapObject, {
    emissive: new THREE.Color("#14532d"),
    emissiveIntensity: 0.18,
  });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.74 });
  darkMaterial.userData.fixedColor = true;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.82, 0.1, 32), material);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.035, 8, 36), darkMaterial);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.08;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 1.35, 10), darkMaterial);
  pole.position.set(-0.28, 0.72, 0);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.34, 0.035), material);
  flag.position.set(0.04, 1.22, 0);
  group.add(base, ring, pole, flag);
  return group;
}

function createTycoonGeneratorObject(mapObject: MapObject): THREE.Object3D {
  const group = new THREE.Group();
  const material = createMaterial(mapObject, { metalness: 0.18, roughness: 0.44 });
  const darkMaterial = new THREE.MeshStandardMaterial({
    color: "#172033",
    roughness: 0.7,
    metalness: 0.12,
  });
  darkMaterial.userData.fixedColor = true;
  const coinMaterial = new THREE.MeshStandardMaterial({
    color: "#facc15",
    emissive: "#f59e0b",
    emissiveIntensity: 0.25,
    roughness: 0.34,
    metalness: 0.16,
  });
  coinMaterial.userData.fixedColor = true;
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.72, 0.9), material);
  base.position.y = 0.36;
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.16, 1.04), darkMaterial);
  top.position.y = 0.8;
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.16, 32), coinMaterial);
  core.rotation.x = Math.PI / 2;
  core.position.set(0, 0.44, -0.48);
  const pipeA = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 1.2), darkMaterial);
  pipeA.position.set(-0.36, 0.58, 0);
  const pipeB = pipeA.clone();
  pipeB.position.x = 0.36;
  const light = new THREE.PointLight("#fde68a", 0.65, 4);
  light.position.set(0, 1.15, 0);
  group.add(base, top, core, pipeA, pipeB, light);
  return group;
}

function createTycoonCollectorObject(mapObject: MapObject): THREE.Object3D {
  const group = new THREE.Group();
  const material = createMaterial(mapObject, {
    emissive: new THREE.Color("#92400e"),
    emissiveIntensity: 0.12,
  });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: "#1f2937", roughness: 0.78 });
  darkMaterial.userData.fixedColor = true;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.82, 0.12, 36), darkMaterial);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.66, 0.18, 36, 1, true), material);
  bowl.position.y = 0.16;
  const coin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 0.07, 28),
    new THREE.MeshStandardMaterial({ color: "#fde047", roughness: 0.3, metalness: 0.12 })
  );
  coin.material.userData.fixedColor = true;
  coin.position.y = 0.32;
  coin.rotation.x = Math.PI / 2;
  group.add(base, bowl, coin);
  return group;
}

function createTycoonBuyButtonObject(mapObject: MapObject): THREE.Object3D {
  const group = createButtonObject(mapObject);
  const coinMaterial = new THREE.MeshStandardMaterial({
    color: "#fde047",
    roughness: 0.32,
    metalness: 0.18,
    emissive: "#f59e0b",
    emissiveIntensity: 0.16,
  });
  coinMaterial.userData.fixedColor = true;
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 24), coinMaterial);
  coin.position.set(0, 0.42, 0);
  coin.rotation.x = Math.PI / 2;
  group.add(coin);
  return group;
}

function createTycoonUnlockableObject(mapObject: MapObject): THREE.Object3D {
  const group = createBlockObject(mapObject);
  const lockMaterial = new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.45 });
  lockMaterial.userData.fixedColor = true;
  const lockBody = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.08), lockMaterial);
  lockBody.position.set(0, 0.18, -0.53);
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.028, 8, 24), lockMaterial);
  shackle.position.set(0, 0.4, -0.53);
  group.add(lockBody, shackle);
  return group;
}

function createTycoonUpgradeObject(mapObject: MapObject): THREE.Object3D {
  const group = new THREE.Group();
  const material = createMaterial(mapObject, {
    emissive: new THREE.Color("#083344"),
    emissiveIntensity: 0.18,
  });
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: "#1f2937",
    roughness: 0.72,
    metalness: 0.12,
  });
  baseMaterial.userData.fixedColor = true;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.62, 0.16, 28), baseMaterial);
  const column = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.42, 0.48), material);
  column.position.y = 0.28;
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.52, 4), material);
  arrow.position.y = 0.8;
  arrow.rotation.y = Math.PI / 4;
  group.add(base, column, arrow);
  return group;
}

function createTycoonBarrierObject(mapObject: MapObject): THREE.Object3D {
  const group = new THREE.Group();
  const material = createMaterial(mapObject, {
    transparent: true,
    opacity: getNumberProperty(mapObject, "opacity", 0.58),
    emissive: new THREE.Color("#7f1d1d"),
    emissiveIntensity: 0.22,
  });
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  const postMaterial = new THREE.MeshStandardMaterial({
    color: "#111827",
    roughness: 0.64,
    metalness: 0.18,
  });
  postMaterial.userData.fixedColor = true;
  const postA = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.08, 1.08), postMaterial);
  postA.position.x = -0.54;
  const postB = postA.clone();
  postB.position.x = 0.54;
  group.add(panel, postA, postB);
  return group;
}

function createItemPickupObject(mapObject: MapObject): THREE.Object3D {
  const itemId =
    typeof mapObject.properties?.itemId === "string" ? mapObject.properties.itemId : "";
  const item = getItemDefinition(itemId);
  const color = item?.color ?? "#facc15";
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.35,
    metalness: 0.08,
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.18,
  });
  const group = new THREE.Group();
  const core = createPickupCore(itemId, material);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.025, 8, 32), material);
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 0.05;
  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.08, 28),
    new THREE.MeshStandardMaterial({ color: "#111827", roughness: 0.82 })
  );
  plate.material.userData.fixedColor = true;
  plate.position.y = -0.34;
  core.position.y = 0.05;
  group.add(plate, halo, core);
  return group;
}

function createPickupCore(itemId: string, material: THREE.MeshStandardMaterial): THREE.Object3D {
  if (itemId === "health_pack" || itemId === "health") {
    const group = new THREE.Group();
    const horizontal = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.16, 0.16), material);
    const vertical = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.54, 0.16), material);
    group.position.y = 0.06;
    group.add(horizontal, vertical);
    return group;
  }

  if (itemId === "coin") {
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.09, 30), material);
    coin.rotation.x = Math.PI / 2;
    coin.position.y = 0.06;
    return coin;
  }

  if (isWeaponItemId(itemId)) {
    const weapon = createWeaponVisual(itemId, { forPickup: true });
    weapon.position.y = 0.26;
    weapon.scale.multiplyScalar(0.82);
    return weapon;
  }

  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.32), material);
  core.position.y = 0.05;
  return core;
}

function createTreeObject(mapObject: MapObject): THREE.Object3D {
  const group = new THREE.Group();
  const trunkMaterial = new THREE.MeshStandardMaterial({
    color: "#7c4a21",
    roughness: 0.82,
  });
  trunkMaterial.userData.fixedColor = true;

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.25, 6), trunkMaterial);
  trunk.position.y = 0.62;

  const foliageMaterial = createMaterial(mapObject, {
    roughness: 0.76,
    metalness: 0,
  });
  const lower = new THREE.Mesh(new THREE.ConeGeometry(0.82, 1.15, 7), foliageMaterial);
  lower.position.y = 1.35;
  const upper = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.95, 7), foliageMaterial);
  upper.position.y = 1.95;
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.68, 7), foliageMaterial);
  crown.position.y = 2.42;

  group.add(trunk, lower, upper, crown);
  return group;
}

function createRockObject(mapObject: MapObject): THREE.Object3D {
  const group = new THREE.Group();
  const material = createMaterial(mapObject, { roughness: 0.9, metalness: 0 });
  const main = new THREE.Mesh(new THREE.DodecahedronGeometry(0.62, 0), material);
  main.position.y = 0.36;
  main.rotation.set(0.24, 0.5, -0.18);
  main.scale.set(1.1, 0.72, 0.95);
  const sideA = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), material);
  sideA.position.set(-0.38, 0.22, 0.18);
  sideA.rotation.set(-0.12, 0.2, 0.28);
  const sideB = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), material);
  sideB.position.set(0.42, 0.18, -0.22);
  sideB.rotation.set(0.4, -0.22, 0.12);
  group.add(main, sideA, sideB);
  return group;
}

function createCrateObject(mapObject: MapObject): THREE.Object3D {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    createMaterial(mapObject, {
      roughness: 0.78,
      metalness: 0,
    })
  );
  body.position.y = 0.5;

  const bandMaterial = new THREE.MeshStandardMaterial({ color: "#6b3f18", roughness: 0.86 });
  bandMaterial.userData.fixedColor = true;
  const bandA = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.12, 1.06), bandMaterial);
  bandA.position.y = 0.5;
  const bandB = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.04, 1.06), bandMaterial);
  bandB.position.y = 0.5;
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.08, 1.08), bandMaterial);
  lid.position.y = 1.03;
  const diagonalFront = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.1, 0.08), bandMaterial);
  diagonalFront.position.set(0, 0.5, -0.56);
  diagonalFront.rotation.z = 0.68;
  const diagonalBack = diagonalFront.clone();
  diagonalBack.position.z = 0.56;
  diagonalBack.rotation.z = -0.68;

  group.add(body, bandA, bandB, lid, diagonalFront, diagonalBack);
  return group;
}

function createBarrelObject(mapObject: MapObject): THREE.Object3D {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 1, 16),
    createMaterial(mapObject, { roughness: 0.62, metalness: 0.12 })
  );
  body.position.y = 0.55;

  const ringMaterial = new THREE.MeshStandardMaterial({
    color: "#3f3f46",
    roughness: 0.48,
    metalness: 0.35,
  });
  ringMaterial.userData.fixedColor = true;

  for (const y of [0.16, 0.54, 0.92]) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.08, 16), ringMaterial);
    ring.position.y = y;
    group.add(ring);
  }

  const capMaterial = new THREE.MeshStandardMaterial({
    color: "#27272a",
    roughness: 0.5,
    metalness: 0.26,
  });
  capMaterial.userData.fixedColor = true;
  const topCap = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.04, 16), capMaterial);
  topCap.position.y = 1.07;
  const bottomCap = topCap.clone();
  bottomCap.position.y = 0.03;

  group.add(body, topCap, bottomCap);
  return group;
}

function createSignObject(mapObject: MapObject): THREE.Object3D {
  const group = new THREE.Group();
  const postMaterial = new THREE.MeshStandardMaterial({ color: "#6b3f18", roughness: 0.82 });
  postMaterial.userData.fixedColor = true;

  const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.2, 0.16), postMaterial);
  post.position.y = 0.6;
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.58, 0.1), postMaterial);
  board.position.y = 1.18;

  const front = new THREE.Mesh(
    new THREE.PlaneGeometry(1.14, 0.48),
    createSignTextMaterial(mapObject)
  );
  front.position.set(0, 1.18, -0.056);

  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(1.14, 0.48),
    createSignTextMaterial(mapObject)
  );
  back.position.set(0, 1.18, 0.056);
  back.rotation.y = Math.PI;

  group.add(post, board, front, back);
  return group;
}

function createLampObject(mapObject: MapObject): THREE.Object3D {
  const group = new THREE.Group();
  const poleMaterial = new THREE.MeshStandardMaterial({
    color: "#334155",
    roughness: 0.58,
    metalness: 0.28,
  });
  poleMaterial.userData.fixedColor = true;

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.45, 10), poleMaterial);
  pole.position.y = 0.72;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.16, 12), poleMaterial);
  cap.position.y = 1.44;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.07, 0.07), poleMaterial);
  arm.position.set(0.22, 1.34, 0);

  const lightColor = getStringProperty(mapObject, "lightColor", "#fff7aa");
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 16, 12),
    createMaterial(mapObject, {
      color: lightColor,
      emissive: new THREE.Color(lightColor),
      emissiveIntensity: 0.85,
      roughness: 0.22,
    })
  );
  bulb.position.set(0.44, 1.24, 0);

  const shadeMaterial = new THREE.MeshStandardMaterial({
    color: "#475569",
    roughness: 0.52,
    metalness: 0.2,
  });
  shadeMaterial.userData.fixedColor = true;
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.22, 16, 1, true), shadeMaterial);
  shade.position.set(0.44, 1.38, 0);
  shade.rotation.x = Math.PI;

  const pointLight = new THREE.PointLight(lightColor, 1.5, 8);
  pointLight.position.set(0.44, 1.24, 0);
  pointLight.castShadow = false;
  pointLight.userData.lampLight = true;
  updateLampLight(pointLight, mapObject);

  group.add(pole, arm, bulb, shade, cap, pointLight);
  return group;
}

function createArchObject(mapObject: MapObject): THREE.Object3D {
  const group = new THREE.Group();
  const material = createMaterial(mapObject, { roughness: 0.74, metalness: 0.02 });
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.32, 2, 0.62), material);
  left.position.set(-0.42, 1, 0);
  const right = left.clone();
  right.position.x = 0.42;
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.36, 0.62), material);
  top.position.y = 2.18;

  group.add(left, right, top);
  return group;
}

function createPillarObject(mapObject: MapObject): THREE.Object3D {
  const group = new THREE.Group();
  const material = createMaterial(mapObject, { roughness: 0.7, metalness: 0.02 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.18, 0.72), material);
  base.position.y = 0.09;
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 1.65, 10), material);
  column.position.y = 0.98;
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.2, 0.78), material);
  top.position.y = 1.85;

  group.add(base, column, top);
  return group;
}

function createModelPlaceholder(mapObject: MapObject): THREE.Object3D {
  const group = new THREE.Group();
  const material = createMaterial(mapObject, {
    transparent: true,
    opacity: 0.2,
    wireframe: true,
  });
  const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  group.add(box);
  return group;
}

function createMaterial(
  mapObject: MapObject,
  options: StandardMaterialOptions = {}
): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial();
  material.userData.baseMaterialOptions = { ...options };
  applyMaterialSettings(material, mapObject, options);
  return material;
}

function applyMaterialSettings(
  material: THREE.MeshStandardMaterial,
  mapObject: MapObject,
  options: StandardMaterialOptions = {}
): void {
  const kind = getVisualMaterial(mapObject);
  const color = getObjectColor(mapObject, kind);
  const explicitOpacity = getNumberProperty(mapObject, "opacity", Number.NaN);
  const preset = getMaterialPreset(kind);

  material.color.set(getOptionColor(options.color, color));
  material.roughness = getOptionNumber(options.roughness, preset.roughness);
  material.metalness = getOptionNumber(options.metalness, preset.metalness);

  const optionOpacity = getOptionNumber(options.opacity, preset.opacity);
  const opacity = Number.isFinite(explicitOpacity)
    ? THREE.MathUtils.clamp(explicitOpacity, 0.08, 1)
    : THREE.MathUtils.clamp(optionOpacity, 0.08, 1);
  material.opacity = opacity;
  material.transparent = Boolean(options.transparent) || preset.transparent || opacity < 1;
  material.depthWrite = opacity >= 0.99;
  material.wireframe = Boolean(options.wireframe);
  material.side = options.side ?? THREE.FrontSide;

  const emissive = getOptionColor(
    options.emissive,
    getStringProperty(mapObject, "emissive", preset.emissive)
  );
  material.emissive.set(emissive);
  material.emissiveIntensity = getOptionNumber(options.emissiveIntensity, preset.emissiveIntensity);
  material.needsUpdate = true;
}

function createSignTextMaterial(mapObject: MapObject): THREE.MeshStandardMaterial {
  const texture = createSignTextTexture(mapObject);
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color: "#ffffff",
    roughness: 0.8,
    metalness: 0,
    side: THREE.FrontSide,
  });
  material.userData.fixedColor = true;
  material.userData.signText = true;
  return material;
}

function updateSignTextMaterial(material: THREE.Material, mapObject: MapObject): void {
  if (!(material instanceof THREE.MeshStandardMaterial)) {
    return;
  }

  if (material.map) {
    material.map.dispose();
  }

  material.map = createSignTextTexture(mapObject);
  material.color.set("#ffffff");
  material.needsUpdate = true;
}

function createSignTextTexture(mapObject: MapObject): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext("2d");

  if (context) {
    const background = getStringProperty(
      mapObject,
      "color",
      getObjectCatalogItem(mapObject.type).color
    );
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#5f3b19";
    context.lineWidth = 18;
    context.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);
    context.fillStyle = "#172033";
    context.font = "bold 52px Inter, Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";

    const text = getStringProperty(mapObject, "text", "Bem-vindo!");
    const lines = wrapText(context, text, 390).slice(0, 3);
    const lineHeight = 58;
    const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;

    lines.forEach((line, index) => {
      context.fillText(line, canvas.width / 2, startY + index * lineHeight);
    });
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function updateLampLight(light: THREE.PointLight, mapObject: MapObject): void {
  const enabled = mapObject.properties?.lightEnabled !== false;
  light.visible = enabled;
  light.color.set(getStringProperty(mapObject, "lightColor", "#fff7aa"));
  light.intensity = enabled
    ? THREE.MathUtils.clamp(getNumberProperty(mapObject, "lightIntensity", 1.5), 0, 4)
    : 0;
  light.distance = THREE.MathUtils.clamp(getNumberProperty(mapObject, "lightRange", 8), 0, 20);
  light.decay = 2;
}

function disposeMaterial(material: THREE.Material): void {
  const withTextures = material as THREE.Material & {
    map?: THREE.Texture | null;
    normalMap?: THREE.Texture | null;
    roughnessMap?: THREE.Texture | null;
    metalnessMap?: THREE.Texture | null;
    emissiveMap?: THREE.Texture | null;
    alphaMap?: THREE.Texture | null;
  };
  const textures = [
    withTextures.map,
    withTextures.normalMap,
    withTextures.roughnessMap,
    withTextures.metalnessMap,
    withTextures.emissiveMap,
    withTextures.alphaMap,
  ];

  textures.forEach((texture) => texture?.dispose());
  material.dispose();
}

function getMaterialPreset(kind: VisualMaterial): {
  roughness: number;
  metalness: number;
  opacity: number;
  transparent: boolean;
  emissive: string;
  emissiveIntensity: number;
} {
  switch (kind) {
    case "metal":
      return {
        roughness: 0.18,
        metalness: 0.9,
        opacity: 1,
        transparent: false,
        emissive: "#000000",
        emissiveIntensity: 0,
      };
    case "glass":
      return {
        roughness: 0.04,
        metalness: 0,
        opacity: 0.36,
        transparent: true,
        emissive: "#000000",
        emissiveIntensity: 0,
      };
    case "glow":
      return {
        roughness: 0.28,
        metalness: 0.02,
        opacity: 1,
        transparent: false,
        emissive: "#66f7ff",
        emissiveIntensity: 1.18,
      };
    case "rubber":
      return {
        roughness: 0.96,
        metalness: 0,
        opacity: 1,
        transparent: false,
        emissive: "#000000",
        emissiveIntensity: 0,
      };
    case "ice":
      return {
        roughness: 0.1,
        metalness: 0,
        opacity: 0.58,
        transparent: true,
        emissive: "#8edfff",
        emissiveIntensity: 0.2,
      };
    case "default":
    default:
      return {
        roughness: 0.58,
        metalness: 0.04,
        opacity: 1,
        transparent: false,
        emissive: "#000000",
        emissiveIntensity: 0,
      };
  }
}

function getVisualMaterial(mapObject: MapObject): VisualMaterial {
  const material = mapObject.properties?.material;

  if (
    material === "metal" ||
    material === "glass" ||
    material === "glow" ||
    material === "rubber" ||
    material === "ice"
  ) {
    return material;
  }

  return "default";
}

function getObjectColor(mapObject: MapObject, kind: VisualMaterial): string {
  const customColor = getStringProperty(mapObject, "color", "");

  if (customColor) {
    return customColor;
  }

  if (kind === "rubber") {
    return "#1f2937";
  }

  if (kind === "ice") {
    return "#a7f3ff";
  }

  return getObjectCatalogItem(mapObject.type).color;
}

function getBaseMaterialOptions(material: THREE.Material): StandardMaterialOptions {
  const options = material.userData.baseMaterialOptions;
  return typeof options === "object" && options !== null
    ? (options as StandardMaterialOptions)
    : {};
}

function getStringProperty(mapObject: MapObject, property: string, fallback: string): string {
  const value = mapObject.properties?.[property];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function getNumberProperty(mapObject: MapObject, property: string, fallback: number): number {
  const value = mapObject.properties?.[property];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getOptionNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getOptionColor(value: unknown, fallback: string): THREE.ColorRepresentation {
  return value instanceof THREE.Color || typeof value === "string" || typeof value === "number"
    ? value
    : fallback;
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  const lines: string[] = [];
  let current = "";

  for (const word of words.length > 0 ? words : [""]) {
    const next = current ? `${current} ${word}` : word;

    if (context.measureText(next).width <= maxWidth || current.length === 0) {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current.length > 0) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : ["Bem-vindo!"];
}

function toVector3(vector: THREE.Vector3 | THREE.Euler): Vector3 {
  return {
    x: round(vector.x),
    y: round(vector.y),
    z: round(vector.z),
  };
}

function round(value: number): number {
  return Number(value.toFixed(4));
}
