export type LogicValue =
  | string
  | number
  | boolean
  | null
  | LogicValue[]
  | { [key: string]: LogicValue };

export type LogicTrigger =
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
      keyId: string;
    }
  | {
      type: "onEnemyDefeated";
      objectId: string;
    }
  | {
      type: "onAnyEnemyDefeated";
    }
  | {
      type: "onAllEnemiesDefeated";
    }
  | {
      type: "onPlayerDamaged";
    }
  | {
      type: "onItemCollected";
      itemType: "health" | "coin" | "weapon_basic" | string;
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

export type LogicCondition =
  | {
      type: "hasKey";
      keyId: string;
    }
  | {
      type: "coinsAtLeast";
      amount: number;
    }
  | {
      type: "doorIsOpen";
      doorId: string;
    }
  | {
      type: "enemyDefeated";
      objectId: string;
    }
  | {
      type: "enemiesDefeatedAtLeast";
      amount: number;
    }
  | {
      type: "hasWeapon";
      weaponId: "basic_sword" | string;
    }
  | {
      type: "healthBelow";
      amount: number;
    }
  | {
      type: "once";
    };

export type LogicAction =
  | {
      type: "showMessage";
      message: string;
    }
  | {
      type: "openDoor";
      doorId: string;
    }
  | {
      type: "closeDoor";
      doorId: string;
    }
  | {
      type: "teleportPlayer";
      targetObjectId: string;
    }
  | {
      type: "giveCoins";
      amount: number;
    }
  | {
      type: "setCheckpoint";
      objectId: string;
    }
  | {
      type: "finishMap";
    }
  | {
      type: "enableObject";
      objectId: string;
    }
  | {
      type: "disableObject";
      objectId: string;
    }
  | {
      type: "spawnEnemy";
      objectId: string;
    }
  | {
      type: "healPlayer";
      amount: number;
    }
  | {
      type: "damagePlayer";
      amount: number;
    }
  | {
      type: "giveWeapon";
      weaponId: "basic_sword" | string;
    }
  | {
      type: "completeObjective";
      objectiveId: string;
    }
  | {
      type: "showDialogue";
      objectId: string;
      message: string;
    }
  | {
      type: "addScore";
      amount: number;
    }
  | {
      type: "addTeamScore";
      teamId: string;
      amount: number;
    }
  | {
      type: "setTeam";
      teamId: string;
    }
  | {
      type: "endRound";
      result: "win" | "lose" | "draw";
    };

export type LogicRule = {
  id: string;
  name: string;
  enabled: boolean;
  trigger: LogicTrigger;
  conditions: LogicCondition[];
  actions: LogicAction[];
};

export type LogicNode = {
  id: string;
  type: string;
  name?: string;
  targetObjectId?: string;
  inputs?: Record<string, LogicValue>;
  outputs?: Record<string, string | string[]>;
  parameters?: Record<string, LogicValue>;
};

export type ScriptSchema = {
  id: string;
  name: string;
  nodes: LogicNode[];
};
