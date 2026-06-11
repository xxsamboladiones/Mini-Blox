import * as THREE from "three";
import {
  getItemDefinition,
  getItemLabel,
  getWeaponItemId,
  getWeaponLabel,
  isWeaponItemId,
  normalizeWeaponId,
} from "../../../shared/ItemCatalog";
import type { GameMap } from "../../../shared/types/MapSchema";
import type { PlayerHealRequestPayload, WorldEvent } from "../../../shared/types/MultiplayerSchema";
import type { MapObject, Vector3 } from "../../../shared/types/ObjectSchema";
import type { ItemPickupObject } from "../../../shared/types/ItemSchema";
import type { AudioSystem } from "../../AudioSystem";
import type { FeedbackSystem } from "../../FeedbackSystem";
import {
  createMapObject3D,
  disposeObject3D,
} from "../../ObjectFactory";
import type { RuntimeHud } from "../../RuntimeHud";
import { RuntimeInventorySystem } from "../RuntimeInventorySystem";
import type { RuntimeSystem } from "../core/RuntimeSystem";
import {
  chooseItemId,
  getCoinAmount,
  getMaxSpawnedItems,
  getPickupAmount,
  getPickupHealAmount,
  getPickupPosition,
  getRespawnTime,
  getSpawnerAmount,
  getSpawnerPickupId,
  hideCollectedPickupObject,
  isCoinObject,
  isCoinPickupObject,
  isHealthPickupObject,
  isPickupObject,
  shouldCollectPickup,
  shouldTrackSharedPickup,
} from "../../mechanics/PickupMechanics";

type CoinCollectionOptions = {
  playFeedback?: boolean;
  emitWorldEvent?: boolean;
  dispatchRuntimeEvents?: boolean;
};

type ItemCollectionOptions = {
  applyEffects?: boolean;
  emitWorldEvent?: boolean;
};

type ItemSpawnerRuntimeState = {
  spawner: MapObject;
  activePickupIds: Set<string>;
  cooldown: number;
};

export type RuntimePickupSystemOptions = {
  map: GameMap;
  world: THREE.Group;
  objectViews: Map<string, THREE.Object3D>;
  hud: RuntimeHud;
  audio: AudioSystem;
  feedback: FeedbackSystem;
  getPlayerBounds: () => THREE.Box3;
  isSharedWorldEnabled: () => boolean;
  isMultiplayerEnabled: () => boolean;
  emitWorldEvent: (event: WorldEvent) => void;
  onPlayerHealRequest?: (payload: PlayerHealRequestPayload) => void;
  healPlayer: (amount: number) => number;
  equipWeapon: (itemId: string) => void;
  onCoinCollected: (totalCoins: number, amount: number) => void;
  onKeyCollected: (keyId: string) => void;
  onLogicEvent: (event: RuntimePickupLogicEvent) => void;
};

export type RuntimePickupLogicEvent =
  | { type: "onCoinCollected"; objectId: string }
  | { type: "onKeyCollected"; objectId: string; keyId: string }
  | { type: "onItemCollected"; itemType: string };

export class RuntimePickupSystem implements RuntimeSystem {
  readonly id = "pickups";

  private readonly collectedCoinIds = new Set<string>();
  private readonly collectedItemObjectIds = new Set<string>();
  private readonly collectedKeyObjectIds = new Set<string>();
  private readonly collectedKeyIds = new Set<string>();
  private readonly keyLabels = new Map<string, string>();
  private readonly itemSpawnerStates = new Map<string, ItemSpawnerRuntimeState>();
  private readonly runtimePickups = new Map<string, ItemPickupObject>();
  private readonly inventorySystem = new RuntimeInventorySystem();
  private coinCount = 0;

  constructor(private readonly options: RuntimePickupSystemOptions) {
    this.reset();
  }

  update(deltaSeconds: number): void {
    this.updateItemSpawners(deltaSeconds);
    this.updateItemPickups(this.options.getPlayerBounds());
  }

  reset(): void {
    this.clearRuntimePickups();
    this.collectedCoinIds.clear();
    this.collectedItemObjectIds.clear();
    this.collectedKeyObjectIds.clear();
    this.collectedKeyIds.clear();
    this.keyLabels.clear();
    this.inventorySystem.clear();
    this.coinCount = 0;
    this.options.hud.setCoins(0, this.getTotalCoinObjects());
    this.updateInventoryHud();
    this.initializeItemSpawners();
  }

  dispose(): void {
    this.clearRuntimePickups();
  }

  updateObject(mapObject: MapObject, playerBounds: THREE.Box3): boolean {
    if (isCoinObject(mapObject)) {
      return this.updateCoin(mapObject, playerBounds);
    }

    if (mapObject.type === "key") {
      return this.updateKey(mapObject, playerBounds);
    }

    return false;
  }

  getInteractionHint(objectId: string): string | null {
    const target = this.getRuntimePickup(objectId) ?? this.getStaticItemPickup(objectId);

    if (!target || !this.isObjectVisible(target.id)) {
      return null;
    }

    return getItemLabel(target.properties.itemId);
  }

  interactWithObject(objectId: string): boolean {
    const pickup = this.getRuntimePickup(objectId) ?? this.getStaticItemPickup(objectId);

    if (!pickup || !this.isObjectVisible(pickup.id)) {
      return false;
    }

    this.collectItemPickup(pickup);
    return true;
  }

  applyWorldEvent(event: WorldEvent): boolean {
    if (event.type === "coinCollected") {
      const coin = this.options.map.objects.find(
        (mapObject) => mapObject.id === event.objectId && isCoinObject(mapObject)
      );

      return coin
        ? this.collectCoinObject(coin, {
            playFeedback: false,
            emitWorldEvent: false,
            dispatchRuntimeEvents: false,
          })
        : false;
    }

    if (event.type === "itemCollected") {
      return this.markItemCollected(event.objectId, {
        applyEffects: false,
        emitWorldEvent: false,
      });
    }

    return false;
  }

  getRuntimePickup(objectId: string): ItemPickupObject | null {
    return this.runtimePickups.get(objectId) ?? null;
  }

  hasKey(keyId: string): boolean {
    return this.collectedKeyIds.has(keyId);
  }

  getKeyLabel(keyId: string): string | null {
    const collectedLabel = this.keyLabels.get(keyId);

    if (collectedLabel) {
      return collectedLabel;
    }

    const keyObject = this.options.map.objects.find(
      (candidate) =>
        candidate.type === "key" && getString(candidate.properties?.keyId, candidate.id) === keyId
    );

    return keyObject ? getString(keyObject.properties?.label, keyId) : null;
  }

  getCoinCount(): number {
    return this.coinCount;
  }

  getCollectedCoinCount(): number {
    return this.collectedCoinIds.size;
  }

  getTotalCoinObjects(): number {
    return this.options.map.objects.filter(isCoinObject).length;
  }

  giveCoins(amount: number): void {
    if (!Number.isFinite(amount)) {
      return;
    }

    const coinAmount = Math.floor(amount);
    this.coinCount = Math.max(0, this.coinCount + coinAmount);
    this.options.hud.setCoins(this.coinCount, this.getTotalCoinObjects());
    this.options.audio.play("coin");
    this.options.onCoinCollected(this.coinCount, coinAmount);
  }

  setWeaponInventoryItem(itemId: string): void {
    this.inventorySystem.setSingleItem(normalizeWeaponId(itemId) ? getWeaponItemId(itemId) ?? itemId : itemId);
    this.updateInventoryHud();
  }

  updateInventoryHud(): void {
    this.options.hud.setInventory(
      this.inventorySystem.getHudItems().map((item) => ({
        label: getItemLabel(item.itemId),
        quantity: item.quantity,
      }))
    );
    this.options.hud.setKeys([...this.keyLabels.values()]);
  }

  private updateCoin(mapObject: MapObject, playerBounds: THREE.Box3): boolean {
    if (this.collectedCoinIds.has(mapObject.id) || !this.intersects(mapObject, playerBounds)) {
      return false;
    }

    return this.collectCoinObject(mapObject);
  }

  private collectCoinObject(mapObject: MapObject, options: CoinCollectionOptions = {}): boolean {
    if (this.collectedCoinIds.has(mapObject.id)) {
      return false;
    }

    this.collectedCoinIds.add(mapObject.id);
    const value = getCoinAmount(mapObject);
    this.coinCount += value;
    hideCollectedPickupObject(this.options.objectViews.get(mapObject.id));
    this.options.hud.setCoins(this.coinCount, this.getTotalCoinObjects());

    if (options.playFeedback !== false) {
      this.options.hud.showMessage("Moeda coletada");
      this.options.audio.play("coin");
      this.options.feedback.spawn("coinCollect", mapObject.position, `+${value}`);
    }

    if (options.dispatchRuntimeEvents !== false) {
      this.options.onCoinCollected(this.coinCount, value);
      this.options.onLogicEvent({ type: "onCoinCollected", objectId: mapObject.id });
    }

    if (options.emitWorldEvent !== false) {
      this.options.emitWorldEvent({ type: "coinCollected", objectId: mapObject.id });
    }

    return true;
  }

  private updateKey(mapObject: MapObject, playerBounds: THREE.Box3): boolean {
    if (
      this.collectedKeyObjectIds.has(mapObject.id) ||
      !this.intersects(mapObject, playerBounds)
    ) {
      return false;
    }

    const keyId = getString(mapObject.properties?.keyId, mapObject.id);
    const label = getString(mapObject.properties?.label, keyId);
    this.collectedKeyObjectIds.add(mapObject.id);
    this.collectedKeyIds.add(keyId);
    this.keyLabels.set(keyId, label);
    hideCollectedPickupObject(this.options.objectViews.get(mapObject.id));
    this.updateInventoryHud();
    this.options.hud.showMessage(`Chave coletada: ${label}`);
    this.options.audio.play("key");
    this.options.feedback.spawn("key", mapObject.position, label);
    this.options.onKeyCollected(keyId);
    this.options.onLogicEvent({ type: "onKeyCollected", objectId: mapObject.id, keyId });
    return true;
  }

  private updateItemSpawners(deltaSeconds: number): void {
    for (const state of this.itemSpawnerStates.values()) {
      if (state.activePickupIds.size >= getMaxSpawnedItems(state.spawner)) {
        continue;
      }

      if (!Number.isFinite(state.cooldown)) {
        continue;
      }

      state.cooldown = Math.max(0, state.cooldown - deltaSeconds);

      if (state.cooldown <= 0) {
        this.spawnItemFromSpawner(state);
      }
    }
  }

  private updateItemPickups(playerBounds: THREE.Box3): void {
    for (const pickup of [...this.runtimePickups.values()]) {
      const view = this.options.objectViews.get(pickup.id);

      if (!view || !view.visible) {
        continue;
      }

      const pickupBounds = new THREE.Box3().setFromObject(view);
      pickupBounds.expandByScalar(0.18);

      if (shouldCollectPickup(playerBounds, pickupBounds)) {
        this.collectItemPickup(pickup);
      }
    }
  }

  private initializeItemSpawners(): void {
    this.itemSpawnerStates.clear();

    for (const mapObject of this.options.map.objects) {
      if (mapObject.type !== "itemSpawner") {
        continue;
      }

      const spawnOnStart = mapObject.properties?.spawnOnStart !== false;
      const respawnTime = getRespawnTime(mapObject);
      const state: ItemSpawnerRuntimeState = {
        spawner: mapObject,
        activePickupIds: new Set(),
        cooldown: spawnOnStart ? 0 : respawnTime > 0 ? respawnTime : Number.POSITIVE_INFINITY,
      };
      this.itemSpawnerStates.set(mapObject.id, state);

      if (spawnOnStart) {
        this.spawnItemFromSpawner(state);
      }
    }
  }

  private spawnItemFromSpawner(state: ItemSpawnerRuntimeState): void {
    if (state.activePickupIds.size >= getMaxSpawnedItems(state.spawner)) {
      state.cooldown = Number.POSITIVE_INFINITY;
      return;
    }

    const itemId = chooseItemId(state.spawner);

    if (!itemId) {
      state.cooldown = Number.POSITIVE_INFINITY;
      return;
    }

    const item = getItemDefinition(itemId);
    const pickupId = getSpawnerPickupId(state.spawner, state.activePickupIds.size);

    if (this.options.isSharedWorldEnabled() && this.collectedItemObjectIds.has(pickupId)) {
      state.cooldown = Number.POSITIVE_INFINITY;
      return;
    }

    const pickup: ItemPickupObject = {
      id: pickupId,
      type: "itemPickup",
      name: item?.name ?? itemId,
      position: getPickupPosition(state.spawner, state.activePickupIds.size),
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      collider: { shape: "sphere", isTrigger: true, radius: 0.55 },
      properties: {
        color: item?.color ?? "#facc15",
        collision: false,
        itemId,
        sourceSpawnerId: state.spawner.id,
        amount: getSpawnerAmount(state.spawner, itemId),
        healAmount:
          itemId === "health_pack" || itemId === "health"
            ? getSpawnerAmount(state.spawner, itemId)
            : undefined,
        weaponId: normalizeWeaponId(itemId) ?? undefined,
      },
    };
    const view = createMapObject3D(pickup);
    view.userData.runtimePickup = true;
    this.runtimePickups.set(pickup.id, pickup);
    this.options.objectViews.set(pickup.id, view);
    state.activePickupIds.add(pickup.id);
    this.options.world.add(view);
    state.cooldown =
      state.activePickupIds.size < getMaxSpawnedItems(state.spawner)
        ? 0
        : Number.POSITIVE_INFINITY;
  }

  private collectItemPickup(pickup: ItemPickupObject): void {
    if (!this.markItemCollected(pickup.id)) {
      return;
    }

    const itemId = pickup.properties.itemId;
    const amount = getPickupAmount(pickup);
    let label = getItemLabel(itemId);
    let feedbackLabel = label;

    if (isHealthPickupObject(pickup)) {
      this.dispatchItemCollected("health");
      if (this.options.isMultiplayerEnabled()) {
        const requestAmount = Math.min(50, getPickupHealAmount(pickup));
        this.options.onPlayerHealRequest?.({
          amount: requestAmount,
          source: "healthPickup",
          sourceObjectId: pickup.id,
        });
        label = `Cura +${Math.round(requestAmount)}`;
        feedbackLabel = `+${Math.round(requestAmount)} vida`;
        this.options.hud.showMessage(label);
        this.options.audio.play("item");
        this.options.feedback.spawn("item", pickup.position, feedbackLabel);
        return;
      }

      const healed = this.options.healPlayer(amount);
      label = `Cura +${Math.round(healed)}`;
      feedbackLabel = `+${Math.round(healed)} vida`;
      this.options.hud.showMessage(healed > 0 ? label : "Vida ja esta cheia");
      this.options.audio.play("item");
      this.options.feedback.spawn("item", pickup.position, feedbackLabel);
      return;
    }

    if (isCoinPickupObject(pickup)) {
      const coinAmount = Math.max(1, Math.floor(amount));
      this.giveCoins(coinAmount);
      this.dispatchItemCollected("coin");
      this.options.hud.showMessage(`Moeda +${coinAmount}`);
      this.options.feedback.spawn("coinCollect", pickup.position, `+${coinAmount}`);
      return;
    }

    if (isWeaponItemId(itemId)) {
      this.options.equipWeapon(itemId);
      this.inventorySystem.setSingleItem(getWeaponItemId(itemId) ?? itemId);
      this.dispatchItemCollected(getWeaponItemId(itemId) ?? itemId);
      label = getWeaponLabel(itemId);
      feedbackLabel = "Arma";
    } else {
      this.dispatchItemCollected(itemId);
      this.inventorySystem.upsertItem(itemId);
    }

    this.updateInventoryHud();
    this.options.hud.showMessage(`${label} coletado`);
    this.options.audio.play("item");
    this.options.feedback.spawn("item", pickup.position, feedbackLabel);
  }

  private markItemCollected(objectId: string, options: ItemCollectionOptions = {}): boolean {
    const pickup = this.runtimePickups.get(objectId) ?? this.getStaticItemPickup(objectId);
    const trackSharedItem = shouldTrackSharedPickup(
      this.options.isSharedWorldEnabled(),
      options.applyEffects
    );

    if (!pickup || (trackSharedItem && this.collectedItemObjectIds.has(objectId))) {
      return false;
    }

    if (trackSharedItem) {
      this.collectedItemObjectIds.add(objectId);
    }
    this.removeRuntimePickup(objectId);

    if (!this.runtimePickups.has(objectId)) {
      hideCollectedPickupObject(this.options.objectViews.get(objectId));
    }

    const sourceSpawnerId = pickup.properties.sourceSpawnerId;

    if (sourceSpawnerId) {
      const state = this.itemSpawnerStates.get(sourceSpawnerId);

      if (state) {
        state.activePickupIds.delete(objectId);
        state.cooldown =
          options.applyEffects === false
            ? Number.POSITIVE_INFINITY
            : getRespawnTime(state.spawner) > 0
              ? getRespawnTime(state.spawner)
              : Number.POSITIVE_INFINITY;
      }
    }

    if (options.emitWorldEvent !== false) {
      this.options.emitWorldEvent({ type: "itemCollected", objectId });
    }

    return true;
  }

  private dispatchItemCollected(itemType: string): void {
    this.options.onLogicEvent({ type: "onItemCollected", itemType });
  }

  private clearRuntimePickups(): void {
    for (const pickupId of [...this.runtimePickups.keys()]) {
      this.removeRuntimePickup(pickupId);
    }

    this.runtimePickups.clear();
  }

  private removeRuntimePickup(pickupId: string): void {
    const view = this.options.objectViews.get(pickupId);

    if (view?.userData.runtimePickup) {
      this.options.world.remove(view);
      disposeObject3D(view);
      this.options.objectViews.delete(pickupId);
    }

    this.runtimePickups.delete(pickupId);
  }

  private getStaticItemPickup(objectId: string): ItemPickupObject | null {
    const mapObject = this.options.map.objects.find(
      (candidate) => candidate.id === objectId && isPickupObject(candidate)
    );

    return mapObject ? (mapObject as ItemPickupObject) : null;
  }

  private intersects(mapObject: MapObject, playerBounds: THREE.Box3): boolean {
    const view = this.options.objectViews.get(mapObject.id);

    if (!view || !view.visible) {
      return false;
    }

    const objectBounds = new THREE.Box3().setFromObject(view);
    objectBounds.expandByScalar(0.18);
    return objectBounds.intersectsBox(playerBounds);
  }

  private isObjectVisible(objectId: string): boolean {
    return this.options.objectViews.get(objectId)?.visible !== false;
  }
}

function getString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}
