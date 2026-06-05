import { OnlineMapService, OnlineServiceError } from "../services/OnlineMapService.js";
import { LocalProfileStorage } from "../storage/LocalProfileStorage.js";
import type { GameMap } from "../shared/types/MapSchema";

export type EditorOnlinePublishResult = {
  patch: Pick<GameMap, "isPublished" | "publishedAt" | "onlineMetadata">;
  successMessage: string;
};

export class EditorOnlinePublishController {
  async publish(map: GameMap): Promise<EditorOnlinePublishResult> {
    const onlineId = map.onlineMetadata?.onlineId;

    if (onlineId) {
      return this.updateExisting(map, onlineId);
    }

    return this.publishNew(map);
  }

  getErrorMessage(error: unknown, fallbackMessage: string): string {
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
      successMessage: "Mapa publicado online com sucesso!",
    };
  }

  private async updateExisting(
    map: GameMap,
    onlineId: string
  ): Promise<EditorOnlinePublishResult> {
    const summary = await OnlineMapService.updateOnlineMap(onlineId, map);

    if (!summary) {
      return {
        patch: {
          isPublished: true,
          publishedAt: map.publishedAt,
          onlineMetadata: map.onlineMetadata,
        },
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
      successMessage: "Mapa atualizado online com sucesso!",
    };
  }
}
