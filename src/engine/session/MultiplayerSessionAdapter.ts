import type { GameSessionAdapter } from "./GameSessionAdapter.js";
import type {
  GameNetworkEvent,
  NetworkEventCallback,
  PlayerInput,
  PlayerNetState,
  SessionState,
  SessionStateChangeCallback,
} from "../../shared/types/MultiplayerSchema.js";
import { multiplayerService } from "../../services/MultiplayerService.js";
import type { Vector3 } from "../../shared/types/ObjectSchema.js";

export class MultiplayerSessionAdapter implements GameSessionAdapter {
  private state: SessionState | null = null;
  private localPlayerId: string | null = null;
  private isRunning = false;
  private callbacks = {
    onStateChange: null as SessionStateChangeCallback | null,
    onNetworkEvent: null as NetworkEventCallback | null,
  };

  constructor(
    private readonly roomId: string,
    private readonly mapId: string,
    private readonly playerName: string
  ) {}

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.bindServiceCallbacks();

    try {
      await multiplayerService.connectWebSocket(this.roomId);
      multiplayerService.sendJoin(this.playerName);
    } catch (error) {
      this.isRunning = false;
      multiplayerService.clearCallbacks();
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    multiplayerService.disconnect();
    multiplayerService.clearCallbacks();
    this.state = null;
    this.localPlayerId = null;
  }

  sendInput(_input: PlayerInput): void {
    // No MVP, input nao e enviado ao servidor; apenas playerState e sincronizado.
  }

  sendPlayerState(
    position: Vector3,
    rotationY: number,
    health: number,
    equippedWeaponId: string | null,
    score: number
  ): void {
    if (!this.isRunning) {
      return;
    }

    multiplayerService.sendPlayerState(position, rotationY, health, equippedWeaponId, score);
  }

  getState(): SessionState | null {
    return this.state;
  }

  getLocalPlayerId(): string | null {
    return this.localPlayerId;
  }

  isLocal(): boolean {
    return false;
  }

  onStateChange(callback: SessionStateChangeCallback): void {
    this.callbacks.onStateChange = callback;
  }

  onNetworkEvent(callback: NetworkEventCallback): void {
    this.callbacks.onNetworkEvent = callback;
  }

  emitEvent(event: GameNetworkEvent): void {
    this.callbacks.onNetworkEvent?.(event);
  }

  isConnected(): boolean {
    return multiplayerService.isConnected();
  }

  private bindServiceCallbacks(): void {
    multiplayerService.onRoomState((players) => {
      this.localPlayerId = multiplayerService.getPlayerId();
      const remotePlayers = this.getRemotePlayers(players);

      this.state = {
        sessionId: this.roomId,
        mapId: this.mapId,
        mode: "multiplayer",
        players: remotePlayers,
        startedAt: new Date().toISOString(),
        currentRound: 1,
        maxRounds: 1,
        roundTimeRemaining: 0,
      };

      this.callbacks.onStateChange?.(this.state);
    });

    multiplayerService.onPlayerJoined((player) => {
      if (player.id === this.localPlayerId) {
        return;
      }

      this.callbacks.onNetworkEvent?.({
        type: "playerJoined",
        player,
      });
    });

    multiplayerService.onPlayerLeft((playerId) => {
      this.callbacks.onNetworkEvent?.({
        type: "playerLeft",
        playerId,
      });
    });

    multiplayerService.onPlayerUpdated((playerId, player) => {
      if (playerId === this.localPlayerId) {
        return;
      }

      this.callbacks.onNetworkEvent?.({
        type: "playerMoved",
        playerId,
        position: player.position,
        rotationY: player.rotationY,
      });
    });

    multiplayerService.onError((message) => {
      this.callbacks.onNetworkEvent?.({
        type: "matchEnded",
        winnerTeamId: null,
        reason: message,
      });
    });
  }

  private getRemotePlayers(players: Record<string, PlayerNetState>): PlayerNetState[] {
    const localPlayerId = multiplayerService.getPlayerId();
    return Object.values(players).filter((player) => player.id !== localPlayerId);
  }
}
