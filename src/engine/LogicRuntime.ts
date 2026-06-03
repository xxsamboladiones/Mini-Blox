import type { GameMap } from "../shared/types/MapSchema";
import type { MapObject } from "../shared/types/ObjectSchema";
import type { LogicAction, LogicCondition, LogicRule, LogicTrigger } from "../shared/types/ScriptSchema";

export type LogicRuntimeEvent =
  | {
    type: "onPlayerEnterObject";
    objectId: string;
  }
  | {
    type: "onButtonActivated";
    objectId: string;
  }
  | {
    type: "onCoinCollected";
    objectId: string;
  }
  | {
    type: "onKeyCollected";
    objectId: string;
    keyId: string;
  }
  | {
    type: "onMapStart";
  };

export type LogicRuntimeContext = {
  hasKey: (keyId: string) => boolean;
  getCoinCount: () => number;
  isDoorOpen: (doorId: string) => boolean;
  showMessage: (message: string) => void;
  openDoor: (doorId: string) => boolean;
  closeDoor: (doorId: string) => boolean;
  teleportPlayer: (targetObjectId: string) => boolean;
  giveCoins: (amount: number) => void;
  setCheckpoint: (objectId: string) => boolean;
  finishMap: () => void;
  setObjectEnabled: (objectId: string, enabled: boolean) => boolean;
  getObjectById: (objectId: string) => MapObject | null;
};

export class LogicRuntime {
  private readonly executedOnceRuleIds = new Set<string>();

  constructor(
    private readonly map: GameMap,
    private readonly context: LogicRuntimeContext
  ) {}

  start(): void {
    this.dispatch({ type: "onMapStart" });
  }

  reset(): void {
    this.executedOnceRuleIds.clear();
  }

  dispatch(event: LogicRuntimeEvent): void {
    this.debug(`Evento: ${describeEvent(event)}`);

    for (const rule of this.getRules()) {
      if (!this.matchesTrigger(rule.trigger, event)) {
        continue;
      }

      this.debug(`Regra disparada: ${rule.name}`);

      if (!rule.enabled) {
        this.debug(`Regra inativa ignorada: ${rule.name}`);
        continue;
      }

      const conditionResults = rule.conditions.map((condition) => {
        const passed = this.conditionPasses(rule, condition);
        this.debug(`Condicao ${passed ? "passou" : "falhou"}: ${describeCondition(condition)}`);
        return passed;
      });

      if (conditionResults.includes(false)) {
        continue;
      }

      for (const action of rule.actions) {
        this.debug(`Acao executada: ${describeAction(action)}`);
        this.executeAction(action);
      }

      if (rule.conditions.some((condition) => condition.type === "once")) {
        this.executedOnceRuleIds.add(rule.id);
      }
    }
  }

  private getRules(): LogicRule[] {
    return (this.map.logic ?? []).filter(isRuntimeLogicRule);
  }

  private matchesTrigger(trigger: LogicTrigger, event: LogicRuntimeEvent): boolean {
    if (trigger.type !== event.type) {
      return false;
    }

    if (
      trigger.type === "onPlayerEnterObject" ||
      trigger.type === "onButtonActivated" ||
      trigger.type === "onCoinCollected"
    ) {
      return "objectId" in event && trigger.objectId === event.objectId;
    }

    if (trigger.type === "onKeyCollected") {
      return event.type === "onKeyCollected" && trigger.keyId === event.keyId;
    }

    return event.type === "onMapStart";
  }

  private conditionsPass(rule: LogicRule): boolean {
    return rule.conditions.every((condition) => this.conditionPasses(rule, condition));
  }

  private conditionPasses(rule: LogicRule, condition: LogicCondition): boolean {
    if (condition.type === "hasKey") {
      return this.context.hasKey(condition.keyId);
    }

    if (condition.type === "coinsAtLeast") {
      return this.context.getCoinCount() >= condition.amount;
    }

    if (condition.type === "doorIsOpen") {
      return this.context.isDoorOpen(condition.doorId);
    }

    return !this.executedOnceRuleIds.has(rule.id);
  }

  private executeAction(action: LogicAction): void {
    if (action.type === "showMessage") {
      this.context.showMessage(action.message);
    } else if (action.type === "openDoor") {
      this.context.openDoor(action.doorId);
    } else if (action.type === "closeDoor") {
      this.context.closeDoor(action.doorId);
    } else if (action.type === "teleportPlayer") {
      this.context.teleportPlayer(action.targetObjectId);
    } else if (action.type === "giveCoins") {
      this.context.giveCoins(action.amount);
    } else if (action.type === "setCheckpoint") {
      this.context.setCheckpoint(action.objectId);
    } else if (action.type === "finishMap") {
      this.context.finishMap();
    } else if (action.type === "enableObject") {
      this.context.setObjectEnabled(action.objectId, true);
    } else if (action.type === "disableObject") {
      this.context.setObjectEnabled(action.objectId, false);
    }
  }

  private debug(message: string): void {
    if (this.map.logicDebug) {
      console.info(`[Mini Blox Logic] ${message}`);
    }
  }
}

function isRuntimeLogicRule(value: LogicRule): value is LogicRule {
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.enabled === "boolean" &&
    isLogicTrigger(value.trigger) &&
    Array.isArray(value.conditions) &&
    value.conditions.every(isLogicCondition) &&
    Array.isArray(value.actions) &&
    value.actions.every(isLogicAction)
  );
}

function isLogicTrigger(value: unknown): value is LogicTrigger {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  if (
    value.type === "onPlayerEnterObject" ||
    value.type === "onButtonActivated" ||
    value.type === "onCoinCollected"
  ) {
    return typeof value.objectId === "string";
  }

  if (value.type === "onKeyCollected") {
    return typeof value.keyId === "string";
  }

  return value.type === "onMapStart";
}

function isLogicCondition(value: unknown): value is LogicCondition {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  if (value.type === "hasKey") {
    return typeof value.keyId === "string";
  }

  if (value.type === "coinsAtLeast") {
    return typeof value.amount === "number" && Number.isFinite(value.amount);
  }

  if (value.type === "doorIsOpen") {
    return typeof value.doorId === "string";
  }

  return value.type === "once";
}

function isLogicAction(value: unknown): value is LogicAction {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  if (value.type === "showMessage") {
    return typeof value.message === "string";
  }

  if (value.type === "openDoor" || value.type === "closeDoor") {
    return typeof value.doorId === "string";
  }

  if (value.type === "teleportPlayer") {
    return typeof value.targetObjectId === "string";
  }

  if (value.type === "giveCoins") {
    return typeof value.amount === "number" && Number.isFinite(value.amount);
  }

  if (value.type === "setCheckpoint" || value.type === "enableObject" || value.type === "disableObject") {
    return typeof value.objectId === "string";
  }

  return value.type === "finishMap";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function describeEvent(event: LogicRuntimeEvent): string {
  if (event.type === "onKeyCollected") {
    return `${event.type} ${event.keyId}`;
  }

  if ("objectId" in event) {
    return `${event.type} ${event.objectId}`;
  }

  return event.type;
}

function describeCondition(condition: LogicCondition): string {
  if (condition.type === "hasKey") {
    return `hasKey ${condition.keyId}`;
  }

  if (condition.type === "coinsAtLeast") {
    return `coinsAtLeast ${condition.amount}`;
  }

  if (condition.type === "doorIsOpen") {
    return `doorIsOpen ${condition.doorId}`;
  }

  return "once";
}

function describeAction(action: LogicAction): string {
  if (action.type === "showMessage") {
    return `showMessage "${action.message}"`;
  }

  if (action.type === "openDoor" || action.type === "closeDoor") {
    return `${action.type} ${action.doorId}`;
  }

  if (action.type === "teleportPlayer") {
    return `teleportPlayer ${action.targetObjectId}`;
  }

  if (action.type === "giveCoins") {
    return `giveCoins ${action.amount}`;
  }

  if (action.type === "setCheckpoint" || action.type === "enableObject" || action.type === "disableObject") {
    return `${action.type} ${action.objectId}`;
  }

  return "finishMap";
}
