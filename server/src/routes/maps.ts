import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { logger } from "../logger.js";
import { mapRepository } from "../repositories/MapRepository.js";
import { validateOnlineMap } from "../validation/validateOnlineMap.js";
import { createId } from "../utils/createId.js";
import type {
  ErrorResponse,
  LikeMapResponse,
  PublishMapRequest,
  PublishMapResponse,
  UpdateMapRequest,
} from "../types/OnlineMapSchema.js";

export async function publishMapRoute(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    const body = req.body as PublishMapRequest;

    if (!user) {
      res.status(401).json({ ok: false, error: "Authentication required" } as ErrorResponse);
      return;
    }

    if (!body.map) {
      res.status(400).json({ ok: false, error: "Missing required field: map" } as ErrorResponse);
      return;
    }

    const validation = validateOnlineMap(body.map);
    if (!validation.valid) {
      res.status(400).json({ ok: false, error: validation.error } as ErrorResponse);
      return;
    }

    const onlineId = createId("online");
    const now = new Date().toISOString();
    const map = {
      ...body.map,
      creatorName: body.creatorName || user.displayName,
      publishedAt: now,
      updatedAt: now,
      isPublished: true,
    };

    mapRepository.createMap({
      id: onlineId,
      ownerUserId: user.id,
      legacyOwnerClientId: body.clientId ?? null,
      map,
      creatorName: user.displayName,
      now,
    });

    const summary = mapRepository.getMapSummary(onlineId, user.id);
    logger.info("map published", { mapId: onlineId, userId: user.id });

    res.json({
      ok: true,
      onlineId,
      map: summary,
    } as PublishMapResponse);
  } catch (error) {
    logger.error("error publishing map", { error });
    res.status(500).json({ ok: false, error: "Internal server error" } as ErrorResponse);
  }
}

export async function listMapsRoute(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    res.json(mapRepository.listMapSummaries(req.user?.id));
  } catch (error) {
    logger.error("error listing maps", { error });
    res.status(500).json({ ok: false, error: "Internal server error" } as ErrorResponse);
  }
}

export async function getMapRoute(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const mapId = getRouteId(req.params.id);
    if (!mapId) {
      res.status(400).json({ ok: false, error: "Missing map id" } as ErrorResponse);
      return;
    }

    const entry = mapRepository.getMap(mapId);
    if (!entry) {
      res.status(404).json({ ok: false, error: "Map not found" } as ErrorResponse);
      return;
    }

    res.json(entry.map);
  } catch (error) {
    logger.error("error getting map", { error });
    res.status(500).json({ ok: false, error: "Internal server error" } as ErrorResponse);
  }
}

export async function updateMapRoute(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    const mapId = getRouteId(req.params.id);
    const body = req.body as UpdateMapRequest;

    if (!user) {
      res.status(401).json({ ok: false, error: "Authentication required" } as ErrorResponse);
      return;
    }

    if (!mapId) {
      res.status(400).json({ ok: false, error: "Missing map id" } as ErrorResponse);
      return;
    }

    if (!body.map) {
      res.status(400).json({ ok: false, error: "Missing required field: map" } as ErrorResponse);
      return;
    }

    const validation = validateOnlineMap(body.map);
    if (!validation.valid) {
      res.status(400).json({ ok: false, error: validation.error } as ErrorResponse);
      return;
    }

    const entry = mapRepository.getMap(mapId);
    if (!entry) {
      res.status(404).json({ ok: false, error: "Map not found" } as ErrorResponse);
      return;
    }

    if (!canWriteMap(entry.ownerUserId, user.id, entry.legacyOwnerClientId, body.clientId)) {
      res.status(403).json({
        ok: false,
        error: "You do not have permission to update this map",
      } as ErrorResponse);
      return;
    }

    if (!entry.ownerUserId) {
      mapRepository.claimLegacyMap(mapId, user.id);
    }

    const map = {
      ...body.map,
      creatorName: body.map.creatorName || user.displayName,
      isPublished: true,
    };
    const updated = mapRepository.updateMap(mapId, map, user.displayName);
    const summary = updated ? mapRepository.getMapSummary(mapId, user.id) : null;
    logger.info("map updated", { mapId, userId: user.id });

    res.json({ ok: true, map: summary });
  } catch (error) {
    logger.error("error updating map", { error });
    res.status(500).json({ ok: false, error: "Internal server error" } as ErrorResponse);
  }
}

export async function deleteMapRoute(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    const mapId = getRouteId(req.params.id);
    const clientId = getBodyClientId(req.body);

    if (!user) {
      res.status(401).json({ ok: false, error: "Authentication required" } as ErrorResponse);
      return;
    }

    if (!mapId) {
      res.status(400).json({ ok: false, error: "Missing map id" } as ErrorResponse);
      return;
    }

    const entry = mapRepository.getMap(mapId);
    if (!entry) {
      res.status(404).json({ ok: false, error: "Map not found" } as ErrorResponse);
      return;
    }

    if (!canWriteMap(entry.ownerUserId, user.id, entry.legacyOwnerClientId, clientId)) {
      res.status(403).json({
        ok: false,
        error: "You do not have permission to delete this map",
      } as ErrorResponse);
      return;
    }

    mapRepository.deleteMap(mapId);
    logger.info("map deleted", { mapId, userId: user.id });
    res.json({ ok: true });
  } catch (error) {
    logger.error("error deleting map", { error });
    res.status(500).json({ ok: false, error: "Internal server error" } as ErrorResponse);
  }
}

export async function registerPlayRoute(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const mapId = getRouteId(req.params.id);
    if (!mapId) {
      res.status(400).json({ ok: false, error: "Missing map id" } as ErrorResponse);
      return;
    }

    const updated = mapRepository.incrementPlayCount(mapId);
    if (!updated) {
      res.status(404).json({ ok: false, error: "Map not found" } as ErrorResponse);
      return;
    }

    res.json({ ok: true });
  } catch (error) {
    logger.error("error registering play", { error });
    res.status(500).json({ ok: false, error: "Internal server error" } as ErrorResponse);
  }
}

export async function likeMapRoute(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    const mapId = getRouteId(req.params.id);

    if (!user) {
      res.status(401).json({ ok: false, error: "Authentication required" } as ErrorResponse);
      return;
    }

    if (!mapId) {
      res.status(400).json({ ok: false, error: "Missing map id" } as ErrorResponse);
      return;
    }

    try {
      const result = mapRepository.toggleLike(mapId, user.id);
      res.json(result as LikeMapResponse);
    } catch (error) {
      if (error instanceof Error && error.message === "Map not found") {
        res.status(404).json({ ok: false, error: "Map not found" } as ErrorResponse);
        return;
      }
      throw error;
    }
  } catch (error) {
    logger.error("error toggling like", { error });
    res.status(500).json({ ok: false, error: "Internal server error" } as ErrorResponse);
  }
}

function canWriteMap(
  ownerUserId: string | null,
  userId: string,
  legacyOwnerClientId: string | null,
  requestClientId: string | null
): boolean {
  if (ownerUserId) {
    return ownerUserId === userId;
  }

  return Boolean(legacyOwnerClientId && requestClientId && legacyOwnerClientId === requestClientId);
}

function getRouteId(id: string | string[] | undefined): string | null {
  const value = Array.isArray(id) ? id[0] : id;
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function getBodyClientId(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }

  const value = (body as { clientId?: unknown }).clientId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
