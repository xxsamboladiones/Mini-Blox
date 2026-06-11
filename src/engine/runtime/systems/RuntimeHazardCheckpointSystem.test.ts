import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createMapObject3D } from "../../ObjectFactory";
import { createMockAudioSystem } from "../../testing/createMockAudioSystem";
import { createMockFeedbackSystem } from "../../testing/createMockFeedbackSystem";
import { createMockHud } from "../../testing/createMockHud";
import { createFreeplayTestMap, createRuntimeTestObject } from "../../testing/createRuntimeTestMap";
import { createPlayerBounds } from "../../testing/simulateRuntimeTicks";
import { RuntimeSystemManager } from "../core/RuntimeSystemManager";
import { RuntimeHazardCheckpointSystem } from "./RuntimeHazardCheckpointSystem";
import type { GameMap } from "../../../shared/types/MapSchema";
import type { MapObject, Vector3 } from "../../../shared/types/ObjectSchema";

describe("RuntimeHazardCheckpointSystem", () => {
  it("checkpoint ativa respawn point", () => {
    const checkpoint = createRuntimeTestObject(
      "checkpoint",
      "checkpoint",
      { activatedColor: "#22c55e" },
      { x: 0, y: 0.5, z: 0 }
    );
    const fixture = createHazardFixture([checkpoint]);

    fixture.system.updateObject(checkpoint, fixture.playerBounds);

    expect(fixture.respawnPoint).toEqual(checkpoint.position);
    expect(fixture.hud.messages.at(-1)?.text).toBe("Checkpoint ativado");
    expect(fixture.audio.playedCues).toEqual(["checkpoint"]);
    expect(fixture.feedback.spawns).toHaveLength(1);
  });

  it("checkpoint nao duplica feedback quando ja ativado", () => {
    const checkpoint = createRuntimeTestObject("checkpoint", "checkpoint", {}, { x: 0, y: 0.5, z: 0 });
    const fixture = createHazardFixture([checkpoint]);

    fixture.system.updateObject(checkpoint, fixture.playerBounds);
    fixture.system.updateObject(checkpoint, fixture.playerBounds);

    expect(fixture.respawnChanges).toHaveLength(1);
    expect(fixture.hud.messages).toHaveLength(1);
    expect(fixture.audio.playedCues).toHaveLength(1);
    expect(fixture.feedback.spawns).toHaveLength(1);
  });

  it("checkpoint reset permite ativar novamente", () => {
    const checkpoint = createRuntimeTestObject("checkpoint", "checkpoint", {}, { x: 0, y: 0.5, z: 0 });
    const fixture = createHazardFixture([checkpoint]);

    fixture.system.updateObject(checkpoint, fixture.playerBounds);
    fixture.system.reset();
    fixture.system.updateObject(checkpoint, fixture.playerBounds);

    expect(fixture.respawnChanges).toHaveLength(2);
    expect(fixture.audio.playedCues).toEqual(["checkpoint", "checkpoint"]);
  });

  it("damageZone aplica dano", () => {
    const damageZone = createRuntimeTestObject(
      "damage",
      "damage",
      { mode: "damage", damage: 15 },
      { x: 0, y: 0.5, z: 0 }
    );
    const fixture = createHazardFixture([damageZone]);

    fixture.system.updateObject(damageZone, fixture.playerBounds);

    expect(fixture.health).toBe(85);
    expect(fixture.damageEvents).toEqual([{ amount: 15, message: "Cuidado! Voce sofreu dano" }]);
    expect(fixture.deathCooldown).toBeCloseTo(0.7);
  });

  it("damageZone respeita cooldown", () => {
    const damageZone = createRuntimeTestObject(
      "damage",
      "damage",
      { mode: "damage", damage: 20 },
      { x: 0, y: 0.5, z: 0 }
    );
    const fixture = createHazardFixture([damageZone]);

    fixture.system.updateObject(damageZone, fixture.playerBounds);
    fixture.system.updateObject(damageZone, fixture.playerBounds);

    expect(fixture.health).toBe(80);
    expect(fixture.damageEvents).toHaveLength(1);
  });

  it("damageZone fatal chama fluxo de morte", () => {
    const damageZone = createRuntimeTestObject(
      "damage",
      "damage",
      { mode: "damage", damage: 200 },
      { x: 0, y: 0.5, z: 0 }
    );
    const fixture = createHazardFixture([damageZone]);

    fixture.system.updateObject(damageZone, fixture.playerBounds);

    expect(fixture.health).toBe(0);
    expect(fixture.deaths).toEqual([{ message: "Voce morreu", position: damageZone.position }]);
  });

  it("messageZone mostra mensagem ao entrar", () => {
    const messageZone = createRuntimeTestObject(
      "messageZone",
      "message",
      { message: "Bem vindo!" },
      { x: 0, y: 0.5, z: 0 }
    );
    const fixture = createHazardFixture([messageZone]);

    fixture.system.updateObject(messageZone, fixture.playerBounds);

    expect(fixture.hud.messages).toEqual([{ text: "Bem vindo!", durationMs: 2600 }]);
    expect(fixture.audio.playedCues).toEqual(["message"]);
  });

  it("messageZone oneTime nao repete apos sair e entrar", () => {
    const messageZone = createRuntimeTestObject(
      "messageZone",
      "message",
      { message: "Uma vez" },
      { x: 0, y: 0.5, z: 0 }
    );
    const fixture = createHazardFixture([messageZone]);

    fixture.system.updateObject(messageZone, fixture.playerBounds);
    fixture.system.updateObject(messageZone, fixture.outsideBounds);
    fixture.system.updateObject(messageZone, fixture.playerBounds);

    expect(fixture.hud.messages.map((message) => message.text)).toEqual(["Uma vez"]);
  });

  it("messageZone nao oneTime pode repetir apos sair e entrar", () => {
    const messageZone = createRuntimeTestObject(
      "messageZone",
      "message",
      { message: "Repete", oneTime: false },
      { x: 0, y: 0.5, z: 0 }
    );
    const fixture = createHazardFixture([messageZone]);

    fixture.system.updateObject(messageZone, fixture.playerBounds);
    fixture.system.updateObject(messageZone, fixture.outsideBounds);
    fixture.system.updateObject(messageZone, fixture.playerBounds);

    expect(fixture.hud.messages.map((message) => message.text)).toEqual(["Repete", "Repete"]);
  });

  it("messageZone nao faz spam enquanto player permanece dentro", () => {
    const messageZone = createRuntimeTestObject(
      "messageZone",
      "message",
      { message: "Sem spam", oneTime: false },
      { x: 0, y: 0.5, z: 0 }
    );
    const fixture = createHazardFixture([messageZone]);

    fixture.system.updateObject(messageZone, fixture.playerBounds);
    fixture.system.updateObject(messageZone, fixture.playerBounds);
    fixture.system.updateObject(messageZone, fixture.playerBounds);

    expect(fixture.hud.messages.map((message) => message.text)).toEqual(["Sem spam"]);
  });

  it("reset limpa message zones", () => {
    const messageZone = createRuntimeTestObject(
      "messageZone",
      "message",
      { message: "Depois reset" },
      { x: 0, y: 0.5, z: 0 }
    );
    const fixture = createHazardFixture([messageZone]);

    fixture.system.updateObject(messageZone, fixture.playerBounds);
    fixture.system.reset();
    fixture.system.updateObject(messageZone, fixture.playerBounds);

    expect(fixture.hud.messages.map((message) => message.text)).toEqual([
      "Depois reset",
      "Depois reset",
    ]);
  });

  it("sistema nao afeta mapas sem checkpoint damage ou messageZone", () => {
    const cube = createRuntimeTestObject("cube", "cube", {}, { x: 0, y: 0.5, z: 0 });
    const fixture = createHazardFixture([cube]);

    fixture.system.updateObject(cube, fixture.playerBounds);

    expect(fixture.respawnChanges).toEqual([]);
    expect(fixture.damageEvents).toEqual([]);
    expect(fixture.hud.messages).toEqual([]);
  });

  it("RuntimeSystemManager registra e reseta o sistema corretamente", () => {
    const messageZone = createRuntimeTestObject(
      "messageZone",
      "message",
      { message: "Manager reset" },
      { x: 0, y: 0.5, z: 0 }
    );
    const fixture = createHazardFixture([messageZone]);
    const manager = new RuntimeSystemManager();

    manager.register(fixture.system);
    fixture.system.updateObject(messageZone, fixture.playerBounds);
    manager.reset();
    fixture.system.updateObject(messageZone, fixture.playerBounds);

    expect(manager.getSystem("hazard-checkpoints")).toBe(fixture.system);
    expect(fixture.hud.messages.map((message) => message.text)).toEqual([
      "Manager reset",
      "Manager reset",
    ]);
  });
});

function createHazardFixture(objects: MapObject[]) {
  const map = createFreeplayTestMap(objects);
  const world = new THREE.Group();
  const objectViews = createObjectViews(map, world);
  const hud = createMockHud();
  const audio = createMockAudioSystem();
  const feedback = createMockFeedbackSystem();
  const playerBounds = createPlayerBounds({ x: 0, y: 0.5, z: 0 }, { x: 1, y: 1, z: 1 });
  const outsideBounds = createPlayerBounds({ x: 50, y: 0.5, z: 50 }, { x: 1, y: 1, z: 1 });
  const respawnChanges: Vector3[] = [];
  const damageEvents: Array<{ amount: number; message: string }> = [];
  const deaths: Array<{ message: string; position: Vector3 }> = [];
  let respawnPoint: Vector3 | null = null;
  let health = 100;
  let deathCooldown = 0;

  const system = new RuntimeHazardCheckpointSystem({
    map,
    objectViews,
    hud,
    audio,
    feedback,
    getPlayerBounds: () => playerBounds,
    getDeathCooldown: () => deathCooldown,
    setDamageCooldown: (cooldown) => {
      deathCooldown = cooldown;
    },
    isPlayerDead: () => health <= 0,
    setRespawnPoint: (position) => {
      respawnPoint = { ...position };
      respawnChanges.push(respawnPoint);
    },
    damagePlayer: (amount, message, position) => {
      health = Math.max(0, health - amount);
      damageEvents.push({ amount, message });

      if (health <= 0) {
        deaths.push({ message: "Voce morreu", position: { ...position } });
      }
    },
    killPlayer: (message, position) => {
      health = 0;
      deaths.push({ message, position: { ...position } });
    },
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
    outsideBounds,
    respawnChanges,
    damageEvents,
    deaths,
    get respawnPoint() {
      return respawnPoint;
    },
    get health() {
      return health;
    },
    get deathCooldown() {
      return deathCooldown;
    },
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
