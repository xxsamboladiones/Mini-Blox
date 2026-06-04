import type {
  CreateRoomRequest,
  CreateRoomResponse,
  GetRoomResponse,
  ListRoomsResponse,
  MultiplayerClientMessage,
  MultiplayerServerMessage,
  PlayerNetState,
} from "../shared/types/MultiplayerSchema.js";
import { LocalProfileStorage } from "../storage/LocalProfileStorage.js";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const CONNECT_TIMEOUT_MS = 8000;

type MultiplayerCallbacks = {
  onRoomState: ((players: Record<string, PlayerNetState>) => void) | null;
  onPlayerJoined: ((player: PlayerNetState) => void) | null;
  onPlayerLeft: ((playerId: string) => void) | null;
  onPlayerUpdated: ((playerId: string, player: PlayerNetState) => void) | null;
  onError: ((message: string) => void) | null;
};

export class MultiplayerService {
  private ws: WebSocket | null = null;
  private roomId: string | null = null;
  private readonly clientId: string;
  private playerId: string | null = null;
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

  onRoomState(callback: (players: Record<string, PlayerNetState>) => void): void {
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
        break;

      case "roomState":
        this.callbacks.onRoomState?.(message.players);
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
