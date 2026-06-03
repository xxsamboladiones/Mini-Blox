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

export class RuntimeHud {
  private readonly root = document.createElement("div");
  private readonly mapLabel = document.createElement("div");
  private readonly healthPanel = document.createElement("div");
  private readonly weaponPanel = document.createElement("div");
  private readonly coinCounter = document.createElement("div");
  private readonly keyInventory = document.createElement("div");
  private readonly inventory = document.createElement("div");
  private readonly actionBar = document.createElement("div");
  private readonly message = document.createElement("div");
  private readonly victoryPanel = document.createElement("div");
  private readonly pausePanel = document.createElement("div");
  private messageTimeout = 0;
  private actions: RuntimeHudActions | null = null;

  constructor(container: HTMLElement) {
    this.root.className = "runtime-hud";
    this.mapLabel.className = "runtime-map-label";
    this.healthPanel.className = "runtime-health-panel";
    this.weaponPanel.className = "runtime-weapon-panel";
    this.coinCounter.className = "runtime-coin-counter";
    this.keyInventory.className = "runtime-key-inventory";
    this.inventory.className = "runtime-inventory";
    this.actionBar.className = "runtime-action-bar";
    this.message.className = "runtime-message";
    this.victoryPanel.className = "runtime-victory hidden";
    this.pausePanel.className = "runtime-pause hidden";

    this.root.append(
      this.mapLabel,
      this.healthPanel,
      this.weaponPanel,
      this.coinCounter,
      this.keyInventory,
      this.inventory,
      this.actionBar,
      this.message,
      this.victoryPanel,
      this.pausePanel
    );
    container.append(this.root);
    this.setMapName("Mini Blox");
    this.setHealth(100, 100);
    this.setWeapon(null);
    this.setCoins(0);
    this.setKeys([]);
    this.setInventory([]);
  }

  setActions(actions: RuntimeHudActions): void {
    this.actions = actions;
    this.actionBar.innerHTML = `
      <button class="top-action" type="button" data-runtime-action="menu">
        <i data-lucide="house"></i>
        <span>Menu</span>
      </button>
      <button class="top-action" type="button" data-runtime-action="restart">
        <i data-lucide="rotate-ccw"></i>
        <span>Reiniciar</span>
      </button>
      <button class="top-action primary" type="button" data-runtime-action="edit">
        <i data-lucide="pencil"></i>
        <span>Editar</span>
      </button>
      <button class="top-action icon-runtime-action" type="button" data-runtime-action="mute" title="Mutar audio" aria-label="Mutar audio">
        <i data-lucide="volume-2"></i>
        <span data-audio-muted-label>Som</span>
      </button>
    `;
    this.actionBar.querySelector<HTMLButtonElement>('[data-runtime-action="menu"]')
      ?.addEventListener("click", actions.onMenu);
    this.actionBar.querySelector<HTMLButtonElement>('[data-runtime-action="restart"]')
      ?.addEventListener("click", actions.onRestart);
    this.actionBar.querySelector<HTMLButtonElement>('[data-runtime-action="edit"]')
      ?.addEventListener("click", actions.onEdit);
    this.actionBar.querySelector<HTMLButtonElement>('[data-runtime-action="mute"]')
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
    this.coinCounter.textContent = typeof total === "number"
      ? `Moedas: ${count}/${total}`
      : `Moedas: ${count}`;
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

  setInventory(items: HudInventoryItem[]): void {
    this.inventory.textContent = items.length === 0
      ? "Itens: vazio"
      : `Itens: ${items.map((item) => `${item.label} x${item.quantity}`).join(" - ")}`;
  }

  setKeys(labels: string[]): void {
    this.keyInventory.textContent = labels.length === 0
      ? "Chaves: nenhuma"
      : `Chaves: ${labels.join(", ")}`;
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
        <strong>Pausado</strong>
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

    this.pausePanel.querySelector<HTMLButtonElement>('[data-pause-action="continue"]')
      ?.addEventListener("click", this.actions.onContinue);
    this.pausePanel.querySelector<HTMLButtonElement>('[data-pause-action="restart"]')
      ?.addEventListener("click", this.actions.onRestart);
    this.pausePanel.querySelector<HTMLButtonElement>('[data-pause-action="edit"]')
      ?.addEventListener("click", this.actions.onEdit);
    this.pausePanel.querySelector<HTMLButtonElement>('[data-pause-action="menu"]')
      ?.addEventListener("click", this.actions.onMenu);
    createIcons({ icons });
  }

  hidePause(): void {
    this.pausePanel.classList.add("hidden");
    this.pausePanel.replaceChildren();
  }

  showVictory(message: string, coinCount: number, actions: VictoryActions): void {
    window.clearTimeout(this.messageTimeout);
    this.message.classList.remove("visible");
    this.hidePause();
    this.victoryPanel.classList.remove("hidden");
    this.victoryPanel.innerHTML = `
      <div class="runtime-victory-content">
        <strong>${escapeHtml(message)}</strong>
        <span>Moedas coletadas: ${coinCount}</span>
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

    this.victoryPanel.querySelector<HTMLButtonElement>('[data-victory-action="restart"]')
      ?.addEventListener("click", actions.onRestart);
    this.victoryPanel.querySelector<HTMLButtonElement>('[data-victory-action="edit"]')
      ?.addEventListener("click", actions.onEdit);
    this.victoryPanel.querySelector<HTMLButtonElement>('[data-victory-action="menu"]')
      ?.addEventListener("click", actions.onMenu);
    createIcons({ icons });
  }

  hideVictory(): void {
    this.victoryPanel.classList.add("hidden");
    this.victoryPanel.replaceChildren();
  }

  dispose(): void {
    window.clearTimeout(this.messageTimeout);
    this.root.remove();
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
