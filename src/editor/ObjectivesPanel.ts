import { createIcons, icons } from "lucide";
import type {
  GameMap,
  GameplaySettings,
  MapObjective,
  ObjectiveType,
} from "../shared/types/MapSchema";
import type { MapObject } from "../shared/types/ObjectSchema";

type ObjectivesPanelActions = {
  onChange: (objectives: MapObjective[]) => void;
  onGameplayChange: (gameplaySettings: GameplaySettings) => void;
};

const OBJECTIVE_TYPES: Array<{ type: ObjectiveType; label: string }> = [
  { type: "collectCoins", label: "Coletar moedas" },
  { type: "reachObject", label: "Chegar em objeto" },
  { type: "collectKey", label: "Coletar chave" },
  { type: "activateButton", label: "Ativar botao" },
  { type: "openDoor", label: "Abrir porta" },
  { type: "defeatEnemies", label: "Derrotar inimigos" },
  { type: "collectTycoonCash", label: "Coletar dinheiro Tycoon" },
  { type: "purchaseTycoonItem", label: "Comprar item Tycoon" },
  { type: "completeTycoon", label: "Completar Tycoon" },
  { type: "customLogic", label: "Completar por logica" },
];

export class ObjectivesPanel {
  private map: GameMap | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly actions: ObjectivesPanelActions
  ) {}

  setMap(map: GameMap): void {
    this.map = structuredClone(map);
    this.render();
  }

  render(): void {
    const objectives = this.getObjectives();
    const requiredCount = objectives.filter((objective) => objective.required !== false).length;
    const requireToFinish = this.map?.gameplaySettings?.requireObjectivesToFinish === true;

    this.root.innerHTML = `
      <div class="panel-heading">
        <h2>Objetivos</h2>
        <span class="type-pill">${objectives.length} itens</span>
      </div>
      <label class="field checkbox-field">
        <input type="checkbox" data-objectives-required-finish ${requireToFinish ? "checked" : ""} />
        <span>Exigir objetivos para finalizar</span>
      </label>
      <div class="objective-summary ${requiredCount > 0 ? "ok" : "muted"}">
        ${requiredCount > 0 ? `${requiredCount} objetivo${requiredCount === 1 ? "" : "s"} obrigatorio${requiredCount === 1 ? "" : "s"}` : "Nenhum objetivo obrigatorio"}
      </div>
      <button class="wide-action" type="button" data-add-objective>
        <i data-lucide="list-plus"></i>
        <span>Novo objetivo</span>
      </button>
      <div class="objective-list">
        ${objectives.length === 0 ? `<div class="empty-row">Sem objetivos</div>` : ""}
        ${objectives.map((objective, index) => this.renderObjective(objective, index)).join("")}
      </div>
    `;

    this.bindEvents();
    createIcons({ icons });
  }

  private renderObjective(objective: MapObjective, index: number): string {
    return `
      <article class="objective-card">
        <div class="objective-card-title">
          <strong>${escapeHtml(objective.title.trim() || "Objetivo sem titulo")}</strong>
          <button class="icon-action compact danger" type="button" data-remove-objective data-index="${index}" title="Remover objetivo" aria-label="Remover objetivo">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
        <label class="field">
          <span>Titulo</span>
          <input type="text" value="${escapeAttribute(objective.title)}" data-objective-title data-index="${index}" />
        </label>
        <label class="field">
          <span>Descricao</span>
          <textarea rows="2" data-objective-description data-index="${index}">${escapeHtml(objective.description ?? "")}</textarea>
        </label>
        <label class="field">
          <span>Tipo</span>
          <select data-objective-type data-index="${index}">
            ${OBJECTIVE_TYPES.map(
              (option) => `
              <option value="${option.type}" ${objective.type === option.type ? "selected" : ""}>${option.label}</option>
            `
            ).join("")}
          </select>
        </label>
        ${this.renderTargetFields(objective, index)}
        <label class="field">
          <span>Mensagem ao concluir</span>
          <input type="text" value="${escapeAttribute(objective.completedMessage ?? "")}" data-objective-completed-message data-index="${index}" />
        </label>
        <div class="objective-flags">
          <label class="field checkbox-field">
            <input type="checkbox" data-objective-required data-index="${index}" ${objective.required !== false ? "checked" : ""} />
            <span>Obrigatorio</span>
          </label>
          <label class="field checkbox-field">
            <input type="checkbox" data-objective-visible data-index="${index}" ${objective.visible !== false ? "checked" : ""} />
            <span>Visivel no HUD</span>
          </label>
        </div>
      </article>
    `;
  }

  private renderTargetFields(objective: MapObjective, index: number): string {
    if (
      objective.type === "collectCoins" ||
      objective.type === "defeatEnemies" ||
      objective.type === "collectTycoonCash"
    ) {
      const fallback = objective.type === "defeatEnemies" ? 1 : objective.type === "collectTycoonCash" ? 100 : 5;
      return `
        <label class="field">
          <span>Quantidade</span>
          <input type="number" min="1" step="1" value="${objective.targetAmount ?? fallback}" data-objective-amount data-index="${index}" />
        </label>
        ${
          objective.type === "collectTycoonCash"
            ? this.renderTycoonIdField(objective.targetTycoonId ?? "", index)
            : ""
        }
      `;
    }

    if (objective.type === "reachObject") {
      return this.renderObjectSelect(
        "Objeto alvo",
        objective.targetObjectId ?? "",
        "data-objective-target-object",
        index
      );
    }

    if (objective.type === "activateButton") {
      return this.renderObjectSelect(
        "Botao alvo",
        objective.targetObjectId ?? "",
        "data-objective-target-object",
        index,
        "button"
      );
    }

    if (objective.type === "collectKey") {
      return this.renderKeySelect(objective.targetKeyId ?? "", index);
    }

    if (objective.type === "openDoor") {
      return this.renderDoorSelect(objective.targetDoorId ?? "", index);
    }

    if (objective.type === "purchaseTycoonItem") {
      return this.renderPurchaseSelect(objective.targetPurchaseId ?? "", index);
    }

    if (objective.type === "completeTycoon") {
      return this.renderTycoonIdField(objective.targetTycoonId ?? "", index);
    }

    return `<div class="logic-note">Conclua este objetivo usando a acao completeObjective na logica visual.</div>`;
  }

  private renderTycoonIdField(value: string, index: number): string {
    return `
      <label class="field">
        <span>Tycoon ID</span>
        <input type="text" value="${escapeAttribute(value)}" data-objective-target-tycoon data-index="${index}" placeholder="tycoon_1" />
      </label>
    `;
  }

  private renderObjectSelect(
    label: string,
    value: string,
    attribute: string,
    index: number,
    typeFilter?: string
  ): string {
    const objects = this.getObjects().filter((object) => !typeFilter || object.type === typeFilter);
    const exists = value.length === 0 || objects.some((object) => object.id === value);

    return `
      <label class="field">
        <span>${label}</span>
        <select ${attribute} data-index="${index}">
          <option value="">Escolha um objeto</option>
          ${!exists ? `<option value="${escapeAttribute(value)}" selected>Objeto nao encontrado (${escapeHtml(value)})</option>` : ""}
          ${objects
            .map(
              (object) => `
            <option value="${escapeAttribute(object.id)}" ${object.id === value ? "selected" : ""}>
              ${escapeHtml(`${object.name ?? object.id} (${object.type})`)}
            </option>
          `
            )
            .join("")}
        </select>
      </label>
    `;
  }

  private renderKeySelect(value: string, index: number): string {
    const keys = this.getKeyOptions();
    const exists = value.length === 0 || keys.some((key) => key.id === value);

    return `
      <label class="field">
        <span>Chave alvo</span>
        <select data-objective-target-key data-index="${index}">
          <option value="">Escolha uma chave</option>
          ${!exists ? `<option value="${escapeAttribute(value)}" selected>Chave nao encontrada (${escapeHtml(value)})</option>` : ""}
          ${keys
            .map(
              (key) => `
            <option value="${escapeAttribute(key.id)}" ${key.id === value ? "selected" : ""}>
              ${escapeHtml(`${key.label} (${key.id})`)}
            </option>
          `
            )
            .join("")}
        </select>
      </label>
    `;
  }

  private renderDoorSelect(value: string, index: number): string {
    const doors = this.getDoorOptions();
    const exists = value.length === 0 || doors.some((door) => door.id === value);

    return `
      <label class="field">
        <span>Porta alvo</span>
        <select data-objective-target-door data-index="${index}">
          <option value="">Escolha uma porta</option>
          ${!exists ? `<option value="${escapeAttribute(value)}" selected>Porta nao encontrada (${escapeHtml(value)})</option>` : ""}
          ${doors
            .map(
              (door) => `
            <option value="${escapeAttribute(door.id)}" ${door.id === value ? "selected" : ""}>
              ${escapeHtml(`${door.label} (${door.id})`)}
            </option>
          `
            )
            .join("")}
        </select>
      </label>
    `;
  }

  private renderPurchaseSelect(value: string, index: number): string {
    const purchases = this.getPurchaseOptions();
    const exists = value.length === 0 || purchases.some((purchase) => purchase.id === value);

    return `
      <label class="field">
        <span>Compra alvo</span>
        <select data-objective-target-purchase data-index="${index}">
          <option value="">Escolha uma compra</option>
          ${!exists ? `<option value="${escapeAttribute(value)}" selected>Compra nao encontrada (${escapeHtml(value)})</option>` : ""}
          ${purchases
            .map(
              (purchase) => `
            <option value="${escapeAttribute(purchase.id)}" ${purchase.id === value ? "selected" : ""}>
              ${escapeHtml(`${purchase.label} (${purchase.id})`)}
            </option>
          `
            )
            .join("")}
        </select>
      </label>
    `;
  }

  private bindEvents(): void {
    this.root
      .querySelector<HTMLInputElement>("[data-objectives-required-finish]")
      ?.addEventListener("change", (event) => {
        const checked = (event.currentTarget as HTMLInputElement).checked;
        const nextSettings: GameplaySettings = {
          ...(this.map?.gameplaySettings ?? {}),
          requireObjectivesToFinish: checked,
        };

        if (this.map) {
          this.map.gameplaySettings = nextSettings;
        }

        this.actions.onGameplayChange(structuredClone(nextSettings));
      });

    this.root
      .querySelector<HTMLButtonElement>("[data-add-objective]")
      ?.addEventListener("click", () => {
        this.updateObjectives((objectives) => {
          objectives.push(createDefaultObjective(objectives.length + 1, this.getObjects()));
        });
      });

    this.root.querySelectorAll<HTMLButtonElement>("[data-remove-objective]").forEach((button) => {
      button.addEventListener("click", () => {
        this.updateObjectives((objectives) => {
          objectives.splice(getIndex(button), 1);
        });
      });
    });

    this.root.querySelectorAll<HTMLInputElement>("[data-objective-title]").forEach((input) => {
      input.addEventListener("change", () =>
        this.updateObjective(getIndex(input), { title: input.value.trim() || "Objetivo" }, false)
      );
    });

    this.root
      .querySelectorAll<HTMLTextAreaElement>("[data-objective-description]")
      .forEach((textarea) => {
        textarea.addEventListener("change", () =>
          this.updateObjective(getIndex(textarea), { description: textarea.value.trim() }, false)
        );
      });

    this.root.querySelectorAll<HTMLSelectElement>("[data-objective-type]").forEach((select) => {
      select.addEventListener("change", () => {
        const type = toObjectiveType(select.value);
        this.updateObjectives((objectives) => {
          const objective = objectives[getIndex(select)];

          if (!objective) {
            return;
          }

          Object.assign(objective, resetObjectiveTarget({ ...objective, type }, this.getObjects()));
        });
      });
    });

    this.root.querySelectorAll<HTMLInputElement>("[data-objective-amount]").forEach((input) => {
      input.addEventListener("change", () => {
        this.updateObjective(
          getIndex(input),
          { targetAmount: Math.max(1, Math.floor(Number(input.value) || 1)) },
          false
        );
      });
    });

    this.root
      .querySelectorAll<HTMLSelectElement>("[data-objective-target-object]")
      .forEach((select) => {
        select.addEventListener("change", () =>
          this.updateObjective(getIndex(select), { targetObjectId: select.value }, false)
        );
      });

    this.root
      .querySelectorAll<HTMLSelectElement>("[data-objective-target-key]")
      .forEach((select) => {
        select.addEventListener("change", () =>
          this.updateObjective(getIndex(select), { targetKeyId: select.value }, false)
        );
      });

    this.root
      .querySelectorAll<HTMLSelectElement>("[data-objective-target-door]")
      .forEach((select) => {
        select.addEventListener("change", () =>
          this.updateObjective(getIndex(select), { targetDoorId: select.value }, false)
        );
      });

    this.root
      .querySelectorAll<HTMLSelectElement>("[data-objective-target-purchase]")
      .forEach((select) => {
        select.addEventListener("change", () =>
          this.updateObjective(getIndex(select), { targetPurchaseId: select.value }, false)
        );
      });

    this.root
      .querySelectorAll<HTMLInputElement>("[data-objective-target-tycoon]")
      .forEach((input) => {
        input.addEventListener("change", () =>
          this.updateObjective(getIndex(input), { targetTycoonId: input.value.trim() }, false)
        );
      });

    this.root
      .querySelectorAll<HTMLInputElement>("[data-objective-completed-message]")
      .forEach((input) => {
        input.addEventListener("change", () =>
          this.updateObjective(getIndex(input), { completedMessage: input.value.trim() }, false)
        );
      });

    this.root.querySelectorAll<HTMLInputElement>("[data-objective-required]").forEach((input) => {
      input.addEventListener("change", () =>
        this.updateObjective(getIndex(input), { required: input.checked }, true)
      );
    });

    this.root.querySelectorAll<HTMLInputElement>("[data-objective-visible]").forEach((input) => {
      input.addEventListener("change", () =>
        this.updateObjective(getIndex(input), { visible: input.checked }, true)
      );
    });
  }

  private updateObjective(index: number, patch: Partial<MapObjective>, rerender: boolean): void {
    this.updateObjectives((objectives) => {
      const objective = objectives[index];

      if (objective) {
        Object.assign(objective, patch);
      }
    }, rerender);
  }

  private updateObjectives(mutate: (objectives: MapObjective[]) => void, rerender = true): void {
    if (!this.map) {
      return;
    }

    const objectives = this.getObjectives();
    mutate(objectives);
    this.map.objectives = objectives;
    this.actions.onChange(structuredClone(objectives));

    if (rerender) {
      this.render();
    }
  }

  private getObjectives(): MapObjective[] {
    return structuredClone(this.map?.objectives ?? []).filter(isObjective);
  }

  private getObjects(): MapObject[] {
    return structuredClone(this.map?.objects ?? []);
  }

  private getKeyOptions(): Array<{ id: string; label: string }> {
    return this.getObjects()
      .filter((object) => object.type === "key")
      .map((key) => ({
        id: typeof key.properties?.keyId === "string" ? key.properties.keyId : key.id,
        label:
          typeof key.properties?.label === "string" ? key.properties.label : (key.name ?? key.id),
      }));
  }

  private getDoorOptions(): Array<{ id: string; label: string }> {
    return this.getObjects()
      .filter((object) => object.type === "door")
      .map((door) => ({
        id:
          typeof door.properties?.doorId === "string" && door.properties.doorId.length > 0
            ? door.properties.doorId
            : door.id,
        label: door.name ?? door.id,
      }));
  }

  private getPurchaseOptions(): Array<{ id: string; label: string }> {
    return this.getObjects()
      .filter(
        (object) =>
          object.type === "tycoonBuyButton" ||
          object.type === "tycoonBarrier" ||
          object.type === "tycoonUpgrade"
      )
      .map((object) => {
        const purchaseId =
          object.type === "tycoonUpgrade"
            ? typeof object.properties?.upgradeId === "string" &&
              object.properties.upgradeId.length > 0
              ? object.properties.upgradeId
              : object.id
            : typeof object.properties?.purchaseId === "string" &&
                object.properties.purchaseId.length > 0
              ? object.properties.purchaseId
              : object.id;

        return {
          id: purchaseId,
          label: object.name ?? object.id,
        };
      });
  }
}

function createDefaultObjective(index: number, objects: MapObject[]): MapObjective {
  const finish = objects.find((object) => object.type === "finish" || object.type === "goal");

  return {
    id: createId("objective"),
    title: `Objetivo ${index}`,
    description: "Guie o jogador ate este passo.",
    type: finish ? "reachObject" : "collectCoins",
    targetObjectId: finish?.id,
    targetAmount: finish ? undefined : 5,
    required: true,
    visible: true,
    completedMessage: "Objetivo concluido!",
  };
}

function resetObjectiveTarget(objective: MapObjective, objects: MapObject[]): MapObjective {
  const next: MapObjective = {
    id: objective.id,
    title: objective.title,
    description: objective.description,
    type: objective.type,
    required: objective.required,
    visible: objective.visible,
    completedMessage: objective.completedMessage,
  };

  if (objective.type === "collectCoins") {
    next.targetAmount = Math.max(1, objective.targetAmount ?? 5);
  } else if (objective.type === "collectTycoonCash") {
    next.targetAmount = Math.max(1, objective.targetAmount ?? 100);
    next.targetTycoonId = objective.targetTycoonId ?? "tycoon_1";
  } else if (objective.type === "defeatEnemies") {
    next.targetAmount = Math.max(1, objective.targetAmount ?? 1);
  } else if (objective.type === "reachObject") {
    next.targetObjectId =
      objects.find((object) => object.type === "finish" || object.type === "goal")?.id ?? "";
  } else if (objective.type === "activateButton") {
    next.targetObjectId = objects.find((object) => object.type === "button")?.id ?? "";
  } else if (objective.type === "collectKey") {
    const key = objects.find((object) => object.type === "key");
    next.targetKeyId =
      typeof key?.properties?.keyId === "string" ? key.properties.keyId : (key?.id ?? "");
  } else if (objective.type === "openDoor") {
    const door = objects.find((object) => object.type === "door");
    next.targetDoorId =
      typeof door?.properties?.doorId === "string" && door.properties.doorId.length > 0
        ? door.properties.doorId
        : (door?.id ?? "");
  } else if (objective.type === "purchaseTycoonItem") {
    const purchase = objects.find(
      (object) =>
        object.type === "tycoonBuyButton" ||
        object.type === "tycoonBarrier" ||
        object.type === "tycoonUpgrade"
    );
    next.targetPurchaseId =
      purchase?.type === "tycoonUpgrade"
        ? typeof purchase.properties?.upgradeId === "string"
          ? purchase.properties.upgradeId
          : (purchase?.id ?? "")
        : typeof purchase?.properties?.purchaseId === "string"
          ? purchase.properties.purchaseId
          : (purchase?.id ?? "");
  } else if (objective.type === "completeTycoon") {
    next.targetTycoonId = objective.targetTycoonId ?? "tycoon_1";
  }

  return next;
}

function toObjectiveType(value: string): ObjectiveType {
  return OBJECTIVE_TYPES.some((option) => option.type === value)
    ? (value as ObjectiveType)
    : "customLogic";
}

function isObjective(value: unknown): value is MapObjective {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "title" in value &&
    "type" in value &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.type === "string"
  );
}

function getIndex(element: HTMLElement): number {
  return Math.max(0, Number(element.dataset.index) || 0);
}

function createId(prefix: string): string {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
