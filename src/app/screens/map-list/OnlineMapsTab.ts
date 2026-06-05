import { createIcons, icons } from "lucide";
import {
  OnlineMapService,
  OnlineServiceError,
  type OnlineMapSummary,
} from "../../../services/OnlineMapService.js";
import type { GameMap } from "../../../shared/types/MapSchema.js";
import { MapStorage } from "../../../storage/MapStorage.js";
import { MultiplayerLobbyModal } from "./MultiplayerLobbyModal.js";

type OnlineMapsTabActions = {
  onPlayMap: (map: GameMap) => void;
  onEditMap: (map: GameMap) => void;
  onShowDetails: (summary: OnlineMapSummary) => void;
  onDownloadCopy: (summary: OnlineMapSummary) => void;
  onPlayMultiplayer?: (map: GameMap, roomId: string, onlineMapId?: string) => void | Promise<void>;
  onCreateMultiplayerRoom?: (map: GameMap, onlineMapId?: string) => void | Promise<void>;
};

type OnlineMapsTabState = {
  maps: OnlineMapSummary[];
  loading: boolean;
  error: string | null;
};

export class OnlineMapsTab {
  private state: OnlineMapsTabState = {
    maps: [],
    loading: true,
    error: null,
  };
  private readonly multiplayerLobbyModal: MultiplayerLobbyModal;
  private readonly ownsMultiplayerLobbyModal: boolean;

  constructor(
    private readonly root: HTMLElement,
    private readonly actions: OnlineMapsTabActions,
    multiplayerLobbyModal?: MultiplayerLobbyModal
  ) {
    this.multiplayerLobbyModal = multiplayerLobbyModal ?? new MultiplayerLobbyModal();
    this.ownsMultiplayerLobbyModal = !multiplayerLobbyModal;
    this.setupMultiplayerModal();
  }

  private setupMultiplayerModal(): void {
    this.multiplayerLobbyModal.setOnJoinRoom(async (roomId: string) => {
      const mapId = this.multiplayerLobbyModal.getCurrentOnlineMapId();
      if (!mapId) return;

      const gameMap = await OnlineMapService.getOnlineMap(mapId);
      await this.actions.onPlayMultiplayer?.(gameMap, roomId, mapId);
    });

    this.multiplayerLobbyModal.setOnCreateRoom(async () => {
      const mapId = this.multiplayerLobbyModal.getCurrentOnlineMapId();
      if (!mapId) return;

      const gameMap = await OnlineMapService.getOnlineMap(mapId);
      await this.actions.onCreateMultiplayerRoom?.(gameMap, mapId);
    });
  }

  dispose(): void {
    if (this.ownsMultiplayerLobbyModal) {
      this.multiplayerLobbyModal.dispose();
    }
  }

  render(): void {
    this.loadOnlineMaps();
  }

  private async loadOnlineMaps(): Promise<void> {
    this.state.loading = true;
    this.state.error = null;
    this.renderContent();

    try {
      const maps = await OnlineMapService.listOnlineMaps();
      this.state.maps = maps;
      this.state.loading = false;
      this.renderContent();
    } catch (error) {
      this.state.loading = false;

      if (error instanceof OnlineServiceError && error.isOffline) {
        this.state.error = "Servidor online indisponivel. Verifique se o backend esta rodando.";
      } else {
        this.state.error =
          error instanceof Error ? error.message : "Erro ao carregar mapas online.";
      }

      this.renderContent();
    }
  }

  private renderContent(): void {
    if (this.state.loading) {
      this.root.innerHTML = `
        <div class="loading-state">
          <i data-lucide="loader-2" class="spinner"></i>
          <span>Carregando mapas online...</span>
        </div>
      `;
      createIcons({ icons });
      return;
    }

    if (this.state.error) {
      this.root.innerHTML = `
        <div class="error-state">
          <i data-lucide="wifi-off"></i>
          <span>${this.escapeHtml(this.state.error)}</span>
          <button class="action-button" type="button" data-action="retry">
            <i data-lucide="refresh-cw"></i>
            <span>Tentar novamente</span>
          </button>
        </div>
      `;
      this.root
        .querySelector('[data-action="retry"]')
        ?.addEventListener("click", () => this.loadOnlineMaps());
      createIcons({ icons });
      return;
    }

    if (this.state.maps.length === 0) {
      this.root.innerHTML = `
        <div class="empty-state">
          <i data-lucide="globe"></i>
          <span>Nenhum mapa online encontrado.</span>
          <span class="muted">Seja o primeiro a publicar um mapa!</span>
        </div>
      `;
      createIcons({ icons });
      return;
    }

    this.root.innerHTML = `
      <div class="map-grid">
        ${this.state.maps.map((map) => this.renderMapCard(map)).join("")}
      </div>
    `;

    this.bindMapCards();
    createIcons({ icons });
  }

  private renderMapCard(map: OnlineMapSummary): string {
    const isOwner = false;
    const thumbnailHtml = map.thumbnail
      ? `<img src="${this.escapeAttribute(map.thumbnail)}" alt="${this.escapeHtml(map.name)}" class="map-thumbnail" />`
      : `<div class="map-thumbnail-placeholder">
          <i data-lucide="image"></i>
        </div>`;

    return `
      <article class="map-card" data-map-id="${this.escapeAttribute(map.id)}">
        <div class="map-card-thumbnail">
          ${thumbnailHtml}
          <div class="map-card-overlay">
            <button class="icon-button" type="button" data-action="details" title="Detalhes" aria-label="Ver detalhes">
              <i data-lucide="info"></i>
            </button>
            ${
              isOwner
                ? `
              <button class="icon-button danger" type="button" data-action="delete" title="Excluir online" aria-label="Excluir mapa online">
                <i data-lucide="trash-2"></i>
              </button>
            `
                : ""
            }
          </div>
        </div>
        <div class="map-card-content">
          <h3 class="map-card-title">${this.escapeHtml(map.name)}</h3>
          <p class="map-card-description">${this.escapeHtml(map.description || "Sem descricao")}</p>
          <div class="map-card-meta">
            <span class="meta-item">
              <i data-lucide="user"></i>
              ${this.escapeHtml(map.creatorName)}
            </span>
            <span class="meta-item">
              <i data-lucide="tag"></i>
              ${this.escapeHtml(map.theme)}
            </span>
            <span class="meta-item">
              <i data-lucide="gamepad-2"></i>
              ${this.escapeHtml(map.mode)}
            </span>
          </div>
          <div class="map-card-stats">
            <span class="stat-item">
              <i data-lucide="box"></i>
              ${map.objectCount}
            </span>
            <span class="stat-item">
              <i data-lucide="heart"></i>
              ${map.likeCount}
            </span>
            <span class="stat-item">
              <i data-lucide="play"></i>
              ${map.playCount}
            </span>
          </div>
          <div class="map-card-actions">
            <button class="action-button primary" type="button" data-action="play">
              <i data-lucide="play"></i>
              <span>Jogar Solo</span>
            </button>
            <button class="action-button secondary" type="button" data-action="multiplayer">
              <i data-lucide="users"></i>
              <span>Multiplayer</span>
            </button>
            <button class="icon-button" type="button" data-action="like" title="Curtir" aria-label="Curtir mapa">
              <i data-lucide="heart"></i>
            </button>
            <button class="icon-button" type="button" data-action="download" title="Salvar copia local" aria-label="Salvar copia local">
              <i data-lucide="download"></i>
            </button>
          </div>
        </div>
      </article>
    `;
  }

  private bindMapCards(): void {
    this.root.querySelectorAll<HTMLElement>(".map-card").forEach((card) => {
      const mapId = card.dataset.mapId;
      if (!mapId) return;

      const map = this.state.maps.find((m) => m.id === mapId);
      if (!map) return;

      card
        .querySelector('[data-action="play"]')
        ?.addEventListener("click", () => this.handlePlay(map));
      card
        .querySelector('[data-action="multiplayer"]')
        ?.addEventListener("click", () => this.handleMultiplayer(map));
      card
        .querySelector('[data-action="like"]')
        ?.addEventListener("click", () => this.handleLike(map));
      card
        .querySelector('[data-action="download"]')
        ?.addEventListener("click", () => this.handleDownload(map));
      card
        .querySelector('[data-action="details"]')
        ?.addEventListener("click", () => this.actions.onShowDetails(map));
    });
  }

  private handleMultiplayer(map: OnlineMapSummary): void {
    this.multiplayerLobbyModal.show(map.id);
  }

  private async handlePlay(map: OnlineMapSummary): Promise<void> {
    try {
      const gameMap = await OnlineMapService.getOnlineMap(map.id);
      await OnlineMapService.registerOnlinePlay(map.id);
      this.actions.onPlayMap(gameMap);
    } catch (error) {
      if (error instanceof OnlineServiceError && error.isOffline) {
        alert("Servidor online indisponivel. Nao e possivel jogar este mapa agora.");
      } else {
        alert(error instanceof Error ? error.message : "Erro ao carregar mapa online.");
      }
    }
  }

  private async handleLike(map: OnlineMapSummary): Promise<void> {
    try {
      await OnlineMapService.toggleOnlineLike(map.id);
      await this.loadOnlineMaps();
    } catch (error) {
      if (error instanceof OnlineServiceError && error.isOffline) {
        alert("Servidor online indisponivel. Nao e possivel curtir este mapa agora.");
      } else {
        alert(error instanceof Error ? error.message : "Erro ao curtir mapa.");
      }
    }
  }

  private async handleDownload(map: OnlineMapSummary): Promise<void> {
    try {
      const localCopy = await OnlineMapService.downloadOnlineMapAsLocalCopy(map.id);
      MapStorage.saveMap(localCopy);

      const shouldOpen = confirm(
        `Mapa "${map.name}" salvo como copia local!\n\nDeseja abrir no editor agora?`
      );

      if (shouldOpen) {
        this.actions.onEditMap(localCopy);
      }
    } catch (error) {
      if (error instanceof OnlineServiceError && error.isOffline) {
        alert("Servidor online indisponivel. Nao e possivel baixar este mapa agora.");
      } else {
        alert(error instanceof Error ? error.message : "Erro ao baixar mapa.");
      }
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  private escapeAttribute(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}
