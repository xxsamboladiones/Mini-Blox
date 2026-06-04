import type { GameMap } from "../shared/types/MapSchema";
import type { MapObject } from "../shared/types/ObjectSchema";
import type {
  LogicAction,
  LogicCondition,
  LogicRule,
  LogicTrigger,
} from "../shared/types/ScriptSchema";

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
      type: "onEnemyDefeated";
      objectId: string;
    }
  | {
      type: "onAnyEnemyDefeated";
      objectId: string;
    }
  | {
      type: "onAllEnemiesDefeated";
    }
  | {
      type: "onPlayerDamaged";
      amount: number;
    }
  | {
      type: "onItemCollected";
      itemType: string;
    }
  | {
      type: "onNpcInteracted";
      objectId: string;
    }
  | {
      type: "onObjectiveCompleted";
      objectiveId: string;
    }
  | {
      type: "onScoreReached";
      amount: number;
    }
  | {
      type: "onTeamScoreReached";
      teamId: string;
      amount: number;
    }
  | {
      type: "onCapturePointCaptured";
      pointId: string;
      teamId?: string;
    }
  | {
      type: "onGameModeWon";
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
  isEnemyDefeated: (objectId: string) => boolean;
  getDefeatedEnemyCount: () => number;
  hasWeapon: (weaponId: string) => boolean;
  getHealth: () => number;
  spawnEnemy: (objectId: string) => boolean;
  healPlayer: (amount: number) => void;
  damagePlayer: (amount: number) => void;
  giveWeapon: (weaponId: string) => void;
  completeObjective: (objectiveId: string) => boolean;
  showDialogue: (objectId: string, message: string) => void;
  addScore: (amount: number) => void;
  addTeamScore: (teamId: string, amount: number) => void;
  setTeam: (teamId: string) => boolean;
  endRound: (result: "win" | "lose" | "draw") => void;
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
      trigger.type === "onCoinCollected" ||
      trigger.type === "onEnemyDefeated" ||
      trigger.type === "onNpcInteracted"
    ) {
      return "objectId" in event && trigger.objectId === event.objectId;
    }

    if (trigger.type === "onKeyCollected") {
      return event.type === "onKeyCollected" && trigger.keyId === event.keyId;
    }

    if (trigger.type === "onItemCollected") {
      return event.type === "onItemCollected" && trigger.itemType === event.itemType;
    }

    if (trigger.type === "onObjectiveCompleted") {
      return event.type === "onObjectiveCompleted" && trigger.objectiveId === event.objectiveId;
    }

    if (trigger.type === "onScoreReached") {
      return event.type === "onScoreReached" && event.amount >= trigger.amount;
    }

    if (trigger.type === "onTeamScoreReached") {
      return (
        event.type === "onTeamScoreReached" &&
        event.teamId === trigger.teamId &&
        event.amount >= trigger.amount
      );
    }

    if (trigger.type === "onCapturePointCaptured") {
      return (
        event.type === "onCapturePointCaptured" &&
        event.pointId === trigger.pointId &&
        (!trigger.teamId || trigger.teamId === event.teamId)
      );
    }

    if (trigger.type === "onGameModeWon") {
      return event.type === "onGameModeWon";
    }

    if (trigger.type === "onAnyEnemyDefeated") {
      return event.type === "onAnyEnemyDefeated";
    }

    if (trigger.type === "onAllEnemiesDefeated") {
      return event.type === "onAllEnemiesDefeated";
    }

    if (trigger.type === "onPlayerDamaged") {
      return event.type === "onPlayerDamaged";
    }

    return event.type === "onMapStart";
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

    if (condition.type === "enemyDefeated") {
      return this.context.isEnemyDefeated(condition.objectId);
    }

    if (condition.type === "enemiesDefeatedAtLeast") {
      return this.context.getDefeatedEnemyCount() >= condition.amount;
    }

    if (condition.type === "hasWeapon") {
      return this.context.hasWeapon(condition.weaponId);
    }

    if (condition.type === "healthBelow") {
      return this.context.getHealth() < condition.amount;
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
    } else if (action.type === "spawnEnemy") {
      this.context.spawnEnemy(action.objectId);
    } else if (action.type === "healPlayer") {
      this.context.healPlayer(action.amount);
    } else if (action.type === "damagePlayer") {
      this.context.damagePlayer(action.amount);
    } else if (action.type === "giveWeapon") {
      this.context.giveWeapon(action.weaponId);
    } else if (action.type === "completeObjective") {
      this.context.completeObjective(action.objectiveId);
    } else if (action.type === "showDialogue") {
      this.context.showDialogue(action.objectId, action.message);
    } else if (action.type === "addScore") {
      this.context.addScore(action.amount);
    } else if (action.type === "addTeamScore") {
      this.context.addTeamScore(action.teamId, action.amount);
    } else if (action.type === "setTeam") {
      this.context.setTeam(action.teamId);
    } else if (action.type === "endRound") {
      this.context.endRound(action.result);
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
    value.type === "onCoinCollected" ||
    value.type === "onEnemyDefeated" ||
    value.type === "onNpcInteracted"
  ) {
    return typeof value.objectId === "string";
  }

  if (value.type === "onObjectiveCompleted") {
    return typeof value.objectiveId === "string";
  }

  if (value.type === "onScoreReached") {
    return typeof value.amount === "number" && Number.isFinite(value.amount);
  }

  if (value.type === "onTeamScoreReached") {
    return (
      typeof value.teamId === "string" &&
      typeof value.amount === "number" &&
      Number.isFinite(value.amount)
    );
  }

  if (value.type === "onCapturePointCaptured") {
    return (
      typeof value.pointId === "string" &&
      (value.teamId === undefined || typeof value.teamId === "string")
    );
  }

  if (value.type === "onKeyCollected") {
    return typeof value.keyId === "string";
  }

  if (value.type === "onItemCollected") {
    return typeof value.itemType === "string";
  }

  return (
    value.type === "onMapStart" ||
    value.type === "onAnyEnemyDefeated" ||
    value.type === "onAllEnemiesDefeated" ||
    value.type === "onPlayerDamaged" ||
    value.type === "onGameModeWon"
  );
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

  if (value.type === "enemyDefeated") {
    return typeof value.objectId === "string";
  }

  if (value.type === "enemiesDefeatedAtLeast" || value.type === "healthBelow") {
    return typeof value.amount === "number" && Number.isFinite(value.amount);
  }

  if (value.type === "hasWeapon") {
    return typeof value.weaponId === "string";
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

  if (
    value.type === "setCheckpoint" ||
    value.type === "enableObject" ||
    value.type === "disableObject"
  ) {
    return typeof value.objectId === "string";
  }

  if (value.type === "spawnEnemy") {
    return typeof value.objectId === "string";
  }

  if (value.type === "healPlayer" || value.type === "damagePlayer") {
    return typeof value.amount === "number" && Number.isFinite(value.amount);
  }

  if (value.type === "giveWeapon") {
    return typeof value.weaponId === "string";
  }

  if (value.type === "completeObjective") {
    return typeof value.objectiveId === "string";
  }

  if (value.type === "showDialogue") {
    return typeof value.objectId === "string" && typeof value.message === "string";
  }

  if (value.type === "addScore") {
    return typeof value.amount === "number" && Number.isFinite(value.amount);
  }

  if (value.type === "addTeamScore") {
    return (
      typeof value.teamId === "string" &&
      typeof value.amount === "number" &&
      Number.isFinite(value.amount)
    );
  }

  if (value.type === "setTeam") {
    return typeof value.teamId === "string";
  }

  if (value.type === "endRound") {
    return value.result === "win" || value.result === "lose" || value.result === "draw";
  }

  return value.type === "finishMap";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function describeEvent(event: LogicRuntimeEvent): string {
  if (event.type === "onItemCollected") {
    return `${event.type} ${event.itemType}`;
  }

  if (event.type === "onPlayerDamaged") {
    return `${event.type} ${event.amount}`;
  }

  if (event.type === "onKeyCollected") {
    return `${event.type} ${event.keyId}`;
  }

  if (event.type === "onObjectiveCompleted") {
    return `${event.type} ${event.objectiveId}`;
  }

  if (event.type === "onScoreReached") {
    return `${event.type} ${event.amount}`;
  }

  if (event.type === "onTeamScoreReached") {
    return `${event.type} ${event.teamId} ${event.amount}`;
  }

  if (event.type === "onCapturePointCaptured") {
    return `${event.type} ${event.pointId}`;
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

  if (condition.type === "enemyDefeated") {
    return `enemyDefeated ${condition.objectId}`;
  }

  if (condition.type === "enemiesDefeatedAtLeast") {
    return `enemiesDefeatedAtLeast ${condition.amount}`;
  }

  if (condition.type === "hasWeapon") {
    return `hasWeapon ${condition.weaponId}`;
  }

  if (condition.type === "healthBelow") {
    return `healthBelow ${condition.amount}`;
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

  if (
    action.type === "setCheckpoint" ||
    action.type === "enableObject" ||
    action.type === "disableObject"
  ) {
    return `${action.type} ${action.objectId}`;
  }

  if (action.type === "spawnEnemy") {
    return `spawnEnemy ${action.objectId}`;
  }

  if (action.type === "healPlayer" || action.type === "damagePlayer") {
    return `${action.type} ${action.amount}`;
  }

  if (action.type === "giveWeapon") {
    return `giveWeapon ${action.weaponId}`;
  }

  if (action.type === "completeObjective") {
    return `completeObjective ${action.objectiveId}`;
  }

  if (action.type === "showDialogue") {
    return `showDialogue ${action.objectId}`;
  }

  if (action.type === "addScore") {
    return `addScore ${action.amount}`;
  }

  if (action.type === "addTeamScore") {
    return `addTeamScore ${action.teamId} ${action.amount}`;
  }

  if (action.type === "setTeam") {
    return `setTeam ${action.teamId}`;
  }

  if (action.type === "endRound") {
    return `endRound ${action.result}`;
  }

  return "finishMap";
}
