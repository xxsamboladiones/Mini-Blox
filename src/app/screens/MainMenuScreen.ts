import { createIcons, icons } from "lucide";
import { LocalMapMetadataStorage } from "../../storage/LocalMapMetadataStorage";
import { LocalProfileStorage, type AvatarColors } from "../../storage/LocalProfileStorage";
import { MapStorage } from "../../storage/MapStorage";
import { AuthModal } from "../AuthModal";
import { AuthService } from "../../services/AuthService";
import { MAP_TEMPLATE_METADATA, type MapTemplateId } from "../../shared/MapTemplateMetadata";
import type { MainMenuActions, Screen } from "../AppState";

export class MainMenuScreen implements Screen {
  private readonly authModal = new AuthModal();

  constructor(
    private readonly root: HTMLElement,
    private readonly actions: MainMenuActions
  ) {}

  render(): void {
    const maps = MapStorage.getAllMaps();
    const lastEditedMap = MapStorage.getLastMap();
    const favoriteCount = maps.filter((map) => LocalMapMetadataStorage.isFavorite(map.id)).length;
    const publishedCount = maps.filter((map) => map.isPublished).length;
    const lastPlayedMapId = LocalMapMetadataStorage.getLastPlayedMapId();
    const lastPlayedMap = lastPlayedMapId ? MapStorage.getMap(lastPlayedMapId) : null;
    const profile = LocalProfileStorage.getProfile();
    const onlineUser = AuthService.getCurrentUser();

    this.root.innerHTML = `
      <main class="menu-screen">
        <section class="menu-platform" aria-labelledby="menu-title">
          <div class="menu-identity">
            <div class="menu-brand-mark">MB</div>
            <div>
              <h1 id="menu-title">Mini Blox</h1>
              <span>Construa, teste e jogue mapas locais.</span>
            </div>
          </div>

          <div class="menu-profile-card">
            ${renderMiniAvatar(profile.avatarColors)}
            <div class="menu-profile-copy">
              <strong>${escapeHtml(profile.displayName)}</strong>
              <span>${escapeHtml(onlineUser ? `Online: ${onlineUser.displayName}` : profile.bio || "Perfil local")}</span>
            </div>
            <button class="small-action" type="button" data-action="profile">
              <i data-lucide="user-round"></i>
              <span>Perfil</span>
            </button>
            <button class="small-action" type="button" data-action="${onlineUser ? "auth-logout" : "auth-login"}">
              <i data-lucide="${onlineUser ? "log-out" : "log-in"}"></i>
              <span>${onlineUser ? "Sair online" : "Entrar online"}</span>
            </button>
          </div>

          <div class="menu-summary-grid">
            ${renderSummaryItem(maps.length, maps.length === 1 ? "mapa salvo" : "mapas salvos", "map")}
            ${renderSummaryItem(publishedCount, "publicados", "send")}
            ${renderSummaryItem(favoriteCount, "favoritos", "star")}
          </div>

          <div class="menu-actions menu-actions-wide">
            <button class="menu-action primary" type="button" data-action="create">
              <i data-lucide="hammer"></i>
              <span>Criar Mapa</span>
            </button>
            <button class="menu-action" type="button" data-action="maps">
              <i data-lucide="map"></i>
              <span>Jogar Mapas</span>
            </button>
            ${
              lastPlayedMap
                ? `
              <button class="menu-action" type="button" data-action="continue-playing">
                <i data-lucide="play"></i>
                <span>Continuar Jogando</span>
                <small>${escapeHtml(lastPlayedMap.name)}</small>
              </button>
            `
                : ""
            }
            ${
              lastEditedMap
                ? `
              <button class="menu-action" type="button" data-action="continue">
                <i data-lucide="history"></i>
                <span>Continuar Editando</span>
                <small>${escapeHtml(lastEditedMap.name)}</small>
              </button>
            `
                : ""
            }
            <button class="menu-action" type="button" data-action="import">
              <i data-lucide="file-up"></i>
              <span>Importar Mapa</span>
            </button>
          </div>

          <section class="template-panel" aria-label="Templates de mapa">
            <div class="template-heading">
              <strong>Comecar com template</strong>
              <span>Escolha uma base e edite livremente.</span>
            </div>
            <div class="template-grid">
              ${MAP_TEMPLATE_METADATA.map(
                (template) => `
                <button class="template-card" type="button" data-action="template" data-template="${template.id}">
                  <i data-lucide="${template.icon}"></i>
                  <strong>${escapeHtml(template.name)}</strong>
                  <span>${escapeHtml(template.description)}</span>
                </button>
              `
              ).join("")}
            </div>
          </section>
        </section>
        <input id="menu-map-import" class="sr-only" type="file" accept=".json,application/json" />
      </main>
    `;

    this.root.addEventListener("click", this.handleClick);
    this.root
      .querySelector<HTMLInputElement>("#menu-map-import")
      ?.addEventListener("change", this.handleImportChange);

    createIcons({ icons });
  }

  destroy(): void {
    this.authModal.close();
    this.root.removeEventListener("click", this.handleClick);
    this.root
      .querySelector<HTMLInputElement>("#menu-map-import")
      ?.removeEventListener("change", this.handleImportChange);
  }

  private readonly handleClick = (event: MouseEvent): void => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-action]");

    if (!button || !this.root.contains(button)) {
      return;
    }

    const action = button.dataset.action;

    if (action === "create") {
      this.actions.onCreateMap("empty");
    } else if (action === "maps") {
      this.actions.onOpenMapList();
    } else if (action === "profile") {
      this.actions.onOpenProfile();
    } else if (action === "auth-login") {
      this.authModal.show(() => this.render());
    } else if (action === "auth-logout") {
      void AuthService.logout().finally(() => this.render());
    } else if (action === "continue") {
      this.actions.onContinueLastMap();
    } else if (action === "continue-playing") {
      this.actions.onContinueLastPlayed();
    } else if (action === "import") {
      this.root.querySelector<HTMLInputElement>("#menu-map-import")?.click();
    } else if (action === "template") {
      this.actions.onCreateMap(button.dataset.template as MapTemplateId);
    }
  };

  private readonly handleImportChange = (event: Event): void => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];

    if (file) {
      this.actions.onImportMap(file);
    }

    input.value = "";
  };
}

function renderMiniAvatar(colors: AvatarColors): string {
  return `
    <div class="menu-profile-avatar" style="${getMiniAvatarStyle(colors)}" aria-hidden="true">
      <div class="mini-avatar-head">
        <span></span>
      </div>
      <div class="mini-avatar-row">
        <div class="mini-avatar-arm"></div>
        <div class="mini-avatar-body"></div>
        <div class="mini-avatar-arm"></div>
      </div>
      <div class="mini-avatar-legs">
        <div></div>
        <div></div>
      </div>
    </div>
  `;
}

function getMiniAvatarStyle(colors: AvatarColors): string {
  return [
    `--avatar-head:${escapeAttribute(colors.head)}`,
    `--avatar-body:${escapeAttribute(colors.body)}`,
    `--avatar-arms:${escapeAttribute(colors.arms)}`,
    `--avatar-legs:${escapeAttribute(colors.legs)}`,
  ].join(";");
}

function renderSummaryItem(value: number, label: string, icon: string): string {
  return `
    <div class="menu-summary">
      <i data-lucide="${icon}"></i>
      <strong>${value}</strong>
      <span>${label}</span>
    </div>
  `;
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
