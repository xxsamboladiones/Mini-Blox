import { createIcons, icons } from "lucide";
import { ObjectPanel } from "./ObjectPanel";
import { ObjectOutliner } from "./ObjectOutliner";
import { PropertiesPanel } from "./PropertiesPanel";
import { AssetPanel } from "./AssetPanel";
import { LogicPanel } from "./LogicPanel";
import { ObjectivesPanel } from "./ObjectivesPanel";
import { GameModePanel } from "./GameModePanel";
import { SaveMapButton } from "./SaveMapButton";
import { EditorScene } from "./EditorScene";
import { ToolManager, type EditorTool } from "./ToolManager";
import { GameRuntime } from "../engine/GameRuntime";
import { AMBIENT_MUSIC_LABELS, resolveAudioSettings } from "../shared/AudioSettings";
import { createMapFromTemplate } from "../shared/MapTemplates";
import {
  getThemeVisualSettings,
  MAP_THEME_LABELS,
  resolveVisualSettings,
} from "../shared/VisualSettings";
import {
  assertGameMap,
  type AmbientMusic,
  type AudioSettings,
  type GameMap,
  type VisualSettings,
  type VisualTheme,
} from "../shared/types/MapSchema";
import type { BuiltInObjectType } from "../shared/types/ObjectSchema";
import { MapStorage } from "../storage/MapStorage";
import { OnlineMapService, OnlineServiceError } from "../services/OnlineMapService.js";
import { LocalProfileStorage } from "../storage/LocalProfileStorage.js";

type EditorAppOptions = {
  initialMap?: GameMap;
  onBackToMenu?: (map: GameMap) => void;
  onPlayMap?: (map: GameMap) => void;
};

export class EditorApp {
  private readonly toolManager = new ToolManager();
  private editorScene: EditorScene | null = null;
  private propertiesPanel: PropertiesPanel | null = null;
  private assetPanel: AssetPanel | null = null;
  private logicPanel: LogicPanel | null = null;
  private objectivesPanel: ObjectivesPanel | null = null;
  private gameModePanel: GameModePanel | null = null;
  private objectOutliner: ObjectOutliner | null = null;
  private saveButtons: SaveMapButton | null = null;
  private testRuntime: GameRuntime | null = null;
  private currentMap: GameMap = createDefaultMap();
  private testing = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly options: EditorAppOptions = {}
  ) {}

  start(): void {
    this.currentMap = structuredClone(
      this.options.initialMap ?? MapStorage.getLastMap() ?? createDefaultMap()
    );
    this.renderShell();
    void this.initialize();
  }

  destroy(): void {
    window.removeEventListener("keydown", this.handleKeyboardShortcut);
    this.testRuntime?.dispose();
    this.testRuntime = null;
    this.editorScene?.dispose();
    this.editorScene = null;
    this.root.replaceChildren();
  }

  private async initialize(): Promise<void> {
    const viewport = this.getElement("scene-root");
    const objectPanelRoot = this.getElement("object-panel");
    const outlinerRoot = this.getElement("outliner-panel");
    const gameModePanelRoot = this.getElement("game-mode-panel");
    const objectivesPanelRoot = this.getElement("objectives-panel");
    const logicPanelRoot = this.getElement("logic-panel");
    const assetPanelRoot = this.getElement("asset-panel");
    const propertiesPanelRoot = this.getElement("properties-panel");
    const topActions = this.getElement("top-actions");

    this.editorScene = new EditorScene(viewport, this.currentMap, {
      onSelectionChange: (mapObject) => {
        this.propertiesPanel?.setObject(mapObject);
        this.objectOutliner?.setSelectedId(mapObject?.id ?? null);
      },
      onMapChange: (map) => this.handleMapChange(map),
      onModeChange: (mode) => this.handleModeChange(mode),
      onToast: (message) => this.showToast(message),
    });

    const objectPanel = new ObjectPanel(objectPanelRoot, (type) => this.addObject(type));
    objectPanel.render();

    this.assetPanel = new AssetPanel(assetPanelRoot, (file) => this.importModel(file));
    this.assetPanel.setAssets(this.editorScene.getAssets());

    this.objectOutliner = new ObjectOutliner(outlinerRoot, {
      onSelectObject: (objectId) => this.editorScene?.selectObjectById(objectId),
      onFocusObject: (objectId) => {
        if (this.editorScene?.focusObjectById(objectId)) {
          this.showToast("Camera centralizada no objeto.");
        }
      },
      onToggleVisibility: (objectId) => this.toggleObjectVisibility(objectId),
    });

    this.logicPanel = new LogicPanel(logicPanelRoot, {
      onChange: (logic) => this.editorScene?.updateLogic(logic),
      onDebugChange: (logicDebug) => this.editorScene?.updateMapInfo({ logicDebug }),
    });
    this.logicPanel.setMap(this.currentMap);

    this.objectivesPanel = new ObjectivesPanel(objectivesPanelRoot, {
      onChange: (objectives) => this.editorScene?.updateMapInfo({ objectives }),
      onGameplayChange: (gameplaySettings) => this.editorScene?.updateMapInfo({ gameplaySettings }),
    });
    this.objectivesPanel.setMap(this.currentMap);

    this.gameModePanel = new GameModePanel(gameModePanelRoot, {
      onGameModeChange: (gameModeSettings) => this.editorScene?.updateMapInfo({ gameModeSettings }),
      onTeamsChange: (teams) => this.editorScene?.updateMapInfo({ teams }),
    });
    this.gameModePanel.setMap(this.currentMap);

    this.propertiesPanel = new PropertiesPanel(
      propertiesPanelRoot,
      (patch) => this.editorScene?.updateSelectedObject(patch),
      () => this.focusSelectedObject(),
      () => void this.duplicateSelectedObject(),
      () => this.deleteSelectedObject()
    );
    this.propertiesPanel.render();

    this.saveButtons = new SaveMapButton(topActions, {
      onTest: () => this.toggleTestMode(),
      onSave: () => this.saveMap(),
      onPublish: () => this.publishMap(),
      onExport: () => this.exportMap(),
      onImport: () => this.openImportDialog(),
      onMenu: () => this.backToMenu(),
    });
    this.saveButtons.setMap(this.currentMap);
    this.saveButtons.render();

    this.bindToolbar();
    this.bindSnapControls();
    this.bindMapInputs();
    this.bindEnvironmentInputs();
    this.bindAudioInputs();
    this.bindImportInput();
    window.addEventListener("keydown", this.handleKeyboardShortcut);
    this.updateStats(this.currentMap);
    await this.editorScene.start();
    this.refreshOutliner();
    this.toolManager.setTool("translate");
    createIcons({ icons });
  }

  private renderShell(): void {
    this.root.innerHTML = `
      <div class="app-shell">
        <header class="topbar">
          <div class="brand">
            <div class="brand-mark">MB</div>
            <div>
              <strong>Mini Blox</strong>
              <span>Editor</span>
            </div>
          </div>

          <label class="map-name">
            <span>Mapa</span>
            <input id="map-name-input" type="text" value="${escapeAttribute(this.currentMap.name)}" />
          </label>

          <div class="tool-strip" role="toolbar" aria-label="Ferramentas">
            ${this.renderToolButton("select", "mouse-pointer-2", "Selecionar")}
            ${this.renderToolButton("translate", "move-3d", "Mover")}
            ${this.renderToolButton("rotate", "rotate-3d", "Girar")}
            ${this.renderToolButton("scale", "scaling", "Escalar")}
          </div>

          <div class="editor-options">
            <label class="snap-toggle">
              <input id="snap-enabled" type="checkbox" />
              <span>Snap</span>
            </label>
            <label class="snap-size">
              <span>Grade</span>
              <select id="snap-size">
                <option value="0.25">0.25</option>
                <option value="0.5" selected>0.5</option>
                <option value="1">1</option>
                <option value="2">2</option>
              </select>
            </label>
          </div>

          <div id="top-actions" class="top-actions"></div>
        </header>

        <div class="workspace">
          <aside class="side-panel left-panel">
            <section id="map-meta-panel">
              ${this.renderMapMetadata()}
            </section>
            <section id="environment-panel">
              ${this.renderEnvironmentPanel()}
            </section>
            <section id="audio-panel">
              ${this.renderAudioPanel()}
            </section>
            <section id="object-panel"></section>
            <section id="outliner-panel"></section>
            <section id="game-mode-panel"></section>
            <section id="objectives-panel"></section>
            <section id="logic-panel"></section>
            <section id="asset-panel"></section>
          </aside>

          <main class="viewport-shell">
            <div class="viewport-status">
              <span id="mode-badge" class="status-badge">Editando</span>
              <span id="map-stats" class="status-badge muted"></span>
            </div>
            <div id="scene-root" class="scene-root"></div>
          </main>

          <aside id="properties-panel" class="side-panel right-panel"></aside>
        </div>

        <input id="map-import-input" class="sr-only" type="file" accept=".json,application/json" />
        <div id="toast" class="toast" role="status" aria-live="polite"></div>
      </div>
    `;
  }

  private renderToolButton(tool: EditorTool, icon: string, label: string): string {
    return `
      <button class="tool-button" type="button" data-tool="${tool}" title="${label}" aria-label="${label}">
        <i data-lucide="${icon}"></i>
      </button>
    `;
  }

  private renderMapMetadata(): string {
    return `
      <div class="panel-heading">
        <h2>Mapa</h2>
        <span id="publish-status" class="map-status ${this.currentMap.isPublished ? "published" : "draft"}">
          ${this.currentMap.isPublished ? "Publicado" : "Rascunho"}
        </span>
      </div>
      <label class="field">
        <span>Descricao</span>
        <textarea id="map-description-input" rows="3">${escapeHtml(this.currentMap.description ?? "")}</textarea>
      </label>
      <label class="field">
        <span>Criador</span>
        <input id="map-creator-input" type="text" value="${escapeAttribute(this.currentMap.creatorName ?? "")}" />
      </label>
      <label class="field">
        <span>Tags</span>
        <input id="map-tags-input" type="text" value="${escapeAttribute((this.currentMap.tags ?? []).join(", "))}" placeholder="obby, facil, moedas" />
      </label>
      <div class="thumbnail-tools">
        <div id="map-thumbnail-preview" class="thumbnail-preview">
          ${
            this.currentMap.thumbnail
              ? `
            <img src="${escapeAttribute(this.currentMap.thumbnail)}" alt="Thumbnail do mapa" />
          `
              : `
            <div class="thumbnail-placeholder">
              <i data-lucide="image"></i>
              <span>Sem capa</span>
            </div>
          `
          }
        </div>
        <button class="wide-action" type="button" data-capture-thumbnail>
          <i data-lucide="camera"></i>
          <span>Capturar thumbnail</span>
        </button>
      </div>
    `;
  }

  private renderEnvironmentPanel(): string {
    const settings = resolveVisualSettings(this.currentMap.visualSettings);
    const themeOptions = Object.entries(MAP_THEME_LABELS)
      .map(
        ([value, label]) => `
        <option value="${value}" ${settings.theme === value ? "selected" : ""}>${label}</option>
      `
      )
      .join("");

    return `
      <div class="panel-heading">
        <h2>Ambiente</h2>
      </div>
      <label class="field">
        <span>Tema</span>
        <select id="map-theme-input">
          ${themeOptions}
        </select>
      </label>
      <div class="environment-grid">
        <label class="field">
          <span>Ceu</span>
          <input id="sky-color-input" type="color" value="${settings.skyColor}" />
        </label>
        <label class="field">
          <span>Chao</span>
          <input id="ground-color-input" type="color" value="${settings.groundColor}" />
        </label>
      </div>
      <label class="field checkbox-field">
        <input id="fog-enabled-input" type="checkbox" ${settings.fogEnabled ? "checked" : ""} />
        <span>Neblina</span>
      </label>
      <div class="environment-grid">
        <label class="field">
          <span>Cor neblina</span>
          <input id="fog-color-input" type="color" value="${settings.fogColor}" />
        </label>
        <label class="field">
          <span>Fog near</span>
          <input id="fog-near-input" type="number" min="0" step="1" value="${settings.fogNear}" />
        </label>
        <label class="field">
          <span>Fog far</span>
          <input id="fog-far-input" type="number" min="1" step="1" value="${settings.fogFar}" />
        </label>
      </div>
      <div class="environment-grid">
        <label class="field">
          <span>Luz amb.</span>
          <input id="ambient-light-input" type="number" min="0" max="5" step="0.1" value="${settings.ambientLightIntensity}" />
        </label>
        <label class="field">
          <span>Sol</span>
          <input id="sun-light-input" type="number" min="0" max="5" step="0.1" value="${settings.sunLightIntensity}" />
        </label>
      </div>
    `;
  }

  private renderAudioPanel(): string {
    const settings = resolveAudioSettings(this.currentMap.audioSettings);
    const musicOptions = Object.entries(AMBIENT_MUSIC_LABELS)
      .map(
        ([value, label]) => `
        <option value="${value}" ${settings.ambientMusic === value ? "selected" : ""}>${label}</option>
      `
      )
      .join("");

    return `
      <div class="panel-heading">
        <h2>Audio</h2>
      </div>
      ${this.renderVolumeSlider("master-volume-input", "Volume geral", settings.masterVolume)}
      ${this.renderVolumeSlider("sfx-volume-input", "Efeitos", settings.sfxVolume)}
      ${this.renderVolumeSlider("music-volume-input", "Musica", settings.musicVolume)}
      <label class="field">
        <span>Musica ambiente</span>
        <select id="ambient-music-input">
          ${musicOptions}
        </select>
      </label>
      <label class="field checkbox-field">
        <input id="audio-muted-input" type="checkbox" ${settings.muted ? "checked" : ""} />
        <span>Mutar audio do mapa</span>
      </label>
    `;
  }

  private renderVolumeSlider(id: string, label: string, value: number): string {
    const percent = Math.round(value * 100);

    return `
      <label class="field audio-field">
        <span>${label}</span>
        <div class="audio-range-row">
          <input id="${id}" type="range" min="0" max="100" step="1" value="${percent}" />
          <output id="${id}-value">${percent}%</output>
        </div>
      </label>
    `;
  }

  private bindToolbar(): void {
    const buttons = [...this.root.querySelectorAll<HTMLButtonElement>("[data-tool]")];

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        this.toolManager.setTool(button.dataset.tool as EditorTool);
      });
    });

    this.toolManager.onChange((tool) => {
      buttons.forEach((button) => {
        button.classList.toggle("active", button.dataset.tool === tool);
      });
      this.editorScene?.setTool(tool);
    });
  }

  private bindSnapControls(): void {
    const enabledInput = this.root.querySelector<HTMLInputElement>("#snap-enabled");
    const sizeInput = this.root.querySelector<HTMLSelectElement>("#snap-size");
    const apply = (): void => {
      this.editorScene?.setSnapOptions({
        enabled: Boolean(enabledInput?.checked),
        size: Number(sizeInput?.value ?? 0.5),
      });
    };

    enabledInput?.addEventListener("change", apply);
    sizeInput?.addEventListener("change", apply);
    apply();
  }

  private bindMapInputs(): void {
    const inputs = [
      this.root.querySelector<HTMLInputElement>("#map-name-input"),
      this.root.querySelector<HTMLTextAreaElement>("#map-description-input"),
      this.root.querySelector<HTMLInputElement>("#map-creator-input"),
      this.root.querySelector<HTMLInputElement>("#map-tags-input"),
    ].filter((input): input is HTMLInputElement | HTMLTextAreaElement => Boolean(input));

    const apply = (): void => {
      const patch = this.readMetadataInputs();
      Object.assign(this.currentMap, patch);
      this.editorScene?.updateMapInfo(patch);
      this.updatePublishStatus(this.currentMap);
    };

    inputs.forEach((input) => input.addEventListener("input", apply));
    this.root
      .querySelector<HTMLButtonElement>("[data-capture-thumbnail]")
      ?.addEventListener("click", () => this.captureThumbnail());
  }

  private bindEnvironmentInputs(): void {
    const themeInput = this.root.querySelector<HTMLSelectElement>("#map-theme-input");
    const inputs = [
      this.root.querySelector<HTMLInputElement>("#sky-color-input"),
      this.root.querySelector<HTMLInputElement>("#ground-color-input"),
      this.root.querySelector<HTMLInputElement>("#fog-enabled-input"),
      this.root.querySelector<HTMLInputElement>("#fog-color-input"),
      this.root.querySelector<HTMLInputElement>("#fog-near-input"),
      this.root.querySelector<HTMLInputElement>("#fog-far-input"),
      this.root.querySelector<HTMLInputElement>("#ambient-light-input"),
      this.root.querySelector<HTMLInputElement>("#sun-light-input"),
    ].filter((input): input is HTMLInputElement => Boolean(input));

    themeInput?.addEventListener("change", () => {
      const theme = getVisualTheme(themeInput.value);
      const settings = getThemeVisualSettings(theme);
      this.currentMap.visualSettings = settings;
      this.updateEnvironmentInputs(settings);
      this.editorScene?.updateMapInfo({ visualSettings: settings });
    });

    const apply = (): void => {
      const settings = this.readEnvironmentInputs();
      this.currentMap.visualSettings = settings;
      this.editorScene?.updateMapInfo({ visualSettings: settings });
    };

    inputs.forEach((input) => {
      input.addEventListener("input", apply);
      input.addEventListener("change", apply);
    });
  }

  private bindAudioInputs(): void {
    const inputs = [
      this.root.querySelector<HTMLInputElement>("#master-volume-input"),
      this.root.querySelector<HTMLInputElement>("#sfx-volume-input"),
      this.root.querySelector<HTMLInputElement>("#music-volume-input"),
      this.root.querySelector<HTMLSelectElement>("#ambient-music-input"),
      this.root.querySelector<HTMLInputElement>("#audio-muted-input"),
    ].filter((input): input is HTMLInputElement | HTMLSelectElement => Boolean(input));

    const apply = (): void => {
      const settings = this.readAudioInputs();
      this.currentMap.audioSettings = settings;
      this.updateAudioOutputLabels(settings);
      this.editorScene?.updateMapInfo({ audioSettings: settings });
    };

    inputs.forEach((input) => {
      input.addEventListener("input", apply);
      input.addEventListener("change", apply);
    });
    this.updateAudioOutputLabels(this.currentMap.audioSettings);
  }

  private bindImportInput(): void {
    const input = this.root.querySelector<HTMLInputElement>("#map-import-input");
    input?.addEventListener("change", () => {
      const file = input.files?.[0];

      if (file) {
        void this.importMap(file);
      }

      input.value = "";
    });
  }

  private async addObject(type: BuiltInObjectType): Promise<void> {
    const object = await this.editorScene?.addObject(type);

    if (object) {
      this.showToast(`${object.name ?? "Objeto"} criado.`);
    }
  }

  private async importModel(file: File): Promise<void> {
    await this.editorScene?.importModel(file);
    this.assetPanel?.setAssets(this.editorScene?.getAssets() ?? []);
    this.showToast("Modelo importado.");
  }

  private toggleTestMode(): void {
    if (!this.editorScene) {
      return;
    }

    if (this.testing) {
      this.stopRuntimeTest();
    } else {
      void this.startRuntimeTest();
    }
  }

  private captureThumbnail(): void {
    if (this.testing) {
      this.stopRuntimeTest();
    }

    const thumbnail = this.editorScene?.captureThumbnail();

    if (!thumbnail) {
      this.showToast("Nao foi possivel capturar a thumbnail.");
      return;
    }

    const map = this.getCurrentSnapshot();
    map.thumbnail = thumbnail;
    this.currentMap = map;
    this.editorScene?.updateMapInfo({ thumbnail });
    MapStorage.saveMap(map);
    this.updateThumbnailPreview(thumbnail);
    this.showToast("Thumbnail capturada.");
  }

  private exportMap(): void {
    const map = this.getCurrentSnapshot();
    downloadJson(map, `mini-blox-${slugify(map.name)}.json`);
    this.showToast("Mapa exportado.");
  }

  private saveMap(): void {
    const map = this.getCurrentSnapshot();
    MapStorage.saveMap(map);
    this.currentMap = map;
    this.showToast("Mapa salvo com sucesso.");
  }

  private async publishMap(): Promise<void> {
    const map = this.getCurrentSnapshot();
    const creatorName = LocalProfileStorage.getDisplayName();

    if (map.onlineMetadata?.onlineId) {
      await this.updateOnlineMap(map, map.onlineMetadata.onlineId);
    } else {
      await this.publishNewOnlineMap(map, creatorName);
    }
  }

  private async publishNewOnlineMap(map: GameMap, creatorName: string): Promise<void> {
    this.showToast("Publicando mapa online...");

    try {
      const { onlineId, summary } = await OnlineMapService.publishOnlineMap(map, creatorName);

      map.isPublished = true;
      map.publishedAt = summary.publishedAt;
      map.onlineMetadata = {
        onlineId,
        publishedAt: summary.publishedAt,
        updatedAt: summary.updatedAt,
      };

      this.editorScene?.updateMapInfo({
        isPublished: true,
        publishedAt: summary.publishedAt,
        onlineMetadata: map.onlineMetadata,
      });

      MapStorage.saveMap(map);
      this.currentMap = map;
      this.updatePublishStatus(map);
      this.showToast("Mapa publicado online com sucesso!");
    } catch (error) {
      if (error instanceof OnlineServiceError && error.isOffline) {
        this.showToast("Servidor online indisponível. O mapa continua salvo localmente.");
      } else {
        this.showToast(error instanceof Error ? error.message : "Erro ao publicar mapa online.");
      }
    }
  }

  private async updateOnlineMap(map: GameMap, onlineId: string): Promise<void> {
    this.showToast("Atualizando mapa online...");

    try {
      const summary = await OnlineMapService.updateOnlineMap(onlineId, map);

      if (summary) {
        map.onlineMetadata = {
          onlineId,
          publishedAt: summary.publishedAt,
          updatedAt: summary.updatedAt,
        };

        this.editorScene?.updateMapInfo({
          onlineMetadata: map.onlineMetadata,
        });

        MapStorage.saveMap(map);
        this.currentMap = map;
        this.showToast("Mapa atualizado online com sucesso!");
      }
    } catch (error) {
      if (error instanceof OnlineServiceError && error.isOffline) {
        this.showToast("Servidor online indisponível. O mapa continua salvo localmente.");
      } else {
        this.showToast(error instanceof Error ? error.message : "Erro ao atualizar mapa online.");
      }
    }
  }

  private backToMenu(): void {
    if (this.testing) {
      this.stopRuntimeTest();
    }

    const map = this.getCurrentSnapshot();
    MapStorage.saveMap(map);
    this.options.onBackToMenu?.(map);
  }

  private getCurrentSnapshot(): GameMap {
    const map = this.editorScene?.getSnapshot() ?? this.currentMap;
    this.applyMetadataToMap(map);
    return map;
  }

  private readMetadataInputs(): Pick<GameMap, "name" | "description" | "creatorName" | "tags"> {
    const nameInput = this.root.querySelector<HTMLInputElement>("#map-name-input");
    const descriptionInput = this.root.querySelector<HTMLTextAreaElement>("#map-description-input");
    const creatorInput = this.root.querySelector<HTMLInputElement>("#map-creator-input");
    const tagsInput = this.root.querySelector<HTMLInputElement>("#map-tags-input");

    return {
      name: nameInput?.value.trim() || "Mapa sem nome",
      description: descriptionInput?.value.trim() ?? "",
      creatorName: creatorInput?.value.trim() || "Criador local",
      tags: parseTags(tagsInput?.value ?? ""),
    };
  }

  private applyMetadataToMap(map: GameMap): GameMap {
    Object.assign(map, this.readMetadataInputs());
    map.visualSettings = this.readEnvironmentInputs();
    map.audioSettings = this.readAudioInputs();
    return map;
  }

  private syncMetadataInputs(map: GameMap): void {
    const nameInput = this.root.querySelector<HTMLInputElement>("#map-name-input");
    const descriptionInput = this.root.querySelector<HTMLTextAreaElement>("#map-description-input");
    const creatorInput = this.root.querySelector<HTMLInputElement>("#map-creator-input");
    const tagsInput = this.root.querySelector<HTMLInputElement>("#map-tags-input");

    if (nameInput) {
      nameInput.value = map.name;
    }

    if (descriptionInput) {
      descriptionInput.value = map.description ?? "";
    }

    if (creatorInput) {
      creatorInput.value = map.creatorName ?? "";
    }

    if (tagsInput) {
      tagsInput.value = (map.tags ?? []).join(", ");
    }

    this.updateEnvironmentInputs(map.visualSettings);
    this.updateAudioInputs(map.audioSettings);
    this.updateThumbnailPreview(map.thumbnail);
    this.updatePublishStatus(map);
  }

  private readEnvironmentInputs(): VisualSettings {
    const fallback = resolveVisualSettings(this.currentMap.visualSettings);
    const themeInput = this.root.querySelector<HTMLSelectElement>("#map-theme-input");
    const skyInput = this.root.querySelector<HTMLInputElement>("#sky-color-input");
    const groundInput = this.root.querySelector<HTMLInputElement>("#ground-color-input");
    const fogEnabledInput = this.root.querySelector<HTMLInputElement>("#fog-enabled-input");
    const fogColorInput = this.root.querySelector<HTMLInputElement>("#fog-color-input");

    return {
      theme: getVisualTheme(themeInput?.value ?? fallback.theme),
      skyColor: skyInput?.value || fallback.skyColor,
      groundColor: groundInput?.value || fallback.groundColor,
      fogEnabled: fogEnabledInput?.checked ?? fallback.fogEnabled,
      fogColor: fogColorInput?.value || fallback.fogColor,
      fogNear: readNumberInput(
        this.root.querySelector<HTMLInputElement>("#fog-near-input"),
        fallback.fogNear
      ),
      fogFar: readNumberInput(
        this.root.querySelector<HTMLInputElement>("#fog-far-input"),
        fallback.fogFar
      ),
      ambientLightIntensity: readNumberInput(
        this.root.querySelector<HTMLInputElement>("#ambient-light-input"),
        fallback.ambientLightIntensity
      ),
      sunLightIntensity: readNumberInput(
        this.root.querySelector<HTMLInputElement>("#sun-light-input"),
        fallback.sunLightIntensity
      ),
    };
  }

  private updateEnvironmentInputs(settings: VisualSettings | undefined): void {
    const resolved = resolveVisualSettings(settings);
    setSelectValue(this.root.querySelector<HTMLSelectElement>("#map-theme-input"), resolved.theme);
    setInputValue(this.root.querySelector<HTMLInputElement>("#sky-color-input"), resolved.skyColor);
    setInputValue(
      this.root.querySelector<HTMLInputElement>("#ground-color-input"),
      resolved.groundColor
    );
    setInputChecked(
      this.root.querySelector<HTMLInputElement>("#fog-enabled-input"),
      resolved.fogEnabled
    );
    setInputValue(this.root.querySelector<HTMLInputElement>("#fog-color-input"), resolved.fogColor);
    setInputValue(
      this.root.querySelector<HTMLInputElement>("#fog-near-input"),
      String(resolved.fogNear)
    );
    setInputValue(
      this.root.querySelector<HTMLInputElement>("#fog-far-input"),
      String(resolved.fogFar)
    );
    setInputValue(
      this.root.querySelector<HTMLInputElement>("#ambient-light-input"),
      String(resolved.ambientLightIntensity)
    );
    setInputValue(
      this.root.querySelector<HTMLInputElement>("#sun-light-input"),
      String(resolved.sunLightIntensity)
    );
  }

  private readAudioInputs(): AudioSettings {
    const fallback = resolveAudioSettings(this.currentMap.audioSettings);
    const musicInput = this.root.querySelector<HTMLSelectElement>("#ambient-music-input");
    const mutedInput = this.root.querySelector<HTMLInputElement>("#audio-muted-input");

    return {
      masterVolume: readPercentInput(
        this.root.querySelector<HTMLInputElement>("#master-volume-input"),
        fallback.masterVolume
      ),
      sfxVolume: readPercentInput(
        this.root.querySelector<HTMLInputElement>("#sfx-volume-input"),
        fallback.sfxVolume
      ),
      musicVolume: readPercentInput(
        this.root.querySelector<HTMLInputElement>("#music-volume-input"),
        fallback.musicVolume
      ),
      muted: mutedInput?.checked ?? fallback.muted,
      ambientMusic: getAmbientMusic(musicInput?.value ?? fallback.ambientMusic),
    };
  }

  private updateAudioInputs(settings: AudioSettings | undefined): void {
    const resolved = resolveAudioSettings(settings);
    setInputValue(
      this.root.querySelector<HTMLInputElement>("#master-volume-input"),
      String(Math.round(resolved.masterVolume * 100))
    );
    setInputValue(
      this.root.querySelector<HTMLInputElement>("#sfx-volume-input"),
      String(Math.round(resolved.sfxVolume * 100))
    );
    setInputValue(
      this.root.querySelector<HTMLInputElement>("#music-volume-input"),
      String(Math.round(resolved.musicVolume * 100))
    );
    setSelectValue(
      this.root.querySelector<HTMLSelectElement>("#ambient-music-input"),
      resolved.ambientMusic
    );
    setInputChecked(
      this.root.querySelector<HTMLInputElement>("#audio-muted-input"),
      resolved.muted
    );
    this.updateAudioOutputLabels(resolved);
  }

  private updateAudioOutputLabels(settings: AudioSettings | undefined): void {
    const resolved = resolveAudioSettings(settings);
    setOutputText(
      this.root.querySelector<HTMLOutputElement>("#master-volume-input-value"),
      `${Math.round(resolved.masterVolume * 100)}%`
    );
    setOutputText(
      this.root.querySelector<HTMLOutputElement>("#sfx-volume-input-value"),
      `${Math.round(resolved.sfxVolume * 100)}%`
    );
    setOutputText(
      this.root.querySelector<HTMLOutputElement>("#music-volume-input-value"),
      `${Math.round(resolved.musicVolume * 100)}%`
    );
  }

  private updateThumbnailPreview(thumbnail: string | undefined): void {
    const preview = this.root.querySelector<HTMLElement>("#map-thumbnail-preview");

    if (!preview) {
      return;
    }

    preview.innerHTML = thumbnail
      ? `
      <img src="${escapeAttribute(thumbnail)}" alt="Thumbnail do mapa" />
    `
      : `
      <div class="thumbnail-placeholder">
        <i data-lucide="image"></i>
        <span>Sem capa</span>
      </div>
    `;
    createIcons({ icons });
  }

  private updatePublishStatus(map: GameMap): void {
    const status = this.root.querySelector<HTMLElement>("#publish-status");

    if (!status) {
      return;
    }

    status.textContent = map.isPublished ? "Publicado" : "Rascunho";
    status.classList.toggle("published", Boolean(map.isPublished));
    status.classList.toggle("draft", !map.isPublished);
  }

  private handleMapChange(map: GameMap): void {
    const nextMap = structuredClone(map);
    this.applyMetadataToMap(nextMap);
    this.currentMap = nextMap;
    MapStorage.saveMap(nextMap);
    this.assetPanel?.setAssets(nextMap.assets ?? []);
    this.gameModePanel?.setMap(nextMap);
    this.objectivesPanel?.setMap(nextMap);
    this.logicPanel?.setMap(nextMap);
    this.refreshOutliner(nextMap);
    this.updateStats(nextMap);
    this.updatePublishStatus(nextMap);
    this.saveButtons?.setMap(nextMap);
  }

  private handleModeChange(mode: "edit" | "test"): void {
    this.testing = mode === "test";
    this.saveButtons?.setTesting(this.testing);
    const badge = this.root.querySelector<HTMLElement>("#mode-badge");

    if (badge) {
      badge.textContent = this.testing ? "Teste" : "Editando";
      badge.classList.toggle("testing", this.testing);
    }
  }

  private updateStats(map: GameMap): void {
    const stats = this.root.querySelector<HTMLElement>("#map-stats");

    if (stats) {
      stats.textContent = `${map.objects.length} objetos`;
    }
  }

  private showToast(message: string): void {
    const toast = this.root.querySelector<HTMLElement>("#toast");

    if (!toast) {
      return;
    }

    toast.textContent = message;
    toast.classList.add("visible");
    window.setTimeout(() => toast.classList.remove("visible"), 2200);
  }

  private async duplicateSelectedObject(): Promise<void> {
    const duplicate = await this.editorScene?.duplicateSelectedObject();

    if (duplicate) {
      this.showToast("Objeto duplicado.");
    }
  }

  private deleteSelectedObject(): void {
    if (this.editorScene?.deleteSelectedObject()) {
      this.showToast("Objeto excluido.");
    }
  }

  private copySelectedObject(): void {
    if (this.editorScene?.copySelectedObject()) {
      this.showToast("Objeto copiado.");
    }
  }

  private async pasteCopiedObject(): Promise<void> {
    const pasted = await this.editorScene?.pasteCopiedObject();

    if (pasted) {
      this.showToast("Objeto colado.");
    }
  }

  private focusSelectedObject(): void {
    if (this.editorScene?.focusSelectedObject()) {
      this.showToast("Camera centralizada no objeto.");
    }
  }

  private focusMap(): void {
    this.editorScene?.focusMap();
    this.showToast("Camera centralizada no mapa.");
  }

  private toggleObjectVisibility(objectId: string): void {
    if (this.editorScene?.toggleObjectVisibility(objectId)) {
      this.refreshOutliner();
    }
  }

  private refreshOutliner(map = this.editorScene?.getSnapshot() ?? this.currentMap): void {
    this.objectOutliner?.setObjects(map.objects);
    this.objectOutliner?.setSelectedId(this.editorScene?.getSelectedId() ?? null);
    this.objectOutliner?.setHiddenIds(this.editorScene?.getHiddenObjectIds() ?? []);
  }

  private openImportDialog(): void {
    this.root.querySelector<HTMLInputElement>("#map-import-input")?.click();
  }

  private async importMap(file: File): Promise<void> {
    try {
      if (this.testing) {
        this.stopRuntimeTest();
      }

      const parsed: unknown = JSON.parse(await file.text());
      assertGameMap(parsed);
      const importedMap = prepareImportedMap(parsed, this.currentMap.id);
      if (!importedMap) {
        this.showToast("Importacao cancelada.");
        return;
      }
      this.currentMap = importedMap;
      await this.editorScene?.loadMap(importedMap, { emitChange: false });

      MapStorage.saveMap(importedMap);
      this.syncMetadataInputs(importedMap);
      this.propertiesPanel?.setObject(null);
      this.assetPanel?.setAssets(importedMap.assets ?? []);
      this.gameModePanel?.setMap(importedMap);
      this.objectivesPanel?.setMap(importedMap);
      this.logicPanel?.setMap(importedMap);
      this.refreshOutliner(importedMap);
      this.updateStats(importedMap);
      this.showToast("Mapa carregado.");
    } catch {
      this.showToast("JSON invalido. O arquivo precisa ser um GameMap.");
    }
  }

  private async startRuntimeTest(): Promise<void> {
    if (!this.editorScene || this.testing) {
      return;
    }

    this.currentMap = this.getCurrentSnapshot();
    this.editorScene.enterTestMode();
    const viewport = this.getElement("scene-root");
    const runtime = new GameRuntime(viewport, {
      onBackToMenu: () => this.stopRuntimeTest(),
      onEditMap: () => this.stopRuntimeTest(),
    });
    this.testRuntime = runtime;
    await runtime.loadMap(this.currentMap);
    this.showToast("Teste iniciado.");
  }

  private stopRuntimeTest(): void {
    this.testRuntime?.dispose();
    this.testRuntime = null;
    this.editorScene?.exitTestMode();
    this.showToast("Modo edicao.");
  }

  private readonly handleKeyboardShortcut = (event: KeyboardEvent): void => {
    if (this.testing || isEditableTarget(event.target)) {
      return;
    }

    const key = event.key.toLowerCase();

    if (event.ctrlKey || event.metaKey) {
      if (key === "d") {
        event.preventDefault();
        void this.duplicateSelectedObject();
      } else if (key === "c") {
        event.preventDefault();
        this.copySelectedObject();
      } else if (key === "v") {
        event.preventDefault();
        void this.pasteCopiedObject();
      }

      return;
    }

    if (key === "delete" || key === "backspace") {
      event.preventDefault();
      this.deleteSelectedObject();
    } else if (key === "escape") {
      event.preventDefault();
      this.editorScene?.deselectObject();
    } else if (key === "w") {
      event.preventDefault();
      this.toolManager.setTool("translate");
    } else if (key === "e") {
      event.preventDefault();
      this.toolManager.setTool("rotate");
    } else if (key === "r") {
      event.preventDefault();
      this.toolManager.setTool("scale");
    } else if (key === "f") {
      event.preventDefault();
      this.focusSelectedObject();
    } else if (key === "home") {
      event.preventDefault();
      this.focusMap();
    }
  };

  private getElement(id: string): HTMLElement {
    const element = this.root.querySelector<HTMLElement>(`#${id}`);

    if (!element) {
      throw new Error(`Missing #${id} element.`);
    }

    return element;
  }
}

export function createDefaultMap(): GameMap {
  return createMapFromTemplate("obby");
}

function downloadJson(map: GameMap, fileName: string): void {
  const blob = new Blob([JSON.stringify(map, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "mapa"
  );
}

function prepareImportedMap(map: GameMap, currentMapId: string): GameMap | null {
  const importedMap = structuredClone(map);

  if (!MapStorage.hasMap(importedMap.id) || importedMap.id === currentMapId) {
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

function getVisualTheme(value: string): VisualTheme {
  if (value === "grass" || value === "desert" || value === "neon" || value === "dark") {
    return value;
  }

  return "classic";
}

function getAmbientMusic(value: string): AmbientMusic {
  if (value === "calm" || value === "adventure" || value === "dark" || value === "neon") {
    return value;
  }

  return "none";
}

function readNumberInput(input: HTMLInputElement | null, fallback: number): number {
  const value = Number(input?.value);
  return Number.isFinite(value) ? value : fallback;
}

function readPercentInput(input: HTMLInputElement | null, fallback: number): number {
  const value = Number(input?.value);

  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(1, Math.max(0, value / 100));
}

function setInputValue(input: HTMLInputElement | null, value: string): void {
  if (input) {
    input.value = value;
  }
}

function setInputChecked(input: HTMLInputElement | null, value: boolean): void {
  if (input) {
    input.checked = value;
  }
}

function setSelectValue(input: HTMLSelectElement | null, value: string): void {
  if (input) {
    input.value = value;
  }
}

function setOutputText(output: HTMLOutputElement | null, value: string): void {
  if (output) {
    output.textContent = value;
  }
}

function parseTags(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
    ),
  ];
}

function createId(prefix: string): string {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}
