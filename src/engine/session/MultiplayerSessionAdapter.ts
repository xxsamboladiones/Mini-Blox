import type { GameSessionAdapter } from "./GameSessionAdapter.js";
import type {
  ChatMessage,
  EnemyNetState,
  EnemyPositionUpdate,
  GameNetworkEvent,
  NetworkEventCallback,
  PlayerAttackPayload,
  PlayerInput,
  PlayerNetState,
  SharedWorldState,
  SessionState,
  SessionStateChangeCallback,
  WorldEvent,
} from "../../shared/types/MultiplayerSchema.js";
import { multiplayerService } from "../../services/MultiplayerService.js";
import type { Vector3 } from "../../shared/types/ObjectSchema.js";

export class MultiplayerSessionAdapter implements GameSessionAdapter {
  private state: SessionState | null = null;
  private localPlayerId: string | null = null;
  private hostPlayerId: string | null = null;
  private isRunning = false;
  private callbacks = {
    onStateChange: null as SessionStateChangeCallback | null,
    onNetworkEvent: null as NetworkEventCallback | null,
    onWorldState: null as ((state: SharedWorldState) => void) | null,
    onWorldEvent: null as ((event: WorldEvent) => void) | null,
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
    this.hostPlayerId = null;
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

  sendWorldEvent(event: WorldEvent): void {
    if (!this.isRunning) {
      return;
    }

    multiplayerService.sendWorldEvent(event);
  }

  sendEnemyHit(enemyObjectId: string, damage: number, weaponId?: string): void {
    if (!this.isRunning) {
      return;
    }

    multiplayerService.sendEnemyHit(enemyObjectId, damage, weaponId);
  }

  sendEnemyStateRequest(): void {
    if (!this.isRunning) {
      return;
    }

    multiplayerService.sendEnemyStateRequest();
  }

  sendEnemyPositionUpdate(enemies: EnemyPositionUpdate[]): void {
    if (!this.isRunning || !this.isHost()) {
      return;
    }

    multiplayerService.sendEnemyPositionUpdate(enemies);
  }

  sendPlayerAttack(payload: PlayerAttackPayload): void {
    if (!this.isRunning) {
      return;
    }

    multiplayerService.sendPlayerAttack(payload);
  }

  sendPlayerDamageReport(
    damage: number,
    source: "enemy" | "hazard" | "logic",
    targetPlayerId?: string
  ): void {
    if (!this.isRunning) {
      return;
    }

    multiplayerService.sendPlayerDamageReport(damage, source, targetPlayerId);
  }

  sendChatMessage(text: string): void {
    if (!this.isRunning) {
      return;
    }

    multiplayerService.sendChatMessage(text);
  }

  getState(): SessionState | null {
    return this.state;
  }

  getLocalPlayerId(): string | null {
    return this.localPlayerId;
  }

  getHostPlayerId(): string | null {
    return this.hostPlayerId;
  }

  isHost(): boolean {
    return Boolean(this.localPlayerId && this.localPlayerId === this.hostPlayerId);
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

  onWorldState(callback: (state: SharedWorldState) => void): void {
    this.callbacks.onWorldState = callback;
  }

  onWorldEvent(callback: (event: WorldEvent) => void): void {
    this.callbacks.onWorldEvent = callback;
  }

  emitEvent(event: GameNetworkEvent): void {
    this.callbacks.onNetworkEvent?.(event);
  }

  isConnected(): boolean {
    return multiplayerService.isConnected();
  }

  private bindServiceCallbacks(): void {
    multiplayerService.onRoomState((players, hostPlayerId, playerCombatStates) => {
      this.localPlayerId = multiplayerService.getPlayerId();
      this.hostPlayerId = hostPlayerId;
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
      this.callbacks.onNetworkEvent?.({
        type: "combatState",
        players: playerCombatStates,
      });
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

    multiplayerService.onWorldState((state) => {
      this.callbacks.onWorldState?.(state);
    });

    multiplayerService.onWorldEvent((event) => {
      this.callbacks.onWorldEvent?.(event);
    });

    multiplayerService.onEnemyState((enemies: Record<string, EnemyNetState>) => {
      this.callbacks.onNetworkEvent?.({
        type: "enemyState",
        enemies,
      });
    });

    multiplayerService.onEnemyUpdated((enemy) => {
      this.callbacks.onNetworkEvent?.({
        type: "enemyUpdated",
        enemy,
      });
    });

    multiplayerService.onEnemyDefeated((enemyObjectId, defeatedByPlayerId) => {
      this.callbacks.onNetworkEvent?.({
        type: "enemyDefeated",
        enemyObjectId,
        defeatedByPlayerId,
      });
    });

    multiplayerService.onCombatState((players) => {
      this.callbacks.onNetworkEvent?.({
        type: "combatState",
        players,
      });
    });

    multiplayerService.onPlayerDamaged((targetPlayerId, damage, health, attackerPlayerId) => {
      this.callbacks.onNetworkEvent?.({
        type: "playerDamaged",
        targetPlayerId,
        damage,
        health,
        attackerPlayerId,
      });
    });

    multiplayerService.onPlayerDefeated((playerId, defeatedByPlayerId) => {
      this.callbacks.onNetworkEvent?.({
        type: "playerDefeated",
        playerId,
        defeatedByPlayerId,
      });
    });

    multiplayerService.onPlayerRespawned((playerId, health, position) => {
      this.callbacks.onNetworkEvent?.({
        type: "playerRespawned",
        playerId,
        health,
        position,
      });
    });

    multiplayerService.onChatHistory((messages: ChatMessage[]) => {
      this.callbacks.onNetworkEvent?.({
        type: "chatHistory",
        messages,
      });
    });

    multiplayerService.onChatMessage((message) => {
      this.callbacks.onNetworkEvent?.({
        type: "chatMessage",
        message,
      });
    });

    multiplayerService.onHostChanged((hostPlayerId) => {
      this.hostPlayerId = hostPlayerId;
      this.callbacks.onNetworkEvent?.({
        type: "hostChanged",
        hostPlayerId,
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
