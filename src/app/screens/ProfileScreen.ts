import { createIcons, icons } from "lucide";
import { LocalMapMetadataStorage } from "../../storage/LocalMapMetadataStorage";
import {
  LocalProfileStorage,
  normalizeCreatorName,
  type AvatarColors,
  type LocalProfile,
} from "../../storage/LocalProfileStorage";
import { MapStorage } from "../../storage/MapStorage";
import type { GameMap } from "../../shared/types/MapSchema";
import type { ProfileScreenActions, Screen } from "../AppState";

type ProfileStats = {
  createdMaps: number;
  publishedMaps: number;
  favoriteMaps: number;
  receivedLikes: number;
  ownMapPlays: number;
  completedMaps: number;
};

const COLOR_FIELDS: Array<{ key: keyof AvatarColors; label: string; icon: string }> = [
  { key: "head", label: "Cabeca", icon: "circle" },
  { key: "body", label: "Corpo", icon: "shirt" },
  { key: "arms", label: "Bracos", icon: "move-horizontal" },
  { key: "legs", label: "Pernas", icon: "footprints" },
];

export class ProfileScreen implements Screen {
  private message = "";

  constructor(
    private readonly root: HTMLElement,
    private readonly actions: ProfileScreenActions
  ) {}

  render(): void {
    this.root.removeEventListener("click", this.handleClick);
    this.root.removeEventListener("input", this.handleInput);
    this.root.removeEventListener("submit", this.handleSubmit);

    const profile = LocalProfileStorage.getProfile();
    const stats = getProfileStats(profile);

    this.root.innerHTML = `
      <main class="profile-screen">
        <header class="screen-header profile-header">
          <div>
            <strong>Perfil</strong>
            <span>Identidade local do jogador e criador</span>
          </div>
          <div class="top-actions">
            <button class="top-action" type="button" data-action="menu">
              <i data-lucide="house"></i>
              <span>Voltar ao Menu</span>
            </button>
          </div>
        </header>

        <section class="profile-shell">
          <article class="profile-panel profile-editor-panel">
            <div class="profile-section-title">
              <strong>Dados locais</strong>
              <span>Salvo apenas neste navegador.</span>
            </div>

            <form class="profile-form" data-profile-form>
              <label class="field">
                <span>Nome de exibicao</span>
                <input name="displayName" type="text" maxlength="32" value="${escapeAttribute(profile.displayName)}" />
              </label>

              <label class="field">
                <span>Bio</span>
                <textarea name="bio" maxlength="180" rows="4" placeholder="Uma frase curta sobre seus mapas">${escapeHtml(profile.bio)}</textarea>
              </label>

              <div class="profile-color-grid">
                ${COLOR_FIELDS.map(
                  (field) => `
                  <label class="profile-color-field">
                    <span><i data-lucide="${field.icon}"></i>${field.label}</span>
                    <input
                      name="${field.key}"
                      type="color"
                      value="${escapeAttribute(profile.avatarColors[field.key])}"
                      data-avatar-color="${field.key}"
                    />
                  </label>
                `
                ).join("")}
              </div>

              <div class="profile-actions">
                <button class="menu-action primary" type="submit">
                  <i data-lucide="save"></i>
                  <span>Salvar Perfil</span>
                </button>
                <button class="menu-action" type="button" data-action="menu">
                  <i data-lucide="arrow-left"></i>
                  <span>Voltar</span>
                </button>
              </div>
            </form>

            ${this.message ? `<div class="profile-save-message">${escapeHtml(this.message)}</div>` : ""}
          </article>

          <article class="profile-panel profile-preview-panel">
            <div class="profile-section-title">
              <strong>Avatar</strong>
              <span>Usado nas proximas sessoes de jogo.</span>
            </div>

            ${renderAvatarPreview(profile.avatarColors)}

            <div class="profile-name-card">
              <strong>${escapeHtml(profile.displayName)}</strong>
              <span>${escapeHtml(profile.bio || "Sem bio definida.")}</span>
            </div>
          </article>

          <article class="profile-panel profile-stats-panel">
            <div class="profile-section-title">
              <strong>Estatisticas locais</strong>
              <span>Calculadas a partir dos mapas salvos neste navegador.</span>
            </div>

            <div class="profile-stats-grid">
              ${renderStat("map", stats.createdMaps, "Mapas criados")}
              ${renderStat("send", stats.publishedMaps, "Publicados")}
              ${renderStat("star", stats.favoriteMaps, "Favoritos")}
              ${renderStat("heart", stats.receivedLikes, "Curtidas recebidas")}
              ${renderStat("play", stats.ownMapPlays, "Jogadas nos seus mapas")}
              ${renderStat("trophy", stats.completedMaps, "Mapas concluidos")}
            </div>
          </article>
        </section>
      </main>
    `;

    this.root.addEventListener("click", this.handleClick);
    this.root.addEventListener("input", this.handleInput);
    this.root.addEventListener("submit", this.handleSubmit);
    createIcons({ icons });
  }

  destroy(): void {
    this.root.removeEventListener("click", this.handleClick);
    this.root.removeEventListener("input", this.handleInput);
    this.root.removeEventListener("submit", this.handleSubmit);
  }

  private readonly handleClick = (event: MouseEvent): void => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-action]");

    if (!button || !this.root.contains(button)) {
      return;
    }

    if (button.dataset.action === "menu") {
      event.preventDefault();
      this.actions.onBackToMenu();
    }
  };

  private readonly handleInput = (event: Event): void => {
    const input = event.target as HTMLInputElement | null;

    if (!input?.dataset.avatarColor) {
      return;
    }

    this.updatePreview();
  };

  private readonly handleSubmit = (event: SubmitEvent): void => {
    const form = event.target as HTMLFormElement | null;

    if (!form?.matches("[data-profile-form]")) {
      return;
    }

    event.preventDefault();
    LocalProfileStorage.saveProfile({
      displayName: getFormString(form, "displayName"),
      bio: getFormString(form, "bio"),
      avatarColors: {
        head: getFormString(form, "head"),
        body: getFormString(form, "body"),
        arms: getFormString(form, "arms"),
        legs: getFormString(form, "legs"),
      },
    });
    this.message = "Perfil salvo com sucesso.";
    this.render();
  };

  private updatePreview(): void {
    const preview = this.root.querySelector<HTMLElement>("[data-avatar-preview]");
    const form = this.root.querySelector<HTMLFormElement>("[data-profile-form]");

    if (!preview || !form) {
      return;
    }

    const colors: AvatarColors = {
      head: getFormString(form, "head"),
      body: getFormString(form, "body"),
      arms: getFormString(form, "arms"),
      legs: getFormString(form, "legs"),
    };

    setAvatarPreviewColors(preview, colors);
  }
}

function getProfileStats(profile: LocalProfile): ProfileStats {
  const maps = MapStorage.getAllMaps();
  const mapIds = new Set(maps.map((map) => map.id));
  const ownMaps = maps.filter((map) => isProfileMap(map, profile));
  const allStats = LocalMapMetadataStorage.getAllStats();

  return {
    createdMaps: ownMaps.length,
    publishedMaps: ownMaps.filter((map) => map.isPublished).length,
    favoriteMaps: [...LocalMapMetadataStorage.getFavoriteIds()].filter((mapId) => mapIds.has(mapId))
      .length,
    receivedLikes: ownMaps.reduce(
      (total, map) => total + LocalMapMetadataStorage.getLikeCount(map.id),
      0
    ),
    ownMapPlays: ownMaps.reduce((total, map) => total + (allStats[map.id]?.playCount ?? 0), 0),
    completedMaps: Object.values(allStats).filter((stats) => stats.completedCount > 0).length,
  };
}

function isProfileMap(map: GameMap, profile: LocalProfile): boolean {
  if (LocalProfileStorage.isCreatorNameFromProfile(map.creatorName, profile)) {
    return true;
  }

  return (
    map.authorId === "local-builder" &&
    normalizeCreatorName(map.creatorName) === normalizeCreatorName("Criador local")
  );
}

function renderAvatarPreview(colors: AvatarColors): string {
  return `
    <div class="profile-avatar-stage">
      <div
        class="profile-avatar-preview"
        data-avatar-preview
        style="${getAvatarPreviewStyle(colors)}"
        aria-label="Preview do avatar"
      >
        <div class="profile-avatar-head">
          <span></span>
        </div>
        <div class="profile-avatar-torso-row">
          <div class="profile-avatar-arm left"></div>
          <div class="profile-avatar-body"></div>
          <div class="profile-avatar-arm right"></div>
        </div>
        <div class="profile-avatar-leg-row">
          <div class="profile-avatar-leg"></div>
          <div class="profile-avatar-leg"></div>
        </div>
      </div>
    </div>
  `;
}

function renderStat(icon: string, value: number, label: string): string {
  return `
    <div class="profile-stat">
      <i data-lucide="${icon}"></i>
      <strong>${value}</strong>
      <span>${label}</span>
    </div>
  `;
}

function setAvatarPreviewColors(element: HTMLElement, colors: AvatarColors): void {
  element.style.setProperty("--avatar-head", colors.head);
  element.style.setProperty("--avatar-body", colors.body);
  element.style.setProperty("--avatar-arms", colors.arms);
  element.style.setProperty("--avatar-legs", colors.legs);
}

function getAvatarPreviewStyle(colors: AvatarColors): string {
  return [
    `--avatar-head:${escapeAttribute(colors.head)}`,
    `--avatar-body:${escapeAttribute(colors.body)}`,
    `--avatar-arms:${escapeAttribute(colors.arms)}`,
    `--avatar-legs:${escapeAttribute(colors.legs)}`,
  ].join(";");
}

function getFormString(form: HTMLFormElement, name: string): string {
  const value = new FormData(form).get(name);
  return typeof value === "string" ? value : "";
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
