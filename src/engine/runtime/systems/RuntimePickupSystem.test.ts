import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { createMapObject3D } from "../../ObjectFactory";
import { createMockAudioSystem } from "../../testing/createMockAudioSystem";
import { createMockFeedbackSystem } from "../../testing/createMockFeedbackSystem";
import { createMockHud } from "../../testing/createMockHud";
import { createFreeplayTestMap, createRuntimeTestObject } from "../../testing/createRuntimeTestMap";
import { createPlayerBounds } from "../../testing/simulateRuntimeTicks";
import { RuntimePickupSystem } from "./RuntimePickupSystem";
import type { GameMap } from "../../../shared/types/MapSchema";
import type { WorldEvent } from "../../../shared/types/MultiplayerSchema";
import type { MapObject, Vector3 } from "../../../shared/types/ObjectSchema";

describe("RuntimePickupSystem", () => {
  it("coleta coin uma vez e emite world event", () => {
    const coin = createRuntimeTestObject("coin", "coin_1", { value: 5 }, { x: 0, y: 0.5, z: 0 });
    const fixture = createPickupFixture([coin]);

    fixture.system.updateObject(
      coin,
      createPlayerBounds({ x: 0, y: 0.5, z: 0 }, { x: 1, y: 1, z: 1 })
    );
    fixture.system.updateObject(
      coin,
      createPlayerBounds({ x: 0, y: 0.5, z: 0 }, { x: 1, y: 1, z: 1 })
    );

    expect(fixture.system.getCoinCount()).toBe(5);
    expect(fixture.objectViews.get("coin_1")?.visible).toBe(false);
    expect(fixture.worldEvents).toEqual([{ type: "coinCollected", objectId: "coin_1" }]);
    expect(fixture.objectiveCoins).toEqual([5]);
  });

  it("aplica coin compartilhada sem duplicar", () => {
    const coin = createRuntimeTestObject("coin", "coin_1", { value: 2 });
    const fixture = createPickupFixture([coin], { sharedWorld: true });
    const event: WorldEvent = { type: "coinCollected", objectId: "coin_1" };

    expect(fixture.system.applyWorldEvent(event)).toBe(true);
    expect(fixture.system.applyWorldEvent(event)).toBe(false);

    expect(fixture.system.getCoinCount()).toBe(2);
    expect(fixture.objectViews.get("coin_1")?.visible).toBe(false);
    expect(fixture.worldEvents).toEqual([]);
  });

  it("coleta key e atualiza hasKey/HUD", () => {
    const key = createRuntimeTestObject("key", "key_1", {
      keyId: "blue_key",
      label: "Chave Azul",
    });
    const fixture = createPickupFixture([key]);

    fixture.system.updateObject(key, fixture.playerBounds);

    expect(fixture.system.hasKey("blue_key")).toBe(true);
    expect(fixture.hud.keys.at(-1)).toEqual(["Chave Azul"]);
    expect(fixture.logicEvents).toEqual([
      { type: "onKeyCollected", objectId: "key_1", keyId: "blue_key" },
    ]);
  });

  it("health pickup cura no modo solo", () => {
    const health = createRuntimeTestObject("itemPickup", "health_1", {
      itemId: "health_pack",
      amount: 30,
    });
    const fixture = createPickupFixture([health]);

    expect(fixture.system.interactWithObject("health_1")).toBe(true);

    expect(fixture.healedAmounts).toEqual([30]);
    expect(fixture.hud.messages.at(-1)?.text).toBe("Cura +30");
    expect(fixture.logicEvents).toEqual([{ type: "onItemCollected", itemType: "health" }]);
  });

  it("weapon pickup equipa arma e atualiza inventario", () => {
    const weapon = createRuntimeTestObject("itemPickup", "weapon_1", {
      itemId: "weapon_dagger",
      amount: 1,
    });
    const fixture = createPickupFixture([weapon]);

    expect(fixture.system.interactWithObject("weapon_1")).toBe(true);

    expect(fixture.equippedWeapons).toEqual(["weapon_dagger"]);
    expect(fixture.hud.inventories.at(-1)).toEqual([{ label: "Adaga", quantity: 1 }]);
  });

  it("itemSpawner cria pickup runtime", () => {
    const spawner = createRuntimeTestObject("itemSpawner", "spawner_1", {
      spawnOnStart: false,
      respawnTime: 0.25,
      spawnItemType: "coin",
      amount: 3,
    });
    const fixture = createPickupFixture([spawner], { playerPosition: { x: 10, y: 0.5, z: 0 } });

    fixture.system.update(0.25);

    expect(fixture.objectViews.has("itemPickup-spawner_1-0")).toBe(true);
    expect(fixture.world.children.some((child) => child.userData.runtimePickup === true)).toBe(
      true
    );
  });

  it("reset limpa pickups runtime e estado de moedas", () => {
    const spawner = createRuntimeTestObject("itemSpawner", "spawner_1", {
      spawnOnStart: false,
      respawnTime: 0.1,
      spawnItemType: "coin",
    });
    const coin = createRuntimeTestObject("coin", "coin_1", { value: 1 });
    const fixture = createPickupFixture([spawner, coin], {
      playerPosition: { x: 10, y: 0.5, z: 0 },
    });

    fixture.system.update(0.1);
    fixture.system.updateObject(
      coin,
      createPlayerBounds({ x: 0, y: 0.5, z: 0 }, { x: 1, y: 1, z: 1 })
    );
    expect(fixture.objectViews.has("itemPickup-spawner_1-0")).toBe(true);
    expect(fixture.system.getCoinCount()).toBe(1);

    fixture.system.reset();

    expect(fixture.objectViews.has("itemPickup-spawner_1-0")).toBe(false);
    expect(fixture.system.getCoinCount()).toBe(0);
  });

  it("world event de itemCollected aplica sem efeitos e sem duplicar", () => {
    const pickup = createRuntimeTestObject("itemPickup", "item_1", {
      itemId: "coin",
      amount: 10,
    });
    const fixture = createPickupFixture([pickup], { sharedWorld: true });
    const event: WorldEvent = { type: "itemCollected", objectId: "item_1" };

    expect(fixture.system.applyWorldEvent(event)).toBe(true);
    expect(fixture.system.applyWorldEvent(event)).toBe(false);

    expect(fixture.system.getCoinCount()).toBe(0);
    expect(fixture.objectViews.get("item_1")?.visible).toBe(false);
  });

  it("ignora giveCoins com zero ou valor negativo sem feedback de coleta", () => {
    const fixture = createPickupFixture([]);

    fixture.system.giveCoins(0);
    fixture.system.giveCoins(-10);

    expect(fixture.system.getCoinCount()).toBe(0);
    expect(fixture.hud.coins.at(-1)).toEqual({ count: 0, total: 0 });
    expect(fixture.audio.playedCues).toEqual([]);
    expect(fixture.objectiveCoins).toEqual([]);
  });
});

type PickupFixtureOptions = {
  sharedWorld?: boolean;
  multiplayer?: boolean;
  playerPosition?: Vector3;
};

function createPickupFixture(objects: MapObject[], options: PickupFixtureOptions = {}) {
  const map = createFreeplayTestMap(objects);
  const world = new THREE.Group();
  const objectViews = createObjectViews(map, world);
  const hud = createMockHud();
  const audio = createMockAudioSystem();
  const feedback = createMockFeedbackSystem();
  const worldEvents: WorldEvent[] = [];
  const logicEvents: unknown[] = [];
  const objectiveCoins: number[] = [];
  const gameModeCoins: Array<{ total: number; amount: number }> = [];
  const objectiveKeys: string[] = [];
  const healedAmounts: number[] = [];
  const equippedWeapons: string[] = [];
  const healRequests: unknown[] = [];
  const playerPosition = options.playerPosition ?? { x: 0, y: 0.5, z: 0 };
  const playerBounds = createPlayerBounds(playerPosition, { x: 1, y: 1, z: 1 });

  const system = new RuntimePickupSystem({
    map,
    world,
    objectViews,
    hud,
    audio,
    feedback,
    getPlayerBounds: () => playerBounds,
    isSharedWorldEnabled: () => options.sharedWorld === true,
    isMultiplayerEnabled: () => options.multiplayer === true,
    emitWorldEvent: (event) => worldEvents.push(event),
    onPlayerHealRequest: (payload) => healRequests.push(payload),
    healPlayer: (amount) => {
      healedAmounts.push(amount);
      return amount;
    },
    equipWeapon: (itemId) => equippedWeapons.push(itemId),
    onCoinCollected: (totalCoins, amount) => {
      objectiveCoins.push(totalCoins);
      gameModeCoins.push({ total: totalCoins, amount });
    },
    onKeyCollected: (keyId) => objectiveKeys.push(keyId),
    onLogicEvent: (event) => logicEvents.push(event),
  });

  return {
    map,
    world,
    objectViews,
    hud,
    audio,
    feedback,
    system,
    playerBounds,
    worldEvents,
    logicEvents,
    objectiveCoins,
    gameModeCoins,
    objectiveKeys,
    healedAmounts,
    equippedWeapons,
    healRequests,
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
