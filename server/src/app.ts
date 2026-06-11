import express from "express";
import cors from "cors";
import { migrateDatabase } from "./db/migrate.js";
import { authenticateRequest, optionalAuthenticateRequest } from "./middleware/auth.js";
import { createRateLimit } from "./middleware/rateLimit.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { loginRoute, logoutRoute, meRoute, registerRoute } from "./routes/auth.js";
import { healthRoute } from "./routes/health.js";
import {
  deleteMapRoute,
  getMapRoute,
  likeMapRoute,
  listMapsRoute,
  publishMapRoute,
  registerPlayRoute,
  updateMapRoute,
} from "./routes/maps.js";
import { createRoomRoute, getRoomRoute, listRoomsRoute } from "./routes/rooms.js";
import { importLegacyMapsFromJson } from "./storage/importLegacyMaps.js";
import type { RoomManager } from "./multiplayer/RoomManager.js";

let databaseInitialized = false;

export function createApp(roomManager?: RoomManager): express.Express {
  initializeDatabase();

  const app = express();

  const corsOrigin = process.env.CORS_ORIGIN;
  app.use(cors(createCorsOptions(corsOrigin)));
  app.use(express.json({ limit: "10mb" }));
  app.use(requestLogger);
  app.use(createRateLimit({ keyPrefix: "general" }));

  app.get("/health", healthRoute);

  const authLimiter = createRateLimit({
    keyPrefix: "auth",
    max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 8,
  });
  const writeLimiter = createRateLimit({ keyPrefix: "maps-write", max: 30 });
  const socialLimiter = createRateLimit({ keyPrefix: "maps-social", max: 60 });

  app.post("/api/auth/register", authLimiter, registerRoute);
  app.post("/api/auth/login", authLimiter, loginRoute);
  app.post("/api/auth/logout", authenticateRequest, logoutRoute);
  app.get("/api/auth/me", authenticateRequest, meRoute);

  app.post("/api/maps", writeLimiter, authenticateRequest, publishMapRoute);
  app.get("/api/maps", optionalAuthenticateRequest, listMapsRoute);
  app.get("/api/maps/:id", optionalAuthenticateRequest, getMapRoute);
  app.put("/api/maps/:id", writeLimiter, authenticateRequest, updateMapRoute);
  app.delete("/api/maps/:id", writeLimiter, authenticateRequest, deleteMapRoute);
  app.post("/api/maps/:id/play", socialLimiter, optionalAuthenticateRequest, registerPlayRoute);
  app.post("/api/maps/:id/like", socialLimiter, authenticateRequest, likeMapRoute);

  if (roomManager) {
    app.post("/api/rooms", createRoomRoute(roomManager));
    app.get("/api/rooms", listRoomsRoute(roomManager));
    app.get("/api/rooms/:id", getRoomRoute(roomManager));
  }

  return app;
}

function initializeDatabase(): void {
  if (databaseInitialized) {
    return;
  }

  migrateDatabase();
  importLegacyMapsFromJson();
  databaseInitialized = true;
}

function createCorsOptions(corsOrigin: string | undefined): cors.CorsOptions | undefined {
  if (corsOrigin || process.env.NODE_ENV !== "production") {
    const allowedOrigins = new Set<string>();
    if (corsOrigin) {
      for (const origin of corsOrigin.split(",")) {
        const trimmed = origin.trim();
        if (trimmed) {
          allowedOrigins.add(trimmed);
        }
      }
    }

    if (process.env.NODE_ENV !== "production") {
      allowedOrigins.add("http://localhost:5173");
      allowedOrigins.add("http://127.0.0.1:5173");
    }

    return {
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }

        callback(null, false);
      },
    };
  }

  return { origin: false };
}
