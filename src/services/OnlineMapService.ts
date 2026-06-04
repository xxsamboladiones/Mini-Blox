import { LocalClientStorage } from "../storage/LocalClientStorage.js";
import type { GameMap } from "../shared/types/MapSchema.js";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export type OnlineMapSummary = {
  id: string;
  name: string;
  description: string;
  creatorName: string;
  thumbnail: string | null;
  tags: string[];
  theme: string;
  objectCount: number;
  mode: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  playCount: number;
  likeCount: number;
};

export type OnlineMapEntry = {
  id: string;
  ownerClientId: string;
  map: GameMap;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  playCount: number;
  likedBy: string[];
};

export class OnlineServiceError extends Error {
  constructor(
    message: string,
    public readonly isOffline: boolean = false
  ) {
    super(message);
    this.name = "OnlineServiceError";
  }
}

export const OnlineMapService = {
  getApiBaseUrl(): string {
    return API_BASE_URL;
  },

  async listOnlineMaps(): Promise<OnlineMapSummary[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/maps`);

      if (!response.ok) {
        throw new OnlineServiceError(`Failed to list maps: ${response.statusText}`);
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new OnlineServiceError("Backend offline. Cannot list online maps.", true);
      }
      throw new OnlineServiceError(error instanceof Error ? error.message : "Unknown error");
    }
  },

  async getOnlineMap(id: string): Promise<GameMap> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/maps/${id}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new OnlineServiceError("Map not found");
        }
        throw new OnlineServiceError(`Failed to get map: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new OnlineServiceError("Backend offline. Cannot load online map.", true);
      }
      throw error;
    }
  },

  async publishOnlineMap(
    map: GameMap,
    creatorName: string
  ): Promise<{ onlineId: string; summary: OnlineMapSummary }> {
    try {
      const clientId = LocalClientStorage.getClientId();

      const response = await fetch(`${API_BASE_URL}/api/maps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ map, creatorName, clientId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new OnlineServiceError(
          error.error || `Failed to publish map: ${response.statusText}`
        );
      }

      const data = await response.json();
      return { onlineId: data.onlineId, summary: data.map };
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new OnlineServiceError("Backend offline. Cannot publish map online.", true);
      }
      throw error;
    }
  },

  async updateOnlineMap(onlineId: string, map: GameMap): Promise<OnlineMapSummary | null> {
    try {
      const clientId = LocalClientStorage.getClientId();

      const response = await fetch(`${API_BASE_URL}/api/maps/${onlineId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ map, clientId }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 403) {
          throw new OnlineServiceError("You do not have permission to update this map");
        }
        throw new OnlineServiceError(error.error || `Failed to update map: ${response.statusText}`);
      }

      const data = await response.json();
      return data.map || null;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new OnlineServiceError("Backend offline. Cannot update map online.", true);
      }
      throw error;
    }
  },

  async deleteOnlineMap(onlineId: string): Promise<boolean> {
    try {
      const clientId = LocalClientStorage.getClientId();

      const response = await fetch(`${API_BASE_URL}/api/maps/${onlineId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 403) {
          throw new OnlineServiceError("You do not have permission to delete this map");
        }
        throw new OnlineServiceError(error.error || `Failed to delete map: ${response.statusText}`);
      }

      const data = await response.json();
      return data.ok === true;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new OnlineServiceError("Backend offline. Cannot delete map online.", true);
      }
      throw error;
    }
  },

  async registerOnlinePlay(onlineId: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/maps/${onlineId}/play`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new OnlineServiceError(`Failed to register play: ${response.statusText}`);
      }

      const data = await response.json();
      return data.ok === true;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new OnlineServiceError("Backend offline. Cannot register play.", true);
      }
      throw error;
    }
  },

  async toggleOnlineLike(onlineId: string): Promise<{ liked: boolean; likeCount: number }> {
    try {
      const clientId = LocalClientStorage.getClientId();

      const response = await fetch(`${API_BASE_URL}/api/maps/${onlineId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });

      if (!response.ok) {
        throw new OnlineServiceError(`Failed to toggle like: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new OnlineServiceError("Backend offline. Cannot toggle like.", true);
      }
      throw error;
    }
  },

  async downloadOnlineMapAsLocalCopy(onlineId: string): Promise<GameMap> {
    try {
      const onlineMap = await this.getOnlineMap(onlineId);

      const localCopy = structuredClone(onlineMap);
      localCopy.id = this.generateLocalId();
      localCopy.name = `${onlineMap.name} (online)`;

      if (localCopy.onlineMetadata) {
        delete localCopy.onlineMetadata;
      }

      return localCopy;
    } catch (error) {
      throw error;
    }
  },

  generateLocalId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2);
    return `map-${timestamp}-${random}`;
  },
};
