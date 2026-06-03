import { createIcons, icons } from "lucide";
import type { MapObject, Vector3 } from "../shared/types/ObjectSchema";

type MapObjectPatch = Partial<MapObject>;

export class PropertiesPanel {
  private selectedObject: MapObject | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly onChange: (patch: MapObjectPatch) => void,
    private readonly onFocus: () => void,
    private readonly onDuplicate: () => void,
    private readonly onDelete: () => void
  ) {}

  render(): void {
    if (!this.selectedObject) {
      this.root.innerHTML = `
        <div class="panel-heading">
          <h2>Propriedades</h2>
        </div>
        <div class="empty-panel">
          <i data-lucide="mouse-pointer-2"></i>
          <span>Nenhum objeto selecionado</span>
        </div>
      `;
      createIcons({ icons });
      return;
    }

    const object = this.selectedObject;
    const rotation = object.rotation ?? { x: 0, y: 0, z: 0 };
    const scale = object.scale ?? { x: 1, y: 1, z: 1 };
    const color = typeof object.properties?.color === "string" ? object.properties.color : "#58a6ff";

    this.root.innerHTML = `
      <div class="panel-heading">
        <h2>Propriedades</h2>
        <span class="type-pill">${object.type}</span>
      </div>

      <label class="field">
        <span>Nome</span>
        <input data-field="name" type="text" value="${escapeAttribute(object.name ?? "")}" />
      </label>

      <label class="field">
        <span>Tipo</span>
        <input type="text" value="${escapeAttribute(String(object.type))}" readonly />
      </label>

      ${this.renderVectorFields("position", "Posicao", object.position)}
      ${this.renderVectorFields("rotation", "Rotacao", radiansToDegreesVector(rotation))}
      ${this.renderVectorFields("scale", "Escala", scale)}

      <label class="field">
        <span>Cor</span>
        <input data-field="color" type="color" value="${color}" />
      </label>

      ${this.renderMaterialFields(object)}
      ${this.renderCollisionField(object)}
      ${this.renderSpecificFields(object)}

      <div class="property-actions">
        <button class="property-action" type="button" data-focus title="Centralizar camera">
          <i data-lucide="crosshair"></i>
          <span>Centralizar</span>
        </button>
        <button class="property-action" type="button" data-duplicate title="Duplicar">
          <i data-lucide="copy"></i>
          <span>Duplicar</span>
        </button>
        <button class="property-action danger" type="button" data-delete title="Excluir">
          <i data-lucide="trash-2"></i>
          <span>Excluir</span>
        </button>
      </div>
    `;

    this.bindInputs();
    createIcons({ icons });
  }

  setObject(mapObject: MapObject | null): void {
    this.selectedObject = mapObject;
    this.render();
  }

  private renderVectorFields(name: "position" | "rotation" | "scale", label: string, value: Vector3): string {
    return `
      <fieldset class="vector-field">
        <legend>${label}</legend>
        <label>
          <span>X</span>
          <input data-vector="${name}" data-axis="x" type="number" step="0.1" value="${value.x}" />
        </label>
        <label>
          <span>Y</span>
          <input data-vector="${name}" data-axis="y" type="number" step="0.1" value="${value.y}" />
        </label>
        <label>
          <span>Z</span>
          <input data-vector="${name}" data-axis="z" type="number" step="0.1" value="${value.z}" />
        </label>
      </fieldset>
    `;
  }

  private renderSpecificFields(object: MapObject): string {
    switch (object.type) {
      case "damage":
      case "damageZone":
        return this.renderNumberField(
          "damage",
          "Dano",
          Number(object.properties?.damage ?? object.properties?.damagePerSecond ?? 25),
          1
        ) + `
          <label class="field">
            <span>Modo</span>
            <select data-property="mode">
              <option value="kill" ${object.properties?.mode !== "damage" ? "selected" : ""}>Kill</option>
              <option value="damage" ${object.properties?.mode === "damage" ? "selected" : ""}>Damage</option>
            </select>
          </label>
        `;
      case "coin":
        return this.renderNumberField("value", "Valor", Number(object.properties?.value ?? object.properties?.coinValue ?? 1), 1);
      case "key":
        return `
          ${this.renderTextField("keyId", "Key ID", String(object.properties?.keyId ?? "blue_key"))}
          ${this.renderTextField("label", "Label", String(object.properties?.label ?? "Chave Azul"))}
        `;
      case "checkpoint":
        return `
          ${this.renderTextField("checkpointId", "Checkpoint", String(object.properties?.checkpointId ?? ""))}
          ${this.renderColorPropertyField("activatedColor", "Cor ativada", String(object.properties?.activatedColor ?? "#22c55e"))}
        `;
      case "movingPlatform":
        return `
          ${this.renderPropertyVectorFields("startOffset", "Start offset", getVectorProperty(object.properties?.startOffset, { x: 0, y: 0, z: 0 }))}
          ${this.renderPropertyVectorFields("endOffset", "End offset", getVectorProperty(object.properties?.endOffset, { x: 5, y: 0, z: 0 }))}
          ${this.renderNumberField("speed", "Velocidade", Number(object.properties?.speed ?? 1), 0.1)}
          ${this.renderCheckboxField("loop", "Loop", object.properties?.loop !== false)}
        `;
      case "disappearingBlock":
        return `
          ${this.renderNumberField("delayBeforeDisappear", "Delay para sumir", Number(object.properties?.delayBeforeDisappear ?? 0.5), 0.1)}
          ${this.renderNumberField("respawnDelay", "Delay para voltar", Number(object.properties?.respawnDelay ?? 3), 0.1)}
        `;
      case "jumpPad":
        return `
          ${this.renderNumberField("force", "Forca", Number(object.properties?.force ?? 12), 0.5)}
          ${this.renderNumberField("cooldown", "Cooldown", Number(object.properties?.cooldown ?? 0.4), 0.1)}
        `;
      case "teleporter":
        return `
          ${this.renderTextField("teleporterId", "Teleporter ID", String(object.properties?.teleporterId ?? ""))}
          ${this.renderTextField("targetTeleporterId", "Teleporter alvo", String(object.properties?.targetTeleporterId ?? ""))}
          ${this.renderNumberField("cooldown", "Cooldown", Number(object.properties?.cooldown ?? 1), 0.1)}
        `;
      case "messageZone":
        return `
          ${this.renderTextField("message", "Mensagem", String(object.properties?.message ?? "Bem-vindo ao mapa!"))}
          ${this.renderCheckboxField("oneTime", "Mostrar uma vez", object.properties?.oneTime !== false)}
        `;
      case "door":
        return `
          ${this.renderTextField("doorId", "Door ID", String(object.properties?.doorId ?? ""))}
          ${this.renderTextField("requiredKeyId", "Key ID exigida", String(object.properties?.requiredKeyId ?? ""))}
          ${this.renderCheckboxField("startsOpen", "Comeca aberta", Boolean(object.properties?.startsOpen))}
          ${this.renderPropertyVectorFields("openOffset", "Offset ao abrir", getVectorProperty(object.properties?.openOffset, { x: 0, y: 4, z: 0 }))}
          <label class="field">
            <span>Estado</span>
            <select data-property="doorState">
              <option value="closed" ${object.properties?.doorState === "closed" ? "selected" : ""}>Fechada</option>
              <option value="open" ${object.properties?.doorState === "open" ? "selected" : ""}>Aberta</option>
            </select>
          </label>
        `;
      case "button":
        return `
          ${this.renderTextField("targetDoorId", "Door ID alvo", String(object.properties?.targetDoorId ?? object.properties?.buttonTargetId ?? ""))}
          ${this.renderCheckboxField("oneTime", "Ativar uma vez", object.properties?.oneTime !== false)}
        `;
      case "finish":
      case "goal":
        return `
          ${this.renderTextField("message", "Mensagem", String(object.properties?.message ?? "Voce venceu!"))}
          ${this.renderCheckboxField("requiresAllCoins", "Exigir todas as moedas", Boolean(object.properties?.requiresAllCoins))}
        `;
      case "npc":
        return `
          ${this.renderTextField("npcName", "Nome do NPC", String(object.properties?.npcName ?? object.name ?? "Guia"))}
          ${this.renderTextareaPropertyField(
            "dialogue",
            "Falas",
            getDialogueLines(object.properties?.dialogue, String(object.properties?.dialog ?? "Ola!")).join("\n")
          )}
          ${this.renderNumberField("interactionRange", "Alcance interacao", Number(object.properties?.interactionRange ?? 4), 0.5)}
          ${this.renderCheckboxField("showQuestHint", "Mostrar dica de objetivo", object.properties?.showQuestHint !== false)}
        `;
      case "enemy":
        return `
          <label class="field">
            <span>Tipo</span>
            <select data-property="enemyType">
              <option value="basic" selected>Basic</option>
            </select>
          </label>
          <label class="field">
            <span>Comportamento</span>
            <select data-property="behavior">
              <option value="idle" ${object.properties?.behavior === "idle" ? "selected" : ""}>Parado</option>
              <option value="patrol" ${object.properties?.behavior === "patrol" ? "selected" : ""}>Patrulha</option>
              <option value="chase" ${object.properties?.behavior !== "idle" && object.properties?.behavior !== "patrol" ? "selected" : ""}>Persegue</option>
            </select>
          </label>
          ${this.renderNumberField("health", "Vida", Number(object.properties?.health ?? 50), 1)}
          ${this.renderNumberField("damage", "Dano", Number(object.properties?.damage ?? 10), 1)}
          ${this.renderNumberField("speed", "Velocidade", Number(object.properties?.speed ?? 2), 0.1)}
          ${this.renderNumberField("detectionRange", "Alcance deteccao", Number(object.properties?.detectionRange ?? 8), 0.5)}
          ${this.renderNumberField("attackRange", "Alcance ataque", Number(object.properties?.attackRange ?? 1.5), 0.1)}
          ${this.renderNumberField("attackCooldown", "Cooldown ataque", Number(object.properties?.attackCooldown ?? 1), 0.1)}
          ${this.renderPropertyVectorFields("patrolOffset", "Offset patrulha", getVectorProperty(object.properties?.patrolOffset, { x: 4, y: 0, z: 0 }))}
        `;
      case "sign":
        return this.renderTextField("text", "Texto da placa", String(object.properties?.text ?? "Bem-vindo!"));
      case "lamp":
        return `
          ${this.renderCheckboxField("lightEnabled", "Luz ligada", object.properties?.lightEnabled !== false)}
          ${this.renderColorPropertyField("lightColor", "Cor da luz", String(object.properties?.lightColor ?? "#fff7aa"))}
          ${this.renderNumberField("lightIntensity", "Intensidade da luz", Number(object.properties?.lightIntensity ?? 1.5), 0.1)}
          ${this.renderNumberField("lightRange", "Alcance da luz", Number(object.properties?.lightRange ?? 8), 0.5)}
        `;
      case "itemSpawner":
        return `
          <label class="field">
            <span>Item gerado</span>
            <select data-property="spawnItemType">
              <option value="health" ${object.properties?.spawnItemType === "health" ? "selected" : ""}>Cura</option>
              <option value="coin" ${object.properties?.spawnItemType === "coin" ? "selected" : ""}>Moeda</option>
              <option value="weapon_basic" ${object.properties?.spawnItemType !== "health" && object.properties?.spawnItemType !== "coin" ? "selected" : ""}>Arma basica</option>
            </select>
          </label>
          ${this.renderNumberField("amount", "Quantidade", Number(object.properties?.amount ?? 25), 1)}
          ${this.renderListField("itemPool", "Item pool legado", getStringArrayProperty(object.properties?.itemPool, ["weapon_basic"]).join(", "))}
          <label class="field">
            <span>Spawn mode</span>
            <select data-property="spawnMode">
              <option value="fixed" ${object.properties?.spawnMode !== "random" ? "selected" : ""}>Fixed</option>
              <option value="random" ${object.properties?.spawnMode === "random" ? "selected" : ""}>Random</option>
            </select>
          </label>
          ${this.renderNumberField("respawnTime", "Respawn time", Number(object.properties?.respawnTime ?? 10), 0.5)}
          ${this.renderCheckboxField("spawnOnStart", "Spawn ao iniciar", object.properties?.spawnOnStart !== false)}
          ${this.renderNumberField("maxSpawnedItems", "Max itens ativos", Number(object.properties?.maxSpawnedItems ?? 1), 1)}
        `;
      case "itemPickup":
        return this.renderTextField("itemId", "Item ID", String(object.properties?.itemId ?? ""));
      default:
        return "";
    }
  }

  private renderCollisionField(object: MapObject): string {
    const isOpenDoor = object.type === "door" && (object.properties?.startsOpen || object.properties?.doorState === "open");
    const checked = isOpenDoor
      ? false
      : typeof object.properties?.collision === "boolean"
      ? object.properties.collision
      : getDefaultCollisionValue(object);

    return this.renderCheckboxField("collision", "Colisao solida", checked);
  }

  private renderMaterialFields(object: MapObject): string {
    const material = typeof object.properties?.material === "string" ? object.properties.material : "default";
    const opacity = typeof object.properties?.opacity === "number" ? object.properties.opacity : 1;
    const emissive = typeof object.properties?.emissive === "string" ? object.properties.emissive : "#000000";

    return `
      <label class="field">
        <span>Material</span>
        <select data-property="material">
          <option value="default" ${material === "default" ? "selected" : ""}>Default</option>
          <option value="metal" ${material === "metal" ? "selected" : ""}>Metal</option>
          <option value="glass" ${material === "glass" ? "selected" : ""}>Glass</option>
          <option value="glow" ${material === "glow" ? "selected" : ""}>Glow</option>
          <option value="rubber" ${material === "rubber" ? "selected" : ""}>Rubber</option>
          <option value="ice" ${material === "ice" ? "selected" : ""}>Ice</option>
        </select>
      </label>
      ${this.renderNumberField("opacity", "Opacidade", opacity, 0.05)}
      ${this.renderColorPropertyField("emissive", "Emissive", emissive)}
    `;
  }

  private renderNumberField(property: string, label: string, value: number, step: number): string {
    return `
      <label class="field">
        <span>${label}</span>
        <input data-property="${property}" type="number" step="${step}" value="${value}" />
      </label>
    `;
  }

  private renderTextField(property: string, label: string, value: string): string {
    return `
      <label class="field">
        <span>${label}</span>
        <input data-property="${property}" type="text" value="${escapeAttribute(value)}" />
      </label>
    `;
  }

  private renderListField(property: string, label: string, value: string): string {
    return `
      <label class="field">
        <span>${label}</span>
        <input data-property-list="${property}" type="text" value="${escapeAttribute(value)}" />
      </label>
    `;
  }

  private renderTextareaPropertyField(property: string, label: string, value: string): string {
    return `
      <label class="field">
        <span>${label}</span>
        <textarea data-property-lines="${property}" rows="3">${escapeHtml(value)}</textarea>
      </label>
    `;
  }

  private renderColorPropertyField(property: string, label: string, value: string): string {
    return `
      <label class="field">
        <span>${label}</span>
        <input data-property="${property}" type="color" value="${escapeAttribute(value)}" />
      </label>
    `;
  }

  private renderCheckboxField(property: string, label: string, checked: boolean): string {
    return `
      <label class="field checkbox-field">
        <input data-property="${property}" type="checkbox" ${checked ? "checked" : ""} />
        <span>${label}</span>
      </label>
    `;
  }

  private renderPropertyVectorFields(property: string, label: string, value: Vector3): string {
    return `
      <fieldset class="vector-field">
        <legend>${label}</legend>
        <label>
          <span>X</span>
          <input data-property-vector="${property}" data-axis="x" type="number" step="0.1" value="${value.x}" />
        </label>
        <label>
          <span>Y</span>
          <input data-property-vector="${property}" data-axis="y" type="number" step="0.1" value="${value.y}" />
        </label>
        <label>
          <span>Z</span>
          <input data-property-vector="${property}" data-axis="z" type="number" step="0.1" value="${value.z}" />
        </label>
      </fieldset>
    `;
  }

  private bindInputs(): void {
    this.root.querySelector<HTMLInputElement>('[data-field="name"]')?.addEventListener("input", (event) => {
      const value = (event.currentTarget as HTMLInputElement).value;
      this.selectedObject = this.selectedObject ? { ...this.selectedObject, name: value } : null;
      this.onChange({ name: value });
    });

    this.root.querySelector<HTMLInputElement>('[data-field="color"]')?.addEventListener("input", (event) => {
      const color = (event.currentTarget as HTMLInputElement).value;
      this.onChange({ properties: { color } });
    });

    this.root.querySelectorAll<HTMLInputElement>("[data-vector]").forEach((input) => {
      input.addEventListener("input", () => this.handleVectorInput(input));
    });

    this.root.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-property]").forEach((input) => {
      input.addEventListener("input", () => this.handlePropertyInput(input));
      input.addEventListener("change", () => this.handlePropertyInput(input));
    });

    this.root.querySelectorAll<HTMLInputElement>("[data-property-vector]").forEach((input) => {
      input.addEventListener("input", () => this.handlePropertyVectorInput(input));
    });

    this.root.querySelectorAll<HTMLInputElement>("[data-property-list]").forEach((input) => {
      input.addEventListener("input", () => this.handlePropertyListInput(input));
    });

    this.root.querySelectorAll<HTMLTextAreaElement>("[data-property-lines]").forEach((textarea) => {
      textarea.addEventListener("input", () => this.handlePropertyLinesInput(textarea));
    });

    this.root.querySelector<HTMLButtonElement>("[data-duplicate]")?.addEventListener("click", this.onDuplicate);
    this.root.querySelector<HTMLButtonElement>("[data-delete]")?.addEventListener("click", this.onDelete);
    this.root.querySelector<HTMLButtonElement>("[data-focus]")?.addEventListener("click", this.onFocus);
  }

  private handleVectorInput(input: HTMLInputElement): void {
    const vectorName = input.dataset.vector as "position" | "rotation" | "scale";
    const axis = input.dataset.axis as keyof Vector3;

    if (!this.selectedObject || !vectorName || !axis) {
      return;
    }

    const current = vectorName === "rotation"
      ? radiansToDegreesVector(this.selectedObject.rotation ?? { x: 0, y: 0, z: 0 })
      : { ...(this.selectedObject[vectorName] ?? getDefaultVector(vectorName)) };
    current[axis] = Number(input.value);

    const next = vectorName === "rotation" ? degreesToRadiansVector(current) : current;
    this.selectedObject = { ...this.selectedObject, [vectorName]: next };
    this.onChange({ [vectorName]: next });
  }

  private handlePropertyInput(input: HTMLInputElement | HTMLSelectElement): void {
    const property = input.dataset.property;

    if (!property) {
      return;
    }

    const value = input instanceof HTMLInputElement && input.type === "number"
      ? Number(input.value)
      : input instanceof HTMLInputElement && input.type === "checkbox"
        ? input.checked
      : input.value;

    const properties: Record<string, unknown> = { [property]: value };

    if (property === "value") {
      properties.coinValue = value;
    } else if (property === "damage") {
      properties.damagePerSecond = value;
    } else if (property === "targetDoorId") {
      properties.buttonTargetId = value;
    }

    this.onChange({ properties });
  }

  private handlePropertyVectorInput(input: HTMLInputElement): void {
    const property = input.dataset.propertyVector;
    const axis = input.dataset.axis as keyof Vector3;

    if (!this.selectedObject || !property || !axis) {
      return;
    }

    const current = getVectorProperty(this.selectedObject.properties?.[property], { x: 0, y: 0, z: 0 });
    current[axis] = Number(input.value);
    this.selectedObject = {
      ...this.selectedObject,
      properties: {
        ...this.selectedObject.properties,
        [property]: current
      }
    };
    this.onChange({ properties: { [property]: current } });
  }

  private handlePropertyListInput(input: HTMLInputElement): void {
    const property = input.dataset.propertyList;

    if (!property) {
      return;
    }

    const values = input.value
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    this.selectedObject = this.selectedObject
      ? {
        ...this.selectedObject,
        properties: {
          ...this.selectedObject.properties,
          [property]: values
        }
      }
      : null;
    this.onChange({ properties: { [property]: values } });
  }

  private handlePropertyLinesInput(textarea: HTMLTextAreaElement): void {
    const property = textarea.dataset.propertyLines;

    if (!property) {
      return;
    }

    const values = textarea.value
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    const properties: Record<string, unknown> = { [property]: values };

    if (property === "dialogue") {
      properties.dialog = values[0] ?? "";
    }

    this.selectedObject = this.selectedObject
      ? {
        ...this.selectedObject,
        properties: {
          ...this.selectedObject.properties,
          ...properties
        }
      }
      : null;
    this.onChange({ properties });
  }
}

function radiansToDegreesVector(vector: Vector3): Vector3 {
  return {
    x: round(THREE_RAD_TO_DEG * vector.x),
    y: round(THREE_RAD_TO_DEG * vector.y),
    z: round(THREE_RAD_TO_DEG * vector.z)
  };
}

function degreesToRadiansVector(vector: Vector3): Vector3 {
  return {
    x: round(THREE_DEG_TO_RAD * vector.x),
    y: round(THREE_DEG_TO_RAD * vector.y),
    z: round(THREE_DEG_TO_RAD * vector.z)
  };
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

const THREE_RAD_TO_DEG = 180 / Math.PI;
const THREE_DEG_TO_RAD = Math.PI / 180;

function getDefaultVector(vectorName: "position" | "rotation" | "scale"): Vector3 {
  return vectorName === "scale"
    ? { x: 1, y: 1, z: 1 }
    : { x: 0, y: 0, z: 0 };
}

function getVectorProperty(value: unknown, fallback: Vector3): Vector3 {
  if (
    typeof value === "object" &&
    value !== null &&
    "x" in value &&
    "y" in value &&
    "z" in value &&
    typeof value.x === "number" &&
    typeof value.y === "number" &&
    typeof value.z === "number"
  ) {
    return { x: value.x, y: value.y, z: value.z };
  }

  return { ...fallback };
}

function getStringArrayProperty(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  return [...fallback];
}

function getDialogueLines(value: unknown, fallback: string): string[] {
  if (Array.isArray(value)) {
    const lines = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);

    if (lines.length > 0) {
      return lines;
    }
  }

  return fallback.trim().length > 0 ? [fallback] : ["Ola!"];
}

function getDefaultCollisionValue(object: MapObject): boolean {
  if (object.type === "door") {
    return !(object.properties?.startsOpen || object.properties?.doorState === "open");
  }

  return object.type === "cube" ||
    object.type === "platform" ||
    object.type === "ramp" ||
    object.type === "model" ||
    object.type === "movingPlatform" ||
    object.type === "disappearingBlock" ||
    object.type === "tree" ||
    object.type === "rock" ||
    object.type === "crate" ||
    object.type === "barrel" ||
    object.type === "arch" ||
    object.type === "pillar";
}
