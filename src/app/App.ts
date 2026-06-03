import { EditorScreen } from "./screens/EditorScreen";
import { MainMenuScreen } from "./screens/MainMenuScreen";
import { MapListScreen } from "./screens/MapListScreen";
import { PlayScreen } from "./screens/PlayScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import type { Screen } from "./AppState";
import { LocalMapMetadataStorage } from "../storage/LocalMapMetadataStorage";
import { LocalProfileStorage } from "../storage/LocalProfileStorage";
import { MapStorage } from "../storage/MapStorage";
import { createMapFromTemplate, type MapTemplateId } from "../shared/MapTemplates";
import { assertGameMap, type GameMap } from "../shared/types/MapSchema";

export class App {
  private activeScreen: Screen | null = null;

  constructor(private readonly root: HTMLElement) {}

  start(): void {
    this.showMainMenu();
  }

  private showMainMenu(): void {
    this.replaceScreen(new MainMenuScreen(this.root, {
      onCreateMap: (templateId) => this.showEditor(this.createProfileMap(templateId)),
      onOpenMapList: () => this.showMapList(),
      onOpenProfile: () => this.showProfile(),
      onContinueLastMap: () => this.showEditor(MapStorage.getLastMap() ?? this.createProfileMap("empty")),
      onContinueLastPlayed: () => {
        const mapId = LocalMapMetadataStorage.getLastPlayedMapId();
        const map = mapId ? MapStorage.getMap(mapId) : null;
        this.showPlay(map ?? MapStorage.getLastMap() ?? this.createProfileMap("empty"));
      },
      onImportMap: (file) => void this.importMap(file)
    }));
  }

  private showMapList(): void {
    this.replaceScreen(new MapListScreen(this.root, {
      onBackToMenu: () => this.showMainMenu(),
      onCreateMap: () => this.showEditor(this.createProfileMap("empty")),
      onEditMap: (map) => this.showEditor(map),
      onPlayMap: (map) => this.showPlay(map)
    }));
  }

  private showProfile(): void {
    this.replaceScreen(new ProfileScreen(this.root, {
      onBackToMenu: () => this.showMainMenu()
    }));
  }

  private showEditor(map: GameMap): void {
    this.replaceScreen(new EditorScreen(this.root, map, {
      onBackToMenu: (currentMap) => {
        MapStorage.saveMap(currentMap);
        this.showMainMenu();
      },
      onPlayMap: (currentMap) => {
        MapStorage.saveMap(currentMap);
        this.showPlay(currentMap);
      }
    }));
  }

  private showPlay(map: GameMap): void {
    this.replaceScreen(new PlayScreen(this.root, map, {
      onBackToMenu: () => this.showMainMenu(),
      onEditMap: (currentMap) => this.showEditor(currentMap)
    }));
  }

  private replaceScreen(screen: Screen): void {
    this.activeScreen?.destroy?.();
    this.activeScreen = screen;
    screen.render();
  }

  private createProfileMap(templateId: MapTemplateId = "empty"): GameMap {
    return applyProfileCreatorName(createMapFromTemplate(templateId));
  }

  private async importMap(file: File): Promise<void> {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      assertGameMap(parsed);
      const importedMap = prepareImportedMap(parsed);
      if (!importedMap) {
        return;
      }
      MapStorage.saveMap(importedMap);
      this.showEditor(importedMap);
    } catch {
      window.alert("Nao foi possivel importar. Escolha um JSON valido de GameMap do Mini Blox.");
    }
  }
}

function applyProfileCreatorName(map: GameMap): GameMap {
  const profileName = LocalProfileStorage.getDisplayName();

  if (map.creatorName && map.creatorName.trim() !== "Criador local") {
    return map;
  }

  return {
    ...map,
    creatorName: profileName
  };
}

function prepareImportedMap(map: GameMap): GameMap | null {
  const importedMap = structuredClone(map);

  if (!MapStorage.hasMap(importedMap.id)) {
    return importedMap;
  }

  const choice = window.prompt(
    `Ja existe um mapa com o ID "${importedMap.id}". Digite "substituir", "copia" ou "cancelar".`,
    "copia"
  );

  if (!choice || choice.toLowerCase().trim() === "cancelar") {
    return null;
  }

  if (choice.toLowerCase().trim() === "substituir") {
    return importedMap;
  }

  const now = new Date().toISOString();
  return {
    ...importedMap,
    id: createId("map"),
    name: `${importedMap.name} (importado)`,
    isPublished: false,
    publishedAt: undefined,
    createdAt: now,
    updatedAt: now
  };
}

function createId(prefix: string): string {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
