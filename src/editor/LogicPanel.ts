import { createIcons, icons } from "lucide";
import type { GameMap } from "../shared/types/MapSchema";
import type { MapObject } from "../shared/types/ObjectSchema";
import type {
  LogicAction,
  LogicCondition,
  LogicRule,
  LogicTrigger,
} from "../shared/types/ScriptSchema";

type LogicPanelActions = {
  onChange: (logic: LogicRule[]) => void;
  onDebugChange: (logicDebug: boolean) => void;
};

type TriggerType = LogicTrigger["type"];
type ConditionType = LogicCondition["type"];
type ActionType = LogicAction["type"];
type LogicPresetId =
  | "messageOnEnter"
  | "buttonOpensDoor"
  | "keyOpensDoor"
  | "finishOnEnter"
  | "teleportOnEnter"
  | "giveCoins";

export class LogicPanel {
  private map: GameMap | null = null;
  private query = "";
  private readonly collapsedRuleIds = new Set<string>();
  private readonly validatedRuleIds = new Set<string>();

  constructor(
    private readonly root: HTMLElement,
    private readonly actions: LogicPanelActions
  ) {}

  setMap(map: GameMap): void {
    this.map = structuredClone(map);
    this.render();
  }

  render(): void {
    const rules = this.getRules();
    const visibleRules = this.getFilteredRules(rules);
    const warningCount = rules.reduce((total, rule) => total + this.validateRule(rule).length, 0);

    this.root.innerHTML = `
      <div class="panel-heading">
        <h2>Logica</h2>
        <span class="type-pill">${rules.length} regras</span>
      </div>

      <div class="logic-toolbar">
        <label class="field">
          <span>Buscar regra</span>
          <input data-logic-search type="search" value="${escapeAttribute(this.query)}" placeholder="Nome, trigger ou acao" />
        </label>
        <label class="logic-enabled logic-debug-toggle">
          <input type="checkbox" ${this.map?.logicDebug ? "checked" : ""} data-logic-debug />
          <span>Debug no console</span>
        </label>
      </div>

      <div class="logic-preset-row">
        <label class="field">
          <span>Preset</span>
          <select data-logic-preset>
            ${PRESET_OPTIONS.map(
              (preset) => `
              <option value="${preset.id}">${preset.label}</option>
            `
            ).join("")}
          </select>
        </label>
        <button class="property-action compact-action" type="button" data-add-preset>
          <i data-lucide="wand-sparkles"></i>
          <span>Usar</span>
        </button>
      </div>

      <div class="logic-panel-actions">
        <button class="wide-action" type="button" data-add-logic-rule>
          <i data-lucide="plus"></i>
          <span>Nova regra vazia</span>
        </button>
      </div>

      ${
        warningCount > 0
          ? `
        <div class="logic-summary warning">${warningCount} aviso${warningCount === 1 ? "" : "s"} de configuracao</div>
      `
          : `
        <div class="logic-summary ok">Nenhum aviso de logica</div>
      `
      }

      <div class="logic-list">
        ${visibleRules.length === 0 ? `<div class="empty-row">${rules.length === 0 ? "Nenhuma regra" : "Nenhuma regra encontrada"}</div>` : ""}
        ${visibleRules.map((rule) => this.renderRule(rule, rules)).join("")}
      </div>
    `;

    this.bindEvents();
    createIcons({ icons });
  }

  private renderRule(rule: LogicRule, allRules: LogicRule[]): string {
    const warnings = this.validateRule(rule);
    const collapsed = this.collapsedRuleIds.has(rule.id);
    const ruleIndex = allRules.findIndex((candidate) => candidate.id === rule.id);
    const canMoveUp = ruleIndex > 0;
    const canMoveDown = ruleIndex >= 0 && ruleIndex < allRules.length - 1;

    return `
      <article class="logic-rule-card ${rule.enabled ? "" : "inactive"} ${warnings.length > 0 ? "has-warnings" : ""}">
        <div class="logic-rule-titlebar">
          <button class="icon-action compact" type="button" data-toggle-rule data-rule-id="${escapeAttribute(rule.id)}" title="${collapsed ? "Expandir" : "Recolher"}" aria-label="${collapsed ? "Expandir" : "Recolher"}">
            <i data-lucide="${collapsed ? "chevron-right" : "chevron-down"}"></i>
          </button>
          <div class="logic-rule-title">
            <strong>${escapeHtml(rule.name.trim() || "Regra sem nome")}</strong>
            <span>${escapeHtml(getTriggerLabel(rule.trigger))}</span>
          </div>
          <div class="logic-badges">
            <span class="logic-badge ${rule.enabled ? "active" : "inactive"}">${rule.enabled ? "Ativa" : "Inativa"}</span>
            <span class="logic-badge">${rule.conditions.length} cond</span>
            <span class="logic-badge">${rule.actions.length} acoes</span>
            ${warnings.length > 0 ? `<span class="logic-badge warning">${warnings.length} avisos</span>` : ""}
          </div>
        </div>

        <div class="logic-rule-controls">
          <button class="icon-action compact" type="button" data-validate-rule data-rule-id="${escapeAttribute(rule.id)}" title="Validar regra" aria-label="Validar regra">
            <i data-lucide="badge-check"></i>
          </button>
          <button class="icon-action compact" type="button" data-duplicate-rule data-rule-id="${escapeAttribute(rule.id)}" title="Duplicar regra" aria-label="Duplicar regra">
            <i data-lucide="copy"></i>
          </button>
          <button class="icon-action compact" type="button" data-move-rule-up data-rule-id="${escapeAttribute(rule.id)}" ${canMoveUp ? "" : "disabled"} title="Mover para cima" aria-label="Mover para cima">
            <i data-lucide="arrow-up"></i>
          </button>
          <button class="icon-action compact" type="button" data-move-rule-down data-rule-id="${escapeAttribute(rule.id)}" ${canMoveDown ? "" : "disabled"} title="Mover para baixo" aria-label="Mover para baixo">
            <i data-lucide="arrow-down"></i>
          </button>
          <button class="icon-action compact danger" type="button" data-delete-rule data-rule-id="${escapeAttribute(rule.id)}" title="Excluir regra" aria-label="Excluir regra">
            <i data-lucide="trash-2"></i>
          </button>
        </div>

        ${warnings.length > 0 ? this.renderWarnings(warnings) : ""}
        ${this.validatedRuleIds.has(rule.id) && warnings.length === 0 ? `<div class="logic-summary ok">Regra valida para os objetos atuais.</div>` : ""}

        <div class="logic-rule-body ${collapsed ? "hidden" : ""}">
          <div class="logic-rule-heading">
            <label class="field logic-rule-name">
              <span>Regra</span>
              <input type="text" value="${escapeAttribute(rule.name)}" data-rule-name data-rule-id="${escapeAttribute(rule.id)}" />
            </label>
            <label class="logic-enabled">
              <input type="checkbox" ${rule.enabled ? "checked" : ""} data-rule-enabled data-rule-id="${escapeAttribute(rule.id)}" />
              <span>Ativa</span>
            </label>
          </div>

          <label class="field">
            <span>Trigger</span>
            <select data-trigger-type data-rule-id="${escapeAttribute(rule.id)}">
              ${TRIGGER_OPTIONS.map(
                (option) => `
                <option value="${option.type}" ${rule.trigger.type === option.type ? "selected" : ""}>${option.label}</option>
              `
              ).join("")}
            </select>
          </label>
          ${this.renderTriggerFields(rule)}

          <div class="logic-section-heading">
            <strong>Condicoes</strong>
            <button class="property-action compact-action" type="button" data-add-condition data-rule-id="${escapeAttribute(rule.id)}">
              <i data-lucide="plus"></i>
              <span>Adicionar condicao</span>
            </button>
          </div>
          <div class="logic-stack">
            ${rule.conditions.length === 0 ? `<div class="empty-row">Sem condicoes</div>` : ""}
            ${rule.conditions.map((condition, index) => this.renderCondition(rule, condition, index)).join("")}
          </div>

          <div class="logic-section-heading">
            <strong>Acoes</strong>
            <button class="property-action compact-action" type="button" data-add-action data-rule-id="${escapeAttribute(rule.id)}">
              <i data-lucide="plus"></i>
              <span>Adicionar acao</span>
            </button>
          </div>
          <div class="logic-stack">
            ${rule.actions.length === 0 ? `<div class="empty-row">Sem acoes</div>` : ""}
            ${rule.actions.map((action, index) => this.renderAction(rule, action, index)).join("")}
          </div>
        </div>
      </article>
    `;
  }

  private renderWarnings(warnings: string[]): string {
    return `
      <ul class="logic-warnings">
        ${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}
      </ul>
    `;
  }

  private renderTriggerFields(rule: LogicRule): string {
    if (
      rule.trigger.type === "onPlayerEnterObject" ||
      rule.trigger.type === "onButtonActivated" ||
      rule.trigger.type === "onCoinCollected"
    ) {
      return this.renderObjectSelect(
        "Objeto",
        rule.trigger.objectId,
        "data-trigger-object",
        rule.id
      );
    }

    if (rule.trigger.type === "onKeyCollected") {
      return this.renderKeySelect("Chave", rule.trigger.keyId, "data-trigger-key", rule.id);
    }

    if (rule.trigger.type === "onEnemyDefeated") {
      return this.renderEnemySelect(
        "Inimigo",
        rule.trigger.objectId,
        "data-trigger-enemy",
        rule.id
      );
    }

    if (rule.trigger.type === "onNpcInteracted") {
      return this.renderNpcSelect("NPC", rule.trigger.objectId, "data-trigger-npc", rule.id);
    }

    if (rule.trigger.type === "onObjectiveCompleted") {
      return this.renderObjectiveSelect(
        "Objetivo",
        rule.trigger.objectiveId,
        "data-trigger-objective",
        rule.id
      );
    }

    if (rule.trigger.type === "onItemCollected") {
      return this.renderItemTypeSelect("Item", rule.trigger.itemType, "data-trigger-item", rule.id);
    }

    if (rule.trigger.type === "onScoreReached") {
      return this.renderAmountInput(
        "Pontuacao",
        rule.trigger.amount,
        "data-trigger-amount",
        rule.id
      );
    }

    if (rule.trigger.type === "onTeamScoreReached") {
      return `
        ${this.renderTeamSelect("Time", rule.trigger.teamId, "data-trigger-team", rule.id)}
        ${this.renderAmountInput("Pontuacao", rule.trigger.amount, "data-trigger-amount", rule.id)}
      `;
    }

    if (rule.trigger.type === "onCapturePointCaptured") {
      return `
        ${this.renderCapturePointSelect("Ponto", rule.trigger.pointId, "data-trigger-point", rule.id)}
        ${this.renderTeamSelect("Time opcional", rule.trigger.teamId ?? "", "data-trigger-team", rule.id)}
      `;
    }

    return "";
  }

  private renderCondition(rule: LogicRule, condition: LogicCondition, index: number): string {
    return `
      <div class="logic-item">
        <div class="logic-item-top">
          <label class="field">
            <span>Condicao</span>
            <select data-condition-type data-rule-id="${escapeAttribute(rule.id)}" data-index="${index}">
              ${CONDITION_OPTIONS.map(
                (option) => `
                <option value="${option.type}" ${condition.type === option.type ? "selected" : ""}>${option.label}</option>
              `
              ).join("")}
            </select>
          </label>
          <button class="icon-action compact danger" type="button" data-remove-condition data-rule-id="${escapeAttribute(rule.id)}" data-index="${index}" title="Remover condicao" aria-label="Remover condicao">
            <i data-lucide="x"></i>
          </button>
        </div>
        ${this.renderConditionFields(rule, condition, index)}
      </div>
    `;
  }

  private renderConditionFields(rule: LogicRule, condition: LogicCondition, index: number): string {
    if (condition.type === "hasKey") {
      return this.renderKeySelect("Key ID", condition.keyId, "data-condition-key", rule.id, index);
    }

    if (condition.type === "coinsAtLeast") {
      return `
        <label class="field">
          <span>Quantidade</span>
          <input type="number" min="0" step="1" value="${condition.amount}" data-condition-amount data-rule-id="${escapeAttribute(rule.id)}" data-index="${index}" />
        </label>
      `;
    }

    if (condition.type === "doorIsOpen") {
      return this.renderDoorSelect(
        "Porta",
        condition.doorId,
        "data-condition-door",
        rule.id,
        index
      );
    }

    if (condition.type === "enemyDefeated") {
      return this.renderEnemySelect(
        "Inimigo",
        condition.objectId,
        "data-condition-enemy",
        rule.id,
        index
      );
    }

    if (condition.type === "enemiesDefeatedAtLeast") {
      return `
        <label class="field">
          <span>Quantidade</span>
          <input type="number" min="0" step="1" value="${condition.amount}" data-condition-amount data-rule-id="${escapeAttribute(rule.id)}" data-index="${index}" />
        </label>
      `;
    }

    if (condition.type === "hasWeapon") {
      return this.renderWeaponSelect(
        "Arma",
        condition.weaponId,
        "data-condition-weapon",
        rule.id,
        index
      );
    }

    if (condition.type === "healthBelow") {
      return `
        <label class="field">
          <span>Vida abaixo de</span>
          <input type="number" min="1" step="1" value="${condition.amount}" data-condition-amount data-rule-id="${escapeAttribute(rule.id)}" data-index="${index}" />
        </label>
      `;
    }

    return `<div class="logic-note">Executa uma vez por sessao.</div>`;
  }

  private renderAction(rule: LogicRule, action: LogicAction, index: number): string {
    return `
      <div class="logic-item">
        <div class="logic-item-top">
          <label class="field">
            <span>Acao</span>
            <select data-action-type data-rule-id="${escapeAttribute(rule.id)}" data-index="${index}">
              ${ACTION_OPTIONS.map(
                (option) => `
                <option value="${option.type}" ${action.type === option.type ? "selected" : ""}>${option.label}</option>
              `
              ).join("")}
            </select>
          </label>
          <button class="icon-action compact danger" type="button" data-remove-action data-rule-id="${escapeAttribute(rule.id)}" data-index="${index}" title="Remover acao" aria-label="Remover acao">
            <i data-lucide="x"></i>
          </button>
        </div>
        ${this.renderActionFields(rule, action, index)}
      </div>
    `;
  }

  private renderActionFields(rule: LogicRule, action: LogicAction, index: number): string {
    if (action.type === "showMessage") {
      return `
        <label class="field">
          <span>Mensagem</span>
          <input type="text" value="${escapeAttribute(action.message)}" data-action-message data-rule-id="${escapeAttribute(rule.id)}" data-index="${index}" />
        </label>
      `;
    }

    if (action.type === "openDoor" || action.type === "closeDoor") {
      return this.renderDoorSelect("Porta", action.doorId, "data-action-door", rule.id, index);
    }

    if (action.type === "teleportPlayer") {
      return this.renderObjectSelect(
        "Destino",
        action.targetObjectId,
        "data-action-target",
        rule.id,
        index
      );
    }

    if (action.type === "giveCoins" || action.type === "addScore") {
      return `
        <label class="field">
          <span>Quantidade</span>
          <input type="number" step="1" value="${action.amount}" data-action-amount data-rule-id="${escapeAttribute(rule.id)}" data-index="${index}" />
        </label>
      `;
    }

    if (
      action.type === "setCheckpoint" ||
      action.type === "enableObject" ||
      action.type === "disableObject"
    ) {
      return this.renderObjectSelect(
        "Objeto",
        action.objectId,
        "data-action-object",
        rule.id,
        index
      );
    }

    if (action.type === "spawnEnemy") {
      return this.renderEnemySelect(
        "Inimigo",
        action.objectId,
        "data-action-enemy",
        rule.id,
        index
      );
    }

    if (action.type === "healPlayer" || action.type === "damagePlayer") {
      return `
        <label class="field">
          <span>Quantidade</span>
          <input type="number" step="1" value="${action.amount}" data-action-amount data-rule-id="${escapeAttribute(rule.id)}" data-index="${index}" />
        </label>
      `;
    }

    if (action.type === "giveWeapon") {
      return this.renderWeaponSelect("Arma", action.weaponId, "data-action-weapon", rule.id, index);
    }

    if (action.type === "completeObjective") {
      return this.renderObjectiveSelect(
        "Objetivo",
        action.objectiveId,
        "data-action-objective",
        rule.id,
        index
      );
    }

    if (action.type === "showDialogue") {
      return `
        ${this.renderNpcSelect("NPC", action.objectId, "data-action-dialogue-object", rule.id, index)}
        <label class="field">
          <span>Fala</span>
          <input type="text" value="${escapeAttribute(action.message)}" data-action-message data-rule-id="${escapeAttribute(rule.id)}" data-index="${index}" />
        </label>
      `;
    }

    if (action.type === "addTeamScore") {
      return `
        ${this.renderTeamSelect("Time", action.teamId, "data-action-team", rule.id, index)}
        <label class="field">
          <span>Quantidade</span>
          <input type="number" step="1" value="${action.amount}" data-action-amount data-rule-id="${escapeAttribute(rule.id)}" data-index="${index}" />
        </label>
      `;
    }

    if (action.type === "setTeam") {
      return this.renderTeamSelect("Time", action.teamId, "data-action-team", rule.id, index);
    }

    if (action.type === "endRound") {
      return `
        <label class="field">
          <span>Resultado</span>
          <select data-action-result data-rule-id="${escapeAttribute(rule.id)}" data-index="${index}">
            <option value="win" ${action.result === "win" ? "selected" : ""}>Vitoria</option>
            <option value="lose" ${action.result === "lose" ? "selected" : ""}>Derrota</option>
            <option value="draw" ${action.result === "draw" ? "selected" : ""}>Empate</option>
          </select>
        </label>
      `;
    }

    return `<div class="logic-note">Finaliza o mapa imediatamente.</div>`;
  }

  private renderAmountInput(
    label: string,
    value: number,
    attribute: string,
    ruleId: string
  ): string {
    return `
      <label class="field">
        <span>${label}</span>
        <input ${attribute} data-rule-id="${escapeAttribute(ruleId)}" type="number" min="0" step="1" value="${value}" />
      </label>
    `;
  }

  private renderObjectSelect(
    label: string,
    value: string,
    attribute: string,
    ruleId: string,
    index?: number
  ): string {
    const objects = this.getObjects();
    const exists = value.length === 0 || objects.some((object) => object.id === value);
    const indexAttribute = index === undefined ? "" : ` data-index="${index}"`;

    return `
      <label class="field">
        <span>${label}</span>
        <select ${attribute} data-rule-id="${escapeAttribute(ruleId)}"${indexAttribute}>
          <option value="">Escolha um objeto</option>
          ${!exists ? `<option value="${escapeAttribute(value)}" selected>Objeto nao encontrado (${escapeHtml(value)})</option>` : ""}
          ${objects
            .map(
              (object) => `
            <option value="${escapeAttribute(object.id)}" ${object.id === value ? "selected" : ""}>
              ${escapeHtml(getObjectLabel(object))}
            </option>
          `
            )
            .join("")}
        </select>
      </label>
    `;
  }

  private renderDoorSelect(
    label: string,
    value: string,
    attribute: string,
    ruleId: string,
    index?: number
  ): string {
    const doors = this.getDoorOptions();
    const exists = value.length === 0 || doors.some((door) => door.id === value);
    const indexAttribute = index === undefined ? "" : ` data-index="${index}"`;

    return `
      <label class="field">
        <span>${label}</span>
        <select ${attribute} data-rule-id="${escapeAttribute(ruleId)}"${indexAttribute}>
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

  private renderKeySelect(
    label: string,
    value: string,
    attribute: string,
    ruleId: string,
    index?: number
  ): string {
    const keys = this.getKeyOptions();
    const exists = value.length === 0 || keys.some((key) => key.id === value);
    const indexAttribute = index === undefined ? "" : ` data-index="${index}"`;

    return `
      <label class="field">
        <span>${label}</span>
        <select ${attribute} data-rule-id="${escapeAttribute(ruleId)}"${indexAttribute}>
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

  private renderEnemySelect(
    label: string,
    value: string,
    attribute: string,
    ruleId: string,
    index?: number
  ): string {
    const enemies = this.getEnemyOptions();
    const exists = value.length === 0 || enemies.some((enemy) => enemy.id === value);
    const indexAttribute = index === undefined ? "" : ` data-index="${index}"`;

    return `
      <label class="field">
        <span>${label}</span>
        <select ${attribute} data-rule-id="${escapeAttribute(ruleId)}"${indexAttribute}>
          <option value="">Escolha um inimigo</option>
          ${!exists ? `<option value="${escapeAttribute(value)}" selected>Inimigo nao encontrado (${escapeHtml(value)})</option>` : ""}
          ${enemies
            .map(
              (enemy) => `
            <option value="${escapeAttribute(enemy.id)}" ${enemy.id === value ? "selected" : ""}>
              ${escapeHtml(`${enemy.label} (${enemy.id})`)}
            </option>
          `
            )
            .join("")}
        </select>
      </label>
    `;
  }

  private renderNpcSelect(
    label: string,
    value: string,
    attribute: string,
    ruleId: string,
    index?: number
  ): string {
    const npcs = this.getNpcOptions();
    const exists = value.length === 0 || npcs.some((npc) => npc.id === value);
    const indexAttribute = index === undefined ? "" : ` data-index="${index}"`;

    return `
      <label class="field">
        <span>${label}</span>
        <select ${attribute} data-rule-id="${escapeAttribute(ruleId)}"${indexAttribute}>
          <option value="">Escolha um NPC</option>
          ${!exists ? `<option value="${escapeAttribute(value)}" selected>NPC nao encontrado (${escapeHtml(value)})</option>` : ""}
          ${npcs
            .map(
              (npc) => `
            <option value="${escapeAttribute(npc.id)}" ${npc.id === value ? "selected" : ""}>
              ${escapeHtml(`${npc.label} (${npc.id})`)}
            </option>
          `
            )
            .join("")}
        </select>
      </label>
    `;
  }

  private renderObjectiveSelect(
    label: string,
    value: string,
    attribute: string,
    ruleId: string,
    index?: number
  ): string {
    const objectives = this.getObjectiveOptions();
    const exists = value.length === 0 || objectives.some((objective) => objective.id === value);
    const indexAttribute = index === undefined ? "" : ` data-index="${index}"`;

    return `
      <label class="field">
        <span>${label}</span>
        <select ${attribute} data-rule-id="${escapeAttribute(ruleId)}"${indexAttribute}>
          <option value="">Escolha um objetivo</option>
          ${!exists ? `<option value="${escapeAttribute(value)}" selected>Objetivo nao encontrado (${escapeHtml(value)})</option>` : ""}
          ${objectives
            .map(
              (objective) => `
            <option value="${escapeAttribute(objective.id)}" ${objective.id === value ? "selected" : ""}>
              ${escapeHtml(`${objective.label} (${objective.id})`)}
            </option>
          `
            )
            .join("")}
        </select>
      </label>
    `;
  }

  private renderItemTypeSelect(
    label: string,
    value: string,
    attribute: string,
    ruleId: string,
    index?: number
  ): string {
    const exists = isValidItemType(value);
    const indexAttribute = index === undefined ? "" : ` data-index="${index}"`;

    return `
      <label class="field">
        <span>${label}</span>
        <select ${attribute} data-rule-id="${escapeAttribute(ruleId)}"${indexAttribute}>
          ${!exists ? `<option value="${escapeAttribute(value)}" selected>Item invalido (${escapeHtml(value)})</option>` : ""}
          ${ITEM_TYPE_OPTIONS.map(
            (item) => `
            <option value="${item.id}" ${item.id === value ? "selected" : ""}>${item.label}</option>
          `
          ).join("")}
        </select>
      </label>
    `;
  }

  private renderWeaponSelect(
    label: string,
    value: string,
    attribute: string,
    ruleId: string,
    index?: number
  ): string {
    const exists = isValidWeaponId(value);
    const indexAttribute = index === undefined ? "" : ` data-index="${index}"`;

    return `
      <label class="field">
        <span>${label}</span>
        <select ${attribute} data-rule-id="${escapeAttribute(ruleId)}"${indexAttribute}>
          ${!exists ? `<option value="${escapeAttribute(value)}" selected>Arma invalida (${escapeHtml(value)})</option>` : ""}
          ${WEAPON_OPTIONS.map(
            (weapon) => `
            <option value="${weapon.id}" ${weapon.id === value ? "selected" : ""}>${weapon.label}</option>
          `
          ).join("")}
        </select>
      </label>
    `;
  }

  private renderTeamSelect(
    label: string,
    value: string,
    attribute: string,
    ruleId: string,
    index?: number
  ): string {
    const teams = this.getTeamOptions();
    const exists = value.length === 0 || teams.some((team) => team.id === value);
    const indexAttribute = index === undefined ? "" : ` data-index="${index}"`;

    return `
      <label class="field">
        <span>${label}</span>
        <select ${attribute} data-rule-id="${escapeAttribute(ruleId)}"${indexAttribute}>
          <option value="">${label.includes("opcional") ? "Qualquer time" : "Escolha um time"}</option>
          ${!exists ? `<option value="${escapeAttribute(value)}" selected>Time nao encontrado (${escapeHtml(value)})</option>` : ""}
          ${teams
            .map(
              (team) => `
            <option value="${escapeAttribute(team.id)}" ${team.id === value ? "selected" : ""}>
              ${escapeHtml(`${team.label} (${team.id})`)}
            </option>
          `
            )
            .join("")}
        </select>
      </label>
    `;
  }

  private renderCapturePointSelect(
    label: string,
    value: string,
    attribute: string,
    ruleId: string
  ): string {
    const points = this.getCapturePointOptions();
    const exists = value.length === 0 || points.some((point) => point.id === value);

    return `
      <label class="field">
        <span>${label}</span>
        <select ${attribute} data-rule-id="${escapeAttribute(ruleId)}">
          <option value="">Escolha um ponto</option>
          ${!exists ? `<option value="${escapeAttribute(value)}" selected>Ponto nao encontrado (${escapeHtml(value)})</option>` : ""}
          ${points
            .map(
              (point) => `
            <option value="${escapeAttribute(point.id)}" ${point.id === value ? "selected" : ""}>
              ${escapeHtml(`${point.label} (${point.id})`)}
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
      .querySelector<HTMLInputElement>("[data-logic-search]")
      ?.addEventListener("input", (event) => {
        this.query = (event.currentTarget as HTMLInputElement).value;
        this.render();
      });

    this.root
      .querySelector<HTMLInputElement>("[data-logic-debug]")
      ?.addEventListener("change", (event) => {
        const logicDebug = (event.currentTarget as HTMLInputElement).checked;

        if (this.map) {
          this.map.logicDebug = logicDebug;
        }

        this.actions.onDebugChange(logicDebug);
        this.render();
      });

    this.root
      .querySelector<HTMLButtonElement>("[data-add-logic-rule]")
      ?.addEventListener("click", () => {
        this.updateRules((rules) => {
          rules.push(createDefaultRule(rules.length + 1, this.getObjects(), this.getKeyOptions()));
        });
      });

    this.root
      .querySelector<HTMLButtonElement>("[data-add-preset]")
      ?.addEventListener("click", () => {
        const select = this.root.querySelector<HTMLSelectElement>("[data-logic-preset]");
        const presetId = toPresetId(select?.value ?? "messageOnEnter");

        this.updateRules((rules) => {
          rules.push(
            createPresetRule(presetId, rules.length + 1, this.getObjects(), this.getKeyOptions())
          );
        });
      });

    this.root.querySelectorAll<HTMLButtonElement>("[data-toggle-rule]").forEach((button) => {
      button.addEventListener("click", () => {
        const ruleId = button.dataset.ruleId;

        if (!ruleId) {
          return;
        }

        if (this.collapsedRuleIds.has(ruleId)) {
          this.collapsedRuleIds.delete(ruleId);
        } else {
          this.collapsedRuleIds.add(ruleId);
        }

        this.render();
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>("[data-validate-rule]").forEach((button) => {
      button.addEventListener("click", () => {
        const ruleId = button.dataset.ruleId;

        if (ruleId) {
          this.validatedRuleIds.add(ruleId);
          this.render();
        }
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>("[data-duplicate-rule]").forEach((button) => {
      button.addEventListener("click", () => {
        this.updateRules((rules) => {
          const index = rules.findIndex((rule) => rule.id === button.dataset.ruleId);

          if (index >= 0) {
            rules.splice(index + 1, 0, duplicateRule(rules[index]));
          }
        });
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>("[data-move-rule-up]").forEach((button) => {
      button.addEventListener("click", () => this.moveRule(button.dataset.ruleId, -1));
    });

    this.root.querySelectorAll<HTMLButtonElement>("[data-move-rule-down]").forEach((button) => {
      button.addEventListener("click", () => this.moveRule(button.dataset.ruleId, 1));
    });

    this.root.querySelectorAll<HTMLInputElement>("[data-rule-name]").forEach((input) => {
      input.addEventListener("change", () => {
        this.updateRule(input.dataset.ruleId, (rule) => {
          rule.name = input.value.trim();
        });
      });
    });

    this.root.querySelectorAll<HTMLInputElement>("[data-rule-enabled]").forEach((input) => {
      input.addEventListener("change", () => {
        this.updateRule(input.dataset.ruleId, (rule) => {
          rule.enabled = input.checked;
        });
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>("[data-delete-rule]").forEach((button) => {
      button.addEventListener("click", () => {
        this.updateRules((rules) => {
          const index = rules.findIndex((rule) => rule.id === button.dataset.ruleId);

          if (index >= 0) {
            rules.splice(index, 1);
          }
        });
      });
    });

    this.root.querySelectorAll<HTMLSelectElement>("[data-trigger-type]").forEach((select) => {
      select.addEventListener("change", () => {
        this.updateRule(select.dataset.ruleId, (rule) => {
          rule.trigger = createDefaultTrigger(
            toTriggerType(select.value),
            this.getObjects(),
            this.getKeyOptions()
          );
        });
      });
    });

    this.root.querySelectorAll<HTMLSelectElement>("[data-trigger-object]").forEach((select) => {
      select.addEventListener("change", () => {
        this.updateRule(select.dataset.ruleId, (rule) => {
          if (
            rule.trigger.type === "onPlayerEnterObject" ||
            rule.trigger.type === "onButtonActivated" ||
            rule.trigger.type === "onCoinCollected"
          ) {
            rule.trigger.objectId = select.value;
          }
        });
      });
    });

    this.root.querySelectorAll<HTMLSelectElement>("[data-trigger-key]").forEach((select) => {
      select.addEventListener("change", () => {
        this.updateRule(select.dataset.ruleId, (rule) => {
          if (rule.trigger.type === "onKeyCollected") {
            rule.trigger.keyId = select.value;
          }
        });
      });
    });

    this.root.querySelectorAll<HTMLSelectElement>("[data-trigger-enemy]").forEach((select) => {
      select.addEventListener("change", () => {
        this.updateRule(select.dataset.ruleId, (rule) => {
          if (rule.trigger.type === "onEnemyDefeated") {
            rule.trigger.objectId = select.value;
          }
        });
      });
    });

    this.root.querySelectorAll<HTMLSelectElement>("[data-trigger-npc]").forEach((select) => {
      select.addEventListener("change", () => {
        this.updateRule(select.dataset.ruleId, (rule) => {
          if (rule.trigger.type === "onNpcInteracted") {
            rule.trigger.objectId = select.value;
          }
        });
      });
    });

    this.root.querySelectorAll<HTMLSelectElement>("[data-trigger-objective]").forEach((select) => {
      select.addEventListener("change", () => {
        this.updateRule(select.dataset.ruleId, (rule) => {
          if (rule.trigger.type === "onObjectiveCompleted") {
            rule.trigger.objectiveId = select.value;
          }
        });
      });
    });

    this.root.querySelectorAll<HTMLSelectElement>("[data-trigger-item]").forEach((select) => {
      select.addEventListener("change", () => {
        this.updateRule(select.dataset.ruleId, (rule) => {
          if (rule.trigger.type === "onItemCollected") {
            rule.trigger.itemType = select.value;
          }
        });
      });
    });

    this.root.querySelectorAll<HTMLInputElement>("[data-trigger-amount]").forEach((input) => {
      input.addEventListener("change", () => {
        this.updateRule(input.dataset.ruleId, (rule) => {
          if (
            rule.trigger.type === "onScoreReached" ||
            rule.trigger.type === "onTeamScoreReached"
          ) {
            rule.trigger.amount = Math.max(0, Math.floor(Number(input.value) || 0));
          }
        });
      });
    });

    this.root.querySelectorAll<HTMLSelectElement>("[data-trigger-team]").forEach((select) => {
      select.addEventListener("change", () => {
        this.updateRule(select.dataset.ruleId, (rule) => {
          if (rule.trigger.type === "onTeamScoreReached") {
            rule.trigger.teamId = select.value;
          } else if (rule.trigger.type === "onCapturePointCaptured") {
            rule.trigger.teamId = select.value || undefined;
          }
        });
      });
    });

    this.root.querySelectorAll<HTMLSelectElement>("[data-trigger-point]").forEach((select) => {
      select.addEventListener("change", () => {
        this.updateRule(select.dataset.ruleId, (rule) => {
          if (rule.trigger.type === "onCapturePointCaptured") {
            rule.trigger.pointId = select.value;
          }
        });
      });
    });

    this.bindConditionEvents();
    this.bindActionEvents();
  }

  private bindConditionEvents(): void {
    this.root.querySelectorAll<HTMLButtonElement>("[data-add-condition]").forEach((button) => {
      button.addEventListener("click", () => {
        this.updateRule(button.dataset.ruleId, (rule) => {
          rule.conditions.push(
            createDefaultCondition("once", this.getKeyOptions(), this.getObjects())
          );
        });
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>("[data-remove-condition]").forEach((button) => {
      button.addEventListener("click", () => {
        this.updateRule(button.dataset.ruleId, (rule) => {
          rule.conditions.splice(getIndex(button), 1);
        });
      });
    });

    this.root.querySelectorAll<HTMLSelectElement>("[data-condition-type]").forEach((select) => {
      select.addEventListener("change", () => {
        this.updateRule(select.dataset.ruleId, (rule) => {
          rule.conditions[getIndex(select)] = createDefaultCondition(
            toConditionType(select.value),
            this.getKeyOptions(),
            this.getObjects()
          );
        });
      });
    });

    this.root.querySelectorAll<HTMLSelectElement>("[data-condition-key]").forEach((select) => {
      select.addEventListener("change", () => {
        this.updateRule(select.dataset.ruleId, (rule) => {
          const condition = rule.conditions[getIndex(select)];

          if (condition?.type === "hasKey") {
            condition.keyId = select.value;
          }
        });
      });
    });

    this.root.querySelectorAll<HTMLInputElement>("[data-condition-amount]").forEach((input) => {
      input.addEventListener("change", () => {
        this.updateRule(input.dataset.ruleId, (rule) => {
          const condition = rule.conditions[getIndex(input)];

          if (condition?.type === "coinsAtLeast" || condition?.type === "enemiesDefeatedAtLeast") {
            condition.amount = Math.max(0, Math.floor(Number(input.value) || 0));
          } else if (condition?.type === "healthBelow") {
            condition.amount = Math.max(1, Math.floor(Number(input.value) || 1));
          }
        });
      });
    });

    this.root.querySelectorAll<HTMLSelectElement>("[data-condition-door]").forEach((select) => {
      select.addEventListener("change", () => {
        this.updateRule(select.dataset.ruleId, (rule) => {
          const condition = rule.conditions[getIndex(select)];

          if (condition?.type === "doorIsOpen") {
            condition.doorId = select.value;
          }
        });
      });
    });

    this.root.querySelectorAll<HTMLSelectElement>("[data-condition-enemy]").forEach((select) => {
      select.addEventListener("change", () => {
        this.updateRule(select.dataset.ruleId, (rule) => {
          const condition = rule.conditions[getIndex(select)];

          if (condition?.type === "enemyDefeated") {
            condition.objectId = select.value;
          }
        });
      });
    });

    this.root.querySelectorAll<HTMLSelectElement>("[data-condition-weapon]").forEach((select) => {
      select.addEventListener("change", () => {
        this.updateRule(select.dataset.ruleId, (rule) => {
          const condition = rule.conditions[getIndex(select)];

          if (condition?.type === "hasWeapon") {
            condition.weaponId = select.value;
          }
        });
      });
    });
  }

  private bindActionEvents(): void {
    this.root.querySelectorAll<HTMLButtonElement>("[data-add-action]").forEach((button) => {
      button.addEventListener("click", () => {
        this.updateRule(button.dataset.ruleId, (rule) => {
          rule.actions.push(createDefaultAction("showMessage", this.getObjects()));
        });
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>("[data-remove-action]").forEach((button) => {
      button.addEventListener("click", () => {
        this.updateRule(button.dataset.ruleId, (rule) => {
          rule.actions.splice(getIndex(button), 1);
        });
      });
    });

    this.root.querySelectorAll<HTMLSelectElement>("[data-action-type]").forEach((select) => {
      select.addEventListener("change", () => {
        this.updateRule(select.dataset.ruleId, (rule) => {
          rule.actions[getIndex(select)] = createDefaultAction(
            toActionType(select.value),
            this.getObjects()
          );
        });
      });
    });

    this.root.querySelectorAll<HTMLInputElement>("[data-action-message]").forEach((input) => {
      input.addEventListener("change", () => {
        this.updateRule(input.dataset.ruleId, (rule) => {
          const action = rule.actions[getIndex(input)];

          if (action?.type === "showMessage") {
            action.message = input.value;
          } else if (action?.type === "showDialogue") {
            action.message = input.value;
          }
        });
      });
    });

    this.root.querySelectorAll<HTMLSelectElement>("[data-action-door]").forEach((select) => {
      select.addEventListener("change", () => {
        this.updateRule(select.dataset.ruleId, (rule) => {
          const action = rule.actions[getIndex(select)];

          if (action?.type === "openDoor" || action?.type === "closeDoor") {
            action.doorId = select.value;
          }
        });
      });
    });

    this.root.querySelectorAll<HTMLSelectElement>("[data-action-target]").forEach((select) => {
      select.addEventListener("change", () => {
        this.updateRule(select.dataset.ruleId, (rule) => {
          const action = rule.actions[getIndex(select)];

          if (action?.type === "teleportPlayer") {
            action.targetObjectId = select.value;
          }
        });
      });
    });

    this.root.querySelectorAll<HTMLInputElement>("[data-action-amount]").forEach((input) => {
      input.addEventListener("change", () => {
        this.updateRule(input.dataset.ruleId, (rule) => {
          const action = rule.actions[getIndex(input)];

          if (action?.type === "giveCoins" || action?.type === "addScore") {
            action.amount = Math.floor(Number(input.value) || 0);
          } else if (action?.type === "addTeamScore") {
            action.amount = Math.floor(Number(input.value) || 0);
          } else if (action?.type === "healPlayer" || action?.type === "damagePlayer") {
            action.amount = Math.max(0, Math.floor(Number(input.value) || 0));
          }
        });
      });
    });

    this.root.querySelectorAll<HTMLSelectElement>("[data-action-object]").forEach((select) => {
      select.addEventListener("change", () => {
        this.updateRule(select.dataset.ruleId, (rule) => {
          const action = rule.actions[getIndex(select)];

          if (
            action?.type === "setCheckpoint" ||
            action?.type === "enableObject" ||
            action?.type === "disableObject"
          ) {
            action.objectId = select.value;
          }
        });
      });
    });

    this.root.querySelectorAll<HTMLSelectElement>("[data-action-enemy]").forEach((select) => {
      select.addEventListener("change", () => {
        this.updateRule(select.dataset.ruleId, (rule) => {
          const action = rule.actions[getIndex(select)];

          if (action?.type === "spawnEnemy") {
            action.objectId = select.value;
          }
        });
      });
    });

    this.root.querySelectorAll<HTMLSelectElement>("[data-action-weapon]").forEach((select) => {
      select.addEventListener("change", () => {
        this.updateRule(select.dataset.ruleId, (rule) => {
          const action = rule.actions[getIndex(select)];

          if (action?.type === "giveWeapon") {
            action.weaponId = select.value;
          }
        });
      });
    });

    this.root.querySelectorAll<HTMLSelectElement>("[data-action-objective]").forEach((select) => {
      select.addEventListener("change", () => {
        this.updateRule(select.dataset.ruleId, (rule) => {
          const action = rule.actions[getIndex(select)];

          if (action?.type === "completeObjective") {
            action.objectiveId = select.value;
          }
        });
      });
    });

    this.root
      .querySelectorAll<HTMLSelectElement>("[data-action-dialogue-object]")
      .forEach((select) => {
        select.addEventListener("change", () => {
          this.updateRule(select.dataset.ruleId, (rule) => {
            const action = rule.actions[getIndex(select)];

            if (action?.type === "showDialogue") {
              action.objectId = select.value;
            }
          });
        });
      });

    this.root.querySelectorAll<HTMLSelectElement>("[data-action-team]").forEach((select) => {
      select.addEventListener("change", () => {
        this.updateRule(select.dataset.ruleId, (rule) => {
          const action = rule.actions[getIndex(select)];

          if (action?.type === "addTeamScore" || action?.type === "setTeam") {
            action.teamId = select.value;
          }
        });
      });
    });

    this.root.querySelectorAll<HTMLSelectElement>("[data-action-result]").forEach((select) => {
      select.addEventListener("change", () => {
        this.updateRule(select.dataset.ruleId, (rule) => {
          const action = rule.actions[getIndex(select)];

          if (action?.type === "endRound") {
            action.result = toRoundResult(select.value);
          }
        });
      });
    });
  }

  private moveRule(ruleId: string | undefined, direction: -1 | 1): void {
    if (!ruleId) {
      return;
    }

    this.updateRules((rules) => {
      const index = rules.findIndex((rule) => rule.id === ruleId);
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= rules.length) {
        return;
      }

      const [rule] = rules.splice(index, 1);
      rules.splice(nextIndex, 0, rule);
    });
  }

  private updateRule(ruleId: string | undefined, mutate: (rule: LogicRule) => void): void {
    if (!ruleId) {
      return;
    }

    this.updateRules((rules) => {
      const rule = rules.find((candidate) => candidate.id === ruleId);

      if (rule) {
        mutate(rule);
      }
    });
  }

  private updateRules(mutate: (rules: LogicRule[]) => void): void {
    if (!this.map) {
      return;
    }

    const rules = this.getRules();
    mutate(rules);
    this.map.logic = rules;
    this.actions.onChange(structuredClone(rules));
    this.render();
  }

  private validateRule(rule: LogicRule): string[] {
    const warnings: string[] = [];

    if (rule.name.trim().length === 0) {
      warnings.push("Regra sem nome.");
    }

    if (!rule.enabled) {
      warnings.push("Regra desativada.");
    }

    warnings.push(...this.validateTrigger(rule.trigger));
    rule.conditions.forEach((condition) => warnings.push(...this.validateCondition(condition)));
    rule.actions.forEach((action) => warnings.push(...this.validateAction(action)));
    return warnings;
  }

  private validateTrigger(trigger: LogicTrigger): string[] {
    if (!isKnownTriggerType(trigger.type)) {
      return [`Regra sem trigger valido: ${String(trigger.type)}`];
    }

    if (
      trigger.type === "onPlayerEnterObject" ||
      trigger.type === "onButtonActivated" ||
      trigger.type === "onCoinCollected"
    ) {
      if (!this.hasObject(trigger.objectId)) {
        return [
          `Trigger ${trigger.type} aponta para objeto inexistente: ${trigger.objectId || "(vazio)"}`,
        ];
      }
    }

    if (trigger.type === "onKeyCollected" && !this.hasKey(trigger.keyId)) {
      return [
        `Trigger onKeyCollected aponta para chave inexistente: ${trigger.keyId || "(vazio)"}`,
      ];
    }

    if (trigger.type === "onEnemyDefeated" && !this.hasEnemy(trigger.objectId)) {
      return [
        `Trigger onEnemyDefeated aponta para inimigo inexistente: ${trigger.objectId || "(vazio)"}`,
      ];
    }

    if (trigger.type === "onNpcInteracted" && !this.hasNpc(trigger.objectId)) {
      return [
        `Trigger onNpcInteracted aponta para NPC inexistente: ${trigger.objectId || "(vazio)"}`,
      ];
    }

    if (trigger.type === "onObjectiveCompleted" && !this.hasObjective(trigger.objectiveId)) {
      return [
        `Trigger onObjectiveCompleted aponta para objetivo inexistente: ${trigger.objectiveId || "(vazio)"}`,
      ];
    }

    if (trigger.type === "onItemCollected" && !isValidItemType(trigger.itemType)) {
      return [`Trigger onItemCollected usa item invalido: ${trigger.itemType || "(vazio)"}`];
    }

    if (
      trigger.type === "onScoreReached" &&
      (!Number.isFinite(trigger.amount) || trigger.amount < 0)
    ) {
      return ["Trigger onScoreReached precisa de pontuacao valida."];
    }

    if (trigger.type === "onTeamScoreReached") {
      if (!this.hasTeam(trigger.teamId)) {
        return [
          `Trigger onTeamScoreReached aponta time inexistente: ${trigger.teamId || "(vazio)"}`,
        ];
      }

      if (!Number.isFinite(trigger.amount) || trigger.amount < 0) {
        return ["Trigger onTeamScoreReached precisa de pontuacao valida."];
      }
    }

    if (trigger.type === "onCapturePointCaptured" && !this.hasCapturePoint(trigger.pointId)) {
      return [
        `Trigger onCapturePointCaptured aponta ponto inexistente: ${trigger.pointId || "(vazio)"}`,
      ];
    }

    return [];
  }

  private validateCondition(condition: LogicCondition): string[] {
    if (condition.type === "hasKey" && !this.hasKey(condition.keyId)) {
      return [`Condicao hasKey aponta para chave inexistente: ${condition.keyId || "(vazio)"}`];
    }

    if (condition.type === "doorIsOpen" && !this.hasDoor(condition.doorId)) {
      return [
        `Condicao doorIsOpen aponta para porta inexistente: ${condition.doorId || "(vazio)"}`,
      ];
    }

    if (condition.type === "enemyDefeated" && !this.hasEnemy(condition.objectId)) {
      return [
        `Condicao enemyDefeated aponta para inimigo inexistente: ${condition.objectId || "(vazio)"}`,
      ];
    }

    if (condition.type === "hasWeapon" && !isValidWeaponId(condition.weaponId)) {
      return [`Condicao hasWeapon usa arma invalida: ${condition.weaponId || "(vazio)"}`];
    }

    return [];
  }

  private validateAction(action: LogicAction): string[] {
    if (
      (action.type === "openDoor" || action.type === "closeDoor") &&
      !this.hasDoor(action.doorId)
    ) {
      return [
        `Acao ${action.type} aponta para uma porta inexistente: ${action.doorId || "(vazio)"}`,
      ];
    }

    if (action.type === "teleportPlayer" && !this.hasObject(action.targetObjectId)) {
      return [
        `Acao teleportPlayer aponta para objeto inexistente: ${action.targetObjectId || "(vazio)"}`,
      ];
    }

    if (action.type === "setCheckpoint" && !this.hasCheckpoint(action.objectId)) {
      return [
        `Acao setCheckpoint aponta para checkpoint inexistente: ${action.objectId || "(vazio)"}`,
      ];
    }

    if (
      (action.type === "enableObject" || action.type === "disableObject") &&
      !this.hasObject(action.objectId)
    ) {
      return [
        `Acao ${action.type} aponta para objeto inexistente: ${action.objectId || "(vazio)"}`,
      ];
    }

    if (action.type === "spawnEnemy" && !this.hasEnemy(action.objectId)) {
      return [
        `Acao spawnEnemy aponta para objeto que nao e inimigo: ${action.objectId || "(vazio)"}`,
      ];
    }

    if (action.type === "giveWeapon" && !isValidWeaponId(action.weaponId)) {
      return [`Acao giveWeapon usa arma invalida: ${action.weaponId || "(vazio)"}`];
    }

    if (action.type === "completeObjective" && !this.hasObjective(action.objectiveId)) {
      return [
        `Acao completeObjective aponta para objetivo inexistente: ${action.objectiveId || "(vazio)"}`,
      ];
    }

    if (action.type === "showDialogue" && !this.hasNpc(action.objectId)) {
      return [`Acao showDialogue aponta para NPC inexistente: ${action.objectId || "(vazio)"}`];
    }

    if (
      (action.type === "addScore" || action.type === "addTeamScore") &&
      !Number.isFinite(action.amount)
    ) {
      return [`Acao ${action.type} precisa de quantidade valida.`];
    }

    if (
      (action.type === "addTeamScore" || action.type === "setTeam") &&
      !this.hasTeam(action.teamId)
    ) {
      return [`Acao ${action.type} aponta time inexistente: ${action.teamId || "(vazio)"}`];
    }

    return [];
  }

  private getFilteredRules(rules: LogicRule[]): LogicRule[] {
    const query = this.query.trim().toLowerCase();

    if (!query) {
      return rules;
    }

    return rules.filter((rule) => {
      const haystack = [
        rule.name,
        getTriggerLabel(rule.trigger),
        ...rule.actions.map((action) => action.type),
        ...rule.conditions.map((condition) => condition.type),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }

  private getRules(): LogicRule[] {
    return structuredClone(this.map?.logic ?? []).filter(isLogicRule);
  }

  private getObjects(): MapObject[] {
    return structuredClone(this.map?.objects ?? []);
  }

  private getDoorOptions(): Array<{ id: string; label: string }> {
    return this.getObjects()
      .filter((object) => object.type === "door")
      .map((door) => ({ id: getDoorId(door), label: door.name ?? door.id }));
  }

  private getKeyOptions(): Array<{ id: string; label: string }> {
    return this.getObjects()
      .filter((object) => object.type === "key")
      .map((key) => {
        const keyId = typeof key.properties?.keyId === "string" ? key.properties.keyId : key.id;
        const label = typeof key.properties?.label === "string" ? key.properties.label : keyId;
        return { id: keyId, label };
      });
  }

  private getEnemyOptions(): Array<{ id: string; label: string }> {
    return this.getObjects()
      .filter((object) => object.type === "enemy")
      .map((enemy) => ({ id: enemy.id, label: enemy.name ?? enemy.id }));
  }

  private getNpcOptions(): Array<{ id: string; label: string }> {
    return this.getObjects()
      .filter((object) => object.type === "npc")
      .map((npc) => ({ id: npc.id, label: String(npc.properties?.npcName ?? npc.name ?? npc.id) }));
  }

  private getObjectiveOptions(): Array<{ id: string; label: string }> {
    return structuredClone(this.map?.objectives ?? [])
      .filter(
        (objective) => typeof objective.id === "string" && typeof objective.title === "string"
      )
      .map((objective) => ({ id: objective.id, label: objective.title }));
  }

  private getTeamOptions(): Array<{ id: string; label: string }> {
    const mapTeams = structuredClone(this.map?.teams ?? [])
      .filter((team) => typeof team.id === "string" && typeof team.name === "string")
      .map((team) => ({ id: team.id, label: team.name }));
    const spawnTeams = this.getObjects()
      .filter(
        (object) => object.type === "teamSpawn" && typeof object.properties?.teamId === "string"
      )
      .map((object) => ({
        id: String(object.properties?.teamId),
        label: object.name ?? String(object.properties?.teamId),
      }));
    const teams = new Map<string, { id: string; label: string }>();

    for (const team of [...mapTeams, ...spawnTeams]) {
      if (team.id.length > 0) {
        teams.set(team.id, team);
      }
    }

    return [...teams.values()];
  }

  private getCapturePointOptions(): Array<{ id: string; label: string }> {
    return this.getObjects()
      .filter((object) => object.type === "capturePoint")
      .map((point) => ({
        id:
          typeof point.properties?.pointId === "string" && point.properties.pointId.length > 0
            ? point.properties.pointId
            : point.id,
        label: point.name ?? point.id,
      }));
  }

  private hasObject(objectId: string): boolean {
    return objectId.length > 0 && this.getObjects().some((object) => object.id === objectId);
  }

  private hasCheckpoint(objectId: string): boolean {
    return (
      objectId.length > 0 &&
      this.getObjects().some((object) => object.id === objectId && object.type === "checkpoint")
    );
  }

  private hasDoor(doorId: string): boolean {
    return doorId.length > 0 && this.getDoorOptions().some((door) => door.id === doorId);
  }

  private hasKey(keyId: string): boolean {
    return keyId.length > 0 && this.getKeyOptions().some((key) => key.id === keyId);
  }

  private hasEnemy(objectId: string): boolean {
    return (
      objectId.length > 0 &&
      this.getObjects().some((object) => object.id === objectId && object.type === "enemy")
    );
  }

  private hasNpc(objectId: string): boolean {
    return (
      objectId.length > 0 &&
      this.getObjects().some((object) => object.id === objectId && object.type === "npc")
    );
  }

  private hasObjective(objectiveId: string): boolean {
    return (
      objectiveId.length > 0 &&
      this.getObjectiveOptions().some((objective) => objective.id === objectiveId)
    );
  }

  private hasTeam(teamId: string): boolean {
    return teamId.length > 0 && this.getTeamOptions().some((team) => team.id === teamId);
  }

  private hasCapturePoint(pointId: string): boolean {
    return (
      pointId.length > 0 && this.getCapturePointOptions().some((point) => point.id === pointId)
    );
  }
}

const TRIGGER_OPTIONS: Array<{ type: TriggerType; label: string }> = [
  { type: "onMapStart", label: "Ao iniciar mapa" },
  { type: "onPlayerEnterObject", label: "Jogador entra no objeto" },
  { type: "onButtonActivated", label: "Botao ativado" },
  { type: "onCoinCollected", label: "Moeda coletada" },
  { type: "onKeyCollected", label: "Chave coletada" },
  { type: "onEnemyDefeated", label: "Inimigo derrotado" },
  { type: "onAnyEnemyDefeated", label: "Qualquer inimigo derrotado" },
  { type: "onAllEnemiesDefeated", label: "Todos inimigos derrotados" },
  { type: "onPlayerDamaged", label: "Player recebeu dano" },
  { type: "onItemCollected", label: "Item coletado" },
  { type: "onNpcInteracted", label: "NPC interagido" },
  { type: "onObjectiveCompleted", label: "Objetivo concluido" },
  { type: "onScoreReached", label: "Pontuacao atingida" },
  { type: "onTeamScoreReached", label: "Pontuacao do time atingida" },
  { type: "onCapturePointCaptured", label: "Capture point capturado" },
  { type: "onGameModeWon", label: "Modo vencido" },
];

const CONDITION_OPTIONS: Array<{ type: ConditionType; label: string }> = [
  { type: "once", label: "Uma vez" },
  { type: "hasKey", label: "Tem chave" },
  { type: "coinsAtLeast", label: "Moedas pelo menos" },
  { type: "doorIsOpen", label: "Porta aberta" },
  { type: "enemyDefeated", label: "Inimigo derrotado" },
  { type: "enemiesDefeatedAtLeast", label: "Inimigos derrotados pelo menos" },
  { type: "hasWeapon", label: "Tem arma" },
  { type: "healthBelow", label: "Vida abaixo" },
];

const ACTION_OPTIONS: Array<{ type: ActionType; label: string }> = [
  { type: "showMessage", label: "Mostrar mensagem" },
  { type: "openDoor", label: "Abrir porta" },
  { type: "closeDoor", label: "Fechar porta" },
  { type: "teleportPlayer", label: "Teleportar player" },
  { type: "giveCoins", label: "Dar moedas" },
  { type: "setCheckpoint", label: "Definir checkpoint" },
  { type: "finishMap", label: "Finalizar mapa" },
  { type: "enableObject", label: "Habilitar objeto" },
  { type: "disableObject", label: "Desabilitar objeto" },
  { type: "spawnEnemy", label: "Reativar inimigo" },
  { type: "healPlayer", label: "Curar player" },
  { type: "damagePlayer", label: "Dar dano no player" },
  { type: "giveWeapon", label: "Dar arma" },
  { type: "completeObjective", label: "Completar objetivo" },
  { type: "showDialogue", label: "Mostrar fala de NPC" },
  { type: "addScore", label: "Adicionar pontos" },
  { type: "addTeamScore", label: "Adicionar pontos ao time" },
  { type: "setTeam", label: "Definir time" },
  { type: "endRound", label: "Encerrar rodada" },
];

const ITEM_TYPE_OPTIONS = [
  { id: "health", label: "Cura" },
  { id: "coin", label: "Moeda" },
  { id: "weapon_basic", label: "Arma basica" },
] as const;

const WEAPON_OPTIONS = [{ id: "basic_sword", label: "Basica" }] as const;

const PRESET_OPTIONS: Array<{ id: LogicPresetId; label: string }> = [
  { id: "messageOnEnter", label: "Mostrar mensagem ao entrar em zona" },
  { id: "buttonOpensDoor", label: "Abrir porta ao apertar botao" },
  { id: "keyOpensDoor", label: "Abrir porta ao coletar chave" },
  { id: "finishOnEnter", label: "Finalizar mapa ao entrar em objeto" },
  { id: "teleportOnEnter", label: "Teleportar player ao entrar em zona" },
  { id: "giveCoins", label: "Dar moedas ao coletar/entrar" },
];

function createDefaultRule(
  index: number,
  objects: MapObject[],
  keys: Array<{ id: string; label: string }>
): LogicRule {
  return {
    id: createId("logic"),
    name: `Regra ${index}`,
    enabled: true,
    trigger: createDefaultTrigger("onMapStart", objects, keys),
    conditions: [],
    actions: [{ type: "showMessage", message: "Bem-vindo!" }],
  };
}

function createPresetRule(
  presetId: LogicPresetId,
  index: number,
  objects: MapObject[],
  keys: Array<{ id: string; label: string }>
): LogicRule {
  const doorId = getPreferredDoorId(objects);
  const zoneId =
    getPreferredObjectId(objects, "messageZone") || getPreferredObjectId(objects, "cube");
  const buttonId = getPreferredObjectId(objects, "button");
  const keyId = keys[0]?.id ?? "";
  const coinId = getPreferredObjectId(objects, "coin");

  if (presetId === "buttonOpensDoor") {
    return {
      id: createId("logic"),
      name: `Botao abre porta ${index}`,
      enabled: true,
      trigger: { type: "onButtonActivated", objectId: buttonId },
      conditions: [],
      actions: [{ type: "openDoor", doorId }],
    };
  }

  if (presetId === "keyOpensDoor") {
    return {
      id: createId("logic"),
      name: `Chave abre porta ${index}`,
      enabled: true,
      trigger: { type: "onKeyCollected", keyId },
      conditions: [],
      actions: [
        { type: "showMessage", message: "Porta liberada pela chave." },
        { type: "openDoor", doorId },
      ],
    };
  }

  if (presetId === "finishOnEnter") {
    return {
      id: createId("logic"),
      name: `Final ao entrar ${index}`,
      enabled: true,
      trigger: {
        type: "onPlayerEnterObject",
        objectId: getPreferredObjectId(objects, "finish") || zoneId,
      },
      conditions: [{ type: "once" }],
      actions: [{ type: "finishMap" }],
    };
  }

  if (presetId === "teleportOnEnter") {
    return {
      id: createId("logic"),
      name: `Teleporte por zona ${index}`,
      enabled: true,
      trigger: { type: "onPlayerEnterObject", objectId: zoneId },
      conditions: [],
      actions: [{ type: "teleportPlayer", targetObjectId: getPreferredObjectId(objects, "spawn") }],
    };
  }

  if (presetId === "giveCoins") {
    return {
      id: createId("logic"),
      name: `Dar moedas ${index}`,
      enabled: true,
      trigger: coinId
        ? { type: "onCoinCollected", objectId: coinId }
        : { type: "onPlayerEnterObject", objectId: zoneId },
      conditions: [{ type: "once" }],
      actions: [
        { type: "giveCoins", amount: 5 },
        { type: "showMessage", message: "Bonus de moedas!" },
      ],
    };
  }

  return {
    id: createId("logic"),
    name: `Mensagem em zona ${index}`,
    enabled: true,
    trigger: { type: "onPlayerEnterObject", objectId: zoneId },
    conditions: [{ type: "once" }],
    actions: [{ type: "showMessage", message: "Voce entrou na zona." }],
  };
}

function createDefaultTrigger(
  type: TriggerType,
  objects: MapObject[],
  keys: Array<{ id: string; label: string }>
): LogicTrigger {
  if (type === "onPlayerEnterObject") {
    return {
      type,
      objectId:
        getPreferredObjectId(objects, "messageZone") || getPreferredObjectId(objects, "cube"),
    };
  }

  if (type === "onButtonActivated") {
    return { type, objectId: getPreferredObjectId(objects, "button") };
  }

  if (type === "onCoinCollected") {
    return { type, objectId: getPreferredObjectId(objects, "coin") };
  }

  if (type === "onKeyCollected") {
    return { type, keyId: keys[0]?.id ?? "" };
  }

  if (type === "onEnemyDefeated") {
    return { type, objectId: getPreferredObjectId(objects, "enemy") };
  }

  if (type === "onItemCollected") {
    return { type, itemType: "weapon_basic" };
  }

  if (type === "onNpcInteracted") {
    return { type, objectId: getPreferredObjectId(objects, "npc") };
  }

  if (type === "onObjectiveCompleted") {
    return { type, objectiveId: "" };
  }

  if (type === "onScoreReached") {
    return { type, amount: 100 };
  }

  if (type === "onTeamScoreReached") {
    return { type, teamId: getPreferredTeamId(objects), amount: 100 };
  }

  if (type === "onCapturePointCaptured") {
    return { type, pointId: getPreferredCapturePointId(objects) };
  }

  if (
    type === "onAnyEnemyDefeated" ||
    type === "onAllEnemiesDefeated" ||
    type === "onPlayerDamaged" ||
    type === "onGameModeWon"
  ) {
    return { type };
  }

  return { type: "onMapStart" };
}

function createDefaultCondition(
  type: ConditionType,
  keys: Array<{ id: string; label: string }>,
  objects: MapObject[]
): LogicCondition {
  if (type === "hasKey") {
    return { type, keyId: keys[0]?.id ?? "" };
  }

  if (type === "coinsAtLeast") {
    return { type, amount: 1 };
  }

  if (type === "doorIsOpen") {
    return { type, doorId: getPreferredDoorId(objects) };
  }

  if (type === "enemyDefeated") {
    return { type, objectId: getPreferredObjectId(objects, "enemy") };
  }

  if (type === "enemiesDefeatedAtLeast") {
    return { type, amount: 1 };
  }

  if (type === "hasWeapon") {
    return { type, weaponId: "basic_sword" };
  }

  if (type === "healthBelow") {
    return { type, amount: 50 };
  }

  return { type: "once" };
}

function createDefaultAction(type: ActionType, objects: MapObject[]): LogicAction {
  if (type === "openDoor" || type === "closeDoor") {
    return { type, doorId: getPreferredDoorId(objects) };
  }

  if (type === "teleportPlayer") {
    return { type, targetObjectId: getPreferredObjectId(objects, "spawn") };
  }

  if (type === "giveCoins") {
    return { type, amount: 1 };
  }

  if (type === "setCheckpoint") {
    return { type, objectId: getPreferredObjectId(objects, "checkpoint") };
  }

  if (type === "enableObject" || type === "disableObject") {
    return { type, objectId: objects[0]?.id ?? "" };
  }

  if (type === "spawnEnemy") {
    return { type, objectId: getPreferredObjectId(objects, "enemy") };
  }

  if (type === "healPlayer") {
    return { type, amount: 25 };
  }

  if (type === "damagePlayer") {
    return { type, amount: 10 };
  }

  if (type === "giveWeapon") {
    return { type, weaponId: "basic_sword" };
  }

  if (type === "completeObjective") {
    return { type, objectiveId: "" };
  }

  if (type === "showDialogue") {
    return { type, objectId: getPreferredObjectId(objects, "npc"), message: "Nova fala do NPC." };
  }

  if (type === "addScore") {
    return { type, amount: 10 };
  }

  if (type === "addTeamScore") {
    return { type, teamId: getPreferredTeamId(objects), amount: 10 };
  }

  if (type === "setTeam") {
    return { type, teamId: getPreferredTeamId(objects) };
  }

  if (type === "endRound") {
    return { type, result: "win" };
  }

  if (type === "finishMap") {
    return { type };
  }

  return { type: "showMessage", message: "Mensagem" };
}

function duplicateRule(rule: LogicRule): LogicRule {
  return {
    ...structuredClone(rule),
    id: createId("logic"),
    name: getCopyName(rule.name),
  };
}

function getCopyName(name: string): string {
  const baseName = name.trim() || "Regra";
  return `${baseName} copia`;
}

function getPreferredObjectId(objects: MapObject[], preferredType: string): string {
  return objects.find((object) => object.type === preferredType)?.id ?? "";
}

function getPreferredTeamId(objects: MapObject[]): string {
  const spawn = objects.find((object) => object.type === "teamSpawn");
  const teamId = spawn?.properties?.teamId;
  return typeof teamId === "string" && teamId.length > 0 ? teamId : "red";
}

function getPreferredCapturePointId(objects: MapObject[]): string {
  const point = objects.find((object) => object.type === "capturePoint");
  const pointId = point?.properties?.pointId;
  return typeof pointId === "string" && pointId.length > 0 ? pointId : (point?.id ?? "");
}

function getPreferredDoorId(objects: MapObject[]): string {
  const door = objects.find((object) => object.type === "door");
  return door ? getDoorId(door) : "";
}

function getDoorId(object: MapObject): string {
  return typeof object.properties?.doorId === "string" && object.properties.doorId.length > 0
    ? object.properties.doorId
    : object.id;
}

function getObjectLabel(object: MapObject): string {
  return `${object.name ?? object.id} (${object.type})`;
}

function getTriggerLabel(trigger: LogicTrigger): string {
  const option = TRIGGER_OPTIONS.find((candidate) => candidate.type === trigger.type);
  return option?.label ?? trigger.type;
}

function toTriggerType(value: string): TriggerType {
  return TRIGGER_OPTIONS.some((option) => option.type === value)
    ? (value as TriggerType)
    : "onMapStart";
}

function toConditionType(value: string): ConditionType {
  return CONDITION_OPTIONS.some((option) => option.type === value)
    ? (value as ConditionType)
    : "once";
}

function toActionType(value: string): ActionType {
  return ACTION_OPTIONS.some((option) => option.type === value)
    ? (value as ActionType)
    : "showMessage";
}

function toRoundResult(value: string): "win" | "lose" | "draw" {
  return value === "lose" || value === "draw" ? value : "win";
}

function toPresetId(value: string): LogicPresetId {
  return PRESET_OPTIONS.some((preset) => preset.id === value)
    ? (value as LogicPresetId)
    : "messageOnEnter";
}

function isKnownTriggerType(value: string): value is TriggerType {
  return TRIGGER_OPTIONS.some((option) => option.type === value);
}

function isValidItemType(value: string): boolean {
  return ITEM_TYPE_OPTIONS.some((option) => option.id === value);
}

function isValidWeaponId(value: string): boolean {
  return WEAPON_OPTIONS.some((option) => option.id === value);
}

function getIndex(element: HTMLElement): number {
  return Math.max(0, Number(element.dataset.index) || 0);
}

function isLogicRule(value: unknown): value is LogicRule {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.enabled === "boolean" &&
    isRecord(value.trigger) &&
    typeof value.trigger.type === "string" &&
    Array.isArray(value.conditions) &&
    Array.isArray(value.actions)
  );
}

function createId(prefix: string): string {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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
