import { assertGameMap, type GameMap } from "../shared/types/MapSchema";

export class SceneLoader {
  async loadFromUrl(url: string): Promise<GameMap> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to load map file: ${response.status} ${response.statusText}`);
    }

    return this.loadFromData(await response.json());
  }

  loadFromJson(json: string): GameMap {
    try {
      return this.loadFromData(JSON.parse(json));
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error("Invalid map JSON.");
      }

      throw error;
    }
  }

  loadFromData(data: unknown): GameMap {
    assertGameMap(data);
    return data;
  }
}
