import type {
  ChatMessage,
  CreateRoomRequest,
  CreateRoomResponse,
  EnemyNetState,
  EnemyPositionUpdate,
  GetRoomResponse,
  ListRoomsResponse,
  MultiplayerClientMessage,
  MultiplayerServerMessage,
  PlayerAttackPayload,
  PlayerAttackVisualPayload,
  PlayerCombatState,
  PlayerHealRequestPayload,
  PlayerHealSource,
  PlayerNetState,
  SharedWorldState,
  WorldEvent,
} from "../shared/types/MultiplayerSchema.js";
import { LocalProfileStorage } from "../storage/LocalProfileStorage.js";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const CONNECT_TIMEOUT_MS = 8000;

type MultiplayerCallbacks = {
  onRoomState:
    | ((
        players: Record<string, PlayerNetState>,
        hostPlayerId: string | null,
        playerCombatStates: Record<string, PlayerCombatState>
      ) => void)
    | null;
  onPlayerJoined: ((player: PlayerNetState) => void) | null;
  onPlayerLeft: ((playerId: string) => void) | null;
  onPlayerUpdated: ((playerId: string, player: PlayerNetState) => void) | null;
  onWorldState: ((state: SharedWorldState) => void) | null;
  onWorldEvent: ((event: WorldEvent) => void) | null;
  onEnemyState: ((enemies: Record<string, EnemyNetState>) => void) | null;
  onEnemyUpdated: ((enemy: EnemyNetState) => void) | null;
  onEnemyDefeated: ((enemyObjectId: string, defeatedByPlayerId?: string) => void) | null;
  onCombatState: ((players: Record<string, PlayerCombatState>) => void) | null;
  onPlayerDamaged:
    | ((targetPlayerId: string, damage: number, health: number, attackerPlayerId?: string) => void)
    | null;
  onPlayerHealed:
    | ((
        playerId: string,
        amount: number,
        health: number,
        source: PlayerHealSource,
        sourceObjectId?: string
      ) => void)
    | null;
  onPlayerAttackVisual: ((playerId: string, payload: PlayerAttackVisualPayload) => void) | null;
  onPlayerDefeated: ((playerId: string, defeatedByPlayerId?: string) => void) | null;
  onPlayerRespawned:
    | ((playerId: string, health: number, position: PlayerNetState["position"]) => void)
    | null;
  onChatHistory: ((messages: ChatMessage[]) => void) | null;
  onChatMessage: ((message: ChatMessage) => void) | null;
  onHostChanged: ((hostPlayerId: string | null) => void) | null;
  onError: ((message: string) => void) | null;
};

export class MultiplayerService {
  private ws: WebSocket | null = null;
  private roomId: string | null = null;
  private readonly clientId: string;
  private playerId: string | null = null;
  private hostPlayerId: string | null = null;
  private callbacks: MultiplayerCallbacks = createEmptyCallbacks();

  constructor() {
    this.clientId = LocalProfileStorage.getClientId();
  }

  async createRoom(onlineMapId: string, playerName: string): Promise<CreateRoomResponse> {
    const request: CreateRoomRequest = {
      onlineMapId,
      clientId: this.clientId,
      playerName,
    };

    const response = await fetch(`${API_URL}/api/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const message = await readErrorMessage(response);
      throw new Error(message || `Failed to create room: ${response.statusText}`);
    }

    return (await response.json()) as CreateRoomResponse;
  }

  async listRooms(): Promise<ListRoomsResponse> {
    const response = await fetch(`${API_URL}/api/rooms`);

    if (!response.ok) {
      const message = await readErrorMessage(response);
      throw new Error(message || `Failed to list rooms: ${response.statusText}`);
    }

    return (await response.json()) as ListRoomsResponse;
  }

  async getRoom(roomId: string): Promise<GetRoomResponse> {
    const response = await fetch(`${API_URL}/api/rooms/${roomId}`);

    if (!response.ok) {
      const message = await readErrorMessage(response);
      throw new Error(message || `Failed to get room: ${response.statusText}`);
    }

    return (await response.json()) as GetRoomResponse;
  }

  connectWebSocket(roomId: string): Promise<void> {
    if (this.ws) {
      this.disconnect();
    }

    this.roomId = roomId;
    const wsUrl = this.convertHttpToWs(API_URL);
    const fullUrl = `${wsUrl}/ws?roomId=${encodeURIComponent(roomId)}&clientId=${encodeURIComponent(this.clientId)}`;

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(fullUrl);
      this.ws = ws;
      let settled = false;

      const timeoutId = window.setTimeout(() => {
        if (settled) {
          return;
        }

        settled = true;
        this.callbacks.onError?.("Tempo esgotado ao conectar no multiplayer.");
        this.disconnect();
        reject(new Error("Timed out connecting to multiplayer server"));
      }, CONNECT_TIMEOUT_MS);

      ws.onopen = () => {
        window.clearTimeout(timeoutId);
        settled = true;
        resolve();
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as MultiplayerServerMessage;
          this.handleServerMessage(message);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onerror = () => {
        this.callbacks.onError?.("Erro de conexao WebSocket.");

        if (!settled) {
          window.clearTimeout(timeoutId);
          settled = true;
          reject(new Error("WebSocket connection error"));
        }
      };

      ws.onclose = () => {
        window.clearTimeout(timeoutId);

        if (this.ws === ws) {
          this.ws = null;
          this.playerId = null;
          this.hostPlayerId = null;
        }

        if (!settled) {
          settled = true;
          reject(new Error("WebSocket closed before opening"));
        }
      };
    });
  }

  sendJoin(playerName: string): void {
    this.send({
      type: "join",
      playerName,
    });
  }

  sendLeave(): void {
    this.send({ type: "leave" });
  }

  sendPlayerState(
    position: { x: number; y: number; z: number },
    rotationY: number,
    health: number,
    equippedWeaponId: string | null,
    score: number
  ): void {
    this.send({
      type: "playerState",
      position,
      rotationY,
      health,
      equippedWeaponId,
      score,
    });
  }

  sendPing(): void {
    this.send({ type: "ping" });
  }

  sendWorldEvent(event: WorldEvent): void {
    this.send({
      type: "worldEvent",
      event,
    });
  }

  sendEnemyHit(enemyObjectId: string, damage: number, weaponId?: string): void {
    this.send({
      type: "enemyHit",
      enemyObjectId,
      damage,
      weaponId,
    });
  }

  sendEnemyStateRequest(): void {
    this.send({ type: "enemyStateRequest" });
  }

  sendEnemyPositionUpdate(enemies: EnemyPositionUpdate[]): void {
    this.send({
      type: "enemyPositionUpdate",
      enemies,
    });
  }

  sendPlayerAttack(payload: PlayerAttackPayload): void {
    this.send({
      type: "playerAttack",
      ...payload,
    });
  }

  sendPlayerAttackVisual(payload: PlayerAttackVisualPayload): void {
    this.send({
      type: "playerAttackVisual",
      ...payload,
    });
  }

  sendPlayerHealRequest(payload: PlayerHealRequestPayload): void {
    this.send({
      type: "playerHealRequest",
      ...payload,
    });
  }

  sendPlayerDamageReport(
    damage: number,
    source: "enemy" | "hazard" | "logic",
    targetPlayerId?: string
  ): void {
    this.send({
      type: "playerDamaged",
      damage,
      source,
      targetPlayerId,
    });
  }

  sendChatMessage(text: string): void {
    this.send({
      type: "chatMessage",
      text,
    });
  }

  onRoomState(
    callback: (
      players: Record<string, PlayerNetState>,
      hostPlayerId: string | null,
      playerCombatStates: Record<string, PlayerCombatState>
    ) => void
  ): void {
    this.callbacks.onRoomState = callback;
  }

  onPlayerJoined(callback: (player: PlayerNetState) => void): void {
    this.callbacks.onPlayerJoined = callback;
  }

  onPlayerLeft(callback: (playerId: string) => void): void {
    this.callbacks.onPlayerLeft = callback;
  }

  onPlayerUpdated(callback: (playerId: string, player: PlayerNetState) => void): void {
    this.callbacks.onPlayerUpdated = callback;
  }

  onWorldState(callback: (state: SharedWorldState) => void): void {
    this.callbacks.onWorldState = callback;
  }

  onWorldEvent(callback: (event: WorldEvent) => void): void {
    this.callbacks.onWorldEvent = callback;
  }

  onEnemyState(callback: (enemies: Record<string, EnemyNetState>) => void): void {
    this.callbacks.onEnemyState = callback;
  }

  onEnemyUpdated(callback: (enemy: EnemyNetState) => void): void {
    this.callbacks.onEnemyUpdated = callback;
  }

  onEnemyDefeated(callback: (enemyObjectId: string, defeatedByPlayerId?: string) => void): void {
    this.callbacks.onEnemyDefeated = callback;
  }

  onCombatState(callback: (players: Record<string, PlayerCombatState>) => void): void {
    this.callbacks.onCombatState = callback;
  }

  onPlayerDamaged(
    callback: (
      targetPlayerId: string,
      damage: number,
      health: number,
      attackerPlayerId?: string
    ) => void
  ): void {
    this.callbacks.onPlayerDamaged = callback;
  }

  onPlayerHealed(
    callback: (
      playerId: string,
      amount: number,
      health: number,
      source: PlayerHealSource,
      sourceObjectId?: string
    ) => void
  ): void {
    this.callbacks.onPlayerHealed = callback;
  }

  onPlayerAttackVisual(
    callback: (playerId: string, payload: PlayerAttackVisualPayload) => void
  ): void {
    this.callbacks.onPlayerAttackVisual = callback;
  }

  onPlayerDefeated(callback: (playerId: string, defeatedByPlayerId?: string) => void): void {
    this.callbacks.onPlayerDefeated = callback;
  }

  onPlayerRespawned(
    callback: (playerId: string, health: number, position: PlayerNetState["position"]) => void
  ): void {
    this.callbacks.onPlayerRespawned = callback;
  }

  onChatHistory(callback: (messages: ChatMessage[]) => void): void {
    this.callbacks.onChatHistory = callback;
  }

  onChatMessage(callback: (message: ChatMessage) => void): void {
    this.callbacks.onChatMessage = callback;
  }

  onHostChanged(callback: (hostPlayerId: string | null) => void): void {
    this.callbacks.onHostChanged = callback;
  }

  onError(callback: (message: string) => void): void {
    this.callbacks.onError = callback;
  }

  disconnect(): void {
    const ws = this.ws;
    if (ws) {
      this.sendLeave();

      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    }

    this.roomId = null;
    this.playerId = null;
    this.hostPlayerId = null;
    this.ws = null;
  }

  clearCallbacks(): void {
    this.callbacks = createEmptyCallbacks();
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  getPlayerId(): string | null {
    return this.playerId;
  }

  getRoomId(): string | null {
    return this.roomId;
  }

  getHostPlayerId(): string | null {
    return this.hostPlayerId;
  }

  private send(message: MultiplayerClientMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    this.ws.send(JSON.stringify(message));
  }

  private handleServerMessage(message: MultiplayerServerMessage): void {
    switch (message.type) {
      case "welcome":
        this.playerId = message.playerId;
        this.hostPlayerId = message.hostPlayerId;
        this.callbacks.onHostChanged?.(message.hostPlayerId);
        break;

      case "roomState":
        this.hostPlayerId = message.hostPlayerId;
        this.callbacks.onRoomState?.(
          message.players,
          message.hostPlayerId,
          message.playerCombatStates
        );
        break;

      case "worldState":
        this.callbacks.onWorldState?.(message.state);
        break;

      case "worldEvent":
        this.callbacks.onWorldEvent?.(message.event);
        break;

      case "enemyState":
        this.callbacks.onEnemyState?.(message.enemies);
        break;

      case "enemyUpdated":
        this.callbacks.onEnemyUpdated?.(message.enemy);
        break;

      case "enemyDefeated":
        this.callbacks.onEnemyDefeated?.(message.enemyObjectId, message.defeatedByPlayerId);
        break;

      case "combatState":
        this.callbacks.onCombatState?.(message.players);
        break;

      case "playerDamaged":
        this.callbacks.onPlayerDamaged?.(
          message.targetPlayerId,
          message.damage,
          message.health,
          message.attackerPlayerId
        );
        break;

      case "playerHealed":
        this.callbacks.onPlayerHealed?.(
          message.playerId,
          message.amount,
          message.health,
          message.source,
          message.sourceObjectId
        );
        break;

      case "playerAttackVisual":
        this.callbacks.onPlayerAttackVisual?.(message.playerId, {
          weaponId: message.weaponId,
          attackType: message.attackType,
          origin: message.origin,
          direction: message.direction,
        });
        break;

      case "playerDefeated":
        this.callbacks.onPlayerDefeated?.(message.playerId, message.defeatedByPlayerId);
        break;

      case "playerRespawned":
        this.callbacks.onPlayerRespawned?.(message.playerId, message.health, message.position);
        break;

      case "chatHistory":
        this.callbacks.onChatHistory?.(message.messages);
        break;

      case "chatMessage":
        this.callbacks.onChatMessage?.(message.message);
        break;

      case "hostChanged":
        this.hostPlayerId = message.hostPlayerId;
        this.callbacks.onHostChanged?.(message.hostPlayerId);
        break;

      case "playerJoined":
        this.callbacks.onPlayerJoined?.(message.player);
        break;

      case "playerLeft":
        this.callbacks.onPlayerLeft?.(message.playerId);
        break;

      case "playerUpdated":
        this.callbacks.onPlayerUpdated?.(message.playerId, message.player);
        break;

      case "error":
        this.callbacks.onError?.(message.message);
        break;

      case "pong":
        break;
    }
  }

  private convertHttpToWs(httpUrl: string): string {
    return httpUrl.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
  }
}

function createEmptyCallbacks(): MultiplayerCallbacks {
  return {
    onRoomState: null,
    onPlayerJoined: null,
    onPlayerLeft: null,
    onPlayerUpdated: null,
    onWorldState: null,
    onWorldEvent: null,
    onEnemyState: null,
    onEnemyUpdated: null,
    onEnemyDefeated: null,
    onCombatState: null,
    onPlayerDamaged: null,
    onPlayerHealed: null,
    onPlayerAttackVisual: null,
    onPlayerDefeated: null,
    onPlayerRespawned: null,
    onChatHistory: null,
    onChatMessage: null,
    onHostChanged: null,
    onError: null,
  };
}

async function readErrorMessage(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : null;
  } catch {
    return null;
  }
}

export const multiplayerService = new MultiplayerService();
