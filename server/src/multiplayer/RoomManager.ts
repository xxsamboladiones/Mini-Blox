import { GameRoom } from "./Room.js";
import type { RoomSummary } from "./types.js";
import { createId } from "../utils/createId.js";

export class RoomManager {
  private readonly rooms = new Map<string, GameRoom>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly maxPlayers: number = 8,
    private readonly emptyRoomTimeout: number = 5 * 60 * 1000
  ) {
    this.startCleanupInterval();
  }

  createRoom(onlineMapId: string, mapId: string): GameRoom {
    const room = new GameRoom(createId("room"), mapId, onlineMapId, this.maxPlayers);
    this.rooms.set(room.roomId, room);
    return room;
  }

  getRoom(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  listRooms(): RoomSummary[] {
    return Array.from(this.rooms.values()).map((room) => ({
      roomId: room.roomId,
      onlineMapId: room.onlineMapId,
      playerCount: room.getPlayerCount(),
      maxPlayers: this.maxPlayers,
      createdAt: room.createdAt,
      lastActivityAt: room.lastActivityAt,
    }));
  }

  deleteRoom(roomId: string): boolean {
    return this.rooms.delete(roomId);
  }

  updateRoomActivity(roomId: string): void {
    this.rooms.get(roomId)?.updateActivity();
  }

  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.rooms.clear();
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.removeExpiredEmptyRooms();
    }, 60 * 1000);
  }

  private removeExpiredEmptyRooms(): void {
    const now = Date.now();

    for (const [roomId, room] of this.rooms.entries()) {
      if (room.getPlayerCount() > 0) {
        continue;
      }

      const lastActivity = new Date(room.lastActivityAt).getTime();
      if (now - lastActivity > this.emptyRoomTimeout) {
        this.rooms.delete(roomId);
      }
    }
  }
}
