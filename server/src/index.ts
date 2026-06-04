import "dotenv/config";
import { createServer } from "http";
import { createApp } from "./app.js";
import { MultiplayerServer } from "./multiplayer/MultiplayerServer.js";
import { RoomManager } from "./multiplayer/RoomManager.js";
import { onlineMapStorage } from "./storage/OnlineMapStorage.js";

const PORT = Number(process.env.PORT) || 3001;
const MAX_PLAYERS = Number(process.env.MAX_PLAYERS_PER_ROOM) || 8;

async function main(): Promise<void> {
  await onlineMapStorage.load();

  const roomManager = new RoomManager(MAX_PLAYERS);
  const app = createApp(roomManager);
  const httpServer = createServer(app);
  const multiplayerServer = new MultiplayerServer(httpServer, roomManager);

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    // eslint-disable-next-line no-console
    console.log(`Received ${signal}, shutting down MiniBlox server...`);

    await multiplayerServer.shutdown();
    roomManager.dispose();

    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT").finally(() => {
      process.exit(0);
    });
  });

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM").finally(() => {
      process.exit(0);
    });
  });

  httpServer.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`MiniBlox server running on port ${PORT}`);
    // eslint-disable-next-line no-console
    console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
    // eslint-disable-next-line no-console
    console.log(`Health check: http://localhost:${PORT}/health`);
  });
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server:", error);
  process.exit(1);
});
