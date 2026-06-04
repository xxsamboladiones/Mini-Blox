import { createIcons, icons } from "lucide";

export type VictoryActions = {
  onRestart: () => void;
  onEdit: () => void;
  onMenu: () => void;
};

export type RuntimeHudActions = VictoryActions & {
  onContinue: () => void;
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
  private readonly actionBar = document.createElement("div");
  private readonly message = document.createElement("div");
  private readonly victoryPanel = document.createElement("div");
  private readonly pausePanel = document.createElement("div");
  private readonly multiplayerPanel = document.createElement("div");
  private messageTimeout = 0;
  private actions: RuntimeHudActions | null = null;
  private objectivesExpanded = false;

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
    this.actionBar.innerHTML = `
      <button class="top-action" type="button" data-runtime-action="menu" title="Menu" aria-label="Menu">
        <i data-lucide="house"></i>
        <span>Menu</span>
      </button>
      <button class="top-action" type="button" data-runtime-action="restart" title="Reiniciar" aria-label="Reiniciar">
        <i data-lucide="rotate-ccw"></i>
        <span>Reiniciar</span>
      </button>
      <button class="top-action primary" type="button" data-runtime-action="edit" title="Editar" aria-label="Editar">
        <i data-lucide="pencil"></i>
        <span>Editar</span>
      </button>
      <button class="top-action icon-runtime-action" type="button" data-runtime-action="mute" title="Mutar audio" aria-label="Mutar audio">
        <i data-lucide="volume-2"></i>
        <span data-audio-muted-label>Som</span>
      </button>
    `;
    this.actionBar
      .querySelector<HTMLButtonElement>('[data-runtime-action="menu"]')
      ?.addEventListener("click", actions.onMenu);
    this.actionBar
      .querySelector<HTMLButtonElement>('[data-runtime-action="restart"]')
      ?.addEventListener("click", actions.onRestart);
    this.actionBar
      .querySelector<HTMLButtonElement>('[data-runtime-action="edit"]')
      ?.addEventListener("click", actions.onEdit);
    this.actionBar
      .querySelector<HTMLButtonElement>('[data-runtime-action="mute"]')
      ?.addEventListener("click", () => actions.onToggleMute?.());
    createIcons({ icons });
  }

  setAudioMuted(muted: boolean): void {
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
    this.mapLabel.textContent = name;
  }

  setCoins(count: number, total?: number): void {
    this.coinCounter.textContent =
      typeof total === "number" ? `Moedas: ${count}/${total}` : `Moedas: ${count}`;
  }

  setHealth(current: number, max: number): void {
    const safeMax = Math.max(1, Math.floor(max));
    const safeCurrent = Math.max(0, Math.min(safeMax, Math.floor(current)));
    const percent = Math.round((safeCurrent / safeMax) * 100);
    this.healthPanel.innerHTML = `
      <span>Vida: ${safeCurrent}/${safeMax}</span>
      <div class="runtime-health-bar" aria-hidden="true">
        <span style="width: ${percent}%"></span>
      </div>
    `;
  }

  setWeapon(label: string | null): void {
    this.weaponPanel.textContent = `Arma: ${label ?? "nenhuma"}`;
  }

  setGameModeStatus(status: GameModeHudStatus | null): void {
    if (!status) {
      this.gameModePanel.classList.add("hidden");
      this.gameModePanel.replaceChildren();
      return;
    }

    const scoreText =
      typeof status.targetScore === "number"
        ? `${status.score}/${status.targetScore}`
        : String(status.score);
    const teamRows =
      status.teamScores.length > 0
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
        : "";
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
        <strong>Modo: ${escapeHtml(status.modeLabel)}</strong>
        <span>${escapeHtml(status.progressLabel)}</span>
      </div>
      <div class="runtime-mode-meta">
        ${status.teamLabel ? `<span>Time: ${escapeHtml(status.teamLabel)}</span>` : ""}
        <span>Pontos: ${scoreText}</span>
        ${typeof status.roundTime === "number" ? `<span>Tempo: ${formatTime(status.roundTime)}</span>` : ""}
      </div>
      ${teamRows}
      ${captureRows}
    `;
  }

  setInventory(items: HudInventoryItem[]): void {
    this.inventory.textContent =
      items.length === 0
        ? "Itens: vazio"
        : `Itens: ${items.map((item) => `${item.label} x${item.quantity}`).join(" - ")}`;
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
    const shownObjectives =
      this.objectivesExpanded || hiddenCount === 0
        ? visibleObjectives
        : visibleObjectives.slice(0, 3);

    this.objectivesPanel.innerHTML = `
      <div class="runtime-objectives-heading">
        <div>
          <span class="runtime-objectives-kicker">Objetivos</span>
          <strong>${visibleObjectives.filter((objective) => objective.completed).length}/${visibleObjectives.length}</strong>
        </div>
        ${
          hiddenCount > 0
            ? `
          <button class="runtime-objectives-toggle" type="button" data-objectives-toggle>
            ${this.objectivesExpanded ? "Ver menos" : `Ver mais ${hiddenCount}`}
          </button>
        `
            : ""
        }
      </div>
      <div class="runtime-objectives-list">
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
    `;

    this.objectivesPanel
      .querySelector<HTMLButtonElement>("[data-objectives-toggle]")
      ?.addEventListener("click", () => {
        this.objectivesExpanded = !this.objectivesExpanded;
        this.setObjectives(objectives);
      });
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
    this.keyInventory.textContent =
      labels.length === 0 ? "Chaves: nenhuma" : `Chaves: ${labels.join(", ")}`;
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
    this.victoryPanel.innerHTML = `
      <div class="runtime-victory-content">
        <div class="runtime-overlay-heading">
          <strong>${escapeHtml(message)}</strong>
          <span>Moedas coletadas: ${coinCount}</span>
        </div>
        ${
          summary
            ? `
          <div class="runtime-victory-summary">
            <span>Modo: ${escapeHtml(summary.mode)}</span>
            ${summary.teamName ? `<span>Time: ${escapeHtml(summary.teamName)}</span>` : ""}
            <span>Pontos: ${summary.score}</span>
            <span>Inimigos: ${summary.enemiesDefeated}</span>
            <span>Objetivos: ${summary.objectivesCompleted}</span>
            <span>Mortes: ${summary.deaths}</span>
            ${summary.capturePointsOwned > 0 ? `<span>Pontos capturados: ${summary.capturePointsOwned}</span>` : ""}
          </div>
        `
            : ""
        }
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

  setMultiplayerInfo(roomId: string, playerCount: number, onLeaveRoom: () => void): void {
    this.multiplayerPanel.classList.remove("hidden");
    this.multiplayerPanel.innerHTML = `
      <div class="multiplayer-info">
        <span class="multiplayer-state">Multiplayer ativo</span>
        <span class="room-id" title="${escapeAttribute(roomId)}">Sala: ${escapeHtml(shortRoomId(roomId))}</span>
        <span class="player-count">${playerCount} jogadores</span>
        <span class="runtime-sync-state">Estado sincronizado</span>
      </div>
      <button class="top-action danger" type="button" data-multiplayer-action="leave">
        <i data-lucide="log-out"></i>
        <span>Sair da Sala</span>
      </button>
    `;

    this.multiplayerPanel
      .querySelector<HTMLButtonElement>('[data-multiplayer-action="leave"]')
      ?.addEventListener("click", onLeaveRoom);
    createIcons({ icons });
  }

  hideMultiplayerInfo(): void {
    this.multiplayerPanel.classList.add("hidden");
    this.multiplayerPanel.replaceChildren();
  }

  updatePlayerCount(count: number): void {
    const playerCountEl = this.multiplayerPanel.querySelector(".player-count");
    if (playerCountEl) {
      playerCountEl.textContent = `${count} jogadores`;
    }
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
