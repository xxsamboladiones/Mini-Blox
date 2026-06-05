import type { GameSessionAdapter } from "./session/GameSessionAdapter";
import type {
  EnemyPositionUpdate,
  PlayerAttackPayload,
  PlayerAttackVisualPayload,
  PlayerHealRequestPayload,
  SharedWorldState,
  WorldEvent,
} from "../shared/types/MultiplayerSchema";
import type { Vector3 } from "../shared/types/ObjectSchema";

export type PlayerStateSessionAdapter = GameSessionAdapter & {
  sendPlayerState: (
    position: Vector3,
    rotationY: number,
    health: number,
    equippedWeaponId: string | null,
    score: number
  ) => void;
};

export type WorldStateSessionAdapter = GameSessionAdapter & {
  sendWorldEvent: (event: WorldEvent) => void;
  onWorldEvent: (callback: (event: WorldEvent) => void) => void;
  onWorldState: (callback: (state: SharedWorldState) => void) => void;
};

export type MultiplayerMechanicsSessionAdapter = WorldStateSessionAdapter & {
  sendEnemyHit: (enemyObjectId: string, damage: number, weaponId?: string) => void;
  sendEnemyStateRequest: () => void;
  sendEnemyPositionUpdate: (enemies: EnemyPositionUpdate[]) => void;
  sendPlayerAttack: (payload: PlayerAttackPayload) => void;
  sendPlayerAttackVisual: (payload: PlayerAttackVisualPayload) => void;
  sendPlayerHealRequest: (payload: PlayerHealRequestPayload) => void;
  sendPlayerDamageReport: (
    damage: number,
    source: "enemy" | "hazard" | "logic",
    targetPlayerId?: string
  ) => void;
  sendChatMessage: (text: string) => void;
  getLocalPlayerId: () => string | null;
  getHostPlayerId: () => string | null;
  isHost: () => boolean;
};

export class RuntimeNetworkController {
  constructor(private readonly sessionAdapter: GameSessionAdapter | undefined) {}

  canSyncWorldState(): boolean {
    return canSyncWorldState(this.sessionAdapter);
  }

  canUseMultiplayerMechanics(): boolean {
    return canUseMultiplayerMechanics(this.sessionAdapter);
  }

  sendPlayerState(
    position: Vector3,
    rotationY: number,
    health: number,
    equippedWeaponId: string | null,
    score: number
  ): void {
    if (canSendPlayerState(this.sessionAdapter)) {
      this.sessionAdapter.sendPlayerState(position, rotationY, health, equippedWeaponId, score);
    }
  }

  sendWorldEvent(event: WorldEvent): void {
    if (canSyncWorldState(this.sessionAdapter)) {
      this.sessionAdapter.sendWorldEvent(event);
    }
  }

  sendEnemyHit(enemyObjectId: string, damage: number, weaponId?: string): void {
    if (canUseMultiplayerMechanics(this.sessionAdapter)) {
      this.sessionAdapter.sendEnemyHit(enemyObjectId, damage, weaponId);
    }
  }

  sendEnemyStateRequest(): void {
    if (canUseMultiplayerMechanics(this.sessionAdapter)) {
      this.sessionAdapter.sendEnemyStateRequest();
    }
  }

  sendEnemyPositionUpdate(enemies: EnemyPositionUpdate[]): void {
    if (canUseMultiplayerMechanics(this.sessionAdapter)) {
      this.sessionAdapter.sendEnemyPositionUpdate(enemies);
    }
  }

  sendPlayerAttack(payload: PlayerAttackPayload): void {
    if (canUseMultiplayerMechanics(this.sessionAdapter)) {
      this.sessionAdapter.sendPlayerAttack(payload);
    }
  }

  sendPlayerAttackVisual(payload: PlayerAttackVisualPayload): void {
    if (canUseMultiplayerMechanics(this.sessionAdapter)) {
      this.sessionAdapter.sendPlayerAttackVisual(payload);
    }
  }

  sendPlayerHealRequest(payload: PlayerHealRequestPayload): void {
    if (canUseMultiplayerMechanics(this.sessionAdapter)) {
      this.sessionAdapter.sendPlayerHealRequest(payload);
    }
  }

  sendPlayerDamageReport(damage: number, source: "enemy" | "hazard" | "logic"): void {
    if (canUseMultiplayerMechanics(this.sessionAdapter)) {
      this.sessionAdapter.sendPlayerDamageReport(damage, source);
    }
  }

  sendChatMessage(text: string): void {
    if (canUseMultiplayerMechanics(this.sessionAdapter)) {
      this.sessionAdapter.sendChatMessage(text);
    }
  }

  getLocalPlayerId(): string | null {
    return canUseMultiplayerMechanics(this.sessionAdapter)
      ? this.sessionAdapter.getLocalPlayerId()
      : null;
  }

  getHostPlayerId(): string | null {
    return canUseMultiplayerMechanics(this.sessionAdapter)
      ? this.sessionAdapter.getHostPlayerId()
      : null;
  }

  isHost(): boolean {
    return canUseMultiplayerMechanics(this.sessionAdapter) && this.sessionAdapter.isHost();
  }
}

export function canSendPlayerState(
  sessionAdapter: GameSessionAdapter | undefined
): sessionAdapter is PlayerStateSessionAdapter {
  return sessionAdapter !== undefined && "sendPlayerState" in sessionAdapter;
}

export function canSyncWorldState(
  sessionAdapter: GameSessionAdapter | undefined
): sessionAdapter is WorldStateSessionAdapter {
  return (
    sessionAdapter !== undefined &&
    "sendWorldEvent" in sessionAdapter &&
    "onWorldEvent" in sessionAdapter &&
    "onWorldState" in sessionAdapter
  );
}

export function canUseMultiplayerMechanics(
  sessionAdapter: GameSessionAdapter | undefined
): sessionAdapter is MultiplayerMechanicsSessionAdapter {
  return (
    canSyncWorldState(sessionAdapter) &&
    "sendEnemyHit" in sessionAdapter &&
    "sendEnemyPositionUpdate" in sessionAdapter &&
    "sendEnemyStateRequest" in sessionAdapter &&
    "sendPlayerAttack" in sessionAdapter &&
    "sendPlayerAttackVisual" in sessionAdapter &&
    "sendPlayerHealRequest" in sessionAdapter &&
    "sendPlayerDamageReport" in sessionAdapter &&
    "sendChatMessage" in sessionAdapter &&
    "getLocalPlayerId" in sessionAdapter &&
    "getHostPlayerId" in sessionAdapter &&
    "isHost" in sessionAdapter
  );
}
