import type {
  GameNetworkEvent,
  NetworkEventCallback,
  PlayerInput,
  SessionAdapterConfig,
  SessionState,
  SessionStateChangeCallback,
} from "../../shared/types/MultiplayerSchema.js";
import type { GameSessionAdapter } from "./GameSessionAdapter.js";
import type { Vector3 } from "../../shared/types/ObjectSchema.js";

export class LocalGameSessionAdapter implements GameSessionAdapter {
  private state: SessionState | null = null;
  private stateChangeCallback: SessionStateChangeCallback | null = null;
  private networkEventCallback: NetworkEventCallback | null = null;
  private started = false;

  constructor(private readonly config: SessionAdapterConfig) {}

  async start(): Promise<void> {
    this.started = true;
    this.state = {
      sessionId: this.config.sessionId,
      mapId: this.config.mapId,
      mode: this.config.mode,
      players: [],
      startedAt: new Date().toISOString(),
      currentRound: 1,
      maxRounds: 1,
      roundTimeRemaining: 0,
    };
    this.stateChangeCallback?.(this.state);
  }

  async stop(): Promise<void> {
    this.started = false;
    this.state = null;
  }

  sendInput(_input: PlayerInput): void {
    if (!this.started) return;
  }

  getState(): SessionState | null {
    return this.state;
  }

  onStateChange(callback: SessionStateChangeCallback): void {
    this.stateChangeCallback = callback;
  }

  emitEvent(event: GameNetworkEvent): void {
    if (!this.started) return;
    this.networkEventCallback?.(event);
  }

  onNetworkEvent(callback: NetworkEventCallback): void {
    this.networkEventCallback = callback;
  }

  isLocal(): boolean {
    return true;
  }

  addLocalPlayer(id: string, name: string, position: Vector3): void {
    if (!this.state) return;

    const player = {
      id,
      name,
      teamId: null,
      position,
      rotationY: 0,
      health: 100,
      maxHealth: 100,
      equippedWeaponId: null,
      score: 0,
      isAlive: true,
    };

    this.state.players.push(player);
    this.stateChangeCallback?.(this.state);
  }

  updateLocalPlayerPosition(id: string, position: Vector3, rotationY: number): void {
    if (!this.state) return;

    const player = this.state.players.find((p) => p.id === id);
    if (player) {
      player.position = position;
      player.rotationY = rotationY;
      this.stateChangeCallback?.(this.state);
    }
  }

  updateLocalPlayerHealth(id: string, health: number): void {
    if (!this.state) return;

    const player = this.state.players.find((p: { id: string }) => p.id === id);
    if (player) {
      player.health = health;
      player.isAlive = health > 0;
      this.stateChangeCallback?.(this.state);
    }
  }
}
