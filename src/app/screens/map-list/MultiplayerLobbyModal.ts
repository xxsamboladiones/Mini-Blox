import { createIcons, icons } from "lucide";
import type { RoomSummary } from "../../../shared/types/MultiplayerSchema.js";
import { multiplayerService } from "../../../services/MultiplayerService.js";

type MaybePromise<T> = T | Promise<T>;

export class MultiplayerLobbyModal {
  private readonly modal: HTMLElement;
  private busy = false;
  private onJoinRoom: ((roomId: string) => MaybePromise<void>) | null = null;
  private onCreateRoom: (() => MaybePromise<void>) | null = null;
  private onBack: (() => void) | null = null;
  private currentOnlineMapId: string | null = null;

  constructor() {
    this.modal = this.createModal();
    document.body.appendChild(this.modal);
    this.bindEvents();
  }

  show(onlineMapId: string): void {
    this.currentOnlineMapId = onlineMapId;
    this.modal.classList.add("visible");
    this.setStatus("");
    void this.loadRooms(onlineMapId);
  }

  getCurrentOnlineMapId(): string | null {
    return this.currentOnlineMapId;
  }

  hide(): void {
    this.busy = false;
    this.setButtonsDisabled(false);
    this.modal.classList.remove("visible");
  }

  setOnJoinRoom(callback: (roomId: string) => MaybePromise<void>): void {
    this.onJoinRoom = callback;
  }

  setOnCreateRoom(callback: () => MaybePromise<void>): void {
    this.onCreateRoom = callback;
  }

  setOnBack(callback: () => void): void {
    this.onBack = callback;
  }

  dispose(): void {
    this.modal.remove();
  }

  private createModal(): HTMLElement {
    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.innerHTML = `
      <div class="modal-content multiplayer-lobby">
        <div class="modal-header">
          <h2>Multiplayer</h2>
          <button class="modal-close" type="button" data-action="back" title="Fechar">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="lobby-section">
            <h3>Criar Sala</h3>
            <button class="btn btn-primary" type="button" data-action="create-room">
              <i data-lucide="plus"></i>
              <span>Criar Sala</span>
            </button>
          </div>
          <div class="lobby-section">
            <h3>Salas Disponiveis</h3>
            <div class="rooms-list" data-section="rooms-list">
              <p class="loading">Carregando salas...</p>
            </div>
          </div>
          <p class="lobby-status" data-section="status" role="status"></p>
        </div>
      </div>
    `;
    createIcons({ icons });
    return modal;
  }

  private bindEvents(): void {
    this.modal
      .querySelector('[data-action="back"]')
      ?.addEventListener("click", () => this.handleBack());

    this.modal
      .querySelector('[data-action="create-room"]')
      ?.addEventListener("click", () => {
        void this.handleCreateRoom();
      });
  }

  private handleBack(): void {
    this.hide();
    this.onBack?.();
  }

  private async handleCreateRoom(): Promise<void> {
    if (this.busy || !this.onCreateRoom) {
      return;
    }

    this.busy = true;
    this.setButtonsDisabled(true);
    this.setStatus("Criando sala...");

    try {
      await this.onCreateRoom();
      this.hide();
    } catch (error) {
      this.setStatus(getErrorMessage(error, "Erro ao criar sala."));
      this.setButtonsDisabled(false);
      this.busy = false;
    }
  }

  private async handleJoinRoom(roomId: string): Promise<void> {
    if (this.busy || !this.onJoinRoom) {
      return;
    }

    this.busy = true;
    this.setButtonsDisabled(true);
    this.setStatus("Entrando na sala...");

    try {
      await this.onJoinRoom(roomId);
      this.hide();
    } catch (error) {
      this.setStatus(getErrorMessage(error, "Erro ao entrar na sala."));
      this.setButtonsDisabled(false);
      this.busy = false;
    }
  }

  private async loadRooms(onlineMapId: string): Promise<void> {
    const roomsList = this.modal.querySelector<HTMLElement>('[data-section="rooms-list"]');
    if (!roomsList) return;

    roomsList.innerHTML = '<p class="loading">Carregando salas...</p>';

    try {
      const response = await multiplayerService.listRooms();
      const rooms = response.rooms.filter((room) => room.onlineMapId === onlineMapId);

      if (rooms.length === 0) {
        roomsList.innerHTML = '<p class="empty">Nenhuma sala disponivel para este mapa.</p>';
        return;
      }

      roomsList.innerHTML = rooms.map((room) => this.renderRoom(room)).join("");

      roomsList.querySelectorAll<HTMLButtonElement>('[data-action="join-room"]').forEach((btn) => {
        btn.addEventListener("click", () => {
          const roomId = btn.dataset.roomId;
          if (roomId) {
            void this.handleJoinRoom(roomId);
          }
        });
      });
    } catch (error) {
      roomsList.innerHTML = `<p class="error">${escapeHtml(getErrorMessage(error, "Erro ao carregar salas."))}</p>`;
    }
  }

  private renderRoom(room: RoomSummary): string {
    const isFull = room.playerCount >= room.maxPlayers;
    return `
      <div class="room-card">
        <div class="room-info">
          <span class="room-code">${escapeHtml(room.roomId)}</span>
          <span class="room-players">${room.playerCount}/${room.maxPlayers} jogadores</span>
        </div>
        <button class="btn btn-sm btn-primary" type="button" data-action="join-room" data-room-id="${escapeAttribute(room.roomId)}" ${isFull ? "disabled" : ""}>
          ${isFull ? "Sala cheia" : "Entrar"}
        </button>
      </div>
    `;
  }

  private setStatus(message: string): void {
    const status = this.modal.querySelector<HTMLElement>('[data-section="status"]');
    if (status) {
      status.textContent = message;
      status.classList.toggle("visible", message.length > 0);
    }
  }

  private setButtonsDisabled(disabled: boolean): void {
    this.modal.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      if (button.dataset.action === "back") {
        button.disabled = false;
      } else {
        button.disabled = disabled;
      }
    });
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
