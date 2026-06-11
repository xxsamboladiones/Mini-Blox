import { OnlineMapService, OnlineServiceError } from "../services/OnlineMapService.js";
import { normalizeGameMap } from "../shared/normalizeGameMap.js";
import { LocalProfileStorage } from "../storage/LocalProfileStorage.js";
import type { GameMap } from "../shared/types/MapSchema";
import {
  EditorMapValidationError,
  formatMapValidationIssues,
  getBlockingValidationIssues,
  validateEditorMap,
} from "./EditorMapValidator.js";

export type EditorOnlinePublishResult = {
  patch: Pick<GameMap, "isPublished" | "publishedAt" | "onlineMetadata">;
  map: GameMap;
  successMessage: string;
};

export class EditorOnlinePublishController {
  async publish(map: GameMap): Promise<EditorOnlinePublishResult> {
    const issues = validateEditorMap(map);
    const blocking = getBlockingValidationIssues(issues);

    if (blocking.length > 0) {
      throw new EditorMapValidationError(blocking);
    }

    const normalizedMap = normalizeGameMap(map);
    const onlineId = normalizedMap.onlineMetadata?.onlineId;

    if (onlineId) {
      return this.updateExisting(normalizedMap, onlineId);
    }

    return this.publishNew(normalizedMap);
  }

  getErrorMessage(error: unknown, fallbackMessage: string): string {
    if (error instanceof EditorMapValidationError) {
      return formatMapValidationIssues(error.issues);
    }

    if (error instanceof OnlineServiceError && error.isOffline) {
      return "Servidor online indisponivel. O mapa continua salvo localmente.";
    }

    return error instanceof Error ? error.message : fallbackMessage;
  }

  private async publishNew(map: GameMap): Promise<EditorOnlinePublishResult> {
    const creatorName = LocalProfileStorage.getDisplayName();
    const { onlineId, summary } = await OnlineMapService.publishOnlineMap(map, creatorName);

    return {
      patch: {
        isPublished: true,
        publishedAt: summary.publishedAt,
        onlineMetadata: {
          onlineId,
          publishedAt: summary.publishedAt,
          updatedAt: summary.updatedAt,
        },
      },
      map,
      successMessage: "Mapa publicado online com sucesso!",
    };
  }

  private async updateExisting(map: GameMap, onlineId: string): Promise<EditorOnlinePublishResult> {
    const summary = await OnlineMapService.updateOnlineMap(onlineId, map);

    if (!summary) {
      return {
        patch: {
          isPublished: true,
          publishedAt: map.publishedAt,
          onlineMetadata: map.onlineMetadata,
        },
        map,
        successMessage: "Mapa atualizado online com sucesso!",
      };
    }

    return {
      patch: {
        isPublished: true,
        publishedAt: summary.publishedAt,
        onlineMetadata: {
          onlineId,
          publishedAt: summary.publishedAt,
          updatedAt: summary.updatedAt,
        },
      },
      map,
      successMessage: "Mapa atualizado online com sucesso!",
    };
  }
}
