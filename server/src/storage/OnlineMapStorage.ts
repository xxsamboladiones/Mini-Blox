import * as fs from "fs";
import * as path from "path";
import type {
  OnlineMapEntry,
  OnlineMapStorageData,
  OnlineMapSummary,
} from "../types/OnlineMapSchema.js";

const DATA_DIR = path.join(process.cwd(), "data");
const MAPS_FILE = path.join(DATA_DIR, "maps.json");
const MAPS_TEMP_FILE = path.join(DATA_DIR, "maps.tmp.json");

const MAX_MAPS = 10000;

export class OnlineMapStorage {
  private data: OnlineMapStorageData = { maps: [] };
  private loaded = false;

  async load(): Promise<void> {
    if (this.loaded) {
      return;
    }

    if (!fs.existsSync(MAPS_FILE)) {
      await this.ensureDataDir();
      await this.save();
      this.loaded = true;
      return;
    }

    try {
      const raw = fs.readFileSync(MAPS_FILE, "utf-8");
      const parsed: unknown = JSON.parse(raw);

      if (this.isValidStorageData(parsed)) {
        this.data = parsed;
      } else {
        // eslint-disable-next-line no-console
        console.warn("Invalid maps.json format, starting fresh");
        this.data = { maps: [] };
        await this.save();
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error loading maps.json:", error);
      this.data = { maps: [] };
      await this.save();
    }

    this.loaded = true;
  }

  async save(): Promise<void> {
    await this.ensureDataDir();

    try {
      fs.writeFileSync(MAPS_TEMP_FILE, JSON.stringify(this.data, null, 2), "utf-8");
      fs.renameSync(MAPS_TEMP_FILE, MAPS_FILE);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error saving maps.json:", error);
      throw error;
    }
  }

  async addMap(entry: OnlineMapEntry): Promise<void> {
    if (this.data.maps.length >= MAX_MAPS) {
      throw new Error("Maximum number of maps reached");
    }

    this.data.maps.unshift(entry);
    await this.save();
  }

  async updateMap(id: string, entry: Partial<OnlineMapEntry>): Promise<boolean> {
    const index = this.data.maps.findIndex((m) => m.id === id);

    if (index === -1) {
      return false;
    }

    this.data.maps[index] = {
      ...this.data.maps[index],
      ...entry,
      updatedAt: new Date().toISOString(),
    };
    await this.save();
    return true;
  }

  async deleteMap(id: string): Promise<boolean> {
    const initialLength = this.data.maps.length;
    this.data.maps = this.data.maps.filter((m) => m.id !== id);

    if (this.data.maps.length === initialLength) {
      return false;
    }

    await this.save();
    return true;
  }

  getMap(id: string): OnlineMapEntry | null {
    return this.data.maps.find((m) => m.id === id) ?? null;
  }

  getAllMaps(): OnlineMapEntry[] {
    return [...this.data.maps];
  }

  getMapSummaries(): OnlineMapSummary[] {
    return this.data.maps.map((entry) => this.toSummary(entry));
  }

  async incrementPlayCount(id: string): Promise<boolean> {
    const entry = this.getMap(id);

    if (!entry) {
      return false;
    }

    entry.playCount += 1;
    await this.save();
    return true;
  }

  async toggleLike(id: string, clientId: string): Promise<{ liked: boolean; likeCount: number }> {
    const entry = this.getMap(id);

    if (!entry) {
      throw new Error("Map not found");
    }

    const likeIndex = entry.likedBy.indexOf(clientId);
    let liked: boolean;

    if (likeIndex === -1) {
      entry.likedBy.push(clientId);
      liked = true;
    } else {
      entry.likedBy.splice(likeIndex, 1);
      liked = false;
    }

    await this.save();
    return { liked, likeCount: entry.likedBy.length };
  }

  private toSummary(entry: OnlineMapEntry): OnlineMapSummary {
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

  private isValidStorageData(value: unknown): value is OnlineMapStorageData {
    if (typeof value !== "object" || value === null) {
      return false;
    }

    const data = value as Record<string, unknown>;

    if (!Array.isArray(data.maps)) {
      return false;
    }

    return true;
  }

  private async ensureDataDir(): Promise<void> {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(MAPS_FILE)) {
      fs.writeFileSync(MAPS_FILE, JSON.stringify({ maps: [] }, null, 2), "utf-8");
    }
  }
}

export const onlineMapStorage = new OnlineMapStorage();
