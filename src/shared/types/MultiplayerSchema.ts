import type { Vector3 } from "./ObjectSchema.js";
import type { WeaponAttackType } from "./ItemSchema.js";

export type PlayerHealSource = "healthPickup";

export type PlayerNetState = {
  id: string;
  clientId?: string;
  name: string;
  teamId: string | null;
  position: Vector3;
  rotationY: number;
  health: number;
  maxHealth: number;
  equippedWeaponId: string | null;
  score: number;
  isAlive: boolean;
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
  attackType?: WeaponAttackType;
};

export type PlayerAttackVisualPayload = {
  weaponId: "basic_sword" | string;
  attackType: WeaponAttackType;
  origin: Vector3;
  direction: Vector3;
};

export type PlayerHealRequestPayload = {
  amount: number;
  source: PlayerHealSource;
  sourceObjectId?: string;
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

export type SessionState = {
  sessionId: string;
  mapId: string;
  mode: string;
  players: PlayerNetState[];
  startedAt: string;
  currentRound: number;
  maxRounds: number;
  roundTimeRemaining: number;
};

export type PlayerInput = {
  moveX: number;
  moveZ: number;
  jump: boolean;
  run: boolean;
  attack: boolean;
  cameraYaw: number;
  cameraPitch: number;
};

export type GameNetworkEvent =
  | { type: "playerJoined"; player: PlayerNetState }
  | { type: "playerLeft"; playerId: string }
  | {
      type: "playerMoved";
      playerId: string;
      position: Vector3;
      rotationY: number;
      player?: PlayerNetState;
    }
  | ({ type: "playerAttackVisual"; playerId: string } & PlayerAttackVisualPayload)
  | {
      type: "playerDamaged";
      targetPlayerId: string;
      attackerPlayerId?: string;
      damage: number;
      health: number;
    }
  | {
      type: "playerHealed";
      playerId: string;
      amount: number;
      health: number;
      source: PlayerHealSource;
      sourceObjectId?: string;
    }
  | { type: "playerDied"; playerId: string; killerId: string | null }
  | { type: "playerDefeated"; playerId: string; defeatedByPlayerId?: string }
  | { type: "playerRespawned"; playerId: string; health: number; position: Vector3 }
  | { type: "enemyState"; enemies: Record<string, EnemyNetState> }
  | { type: "enemyUpdated"; enemy: EnemyNetState }
  | { type: "enemyDefeated"; enemyObjectId: string; defeatedByPlayerId?: string }
  | { type: "combatState"; players: Record<string, PlayerCombatState> }
  | { type: "chatHistory"; messages: ChatMessage[] }
  | { type: "chatMessage"; message: ChatMessage }
  | { type: "hostChanged"; hostPlayerId: string | null }
  | { type: "itemCollected"; playerId: string; itemId: string; itemType: string }
  | { type: "doorOpened"; doorId: string; playerId: string }
  | { type: "scoreChanged"; playerId: string; score: number }
  | { type: "capturePointCaptured"; pointId: string; teamId: string; previousTeamId: string | null }
  | { type: "matchEnded"; winnerTeamId: string | null; reason: string }
  | { type: "roundStarted"; round: number }
  | { type: "roundEnded"; round: number; winnerTeamId: string | null };

export type SessionAdapterConfig = {
  sessionId: string;
  mapId: string;
  mode: string;
  maxPlayers: number;
  isHost: boolean;
};

export type SessionStateChangeCallback = (state: SessionState) => void;
export type NetworkEventCallback = (event: GameNetworkEvent) => void;

// Multiplayer MVP types
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
  | ({ type: "playerAttackVisual" } & PlayerAttackVisualPayload)
  | ({ type: "playerHealRequest" } & PlayerHealRequestPayload)
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
      players: Record<string, PlayerNetState>;
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
  | {
      type: "playerHealed";
      playerId: string;
      amount: number;
      health: number;
      source: PlayerHealSource;
      sourceObjectId?: string;
    }
  | { type: "playerDefeated"; playerId: string; defeatedByPlayerId?: string }
  | { type: "playerRespawned"; playerId: string; health: number; position: Vector3 }
  | { type: "combatState"; players: Record<string, PlayerCombatState> }
  | { type: "chatHistory"; messages: ChatMessage[] }
  | { type: "chatMessage"; message: ChatMessage }
  | { type: "hostChanged"; hostPlayerId: string | null }
  | { type: "playerJoined"; player: PlayerNetState }
  | { type: "playerLeft"; playerId: string }
  | { type: "playerUpdated"; playerId: string; player: PlayerNetState }
  | ({ type: "playerAttackVisual"; playerId: string } & PlayerAttackVisualPayload)
  | { type: "error"; message: string }
  | { type: "pong" };

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

export type ListRoomsResponse = {
  ok: true;
  rooms: RoomSummary[];
};

export type GetRoomResponse = {
  ok: true;
  roomId: string;
  onlineMapId: string;
  playerCount: number;
  hostPlayerId: string | null;
  players: Array<{
    id: string;
    name: string;
    teamId: string | null;
    health: number;
    score: number;
    isAlive: boolean;
  }>;
};
