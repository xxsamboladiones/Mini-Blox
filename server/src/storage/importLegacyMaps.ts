import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { logger } from "../logger.js";
import { mapRepository } from "../repositories/MapRepository.js";
import type { OnlineMapStorageData } from "../types/OnlineMapSchema.js";

const LEGACY_MAPS_FILE = path.join(process.cwd(), "data", "maps.json");

export function importLegacyMapsFromJson(): void {
  if (!existsSync(LEGACY_MAPS_FILE)) {
    return;
  }

  try {
    const parsed = JSON.parse(readFileSync(LEGACY_MAPS_FILE, "utf-8")) as OnlineMapStorageData;
    if (!parsed || !Array.isArray(parsed.maps)) {
      logger.warn("legacy maps json ignored: invalid shape");
      return;
    }

    const imported = mapRepository.importLegacyMaps(
      parsed.maps.map((entry) => ({
        id: entry.id,
        ownerClientId: entry.ownerClientId,
        map: entry.map,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        publishedAt: entry.publishedAt,
        playCount: entry.playCount,
        likeCount: entry.likedBy.length,
      }))
    );

    if (imported > 0) {
      logger.info("legacy maps imported", { imported });
    }
  } catch (error) {
    logger.error("legacy map import failed", { error });
  }
}
