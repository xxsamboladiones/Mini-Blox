import { createIcons, icons } from "lucide";
import { LocalMapMetadataStorage } from "../../storage/LocalMapMetadataStorage";
import { LocalProfileStorage } from "../../storage/LocalProfileStorage";
import { MapStorage } from "../../storage/MapStorage";
import { resolveAudioSettings } from "../../shared/AudioSettings";
import { resolveVisualSettings } from "../../shared/VisualSettings";
import type { GameMap, VisualTheme } from "../../shared/types/MapSchema";
import type { MapListActions, Screen } from "../AppState";
import { OnlineMapsTab } from "./map-list/OnlineMapsTab.js";
import { OnlineMapDetailsModal } from "./map-list/OnlineMapDetailsModal.js";
import { MultiplayerLobbyModal } from "./map-list/MultiplayerLobbyModal.js";
import type { OnlineMapSummary } from "../../services/OnlineMapService.js";

type CatalogStatusFilter = "all" | "published" | "draft";
type CatalogSort = "recent" | "oldest" | "name" | "favorites" | "likes";

type CatalogFilters = {
  query: string;
  tag: string;
  status: CatalogStatusFilter;
  theme: "all" | VisualTheme;
  favoritesOnly: boolean;
  sort: CatalogSort;
};

const DEFAULT_FILTERS: CatalogFilters = {
  query: "",
  tag: "",
  status: "all",
  theme: "all",
  favoritesOnly: false,
  sort: "recent",
};

export class MapListScreen implements Screen {
  private maps = MapStorage.getAllMaps();
  private filters: CatalogFilters = { ...DEFAULT_FILTERS };
  private selectedMapId: string | null = null;
  private activeTab: "local" | "online" = "local";
  private onlineMapsTab: OnlineMapsTab | null = null;
  private onlineMapDetailsModal: OnlineMapDetailsModal | null = null;
  private multiplayerLobbyModal: MultiplayerLobbyModal | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly actions: MapListActions
  ) {}

  render(): void {
    this.maps = MapStorage.getAllMaps();
    const filteredMaps = this.getFilteredMaps();
    const tags = getAvailableTags(this.maps);
    const themes = getAvailableThemes(this.maps);

    this.root.innerHTML = `
      <main class="list-screen">
        <header class="screen-header">
          <div>
            <strong>Mini Blox</strong>
            <span>Catalogo de mapas</span>
          </div>
          <div class="top-actions">
            <button class="top-action" type="button" data-action="menu" data-screen-action="menu">
              <i data-lucide="house"></i>
              <span>Voltar ao Menu</span>
            </button>
            <button class="top-action primary" type="button" data-action="create" data-screen-action="create">
              <i data-lucide="hammer"></i>
              <span>Criar Mapa</span>
            </button>
          </div>
        </header>

        <section class="map-list-panel">
          <div class="catalog-tabs">
            <button class="tab-button ${this.activeTab === "local" ? "active" : ""}" type="button" data-tab="local">
              <i data-lucide="folder"></i>
              <span>Locais</span>
            </button>
            <button class="tab-button ${this.activeTab === "online" ? "active" : ""}" type="button" data-tab="online">
              <i data-lucide="globe"></i>
              <span>Online</span>
            </button>
          </div>

          <div id="local-tab-content" class="tab-content ${this.activeTab === "local" ? "active" : ""}">
            <section class="catalog-toolbar" aria-label="Filtros do catalogo">
              <label class="field">
                <span>Buscar</span>
                <input id="catalog-query" type="search" value="${escapeAttribute(this.filters.query)}" placeholder="Nome ou descricao" />
              </label>
              <label class="field">
                <span>Tag</span>
                <select id="catalog-tag">
                  <option value="">Todas</option>
                  ${tags.map((tag) => `<option value="${escapeAttribute(tag)}" ${this.filters.tag === tag ? "selected" : ""}>${escapeHtml(tag)}</option>`).join("")}
                </select>
              </label>
              <label class="field">
                <span>Status</span>
                <select id="catalog-status">
                  <option value="all" ${this.filters.status === "all" ? "selected" : ""}>Todos</option>
                  <option value="published" ${this.filters.status === "published" ? "selected" : ""}>Publicado</option>
                  <option value="draft" ${this.filters.status === "draft" ? "selected" : ""}>Rascunho</option>
                </select>
              </label>
              <label class="field">
                <span>Tema</span>
                <select id="catalog-theme">
                  <option value="all" ${this.filters.theme === "all" ? "selected" : ""}>Todos</option>
                  ${themes.map((theme) => `<option value="${theme}" ${this.filters.theme === theme ? "selected" : ""}>${theme}</option>`).join("")}
                </select>
              </label>
              <label class="field">
                <span>Ordenar</span>
                <select id="catalog-sort">
                  <option value="recent" ${this.filters.sort === "recent" ? "selected" : ""}>Mais recente</option>
                  <option value="oldest" ${this.filters.sort === "oldest" ? "selected" : ""}>Mais antigo</option>
                  <option value="name" ${this.filters.sort === "name" ? "selected" : ""}>Nome A-Z</option>
                  <option value="favorites" ${this.filters.sort === "favorites" ? "selected" : ""}>Favoritos primeiro</option>
                <option value="likes" ${this.filters.sort === "likes" ? "selected" : ""}>Mais curtidos</option>
              </select>
            </label>
            <label class="field checkbox-field catalog-favorite-filter">
              <input id="catalog-favorites-only" type="checkbox" ${this.filters.favoritesOnly ? "checked" : ""} />
              <span>Somente favoritos</span>
            </label>
          </section>

          <div class="catalog-result-line">
            <span>${filteredMaps.length} de ${this.maps.length} mapas</span>
            <button class="small-action" type="button" data-action="clear-filters">
              <i data-lucide="filter-x"></i>
              <span>Limpar filtros</span>
            </button>
          </div>

          ${
            this.maps.length === 0
              ? `
            <div class="empty-maps">
              <i data-lucide="map-x"></i>
              <span>Nenhum mapa salvo ainda.</span>
              <button class="menu-action primary" type="button" data-action="create">
                <i data-lucide="hammer"></i>
                <span>Criar primeiro mapa</span>
              </button>
            </div>
          `
              : filteredMaps.length === 0
                ? `
            <div class="empty-maps">
              <i data-lucide="search-x"></i>
              <span>Nenhum mapa encontrado com esses filtros.</span>
            </div>
          `
                : `
            <div class="map-list">
              ${filteredMaps.map((map) => renderMapCard(map)).join("")}
            </div>
          `
          }
          </div>

          <div id="online-tab-content" class="tab-content ${this.activeTab === "online" ? "active" : ""}">
          </div>
        </section>

        ${this.renderDetailsModal()}
      </main>
    `;

    this.root.addEventListener("click", this.handleClick);
    this.bindFilters();
    this.bindTabs();

    if (this.activeTab === "online") {
      this.initializeOnlineTab();
    }

    createIcons({ icons });
  }

  destroy(): void {
    this.root.removeEventListener("click", this.handleClick);
    this.onlineMapsTab?.dispose();
    this.onlineMapDetailsModal?.dispose();
    this.multiplayerLobbyModal?.dispose();
    this.onlineMapsTab = null;
    this.onlineMapDetailsModal = null;
    this.multiplayerLobbyModal = null;
  }

  private bindFilters(): void {
    const apply = (): void => {
      const activeElement =
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLSelectElement
          ? document.activeElement
          : null;
      const activeId = activeElement?.id ?? "";
      const selectionStart =
        activeElement instanceof HTMLInputElement ? activeElement.selectionStart : null;
      this.filters = {
        query: this.root.querySelector<HTMLInputElement>("#catalog-query")?.value ?? "",
        tag: this.root.querySelector<HTMLSelectElement>("#catalog-tag")?.value ?? "",
        status: getStatusFilter(
          this.root.querySelector<HTMLSelectElement>("#catalog-status")?.value
        ),
        theme: getThemeFilter(this.root.querySelector<HTMLSelectElement>("#catalog-theme")?.value),
        favoritesOnly:
          this.root.querySelector<HTMLInputElement>("#catalog-favorites-only")?.checked ?? false,
        sort: getCatalogSort(this.root.querySelector<HTMLSelectElement>("#catalog-sort")?.value),
      };
      this.render();
      restoreFilterFocus(this.root, activeId, selectionStart);
    };

    [
      this.root.querySelector<HTMLInputElement>("#catalog-query"),
      this.root.querySelector<HTMLSelectElement>("#catalog-tag"),
      this.root.querySelector<HTMLSelectElement>("#catalog-status"),
      this.root.querySelector<HTMLSelectElement>("#catalog-theme"),
      this.root.querySelector<HTMLSelectElement>("#catalog-sort"),
      this.root.querySelector<HTMLInputElement>("#catalog-favorites-only"),
    ].forEach((input) => {
      input?.addEventListener("input", apply);
      input?.addEventListener("change", apply);
    });
  }

  private bindTabs(): void {
    this.root.querySelectorAll<HTMLElement>("[data-tab]").forEach((tabButton) => {
      tabButton.addEventListener("click", () => {
        const tab = tabButton.dataset.tab as "local" | "online";
        if (tab === this.activeTab) return;

        this.activeTab = tab;
        this.render();
      });
    });
  }

  private initializeOnlineTab(): void {
    const onlineTabContent = this.root.querySelector<HTMLElement>("#online-tab-content");
    if (!onlineTabContent) return;

    this.onlineMapsTab?.dispose();
    this.onlineMapDetailsModal?.dispose();
    this.multiplayerLobbyModal?.dispose();

    this.multiplayerLobbyModal = new MultiplayerLobbyModal();

    this.onlineMapDetailsModal = new OnlineMapDetailsModal(this.root, {
      onPlayMap: (map) => this.actions.onPlayMap(map),
      onEditMap: (map) => this.actions.onEditMap(map),
      onClose: () => {
        this.onlineMapDetailsModal = null;
      },
      onPlayMultiplayer: (map, roomId, onlineMapId) =>
        this.actions.onPlayMultiplayer?.(map, roomId, onlineMapId),
      onCreateMultiplayerRoom: (map, onlineMapId) =>
        this.actions.onCreateMultiplayerRoom?.(map, onlineMapId),
    }, this.multiplayerLobbyModal);

    this.onlineMapsTab = new OnlineMapsTab(onlineTabContent, {
      onPlayMap: (map) => this.actions.onPlayMap(map),
      onEditMap: (map) => this.actions.onEditMap(map),
      onShowDetails: (summary) => {
        this.onlineMapDetailsModal?.show(summary);
      },
      onDownloadCopy: (summary) => {
        void this.handleDownloadOnlineCopy(summary);
      },
      onPlayMultiplayer: (map, roomId, onlineMapId) =>
        this.actions.onPlayMultiplayer?.(map, roomId, onlineMapId),
      onCreateMultiplayerRoom: (map, onlineMapId) =>
        this.actions.onCreateMultiplayerRoom?.(map, onlineMapId),
    }, this.multiplayerLobbyModal);

    this.onlineMapsTab.render();
  }

  private async handleDownloadOnlineCopy(summary: OnlineMapSummary): Promise<void> {
    const { OnlineMapService } = await import("../../services/OnlineMapService.js");
    const { MapStorage } = await import("../../storage/MapStorage.js");

    try {
      const localCopy = await OnlineMapService.downloadOnlineMapAsLocalCopy(summary.id);
      MapStorage.saveMap(localCopy);

      const shouldOpen = confirm(
        `Mapa "${summary.name}" salvo como cópia local!\n\nDeseja abrir no editor agora?`
      );

      if (shouldOpen) {
        this.actions.onEditMap(localCopy);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao baixar mapa.");
    }
  }

  private readonly handleClick = (event: MouseEvent): void => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-action]");

    if (!button || !this.root.contains(button)) {
      return;
    }

    const action = button.dataset.action;

    if (action === "menu") {
      event.preventDefault();
      this.actions.onBackToMenu();
      return;
    }

    if (action === "create") {
      event.preventDefault();
      this.actions.onCreateMap();
      return;
    }

    if (action === "clear-filters") {
      event.preventDefault();
      this.filters = { ...DEFAULT_FILTERS };
      this.render();
      return;
    }

    if (action === "details-back") {
      event.preventDefault();
      this.selectedMapId = null;
      this.render();
      return;
    }

    const mapId =
      button.dataset.mapId ?? button.closest<HTMLElement>("[data-map-id]")?.dataset.mapId;
    const map = this.maps.find((candidate) => candidate.id === mapId);

    if (!map) {
      return;
    }

    if (action === "play") {
      this.actions.onPlayMap(map);
    } else if (action === "edit") {
      this.actions.onEditMap(map);
    } else if (action === "details") {
      this.selectedMapId = map.id;
      this.render();
    } else if (action === "favorite") {
      LocalMapMetadataStorage.toggleFavorite(map.id);
      this.render();
    } else if (action === "like") {
      LocalMapMetadataStorage.toggleLike(map.id);
      this.render();
    } else if (action === "duplicate") {
      MapStorage.saveMap(createDuplicateMap(map));
      this.render();
    } else if (action === "export") {
      downloadJson(map, getExportFileName(map));
    } else if (action === "delete") {
      if (!window.confirm(`Excluir "${map.name}"?`)) {
        return;
      }

      MapStorage.deleteMap(map.id);
      LocalMapMetadataStorage.deleteMapMetadata(map.id);
      this.selectedMapId = null;
      this.render();
    }
  };

  private getFilteredMaps(): GameMap[] {
    const query = normalizeSearch(this.filters.query);
    const favorites = LocalMapMetadataStorage.getFavoriteIds();
    const likes = LocalMapMetadataStorage.getLikeIds();

    const result = this.maps.filter((map) => {
      const theme = resolveVisualSettings(map.visualSettings).theme;
      const searchable = normalizeSearch(`${map.name} ${map.description ?? ""}`);
      const tags = map.tags ?? [];

      return (
        (!query || searchable.includes(query)) &&
        (!this.filters.tag || tags.includes(this.filters.tag)) &&
        (this.filters.status === "all" ||
          (this.filters.status === "published" ? map.isPublished : !map.isPublished)) &&
        (this.filters.theme === "all" || theme === this.filters.theme) &&
        (!this.filters.favoritesOnly || favorites.has(map.id))
      );
    });

    result.sort((a, b) => {
      if (this.filters.sort === "oldest") {
        return getTime(a.updatedAt) - getTime(b.updatedAt);
      }

      if (this.filters.sort === "name") {
        return a.name.localeCompare(b.name, "pt-BR");
      }

      if (this.filters.sort === "favorites") {
        return (
          compareBoolean(favorites.has(b.id), favorites.has(a.id)) ||
          getTime(b.updatedAt) - getTime(a.updatedAt)
        );
      }

      if (this.filters.sort === "likes") {
        return (
          compareBoolean(likes.has(b.id), likes.has(a.id)) ||
          getTime(b.updatedAt) - getTime(a.updatedAt)
        );
      }

      return getTime(b.updatedAt) - getTime(a.updatedAt);
    });

    return result;
  }

  private renderDetailsModal(): string {
    if (!this.selectedMapId) {
      return "";
    }

    const map = this.maps.find((candidate) => candidate.id === this.selectedMapId);

    if (!map) {
      return "";
    }

    const stats = LocalMapMetadataStorage.getStats(map.id);
    const theme = resolveVisualSettings(map.visualSettings).theme;
    const audio = resolveAudioSettings(map.audioSettings);
    const tags = map.tags?.filter((tag) => tag.trim().length > 0) ?? [];
    const isFavorite = LocalMapMetadataStorage.isFavorite(map.id);
    const isLiked = LocalMapMetadataStorage.isLiked(map.id);
    const isOwnMap = LocalProfileStorage.isCreatorNameFromProfile(map.creatorName);

    return `
      <section class="map-detail-overlay" role="dialog" aria-modal="true" aria-label="Detalhes do mapa">
        <article class="map-detail-panel" data-map-id="${escapeAttribute(map.id)}">
          <div class="map-detail-media">
            ${
              map.thumbnail
                ? `
              <img src="${escapeAttribute(map.thumbnail)}" alt="Thumbnail de ${escapeAttribute(map.name)}" />
            `
                : `
              <div class="map-thumbnail-placeholder">
                <i data-lucide="image"></i>
              </div>
            `
            }
          </div>
          <div class="map-detail-content">
            <div class="map-title-line">
              <strong>${escapeHtml(map.name)}</strong>
              ${isOwnMap ? `<span class="owner-badge">Seu mapa</span>` : ""}
              <span class="map-status ${map.isPublished ? "published" : "draft"}">
                ${map.isPublished ? "Publicado" : "Rascunho"}
              </span>
            </div>
            <p>${escapeHtml(map.description?.trim() || "Sem descricao.")}</p>
            <div class="map-detail-meta">
              <span><i data-lucide="user"></i>${escapeHtml(map.creatorName ?? map.authorId ?? "Criador local")}</span>
              <span><i data-lucide="palette"></i>${theme}</span>
              <span><i data-lucide="music"></i>${audio.ambientMusic === "none" ? "sem musica" : audio.ambientMusic}</span>
              <span><i data-lucide="calendar-plus"></i>${formatDate(map.createdAt)}</span>
              <span><i data-lucide="clock"></i>${formatUpdatedAt(map.updatedAt)}</span>
            </div>
            ${
              tags.length > 0
                ? `
              <div class="map-tags">
                ${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
              </div>
            `
                : ""
            }
            <div class="map-detail-stats">
              <span><strong>${map.objects.length}</strong> objetos</span>
              <span><strong>${getCoinCount(map)}</strong> moedas</span>
              <span><strong>${map.logic?.length ?? 0}</strong> regras</span>
              <span><strong>${hasFinish(map) ? "sim" : "nao"}</strong> final</span>
              <span><strong>${stats.playCount}</strong> jogadas</span>
              <span><strong>${stats.completedCount}</strong> conclusoes</span>
              <span><strong>${stats.bestCoinsCollected}</strong> melhor moedas</span>
              <span><strong>${stats.lastPlayedAt ? formatUpdatedAt(stats.lastPlayedAt) : "nunca"}</strong> ultima jogada</span>
              <span><strong>${LocalMapMetadataStorage.getLikeCount(map.id)}</strong> curtidas</span>
            </div>
            <div class="map-detail-actions">
              <button class="small-action primary" type="button" data-action="play" data-map-id="${escapeAttribute(map.id)}">
                <i data-lucide="play"></i>
                <span>Jogar</span>
              </button>
              <button class="small-action" type="button" data-action="edit" data-map-id="${escapeAttribute(map.id)}">
                <i data-lucide="pencil"></i>
                <span>Editar</span>
              </button>
              <button class="small-action" type="button" data-action="duplicate" data-map-id="${escapeAttribute(map.id)}">
                <i data-lucide="copy"></i>
                <span>Duplicar</span>
              </button>
              <button class="small-action" type="button" data-action="export" data-map-id="${escapeAttribute(map.id)}">
                <i data-lucide="download"></i>
                <span>Exportar</span>
              </button>
              <button class="small-action ${isFavorite ? "active" : ""}" type="button" data-action="favorite" data-map-id="${escapeAttribute(map.id)}">
                <i data-lucide="star"></i>
                <span>${isFavorite ? "Favorito" : "Favoritar"}</span>
              </button>
              <button class="small-action ${isLiked ? "active" : ""}" type="button" data-action="like" data-map-id="${escapeAttribute(map.id)}">
                <i data-lucide="heart"></i>
                <span>${isLiked ? "Curtido" : "Curtir"}</span>
              </button>
              <button class="small-action danger" type="button" data-action="delete" data-map-id="${escapeAttribute(map.id)}">
                <i data-lucide="trash-2"></i>
                <span>Excluir</span>
              </button>
              <button class="small-action" type="button" data-action="details-back">
                <i data-lucide="arrow-left"></i>
                <span>Voltar</span>
              </button>
            </div>
          </div>
        </article>
      </section>
    `;
  }
}

function renderMapCard(map: GameMap): string {
  const description = map.description?.trim() || "Sem descricao.";
  const tags = map.tags?.filter((tag) => tag.trim().length > 0) ?? [];
  const theme = resolveVisualSettings(map.visualSettings).theme;
  const isFavorite = LocalMapMetadataStorage.isFavorite(map.id);
  const isLiked = LocalMapMetadataStorage.isLiked(map.id);

  return `
    <article class="map-card" data-map-id="${escapeAttribute(map.id)}">
      <div class="map-thumbnail">
        ${
          map.thumbnail
            ? `
          <img src="${escapeAttribute(map.thumbnail)}" alt="Thumbnail de ${escapeAttribute(map.name)}" />
        `
            : `
          <div class="map-thumbnail-placeholder">
            <i data-lucide="image"></i>
          </div>
        `
        }
      </div>
      <div class="map-card-info">
        <div class="map-title-line">
          <strong>${escapeHtml(map.name)}</strong>
          <span class="map-status ${map.isPublished ? "published" : "draft"}">
            ${map.isPublished ? "Publicado" : "Rascunho"}
          </span>
        </div>
        <p>${escapeHtml(shorten(description, 150))}</p>
        <div class="map-stats-grid">
          <span><i data-lucide="user"></i>${escapeHtml(map.creatorName ?? "Criador local")}</span>
          <span><i data-lucide="palette"></i>${theme}</span>
          <span><i data-lucide="box"></i>${map.objects.length} objetos</span>
          <span><i data-lucide="coins"></i>${getCoinCount(map)} moedas</span>
          <span><i data-lucide="${hasFinish(map) ? "trophy" : "circle"}"></i>${hasFinish(map) ? "Tem final" : "Sem final"}</span>
          <span><i data-lucide="clock"></i>${formatUpdatedAt(map.updatedAt)}</span>
          <span><i data-lucide="heart"></i>${LocalMapMetadataStorage.getLikeCount(map.id)} curtidas</span>
        </div>
        ${
          tags.length > 0
            ? `
          <div class="map-tags">
            ${tags
              .slice(0, 5)
              .map((tag) => `<span>${escapeHtml(tag)}</span>`)
              .join("")}
          </div>
        `
            : ""
        }
      </div>
      <div class="map-row-actions">
        <button class="small-action primary" type="button" data-action="play" title="Jogar">
          <i data-lucide="play"></i>
          <span>Jogar</span>
        </button>
        <button class="small-action" type="button" data-action="details" title="Detalhes">
          <i data-lucide="info"></i>
          <span>Detalhes</span>
        </button>
        <button class="small-action ${isFavorite ? "active" : ""}" type="button" data-action="favorite" title="Favoritar">
          <i data-lucide="star"></i>
          <span>${isFavorite ? "Favorito" : "Favoritar"}</span>
        </button>
        <button class="small-action ${isLiked ? "active" : ""}" type="button" data-action="like" title="Curtir">
          <i data-lucide="heart"></i>
          <span>${isLiked ? "Curtido" : "Curtir"}</span>
        </button>
        <button class="small-action" type="button" data-action="edit" title="Editar">
          <i data-lucide="pencil"></i>
          <span>Editar</span>
        </button>
      </div>
    </article>
  `;
}

function createDuplicateMap(map: GameMap): GameMap {
  const now = new Date().toISOString();

  return {
    ...structuredClone(map),
    id: createId("map"),
    name: `${map.name} copia`,
    isPublished: false,
    publishedAt: undefined,
    createdAt: now,
    updatedAt: now,
  };
}

function getCoinCount(map: GameMap): number {
  return map.objects.filter((object) => object.type === "coin").length;
}

function hasFinish(map: GameMap): boolean {
  return map.objects.some((object) => object.type === "finish" || object.type === "goal");
}

function getAvailableTags(maps: GameMap[]): string[] {
  return [...new Set(maps.flatMap((map) => map.tags ?? []))]
    .filter((tag) => tag.trim().length > 0)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function getAvailableThemes(maps: GameMap[]): VisualTheme[] {
  return [...new Set(maps.map((map) => resolveVisualSettings(map.visualSettings).theme))].sort(
    (a, b) => a.localeCompare(b, "pt-BR")
  );
}

function downloadJson(map: GameMap, fileName: string): void {
  const blob = new Blob([JSON.stringify(map, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function getExportFileName(map: GameMap): string {
  return `mini-blox-${slugify(map.name)}.json`;
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "mapa"
  );
}

function createId(prefix: string): string {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatUpdatedAt(value: string | undefined): string {
  if (!value) {
    return "sem data";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDate(value: string | undefined): string {
  if (!value) {
    return "sem data";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(new Date(value));
}

function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getTime(value: string | undefined): number {
  return value ? new Date(value).getTime() : 0;
}

function compareBoolean(a: boolean, b: boolean): number {
  return Number(a) - Number(b);
}

function shorten(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function getStatusFilter(value: string | undefined): CatalogStatusFilter {
  if (value === "published" || value === "draft") {
    return value;
  }

  return "all";
}

function getThemeFilter(value: string | undefined): "all" | VisualTheme {
  if (
    value === "classic" ||
    value === "grass" ||
    value === "desert" ||
    value === "neon" ||
    value === "dark"
  ) {
    return value;
  }

  return "all";
}

function getCatalogSort(value: string | undefined): CatalogSort {
  if (value === "oldest" || value === "name" || value === "favorites" || value === "likes") {
    return value;
  }

  return "recent";
}

function restoreFilterFocus(root: HTMLElement, id: string, selectionStart: number | null): void {
  if (!id) {
    return;
  }

  const element = root.querySelector<HTMLInputElement | HTMLSelectElement>(`#${CSS.escape(id)}`);

  if (!element) {
    return;
  }

  element.focus();

  if (element instanceof HTMLInputElement && selectionStart !== null) {
    element.setSelectionRange(selectionStart, selectionStart);
  }
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
