import { WebSocket, WebSocketServer } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";
import type { GameRoom } from "./Room.js";
import type { RoomManager } from "./RoomManager.js";
import type {
  ChatMessage,
  EnemyNetState,
  EnemyPositionUpdate,
  MultiplayerClientMessage,
  MultiplayerServerMessage,
  PlayerCombatState,
  RoomPlayer,
  Vector3,
  WorldEvent,
} from "./types.js";

type ClientConnection = {
  ws: WebSocket;
  roomId: string;
  clientId: string;
  playerId: string | null;
};

export class MultiplayerServer {
  private readonly wss: WebSocketServer;
  private readonly connections = new Map<WebSocket, ClientConnection>();
  private readonly closingSockets = new WeakSet<WebSocket>();
  private isShuttingDown = false;
  private shutdownPromise: Promise<void> | null = null;

  constructor(
    httpServer: Server,
    private readonly roomManager: RoomManager
  ) {
    this.wss = new WebSocketServer({ server: httpServer, path: "/ws" });
    this.setupWebSocketServer();
  }

  private setupWebSocketServer(): void {
    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });

    this.wss.on("error", (error: Error) => {
      // eslint-disable-next-line no-console
      console.error("WebSocket server error:", error);
    });
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    if (this.isShuttingDown) {
      this.sendError(ws, "Server is shutting down");
      this.closeSocket(ws, 1012, "Server is shutting down");
      return;
    }

    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const roomId = url.searchParams.get("roomId");
    const clientId = url.searchParams.get("clientId");

    if (!roomId || !clientId) {
      this.sendError(ws, "Missing roomId or clientId");
      this.closeSocket(ws, 1008, "Missing roomId or clientId");
      return;
    }

    const room = this.roomManager.getRoom(roomId);
    if (!room) {
      this.sendError(ws, "Room not found");
      this.closeSocket(ws, 1008, "Room not found");
      return;
    }

    const connection: ClientConnection = {
      ws,
      roomId,
      clientId,
      playerId: null,
    };

    this.connections.set(ws, connection);

    ws.on("message", (data: Buffer) => {
      this.handleMessage(ws, data);
    });

    ws.on("close", () => {
      this.handleDisconnection(ws);
    });

    ws.on("error", (error: Error) => {
      // eslint-disable-next-line no-console
      console.error("WebSocket connection error:", error);
      this.handleDisconnection(ws);
    });
  }

  private handleMessage(ws: WebSocket, data: Buffer): void {
    const connection = this.connections.get(ws);
    if (!connection) return;

    try {
      const message: MultiplayerClientMessage = JSON.parse(data.toString());
      this.processMessage(connection, message);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to parse message:", error);
    }
  }

  private processMessage(connection: ClientConnection, message: MultiplayerClientMessage): void {
    const room = this.roomManager.getRoom(connection.roomId);
    if (!room) {
      this.sendError(connection.ws, "Room not found");
      return;
    }

    switch (message.type) {
      case "join":
        this.handleJoin(connection, room, message.playerName);
        break;
      case "leave":
        this.handleLeave(connection, room);
        break;
      case "playerState":
        this.handlePlayerState(connection, room, message);
        break;
      case "worldEvent":
        this.handleWorldEvent(connection, room, message.event);
        break;
      case "enemyHit":
        this.handleEnemyHit(connection, room, message.enemyObjectId, message.damage);
        break;
      case "enemyStateRequest":
        this.sendEnemyState(connection.ws, room);
        break;
      case "enemyPositionUpdate":
        this.handleEnemyPositionUpdate(connection, room, message.enemies);
        break;
      case "playerAttack":
        this.handlePlayerAttack(connection, room, message);
        break;
      case "playerDamaged":
        this.handleReportedPlayerDamage(connection, room, message.targetPlayerId, message.damage);
        break;
      case "chatMessage":
        this.handleChatMessage(connection, room, message.text);
        break;
      case "ping":
        this.sendPong(connection.ws);
        break;
    }
  }

  private handleJoin(connection: ClientConnection, room: GameRoom, playerName: string): void {
    if (connection.playerId) {
      return;
    }

    const player = room.addPlayer(connection.clientId, playerName);
    if (!player) {
      this.sendError(connection.ws, "Room is full");
      this.closeSocket(connection.ws, 1008, "Room is full");
      return;
    }

    connection.playerId = player.id;
    this.roomManager.updateRoomActivity(connection.roomId);

    this.sendWelcome(connection.ws, connection.roomId, player.id, room.hostPlayerId);
    this.broadcastPlayerJoined(room, player);
    this.sendRoomState(connection.ws, room);
    this.sendWorldState(connection.ws, room);
    this.sendEnemyState(connection.ws, room);
    this.sendCombatState(connection.ws, room);
    this.sendChatHistory(connection.ws, room);
    this.broadcastChatMessage(room, room.addSystemMessage(`${player.name} entrou na sala.`));
  }

  private handleLeave(connection: ClientConnection, room: GameRoom): void {
    if (!connection.playerId) return;

    const playerId = connection.playerId;
    const player = room.getPlayer(playerId);
    const result = room.removePlayer(playerId);
    this.broadcastPlayerLeft(room, playerId);
    if (result.hostChanged) {
      this.broadcastHostChanged(room);
    }
    if (player) {
      this.broadcastChatMessage(room, room.addSystemMessage(`${player.name} saiu da sala.`));
    }
    this.roomManager.updateRoomActivity(connection.roomId);

    connection.playerId = null;
  }

  private handlePlayerState(
    connection: ClientConnection,
    room: GameRoom,
    message: MultiplayerClientMessage & { type: "playerState" }
  ): void {
    if (!connection.playerId) return;

    const updatedPlayer = room.updatePlayerState(
      connection.playerId,
      message.position,
      message.rotationY,
      message.health,
      message.equippedWeaponId,
      message.score
    );

    if (updatedPlayer) {
      this.broadcastPlayerUpdated(room, connection.playerId, updatedPlayer);
      this.roomManager.updateRoomActivity(connection.roomId);
    }
  }

  private handleWorldEvent(connection: ClientConnection, room: GameRoom, event: WorldEvent): void {
    if (!connection.playerId) return;

    const normalizedEvent = room.applyWorldEvent(event);

    if (!normalizedEvent) {
      return;
    }

    this.broadcastWorldEvent(room, normalizedEvent);
    this.roomManager.updateRoomActivity(connection.roomId);
  }

  private handleEnemyHit(
    connection: ClientConnection,
    room: GameRoom,
    enemyObjectId: string,
    damage: number
  ): void {
    if (!connection.playerId) return;

    const result = room.applyEnemyHit(connection.playerId, enemyObjectId, damage);
    if (!result) {
      return;
    }

    this.broadcastEnemyUpdated(room, result.enemy);

    if (result.defeated) {
      this.broadcastEnemyDefeated(room, result.enemy.objectId, connection.playerId);
      this.broadcastChatMessage(
        room,
        room.addSystemMessage(`Inimigo ${result.enemy.objectId} derrotado.`)
      );
    }

    this.roomManager.updateRoomActivity(connection.roomId);
  }

  private handleEnemyPositionUpdate(
    connection: ClientConnection,
    room: GameRoom,
    enemies: EnemyPositionUpdate[]
  ): void {
    if (!connection.playerId) return;

    const updatedEnemies = room.updateEnemyPositions(connection.playerId, enemies);
    for (const enemy of updatedEnemies) {
      this.broadcastEnemyUpdated(room, enemy, connection.playerId);
    }

    if (updatedEnemies.length > 0) {
      this.roomManager.updateRoomActivity(connection.roomId);
    }
  }

  private handlePlayerAttack(
    connection: ClientConnection,
    room: GameRoom,
    message: MultiplayerClientMessage & { type: "playerAttack" }
  ): void {
    if (!connection.playerId) return;

    const result = room.applyPlayerAttack(connection.playerId, message);
    if (!result) {
      return;
    }

    this.broadcastPlayerDamaged(room, result);

    if (result.defeated) {
      this.broadcastPlayerDefeated(room, result.targetPlayer.id, result.attackerPlayerId);
      this.broadcastChatMessage(
        room,
        room.addSystemMessage(`${result.targetPlayer.name} foi derrotado.`)
      );
      this.scheduleRespawn(room, result.targetPlayer.id);
    }

    this.roomManager.updateRoomActivity(connection.roomId);
  }

  private handleReportedPlayerDamage(
    connection: ClientConnection,
    room: GameRoom,
    targetPlayerId: string | undefined,
    damage: number
  ): void {
    if (!connection.playerId) return;

    const result = room.applyReportedPlayerDamage(connection.playerId, targetPlayerId, damage);
    if (!result) {
      return;
    }

    this.broadcastPlayerDamaged(room, result);

    if (result.defeated) {
      this.broadcastPlayerDefeated(room, result.targetPlayer.id);
      this.scheduleRespawn(room, result.targetPlayer.id);
    }

    this.roomManager.updateRoomActivity(connection.roomId);
  }

  private handleChatMessage(connection: ClientConnection, room: GameRoom, text: string): void {
    if (!connection.playerId) return;

    const message = room.addPlayerChatMessage(connection.playerId, text);
    if (!message) {
      return;
    }

    this.broadcastChatMessage(room, message);
    this.roomManager.updateRoomActivity(connection.roomId);
  }

  private handleDisconnection(ws: WebSocket): void {
    const connection = this.connections.get(ws);
    if (!connection) return;

    if (connection.playerId) {
      const playerId = connection.playerId;
      connection.playerId = null;
      const room = this.roomManager.getRoom(connection.roomId);
      if (room) {
        const player = room.getPlayer(playerId);
        const result = room.removePlayer(playerId);
        this.broadcastPlayerLeft(room, playerId);
        if (result.hostChanged) {
          this.broadcastHostChanged(room);
        }
        if (player) {
          this.broadcastChatMessage(room, room.addSystemMessage(`${player.name} saiu da sala.`));
        }
        this.roomManager.updateRoomActivity(connection.roomId);
      }
    }

    this.connections.delete(ws);
  }

  private sendWelcome(
    ws: WebSocket,
    roomId: string,
    playerId: string,
    hostPlayerId: string | null
  ): void {
    const message: MultiplayerServerMessage = {
      type: "welcome",
      roomId,
      playerId,
      hostPlayerId,
    };
    this.send(ws, message);
  }

  private sendRoomState(ws: WebSocket, room: GameRoom): void {
    const players: Record<string, RoomPlayer> = {};
    for (const player of room.getAllPlayers()) {
      players[player.id] = player;
    }

    const message: MultiplayerServerMessage = {
      type: "roomState",
      players,
      hostPlayerId: room.hostPlayerId,
      playerCombatStates: room.getPlayerCombatStates(),
    };
    this.send(ws, message);
  }

  private sendWorldState(ws: WebSocket, room: GameRoom): void {
    const message: MultiplayerServerMessage = {
      type: "worldState",
      state: room.getSharedState(),
    };
    this.send(ws, message);
  }

  private sendEnemyState(ws: WebSocket, room: GameRoom): void {
    const message: MultiplayerServerMessage = {
      type: "enemyState",
      enemies: room.getEnemyStates(),
    };
    this.send(ws, message);
  }

  private sendCombatState(ws: WebSocket, room: GameRoom): void {
    const message: MultiplayerServerMessage = {
      type: "combatState",
      players: room.getPlayerCombatStates(),
    };
    this.send(ws, message);
  }

  private sendChatHistory(ws: WebSocket, room: GameRoom): void {
    const message: MultiplayerServerMessage = {
      type: "chatHistory",
      messages: room.getChatMessages(),
    };
    this.send(ws, message);
  }

  private broadcastPlayerJoined(room: GameRoom, player: RoomPlayer): void {
    const message: MultiplayerServerMessage = {
      type: "playerJoined",
      player,
    };
    this.broadcastToRoom(room, message, player.id);
  }

  private broadcastPlayerLeft(room: GameRoom, playerId: string): void {
    const message: MultiplayerServerMessage = {
      type: "playerLeft",
      playerId,
    };
    this.broadcastToRoom(room, message);
  }

  private broadcastPlayerUpdated(room: GameRoom, playerId: string, player: RoomPlayer): void {
    const message: MultiplayerServerMessage = {
      type: "playerUpdated",
      playerId,
      player,
    };
    this.broadcastToRoom(room, message, playerId);
  }

  private broadcastWorldEvent(room: GameRoom, event: WorldEvent): void {
    const message: MultiplayerServerMessage = {
      type: "worldEvent",
      event,
    };
    this.broadcastToRoom(room, message);
  }

  private broadcastEnemyUpdated(
    room: GameRoom,
    enemy: EnemyNetState,
    excludePlayerId?: string
  ): void {
    const message: MultiplayerServerMessage = {
      type: "enemyUpdated",
      enemy,
    };
    this.broadcastToRoom(room, message, excludePlayerId);
  }

  private broadcastEnemyDefeated(
    room: GameRoom,
    enemyObjectId: string,
    defeatedByPlayerId?: string
  ): void {
    const message: MultiplayerServerMessage = {
      type: "enemyDefeated",
      enemyObjectId,
      defeatedByPlayerId,
    };
    this.broadcastToRoom(room, message);
  }

  private broadcastPlayerDamaged(
    room: GameRoom,
    result: {
      targetPlayer: RoomPlayer;
      combatState: PlayerCombatState;
      damage: number;
      attackerPlayerId?: string;
    }
  ): void {
    const message: MultiplayerServerMessage = {
      type: "playerDamaged",
      targetPlayerId: result.targetPlayer.id,
      attackerPlayerId: result.attackerPlayerId,
      damage: result.damage,
      health: result.combatState.health,
    };
    this.broadcastToRoom(room, message);
  }

  private broadcastPlayerDefeated(
    room: GameRoom,
    playerId: string,
    defeatedByPlayerId?: string
  ): void {
    const message: MultiplayerServerMessage = {
      type: "playerDefeated",
      playerId,
      defeatedByPlayerId,
    };
    this.broadcastToRoom(room, message);
  }

  private broadcastPlayerRespawned(
    room: GameRoom,
    playerId: string,
    health: number,
    position: Vector3
  ): void {
    const message: MultiplayerServerMessage = {
      type: "playerRespawned",
      playerId,
      health,
      position,
    };
    this.broadcastToRoom(room, message);
  }

  private broadcastChatMessage(room: GameRoom, messageData: ChatMessage): void {
    const message: MultiplayerServerMessage = {
      type: "chatMessage",
      message: messageData,
    };
    this.broadcastToRoom(room, message);
  }

  private broadcastHostChanged(room: GameRoom): void {
    const message: MultiplayerServerMessage = {
      type: "hostChanged",
      hostPlayerId: room.hostPlayerId,
    };
    this.broadcastToRoom(room, message);
  }

  private scheduleRespawn(room: GameRoom, playerId: string): void {
    setTimeout(() => {
      const liveRoom = this.roomManager.getRoom(room.roomId);
      if (!liveRoom) {
        return;
      }

      const respawned = liveRoom.respawnPlayer(playerId);
      if (!respawned) {
        return;
      }

      this.broadcastPlayerRespawned(
        liveRoom,
        playerId,
        respawned.combatState.health,
        respawned.player.position
      );
      this.broadcastPlayerUpdated(liveRoom, playerId, respawned.player);
    }, room.getRespawnDelayMs());
  }

  private broadcastToRoom(
    room: GameRoom,
    message: MultiplayerServerMessage,
    excludePlayerId?: string
  ): void {
    const messageStr = JSON.stringify(message);

    for (const [ws, connection] of this.connections.entries()) {
      if (connection.roomId !== room.roomId) continue;
      if (excludePlayerId && connection.playerId === excludePlayerId) continue;

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    }
  }

  private sendPong(ws: WebSocket): void {
    const message: MultiplayerServerMessage = {
      type: "pong",
    };
    this.send(ws, message);
  }

  private sendError(ws: WebSocket, message: string): void {
    const errorMessage: MultiplayerServerMessage = {
      type: "error",
      message,
    };
    this.send(ws, errorMessage);
  }

  private send(ws: WebSocket, message: MultiplayerServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to send WebSocket message:", error);
      }
    }
  }

  shutdown(timeoutMs = 2500): Promise<void> {
    if (this.shutdownPromise) {
      return this.shutdownPromise;
    }

    this.shutdownPromise = this.performShutdown(timeoutMs);
    return this.shutdownPromise;
  }

  private async performShutdown(timeoutMs: number): Promise<void> {
    this.isShuttingDown = true;

    const sockets = new Set<WebSocket>([...this.connections.keys(), ...this.wss.clients]);
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        this.sendError(ws, "Server shutting down");
      }
      this.closeSocket(ws, 1001, "Server shutting down");
    }

    await Promise.race([
      Promise.all([...sockets].map((ws) => this.waitForSocketClose(ws))).then(() => undefined),
      delay(timeoutMs),
    ]);

    for (const ws of sockets) {
      if (ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
        ws.terminate();
      }
    }

    await new Promise<void>((resolve, reject) => {
      this.wss.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });

    this.connections.clear();
  }

  private closeSocket(ws: WebSocket, code: number, reason: string): void {
    if (
      this.closingSockets.has(ws) ||
      ws.readyState === WebSocket.CLOSING ||
      ws.readyState === WebSocket.CLOSED
    ) {
      return;
    }

    this.closingSockets.add(ws);
    ws.close(code, reason);
  }

  private waitForSocketClose(ws: WebSocket): Promise<void> {
    if (ws.readyState === WebSocket.CLOSED) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      ws.once("close", () => resolve());
    });
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
