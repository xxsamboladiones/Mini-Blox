import { createIcons, icons } from "lucide";
import {
  OnlineMapService,
  OnlineServiceError,
  type OnlineMapSummary,
} from "../../../services/OnlineMapService.js";
import type { GameMap } from "../../../shared/types/MapSchema.js";
import { MapStorage } from "../../../storage/MapStorage.js";
import { MultiplayerLobbyModal } from "./MultiplayerLobbyModal.js";

type OnlineMapDetailsModalActions = {
  onPlayMap: (map: GameMap) => void;
  onEditMap: (map: GameMap) => void;
  onClose: () => void;
  onPlayMultiplayer?: (
    map: GameMap,
    roomId: string,
    onlineMapId?: string
  ) => void | Promise<void>;
  onCreateMultiplayerRoom?: (map: GameMap, onlineMapId?: string) => void | Promise<void>;
};

export class OnlineMapDetailsModal {
  private modal: HTMLElement | null = null;
  private backdrop: HTMLElement | null = null;
  private isLiked = false;
  private readonly multiplayerLobbyModal: MultiplayerLobbyModal;
  private readonly ownsMultiplayerLobbyModal: boolean;

  constructor(
    private readonly root: HTMLElement,
    private readonly actions: OnlineMapDetailsModalActions,
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

  show(summary: OnlineMapSummary): void {
    this.renderModal(summary);
  }

  close(): void {
    this.modal?.remove();
    this.backdrop?.remove();
    this.modal = null;
    this.backdrop = null;
  }

  dispose(): void {
    this.close();
    if (this.ownsMultiplayerLobbyModal) {
      this.multiplayerLobbyModal.dispose();
    }
  }

  private renderModal(summary: OnlineMapSummary): void {
    this.isLiked = false;

    this.backdrop = document.createElement("div");
    this.backdrop.className = "modal-backdrop";
    this.backdrop.addEventListener("click", () => this.close());

    this.modal = document.createElement("div");
    this.modal.className = "modal-content";
    this.modal.innerHTML = this.renderModalContent(summary);

    this.backdrop.appendChild(this.modal);
    this.root.appendChild(this.backdrop);

    this.bindEvents(summary);
    createIcons({ icons });
  }

  private renderModalContent(summary: OnlineMapSummary): string {
    const thumbnailHtml = summary.thumbnail
      ? `<img src="${this.escapeAttribute(summary.thumbnail)}" alt="${this.escapeHtml(summary.name)}" class="detail-thumbnail" />`
      : `<div class="detail-thumbnail-placeholder">
          <i data-lucide="image"></i>
          <span>Sem capa</span>
        </div>`;

    return `
      <div class="online-map-details">
        <header class="detail-header">
          <h2>${this.escapeHtml(summary.name)}</h2>
          <button class="icon-button" type="button" data-action="close" title="Fechar">
            <i data-lucide="x"></i>
          </button>
        </header>

        <div class="detail-body">
          <div class="detail-thumbnail-section">
            ${thumbnailHtml}
          </div>

          <div class="detail-info-section">
            <div class="detail-meta">
              <span class="meta-item">
                <i data-lucide="user"></i>
                <strong>Criador:</strong> ${this.escapeHtml(summary.creatorName)}
              </span>
              <span class="meta-item">
                <i data-lucide="tag"></i>
                <strong>Tema:</strong> ${this.escapeHtml(summary.theme)}
              </span>
              <span class="meta-item">
                <i data-lucide="gamepad-2"></i>
                <strong>Modo:</strong> ${this.escapeHtml(summary.mode)}
              </span>
              <span class="meta-item">
                <i data-lucide="box"></i>
                <strong>Objetos:</strong> ${summary.objectCount}
              </span>
              <span class="meta-item">
                <i data-lucide="heart"></i>
                <strong>Curtidas:</strong> ${summary.likeCount}
              </span>
              <span class="meta-item">
                <i data-lucide="play"></i>
                <strong>Plays:</strong> ${summary.playCount}
              </span>
              <span class="meta-item">
                <i data-lucide="calendar"></i>
                <strong>Publicado:</strong> ${this.formatDate(summary.publishedAt)}
              </span>
            </div>

            <div class="detail-description">
              <h3>Descrição</h3>
              <p>${this.escapeHtml(summary.description || "Sem descrição.")}</p>
            </div>

            ${
              summary.tags.length > 0
                ? `
              <div class="detail-tags">
                <h3>Tags</h3>
                <div class="tags-list">
                  ${summary.tags.map((tag) => `<span class="tag">${this.escapeHtml(tag)}</span>`).join("")}
                </div>
              </div>
            `
                : ""
            }
          </div>
        </div>

        <footer class="detail-footer">
          <button class="action-button primary" type="button" data-action="play">
            <i data-lucide="play"></i>
            <span>Jogar Solo</span>
          </button>
          <button class="action-button secondary" type="button" data-action="multiplayer">
            <i data-lucide="users"></i>
            <span>Multiplayer</span>
          </button>
          <button class="action-button" type="button" data-action="like">
            <i data-lucide="heart"></i>
            <span>Curtir</span>
          </button>
          <button class="action-button" type="button" data-action="download">
            <i data-lucide="download"></i>
            <span>Salvar cópia local</span>
          </button>
        </footer>
      </div>
    `;
  }

  private bindEvents(summary: OnlineMapSummary): void {
    this.modal
      ?.querySelector('[data-action="close"]')
      ?.addEventListener("click", () => this.close());
    this.modal
      ?.querySelector('[data-action="play"]')
      ?.addEventListener("click", () => this.handlePlay(summary));
    this.modal
      ?.querySelector('[data-action="multiplayer"]')
      ?.addEventListener("click", () => this.handleMultiplayer(summary));
    this.modal
      ?.querySelector('[data-action="like"]')
      ?.addEventListener("click", () => this.handleLike(summary));
    this.modal
      ?.querySelector('[data-action="download"]')
      ?.addEventListener("click", () => this.handleDownload(summary));
  }

  private handleMultiplayer(summary: OnlineMapSummary): void {
    this.multiplayerLobbyModal.show(summary.id);
  }

  private async handlePlay(summary: OnlineMapSummary): Promise<void> {
    try {
      const gameMap = await OnlineMapService.getOnlineMap(summary.id);
      await OnlineMapService.registerOnlinePlay(summary.id);
      this.close();
      this.actions.onPlayMap(gameMap);
    } catch (error) {
      if (error instanceof OnlineServiceError && error.isOffline) {
        alert("Servidor online indisponível. Não é possível jogar este mapa agora.");
      } else {
        alert(error instanceof Error ? error.message : "Erro ao carregar mapa online.");
      }
    }
  }

  private async handleLike(summary: OnlineMapSummary): Promise<void> {
    try {
      const result = await OnlineMapService.toggleOnlineLike(summary.id);
      this.isLiked = result.liked;

      const likeButton = this.modal?.querySelector('[data-action="like"]');
      if (likeButton) {
        likeButton.innerHTML = `
          <i data-lucide="${this.isLiked ? "heart" : "heart"}" class="${this.isLiked ? "filled" : ""}"></i>
          <span>${this.isLiked ? "Descurtir" : "Curtir"}</span>
        `;
        createIcons({ icons });
      }
    } catch (error) {
      if (error instanceof OnlineServiceError && error.isOffline) {
        alert("Servidor online indisponível. Não é possível curtir este mapa agora.");
      } else {
        alert(error instanceof Error ? error.message : "Erro ao curtir mapa.");
      }
    }
  }

  private async handleDownload(summary: OnlineMapSummary): Promise<void> {
    try {
      const localCopy = await OnlineMapService.downloadOnlineMapAsLocalCopy(summary.id);
      MapStorage.saveMap(localCopy);

      const shouldOpen = confirm(
        `Mapa "${summary.name}" salvo como cópia local!\n\nDeseja abrir no editor agora?`
      );

      if (shouldOpen) {
        this.close();
        this.actions.onEditMap(localCopy);
      }
    } catch (error) {
      if (error instanceof OnlineServiceError && error.isOffline) {
        alert("Servidor online indisponível. Não é possível baixar este mapa agora.");
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

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}
