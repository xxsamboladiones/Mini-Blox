import "dotenv/config";
import { createServer } from "http";
import { createApp } from "./app.js";
import { closeDatabase, getDefaultDatabaseUrl, getDatabase } from "./db/connection.js";
import { migrateDatabase } from "./db/migrate.js";
import { logger } from "./logger.js";
import { MultiplayerServer } from "./multiplayer/MultiplayerServer.js";
import { RoomManager } from "./multiplayer/RoomManager.js";
import { importLegacyMapsFromJson } from "./storage/importLegacyMaps.js";

const PORT = Number(process.env.PORT) || 3001;
const MAX_PLAYERS = Number(process.env.MAX_PLAYERS_PER_ROOM) || 8;
const ROOM_TTL_MINUTES = Number(process.env.ROOM_TTL_MINUTES) || 60;

async function main(): Promise<void> {
  process.env.DATABASE_URL ||= getDefaultDatabaseUrl();
  migrateDatabase();
  importLegacyMapsFromJson();

  const roomManager = new RoomManager(MAX_PLAYERS, ROOM_TTL_MINUTES * 60 * 1000);
  const app = createApp(roomManager);
  const httpServer = createServer(app);
  const multiplayerServer = new MultiplayerServer(httpServer, roomManager);

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    logger.info("shutdown requested", { signal });

    await multiplayerServer.shutdown();
    roomManager.dispose();
    closeDatabase();

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
    logger.info("miniblox server started", {
      port: PORT,
      nodeEnv: process.env.NODE_ENV ?? "development",
      databaseReady: Boolean(getDatabase()),
      websocketUrl: `ws://localhost:${PORT}/ws`,
      healthUrl: `http://localhost:${PORT}/health`,
    });
  });
}

main().catch((error) => {
  logger.error("failed to start server", { error });
  process.exit(1);
});
