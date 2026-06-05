import { createIcons, icons } from "lucide";
import type { ChatMessage } from "../shared/types/MultiplayerSchema.js";

export type VictoryActions = {
  onRestart: () => void;
  onEdit: () => void;
  onMenu: () => void;
};

export type RuntimeHudActions = VictoryActions & {
  onContinue: () => void;
  onPause?: () => void;
  onToggleMute?: () => void;
};

export type HudInventoryItem = {
  label: string;
  quantity: number;
};

export type HudObjectiveState = {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  progress?: number;
  target?: number;
  required: boolean;
};

export type GameModeHudStatus = {
  modeLabel: string;
  teamLabel?: string;
  score: number;
  targetScore?: number;
  progressLabel: string;
  roundTime?: number;
  teamScores: Array<{
    id: string;
    name: string;
    color: string;
    score: number;
  }>;
  capturePoints: Array<{
    id: string;
    label: string;
    ownerLabel: string;
    progress: number;
  }>;
};

export type RuntimeWeaponHudInfo = {
  label: string;
  typeLabel: string;
  cooldownProgress: number;
};

export type GameModeSummary = {
  mode: string;
  teamName?: string;
  score: number;
  teamScores: Array<{
    id: string;
    name: string;
    color: string;
    score: number;
  }>;
  coinsCollected: number;
  enemiesDefeated: number;
  deaths: number;
  objectivesCompleted: number;
  capturePointsOwned: number;
};

export type MultiplayerHudPlayer = {
  id: string;
  name: string;
  isLocal: boolean;
  isHost: boolean;
};

export type MultiplayerHudInfo = {
  roomId: string;
  playerCount: number;
  hostPlayerId: string | null;
  localPlayerId: string | null;
  players: MultiplayerHudPlayer[];
};

export class RuntimeHud {
  private readonly root = document.createElement("div");
  private readonly topLeftCluster = document.createElement("div");
  private readonly bottomLeftCluster = document.createElement("div");
  private readonly bottomRightCluster = document.createElement("div");
  private readonly mapLabel = document.createElement("div");
  private readonly healthPanel = document.createElement("div");
  private readonly weaponPanel = document.createElement("div");
  private readonly gameModePanel = document.createElement("div");
  private readonly coinCounter = document.createElement("div");
  private readonly keyInventory = document.createElement("div");
  private readonly inventory = document.createElement("div");
  private readonly objectivesPanel = document.createElement("div");
  private readonly dialoguePanel = document.createElement("div");
  private readonly chatPanel = document.createElement("div");
  private readonly actionBar = document.createElement("div");
  private readonly message = document.createElement("div");
  private readonly victoryPanel = document.createElement("div");
  private readonly pausePanel = document.createElement("div");
  private readonly multiplayerPanel = document.createElement("div");
  private messageTimeout = 0;
  private actions: RuntimeHudActions | null = null;
  private objectivesExpanded = false;
  private objectivesCollapsed = false;
  private chatMessages: ChatMessage[] = [];
  private chatSendCallback: ((text: string) => void) | null = null;
  private chatCollapsed = true;
  private audioMuted = false;
  private coinState: { count: number; total?: number } = { count: 0 };
  private gameModeStatus: GameModeHudStatus | null = null;
  private multiplayerInfo: (MultiplayerHudInfo & { onLeaveRoom: () => void }) | null = null;

  constructor(container: HTMLElement) {
    this.root.className = "runtime-hud";
    this.topLeftCluster.className = "runtime-top-left";
    this.bottomLeftCluster.className = "runtime-bottom-left";
    this.bottomRightCluster.className = "runtime-bottom-right";
    this.mapLabel.className = "runtime-map-label";
    this.healthPanel.className = "runtime-health-panel";
    this.weaponPanel.className = "runtime-weapon-panel";
    this.gameModePanel.className = "runtime-game-mode-panel";
    this.coinCounter.className = "runtime-coin-counter";
    this.keyInventory.className = "runtime-key-inventory";
    this.inventory.className = "runtime-inventory";
    this.objectivesPanel.className = "runtime-objectives hidden";
    this.dialoguePanel.className = "runtime-dialogue hidden";
    this.chatPanel.className = "runtime-chat hidden collapsed";
    this.actionBar.className = "runtime-action-bar";
    this.message.className = "runtime-message";
    this.victoryPanel.className = "runtime-victory hidden";
    this.pausePanel.className = "runtime-pause hidden";
    this.multiplayerPanel.className = "runtime-multiplayer-panel hidden";

    this.topLeftCluster.append(this.mapLabel, this.gameModePanel, this.multiplayerPanel);
    this.bottomLeftCluster.append(
      this.healthPanel,
      this.weaponPanel,
      this.keyInventory,
      this.inventory
    );
    this.bottomRightCluster.append(this.coinCounter);

    this.root.append(
      this.topLeftCluster,
      this.bottomLeftCluster,
      this.bottomRightCluster,
      this.objectivesPanel,
      this.actionBar,
      this.chatPanel,
      this.message,
      this.dialoguePanel,
      this.victoryPanel,
      this.pausePanel
    );
    container.append(this.root);

    this.setMapName("Mini Blox");
    this.setHealth(100, 100);
    this.setWeapon(null);
    this.setGameModeStatus(null);
    this.setCoins(0);
    this.setKeys([]);
    this.setInventory([]);
    this.setObjectives([]);
  }

  setActions(actions: RuntimeHudActions): void {
    this.actions = actions;
    this.renderActionBar();
  }

  private renderActionBar(): void {
    if (!this.actions) {
      this.actionBar.replaceChildren();
      return;
    }

    const leaveButton = this.multiplayerInfo
      ? `
      <button class="top-action danger" type="button" data-runtime-action="leave-room" title="Sair da sala" aria-label="Sair da sala">
        <i data-lucide="log-out"></i>
        <span>Sair</span>
      </button>
    `
      : "";

    this.actionBar.innerHTML = `
      <button class="top-action" type="button" data-runtime-action="pause" title="Pausar" aria-label="Pausar">
        <i data-lucide="pause"></i>
        <span>Pausar</span>
      </button>
      <button class="top-action icon-runtime-action" type="button" data-runtime-action="mute" title="Mutar audio" aria-label="Mutar audio">
        <i data-lucide="${this.audioMuted ? "volume-x" : "volume-2"}"></i>
        <span data-audio-muted-label>${this.audioMuted ? "Mudo" : "Som"}</span>
      </button>
      ${leaveButton}
    `;
    this.actionBar
      .querySelector<HTMLButtonElement>('[data-runtime-action="pause"]')
      ?.addEventListener("click", () => this.actions?.onPause?.());
    this.actionBar
      .querySelector<HTMLButtonElement>('[data-runtime-action="mute"]')
      ?.addEventListener("click", () => this.actions?.onToggleMute?.());
    this.actionBar
      .querySelector<HTMLButtonElement>('[data-runtime-action="leave-room"]')
      ?.addEventListener("click", () => this.multiplayerInfo?.onLeaveRoom());
    createIcons({ icons });
  }

  setAudioMuted(muted: boolean): void {
    this.audioMuted = muted;
    const button = this.actionBar.querySelector<HTMLButtonElement>('[data-runtime-action="mute"]');
    const label = this.actionBar.querySelector<HTMLElement>("[data-audio-muted-label]");
    const icon = button?.querySelector<HTMLElement>("[data-lucide]");

    if (button) {
      button.classList.toggle("active", muted);
      button.title = muted ? "Ativar audio" : "Mutar audio";
      button.setAttribute("aria-label", button.title);
    }

    if (label) {
      label.textContent = muted ? "Mudo" : "Som";
    }

    if (icon) {
      icon.setAttribute("data-lucide", muted ? "volume-x" : "volume-2");
      createIcons({ icons });
    }
  }

  setMapName(name: string): void {
    this.mapLabel.innerHTML = `
      <span class="runtime-card-label">Mapa</span>
      <strong>${escapeHtml(name)}</strong>
    `;
  }

  setCoins(count: number, total?: number): void {
    this.coinState = typeof total === "number" ? { count, total } : { count };
    this.renderStatsPanel();
  }

  setHealth(current: number, max: number): void {
    const safeMax = Math.max(1, Math.floor(max));
    const safeCurrent = Math.max(0, Math.min(safeMax, Math.floor(current)));
    const percent = Math.round((safeCurrent / safeMax) * 100);
    this.healthPanel.innerHTML = `
      <div class="runtime-health-readout">
        <span class="runtime-card-label">Vida</span>
        <strong>${safeCurrent}/${safeMax}</strong>
      </div>
      <div class="runtime-health-bar" aria-hidden="true">
        <span style="width: ${percent}%"></span>
      </div>
    `;
  }

  setWeapon(weapon: RuntimeWeaponHudInfo | string | null): void {
    if (!weapon) {
      this.weaponPanel.innerHTML = `
        <span class="runtime-card-label">Arma</span>
        <strong>Nenhuma</strong>
      `;
      return;
    }

    const info =
      typeof weapon === "string"
        ? { label: weapon, typeLabel: "", cooldownProgress: 1 }
        : {
            label: weapon.label,
            typeLabel: weapon.typeLabel,
            cooldownProgress: Math.max(0, Math.min(1, weapon.cooldownProgress)),
          };

    this.weaponPanel.innerHTML = `
      <span class="runtime-card-label">Arma</span>
      <strong>${escapeHtml(info.label)}</strong>
      ${info.typeLabel ? `<span class="runtime-weapon-meta">${escapeHtml(info.typeLabel)}</span>` : ""}
      <div class="runtime-weapon-cooldown" aria-hidden="true">
        <span style="width: ${Math.round(info.cooldownProgress * 100)}%"></span>
      </div>
    `;
  }

  setWeaponCooldown(progress: number): void {
    const bar = this.weaponPanel.querySelector<HTMLElement>(".runtime-weapon-cooldown span");
    if (!bar) {
      return;
    }

    const safeProgress = Math.max(0, Math.min(1, progress));
    bar.style.width = `${Math.round(safeProgress * 100)}%`;
  }

  setGameModeStatus(status: GameModeHudStatus | null): void {
    this.gameModeStatus = status;
    this.renderStatsPanel();

    if (!status) {
      this.gameModePanel.classList.add("hidden");
      this.gameModePanel.replaceChildren();
      return;
    }

    const captureRows =
      status.capturePoints.length > 0
        ? `
        <div class="runtime-mode-captures">
          ${status.capturePoints
            .map(
              (point) => `
            <span>${escapeHtml(point.label)}: ${escapeHtml(point.ownerLabel)} ${Math.round(point.progress * 100)}%</span>
          `
            )
            .join("")}
        </div>
      `
        : "";

    this.gameModePanel.classList.remove("hidden");
    this.gameModePanel.innerHTML = `
      <div class="runtime-mode-main">
        <span class="runtime-card-label">Modo</span>
        <strong>${escapeHtml(status.modeLabel)}</strong>
        <span>${escapeHtml(status.progressLabel)}</span>
      </div>
      ${captureRows}
    `;
  }

  setInventory(items: HudInventoryItem[]): void {
    this.inventory.classList.toggle("hidden", items.length === 0);
    this.inventory.innerHTML =
      items.length === 0
        ? ""
        : `
        <span class="runtime-card-label">Itens</span>
        <strong>${items.map((item) => `${escapeHtml(item.label)} x${item.quantity}`).join(" - ")}</strong>
      `;
  }

  setObjectives(objectives: HudObjectiveState[]): void {
    const visibleObjectives = objectives.filter(
      (objective) => objective.required || !objective.completed
    );
    this.objectivesPanel.classList.toggle("hidden", visibleObjectives.length === 0);

    if (visibleObjectives.length === 0) {
      this.objectivesExpanded = false;
      this.objectivesPanel.replaceChildren();
      return;
    }

    const hiddenCount = Math.max(0, visibleObjectives.length - 3);
    const shownObjectives = this.objectivesCollapsed
      ? []
      : this.objectivesExpanded || hiddenCount === 0
        ? visibleObjectives
        : visibleObjectives.slice(0, 3);

    this.objectivesPanel.innerHTML = `
      <div class="runtime-objectives-heading">
        <div>
          <span class="runtime-objectives-kicker">Objetivos</span>
          <strong>${visibleObjectives.filter((objective) => objective.completed).length}/${visibleObjectives.length}</strong>
        </div>
        <button class="runtime-objectives-icon-toggle" type="button" data-objectives-collapse title="${this.objectivesCollapsed ? "Abrir objetivos" : "Recolher objetivos"}" aria-label="${this.objectivesCollapsed ? "Abrir objetivos" : "Recolher objetivos"}">
          <i data-lucide="${this.objectivesCollapsed ? "panel-right-open" : "panel-right-close"}"></i>
        </button>
      </div>
      <div class="runtime-objectives-list ${this.objectivesCollapsed ? "hidden" : ""}">
        ${shownObjectives
          .map(
            (objective) => `
          <div class="runtime-objective-row ${objective.completed ? "completed" : ""}">
            <span class="runtime-objective-state">${objective.completed ? "OK" : ""}</span>
            <div>
              <strong>${escapeHtml(objective.title)}</strong>
              <small>
                ${escapeHtml(getObjectiveDetail(objective))}
                <b>${objective.required ? "Obrig." : "Opc."}</b>
              </small>
            </div>
          </div>
        `
          )
          .join("")}
      </div>
      ${
        !this.objectivesCollapsed && hiddenCount > 0
          ? `
        <button class="runtime-objectives-toggle" type="button" data-objectives-toggle>
          ${this.objectivesExpanded ? "Ver menos" : `Ver mais ${hiddenCount}`}
        </button>
      `
          : ""
      }
    `;

    this.objectivesPanel
      .querySelector<HTMLButtonElement>("[data-objectives-collapse]")
      ?.addEventListener("click", () => {
        this.objectivesCollapsed = !this.objectivesCollapsed;
        this.setObjectives(objectives);
      });
    this.objectivesPanel
      .querySelector<HTMLButtonElement>("[data-objectives-toggle]")
      ?.addEventListener("click", () => {
        this.objectivesExpanded = !this.objectivesExpanded;
        this.setObjectives(objectives);
      });
    createIcons({ icons });
  }

  showDialogue(speaker: string, line: string, hasNext: boolean): void {
    this.dialoguePanel.classList.remove("hidden");
    this.dialoguePanel.innerHTML = `
      <div class="runtime-dialogue-speaker">${escapeHtml(speaker)}</div>
      <div class="runtime-dialogue-line">${escapeHtml(line)}</div>
      <div class="runtime-dialogue-hint">${hasNext ? "Pressione E para continuar" : "Pressione E para fechar"}</div>
    `;
  }

  hideDialogue(): void {
    this.dialoguePanel.classList.add("hidden");
    this.dialoguePanel.replaceChildren();
  }

  setKeys(labels: string[]): void {
    this.keyInventory.classList.toggle("hidden", labels.length === 0);
    this.keyInventory.innerHTML =
      labels.length === 0
        ? ""
        : `
        <span class="runtime-card-label">Chaves</span>
        <strong>${labels.map(escapeHtml).join(", ")}</strong>
      `;
  }

  showMessage(text: string, durationMs = 1800): void {
    window.clearTimeout(this.messageTimeout);
    this.message.textContent = text;
    this.message.classList.add("visible");
    this.messageTimeout = window.setTimeout(() => {
      this.message.classList.remove("visible");
    }, durationMs);
  }

  showPause(): void {
    if (!this.actions) {
      return;
    }

    this.pausePanel.classList.remove("hidden");
    this.pausePanel.innerHTML = `
      <div class="runtime-pause-content">
        <div class="runtime-overlay-heading">
          <strong>Pausado</strong>
          <span>${this.multiplayerPanel.classList.contains("hidden") ? "Solo" : "Multiplayer"}</span>
        </div>
        <div class="runtime-pause-actions">
          <button class="top-action primary" type="button" data-pause-action="continue">
            <i data-lucide="play"></i>
            <span>Continuar</span>
          </button>
          <button class="top-action" type="button" data-pause-action="restart">
            <i data-lucide="rotate-ccw"></i>
            <span>Reiniciar mapa</span>
          </button>
          <button class="top-action" type="button" data-pause-action="edit">
            <i data-lucide="pencil"></i>
            <span>Editar mapa</span>
          </button>
          <button class="top-action" type="button" data-pause-action="menu">
            <i data-lucide="house"></i>
            <span>Voltar ao menu</span>
          </button>
        </div>
      </div>
    `;

    this.pausePanel
      .querySelector<HTMLButtonElement>('[data-pause-action="continue"]')
      ?.addEventListener("click", this.actions.onContinue);
    this.pausePanel
      .querySelector<HTMLButtonElement>('[data-pause-action="restart"]')
      ?.addEventListener("click", this.actions.onRestart);
    this.pausePanel
      .querySelector<HTMLButtonElement>('[data-pause-action="edit"]')
      ?.addEventListener("click", this.actions.onEdit);
    this.pausePanel
      .querySelector<HTMLButtonElement>('[data-pause-action="menu"]')
      ?.addEventListener("click", this.actions.onMenu);
    createIcons({ icons });
  }

  hidePause(): void {
    this.pausePanel.classList.add("hidden");
    this.pausePanel.replaceChildren();
  }

  showVictory(
    message: string,
    coinCount: number,
    actions: VictoryActions,
    summary?: GameModeSummary
  ): void {
    window.clearTimeout(this.messageTimeout);
    this.message.classList.remove("visible");
    this.hidePause();
    this.hideDialogue();
    this.victoryPanel.classList.remove("hidden");
    const stats = buildVictoryStats(summary, coinCount, this.multiplayerInfo?.playerCount ?? null);
    this.victoryPanel.innerHTML = `
      <div class="runtime-victory-content">
        <div class="runtime-overlay-heading">
          <strong>${escapeHtml(message)}</strong>
          <span>${summary ? escapeHtml(getModeSummaryLabel(summary)) : "Mapa concluido"}</span>
        </div>
        <div class="runtime-victory-summary">
          ${stats
            .map(
              (stat) => `
            <span>
              <small>${escapeHtml(stat.label)}</small>
              <strong>${escapeHtml(stat.value)}</strong>
            </span>
          `
            )
            .join("")}
        </div>
        ${summary && summary.teamScores.length > 0 ? renderVictoryTeams(summary) : ""}
        <div class="runtime-victory-actions">
          <button class="top-action primary" type="button" data-victory-action="restart">
            <i data-lucide="rotate-ccw"></i>
            <span>Jogar novamente</span>
          </button>
          <button class="top-action" type="button" data-victory-action="edit">
            <i data-lucide="pencil"></i>
            <span>Editar mapa</span>
          </button>
          <button class="top-action" type="button" data-victory-action="menu">
            <i data-lucide="house"></i>
            <span>Voltar ao menu</span>
          </button>
        </div>
      </div>
    `;

    this.victoryPanel
      .querySelector<HTMLButtonElement>('[data-victory-action="restart"]')
      ?.addEventListener("click", actions.onRestart);
    this.victoryPanel
      .querySelector<HTMLButtonElement>('[data-victory-action="edit"]')
      ?.addEventListener("click", actions.onEdit);
    this.victoryPanel
      .querySelector<HTMLButtonElement>('[data-victory-action="menu"]')
      ?.addEventListener("click", actions.onMenu);
    createIcons({ icons });
  }

  hideVictory(): void {
    this.victoryPanel.classList.add("hidden");
    this.victoryPanel.replaceChildren();
  }

  dispose(): void {
    window.clearTimeout(this.messageTimeout);
    this.hideDialogue();
    this.root.remove();
  }

  setMultiplayerInfo(info: MultiplayerHudInfo, onLeaveRoom: () => void): void {
    this.multiplayerInfo = { ...info, onLeaveRoom };
    this.multiplayerPanel.classList.remove("hidden");
    this.renderMultiplayerPanel();
    this.renderActionBar();
  }

  private renderMultiplayerPanel(): void {
    if (!this.multiplayerInfo) {
      this.multiplayerPanel.replaceChildren();
      return;
    }

    const hostName =
      this.multiplayerInfo.players.find(
        (player) => player.id === this.multiplayerInfo?.hostPlayerId
      )?.name ??
      (this.multiplayerInfo.hostPlayerId
        ? shortRoomId(this.multiplayerInfo.hostPlayerId)
        : "aguardando");
    const visiblePlayers = this.multiplayerInfo.players.slice(0, 5);
    const hiddenCount = Math.max(0, this.multiplayerInfo.players.length - visiblePlayers.length);

    this.multiplayerPanel.innerHTML = `
      <div class="runtime-multiplayer-heading">
        <span class="runtime-card-label">Sala</span>
        <strong title="${escapeAttribute(this.multiplayerInfo.roomId)}">${escapeHtml(shortRoomId(this.multiplayerInfo.roomId))}</strong>
      </div>
      <div class="multiplayer-info">
        <span class="multiplayer-state">Online</span>
        <span class="player-count">${this.multiplayerInfo.playerCount} jogadores</span>
        <span class="room-host">Host: ${escapeHtml(hostName)}</span>
      </div>
      <div class="runtime-player-roster">
        ${visiblePlayers
          .map(
            (player) => `
          <span class="${player.isLocal ? "local" : ""} ${player.isHost ? "host" : ""}">
            ${escapeHtml(player.name)}
            ${player.isLocal ? "<b>voce</b>" : ""}
            ${player.isHost ? "<b>host</b>" : ""}
          </span>
        `
          )
          .join("")}
        ${hiddenCount > 0 ? `<span>+${hiddenCount}</span>` : ""}
      </div>
    `;
  }

  hideMultiplayerInfo(): void {
    this.multiplayerInfo = null;
    this.multiplayerPanel.classList.add("hidden");
    this.multiplayerPanel.replaceChildren();
    this.renderActionBar();
  }

  updatePlayerCount(count: number): void {
    if (this.multiplayerInfo) {
      this.multiplayerInfo.playerCount = count;
      this.renderMultiplayerPanel();
    }
  }

  setChatEnabled(enabled: boolean, onSend?: (text: string) => void): void {
    this.chatSendCallback = enabled ? (onSend ?? null) : null;
    this.chatPanel.classList.toggle("hidden", !enabled);

    if (!enabled) {
      this.chatPanel.replaceChildren();
      return;
    }

    this.renderChat();
  }

  setChatMessages(messages: ChatMessage[]): void {
    this.chatMessages = messages.slice(-50);
    this.updateChatCount();

    if (this.chatCollapsed) {
      this.renderChat();
      return;
    }

    this.renderChatMessages();
  }

  focusChat(): void {
    if (this.chatPanel.classList.contains("hidden")) {
      return;
    }

    this.chatCollapsed = false;
    this.renderChat();
    this.chatPanel.querySelector<HTMLInputElement>("[data-chat-input]")?.focus();
  }

  blurChat(): void {
    this.chatPanel.querySelector<HTMLInputElement>("[data-chat-input]")?.blur();
    if (!this.chatCollapsed) {
      this.chatCollapsed = true;
      this.renderChat();
    }
  }

  isChatFocused(): boolean {
    return document.activeElement === this.chatPanel.querySelector("[data-chat-input]");
  }

  private renderChat(): void {
    if (this.chatPanel.classList.contains("hidden")) {
      return;
    }

    this.chatPanel.classList.toggle("collapsed", this.chatCollapsed);
    this.chatPanel.innerHTML = `
      <div class="runtime-chat-header">
        <button class="runtime-chat-toggle" type="button" data-chat-toggle title="${this.chatCollapsed ? "Abrir chat" : "Recolher chat"}" aria-label="${this.chatCollapsed ? "Abrir chat" : "Recolher chat"}">
          <i data-lucide="${this.chatCollapsed ? "message-circle" : "chevron-down"}"></i>
        </button>
        <span>Chat</span>
        <small data-chat-count>${this.chatMessages.length}</small>
      </div>
      <div class="runtime-chat-body">
        <div class="runtime-chat-messages" data-chat-messages></div>
        <form class="runtime-chat-form" data-chat-form>
          <input data-chat-input type="text" maxlength="200" autocomplete="off" placeholder="Mensagem da sala" />
          <button class="top-action icon-runtime-action" type="submit" title="Enviar" aria-label="Enviar mensagem">
            <i data-lucide="send"></i>
          </button>
        </form>
      </div>
    `;

    this.chatPanel
      .querySelector<HTMLButtonElement>("[data-chat-toggle]")
      ?.addEventListener("click", () => {
        this.chatCollapsed = !this.chatCollapsed;
        this.renderChat();
        if (!this.chatCollapsed) {
          this.chatPanel.querySelector<HTMLInputElement>("[data-chat-input]")?.focus();
        }
      });
    this.chatPanel
      .querySelector<HTMLFormElement>("[data-chat-form]")
      ?.addEventListener("submit", (event) => {
        event.preventDefault();
        const input = this.chatPanel.querySelector<HTMLInputElement>("[data-chat-input]");
        const text = input?.value.trim() ?? "";
        if (!text) {
          return;
        }

        this.chatSendCallback?.(text);
        if (input) {
          input.value = "";
          input.focus();
        }
      });

    this.renderChatMessages();
    createIcons({ icons });
  }

  private renderChatMessages(): void {
    const messagesEl = this.chatPanel.querySelector<HTMLElement>("[data-chat-messages]");
    if (!messagesEl) {
      return;
    }

    messagesEl.innerHTML =
      this.chatMessages.length === 0
        ? `<span class="runtime-chat-empty">Sem mensagens.</span>`
        : this.chatMessages
            .map(
              (message) => `
          <div class="runtime-chat-message ${message.type}">
            <div>
              <strong>${escapeHtml(message.type === "system" ? "Sistema" : message.playerName)}</strong>
              <time>${formatChatTime(message.createdAt)}</time>
            </div>
            <span>${escapeHtml(message.text)}</span>
          </div>
        `
            )
            .join("");
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  private updateChatCount(): void {
    const countEl = this.chatPanel.querySelector<HTMLElement>("[data-chat-count]");
    if (countEl) {
      countEl.textContent = String(this.chatMessages.length);
    }
  }

  private renderStatsPanel(): void {
    const status = this.gameModeStatus;
    const scoreText = status
      ? typeof status.targetScore === "number"
        ? `${status.score}/${status.targetScore}`
        : String(status.score)
      : null;
    const coinText =
      typeof this.coinState.total === "number"
        ? `${this.coinState.count}/${this.coinState.total}`
        : String(this.coinState.count);

    this.coinCounter.innerHTML = `
      <div class="runtime-stats-grid">
        <span>
          <small>Moedas</small>
          <strong>${escapeHtml(coinText)}</strong>
        </span>
        ${
          scoreText
            ? `
          <span>
            <small>Score</small>
            <strong>${escapeHtml(scoreText)}</strong>
          </span>
        `
            : ""
        }
        ${
          status?.teamLabel
            ? `
          <span>
            <small>Time</small>
            <strong>${escapeHtml(status.teamLabel)}</strong>
          </span>
        `
            : ""
        }
        ${
          typeof status?.roundTime === "number"
            ? `
          <span>
            <small>Tempo</small>
            <strong>${formatTime(status.roundTime)}</strong>
          </span>
        `
            : ""
        }
      </div>
      ${
        status && status.teamScores.length > 0
          ? `
        <div class="runtime-mode-teams">
          ${status.teamScores
            .map(
              (team) => `
            <span><b style="background:${escapeAttribute(team.color)}"></b>${escapeHtml(team.name)} ${team.score}</span>
          `
            )
            .join("")}
        </div>
      `
          : ""
      }
    `;
  }
}

function getObjectiveDetail(objective: HudObjectiveState): string {
  if (objective.progress !== undefined && objective.target !== undefined) {
    return `${Math.min(objective.progress, objective.target)}/${objective.target}`;
  }

  return objective.description ?? (objective.completed ? "Concluido" : "Pendente");
}

function shortRoomId(roomId: string): string {
  return roomId.length > 12 ? `${roomId.slice(0, 8)}...${roomId.slice(-4)}` : roomId;
}

function buildVictoryStats(
  summary: GameModeSummary | undefined,
  coinCount: number,
  playerCount: number | null
): Array<{ label: string; value: string }> {
  const stats = [
    { label: "Score", value: String(summary?.score ?? 0) },
    { label: "Moedas", value: String(summary?.coinsCollected ?? coinCount) },
    { label: "Kills", value: String(summary?.enemiesDefeated ?? 0) },
    { label: "Deaths", value: String(summary?.deaths ?? 0) },
    { label: "Objetivos", value: String(summary?.objectivesCompleted ?? 0) },
  ];

  if (summary?.capturePointsOwned) {
    stats.push({ label: "Capturas", value: String(summary.capturePointsOwned) });
  }

  if (playerCount !== null) {
    stats.push({ label: "Players", value: String(playerCount) });
  }

  return stats;
}

function getModeSummaryLabel(summary: GameModeSummary): string {
  return summary.teamName ? `${summary.mode} - ${summary.teamName}` : summary.mode;
}

function renderVictoryTeams(summary: GameModeSummary): string {
  return `
    <div class="runtime-victory-teams">
      ${summary.teamScores
        .map(
          (team) => `
        <span><b style="background:${escapeAttribute(team.color)}"></b>${escapeHtml(team.name)} ${team.score}</span>
      `
        )
        .join("")}
    </div>
  `;
}

function formatChatTime(value: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
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

function formatTime(value: number): string {
  const seconds = Math.max(0, Math.ceil(value));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}
