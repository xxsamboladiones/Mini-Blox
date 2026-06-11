import { createIcons, icons } from "lucide";
import type {
  GameMap,
  GameMode,
  GameModeSettings,
  TeamDefinition,
  WinConditionType,
} from "../shared/types/MapSchema";

type GameModePanelActions = {
  onGameModeChange: (settings: GameModeSettings) => void;
  onTeamsChange: (teams: TeamDefinition[]) => void;
};

const MODE_OPTIONS: Array<{ mode: GameMode; label: string }> = [
  { mode: "freeplay", label: "Freeplay" },
  { mode: "obby", label: "Obby" },
  { mode: "coinCollect", label: "Coleta de moedas" },
  { mode: "combatArena", label: "Arena de combate" },
  { mode: "objectiveRun", label: "Corrida de objetivos" },
  { mode: "teamBattle", label: "Batalha local de times" },
  { mode: "capturePoint", label: "Capture Point" },
  { mode: "tycoon", label: "Tycoon" },
];

const WIN_OPTIONS: Array<{ type: WinConditionType; label: string }> = [
  { type: "none", label: "Sem vitoria automatica" },
  { type: "finish", label: "Chegar ao final" },
  { type: "collectCoins", label: "Coletar moedas" },
  { type: "defeatEnemies", label: "Derrotar inimigos" },
  { type: "completeObjectives", label: "Completar objetivos" },
  { type: "score", label: "Pontuacao" },
  { type: "capturePoint", label: "Capture Point" },
  { type: "completeTycoon", label: "Completar Tycoon" },
];

export class GameModePanel {
  private map: GameMap | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly actions: GameModePanelActions
  ) {}

  setMap(map: GameMap): void {
    this.map = structuredClone(map);
    this.render();
  }

  render(): void {
    const settings = resolveSettings(this.map);
    const teams = getTeams(this.map);
    const warnings = this.getWarnings(settings, teams);

    this.root.innerHTML = `
      <div class="panel-heading">
        <h2>Modo de Jogo</h2>
        <span class="type-pill">${settings.mode}</span>
      </div>

      <label class="field">
        <span>Modo</span>
        <select data-game-mode>
          ${MODE_OPTIONS.map(
            (option) => `
            <option value="${option.mode}" ${settings.mode === option.mode ? "selected" : ""}>${option.label}</option>
          `
          ).join("")}
        </select>
      </label>

      <label class="field">
        <span>Condicao de vitoria</span>
        <select data-win-condition>
          ${WIN_OPTIONS.map(
            (option) => `
            <option value="${option.type}" ${settings.winCondition?.type === option.type ? "selected" : ""}>${option.label}</option>
          `
          ).join("")}
        </select>
      </label>

      <div class="environment-grid">
        <label class="field">
          <span>Meta</span>
          <input data-win-target type="number" min="0" step="1" value="${settings.winCondition?.targetAmount ?? 0}" />
        </label>
        <label class="field checkbox-field game-mode-check">
          <input data-win-require-all type="checkbox" ${settings.winCondition?.requireAll ? "checked" : ""} />
          <span>Exigir tudo</span>
        </label>
      </div>

      <label class="field checkbox-field">
        <input data-round-enabled type="checkbox" ${settings.roundEnabled ? "checked" : ""} />
        <span>Rodada com tempo</span>
      </label>

      <div class="environment-grid">
        <label class="field">
          <span>Limite rodada (s)</span>
          <input data-round-time type="number" min="0" step="5" value="${settings.roundTimeLimit ?? 180}" />
        </label>
        <label class="field">
          <span>Respawn delay (s)</span>
          <input data-respawn-delay type="number" min="0" step="0.25" value="${settings.respawnDelay ?? 1}" />
        </label>
      </div>

      <label class="field checkbox-field">
        <input data-teams-enabled type="checkbox" ${settings.teamsEnabled ? "checked" : ""} />
        <span>Usar times locais</span>
      </label>

      <label class="field checkbox-field">
        <input data-mode-require-objectives type="checkbox" ${settings.requireObjectivesToFinish ? "checked" : ""} />
        <span>Exigir objetivos no final</span>
      </label>

      <fieldset class="game-mode-score-grid">
        <legend>Pontuacao</legend>
        ${this.renderScoreInput("coinScore", "Moeda", settings.scoring?.coinScore ?? 10)}
        ${this.renderScoreInput("enemyDefeatScore", "Inimigo", settings.scoring?.enemyDefeatScore ?? 100)}
        ${this.renderScoreInput("objectiveScore", "Objetivo", settings.scoring?.objectiveScore ?? 250)}
        ${this.renderScoreInput("deathPenalty", "Morte", settings.scoring?.deathPenalty ?? 25)}
      </fieldset>

      ${settings.mode === "tycoon" ? this.renderTycoonSettings(settings) : ""}

      <div class="logic-section-heading">
        <strong>Times</strong>
        <button class="property-action compact-action" type="button" data-add-team>
          <i data-lucide="plus"></i>
          <span>Adicionar</span>
        </button>
      </div>
      <div class="objective-list">
        ${teams.length === 0 ? `<div class="empty-row">Sem times</div>` : ""}
        ${teams.map((team, index) => this.renderTeam(team, index)).join("")}
      </div>

      ${
        warnings.length > 0
          ? `
        <ul class="logic-warnings game-mode-warnings">
          ${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}
        </ul>
      `
          : `
        <div class="logic-summary ok">Modo pronto para testar.</div>
      `
      }
    `;

    this.bindEvents();
    createIcons({ icons });
  }

  private renderScoreInput(
    property: keyof NonNullable<GameModeSettings["scoring"]>,
    label: string,
    value: number
  ): string {
    return `
      <label>
        <span>${label}</span>
        <input data-score="${property}" type="number" step="1" value="${value}" />
      </label>
    `;
  }

  private renderTycoonSettings(settings: GameModeSettings): string {
    const tycoon = settings.tycoonSettings ?? {};

    return `
      <fieldset class="game-mode-score-grid">
        <legend>Tycoon</legend>
        <label>
          <span>Dinheiro inicial</span>
          <input data-tycoon-setting="startingCash" type="number" min="0" step="1" value="${tycoon.startingCash ?? 0}" />
        </label>
        <label>
          <span>Escala de geradores</span>
          <input data-tycoon-setting="generatorTickRateScale" type="number" min="0.1" step="0.1" value="${tycoon.generatorTickRateScale ?? 1}" />
        </label>
        <label class="checkbox-field game-mode-check">
          <input data-tycoon-flag="sharedCash" type="checkbox" ${tycoon.sharedCash ? "checked" : ""} />
          <span>Dinheiro compartilhado</span>
        </label>
        <label class="checkbox-field game-mode-check">
          <input data-tycoon-flag="requireAllPurchasesToWin" type="checkbox" ${tycoon.requireAllPurchasesToWin !== false ? "checked" : ""} />
          <span>Comprar tudo para vencer</span>
        </label>
        <label class="checkbox-field game-mode-check">
          <input data-tycoon-flag="autoClaimInSolo" type="checkbox" ${tycoon.autoClaimInSolo !== false ? "checked" : ""} />
          <span>Auto claim no solo</span>
        </label>
        <label class="checkbox-field game-mode-check">
          <input data-tycoon-flag="allowStealing" type="checkbox" ${tycoon.allowStealing ? "checked" : ""} />
          <span>Permitir roubo</span>
        </label>
      </fieldset>
      <label class="field">
        <span>Compras para vencer</span>
        <input data-tycoon-win-purchases type="text" value="${escapeAttribute((tycoon.winPurchaseIds ?? []).join(", "))}" placeholder="purchase_1, upgrade_1" />
      </label>
    `;
  }

  private renderTeam(team: TeamDefinition, index: number): string {
    const spawn = team.spawnPoint ?? { x: 0, y: 1, z: 0 };

    return `
      <article class="objective-card game-mode-team-card">
        <div class="objective-card-title">
          <strong>${escapeHtml(team.name.trim() || "Time sem nome")}</strong>
          <button class="icon-action compact danger" type="button" data-remove-team data-index="${index}" title="Remover time" aria-label="Remover time">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
        <label class="field">
          <span>ID</span>
          <input data-team-id data-index="${index}" type="text" value="${escapeAttribute(team.id)}" />
        </label>
        <label class="field">
          <span>Nome</span>
          <input data-team-name data-index="${index}" type="text" value="${escapeAttribute(team.name)}" />
        </label>
        <label class="field">
          <span>Cor</span>
          <input data-team-color data-index="${index}" type="color" value="${escapeAttribute(team.color || "#ef4444")}" />
        </label>
        <fieldset class="vector-field">
          <legend>Spawn do time</legend>
          ${(["x", "y", "z"] as const)
            .map(
              (axis) => `
            <label>
              <span>${axis.toUpperCase()}</span>
              <input data-team-spawn data-axis="${axis}" data-index="${index}" type="number" step="0.1" value="${spawn[axis]}" />
            </label>
          `
            )
            .join("")}
        </fieldset>
      </article>
    `;
  }

  private bindEvents(): void {
    this.root
      .querySelector<HTMLSelectElement>("[data-game-mode]")
      ?.addEventListener("change", (event) => {
        const mode = toGameMode((event.currentTarget as HTMLSelectElement).value);
        this.updateSettings((settings) => {
          settings.mode = mode;
          settings.winCondition = {
            ...(settings.winCondition ?? { type: "none" }),
            type: getDefaultWinConditionForMode(mode, this.map),
          };
          settings.teamsEnabled =
            mode === "teamBattle" || mode === "capturePoint" ? true : settings.teamsEnabled;
          settings.tycoonSettings = {
            startingCash: 0,
            sharedCash: false,
            requireAllPurchasesToWin: true,
            winPurchaseIds: [],
            allowStealing: false,
            autoClaimInSolo: true,
            generatorTickRateScale: 1,
            ...(settings.tycoonSettings ?? {}),
          };
        });
      });

    this.root
      .querySelector<HTMLSelectElement>("[data-win-condition]")
      ?.addEventListener("change", (event) => {
        this.updateSettings((settings) => {
          settings.winCondition = {
            ...(settings.winCondition ?? { type: "none" }),
            type: toWinConditionType((event.currentTarget as HTMLSelectElement).value),
          };
        });
      });

    this.root
      .querySelector<HTMLInputElement>("[data-win-target]")
      ?.addEventListener("change", (event) => {
        this.updateSettings((settings) => {
          settings.winCondition = {
            ...(settings.winCondition ?? { type: "none" }),
            targetAmount: Math.max(
              0,
              Math.floor(Number((event.currentTarget as HTMLInputElement).value) || 0)
            ),
          };
        }, false);
      });

    this.root
      .querySelector<HTMLInputElement>("[data-win-require-all]")
      ?.addEventListener("change", (event) => {
        this.updateSettings((settings) => {
          settings.winCondition = {
            ...(settings.winCondition ?? { type: "none" }),
            requireAll: (event.currentTarget as HTMLInputElement).checked,
          };
        });
      });

    this.root
      .querySelector<HTMLInputElement>("[data-round-enabled]")
      ?.addEventListener("change", (event) => {
        this.updateSettings((settings) => {
          settings.roundEnabled = (event.currentTarget as HTMLInputElement).checked;
        });
      });

    this.root
      .querySelector<HTMLInputElement>("[data-round-time]")
      ?.addEventListener("change", (event) => {
        this.updateSettings((settings) => {
          settings.roundTimeLimit = Math.max(
            0,
            Number((event.currentTarget as HTMLInputElement).value) || 0
          );
        }, false);
      });

    this.root
      .querySelector<HTMLInputElement>("[data-respawn-delay]")
      ?.addEventListener("change", (event) => {
        this.updateSettings((settings) => {
          settings.respawnDelay = Math.max(
            0,
            Number((event.currentTarget as HTMLInputElement).value) || 0
          );
        }, false);
      });

    this.root
      .querySelector<HTMLInputElement>("[data-teams-enabled]")
      ?.addEventListener("change", (event) => {
        this.updateSettings((settings) => {
          settings.teamsEnabled = (event.currentTarget as HTMLInputElement).checked;
        });
      });

    this.root
      .querySelector<HTMLInputElement>("[data-mode-require-objectives]")
      ?.addEventListener("change", (event) => {
        this.updateSettings((settings) => {
          settings.requireObjectivesToFinish = (event.currentTarget as HTMLInputElement).checked;
        });
      });

    this.root.querySelectorAll<HTMLInputElement>("[data-score]").forEach((input) => {
      input.addEventListener("change", () => {
        const property = input.dataset.score as keyof NonNullable<GameModeSettings["scoring"]>;
        this.updateSettings((settings) => {
          settings.scoring = {
            ...(settings.scoring ?? {}),
            [property]: Math.floor(Number(input.value) || 0),
          };
        }, false);
      });
    });

    this.root.querySelectorAll<HTMLInputElement>("[data-tycoon-setting]").forEach((input) => {
      input.addEventListener("change", () => {
        const property = input.dataset.tycoonSetting as "startingCash" | "generatorTickRateScale";
        this.updateSettings((settings) => {
          settings.tycoonSettings = {
            ...(settings.tycoonSettings ?? {}),
            [property]:
              property === "startingCash"
                ? Math.max(0, Math.floor(Number(input.value) || 0))
                : Math.max(0.1, Number(input.value) || 1),
          };
        }, false);
      });
    });

    this.root.querySelectorAll<HTMLInputElement>("[data-tycoon-flag]").forEach((input) => {
      input.addEventListener("change", () => {
        const property = input.dataset.tycoonFlag as
          | "sharedCash"
          | "requireAllPurchasesToWin"
          | "allowStealing"
          | "autoClaimInSolo";
        this.updateSettings((settings) => {
          settings.tycoonSettings = {
            ...(settings.tycoonSettings ?? {}),
            [property]: input.checked,
          };
        });
      });
    });

    this.root
      .querySelector<HTMLInputElement>("[data-tycoon-win-purchases]")
      ?.addEventListener("change", (event) => {
        const values = (event.currentTarget as HTMLInputElement).value
          .split(",")
          .map((value) => value.trim())
          .filter((value) => value.length > 0);
        this.updateSettings((settings) => {
          settings.tycoonSettings = {
            ...(settings.tycoonSettings ?? {}),
            winPurchaseIds: values,
          };
        }, false);
      });

    this.root.querySelector<HTMLButtonElement>("[data-add-team]")?.addEventListener("click", () => {
      this.updateTeams((teams) => {
        teams.push(createDefaultTeam(teams.length));
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>("[data-remove-team]").forEach((button) => {
      button.addEventListener("click", () => {
        this.updateTeams((teams) => {
          teams.splice(getIndex(button), 1);
        });
      });
    });

    this.root.querySelectorAll<HTMLInputElement>("[data-team-id]").forEach((input) => {
      input.addEventListener("change", () =>
        this.updateTeam(getIndex(input), { id: sanitizeId(input.value) || "team" }, false)
      );
    });

    this.root.querySelectorAll<HTMLInputElement>("[data-team-name]").forEach((input) => {
      input.addEventListener("change", () =>
        this.updateTeam(getIndex(input), { name: input.value.trim() || "Time" }, false)
      );
    });

    this.root.querySelectorAll<HTMLInputElement>("[data-team-color]").forEach((input) => {
      input.addEventListener("change", () =>
        this.updateTeam(getIndex(input), { color: input.value }, false)
      );
    });

    this.root.querySelectorAll<HTMLInputElement>("[data-team-spawn]").forEach((input) => {
      input.addEventListener("change", () => {
        const axis = input.dataset.axis as "x" | "y" | "z";
        this.updateTeams((teams) => {
          const team = teams[getIndex(input)];

          if (!team) {
            return;
          }

          team.spawnPoint = {
            ...(team.spawnPoint ?? { x: 0, y: 1, z: 0 }),
            [axis]: Number(input.value) || 0,
          };
        }, false);
      });
    });
  }

  private updateSettings(mutate: (settings: GameModeSettings) => void, rerender = true): void {
    if (!this.map) {
      return;
    }

    const settings = resolveSettings(this.map);
    mutate(settings);
    this.map.gameModeSettings = settings;
    this.actions.onGameModeChange(structuredClone(settings));

    if (rerender) {
      this.render();
    }
  }

  private updateTeam(index: number, patch: Partial<TeamDefinition>, rerender = true): void {
    this.updateTeams((teams) => {
      const team = teams[index];

      if (team) {
        Object.assign(team, patch);
      }
    }, rerender);
  }

  private updateTeams(mutate: (teams: TeamDefinition[]) => void, rerender = true): void {
    if (!this.map) {
      return;
    }

    const teams = getTeams(this.map);
    mutate(teams);
    this.map.teams = teams;
    this.actions.onTeamsChange(structuredClone(teams));

    if (rerender) {
      this.render();
    }
  }

  private getWarnings(settings: GameModeSettings, teams: TeamDefinition[]): string[] {
    const map = this.map;
    const warnings: string[] = [];

    if (!map) {
      return warnings;
    }

    if (settings.teamsEnabled && teams.length === 0) {
      warnings.push("Times habilitados sem nenhum time configurado.");
    }

    if (
      settings.mode === "capturePoint" &&
      !map.objects.some((object) => object.type === "capturePoint")
    ) {
      warnings.push("Modo Capture Point sem objeto capturePoint no mapa.");
    }

    if (
      settings.mode === "teamBattle" &&
      !map.objects.some((object) => object.type === "teamSpawn")
    ) {
      warnings.push("Batalha de times sem Spawn de Time.");
    }

    if (
      settings.winCondition?.type === "collectCoins" &&
      !map.objects.some((object) => object.type === "coin")
    ) {
      warnings.push("Vitoria por moedas sem moedas no mapa.");
    }

    if (
      settings.winCondition?.type === "defeatEnemies" &&
      !map.objects.some((object) => object.type === "enemy")
    ) {
      warnings.push("Vitoria por inimigos sem inimigos no mapa.");
    }

    if (
      settings.winCondition?.type === "completeObjectives" &&
      (map.objectives ?? []).every((objective) => objective.required === false)
    ) {
      warnings.push("Vitoria por objetivos sem objetivos obrigatorios.");
    }

    if (settings.mode === "tycoon") {
      if (!map.objects.some((object) => object.type === "tycoonGenerator")) {
        warnings.push("Tycoon sem gerador de dinheiro.");
      }

      if (!map.objects.some((object) => object.type === "tycoonCollector")) {
        warnings.push("Tycoon sem coletor de dinheiro.");
      }

      if (!map.objects.some((object) => object.type === "tycoonBuyButton")) {
        warnings.push("Tycoon sem botao de compra.");
      }
    }

    const teamIds = new Set<string>();

    for (const team of teams) {
      if (!team.id.trim()) {
        warnings.push("Existe time sem ID.");
      }

      if (teamIds.has(team.id)) {
        warnings.push(`ID de time duplicado: ${team.id}.`);
      }

      teamIds.add(team.id);
    }

    return warnings;
  }
}

function resolveSettings(map: GameMap | null): GameModeSettings {
  const hasFinish = Boolean(
    map?.objects.some((object) => object.type === "finish" || object.type === "goal")
  );
  const baseWinCondition: NonNullable<GameModeSettings["winCondition"]> = {
    type: hasFinish ? "finish" : "none",
  };
  const base: GameModeSettings = {
    mode: "freeplay",
    roundEnabled: false,
    respawnDelay: 1,
    teamsEnabled: false,
    requireObjectivesToFinish: map?.gameplaySettings?.requireObjectivesToFinish ?? false,
    winCondition: baseWinCondition,
    scoring: {
      coinScore: 10,
      enemyDefeatScore: 100,
      objectiveScore: 250,
      deathPenalty: 25,
    },
  };

  return {
    ...base,
    ...(map?.gameModeSettings ?? {}),
    winCondition: {
      ...baseWinCondition,
      ...(map?.gameModeSettings?.winCondition ?? {}),
      type: map?.gameModeSettings?.winCondition?.type ?? baseWinCondition.type,
    },
    scoring: {
      ...base.scoring,
      ...(map?.gameModeSettings?.scoring ?? {}),
    },
    tycoonSettings: {
      startingCash: 0,
      sharedCash: false,
      requireAllPurchasesToWin: true,
      winPurchaseIds: [],
      allowStealing: false,
      autoClaimInSolo: true,
      generatorTickRateScale: 1,
      ...(map?.gameModeSettings?.tycoonSettings ?? {}),
    },
  };
}

function getTeams(map: GameMap | null): TeamDefinition[] {
  return structuredClone(map?.teams ?? []);
}

function getDefaultWinConditionForMode(mode: GameMode, map: GameMap | null): WinConditionType {
  if (mode === "obby") {
    return "finish";
  }

  if (mode === "coinCollect") {
    return "collectCoins";
  }

  if (mode === "combatArena" || mode === "teamBattle") {
    return "defeatEnemies";
  }

  if (mode === "objectiveRun") {
    return "completeObjectives";
  }

  if (mode === "capturePoint") {
    return "capturePoint";
  }

  if (mode === "tycoon") {
    return "completeTycoon";
  }

  return map?.objects.some((object) => object.type === "finish" || object.type === "goal")
    ? "finish"
    : "none";
}

function createDefaultTeam(index: number): TeamDefinition {
  const presets = [
    { id: "red", name: "Time Vermelho", color: "#ef4444", spawnPoint: { x: -6, y: 1, z: 0 } },
    { id: "blue", name: "Time Azul", color: "#3b82f6", spawnPoint: { x: 6, y: 1, z: 0 } },
    { id: "green", name: "Time Verde", color: "#22c55e", spawnPoint: { x: 0, y: 1, z: -6 } },
  ];

  return (
    presets[index] ?? {
      id: `team_${index + 1}`,
      name: `Time ${index + 1}`,
      color: "#f59e0b",
      spawnPoint: { x: index * 3, y: 1, z: 0 },
    }
  );
}

function toGameMode(value: string): GameMode {
  return MODE_OPTIONS.some((option) => option.mode === value) ? (value as GameMode) : "freeplay";
}

function toWinConditionType(value: string): WinConditionType {
  return WIN_OPTIONS.some((option) => option.type === value) ? (value as WinConditionType) : "none";
}

function sanitizeId(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getIndex(element: HTMLElement): number {
  return Math.max(0, Number(element.dataset.index) || 0);
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
