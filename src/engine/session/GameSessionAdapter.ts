import type {
  GameNetworkEvent,
  NetworkEventCallback,
  PlayerInput,
  SessionState,
  SessionStateChangeCallback,
} from "../../shared/types/MultiplayerSchema.js";

export interface GameSessionAdapter {
  start(): Promise<void>;
  stop(): Promise<void>;
  sendInput(input: PlayerInput): void;
  getState(): SessionState | null;
  onStateChange(callback: SessionStateChangeCallback): void;
  emitEvent(event: GameNetworkEvent): void;
  onNetworkEvent(callback: NetworkEventCallback): void;
  isLocal(): boolean;
}
