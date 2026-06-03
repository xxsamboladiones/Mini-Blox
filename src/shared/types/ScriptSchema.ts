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
