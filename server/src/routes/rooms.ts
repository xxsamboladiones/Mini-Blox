import type { Request, Response } from "express";
import type { CreateRoomRequest, CreateRoomResponse } from "../multiplayer/types.js";
import type { RoomManager } from "../multiplayer/RoomManager.js";
import { createRoomMapIndex } from "../multiplayer/RoomMapIndex.js";
import { onlineMapStorage } from "../storage/OnlineMapStorage.js";

export function createRoomRoute(roomManager: RoomManager) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const body: CreateRoomRequest = req.body;

      if (!body.onlineMapId || !body.clientId || !body.playerName) {
        res.status(400).json({ ok: false, error: "Missing required fields" });
        return;
      }

      await onlineMapStorage.load();
      const onlineMap = onlineMapStorage.getMap(body.onlineMapId);

      if (!onlineMap) {
        res.status(404).json({ ok: false, error: "Online map not found" });
        return;
      }

      const mapIndex = createRoomMapIndex(onlineMap.map);
      const room = roomManager.createRoom(body.onlineMapId, onlineMap.map.id, mapIndex);

      const response: CreateRoomResponse = {
        ok: true,
        roomId: room.roomId,
        websocketUrl: buildWebSocketUrl(req, room.roomId, body.clientId),
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({ ok: false, error: "Failed to create room" });
    }
  };
}

export function listRoomsRoute(roomManager: RoomManager) {
  return async (_req: Request, res: Response): Promise<void> => {
    try {
      const rooms = roomManager.listRooms();
      res.json({ ok: true, rooms });
    } catch (error) {
      res.status(500).json({ ok: false, error: "Failed to list rooms" });
    }
  };
}

export function getRoomRoute(roomManager: RoomManager) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const roomId = Array.isArray(id) ? id[0] : id;
      const room = roomManager.getRoom(roomId);

      if (!room) {
        res.status(404).json({ ok: false, error: "Room not found" });
        return;
      }

      const players = room.getAllPlayers();
      res.json({
        ok: true,
        roomId: room.roomId,
        onlineMapId: room.onlineMapId,
        playerCount: players.length,
        hostPlayerId: room.hostPlayerId,
        players: players.map((p) => ({
          id: p.id,
          name: p.name,
          teamId: p.teamId,
          health: p.health,
          score: p.score,
          isAlive: p.isAlive,
        })),
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: "Failed to get room" });
    }
  };
}

function buildWebSocketUrl(req: Request, roomId: string, clientId: string): string {
  const protocol = req.protocol === "https" ? "wss" : "ws";
  const host = req.get("host") ?? `localhost:${process.env.PORT || 3001}`;
  const params = new URLSearchParams({ roomId, clientId });
  return `${protocol}://${host}/ws?${params.toString()}`;
}
