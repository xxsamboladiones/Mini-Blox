import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createMapObject3D } from "../../ObjectFactory";
import { createMockAudioSystem } from "../../testing/createMockAudioSystem";
import { createMockFeedbackSystem } from "../../testing/createMockFeedbackSystem";
import { createMockHud } from "../../testing/createMockHud";
import { createMockPhysicsSystem } from "../../testing/createMockPhysicsSystem";
import { createFreeplayTestMap, createRuntimeTestObject } from "../../testing/createRuntimeTestMap";
import { createPlayerBounds } from "../../testing/simulateRuntimeTicks";
import { RuntimeSystemManager } from "../core/RuntimeSystemManager";
import { RuntimeMovementObjectSystem } from "./RuntimeMovementObjectSystem";
import type { GameMap } from "../../../shared/types/MapSchema";
import type { MapObject, Vector3 } from "../../../shared/types/ObjectSchema";

describe("RuntimeMovementObjectSystem", () => {
  it("movingPlatform atualiza posicao apos update", () => {
    const platform = createMovingPlatform({ speed: 5 });
    const fixture = createMovementFixture([platform]);

    fixture.system.update(1);

    expect(fixture.objectViews.get("platform")?.position.x).toBeCloseTo(5);
  });

  it("movingPlatform loopa corretamente", () => {
    const platform = createMovingPlatform({ speed: 10 });
    const fixture = createMovementFixture([platform]);

    fixture.system.update(1.2);
    expect(fixture.objectViews.get("platform")?.position.x).toBeCloseTo(8);

    fixture.system.update(1);
    expect(fixture.objectViews.get("platform")?.position.x).toBeCloseTo(2);
  });

  it("movingPlatform sem loop para no fim", () => {
    const platform = createMovingPlatform({ speed: 10, loop: false });
    const fixture = createMovementFixture([platform]);

    fixture.system.update(2);
    fixture.system.update(2);

    expect(fixture.objectViews.get("platform")?.position.x).toBeCloseTo(10);
  });

  it("collider da movingPlatform acompanha nova posicao", () => {
    const platform = createMovingPlatform({ speed: 5 });
    const fixture = createMovementFixture([platform]);

    fixture.system.update(1);

    const collider = fixture.physics
      .getSolidColliders()
      .find((item) => item.objectId === "platform");
    const center = new THREE.Vector3();
    collider?.bounds.getCenter(center);
    expect(center.x).toBeCloseTo(fixture.objectViews.get("platform")?.position.x ?? -999);
  });

  it("disappearingBlock fica invisivel depois do delay", () => {
    const block = createRuntimeTestObject(
      "disappearingBlock",
      "block",
      { delayBeforeDisappear: 0.25, respawnDelay: 1 },
      { x: 0, y: 0.5, z: 0 }
    );
    const fixture = createMovementFixture([block]);

    fixture.system.updateObject(block, fixture.playerBounds, 0.25);

    expect(fixture.objectViews.get("block")?.visible).toBe(false);
  });

  it("disappearingBlock remove collider enquanto invisivel", () => {
    const block = createRuntimeTestObject(
      "disappearingBlock",
      "block",
      { delayBeforeDisappear: 0.1, respawnDelay: 1 },
      { x: 0, y: 0.5, z: 0 }
    );
    const fixture = createMovementFixture([block]);

    fixture.system.updateObject(block, fixture.playerBounds, 0.1);

    expect(fixture.physics.hasCollider("block")).toBe(false);
  });

  it("disappearingBlock reaparece depois do respawnDelay", () => {
    const block = createRuntimeTestObject(
      "disappearingBlock",
      "block",
      { delayBeforeDisappear: 0.1, respawnDelay: 0.5 },
      { x: 0, y: 0.5, z: 0 }
    );
    const fixture = createMovementFixture([block]);

    fixture.system.updateObject(block, fixture.playerBounds, 0.1);
    fixture.system.updateObject(block, fixture.playerBounds, 0.5);

    expect(fixture.objectViews.get("block")?.visible).toBe(true);
    expect(fixture.physics.hasCollider("block")).toBe(true);
  });

  it("jumpPad aplica impulso", () => {
    const jumpPad = createRuntimeTestObject(
      "jumpPad",
      "jump",
      { force: 14, cooldown: 0.4 },
      { x: 0, y: 0.2, z: 0 }
    );
    const fixture = createMovementFixture([jumpPad]);

    fixture.system.updateObject(jumpPad, fixture.playerBounds, 0.016);

    expect(fixture.impulses).toEqual([14]);
    expect(fixture.jumpPadFeedbackCount).toBe(1);
  });

  it("jumpPad respeita cooldown", () => {
    const jumpPad = createRuntimeTestObject(
      "jumpPad",
      "jump",
      { force: 12, cooldown: 0.4 },
      { x: 0, y: 0.2, z: 0 }
    );
    const fixture = createMovementFixture([jumpPad]);

    fixture.system.updateObject(jumpPad, fixture.playerBounds, 0.016);
    fixture.system.updateObject(jumpPad, fixture.playerBounds, 0.016);
    fixture.system.update(0.4);
    fixture.system.updateObject(jumpPad, fixture.playerBounds, 0.016);
    fixture.system.update(0.01);
    fixture.system.updateObject(jumpPad, fixture.playerBounds, 0.016);

    expect(fixture.impulses).toEqual([12, 12]);
  });

  it("teleporter move player ao alvo correto", () => {
    const source = createTeleporter("source", "target", { x: 0, y: 0.5, z: 0 });
    const target = createTeleporter("target", "", { x: 8, y: 1, z: 2 });
    const fixture = createMovementFixture([source, target]);

    fixture.system.updateObject(source, fixture.playerBounds, 0.016);

    expect(fixture.playerPosition).toEqual(target.position);
    expect(fixture.resetVelocityCount).toBe(1);
  });

  it("teleporter respeita cooldown", () => {
    const source = createTeleporter("source", "target", { x: 0, y: 0.5, z: 0 }, 0.5);
    const target = createTeleporter("target", "source", { x: 8, y: 1, z: 2 }, 0.5);
    const fixture = createMovementFixture([source, target]);

    fixture.system.updateObject(source, fixture.playerBounds, 0.016);
    fixture.system.updateObject(
      target,
      createPlayerBounds(target.position, { x: 1, y: 1, z: 1 }),
      0.016
    );
    expect(fixture.teleports).toHaveLength(1);

    fixture.system.update(0.5);
    fixture.system.updateObject(
      target,
      createPlayerBounds(target.position, { x: 1, y: 1, z: 1 }),
      0.016
    );
    expect(fixture.teleports).toHaveLength(2);
    expect(fixture.playerPosition).toEqual(source.position);
  });

  it("teleporter sem alvo nao quebra runtime", () => {
    const source = createTeleporter("source", "missing", { x: 0, y: 0.5, z: 0 });
    const fixture = createMovementFixture([source]);

    expect(() => fixture.system.updateObject(source, fixture.playerBounds, 0.016)).not.toThrow();
    expect(fixture.teleports).toEqual([]);
  });

  it("reset restaura plataforma, bloco e cooldowns", () => {
    const platform = createMovingPlatform({ speed: 10 });
    const block = createRuntimeTestObject(
      "disappearingBlock",
      "block",
      { delayBeforeDisappear: 0.1, respawnDelay: 10 },
      { x: 0, y: 0.5, z: 0 }
    );
    const jumpPad = createRuntimeTestObject(
      "jumpPad",
      "jump",
      { cooldown: 10 },
      { x: 0, y: 0.2, z: 0 }
    );
    const fixture = createMovementFixture([platform, block, jumpPad]);

    fixture.system.update(1);
    fixture.system.updateObject(block, fixture.playerBounds, 0.1);
    fixture.system.updateObject(jumpPad, fixture.playerBounds, 0.016);

    fixture.system.reset();
    fixture.system.updateObject(jumpPad, fixture.playerBounds, 0.016);

    expect(fixture.objectViews.get("platform")?.position.x).toBeCloseTo(0);
    expect(fixture.objectViews.get("block")?.visible).toBe(true);
    expect(fixture.physics.hasCollider("block")).toBe(true);
    expect(fixture.impulses).toEqual([12, 12]);
  });

  it("nao afeta mapas sem objetos de movimento", () => {
    const cube = createRuntimeTestObject("cube", "cube", {}, { x: 2, y: 0.5, z: 0 });
    const fixture = createMovementFixture([cube]);
    const initialPosition = fixture.objectViews.get("cube")?.position.clone();

    fixture.system.update(1);
    fixture.system.reset();

    expect(fixture.objectViews.get("cube")?.position).toEqual(initialPosition);
    expect(fixture.impulses).toEqual([]);
    expect(fixture.teleports).toEqual([]);
  });

  it("RuntimeSystemManager registra e reseta o sistema corretamente", () => {
    const block = createRuntimeTestObject(
      "disappearingBlock",
      "block",
      { delayBeforeDisappear: 0.1, respawnDelay: 10 },
      { x: 0, y: 0.5, z: 0 }
    );
    const fixture = createMovementFixture([block]);
    const manager = new RuntimeSystemManager();

    manager.register(fixture.system);
    fixture.system.updateObject(block, fixture.playerBounds, 0.1);
    manager.reset();

    expect(manager.getSystem("movement-objects")).toBe(fixture.system);
    expect(fixture.objectViews.get("block")?.visible).toBe(true);
  });
});

function createMovingPlatform(properties: Record<string, unknown> = {}): MapObject {
  return createRuntimeTestObject(
    "movingPlatform",
    "platform",
    {
      startOffset: { x: 0, y: 0, z: 0 },
      endOffset: { x: 10, y: 0, z: 0 },
      speed: 1,
      loop: true,
      ...properties,
    },
    { x: 0, y: 0.5, z: 0 },
    { x: 2, y: 0.3, z: 2 }
  );
}

function createTeleporter(
  id: string,
  targetTeleporterId: string,
  position: Vector3,
  cooldown = 1
): MapObject {
  return createRuntimeTestObject(
    "teleporter",
    id,
    {
      teleporterId: id,
      targetTeleporterId,
      cooldown,
    },
    position
  );
}

function createMovementFixture(objects: MapObject[]) {
  const map = createFreeplayTestMap(objects);
  const world = new THREE.Group();
  const objectViews = createObjectViews(map, world);
  const physics = createMockPhysicsSystem();
  const hud = createMockHud();
  const audio = createMockAudioSystem();
  const feedback = createMockFeedbackSystem();
  let playerPosition: Vector3 = { x: 0, y: 0.5, z: 0 };
  const teleports: Vector3[] = [];
  const impulses: number[] = [];
  let resetVelocityCount = 0;
  let jumpPadFeedbackCount = 0;
  const playerBounds = createPlayerBounds(playerPosition, { x: 1, y: 1, z: 1 });

  const system = new RuntimeMovementObjectSystem({
    map,
    objectViews,
    physicsSystem: physics,
    hud,
    audio,
    feedback,
    getPlayerBounds: () => playerBounds,
    getPlayerPosition: () => playerPosition,
    setPlayerPosition: (position) => {
      playerPosition = { ...position };
      teleports.push(playerPosition);
    },
    resetPlayerVelocity: () => {
      resetVelocityCount += 1;
    },
    applyPlayerImpulseY: (force) => impulses.push(force),
    playJumpPadFeedback: () => {
      jumpPadFeedbackCount += 1;
    },
  });

  return {
    map,
    world,
    objectViews,
    physics,
    hud,
    audio,
    feedback,
    system,
    playerBounds,
    get playerPosition() {
      return playerPosition;
    },
    get resetVelocityCount() {
      return resetVelocityCount;
    },
    get jumpPadFeedbackCount() {
      return jumpPadFeedbackCount;
    },
    teleports,
    impulses,
  };
}

function createObjectViews(map: GameMap, world: THREE.Group): Map<string, THREE.Object3D> {
  const objectViews = new Map<string, THREE.Object3D>();

  for (const mapObject of map.objects) {
    const view = createMapObject3D(mapObject);
    objectViews.set(mapObject.id, view);
    world.add(view);
  }

  return objectViews;
}
