import { createIcons, icons } from "lucide";
import type { MapObject } from "../shared/types/ObjectSchema";

type ObjectOutlinerActions = {
  onSelectObject: (objectId: string) => void;
  onFocusObject: (objectId: string) => void;
  onToggleVisibility: (objectId: string) => void;
};

export class ObjectOutliner {
  private objects: MapObject[] = [];
  private selectedId: string | null = null;
  private hiddenIds = new Set<string>();
  private query = "";

  constructor(
    private readonly root: HTMLElement,
    private readonly actions: ObjectOutlinerActions
  ) {}

  render(): void {
    const filteredObjects = this.objects.filter((object) => {
      const haystack = `${object.name ?? ""} ${object.type}`.toLowerCase();
      return haystack.includes(this.query.toLowerCase());
    });

    this.root.innerHTML = `
      <div class="panel-heading">
        <h2>Objetos</h2>
        <span class="type-pill">${this.objects.length}</span>
      </div>
      <label class="field outliner-search">
        <span>Buscar</span>
        <input data-outliner-search type="search" value="${escapeAttribute(this.query)}" placeholder="Nome ou tipo" />
      </label>
      <div class="object-list">
        ${filteredObjects.length === 0 ? `<div class="empty-row">Nenhum objeto</div>` : ""}
        ${filteredObjects.map((object) => this.renderObjectRow(object)).join("")}
      </div>
    `;

    this.root
      .querySelector<HTMLInputElement>("[data-outliner-search]")
      ?.addEventListener("input", (event) => {
        this.query = (event.currentTarget as HTMLInputElement).value;
        this.render();
      });

    this.root.querySelectorAll<HTMLButtonElement>("[data-select-object]").forEach((button) => {
      button.addEventListener("click", () => {
        const objectId = button.dataset.objectId;

        if (objectId) {
          this.actions.onSelectObject(objectId);
        }
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>("[data-focus-object]").forEach((button) => {
      button.addEventListener("click", () => {
        const objectId = button.dataset.objectId;

        if (objectId) {
          this.actions.onFocusObject(objectId);
        }
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>("[data-toggle-visibility]").forEach((button) => {
      button.addEventListener("click", () => {
        const objectId = button.dataset.objectId;

        if (objectId) {
          this.actions.onToggleVisibility(objectId);
        }
      });
    });

    createIcons({ icons });
  }

  setObjects(objects: MapObject[]): void {
    this.objects = objects;
    this.render();
  }

  setSelectedId(selectedId: string | null): void {
    this.selectedId = selectedId;
    this.render();
  }

  setHiddenIds(hiddenIds: string[]): void {
    this.hiddenIds = new Set(hiddenIds);
    this.render();
  }

  private renderObjectRow(object: MapObject): string {
    const hidden = this.hiddenIds.has(object.id);
    const selected = this.selectedId === object.id;

    return `
      <div class="object-row-wrap ${selected ? "selected" : ""} ${hidden ? "hidden-object" : ""}">
        <button class="object-row" type="button" data-select-object data-object-id="${escapeAttribute(object.id)}">
          <span>${escapeHtml(object.name ?? object.id)}</span>
          <small>${escapeHtml(String(object.type))}</small>
        </button>
        <button class="icon-action compact" type="button" data-focus-object data-object-id="${escapeAttribute(object.id)}" title="Centralizar camera">
          <i data-lucide="crosshair"></i>
        </button>
        <button class="icon-action compact" type="button" data-toggle-visibility data-object-id="${escapeAttribute(object.id)}" title="${hidden ? "Mostrar" : "Ocultar"}">
          <i data-lucide="${hidden ? "eye-off" : "eye"}"></i>
        </button>
      </div>
    `;
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
