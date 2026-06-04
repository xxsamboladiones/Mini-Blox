import express from "express";
import cors from "cors";
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
import type { RoomManager } from "./multiplayer/RoomManager.js";

export function createApp(roomManager?: RoomManager): express.Express {
  const app = express();

  const corsOrigin = process.env.CORS_ORIGIN;
  app.use(cors(corsOrigin ? { origin: corsOrigin } : undefined));
  app.use(express.json({ limit: "10mb" }));

  app.get("/health", healthRoute);

  app.post("/api/maps", publishMapRoute);
  app.get("/api/maps", listMapsRoute);
  app.get("/api/maps/:id", getMapRoute);
  app.put("/api/maps/:id", updateMapRoute);
  app.delete("/api/maps/:id", deleteMapRoute);
  app.post("/api/maps/:id/play", registerPlayRoute);
  app.post("/api/maps/:id/like", likeMapRoute);

  if (roomManager) {
    app.post("/api/rooms", createRoomRoute(roomManager));
    app.get("/api/rooms", listRoomsRoute(roomManager));
    app.get("/api/rooms/:id", getRoomRoute(roomManager));
  }

  return app;
}
