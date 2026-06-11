import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { TycoonSystem } from "./TycoonSystem";
import { createMockAudioSystem } from "../testing/createMockAudioSystem";
import { createMockFeedbackSystem } from "../testing/createMockFeedbackSystem";
import { createMockHud } from "../testing/createMockHud";
import { createMockPhysicsSystem } from "../testing/createMockPhysicsSystem";
import {
  createRuntimeTestMap,
  createRuntimeTestObject,
} from "../testing/createRuntimeTestMap";
import { simulateRuntimeTicks } from "../testing/simulateRuntimeTicks";
import type { GameMap } from "../../shared/types/MapSchema";
import type { MapObject, MapObjectProperties } from "../../shared/types/ObjectSchema";

describe("TycoonSystem", () => {
  it("usa o cash inicial configurado", () => {
    const fixture = createTycoonFixture([
      tycoonObject("tycoonOwnerClaim", "claim", {
        autoClaimInSolo: true,
      }),
    ], { startingCash: 25 });

    expect(fixture.system.getCash()).toBe(25);
    expect(fixture.hud.getLatestTycoonStatus()?.cash).toBe(25);
  });

  it("gera dinheiro direto no saldo quando o gerador nao tem coletor", () => {
    const fixture = createTycoonFixture([
      tycoonObject("tycoonGenerator", "generator", {
        generatorId: "gen_1",
        incomePerTick: 10,
        tickInterval: 1,
      }),
    ]);

    simulateRuntimeTicks(fixture.system, { ticks: 1, deltaSeconds: 1 });

    expect(fixture.system.getCash()).toBe(10);
    expect(fixture.feedback.spawns).toContainEqual(
      expect.objectContaining({ cue: "coinCollect", label: "+$10" })
    );
  });

  it("acumula dinheiro no coletor e coleta por interacao", () => {
    const fixture = createTycoonFixture([
      tycoonObject("tycoonCollector", "collector", {
        collectorId: "collector_1",
        autoCollect: false,
      }),
      tycoonObject("tycoonGenerator", "generator", {
        generatorId: "gen_1",
        incomePerTick: 15,
        tickInterval: 1,
        targetCollectorId: "collector_1",
      }),
    ]);

    simulateRuntimeTicks(fixture.system, { ticks: 1, deltaSeconds: 1 });
    expect(fixture.system.getSummary().pendingCash).toBe(15);

    expect(fixture.system.interactWithObject("collector")).toBe(true);

    expect(fixture.system.getCash()).toBe(15);
    expect(fixture.system.getSummary().pendingCash).toBe(0);
    expect(fixture.hud.messages.at(-1)?.text).toContain("Coletado");
  });

  it("compra botao quando ha dinheiro suficiente", () => {
    const fixture = createTycoonFixture([
      tycoonObject("tycoonBuyButton", "button", {
        purchaseId: "buy_wall",
        cost: 25,
      }),
    ], { startingCash: 50 });

    expect(fixture.system.interactWithObject("button")).toBe(true);

    expect(fixture.system.getCash()).toBe(25);
    expect(fixture.system.isPurchaseCompleted("buy_wall")).toBe(true);
    expect(fixture.audio.playedCues).toContain("button");
  });

  it("bloqueia compra sem dinheiro", () => {
    const fixture = createTycoonFixture([
      tycoonObject("tycoonBuyButton", "button", {
        purchaseId: "buy_wall",
        cost: 25,
      }),
    ]);

    expect(fixture.system.interactWithObject("button")).toBe(false);

    expect(fixture.system.getCash()).toBe(0);
    expect(fixture.system.isPurchaseCompleted("buy_wall")).toBe(false);
    expect(fixture.hud.messages.at(-1)?.text).toContain("Dinheiro insuficiente");
  });

  it("bloqueia compra quando requiredPurchaseIds nao foram completados", () => {
    const fixture = createTycoonFixture([
      tycoonObject("tycoonBuyButton", "button", {
        purchaseId: "buy_wall",
        cost: 0,
        requiredPurchaseIds: ["buy_generator"],
      }),
    ]);

    expect(fixture.system.interactWithObject("button")).toBe(false);

    expect(fixture.system.isPurchaseCompleted("buy_wall")).toBe(false);
    expect(fixture.hud.messages.at(-1)?.text).toContain("Requer buy_generator");
  });

  it("desbloqueia objetos listados em unlockObjectIds", () => {
    const fixture = createTycoonFixture([
      tycoonObject("tycoonUnlockable", "wall", {
        startsLocked: true,
      }),
      tycoonObject("tycoonBuyButton", "button", {
        purchaseId: "buy_wall",
        cost: 0,
        unlockObjectIds: ["wall"],
      }),
    ]);

    expect(fixture.views.get("wall")?.visible).toBe(false);

    expect(fixture.system.interactWithObject("button")).toBe(true);

    expect(fixture.views.get("wall")?.visible).toBe(true);
  });

  it("desbloqueia grupos por unlockGroupId", () => {
    const fixture = createTycoonFixture([
      tycoonObject("tycoonUnlockable", "wall_a", {
        groupId: "factory_walls",
        startsLocked: true,
      }),
      tycoonObject("tycoonUnlockable", "wall_b", {
        groupId: "factory_walls",
        startsLocked: true,
      }),
      tycoonObject("tycoonBuyButton", "button", {
        purchaseId: "buy_walls",
        cost: 0,
        unlockGroupId: "factory_walls",
      }),
    ]);

    expect(fixture.views.get("wall_a")?.visible).toBe(false);
    expect(fixture.views.get("wall_b")?.visible).toBe(false);

    expect(fixture.system.interactWithObject("button")).toBe(true);

    expect(fixture.views.get("wall_a")?.visible).toBe(true);
    expect(fixture.views.get("wall_b")?.visible).toBe(true);
  });

  it("aplica upgrade de income ao gerador alvo", () => {
    const fixture = createTycoonFixture([
      tycoonObject("tycoonGenerator", "generator", {
        generatorId: "gen_1",
        incomePerTick: 10,
        tickInterval: 1,
      }),
      tycoonObject("tycoonUpgrade", "upgrade", {
        upgradeId: "upgrade_income",
        cost: 0,
        targetGeneratorIds: ["gen_1"],
        incomeMultiplier: 2,
        maxLevel: 1,
      }),
    ]);

    simulateRuntimeTicks(fixture.system, { ticks: 1, deltaSeconds: 1 });
    expect(fixture.system.getCash()).toBe(10);

    expect(fixture.system.interactWithObject("upgrade")).toBe(true);

    simulateRuntimeTicks(fixture.system, { ticks: 1, deltaSeconds: 1 });
    expect(fixture.system.getCash()).toBe(30);
    expect(fixture.system.getUpgradeLevel("upgrade_income")).toBe(1);
  });

  it("respeita maxLevel do upgrade", () => {
    const fixture = createTycoonFixture([
      tycoonObject("tycoonUpgrade", "upgrade", {
        upgradeId: "upgrade_income",
        cost: 0,
        maxLevel: 1,
        hideAfterPurchase: false,
      }),
    ]);

    expect(fixture.system.interactWithObject("upgrade")).toBe(true);
    expect(fixture.system.interactWithObject("upgrade")).toBe(false);

    expect(fixture.system.getUpgradeLevel("upgrade_income")).toBe(1);
    expect(fixture.hud.messages.at(-1)?.text).toContain("nivel maximo");
  });

  it("dispara completeTycoon quando todos winPurchaseIds foram comprados", () => {
    const onCompleted = vi.fn();
    const fixture = createTycoonFixture([
      tycoonObject("tycoonBuyButton", "button_a", {
        purchaseId: "buy_a",
        cost: 0,
      }),
      tycoonObject("tycoonBuyButton", "button_b", {
        purchaseId: "buy_b",
        cost: 0,
      }),
    ], { winPurchaseIds: ["buy_a", "buy_b"], onCompleted });

    expect(fixture.system.interactWithObject("button_a")).toBe(true);
    expect(onCompleted).not.toHaveBeenCalled();

    expect(fixture.system.interactWithObject("button_b")).toBe(true);

    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect(fixture.system.getSummary().completed).toBe(true);
  });

  it("reset limpa cash, compras, upgrades, pending cash e objetos bloqueados", () => {
    const fixture = createTycoonFixture([
      tycoonObject("tycoonCollector", "collector", {
        collectorId: "collector_1",
        autoCollect: false,
      }),
      tycoonObject("tycoonGenerator", "generator", {
        generatorId: "gen_1",
        incomePerTick: 10,
        tickInterval: 1,
        targetCollectorId: "collector_1",
      }),
      tycoonObject("tycoonUnlockable", "wall", {
        startsLocked: true,
      }),
      tycoonObject("tycoonBuyButton", "button", {
        purchaseId: "buy_wall",
        cost: 10,
        unlockObjectIds: ["wall"],
      }),
      tycoonObject("tycoonUpgrade", "upgrade", {
        upgradeId: "upgrade_income",
        cost: 0,
        targetGeneratorIds: ["gen_1"],
        incomeMultiplier: 2,
      }),
    ], { startingCash: 50 });

    simulateRuntimeTicks(fixture.system, { ticks: 1, deltaSeconds: 1 });
    expect(fixture.system.interactWithObject("button")).toBe(true);
    expect(fixture.system.interactWithObject("upgrade")).toBe(true);
    expect(fixture.views.get("wall")?.visible).toBe(true);

    fixture.system.reset();

    expect(fixture.system.getCash()).toBe(50);
    expect(fixture.system.getSummary().pendingCash).toBe(0);
    expect(fixture.system.isPurchaseCompleted("buy_wall")).toBe(false);
    expect(fixture.system.getUpgradeLevel("upgrade_income")).toBe(0);
    expect(fixture.views.get("wall")?.visible).toBe(false);
    expect(fixture.hud.getLatestTycoonStatus()?.cash).toBe(50);
  });
});

type FixtureOptions = {
  startingCash?: number;
  winPurchaseIds?: string[];
  onCompleted?: () => void;
};

function createTycoonFixture(objects: MapObject[], options: FixtureOptions = {}) {
  const map = createRuntimeTestMap({
    objects,
    startingCash: options.startingCash,
    winPurchaseIds: options.winPurchaseIds,
  });
  const views = createObjectViews(map);
  const physics = createMockPhysicsSystem();
  const hud = createMockHud();
  const audio = createMockAudioSystem();
  const feedback = createMockFeedbackSystem();
  const system = new TycoonSystem(map, views, physics, hud, audio, feedback, {
    isMultiplayer: () => false,
    onCompleted: options.onCompleted,
  });

  return {
    map,
    views,
    physics,
    hud,
    audio,
    feedback,
    system,
  };
}

function tycoonObject(
  type: MapObject["type"],
  id: string,
  properties: MapObjectProperties,
  position = { x: 0, y: 0.5, z: 0 }
): MapObject {
  return createRuntimeTestObject(type, id, { tycoonId: "tycoon_test", ...properties }, position);
}

function createObjectViews(map: GameMap): Map<string, THREE.Object3D> {
  const views = new Map<string, THREE.Object3D>();

  for (const object of map.objects) {
    const view = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial()
    );
    view.position.set(object.position.x, object.position.y, object.position.z);
    view.rotation.set(object.rotation?.x ?? 0, object.rotation?.y ?? 0, object.rotation?.z ?? 0);
    view.scale.set(object.scale?.x ?? 1, object.scale?.y ?? 1, object.scale?.z ?? 1);
    view.userData.mapObjectId = object.id;
    view.updateMatrixWorld(true);
    views.set(object.id, view);
  }

  return views;
}
