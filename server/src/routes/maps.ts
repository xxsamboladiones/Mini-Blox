import type { Request, Response } from "express";
import { onlineMapStorage } from "../storage/OnlineMapStorage.js";
import { validateOnlineMap } from "../validation/validateOnlineMap.js";
import { createId } from "../utils/createId.js";
import type {
  ErrorResponse,
  LikeMapRequest,
  LikeMapResponse,
  OnlineMapSummary,
  PublishMapRequest,
  PublishMapResponse,
  UpdateMapRequest,
} from "../types/OnlineMapSchema.js";

export async function publishMapRoute(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as PublishMapRequest;

    if (!body.map || !body.creatorName || !body.clientId) {
      res
        .status(400)
        .json({
          ok: false,
          error: "Missing required fields: map, creatorName, clientId",
        } as ErrorResponse);
      return;
    }

    const validation = validateOnlineMap(body.map);
    if (!validation.valid) {
      res.status(400).json({ ok: false, error: validation.error } as ErrorResponse);
      return;
    }

    await onlineMapStorage.load();

    const onlineId = createId("online");
    const now = new Date().toISOString();

    const entry = {
      id: onlineId,
      ownerClientId: body.clientId,
      map: body.map,
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
      playCount: 0,
      likedBy: [],
    };

    await onlineMapStorage.addMap(entry);

    const summary = toSummary(entry);

    res.json({
      ok: true,
      onlineId,
      map: summary,
    } as PublishMapResponse);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error publishing map:", error);
    res.status(500).json({ ok: false, error: "Internal server error" } as ErrorResponse);
  }
}

export async function listMapsRoute(_req: Request, res: Response): Promise<void> {
  try {
    await onlineMapStorage.load();
    const summaries = onlineMapStorage.getMapSummaries();
    res.json(summaries);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error listing maps:", error);
    res.status(500).json({ ok: false, error: "Internal server error" } as ErrorResponse);
  }
}

export async function getMapRoute(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ ok: false, error: "Missing map id" } as ErrorResponse);
      return;
    }

    const mapId = Array.isArray(id) ? id[0] : id;

    await onlineMapStorage.load();
    const entry = onlineMapStorage.getMap(mapId);

    if (!entry) {
      res.status(404).json({ ok: false, error: "Map not found" } as ErrorResponse);
      return;
    }

    res.json(entry.map);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error getting map:", error);
    res.status(500).json({ ok: false, error: "Internal server error" } as ErrorResponse);
  }
}

export async function updateMapRoute(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const body = req.body as UpdateMapRequest;

    if (!id) {
      res.status(400).json({ ok: false, error: "Missing map id" } as ErrorResponse);
      return;
    }

    const mapId = Array.isArray(id) ? id[0] : id;

    if (!body.map || !body.clientId) {
      res
        .status(400)
        .json({ ok: false, error: "Missing required fields: map, clientId" } as ErrorResponse);
      return;
    }

    const validation = validateOnlineMap(body.map);
    if (!validation.valid) {
      res.status(400).json({ ok: false, error: validation.error } as ErrorResponse);
      return;
    }

    await onlineMapStorage.load();
    const entry = onlineMapStorage.getMap(mapId);

    if (!entry) {
      res.status(404).json({ ok: false, error: "Map not found" } as ErrorResponse);
      return;
    }

    if (entry.ownerClientId !== body.clientId) {
      res
        .status(403)
        .json({
          ok: false,
          error: "You do not have permission to update this map",
        } as ErrorResponse);
      return;
    }

    const updated = await onlineMapStorage.updateMap(mapId, { map: body.map });

    if (!updated) {
      res.status(404).json({ ok: false, error: "Map not found" } as ErrorResponse);
      return;
    }

    const updatedEntry = onlineMapStorage.getMap(mapId);
    const summary = updatedEntry ? toSummary(updatedEntry) : null;

    res.json({ ok: true, map: summary });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error updating map:", error);
    res.status(500).json({ ok: false, error: "Internal server error" } as ErrorResponse);
  }
}

export async function deleteMapRoute(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { clientId } = req.body;

    if (!id) {
      res.status(400).json({ ok: false, error: "Missing map id" } as ErrorResponse);
      return;
    }

    if (!clientId) {
      res.status(400).json({ ok: false, error: "Missing clientId" } as ErrorResponse);
      return;
    }

    const mapId = Array.isArray(id) ? id[0] : id;

    await onlineMapStorage.load();
    const entry = onlineMapStorage.getMap(mapId);

    if (!entry) {
      res.status(404).json({ ok: false, error: "Map not found" } as ErrorResponse);
      return;
    }

    if (entry.ownerClientId !== clientId) {
      res
        .status(403)
        .json({
          ok: false,
          error: "You do not have permission to delete this map",
        } as ErrorResponse);
      return;
    }

    const deleted = await onlineMapStorage.deleteMap(mapId);

    if (!deleted) {
      res.status(404).json({ ok: false, error: "Map not found" } as ErrorResponse);
      return;
    }

    res.json({ ok: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error deleting map:", error);
    res.status(500).json({ ok: false, error: "Internal server error" } as ErrorResponse);
  }
}

export async function registerPlayRoute(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ ok: false, error: "Missing map id" } as ErrorResponse);
      return;
    }

    const mapId = Array.isArray(id) ? id[0] : id;

    await onlineMapStorage.load();
    const updated = await onlineMapStorage.incrementPlayCount(mapId);

    if (!updated) {
      res.status(404).json({ ok: false, error: "Map not found" } as ErrorResponse);
      return;
    }

    res.json({ ok: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error registering play:", error);
    res.status(500).json({ ok: false, error: "Internal server error" } as ErrorResponse);
  }
}

export async function likeMapRoute(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const body = req.body as LikeMapRequest;

    if (!id) {
      res.status(400).json({ ok: false, error: "Missing map id" } as ErrorResponse);
      return;
    }

    if (!body.clientId) {
      res.status(400).json({ ok: false, error: "Missing clientId" } as ErrorResponse);
      return;
    }

    const mapId = Array.isArray(id) ? id[0] : id;

    await onlineMapStorage.load();
    const result = await onlineMapStorage.toggleLike(mapId, body.clientId);

    res.json(result as LikeMapResponse);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error toggling like:", error);
    res.status(500).json({ ok: false, error: "Internal server error" } as ErrorResponse);
  }
}

function toSummary(entry: {
  id: string;
  map: any;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  playCount: number;
  likedBy: string[];
}): OnlineMapSummary {
  const { map } = entry;
  return {
    id: entry.id,
    name: map.name,
    description: map.description ?? "",
    creatorName: map.creatorName ?? "Unknown",
    thumbnail: map.thumbnail ?? null,
    tags: map.tags ?? [],
    theme: map.visualSettings?.theme ?? "classic",
    objectCount: map.objects.length,
    mode: map.gameModeSettings?.mode ?? "freeplay",
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    publishedAt: entry.publishedAt,
    playCount: entry.playCount,
    likeCount: entry.likedBy.length,
  };
}
