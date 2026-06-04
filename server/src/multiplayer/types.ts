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
  | { type: "worldEvent"; event: WorldEvent };

export type MultiplayerServerMessage =
  | { type: "welcome"; roomId: string; playerId: string }
  | { type: "roomState"; players: Record<string, RoomPlayer> }
  | { type: "worldState"; state: SharedWorldState }
  | { type: "worldEvent"; event: WorldEvent }
  | { type: "playerJoined"; player: RoomPlayer }
  | { type: "playerLeft"; playerId: string }
  | { type: "playerUpdated"; playerId: string; player: RoomPlayer }
  | { type: "error"; message: string }
  | { type: "pong" };
