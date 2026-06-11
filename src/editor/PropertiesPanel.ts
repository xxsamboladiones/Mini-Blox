import { createIcons, icons } from "lucide";
import { WEAPON_SPAWNER_OPTIONS } from "../shared/ItemCatalog";
import type { MapObject, Vector3 } from "../shared/types/ObjectSchema";
import { sanitizeScale, sanitizeVector } from "./EditorObjectUtils";

type MapObjectPatch = Partial<MapObject>;

export class PropertiesPanel {
  private selectedObject: MapObject | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly onChange: (patch: MapObjectPatch) => void,
    private readonly onFocus: () => void,
    private readonly onDuplicate: () => void,
    private readonly onDelete: () => void,
    private readonly onCommitBegin: () => void = () => {},
    private readonly onCommitEnd: () => void = () => {}
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
    const color =
      typeof object.properties?.color === "string" ? object.properties.color : "#58a6ff";

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
    this.finishPropertyCommit();
    this.selectedObject = mapObject;
    this.render();
  }

  private renderVectorFields(
    name: "position" | "rotation" | "scale",
    label: string,
    value: Vector3
  ): string {
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
        return (
          this.renderNumberField(
            "damage",
            "Dano",
            Number(object.properties?.damage ?? object.properties?.damagePerSecond ?? 25),
            1
          ) +
          `
          <label class="field">
            <span>Modo</span>
            <select data-property="mode">
              <option value="kill" ${object.properties?.mode !== "damage" ? "selected" : ""}>Kill</option>
              <option value="damage" ${object.properties?.mode === "damage" ? "selected" : ""}>Damage</option>
            </select>
          </label>
        `
        );
      case "coin":
        return this.renderNumberField(
          "value",
          "Valor",
          Number(object.properties?.value ?? object.properties?.coinValue ?? 1),
          1
        );
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
            getDialogueLines(
              object.properties?.dialogue,
              String(object.properties?.dialog ?? "Ola!")
            ).join("\n")
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
        return this.renderTextField(
          "text",
          "Texto da placa",
          String(object.properties?.text ?? "Bem-vindo!")
        );
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
              ${WEAPON_SPAWNER_OPTIONS.map(
                (weapon) => `
              <option value="${weapon.id}" ${
                object.properties?.spawnItemType === weapon.id ||
                (!object.properties?.spawnItemType && weapon.id === "weapon_basic")
                  ? "selected"
                  : ""
              }>${weapon.label}</option>
            `
              ).join("")}
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
      case "teamSpawn":
        return `
          ${this.renderTextField("teamId", "Team ID", String(object.properties?.teamId ?? "red"))}
        `;
      case "capturePoint":
        return `
          ${this.renderTextField("pointId", "Point ID", String(object.properties?.pointId ?? object.id))}
          ${this.renderTextField("ownerTeamId", "Time dono inicial", String(object.properties?.ownerTeamId ?? ""))}
          ${this.renderNumberField("captureTime", "Tempo de captura", Number(object.properties?.captureTime ?? 5), 0.5)}
          ${this.renderNumberField("scorePerSecond", "Pontos por segundo", Number(object.properties?.scorePerSecond ?? 1), 0.5)}
          ${this.renderNumberField("radius", "Raio de captura", Number(object.properties?.radius ?? 4), 0.5)}
        `;
      case "tycoonOwnerClaim":
        return `
          ${this.renderTycoonBaseFields(object)}
          ${this.renderTextField("claimLabel", "Nome da base", String(object.properties?.claimLabel ?? "Minha Fabrica"))}
          ${this.renderCheckboxField("autoClaimInSolo", "Auto claim no solo", object.properties?.autoClaimInSolo !== false)}
        `;
      case "tycoonGenerator":
        return `
          ${this.renderTycoonBaseFields(object)}
          ${this.renderTextField("generatorId", "Generator ID", String(object.properties?.generatorId ?? object.id))}
          ${this.renderNumberField("incomePerTick", "Dinheiro por ciclo", Number(object.properties?.incomePerTick ?? 5), 1)}
          ${this.renderNumberField("tickInterval", "Intervalo (s)", Number(object.properties?.tickInterval ?? 2), 0.1)}
          ${this.renderTextField("targetCollectorId", "Collector alvo", String(object.properties?.targetCollectorId ?? ""))}
          ${this.renderCheckboxField("requiresPurchase", "Exige compra", Boolean(object.properties?.requiresPurchase))}
          ${this.renderTextField("purchaseId", "Purchase ID exigido", String(object.properties?.purchaseId ?? ""))}
          ${this.renderCheckboxField("startsEnabled", "Comeca ativo", object.properties?.startsEnabled !== false)}
          ${this.renderNumberField("maxStoredAmount", "Max armazenado", Number(object.properties?.maxStoredAmount ?? 500), 10)}
          ${this.renderTextField("upgradeGroupId", "Grupo de upgrade", String(object.properties?.upgradeGroupId ?? ""))}
        `;
      case "tycoonCollector":
        return `
          ${this.renderTycoonBaseFields(object)}
          ${this.renderTextField("collectorId", "Collector ID", String(object.properties?.collectorId ?? object.id))}
          ${this.renderNumberField("collectRadius", "Raio de coleta", Number(object.properties?.collectRadius ?? 2), 0.25)}
          ${this.renderNumberField("capacity", "Capacidade", Number(object.properties?.capacity ?? 1000), 10)}
          ${this.renderCheckboxField("autoCollect", "Coletar ao tocar", object.properties?.autoCollect !== false)}
          ${this.renderNumberField("collectCooldown", "Cooldown coleta", Number(object.properties?.collectCooldown ?? 0.5), 0.1)}
        `;
      case "tycoonBuyButton":
        return `
          ${this.renderTycoonBaseFields(object)}
          ${this.renderTextField("purchaseId", "Purchase ID", String(object.properties?.purchaseId ?? object.id))}
          ${this.renderNumberField("cost", "Custo", Number(object.properties?.cost ?? 25), 1)}
          ${this.renderListField("unlockObjectIds", "Objetos liberados", getStringArrayProperty(object.properties?.unlockObjectIds, []).join(", "))}
          ${this.renderTextField("unlockGroupId", "Grupo liberado", String(object.properties?.unlockGroupId ?? ""))}
          ${this.renderListField("unlockButtonIds", "Botoes liberados", getStringArrayProperty(object.properties?.unlockButtonIds, []).join(", "))}
          ${this.renderListField("requiredPurchaseIds", "Pre-requisitos", getStringArrayProperty(object.properties?.requiredPurchaseIds, []).join(", "))}
          ${this.renderCheckboxField("hideAfterPurchase", "Sumir apos compra", object.properties?.hideAfterPurchase !== false)}
          ${this.renderTextField("purchasedMessage", "Mensagem comprado", String(object.properties?.purchasedMessage ?? "Comprado!"))}
          ${this.renderTextField("insufficientFundsMessage", "Mensagem sem dinheiro", String(object.properties?.insufficientFundsMessage ?? "Dinheiro insuficiente."))}
          ${this.renderCheckboxField("oneTime", "Comprar uma vez", object.properties?.oneTime !== false)}
        `;
      case "tycoonUnlockable":
        return `
          ${this.renderTycoonBaseFields(object)}
          ${this.renderTextField("purchaseId", "Purchase ID", String(object.properties?.purchaseId ?? ""))}
          ${this.renderTextField("groupId", "Group ID", String(object.properties?.groupId ?? ""))}
          ${this.renderCheckboxField("startsLocked", "Comeca bloqueado", object.properties?.startsLocked !== false)}
          ${this.renderCheckboxField("lockedCollision", "Colisao bloqueado", Boolean(object.properties?.lockedCollision))}
          ${this.renderTextField("unlockedMessage", "Mensagem liberado", String(object.properties?.unlockedMessage ?? "Item desbloqueado!"))}
        `;
      case "tycoonUpgrade":
        return `
          ${this.renderTycoonBaseFields(object)}
          ${this.renderTextField("upgradeId", "Upgrade ID", String(object.properties?.upgradeId ?? object.id))}
          ${this.renderNumberField("cost", "Custo", Number(object.properties?.cost ?? 80), 1)}
          ${this.renderListField("targetGeneratorIds", "Geradores alvo", getStringArrayProperty(object.properties?.targetGeneratorIds, []).join(", "))}
          ${this.renderNumberField("incomeMultiplier", "Multiplicador renda", Number(object.properties?.incomeMultiplier ?? 1.5), 0.1)}
          ${this.renderNumberField("intervalMultiplier", "Multiplicador intervalo", Number(object.properties?.intervalMultiplier ?? 1), 0.05)}
          ${this.renderNumberField("collectorCapacityBonus", "Bonus capacidade", Number(object.properties?.collectorCapacityBonus ?? 0), 10)}
          ${this.renderListField("requiredPurchaseIds", "Pre-requisitos", getStringArrayProperty(object.properties?.requiredPurchaseIds, []).join(", "))}
          ${this.renderNumberField("maxLevel", "Nivel maximo", Number(object.properties?.maxLevel ?? 1), 1)}
          ${this.renderCheckboxField("hideAfterPurchase", "Sumir ao maximo", object.properties?.hideAfterPurchase !== false)}
        `;
      case "tycoonBarrier":
        return `
          ${this.renderTycoonBaseFields(object)}
          ${this.renderTextField("purchaseId", "Purchase ID", String(object.properties?.purchaseId ?? object.id))}
          ${this.renderCheckboxField("startsLocked", "Comeca bloqueada", object.properties?.startsLocked !== false)}
          ${this.renderCheckboxField("lockedCollision", "Colisao bloqueada", object.properties?.lockedCollision !== false)}
          ${this.renderColorPropertyField("lockedColor", "Cor bloqueada", String(object.properties?.lockedColor ?? "#ef4444"))}
          ${this.renderColorPropertyField("unlockedColor", "Cor liberada", String(object.properties?.unlockedColor ?? "#22c55e"))}
        `;
      case "itemPickup":
        return this.renderTextField("itemId", "Item ID", String(object.properties?.itemId ?? ""));
      default:
        return "";
    }
  }

  private renderTycoonBaseFields(object: MapObject): string {
    return this.renderTextField(
      "tycoonId",
      "Tycoon ID",
      String(object.properties?.tycoonId ?? "tycoon_1")
    );
  }

  private renderCollisionField(object: MapObject): string {
    const isOpenDoor =
      object.type === "door" &&
      (object.properties?.startsOpen || object.properties?.doorState === "open");
    const checked = isOpenDoor
      ? false
      : typeof object.properties?.collision === "boolean"
        ? object.properties.collision
        : getDefaultCollisionValue(object);

    return this.renderCheckboxField("collision", "Colisao solida", checked);
  }

  private renderMaterialFields(object: MapObject): string {
    const material =
      typeof object.properties?.material === "string" ? object.properties.material : "default";
    const opacity = typeof object.properties?.opacity === "number" ? object.properties.opacity : 1;
    const emissive =
      typeof object.properties?.emissive === "string" ? object.properties.emissive : "#000000";

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
    const safeValue = Number.isFinite(value) ? value : 0;

    return `
      <label class="field">
        <span>${label}</span>
        <input data-property="${property}" type="number" step="${step}" value="${safeValue}" />
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
    this.bindCommitLifecycle();
    this.root
      .querySelector<HTMLInputElement>('[data-field="name"]')
      ?.addEventListener("input", (event) => {
        const value = (event.currentTarget as HTMLInputElement).value;
        this.selectedObject = this.selectedObject ? { ...this.selectedObject, name: value } : null;
        this.onChange({ name: value });
      });
    this.root
      .querySelector<HTMLInputElement>('[data-field="name"]')
      ?.addEventListener("change", () => {
        this.finishPropertyCommit();
      });

    this.root
      .querySelector<HTMLInputElement>('[data-field="color"]')
      ?.addEventListener("input", (event) => {
        const color = (event.currentTarget as HTMLInputElement).value;
        this.onChange({ properties: { color } });
      });
    this.root
      .querySelector<HTMLInputElement>('[data-field="color"]')
      ?.addEventListener("change", () => {
        this.finishPropertyCommit();
      });

    this.root.querySelectorAll<HTMLInputElement>("[data-vector]").forEach((input) => {
      input.addEventListener("input", () => this.handleVectorInput(input));
      input.addEventListener("change", () => {
        this.handleVectorInput(input);
        this.finishPropertyCommit();
      });
    });

    this.root
      .querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-property]")
      .forEach((input) => {
        if (isDiscreteInput(input)) {
          input.addEventListener("change", () => {
            this.handlePropertyInput(input);
            this.finishPropertyCommit();
          });
        } else {
          input.addEventListener("input", () => this.handlePropertyInput(input));
          input.addEventListener("change", () => {
            this.handlePropertyInput(input);
            this.finishPropertyCommit();
          });
        }
      });

    this.root.querySelectorAll<HTMLInputElement>("[data-property-vector]").forEach((input) => {
      input.addEventListener("input", () => this.handlePropertyVectorInput(input));
      input.addEventListener("change", () => {
        this.handlePropertyVectorInput(input);
        this.finishPropertyCommit();
      });
    });

    this.root.querySelectorAll<HTMLInputElement>("[data-property-list]").forEach((input) => {
      input.addEventListener("input", () => this.handlePropertyListInput(input));
      input.addEventListener("change", () => {
        this.handlePropertyListInput(input);
        this.finishPropertyCommit();
      });
    });

    this.root.querySelectorAll<HTMLTextAreaElement>("[data-property-lines]").forEach((textarea) => {
      textarea.addEventListener("input", () => this.handlePropertyLinesInput(textarea));
      textarea.addEventListener("change", () => {
        this.handlePropertyLinesInput(textarea);
        this.finishPropertyCommit();
      });
    });

    this.root
      .querySelector<HTMLButtonElement>("[data-duplicate]")
      ?.addEventListener("click", this.onDuplicate);
    this.root
      .querySelector<HTMLButtonElement>("[data-delete]")
      ?.addEventListener("click", this.onDelete);
    this.root
      .querySelector<HTMLButtonElement>("[data-focus]")
      ?.addEventListener("click", this.onFocus);
  }

  private commitActive = false;

  private bindCommitLifecycle(): void {
    const inputs = this.root.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >(
      '[data-field="name"], [data-field="color"], [data-vector], [data-property], [data-property-vector], [data-property-list], [data-property-lines]'
    );

    inputs.forEach((input) => {
      input.addEventListener("focus", () => this.beginPropertyCommit());
      input.addEventListener("blur", () => this.finishPropertyCommit());
      input.addEventListener("keydown", (event) => {
        if (!(event instanceof KeyboardEvent)) {
          return;
        }

        if (event.key === "Enter" && !(input instanceof HTMLTextAreaElement)) {
          this.finishPropertyCommit();
          input.blur();
        }
      });
    });
  }

  private beginPropertyCommit(): void {
    if (this.commitActive || !this.selectedObject) {
      return;
    }

    this.commitActive = true;
    this.onCommitBegin();
  }

  private finishPropertyCommit(): void {
    if (!this.commitActive) {
      return;
    }

    this.commitActive = false;
    this.onCommitEnd();
  }

  private handleVectorInput(input: HTMLInputElement): void {
    const vectorName = input.dataset.vector as "position" | "rotation" | "scale";
    const axis = input.dataset.axis as keyof Vector3;

    if (!this.selectedObject || !vectorName || !axis) {
      return;
    }

    const current =
      vectorName === "rotation"
        ? radiansToDegreesVector(this.selectedObject.rotation ?? { x: 0, y: 0, z: 0 })
        : { ...(this.selectedObject[vectorName] ?? getDefaultVector(vectorName)) };
    const nextValue = readNumericInput(input, current[axis]);

    if (nextValue === null) {
      return;
    }

    current[axis] = nextValue;

    const next =
      vectorName === "rotation"
        ? degreesToRadiansVector(current)
        : vectorName === "scale"
          ? sanitizeScale(current)
          : sanitizeVector(current, getDefaultVector(vectorName));
    this.selectedObject = { ...this.selectedObject, [vectorName]: next };
    this.onChange({ [vectorName]: next });
  }

  private handlePropertyInput(input: HTMLInputElement | HTMLSelectElement): void {
    const property = input.dataset.property;

    if (!property) {
      return;
    }

    const value = readPropertyInputValue(input, this.selectedObject?.properties?.[property]);

    if (value === null) {
      return;
    }

    const properties: Record<string, unknown> = { [property]: value };

    if (property === "value") {
      properties.coinValue = value;
    } else if (property === "damage") {
      properties.damagePerSecond = value;
    } else if (property === "targetDoorId") {
      properties.buttonTargetId = value;
    }

    this.selectedObject = this.selectedObject
      ? {
          ...this.selectedObject,
          properties: {
            ...this.selectedObject.properties,
            ...properties,
          },
        }
      : null;
    this.onChange({ properties });
  }

  private handlePropertyVectorInput(input: HTMLInputElement): void {
    const property = input.dataset.propertyVector;
    const axis = input.dataset.axis as keyof Vector3;

    if (!this.selectedObject || !property || !axis) {
      return;
    }

    const current = getVectorProperty(this.selectedObject.properties?.[property], {
      x: 0,
      y: 0,
      z: 0,
    });
    const nextValue = readNumericInput(input, current[axis]);

    if (nextValue === null) {
      return;
    }

    current[axis] = nextValue;
    const next = sanitizeVector(current, { x: 0, y: 0, z: 0 });
    this.selectedObject = {
      ...this.selectedObject,
      properties: {
        ...this.selectedObject.properties,
        [property]: next,
      },
    };
    this.onChange({ properties: { [property]: next } });
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
            [property]: values,
          },
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
            ...properties,
          },
        }
      : null;
    this.onChange({ properties });
  }
}

function radiansToDegreesVector(vector: Vector3): Vector3 {
  return {
    x: round(THREE_RAD_TO_DEG * vector.x),
    y: round(THREE_RAD_TO_DEG * vector.y),
    z: round(THREE_RAD_TO_DEG * vector.z),
  };
}

function degreesToRadiansVector(vector: Vector3): Vector3 {
  return {
    x: round(THREE_DEG_TO_RAD * vector.x),
    y: round(THREE_DEG_TO_RAD * vector.y),
    z: round(THREE_DEG_TO_RAD * vector.z),
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
  return vectorName === "scale" ? { x: 1, y: 1, z: 1 } : { x: 0, y: 0, z: 0 };
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
    typeof value.z === "number" &&
    Number.isFinite(value.x) &&
    Number.isFinite(value.y) &&
    Number.isFinite(value.z)
  ) {
    return { x: value.x, y: value.y, z: value.z };
  }

  return { ...fallback };
}

function readNumericInput(input: HTMLInputElement, fallback: number): number | null {
  if (input.value.trim() === "") {
    return null;
  }

  const value = Number(input.value);
  return Number.isFinite(value) ? value : Number.isFinite(fallback) ? fallback : null;
}

function readPropertyInputValue(
  input: HTMLInputElement | HTMLSelectElement,
  fallback: unknown
): unknown | null {
  if (input instanceof HTMLInputElement && input.type === "number") {
    return readNumericInput(input, typeof fallback === "number" ? fallback : 0);
  }

  if (input instanceof HTMLInputElement && input.type === "checkbox") {
    return input.checked;
  }

  return input.value;
}

function isDiscreteInput(input: HTMLInputElement | HTMLSelectElement): boolean {
  return (
    input instanceof HTMLSelectElement ||
    (input instanceof HTMLInputElement && input.type === "checkbox")
  );
}

function getStringArrayProperty(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  return [...fallback];
}

function getDialogueLines(value: unknown, fallback: string): string[] {
  if (Array.isArray(value)) {
    const lines = value.filter(
      (item): item is string => typeof item === "string" && item.trim().length > 0
    );

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

  return (
    object.type === "cube" ||
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
    object.type === "pillar"
  );
}
