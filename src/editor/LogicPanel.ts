import { createIcons, icons } from "lucide";
import type { GameMap } from "../shared/types/MapSchema";
import type { MapObject } from "../shared/types/ObjectSchema";
import type { LogicAction, LogicCondition, LogicRule, LogicTrigger } from "../shared/types/ScriptSchema";

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
            ${PRESET_OPTIONS.map((preset) => `
              <option value="${preset.id}">${preset.label}</option>
            `).join("")}
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

      ${warningCount > 0 ? `
        <div class="logic-summary warning">${warningCount} aviso${warningCount === 1 ? "" : "s"} de configuracao</div>
      ` : `
        <div class="logic-summary ok">Nenhum aviso de logica</div>
      `}

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
              ${TRIGGER_OPTIONS.map((option) => `
                <option value="${option.type}" ${rule.trigger.type === option.type ? "selected" : ""}>${option.label}</option>
              `).join("")}
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
      return this.renderObjectSelect("Objeto", rule.trigger.objectId, "data-trigger-object", rule.id);
    }

    if (rule.trigger.type === "onKeyCollected") {
      return this.renderKeySelect("Chave", rule.trigger.keyId, "data-trigger-key", rule.id);
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
              ${CONDITION_OPTIONS.map((option) => `
                <option value="${option.type}" ${condition.type === option.type ? "selected" : ""}>${option.label}</option>
              `).join("")}
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
      return this.renderDoorSelect("Porta", condition.doorId, "data-condition-door", rule.id, index);
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
              ${ACTION_OPTIONS.map((option) => `
                <option value="${option.type}" ${action.type === option.type ? "selected" : ""}>${option.label}</option>
              `).join("")}
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
      return this.renderObjectSelect("Destino", action.targetObjectId, "data-action-target", rule.id, index);
    }

    if (action.type === "giveCoins") {
      return `
        <label class="field">
          <span>Quantidade</span>
          <input type="number" step="1" value="${action.amount}" data-action-amount data-rule-id="${escapeAttribute(rule.id)}" data-index="${index}" />
        </label>
      `;
    }

    if (action.type === "setCheckpoint" || action.type === "enableObject" || action.type === "disableObject") {
      return this.renderObjectSelect("Objeto", action.objectId, "data-action-object", rule.id, index);
    }

    return `<div class="logic-note">Finaliza o mapa imediatamente.</div>`;
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
          ${objects.map((object) => `
            <option value="${escapeAttribute(object.id)}" ${object.id === value ? "selected" : ""}>
              ${escapeHtml(getObjectLabel(object))}
            </option>
          `).join("")}
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
          ${doors.map((door) => `
            <option value="${escapeAttribute(door.id)}" ${door.id === value ? "selected" : ""}>
              ${escapeHtml(`${door.label} (${door.id})`)}
            </option>
          `).join("")}
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
          ${keys.map((key) => `
            <option value="${escapeAttribute(key.id)}" ${key.id === value ? "selected" : ""}>
              ${escapeHtml(`${key.label} (${key.id})`)}
            </option>
          `).join("")}
        </select>
      </label>
    `;
  }

  private bindEvents(): void {
    this.root.querySelector<HTMLInputElement>("[data-logic-search]")?.addEventListener("input", (event) => {
      this.query = (event.currentTarget as HTMLInputElement).value;
      this.render();
    });

    this.root.querySelector<HTMLInputElement>("[data-logic-debug]")?.addEventListener("change", (event) => {
      const logicDebug = (event.currentTarget as HTMLInputElement).checked;

      if (this.map) {
        this.map.logicDebug = logicDebug;
      }

      this.actions.onDebugChange(logicDebug);
      this.render();
    });

    this.root.querySelector<HTMLButtonElement>("[data-add-logic-rule]")?.addEventListener("click", () => {
      this.updateRules((rules) => {
        rules.push(createDefaultRule(rules.length + 1, this.getObjects(), this.getKeyOptions()));
      });
    });

    this.root.querySelector<HTMLButtonElement>("[data-add-preset]")?.addEventListener("click", () => {
      const select = this.root.querySelector<HTMLSelectElement>("[data-logic-preset]");
      const presetId = toPresetId(select?.value ?? "messageOnEnter");

      this.updateRules((rules) => {
        rules.push(createPresetRule(presetId, rules.length + 1, this.getObjects(), this.getKeyOptions()));
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
          rule.trigger = createDefaultTrigger(toTriggerType(select.value), this.getObjects(), this.getKeyOptions());
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

    this.bindConditionEvents();
    this.bindActionEvents();
  }

  private bindConditionEvents(): void {
    this.root.querySelectorAll<HTMLButtonElement>("[data-add-condition]").forEach((button) => {
      button.addEventListener("click", () => {
        this.updateRule(button.dataset.ruleId, (rule) => {
          rule.conditions.push(createDefaultCondition("once", this.getKeyOptions(), this.getObjects()));
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

          if (condition?.type === "coinsAtLeast") {
            condition.amount = Math.max(0, Math.floor(Number(input.value) || 0));
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
          rule.actions[getIndex(select)] = createDefaultAction(toActionType(select.value), this.getObjects());
        });
      });
    });

    this.root.querySelectorAll<HTMLInputElement>("[data-action-message]").forEach((input) => {
      input.addEventListener("change", () => {
        this.updateRule(input.dataset.ruleId, (rule) => {
          const action = rule.actions[getIndex(input)];

          if (action?.type === "showMessage") {
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

          if (action?.type === "giveCoins") {
            action.amount = Math.floor(Number(input.value) || 0);
          }
        });
      });
    });

    this.root.querySelectorAll<HTMLSelectElement>("[data-action-object]").forEach((select) => {
      select.addEventListener("change", () => {
        this.updateRule(select.dataset.ruleId, (rule) => {
          const action = rule.actions[getIndex(select)];

          if (action?.type === "setCheckpoint" || action?.type === "enableObject" || action?.type === "disableObject") {
            action.objectId = select.value;
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
        return [`Trigger ${trigger.type} aponta para objeto inexistente: ${trigger.objectId || "(vazio)"}`];
      }
    }

    if (trigger.type === "onKeyCollected" && !this.hasKey(trigger.keyId)) {
      return [`Trigger onKeyCollected aponta para chave inexistente: ${trigger.keyId || "(vazio)"}`];
    }

    return [];
  }

  private validateCondition(condition: LogicCondition): string[] {
    if (condition.type === "hasKey" && !this.hasKey(condition.keyId)) {
      return [`Condicao hasKey aponta para chave inexistente: ${condition.keyId || "(vazio)"}`];
    }

    if (condition.type === "doorIsOpen" && !this.hasDoor(condition.doorId)) {
      return [`Condicao doorIsOpen aponta para porta inexistente: ${condition.doorId || "(vazio)"}`];
    }

    return [];
  }

  private validateAction(action: LogicAction): string[] {
    if ((action.type === "openDoor" || action.type === "closeDoor") && !this.hasDoor(action.doorId)) {
      return [`Acao ${action.type} aponta para uma porta inexistente: ${action.doorId || "(vazio)"}`];
    }

    if (action.type === "teleportPlayer" && !this.hasObject(action.targetObjectId)) {
      return [`Acao teleportPlayer aponta para objeto inexistente: ${action.targetObjectId || "(vazio)"}`];
    }

    if (action.type === "setCheckpoint" && !this.hasCheckpoint(action.objectId)) {
      return [`Acao setCheckpoint aponta para checkpoint inexistente: ${action.objectId || "(vazio)"}`];
    }

    if ((action.type === "enableObject" || action.type === "disableObject") && !this.hasObject(action.objectId)) {
      return [`Acao ${action.type} aponta para objeto inexistente: ${action.objectId || "(vazio)"}`];
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
        ...rule.conditions.map((condition) => condition.type)
      ].join(" ").toLowerCase();

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

  private hasObject(objectId: string): boolean {
    return objectId.length > 0 && this.getObjects().some((object) => object.id === objectId);
  }

  private hasCheckpoint(objectId: string): boolean {
    return objectId.length > 0 && this.getObjects().some((object) => object.id === objectId && object.type === "checkpoint");
  }

  private hasDoor(doorId: string): boolean {
    return doorId.length > 0 && this.getDoorOptions().some((door) => door.id === doorId);
  }

  private hasKey(keyId: string): boolean {
    return keyId.length > 0 && this.getKeyOptions().some((key) => key.id === keyId);
  }
}

const TRIGGER_OPTIONS: Array<{ type: TriggerType; label: string }> = [
  { type: "onMapStart", label: "Ao iniciar mapa" },
  { type: "onPlayerEnterObject", label: "Jogador entra no objeto" },
  { type: "onButtonActivated", label: "Botao ativado" },
  { type: "onCoinCollected", label: "Moeda coletada" },
  { type: "onKeyCollected", label: "Chave coletada" }
];

const CONDITION_OPTIONS: Array<{ type: ConditionType; label: string }> = [
  { type: "once", label: "Uma vez" },
  { type: "hasKey", label: "Tem chave" },
  { type: "coinsAtLeast", label: "Moedas pelo menos" },
  { type: "doorIsOpen", label: "Porta aberta" }
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
  { type: "disableObject", label: "Desabilitar objeto" }
];

const PRESET_OPTIONS: Array<{ id: LogicPresetId; label: string }> = [
  { id: "messageOnEnter", label: "Mostrar mensagem ao entrar em zona" },
  { id: "buttonOpensDoor", label: "Abrir porta ao apertar botao" },
  { id: "keyOpensDoor", label: "Abrir porta ao coletar chave" },
  { id: "finishOnEnter", label: "Finalizar mapa ao entrar em objeto" },
  { id: "teleportOnEnter", label: "Teleportar player ao entrar em zona" },
  { id: "giveCoins", label: "Dar moedas ao coletar/entrar" }
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
    actions: [{ type: "showMessage", message: "Bem-vindo!" }]
  };
}

function createPresetRule(
  presetId: LogicPresetId,
  index: number,
  objects: MapObject[],
  keys: Array<{ id: string; label: string }>
): LogicRule {
  const doorId = getPreferredDoorId(objects);
  const zoneId = getPreferredObjectId(objects, "messageZone") || getPreferredObjectId(objects, "cube");
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
      actions: [{ type: "openDoor", doorId }]
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
        { type: "openDoor", doorId }
      ]
    };
  }

  if (presetId === "finishOnEnter") {
    return {
      id: createId("logic"),
      name: `Final ao entrar ${index}`,
      enabled: true,
      trigger: { type: "onPlayerEnterObject", objectId: getPreferredObjectId(objects, "finish") || zoneId },
      conditions: [{ type: "once" }],
      actions: [{ type: "finishMap" }]
    };
  }

  if (presetId === "teleportOnEnter") {
    return {
      id: createId("logic"),
      name: `Teleporte por zona ${index}`,
      enabled: true,
      trigger: { type: "onPlayerEnterObject", objectId: zoneId },
      conditions: [],
      actions: [{ type: "teleportPlayer", targetObjectId: getPreferredObjectId(objects, "spawn") }]
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
        { type: "showMessage", message: "Bonus de moedas!" }
      ]
    };
  }

  return {
    id: createId("logic"),
    name: `Mensagem em zona ${index}`,
    enabled: true,
    trigger: { type: "onPlayerEnterObject", objectId: zoneId },
    conditions: [{ type: "once" }],
    actions: [{ type: "showMessage", message: "Voce entrou na zona." }]
  };
}

function createDefaultTrigger(
  type: TriggerType,
  objects: MapObject[],
  keys: Array<{ id: string; label: string }>
): LogicTrigger {
  if (type === "onPlayerEnterObject") {
    return { type, objectId: getPreferredObjectId(objects, "messageZone") || getPreferredObjectId(objects, "cube") };
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

  if (type === "finishMap") {
    return { type };
  }

  return { type: "showMessage", message: "Mensagem" };
}

function duplicateRule(rule: LogicRule): LogicRule {
  return {
    ...structuredClone(rule),
    id: createId("logic"),
    name: getCopyName(rule.name)
  };
}

function getCopyName(name: string): string {
  const baseName = name.trim() || "Regra";
  return `${baseName} copia`;
}

function getPreferredObjectId(objects: MapObject[], preferredType: string): string {
  return objects.find((object) => object.type === preferredType)?.id ?? "";
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
    ? value as TriggerType
    : "onMapStart";
}

function toConditionType(value: string): ConditionType {
  return CONDITION_OPTIONS.some((option) => option.type === value)
    ? value as ConditionType
    : "once";
}

function toActionType(value: string): ActionType {
  return ACTION_OPTIONS.some((option) => option.type === value)
    ? value as ActionType
    : "showMessage";
}

function toPresetId(value: string): LogicPresetId {
  return PRESET_OPTIONS.some((preset) => preset.id === value)
    ? value as LogicPresetId
    : "messageOnEnter";
}

function isKnownTriggerType(value: string): value is TriggerType {
  return TRIGGER_OPTIONS.some((option) => option.type === value);
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
