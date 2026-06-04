import type { RoomPlayer, Vector3 } from "./types.js";
import { createId } from "../utils/createId.js";

const MAX_HEALTH = 100;

export class GameRoom {
  private players = new Map<string, RoomPlayer>();
  private readonly maxPlayers: number;
  public readonly createdAt: string;
  public lastActivityAt: string;

  constructor(
    public readonly roomId: string,
    public readonly mapId: string,
    public readonly onlineMapId: string,
    maxPlayers: number = 8
  ) {
    this.maxPlayers = maxPlayers;
    const now = new Date().toISOString();
    this.createdAt = now;
    this.lastActivityAt = now;
  }

  addPlayer(clientId: string, playerName: string, teamId: string | null = null): RoomPlayer | null {
    if (this.players.size >= this.maxPlayers) {
      return null;
    }

    const playerId = createId("player");
    const now = new Date().toISOString();
    const player: RoomPlayer = {
      id: playerId,
      clientId,
      name: playerName,
      teamId,
      position: { x: 0, y: 0, z: 0 },
      rotationY: 0,
      health: MAX_HEALTH,
      maxHealth: MAX_HEALTH,
      equippedWeaponId: null,
      score: 0,
      isAlive: true,
      joinedAt: now,
      lastUpdateAt: now,
    };

    this.players.set(playerId, player);
    this.updateActivity();
    return player;
  }

  removePlayer(playerId: string): boolean {
    const removed = this.players.delete(playerId);
    if (removed) {
      this.updateActivity();
    }
    return removed;
  }

  getPlayer(playerId: string): RoomPlayer | undefined {
    return this.players.get(playerId);
  }

  getPlayerByClientId(clientId: string): RoomPlayer | undefined {
    return Array.from(this.players.values()).find((p) => p.clientId === clientId);
  }

  updatePlayerState(
    playerId: string,
    position: Vector3,
    rotationY: number,
    health: number,
    equippedWeaponId: string | null,
    score: number
  ): RoomPlayer | null {
    const player = this.players.get(playerId);
    if (!player) {
      return null;
    }

    if (!this.isValidPosition(position)) {
      return null;
    }

    if (!this.isValidHealth(health)) {
      return null;
    }

    player.position = position;
    player.rotationY = rotationY;
    player.health = Math.max(0, Math.min(MAX_HEALTH, health));
    player.equippedWeaponId = equippedWeaponId;
    player.score = score;
    player.isAlive = player.health > 0;
    player.lastUpdateAt = new Date().toISOString();

    this.updateActivity();
    return player;
  }

  getAllPlayers(): RoomPlayer[] {
    return Array.from(this.players.values());
  }

  getPlayerCount(): number {
    return this.players.size;
  }

  updateActivity(): void {
    this.lastActivityAt = new Date().toISOString();
  }

  private isValidPosition(position: Vector3): boolean {
    return (
      typeof position.x === "number" &&
      typeof position.y === "number" &&
      typeof position.z === "number" &&
      Number.isFinite(position.x) &&
      Number.isFinite(position.y) &&
      Number.isFinite(position.z)
    );
  }

  private isValidHealth(health: number): boolean {
    return typeof health === "number" && Number.isFinite(health);
  }
}
