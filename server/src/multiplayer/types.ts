export type Vector3 = {
  x: number;
  y: number;
  z: number;
};

export type RoomPlayer = {
  id: string;
  clientId: string;
  name: string;
  teamId: string | null;
  position: Vector3;
  rotationY: number;
  health: number;
  maxHealth: number;
  equippedWeaponId: string | null;
  score: number;
  isAlive: boolean;
  joinedAt: string;
  lastUpdateAt: string;
};

export type EnemyNetState = {
  objectId: string;
  enemyGroupId?: string;
  isBoss?: boolean;
  position: Vector3;
  rotationY: number;
  health: number;
  maxHealth: number;
  alive: boolean;
  targetPlayerId?: string;
  state: "idle" | "patrol" | "chase" | "dead";
  updatedAt: number;
};

export type PlayerCombatState = {
  playerId: string;
  health: number;
  maxHealth: number;
  alive: boolean;
  lastDamageAt?: number;
  lastRespawnAt?: number;
};

export type ChatMessage = {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  createdAt: number;
  type: "player" | "system";
};

export type EnemyPositionUpdate = {
  objectId: string;
  position: Vector3;
  rotationY: number;
  state: "idle" | "patrol" | "chase" | "dead";
  targetPlayerId?: string;
};

export type PlayerAttackPayload = {
  weaponId: "basic_sword" | string;
  origin: Vector3;
  direction: Vector3;
  range: number;
  damage: number;
  targetPlayerId?: string;
};

export type SharedWorldState = {
  openedDoorIds: string[];
  activatedButtonIds: string[];
  collectedCoinObjectIds: string[];
  collectedItemObjectIds: string[];
};

export type WorldEvent =
  | { type: "doorOpened"; doorId: string; objectId?: string }
  | { type: "doorClosed"; doorId: string; objectId?: string }
  | { type: "buttonActivated"; objectId: string; doorId?: string }
  | { type: "coinCollected"; objectId: string; doorId?: string }
  | { type: "itemCollected"; objectId: string; doorId?: string };

export type Room = {
  roomId: string;
  mapId: string;
  onlineMapId: string;
  players: Map<string, RoomPlayer>;
  sharedState: SharedWorldState;
  createdAt: string;
  lastActivityAt: string;
};

export type CreateRoomRequest = {
  onlineMapId: string;
  clientId: string;
  playerName: string;
};

export type CreateRoomResponse = {
  ok: true;
  roomId: string;
  websocketUrl: string;
};

export type RoomSummary = {
  roomId: string;
  onlineMapId: string;
  playerCount: number;
  maxPlayers: number;
  createdAt: string;
  lastActivityAt: string;
  hostPlayerId: string | null;
};

export type MultiplayerClientMessage =
  | { type: "join"; playerName: string }
  | { type: "leave" }
  | {
      type: "playerState";
      position: Vector3;
      rotationY: number;
      health: number;
      equippedWeaponId: string | null;
      score: number;
    }
  | { type: "ping" }
  | { type: "worldEvent"; event: WorldEvent }
  | {
      type: "enemyHit";
      enemyObjectId: string;
      damage: number;
      weaponId?: string;
    }
  | { type: "enemyStateRequest" }
  | { type: "enemyPositionUpdate"; enemies: EnemyPositionUpdate[] }
  | ({ type: "playerAttack" } & PlayerAttackPayload)
  | {
      type: "playerDamaged";
      damage: number;
      source: "enemy" | "hazard" | "logic";
      targetPlayerId?: string;
    }
  | { type: "chatMessage"; text: string };

export type MultiplayerServerMessage =
  | { type: "welcome"; roomId: string; playerId: string; hostPlayerId: string | null }
  | {
      type: "roomState";
      players: Record<string, RoomPlayer>;
      hostPlayerId: string | null;
      playerCombatStates: Record<string, PlayerCombatState>;
    }
  | { type: "worldState"; state: SharedWorldState }
  | { type: "worldEvent"; event: WorldEvent }
  | { type: "enemyState"; enemies: Record<string, EnemyNetState> }
  | { type: "enemyUpdated"; enemy: EnemyNetState }
  | { type: "enemyDefeated"; enemyObjectId: string; defeatedByPlayerId?: string }
  | {
      type: "playerDamaged";
      targetPlayerId: string;
      attackerPlayerId?: string;
      damage: number;
      health: number;
    }
  | { type: "playerDefeated"; playerId: string; defeatedByPlayerId?: string }
  | { type: "playerRespawned"; playerId: string; health: number; position: Vector3 }
  | { type: "combatState"; players: Record<string, PlayerCombatState> }
  | { type: "chatHistory"; messages: ChatMessage[] }
  | { type: "chatMessage"; message: ChatMessage }
  | { type: "hostChanged"; hostPlayerId: string | null }
  | { type: "playerJoined"; player: RoomPlayer }
  | { type: "playerLeft"; playerId: string }
  | { type: "playerUpdated"; playerId: string; player: RoomPlayer }
  | { type: "error"; message: string }
  | { type: "pong" };
