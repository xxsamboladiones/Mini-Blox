import { MainMenuScreen } from "./screens/MainMenuScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import type { Screen } from "./AppState";
import { LocalMapMetadataStorage } from "../storage/LocalMapMetadataStorage";
import { LocalProfileStorage } from "../storage/LocalProfileStorage";
import { MapStorage } from "../storage/MapStorage";
import type { MapTemplateId } from "../shared/MapTemplateMetadata";
import { assertGameMap, type GameMap } from "../shared/types/MapSchema";

export class App {
  private activeScreen: Screen | null = null;

  constructor(private readonly root: HTMLElement) {}

  start(): void {
    this.showMainMenu();
  }

  private showMainMenu(): void {
    this.replaceScreen(
      new MainMenuScreen(this.root, {
        onCreateMap: (templateId) => void this.showEditorFromTemplate(templateId),
        onOpenMapList: () => void this.showMapList(),
        onOpenProfile: () => this.showProfile(),
        onContinueLastMap: () => void this.continueLastMap(),
        onContinueLastPlayed: () => {
          const mapId = LocalMapMetadataStorage.getLastPlayedMapId();
          const map = mapId ? MapStorage.getMap(mapId) : null;
          void this.continueLastPlayed(map);
        },
        onImportMap: (file) => void this.importMap(file),
      })
    );
  }

  private async showMapList(): Promise<void> {
    this.showLoading("Carregando catalogo...");
    const { MapListScreen } = await import("./screens/MapListScreen");
    this.replaceScreen(
      new MapListScreen(this.root, {
        onBackToMenu: () => this.showMainMenu(),
        onCreateMap: () => void this.showEditorFromTemplate("empty"),
        onEditMap: (map) => void this.showEditor(map),
        onPlayMap: (map) => void this.showPlay(map),
        onPlayMultiplayer: async (map, roomId, onlineMapId) => {
          await this.showPlayMultiplayer(map, roomId, onlineMapId ?? map.onlineMetadata?.onlineId);
        },
        onCreateMultiplayerRoom: async (map, onlineMapId) => {
          await this.createAndJoinMultiplayerRoom(map, onlineMapId);
        },
      })
    );
  }

  private showProfile(): void {
    this.replaceScreen(
      new ProfileScreen(this.root, {
        onBackToMenu: () => this.showMainMenu(),
      })
    );
  }

  private async showEditor(map: GameMap): Promise<void> {
    this.showLoading("Carregando editor...");
    const { EditorScreen } = await import("./screens/EditorScreen");
    this.replaceScreen(
      new EditorScreen(this.root, map, {
        onBackToMenu: (currentMap) => {
          MapStorage.saveMap(currentMap);
          this.showMainMenu();
        },
        onPlayMap: (currentMap) => {
          MapStorage.saveMap(currentMap);
          void this.showPlay(currentMap);
        },
      })
    );
  }

  private async showPlay(map: GameMap): Promise<void> {
    this.showLoading("Carregando runtime...");
    const { PlayScreen } = await import("./screens/PlayScreen");
    this.replaceScreen(
      new PlayScreen(this.root, map, {
        onBackToMenu: () => this.showMainMenu(),
        onEditMap: (currentMap) => void this.showEditor(currentMap),
      })
    );
  }

  private async showPlayMultiplayer(
    map: GameMap,
    roomId: string,
    onlineMapId?: string
  ): Promise<void> {
    this.showLoading("Entrando na sala...");
    const { PlayScreen } = await import("./screens/PlayScreen");
    this.replaceScreen(
      new PlayScreen(this.root, map, {
        onBackToMenu: () => {
          void this.disconnectMultiplayer();
          this.showMainMenu();
        },
        onEditMap: (currentMap) => void this.showEditor(currentMap),
        mode: "multiplayer",
        roomId,
        onlineMapId,
      })
    );
  }

  private async createAndJoinMultiplayerRoom(
    map: GameMap,
    providedOnlineMapId?: string
  ): Promise<void> {
    const playerName = LocalProfileStorage.getDisplayName();
    const onlineMapId = providedOnlineMapId ?? map.onlineMetadata?.onlineId;

    if (!onlineMapId) {
      throw new Error("Este mapa nao esta publicado online.");
    }

    const { multiplayerService } = await import("../services/MultiplayerService.js");
    const response = await multiplayerService.createRoom(onlineMapId, playerName);
    await this.showPlayMultiplayer(map, response.roomId, onlineMapId);
  }

  private async showEditorFromTemplate(templateId: MapTemplateId = "empty"): Promise<void> {
    this.showLoading("Carregando template...");
    await this.showEditor(await this.createProfileMap(templateId));
  }

  private async continueLastMap(): Promise<void> {
    const map = MapStorage.getLastMap() ?? (await this.createProfileMap("empty"));
    await this.showEditor(map);
  }

  private async continueLastPlayed(map: GameMap | null): Promise<void> {
    if (map) {
      await this.showPlay(map);
      return;
    }

    const fallbackMap = MapStorage.getLastMap() ?? (await this.createProfileMap("empty"));
    await this.showPlay(fallbackMap);
  }

  private async disconnectMultiplayer(): Promise<void> {
    const { multiplayerService } = await import("../services/MultiplayerService.js");
    multiplayerService.disconnect();
  }

  private replaceScreen(screen: Screen): void {
    this.activeScreen?.destroy?.();
    this.activeScreen = screen;
    screen.render();
  }

  private showLoading(label: string): void {
    this.activeScreen?.destroy?.();
    this.activeScreen = null;
    this.root.innerHTML = `
      <main class="menu-screen">
        <section class="menu-platform app-loading-screen" aria-live="polite">
          <div class="menu-identity">
            <div class="menu-brand-mark">MB</div>
            <div>
              <h1>Mini Blox</h1>
              <span>${label}</span>
            </div>
          </div>
        </section>
      </main>
    `;
  }

  private async createProfileMap(templateId: MapTemplateId = "empty"): Promise<GameMap> {
    const { createMapFromTemplate } = await import("../shared/MapTemplates");
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
      void this.showEditor(importedMap);
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
    creatorName: profileName,
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
    updatedAt: now,
  };
}

function createId(prefix: string): string {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
