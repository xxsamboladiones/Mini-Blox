import { createIcons, icons } from "lucide";
import { GameRuntime } from "../../engine/GameRuntime";
import { LocalMapMetadataStorage } from "../../storage/LocalMapMetadataStorage";
import type { GameMap } from "../../shared/types/MapSchema";
import type { PlayScreenActions, Screen } from "../AppState";

export class PlayScreen implements Screen {
  private runtime: GameRuntime | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly map: GameMap,
    private readonly actions: PlayScreenActions
  ) {}

  render(): void {
    this.root.innerHTML = `
      <div class="play-shell">
        <header class="screen-header play-header">
          <div>
            <strong>${escapeHtml(this.map.name)}</strong>
            <span>Modo jogar</span>
          </div>
          <div class="top-actions">
            <button class="top-action" type="button" data-action="menu" data-play-action="menu">
              <i data-lucide="house"></i>
              <span>Voltar ao Menu</span>
            </button>
            <button class="top-action primary" type="button" data-action="edit" data-play-action="edit">
              <i data-lucide="pencil"></i>
              <span>Editar este mapa</span>
            </button>
          </div>
        </header>
        <div class="play-exit-bar" aria-label="Controles do jogo">
          <button class="top-action" type="button" data-action="menu" data-play-action="menu">
            <i data-lucide="house"></i>
            <span>Voltar ao Menu</span>
          </button>
          <button class="top-action primary" type="button" data-action="edit" data-play-action="edit">
            <i data-lucide="pencil"></i>
            <span>Editar este mapa</span>
          </button>
        </div>
        <main id="play-root" class="play-root"></main>
      </div>
    `;

    this.root.addEventListener("click", this.handleClick);

    const playRoot = this.root.querySelector<HTMLElement>("#play-root");

    if (!playRoot) {
      throw new Error("Missing #play-root element.");
    }

    this.runtime = new GameRuntime(playRoot, {
      onBackToMenu: this.actions.onBackToMenu,
      onEditMap: (map) => this.actions.onEditMap(map),
      onMapCompleted: ({ map, coinsCollected }) => {
        LocalMapMetadataStorage.recordCompletion(map.id, coinsCollected);
      }
    });
    LocalMapMetadataStorage.recordPlay(this.map.id);
    void this.runtime.loadMap(this.map);
    createIcons({ icons });
  }

  destroy(): void {
    this.root.removeEventListener("click", this.handleClick);
    this.runtime?.dispose();
  }

  private readonly handleClick = (event: MouseEvent): void => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-play-action]");

    if (!button || !this.root.contains(button)) {
      return;
    }

    event.preventDefault();

    if (button.dataset.playAction === "menu") {
      this.actions.onBackToMenu();
    } else if (button.dataset.playAction === "edit") {
      this.actions.onEditMap(this.map);
    }
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
