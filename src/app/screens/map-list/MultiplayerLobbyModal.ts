import { createIcons, icons } from "lucide";
import type { GetRoomResponse, RoomSummary } from "../../../shared/types/MultiplayerSchema.js";
import { multiplayerService } from "../../../services/MultiplayerService.js";

type MaybePromise<T> = T | Promise<T>;
type LobbyRoomView = RoomSummary & {
  details?: GetRoomResponse;
};

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
    this.setMapLabel(onlineMapId);
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
          <div>
            <h2>Multiplayer</h2>
            <span data-section="map-label">Mapa online</span>
          </div>
          <button class="modal-close" type="button" data-action="back" title="Fechar" aria-label="Fechar lobby">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="lobby-section">
            <div class="lobby-section-heading">
              <h3>Criar sala</h3>
              <span>Multiplayer online</span>
            </div>
            <button class="btn btn-primary" type="button" data-action="create-room">
              <i data-lucide="plus"></i>
              <span>Criar sala</span>
            </button>
          </div>
          <div class="lobby-section">
            <div class="lobby-section-heading">
              <h3>Salas disponiveis</h3>
              <span data-section="room-count"></span>
            </div>
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

    this.modal.querySelector('[data-action="create-room"]')?.addEventListener("click", () => {
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
      this.setStatus(getFriendlyLobbyError(error, "Erro ao criar sala."));
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
      this.setStatus(getFriendlyLobbyError(error, "Erro ao entrar na sala."));
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
        this.setRoomCount("");
        roomsList.innerHTML = '<p class="empty">Nenhuma sala disponivel para este mapa.</p>';
        return;
      }

      const detailedRooms = await Promise.all(
        rooms.map(async (room): Promise<LobbyRoomView> => {
          try {
            return {
              ...room,
              details: await multiplayerService.getRoom(room.roomId),
            };
          } catch {
            return room;
          }
        })
      );

      this.setRoomCount(`${detailedRooms.length} sala${detailedRooms.length === 1 ? "" : "s"}`);
      roomsList.innerHTML = detailedRooms.map((room) => this.renderRoom(room)).join("");

      roomsList.querySelectorAll<HTMLButtonElement>('[data-action="join-room"]').forEach((btn) => {
        btn.addEventListener("click", () => {
          const roomId = btn.dataset.roomId;
          if (roomId) {
            void this.handleJoinRoom(roomId);
          }
        });
      });
      roomsList.querySelectorAll<HTMLButtonElement>('[data-action="copy-room"]').forEach((btn) => {
        btn.addEventListener("click", () => {
          const roomId = btn.dataset.roomId;
          if (roomId) {
            void this.handleCopyRoom(roomId);
          }
        });
      });
      createIcons({ icons });
    } catch (error) {
      this.setRoomCount("");
      roomsList.innerHTML = `<p class="error">${escapeHtml(getFriendlyLobbyError(error, "Erro ao carregar salas."))}</p>`;
    }
  }

  private renderRoom(room: LobbyRoomView): string {
    const isFull = room.playerCount >= room.maxPlayers;
    const players = room.details?.players ?? [];
    const hostName =
      players.find((player) => player.id === room.hostPlayerId)?.name ??
      (room.hostPlayerId ? shortId(room.hostPlayerId) : "aguardando");
    const visiblePlayers = players.slice(0, 6);
    const hiddenPlayerCount = Math.max(0, players.length - visiblePlayers.length);
    return `
      <div class="room-card ${isFull ? "full" : ""}">
        <div class="room-info">
          <div class="room-card-top">
            <span class="room-code" title="${escapeAttribute(room.roomId)}">${escapeHtml(shortRoomCode(room.roomId))}</span>
            <span class="room-status ${isFull ? "full" : "open"}">${isFull ? "Cheia" : "Aberta"}</span>
          </div>
          <div class="room-meta-line">
            <span class="room-players"><i data-lucide="users"></i>${room.playerCount}/${room.maxPlayers}</span>
            <span class="room-host"><i data-lucide="crown"></i>${escapeHtml(hostName)}</span>
          </div>
          <div class="room-roster" aria-label="Jogadores na sala">
            ${
              visiblePlayers.length > 0
                ? visiblePlayers
                    .map(
                      (player) => `
                <span class="${player.id === room.hostPlayerId ? "host" : ""}">
                  ${escapeHtml(player.name)}
                  ${player.id === room.hostPlayerId ? "<b>host</b>" : ""}
                </span>
              `
                    )
                    .join("")
                : `<span>Aguardando jogadores</span>`
            }
            ${hiddenPlayerCount > 0 ? `<span>+${hiddenPlayerCount}</span>` : ""}
          </div>
        </div>
        <div class="room-actions">
          <button class="btn btn-sm" type="button" data-action="copy-room" data-room-id="${escapeAttribute(room.roomId)}" title="Copiar roomId" aria-label="Copiar roomId">
            <i data-lucide="copy"></i>
            <span>Copiar</span>
          </button>
          <button class="btn btn-sm btn-primary" type="button" data-action="join-room" data-room-id="${escapeAttribute(room.roomId)}" ${isFull ? "disabled" : ""}>
            <i data-lucide="${isFull ? "lock" : "log-in"}"></i>
            <span>${isFull ? "Sala cheia" : "Entrar"}</span>
          </button>
        </div>
      </div>
    `;
  }

  private async handleCopyRoom(roomId: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(roomId);
      this.setStatus("roomId copiado.");
    } catch {
      this.setStatus(`roomId: ${roomId}`);
    }
  }

  private setMapLabel(onlineMapId: string): void {
    const label = this.modal.querySelector<HTMLElement>('[data-section="map-label"]');
    if (label) {
      label.textContent = `Mapa online: ${shortId(onlineMapId)}`;
      label.title = onlineMapId;
    }
  }

  private setRoomCount(message: string): void {
    const label = this.modal.querySelector<HTMLElement>('[data-section="room-count"]');
    if (label) {
      label.textContent = message;
    }
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

function getFriendlyLobbyError(error: unknown, fallback: string): string {
  if (isLikelyOfflineError(error)) {
    return "Backend offline. Inicie o servidor online e tente novamente.";
  }

  return getErrorMessage(error, fallback);
}

function isLikelyOfflineError(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof Error &&
      /fetch|network|failed to fetch|load failed|connection/i.test(error.message))
  );
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

function shortId(value: string): string {
  return value.length > 16 ? `${value.slice(0, 10)}...${value.slice(-4)}` : value;
}

function shortRoomCode(value: string): string {
  return value.length > 14 ? `${value.slice(0, 9)}...${value.slice(-4)}` : value;
}
