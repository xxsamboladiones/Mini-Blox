import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createMapObject3D } from "../../ObjectFactory";
import { createMockAudioSystem } from "../../testing/createMockAudioSystem";
import { createMockFeedbackSystem } from "../../testing/createMockFeedbackSystem";
import { createMockHud } from "../../testing/createMockHud";
import {
  createDoorButtonTestMap,
  createFreeplayTestMap,
  createRuntimeTestObject,
} from "../../testing/createRuntimeTestMap";
import { createPlayerBounds } from "../../testing/simulateRuntimeTicks";
import { createMockPhysicsSystem } from "../../testing/createMockPhysicsSystem";
import { RuntimeDoorButtonSystem } from "./RuntimeDoorButtonSystem";
import type { GameMap } from "../../../shared/types/MapSchema";
import type { WorldEvent } from "../../../shared/types/MultiplayerSchema";
import type { MapObject } from "../../../shared/types/ObjectSchema";

describe("RuntimeDoorButtonSystem", () => {
  it("botao abre porta vinculada", () => {
    const fixture = createDoorFixture(createDoorButtonTestMap().objects);
    const button = fixture.map.objects.find((object) => object.id === "button_1")!;

    expect(fixture.system.updateObject(button, fixture.playerBounds)).toBe(true);

    expect(fixture.system.isDoorOpenById("door_a")).toBe(true);
    expect(fixture.physics.hasCollider("door_1")).toBe(false);
    expect(fixture.worldEvents.map((event) => event.type)).toEqual([
      "doorOpened",
      "buttonActivated",
    ]);
  });

  it("botao oneTime nao reativa", () => {
    const fixture = createDoorFixture(createDoorButtonTestMap().objects);
    const button = fixture.map.objects.find((object) => object.id === "button_1")!;

    expect(fixture.system.activateButton(button)).toBe(true);
    expect(fixture.system.activateButton(button)).toBe(false);

    expect(fixture.objectiveButtons).toEqual(["button_1"]);
  });

  it("porta com requiredKeyId bloqueia sem chave", () => {
    const door = createRuntimeTestObject("door", "door_1", {
      doorId: "door_a",
      requiredKeyId: "blue_key",
    });
    const fixture = createDoorFixture([door]);

    expect(fixture.system.interactWithObject("door_1")).toBe(false);

    expect(fixture.system.isDoorOpenById("door_a")).toBe(false);
    expect(fixture.missingKeyMessages).toEqual(["Chave Azul"]);
  });

  it("porta com requiredKeyId abre com chave", () => {
    const door = createRuntimeTestObject("door", "door_1", {
      doorId: "door_a",
      requiredKeyId: "blue_key",
    });
    const fixture = createDoorFixture([door], { keys: ["blue_key"] });

    expect(fixture.system.interactWithObject("door_1")).toBe(true);

    expect(fixture.system.isDoorOpenById("door_a")).toBe(true);
    expect(fixture.objectiveDoors).toEqual(["door_a"]);
  });

  it("openDoorById e closeDoorById funcionam para logica visual", () => {
    const fixture = createDoorFixture(createDoorButtonTestMap().objects);

    expect(fixture.system.openDoorById("door_a")).toBe(true);
    expect(fixture.system.closeDoorById("door_a")).toBe(true);

    expect(fixture.system.isDoorOpenById("door_a")).toBe(false);
    expect(fixture.physics.hasCollider("door_1")).toBe(true);
  });

  it("world events de door/button aplicam sem duplicar", () => {
    const fixture = createDoorFixture(createDoorButtonTestMap().objects);
    const openEvent: WorldEvent = { type: "doorOpened", doorId: "door_a" };
    const buttonEvent: WorldEvent = { type: "buttonActivated", objectId: "button_1" };

    expect(fixture.system.applyWorldEvent(openEvent)).toBe(true);
    expect(fixture.system.applyWorldEvent(openEvent)).toBe(false);
    expect(fixture.system.applyWorldEvent(buttonEvent)).toBe(true);
    expect(fixture.system.applyWorldEvent(buttonEvent)).toBe(false);

    expect(fixture.worldEvents).toEqual([]);
    expect(fixture.objectiveDoors).toEqual([]);
    expect(fixture.objectiveButtons).toEqual([]);
  });

  it("reset restaura portas e botoes", () => {
    const fixture = createDoorFixture(createDoorButtonTestMap().objects);
    const doorView = fixture.objectViews.get("door_1")!;
    const initialY = doorView.position.y;

    fixture.system.openDoorById("door_a");
    fixture.system.activateButton(fixture.map.objects.find((object) => object.id === "button_1")!);
    fixture.system.reset();

    expect(fixture.system.isDoorOpenById("door_a")).toBe(false);
    expect(doorView.position.y).toBe(initialY);
    expect(fixture.physics.hasCollider("door_1")).toBe(true);
    expect(fixture.system.getInteractionHint("button_1")).toBe("Botao");
  });
});

type DoorFixtureOptions = {
  keys?: string[];
};

function createDoorFixture(objects: MapObject[], options: DoorFixtureOptions = {}) {
  const map = createFreeplayTestMap(objects);
  const world = new THREE.Group();
  const objectViews = createObjectViews(map, world);
  const physics = createMockPhysicsSystem();
  const hud = createMockHud();
  const audio = createMockAudioSystem();
  const feedback = createMockFeedbackSystem();
  const worldEvents: WorldEvent[] = [];
  const objectiveButtons: string[] = [];
  const objectiveDoors: string[] = [];
  const logicEvents: unknown[] = [];
  const missingKeyMessages: Array<string | null> = [];
  const keySet = new Set(options.keys ?? []);
  const playerBounds = createPlayerBounds({ x: 0, y: 0.5, z: 0 }, { x: 1, y: 1, z: 1 });

  for (const mapObject of map.objects) {
    const view = objectViews.get(mapObject.id)!;
    physics.updateColliderForObject(mapObject, view, mapObject.properties?.collision !== false);
  }

  const system = new RuntimeDoorButtonSystem({
    map,
    objectViews,
    physicsSystem: physics,
    hud,
    audio,
    feedback,
    hasKey: (keyId) => keySet.has(keyId),
    getKeyLabel: (keyId) => (keyId === "blue_key" ? "Chave Azul" : null),
    showMissingKeyMessage: (label) => missingKeyMessages.push(label),
    emitWorldEvent: (event) => worldEvents.push(event),
    onDoorOpened: (doorId) => objectiveDoors.push(doorId),
    onButtonActivated: (objectId) => objectiveButtons.push(objectId),
    onLogicEvent: (event) => logicEvents.push(event),
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
    worldEvents,
    objectiveButtons,
    objectiveDoors,
    logicEvents,
    missingKeyMessages,
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
