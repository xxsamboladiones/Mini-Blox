import type { Vector3 } from "./ObjectSchema.js";

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
  | { type: "playerMoved"; playerId: string; position: Vector3; rotationY: number }
  | { type: "playerDamaged"; playerId: string; damage: number; attackerId: string | null }
  | { type: "playerDied"; playerId: string; killerId: string | null }
  | { type: "playerRespawned"; playerId: string; position: Vector3 }
  | { type: "enemyDefeated"; enemyId: string; killerId: string }
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
  | { type: "worldEvent"; event: WorldEvent };

export type MultiplayerServerMessage =
  | { type: "welcome"; roomId: string; playerId: string }
  | { type: "roomState"; players: Record<string, PlayerNetState> }
  | { type: "worldState"; state: SharedWorldState }
  | { type: "worldEvent"; event: WorldEvent }
  | { type: "playerJoined"; player: PlayerNetState }
  | { type: "playerLeft"; playerId: string }
  | { type: "playerUpdated"; playerId: string; player: PlayerNetState }
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
  players: Array<{
    id: string;
    name: string;
    teamId: string | null;
    health: number;
    score: number;
    isAlive: boolean;
  }>;
};
