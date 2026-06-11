import * as THREE from "three";
import { applyObjectAppearanceToThree } from "../ObjectFactory";
import type { AudioSystem } from "../AudioSystem";
import type { FeedbackSystem } from "../FeedbackSystem";
import type { PhysicsSystem } from "../PhysicsSystem";
import type { RuntimeHud, TycoonHudStatus } from "../RuntimeHud";
import type { LogicRuntimeEvent } from "../LogicRuntime";
import type { GameMap } from "../../shared/types/MapSchema";
import type { WorldEvent } from "../../shared/types/MultiplayerSchema";
import type { MapObject, Vector3 } from "../../shared/types/ObjectSchema";

export type TycoonProgressSummary = {
  cash: number;
  pendingCash: number;
  purchasedCount: number;
  totalPurchases: number;
  claimedTycoonId: string | null;
  completed: boolean;
};

export type TycoonSystemOptions = {
  isMultiplayer?: () => boolean;
  emitWorldEvent?: (event: WorldEvent) => void;
  onLogicEvent?: (event: LogicRuntimeEvent) => void;
  onPurchaseCompleted?: (purchaseId: string) => void;
  onCashCollected?: (totalCash: number, amount: number) => void;
  onCompleted?: () => void;
  onProgressChanged?: (summary: TycoonProgressSummary) => void;
};

type PurchaseOptions = {
  bypassCost?: boolean;
  emitWorldEvent?: boolean;
  showFeedback?: boolean;
  sourceObjectId?: string;
};

type GeneratorRuntimeState = {
  object: MapObject;
  generatorId: string;
  cooldown: number;
  forcedEnabled: boolean | null;
};

const DEFAULT_TYCOON_ID = "tycoon_1";

export class TycoonSystem {
  private readonly claimObjects: MapObject[];
  private readonly generators = new Map<string, GeneratorRuntimeState>();
  private readonly collectors = new Map<string, MapObject>();
  private readonly buyButtons = new Map<string, MapObject>();
  private readonly upgrades = new Map<string, MapObject>();
  private readonly barriers = new Map<string, MapObject>();
  private readonly pendingCashByCollectorId = new Map<string, number>();
  private readonly collectorCooldowns = new Map<string, number>();
  private readonly purchasedIds = new Set<string>();
  private readonly unlockedGroupIds = new Set<string>();
  private readonly unlockedObjectIds = new Set<string>();
  private readonly upgradeLevels = new Map<string, number>();
  private readonly gatedPurchaseSurfaceIds = new Set<string>();
  private readonly pendingLocalUpgradeEchoIds = new Set<string>();
  private playerCash = 0;
  private claimedTycoonId: string | null = null;
  private completed = false;
  private insufficientMessageCooldown = 0;

  constructor(
    private readonly map: GameMap,
    private readonly objectViews: Map<string, THREE.Object3D>,
    private readonly physicsSystem: PhysicsSystem,
    private readonly hud: RuntimeHud,
    private readonly audio: AudioSystem,
    private readonly feedback: FeedbackSystem,
    private readonly options: TycoonSystemOptions = {}
  ) {
    this.claimObjects = this.map.objects.filter((object) => object.type === "tycoonOwnerClaim");
    this.indexObjects();
    this.reset();
  }

  reset(): void {
    this.playerCash = Math.max(0, Math.floor(getNumber(this.map.gameModeSettings?.tycoonSettings?.startingCash, 0)));
    this.pendingCashByCollectorId.clear();
    this.collectorCooldowns.clear();
    this.purchasedIds.clear();
    this.unlockedGroupIds.clear();
    this.unlockedObjectIds.clear();
    this.upgradeLevels.clear();
    this.pendingLocalUpgradeEchoIds.clear();
    this.completed = false;
    this.insufficientMessageCooldown = 0;
    this.claimedTycoonId = null;

    for (const [collectorId] of this.collectors) {
      this.pendingCashByCollectorId.set(collectorId, 0);
      this.collectorCooldowns.set(collectorId, 0);
    }

    for (const state of this.generators.values()) {
      state.cooldown = getGeneratorInterval(state.object);
      state.forcedEnabled = null;
    }

    if (this.shouldAutoClaimInSolo()) {
      const claim = this.claimObjects[0];
      if (claim) {
        this.claimTycoon(getTycoonId(claim), false);
      }
    }

    this.applyAllRuntimeVisuals();
    this.publishProgress();
  }

  dispose(): void {
    this.hud.setTycoonStatus(null);
  }

  update(deltaSeconds: number, playerBounds: THREE.Box3, playerPosition: Vector3): void {
    if (!this.hasTycoonObjects()) {
      return;
    }

    this.insufficientMessageCooldown = Math.max(0, this.insufficientMessageCooldown - deltaSeconds);
    this.updateOwnerClaims(playerBounds, playerPosition);
    this.updateGenerators(deltaSeconds);
    this.updateCollectors(deltaSeconds, playerBounds, playerPosition);
    this.publishProgress();
  }

  getInteractionHint(objectId: string): string | null {
    const object = this.map.objects.find((mapObject) => mapObject.id === objectId);

    if (!object || !this.isObjectInteractable(object)) {
      return null;
    }

    if (object.type === "tycoonOwnerClaim") {
      const tycoonId = getTycoonId(object);
      return this.claimedTycoonId === tycoonId ? "Base reivindicada" : "Reivindicar base";
    }

    if (object.type === "tycoonCollector") {
      const pending = this.getPendingCash(getString(object.properties?.collectorId, object.id));
      return pending > 0 ? `Coletar $${pending}` : "Coletor vazio";
    }

    if (object.type === "tycoonBuyButton") {
      const purchaseId = getString(object.properties?.purchaseId, object.id);
      return this.getPurchaseHint(object, purchaseId);
    }

    if (object.type === "tycoonUpgrade") {
      const upgradeId = getString(object.properties?.upgradeId, object.id);
      return this.getPurchaseHint(object, upgradeId);
    }

    return null;
  }

  interactWithObject(objectId: string): boolean {
    const object = this.map.objects.find((mapObject) => mapObject.id === objectId);

    if (!object || !this.isObjectInteractable(object)) {
      return false;
    }

    if (object.type === "tycoonOwnerClaim") {
      return this.claimTycoon(getTycoonId(object), true);
    }

    if (object.type === "tycoonCollector") {
      return this.collectCash(getString(object.properties?.collectorId, object.id), true);
    }

    if (object.type === "tycoonBuyButton") {
      return this.purchaseBuyButton(object, { emitWorldEvent: true, showFeedback: true });
    }

    if (object.type === "tycoonUpgrade") {
      return this.purchaseUpgrade(object, { emitWorldEvent: true, showFeedback: true });
    }

    return false;
  }

  applySharedPurchase(purchaseId: string): boolean {
    return this.completePurchaseById(purchaseId, {
      bypassCost: true,
      emitWorldEvent: false,
      showFeedback: false,
    });
  }

  applySharedUpgrade(upgradeId: string): boolean {
    if (this.purchasedIds.has(upgradeId)) {
      return false;
    }

    const upgrade = this.upgrades.get(upgradeId);
    if (!upgrade) {
      return false;
    }

    return this.purchaseUpgrade(upgrade, {
      bypassCost: true,
      emitWorldEvent: false,
      showFeedback: false,
    });
  }

  applyWorldEvent(event: WorldEvent): boolean {
    if (event.type === "tycoonPurchase") {
      return this.completePurchaseById(event.purchaseId, {
        bypassCost: true,
        emitWorldEvent: false,
        showFeedback: false,
        sourceObjectId: event.objectId,
      });
    }

    if (event.type === "tycoonUpgrade") {
      if (this.pendingLocalUpgradeEchoIds.delete(event.upgradeId)) {
        return false;
      }

      const upgrade = this.upgrades.get(event.upgradeId);
      return upgrade
        ? this.purchaseUpgrade(upgrade, {
            bypassCost: true,
            emitWorldEvent: false,
            showFeedback: false,
            sourceObjectId: event.objectId,
          })
        : false;
    }

    return false;
  }

  getCash(): number {
    return this.playerCash;
  }

  addCash(amount: number): void {
    const safeAmount = Math.max(0, Math.floor(amount));
    if (safeAmount <= 0) {
      return;
    }

    this.playerCash += safeAmount;
    this.publishProgress();
  }

  removeCash(amount: number): void {
    const safeAmount = Math.max(0, Math.floor(amount));
    if (safeAmount <= 0) {
      return;
    }

    this.playerCash = Math.max(0, this.playerCash - safeAmount);
    this.publishProgress();
  }

  completePurchaseById(purchaseId: string, options: PurchaseOptions = {}): boolean {
    const id = purchaseId.trim();
    if (!id) {
      return false;
    }

    const button = this.buyButtons.get(id);
    if (button) {
      return this.purchaseBuyButton(button, {
        ...options,
        bypassCost: options.bypassCost ?? true,
      });
    }

    const upgrade = this.upgrades.get(id);
    if (upgrade) {
      return this.purchaseUpgrade(upgrade, {
        ...options,
        bypassCost: options.bypassCost ?? true,
      });
    }

    return this.markPurchaseCompleted(id, options.sourceObjectId ?? id, options);
  }

  setGeneratorEnabled(generatorId: string, enabled: boolean): boolean {
    const state = this.generators.get(generatorId);
    if (!state) {
      return false;
    }

    state.forcedEnabled = enabled;
    this.applyGeneratorVisual(state.object);
    this.publishProgress();
    return true;
  }

  unlockGroup(groupId: string): boolean {
    const id = groupId.trim();
    if (!id) {
      return false;
    }

    this.unlockedGroupIds.add(id);
    this.applyAllRuntimeVisuals();
    this.publishProgress();
    return true;
  }

  isPurchaseCompleted(purchaseId: string): boolean {
    return this.purchasedIds.has(purchaseId);
  }

  getPurchasedCount(): number {
    const winIds = this.getWinPurchaseIds();
    return winIds.filter((purchaseId) => this.purchasedIds.has(purchaseId)).length;
  }

  getTotalPurchases(): number {
    return this.getWinPurchaseIds().length;
  }

  getUpgradeLevel(upgradeId: string): number {
    return this.upgradeLevels.get(upgradeId) ?? 0;
  }

  getClaimedTycoonId(): string | null {
    return this.claimedTycoonId;
  }

  getSummary(): TycoonProgressSummary {
    const totalPurchases = this.getTotalPurchases();
    const purchasedCount = this.getPurchasedCount();

    return {
      cash: this.playerCash,
      pendingCash: this.getTotalPendingCash(),
      purchasedCount,
      totalPurchases,
      claimedTycoonId: this.claimedTycoonId,
      completed: totalPurchases > 0 && purchasedCount >= totalPurchases,
    };
  }

  private indexObjects(): void {
    this.generators.clear();
    this.collectors.clear();
    this.buyButtons.clear();
    this.upgrades.clear();
    this.barriers.clear();
    this.gatedPurchaseSurfaceIds.clear();

    for (const object of this.map.objects) {
      if (object.type === "tycoonGenerator") {
        const generatorId = getString(object.properties?.generatorId, object.id);
        this.generators.set(generatorId, {
          object,
          generatorId,
          cooldown: getGeneratorInterval(object),
          forcedEnabled: null,
        });
      } else if (object.type === "tycoonCollector") {
        this.collectors.set(getString(object.properties?.collectorId, object.id), object);
      } else if (object.type === "tycoonBuyButton") {
        this.buyButtons.set(getString(object.properties?.purchaseId, object.id), object);
      } else if (object.type === "tycoonUpgrade") {
        this.upgrades.set(getString(object.properties?.upgradeId, object.id), object);
      } else if (object.type === "tycoonBarrier") {
        this.barriers.set(getString(object.properties?.purchaseId, object.id), object);
      }
    }

    for (const object of this.map.objects) {
      for (const buttonId of getStringArray(object.properties?.unlockButtonIds)) {
        this.gatedPurchaseSurfaceIds.add(buttonId);
        const linkedButton = this.buyButtons.get(buttonId) ?? this.upgrades.get(buttonId);
        if (linkedButton) {
          this.gatedPurchaseSurfaceIds.add(linkedButton.id);
        }
      }
    }
  }

  private hasTycoonObjects(): boolean {
    return (
      this.claimObjects.length > 0 ||
      this.generators.size > 0 ||
      this.collectors.size > 0 ||
      this.buyButtons.size > 0 ||
      this.upgrades.size > 0 ||
      this.barriers.size > 0
    );
  }

  private shouldAutoClaimInSolo(): boolean {
    if (this.options.isMultiplayer?.()) {
      return false;
    }

    const settings = this.map.gameModeSettings?.tycoonSettings;
    if (settings?.autoClaimInSolo === false) {
      return false;
    }

    return this.claimObjects.length === 1 && getBoolean(this.claimObjects[0]?.properties?.autoClaimInSolo, true);
  }

  private updateOwnerClaims(playerBounds: THREE.Box3, playerPosition: Vector3): void {
    if (this.claimedTycoonId) {
      return;
    }

    for (const claim of this.claimObjects) {
      if (this.isPlayerInsideObject(claim, playerBounds, playerPosition, 2.2)) {
        this.claimTycoon(getTycoonId(claim), true);
        return;
      }
    }
  }

  private claimTycoon(tycoonId: string, showFeedback: boolean): boolean {
    if (!tycoonId || this.claimedTycoonId === tycoonId) {
      return false;
    }

    if (this.claimedTycoonId && !this.map.gameModeSettings?.tycoonSettings?.allowStealing) {
      this.hud.showMessage("Esta base ja foi reivindicada.", 1800);
      return false;
    }

    this.claimedTycoonId = tycoonId;
    if (showFeedback) {
      this.audio.play("checkpoint");
      this.hud.showMessage(`Base reivindicada: ${tycoonId}`, 2200);
    }
    this.options.onLogicEvent?.({ type: "onTycoonClaimed", tycoonId });
    this.publishProgress();
    return true;
  }

  private updateGenerators(deltaSeconds: number): void {
    const rateScale = Math.max(0.1, getNumber(this.map.gameModeSettings?.tycoonSettings?.generatorTickRateScale, 1));

    for (const state of this.generators.values()) {
      if (!this.isGeneratorActive(state)) {
        continue;
      }

      const interval = this.getEffectiveGeneratorInterval(state.object);
      state.cooldown -= deltaSeconds * rateScale;

      while (state.cooldown <= 0) {
        state.cooldown += interval;
        this.addGeneratedCash(state.object);
      }
    }
  }

  private addGeneratedCash(generator: MapObject): void {
    const income = Math.max(0, Math.floor(getNumber(generator.properties?.incomePerTick, 5) * this.getGeneratorIncomeMultiplier(generator)));
    if (income <= 0) {
      return;
    }

    const collectorId = getString(generator.properties?.targetCollectorId, "");
    if (!collectorId || !this.collectors.has(collectorId)) {
      this.playerCash += income;
      this.feedback.spawn("coinCollect", generator.position, `+$${income}`);
      return;
    }

    const current = this.getPendingCash(collectorId);
    const capacity = this.getCollectorCapacity(collectorId);
    this.pendingCashByCollectorId.set(collectorId, Math.min(capacity, current + income));
  }

  private updateCollectors(
    deltaSeconds: number,
    playerBounds: THREE.Box3,
    playerPosition: Vector3
  ): void {
    for (const [collectorId, collector] of this.collectors) {
      const cooldown = Math.max(0, (this.collectorCooldowns.get(collectorId) ?? 0) - deltaSeconds);
      this.collectorCooldowns.set(collectorId, cooldown);

      if (collector.properties?.autoCollect === false || cooldown > 0) {
        continue;
      }

      const radius = Math.max(0.5, getNumber(collector.properties?.collectRadius, 2));
      if (this.isPlayerInsideObject(collector, playerBounds, playerPosition, radius)) {
        this.collectCash(collectorId, true);
      }
    }
  }

  private collectCash(collectorId: string, showFeedback: boolean): boolean {
    const pending = this.getPendingCash(collectorId);
    if (pending <= 0) {
      if (showFeedback) {
        this.hud.showMessage("Coletor vazio.", 1200);
      }
      return false;
    }

    this.pendingCashByCollectorId.set(collectorId, 0);
    const collector = this.collectors.get(collectorId);
    const cooldown = Math.max(0, getNumber(collector?.properties?.collectCooldown, 0.5));
    this.collectorCooldowns.set(collectorId, cooldown);
    this.playerCash += pending;
    this.audio.play("coin");
    this.feedback.spawn("coinCollect", collector?.position, `+$${pending}`);
    if (showFeedback) {
      this.hud.showMessage(`Coletado: $${pending}`, 1500);
    }
    this.options.onCashCollected?.(this.playerCash, pending);
    this.options.onLogicEvent?.({
      type: "onTycoonCashCollected",
      tycoonId: collector ? getTycoonId(collector) : this.claimedTycoonId ?? undefined,
      amount: pending,
    });
    this.publishProgress();
    return true;
  }

  private purchaseBuyButton(object: MapObject, options: PurchaseOptions): boolean {
    const purchaseId = getString(object.properties?.purchaseId, object.id);
    return this.purchase(object, purchaseId, getNumber(object.properties?.cost, 0), options);
  }

  private purchaseUpgrade(object: MapObject, options: PurchaseOptions): boolean {
    const upgradeId = getString(object.properties?.upgradeId, object.id);
    const currentLevel = this.upgradeLevels.get(upgradeId) ?? 0;
    const maxLevel = Math.max(1, Math.floor(getNumber(object.properties?.maxLevel, 1)));

    if (currentLevel >= maxLevel && !options.bypassCost) {
      this.hud.showMessage("Upgrade no nivel maximo.", 1500);
      return false;
    }

    const purchased = this.purchase(object, upgradeId, getNumber(object.properties?.cost, 0), {
      ...options,
      bypassCost: options.bypassCost ?? false,
    });

    if (!purchased) {
      return false;
    }

    const nextLevel = Math.min(maxLevel, currentLevel + 1);
    this.upgradeLevels.set(upgradeId, nextLevel);
    this.applyAllRuntimeVisuals();
    this.publishProgress();
    this.options.onLogicEvent?.({
      type: "onTycoonUpgradePurchased",
      upgradeId,
      tycoonId: getTycoonId(object),
    });

    if (options.emitWorldEvent !== false) {
      this.pendingLocalUpgradeEchoIds.add(upgradeId);
      this.options.emitWorldEvent?.({
        type: "tycoonUpgrade",
        objectId: object.id,
        upgradeId,
        tycoonId: getTycoonId(object),
      });
    }

    return true;
  }

  private purchase(
    object: MapObject,
    purchaseId: string,
    cost: number,
    options: PurchaseOptions
  ): boolean {
    if (!purchaseId) {
      return false;
    }

    if (
      object.type !== "tycoonUpgrade" &&
      this.purchasedIds.has(purchaseId) &&
      object.properties?.oneTime !== false
    ) {
      return false;
    }

    if (!this.arePrerequisitesMet(object)) {
      const missingPrerequisite = this.getMissingPrerequisite(object);
      this.hud.showMessage(
        missingPrerequisite ? `Requer ${missingPrerequisite}.` : "Compra bloqueada por pre-requisito.",
        1600
      );
      return false;
    }

    const safeCost = Math.max(0, Math.floor(cost));
    if (!options.bypassCost && this.playerCash < safeCost) {
      if (this.insufficientMessageCooldown <= 0) {
        this.insufficientMessageCooldown = 1.2;
        this.audio.play("message");
        this.hud.showMessage(
          getString(
            object.properties?.insufficientFundsMessage,
            `Dinheiro insuficiente: precisa de $${safeCost}.`
          ),
          1700
        );
      }
      return false;
    }

    if (!options.bypassCost) {
      this.playerCash -= safeCost;
    }

    return this.markPurchaseCompleted(purchaseId, object.id, options);
  }

  private markPurchaseCompleted(
    purchaseId: string,
    sourceObjectId: string,
    options: PurchaseOptions
  ): boolean {
    const wasPurchased = this.purchasedIds.has(purchaseId);
    this.purchasedIds.add(purchaseId);

    const sourceObject =
      this.buyButtons.get(purchaseId) ??
      this.upgrades.get(purchaseId) ??
      this.barriers.get(purchaseId) ??
      this.map.objects.find((object) => object.id === sourceObjectId);

    if (sourceObject?.properties?.unlockGroupId) {
      this.unlockedGroupIds.add(String(sourceObject.properties.unlockGroupId));
    }

    for (const objectId of getStringArray(sourceObject?.properties?.unlockObjectIds)) {
      this.unlockedObjectIds.add(objectId);
    }

    for (const buttonId of getStringArray(sourceObject?.properties?.unlockButtonIds)) {
      this.unlockedObjectIds.add(buttonId);
      const linkedButton = this.buyButtons.get(buttonId) ?? this.upgrades.get(buttonId);
      if (linkedButton) {
        this.unlockedObjectIds.add(linkedButton.id);
      }
    }

    this.applyAllRuntimeVisuals();

    if (!wasPurchased) {
      this.options.onPurchaseCompleted?.(purchaseId);
      this.options.onLogicEvent?.({
        type: "onTycoonPurchaseCompleted",
        purchaseId,
        tycoonId: sourceObject ? getTycoonId(sourceObject) : this.claimedTycoonId ?? undefined,
      });
    }

    if (options.emitWorldEvent !== false && sourceObject?.type !== "tycoonUpgrade") {
      this.options.emitWorldEvent?.({
        type: "tycoonPurchase",
        objectId: sourceObjectId,
        purchaseId,
        tycoonId: sourceObject ? getTycoonId(sourceObject) : undefined,
      });
    }

    if (options.showFeedback !== false && !wasPurchased) {
      this.audio.play("button");
      this.feedback.spawn("button", sourceObject?.position, "Comprado");
      this.hud.showMessage(getString(sourceObject?.properties?.purchasedMessage, "Comprado!"), 1800);
    }

    this.publishProgress();
    this.checkCompleted();
    return sourceObject?.type === "tycoonUpgrade" || !wasPurchased || options.bypassCost === true;
  }

  private checkCompleted(): void {
    if (this.completed) {
      return;
    }

    const summary = this.getSummary();
    if (!summary.completed) {
      return;
    }

    this.completed = true;
    this.audio.play("victory");
    this.feedback.spawn("victory", undefined, "Tycoon completo");
    this.hud.showMessage("Tycoon completo!", 2400);
    this.options.onLogicEvent?.({
      type: "onTycoonCompleted",
      tycoonId: this.claimedTycoonId ?? undefined,
    });
    this.options.onCompleted?.();
    this.publishProgress();
  }

  private applyAllRuntimeVisuals(): void {
    for (const object of this.map.objects) {
      if (object.type === "tycoonUnlockable") {
        this.applyUnlockableVisual(object);
      } else if (object.type === "tycoonBarrier") {
        this.applyBarrierVisual(object);
      } else if (object.type === "tycoonBuyButton") {
        this.applyPurchaseObjectVisual(object, getString(object.properties?.purchaseId, object.id));
      } else if (object.type === "tycoonUpgrade") {
        this.applyPurchaseObjectVisual(object, getString(object.properties?.upgradeId, object.id));
      } else if (object.type === "tycoonGenerator") {
        this.applyGeneratorVisual(object);
      }
    }
  }

  private applyUnlockableVisual(object: MapObject): void {
    const unlocked = this.isUnlockableUnlocked(object);
    const lockedCollision = getBoolean(object.properties?.lockedCollision, false);
    this.setObjectRuntimeState(object, unlocked || lockedCollision, unlocked || lockedCollision);
  }

  private applyBarrierVisual(object: MapObject): void {
    const purchaseId = getString(object.properties?.purchaseId, object.id);
    const unlocked = this.purchasedIds.has(purchaseId);
    const lockedCollision = getBoolean(object.properties?.lockedCollision, true);
    const view = this.objectViews.get(object.id);

    if (view) {
      applyObjectAppearanceToThree(view, {
        ...object,
        properties: {
          ...object.properties,
          color: unlocked
            ? getString(object.properties?.unlockedColor, "#22c55e")
            : getString(object.properties?.lockedColor, "#ef4444"),
          opacity: unlocked ? 0.24 : getNumber(object.properties?.opacity, 0.58),
          material: "glass",
        },
      });
    }

    this.setObjectRuntimeState(object, true, unlocked ? false : lockedCollision);
  }

  private applyPurchaseObjectVisual(object: MapObject, purchaseId: string): void {
    const purchased = this.purchasedIds.has(purchaseId);
    const maxedUpgrade =
      object.type === "tycoonUpgrade" &&
      (this.upgradeLevels.get(purchaseId) ?? 0) >= Math.max(1, Math.floor(getNumber(object.properties?.maxLevel, 1)));
    const hiddenAfterPurchase = object.properties?.hideAfterPurchase !== false;
    const gated =
      this.gatedPurchaseSurfaceIds.has(object.id) ||
      this.gatedPurchaseSurfaceIds.has(purchaseId);
    const available =
      !gated ||
      this.unlockedObjectIds.has(object.id) ||
      this.unlockedObjectIds.has(purchaseId);
    const visible = available && !((purchased || maxedUpgrade) && hiddenAfterPurchase);
    this.setObjectRuntimeState(object, visible, false);
  }

  private applyGeneratorVisual(object: MapObject): void {
    const state = this.generators.get(getString(object.properties?.generatorId, object.id));
    const visible = state ? this.isGeneratorVisible(state) : true;
    this.setObjectRuntimeState(object, visible, visible && object.properties?.collision !== false);
  }

  private setObjectRuntimeState(object: MapObject, visible: boolean, solid: boolean): void {
    const view = this.objectViews.get(object.id);
    if (!view) {
      return;
    }

    view.visible = visible;

    if (visible && solid) {
      this.physicsSystem.updateColliderForObject(object, view, true);
    } else {
      this.physicsSystem.removeCollider(object.id);
    }
  }

  private isUnlockableUnlocked(object: MapObject): boolean {
    if (object.properties?.startsLocked === false) {
      return true;
    }

    const purchaseId = getString(object.properties?.purchaseId, "");
    const groupId = getString(object.properties?.groupId, "");
    return (
      this.unlockedObjectIds.has(object.id) ||
      (purchaseId.length > 0 && this.purchasedIds.has(purchaseId)) ||
      (groupId.length > 0 && this.unlockedGroupIds.has(groupId))
    );
  }

  private isGeneratorActive(state: GeneratorRuntimeState): boolean {
    if (state.forcedEnabled !== null) {
      return state.forcedEnabled;
    }

    if (state.object.properties?.startsEnabled === false) {
      return false;
    }

    if (state.object.properties?.requiresPurchase) {
      const purchaseId = getString(state.object.properties.purchaseId, "");
      return purchaseId.length > 0 && this.purchasedIds.has(purchaseId);
    }

    return true;
  }

  private isGeneratorVisible(state: GeneratorRuntimeState): boolean {
    if (!state.object.properties?.requiresPurchase) {
      return true;
    }

    const purchaseId = getString(state.object.properties.purchaseId, "");
    return purchaseId.length === 0 || this.purchasedIds.has(purchaseId);
  }

  private arePrerequisitesMet(object: MapObject): boolean {
    return this.getMissingPrerequisite(object) === null;
  }

  private getMissingPrerequisite(object: MapObject): string | null {
    return (
      getStringArray(object.properties?.requiredPurchaseIds).find(
        (purchaseId) => !this.purchasedIds.has(purchaseId)
      ) ?? null
    );
  }

  private isObjectInteractable(object: MapObject): boolean {
    const view = this.objectViews.get(object.id);
    return view?.visible !== false;
  }

  private isPlayerInsideObject(
    object: MapObject,
    playerBounds: THREE.Box3,
    playerPosition: Vector3,
    radius: number
  ): boolean {
    const view = this.objectViews.get(object.id);
    if (view && view.visible !== false) {
      const bounds = new THREE.Box3().setFromObject(view).expandByScalar(0.1);
      if (!bounds.isEmpty() && bounds.intersectsBox(playerBounds)) {
        return true;
      }
    }

    return distance2D(playerPosition, object.position) <= radius;
  }

  private getPurchaseHint(object: MapObject, purchaseId: string): string | null {
    if (this.purchasedIds.has(purchaseId) && object.properties?.oneTime !== false) {
      return "Ja comprado";
    }

    const missingPrerequisite = this.getMissingPrerequisite(object);
    if (missingPrerequisite) {
      return `Requer ${missingPrerequisite}`;
    }

    const cost = Math.max(0, Math.floor(getNumber(object.properties?.cost, 0)));
    if (this.playerCash < cost) {
      return `Dinheiro insuficiente: precisa de $${cost}`;
    }

    return object.type === "tycoonUpgrade" ? `Comprar upgrade: $${cost}` : `Comprar: $${cost}`;
  }

  private getEffectiveGeneratorInterval(generator: MapObject): number {
    return Math.max(0.1, getGeneratorInterval(generator) * this.getGeneratorIntervalMultiplier(generator));
  }

  private getGeneratorIncomeMultiplier(generator: MapObject): number {
    let multiplier = 1;
    const generatorId = getString(generator.properties?.generatorId, generator.id);
    const groupId = getString(generator.properties?.upgradeGroupId, "");

    for (const [upgradeId, level] of this.upgradeLevels) {
      const upgrade = this.upgrades.get(upgradeId);
      if (!upgrade || level <= 0) {
        continue;
      }

      const targets = getStringArray(upgrade.properties?.targetGeneratorIds);
      if (targets.length > 0 && !targets.includes(generatorId) && !targets.includes(groupId)) {
        continue;
      }

      multiplier *= Math.pow(Math.max(0, getNumber(upgrade.properties?.incomeMultiplier, 1)), level);
    }

    return multiplier;
  }

  private getGeneratorIntervalMultiplier(generator: MapObject): number {
    let multiplier = 1;
    const generatorId = getString(generator.properties?.generatorId, generator.id);
    const groupId = getString(generator.properties?.upgradeGroupId, "");

    for (const [upgradeId, level] of this.upgradeLevels) {
      const upgrade = this.upgrades.get(upgradeId);
      if (!upgrade || level <= 0) {
        continue;
      }

      const targets = getStringArray(upgrade.properties?.targetGeneratorIds);
      if (targets.length > 0 && !targets.includes(generatorId) && !targets.includes(groupId)) {
        continue;
      }

      multiplier *= Math.pow(Math.max(0.05, getNumber(upgrade.properties?.intervalMultiplier, 1)), level);
    }

    return multiplier;
  }

  private getCollectorCapacity(collectorId: string): number {
    const collector = this.collectors.get(collectorId);
    let capacity = Math.max(0, getNumber(collector?.properties?.capacity, 1000));

    for (const [upgradeId, level] of this.upgradeLevels) {
      const upgrade = this.upgrades.get(upgradeId);
      if (!upgrade || level <= 0) {
        continue;
      }

      capacity += Math.max(0, getNumber(upgrade.properties?.collectorCapacityBonus, 0)) * level;
    }

    return capacity;
  }

  private getPendingCash(collectorId: string): number {
    return Math.max(0, Math.floor(this.pendingCashByCollectorId.get(collectorId) ?? 0));
  }

  private getTotalPendingCash(): number {
    let total = 0;
    for (const value of this.pendingCashByCollectorId.values()) {
      total += Math.max(0, Math.floor(value));
    }
    return total;
  }

  private getWinPurchaseIds(): string[] {
    const configured = this.map.gameModeSettings?.tycoonSettings?.winPurchaseIds ?? [];
    const ids =
      configured.length > 0
        ? configured
        : [
            ...this.buyButtons.keys(),
            ...this.upgrades.keys(),
            ...[...this.barriers.keys()].filter((purchaseId) => this.buyButtons.has(purchaseId)),
          ];

    return [...new Set(ids.filter((id) => id.trim().length > 0))];
  }

  private publishProgress(): void {
    if (!this.hasTycoonObjects()) {
      this.hud.setTycoonStatus(null);
      return;
    }

    const summary = this.getSummary();
    const status: TycoonHudStatus = {
      cash: summary.cash,
      pendingCash: summary.pendingCash,
      purchasedCount: summary.purchasedCount,
      totalPurchases: summary.totalPurchases,
      claimedTycoonId: summary.claimedTycoonId,
    };
    this.hud.setTycoonStatus(status);
    this.options.onProgressChanged?.(summary);
  }
}

function getTycoonId(object: MapObject): string {
  return getString(object.properties?.tycoonId, DEFAULT_TYCOON_ID);
}

function getGeneratorInterval(object: MapObject): number {
  return Math.max(0.1, getNumber(object.properties?.tickInterval, 2));
}

function getString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function getNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function distance2D(a: Vector3, b: Vector3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
