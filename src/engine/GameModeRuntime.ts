import * as THREE from "three";
import { applyObjectAppearanceToThree } from "./ObjectFactory";
import type { LogicRuntimeEvent } from "./LogicRuntime";
import type {
  GameMap,
  GameMode,
  GameModeSettings,
  GameModeWinCondition,
  ScoringSettings,
  TeamDefinition,
  WinConditionType,
} from "../shared/types/MapSchema";
import type { MapObject, Vector3 } from "../shared/types/ObjectSchema";
import type { GameModeSummary, RuntimeHud } from "./RuntimeHud";

type GameModeRuntimeOptions = {
  onWin: (message: string, summary: GameModeSummary) => void;
  onLogicEvent: (event: LogicRuntimeEvent) => void;
  onTeamChanged?: (team: TeamDefinition | null) => void;
};

type CapturePointState = {
  mapObject: MapObject;
  pointId: string;
  ownerTeamId: string;
  progress: number;
  scoreRemainder: number;
};

type ObjectiveSummary = {
  completed: number;
  total: number;
};

const DEFAULT_SCORE_TARGET = 100;

export class GameModeRuntime {
  private readonly settings: GameModeSettings;
  private readonly teams: TeamDefinition[];
  private readonly teamScores = new Map<string, number>();
  private readonly capturePoints = new Map<string, CapturePointState>();
  private readonly scoreMilestones = new Set<string>();
  private readonly teamScoreMilestones = new Set<string>();
  private playerScore = 0;
  private coinsCollected = 0;
  private enemiesDefeated = 0;
  private deaths = 0;
  private objectivesCompleted = 0;
  private roundTimeRemaining: number | null = null;
  private currentTeamId: string | null = null;
  private won = false;

  constructor(
    private readonly map: GameMap,
    private readonly hud: RuntimeHud,
    private readonly objectViews: Map<string, THREE.Object3D>,
    private readonly options: GameModeRuntimeOptions
  ) {
    this.settings = resolveGameModeSettings(map);
    this.teams = resolveTeams(map);
    this.reset();
  }

  reset(): void {
    this.playerScore = 0;
    this.coinsCollected = 0;
    this.enemiesDefeated = 0;
    this.deaths = 0;
    this.objectivesCompleted = 0;
    this.roundTimeRemaining = this.settings.roundEnabled
      ? Math.max(0, this.settings.roundTimeLimit ?? 180)
      : null;
    this.won = false;
    this.scoreMilestones.clear();
    this.teamScoreMilestones.clear();
    this.teamScores.clear();

    for (const team of this.teams) {
      this.teamScores.set(team.id, 0);
    }

    this.currentTeamId = this.settings.teamsEnabled ? (this.teams[0]?.id ?? null) : null;
    this.options.onTeamChanged?.(this.getCurrentTeam());
    this.initializeCapturePoints();
    this.updateHud();
  }

  update(deltaSeconds: number, playerBounds: THREE.Box3, playerPosition: Vector3): void {
    if (this.won) {
      return;
    }

    if (this.roundTimeRemaining !== null) {
      this.roundTimeRemaining = Math.max(0, this.roundTimeRemaining - deltaSeconds);

      if (this.roundTimeRemaining <= 0 && this.settings.roundEnabled) {
        this.endRound("draw");
        return;
      }
    }

    this.updateCapturePoints(deltaSeconds, playerBounds, playerPosition);
    this.checkVictory();
    this.updateHud();
  }

  onCoinCollected(totalCoins: number, amount = 1): void {
    this.coinsCollected = Math.max(this.coinsCollected, Math.floor(totalCoins));
    this.addScore(
      Math.max(0, amount) * getScoreValue(this.settings.scoring, "coinScore", 10),
      false
    );
    this.checkVictory();
    this.updateHud();
  }

  onEnemyDefeated(defeatedCount: number, _totalEnemies: number): void {
    this.enemiesDefeated = Math.max(this.enemiesDefeated, defeatedCount);
    const score = getScoreValue(this.settings.scoring, "enemyDefeatScore", 100);
    this.addScore(score, false);
    this.addCurrentTeamScore(score, false);
    this.checkVictory();
    this.updateHud();
  }

  onObjectiveCompleted(summary: ObjectiveSummary): void {
    this.objectivesCompleted = Math.max(this.objectivesCompleted, summary.completed);
    const score = getScoreValue(this.settings.scoring, "objectiveScore", 250);
    this.addScore(score, false);
    this.addCurrentTeamScore(score, false);
    this.checkVictory(summary);
    this.updateHud();
  }

  onPlayerDeath(): void {
    this.deaths += 1;
    const penalty = getScoreValue(this.settings.scoring, "deathPenalty", 25);
    this.addScore(-penalty, false);
    this.addCurrentTeamScore(-penalty, false);
    this.updateHud();
  }

  handleFinishReached(message: string, objectiveSummary?: ObjectiveSummary): boolean {
    if (this.won) {
      return true;
    }

    const winCondition = this.settings.winCondition ?? { type: "none" };

    if (
      winCondition.type !== "finish" &&
      winCondition.type !== "none" &&
      !this.isConditionMet(winCondition, objectiveSummary)
    ) {
      this.hud.showMessage(this.getBlockedFinishMessage(winCondition), 1900);
      return false;
    }

    this.win(message);
    return true;
  }

  addScore(amount: number, checkVictory = true): void {
    if (!Number.isFinite(amount)) {
      return;
    }

    this.playerScore = Math.max(0, Math.floor(this.playerScore + amount));
    this.dispatchScoreEvent();

    if (checkVictory) {
      this.checkVictory();
      this.updateHud();
    }
  }

  addTeamScore(teamId: string, amount: number, checkVictory = true): void {
    const targetTeamId = teamId || this.currentTeamId;

    if (!targetTeamId || !Number.isFinite(amount)) {
      return;
    }

    const current = this.teamScores.get(targetTeamId) ?? 0;
    const nextScore = Math.max(0, Math.floor(current + amount));
    this.teamScores.set(targetTeamId, nextScore);
    this.dispatchTeamScoreEvent(targetTeamId, nextScore);

    if (checkVictory) {
      this.checkVictory();
      this.updateHud();
    }
  }

  setTeam(teamId: string): boolean {
    if (!this.teams.some((team) => team.id === teamId)) {
      return false;
    }

    this.currentTeamId = teamId;
    this.options.onTeamChanged?.(this.getCurrentTeam());
    this.hud.showMessage(`Time: ${this.getCurrentTeam()?.name ?? teamId}`);
    this.updateHud();
    return true;
  }

  endRound(result: "win" | "lose" | "draw"): void {
    if (this.won) {
      return;
    }

    if (result === "win") {
      this.win("Vitoria!");
      return;
    }

    const title = result === "lose" ? "Derrota" : "Rodada concluida";
    this.win(title);
  }

  getRespawnDelay(): number {
    return Math.max(0, this.settings.respawnDelay ?? 1);
  }

  getRespawnPoint(fallback: Vector3): Vector3 {
    if (!this.settings.teamsEnabled || !this.currentTeamId) {
      return { ...fallback };
    }

    const team = this.getCurrentTeam();

    if (team?.spawnPoint) {
      return { ...team.spawnPoint };
    }

    const teamSpawn = this.map.objects.find(
      (object) =>
        object.type === "teamSpawn" &&
        getString(object.properties?.teamId, "") === this.currentTeamId
    );

    return teamSpawn ? { ...teamSpawn.position } : { ...fallback };
  }

  requiresObjectivesToFinish(): boolean {
    return this.settings.requireObjectivesToFinish === true;
  }

  getSummary(): GameModeSummary {
    const currentTeam = this.getCurrentTeam();

    return {
      mode: this.settings.mode,
      teamName: currentTeam?.name,
      score: this.playerScore,
      teamScores: this.teams.map((team) => ({
        id: team.id,
        name: team.name,
        color: team.color,
        score: this.teamScores.get(team.id) ?? 0,
      })),
      coinsCollected: this.coinsCollected,
      enemiesDefeated: this.enemiesDefeated,
      deaths: this.deaths,
      objectivesCompleted: this.objectivesCompleted,
      capturePointsOwned: [...this.capturePoints.values()].filter(
        (point) => point.ownerTeamId === (this.currentTeamId ?? "player")
      ).length,
    };
  }

  private initializeCapturePoints(): void {
    this.capturePoints.clear();

    for (const mapObject of this.map.objects) {
      if (mapObject.type !== "capturePoint") {
        continue;
      }

      const pointId = getString(mapObject.properties?.pointId, mapObject.id);
      const ownerTeamId = getString(mapObject.properties?.ownerTeamId, "");
      this.capturePoints.set(mapObject.id, {
        mapObject,
        pointId,
        ownerTeamId,
        progress: ownerTeamId ? 1 : 0,
        scoreRemainder: 0,
      });
      this.applyCapturePointColor(mapObject.id, ownerTeamId);
    }
  }

  private updateCapturePoints(
    deltaSeconds: number,
    playerBounds: THREE.Box3,
    playerPosition: Vector3
  ): void {
    if (this.capturePoints.size === 0) {
      return;
    }

    const capturingTeamId = this.currentTeamId ?? "player";

    for (const state of this.capturePoints.values()) {
      const view = this.objectViews.get(state.mapObject.id);
      const radius = Math.max(0.5, getNumber(state.mapObject.properties?.radius, 4));
      const inside = this.isPlayerInsideCapturePoint(state, playerBounds, playerPosition, radius);

      if (inside && state.ownerTeamId !== capturingTeamId) {
        const captureTime = Math.max(0.2, getNumber(state.mapObject.properties?.captureTime, 5));
        state.progress = Math.min(1, state.progress + deltaSeconds / captureTime);

        if (state.progress >= 1) {
          state.ownerTeamId = capturingTeamId;
          this.applyCapturePointColor(state.mapObject.id, capturingTeamId);
          this.hud.showMessage(`${getCapturePointLabel(state)} capturado`);
          this.options.onLogicEvent({
            type: "onCapturePointCaptured",
            pointId: state.pointId,
            teamId: capturingTeamId,
          });
        }
      } else if (!inside && state.ownerTeamId !== capturingTeamId) {
        state.progress = Math.max(0, state.progress - deltaSeconds * 0.18);
      }

      if (state.ownerTeamId) {
        const scorePerSecond = Math.max(
          0,
          getNumber(state.mapObject.properties?.scorePerSecond, 1)
        );
        state.scoreRemainder += scorePerSecond * deltaSeconds;
        const wholeScore = Math.floor(state.scoreRemainder);

        if (wholeScore > 0) {
          state.scoreRemainder -= wholeScore;

          if (this.settings.teamsEnabled && state.ownerTeamId !== "player") {
            this.addTeamScore(state.ownerTeamId, wholeScore, false);
          } else if (state.ownerTeamId === capturingTeamId) {
            this.addScore(wholeScore, false);
          }
        }
      }

      if (view) {
        view.userData.captureProgress = state.progress;
      }
    }
  }

  private isPlayerInsideCapturePoint(
    state: CapturePointState,
    playerBounds: THREE.Box3,
    playerPosition: Vector3,
    radius: number
  ): boolean {
    const view = this.objectViews.get(state.mapObject.id);

    if (view) {
      const bounds = new THREE.Box3().setFromObject(view).expandByScalar(0.16);

      if (bounds.intersectsBox(playerBounds)) {
        return true;
      }
    }

    return distance2D(playerPosition, state.mapObject.position) <= radius;
  }

  private applyCapturePointColor(objectId: string, ownerTeamId: string): void {
    const state = this.capturePoints.get(objectId);
    const view = this.objectViews.get(objectId);

    if (!state || !view) {
      return;
    }

    const teamColor = this.teams.find((team) => team.id === ownerTeamId)?.color;
    applyObjectAppearanceToThree(view, {
      ...state.mapObject,
      properties: {
        ...state.mapObject.properties,
        color: teamColor ?? getString(state.mapObject.properties?.color, "#facc15"),
      },
    });
  }

  private checkVictory(objectiveSummary?: ObjectiveSummary): void {
    if (this.won) {
      return;
    }

    const winCondition = this.settings.winCondition ?? { type: "none" };

    if (winCondition.type === "finish" || winCondition.type === "none") {
      return;
    }

    if (this.isConditionMet(winCondition, objectiveSummary)) {
      this.win(this.getVictoryMessage(winCondition));
    }
  }

  private isConditionMet(
    winCondition: GameModeWinCondition,
    objectiveSummary?: ObjectiveSummary
  ): boolean {
    if (winCondition.type === "none" || winCondition.type === "finish") {
      return true;
    }

    const target = this.getTargetAmount(winCondition, objectiveSummary);

    if (winCondition.type === "collectCoins") {
      return this.coinsCollected >= target;
    }

    if (winCondition.type === "defeatEnemies") {
      return this.enemiesDefeated >= target;
    }

    if (winCondition.type === "completeObjectives") {
      return this.objectivesCompleted >= target;
    }

    if (winCondition.type === "score") {
      return this.getBestScore() >= target;
    }

    if (winCondition.type === "capturePoint") {
      return this.getBestScore() >= target;
    }

    return false;
  }

  private getTargetAmount(
    winCondition: GameModeWinCondition,
    objectiveSummary?: ObjectiveSummary
  ): number {
    const configured = Math.floor(winCondition.targetAmount ?? 0);

    if (!winCondition.requireAll && configured > 0) {
      return configured;
    }

    if (winCondition.type === "collectCoins") {
      return Math.max(1, this.map.objects.filter((object) => object.type === "coin").length);
    }

    if (winCondition.type === "defeatEnemies") {
      return Math.max(1, this.map.objects.filter((object) => object.type === "enemy").length);
    }

    if (winCondition.type === "completeObjectives") {
      return Math.max(
        1,
        objectiveSummary?.total ??
          (this.map.objectives ?? []).filter((objective) => objective.required !== false).length
      );
    }

    return configured > 0 ? configured : DEFAULT_SCORE_TARGET;
  }

  private getBestScore(): number {
    if (!this.settings.teamsEnabled) {
      return this.playerScore;
    }

    return Math.max(this.playerScore, ...this.teamScores.values(), 0);
  }

  private getBlockedFinishMessage(winCondition: GameModeWinCondition): string {
    const target = this.getTargetAmount(winCondition);

    if (winCondition.type === "collectCoins") {
      return `Colete moedas: ${this.coinsCollected}/${target}.`;
    }

    if (winCondition.type === "defeatEnemies") {
      return `Derrote inimigos: ${this.enemiesDefeated}/${target}.`;
    }

    if (winCondition.type === "completeObjectives") {
      return `Conclua objetivos: ${this.objectivesCompleted}/${target}.`;
    }

    if (winCondition.type === "score" || winCondition.type === "capturePoint") {
      return `Pontuacao necessaria: ${this.getBestScore()}/${target}.`;
    }

    return "Conclua a condicao de vitoria.";
  }

  private getVictoryMessage(winCondition: GameModeWinCondition): string {
    if (winCondition.type === "collectCoins") {
      return "Meta de moedas concluida!";
    }

    if (winCondition.type === "defeatEnemies") {
      return "Inimigos derrotados!";
    }

    if (winCondition.type === "completeObjectives") {
      return "Objetivos concluidos!";
    }

    if (winCondition.type === "capturePoint") {
      return "Ponto de captura dominado!";
    }

    if (winCondition.type === "score") {
      return "Meta de pontuacao atingida!";
    }

    return "Vitoria!";
  }

  private win(message: string): void {
    if (this.won) {
      return;
    }

    this.won = true;
    this.options.onLogicEvent({ type: "onGameModeWon" });
    this.options.onWin(message, this.getSummary());
  }

  private dispatchScoreEvent(): void {
    const key = `${this.playerScore}`;

    if (this.scoreMilestones.has(key)) {
      return;
    }

    this.scoreMilestones.add(key);
    this.options.onLogicEvent({ type: "onScoreReached", amount: this.playerScore });
  }

  private dispatchTeamScoreEvent(teamId: string, score: number): void {
    const key = `${teamId}:${score}`;

    if (this.teamScoreMilestones.has(key)) {
      return;
    }

    this.teamScoreMilestones.add(key);
    this.options.onLogicEvent({ type: "onTeamScoreReached", teamId, amount: score });
  }

  private addCurrentTeamScore(amount: number, checkVictory: boolean): void {
    if (!this.settings.teamsEnabled || !this.currentTeamId) {
      return;
    }

    this.addTeamScore(this.currentTeamId, amount, checkVictory);
  }

  private updateHud(): void {
    const winCondition = this.settings.winCondition ?? { type: "none" };
    this.hud.setGameModeStatus({
      modeLabel: getModeLabel(this.settings.mode),
      teamLabel: this.getCurrentTeam()?.name,
      score: this.playerScore,
      targetScore:
        winCondition.type === "score" || winCondition.type === "capturePoint"
          ? this.getTargetAmount(winCondition)
          : undefined,
      progressLabel: this.getProgressLabel(winCondition),
      roundTime: this.roundTimeRemaining ?? undefined,
      teamScores: this.teams.map((team) => ({
        id: team.id,
        name: team.name,
        color: team.color,
        score: this.teamScores.get(team.id) ?? 0,
      })),
      capturePoints: [...this.capturePoints.values()].map((state) => ({
        id: state.pointId,
        label: getCapturePointLabel(state),
        ownerLabel: this.getTeamLabel(state.ownerTeamId),
        progress: state.progress,
      })),
    });
  }

  private getProgressLabel(winCondition: GameModeWinCondition): string {
    const target = this.getTargetAmount(winCondition);

    if (winCondition.type === "collectCoins") {
      return `Moedas: ${this.coinsCollected}/${target}`;
    }

    if (winCondition.type === "defeatEnemies") {
      return `Inimigos: ${this.enemiesDefeated}/${target}`;
    }

    if (winCondition.type === "completeObjectives") {
      return `Objetivos: ${this.objectivesCompleted}/${target}`;
    }

    if (winCondition.type === "score") {
      return `Pontos: ${this.getBestScore()}/${target}`;
    }

    if (winCondition.type === "capturePoint") {
      return `Captura: ${this.getBestScore()}/${target}`;
    }

    if (winCondition.type === "finish") {
      return "Objetivo: chegar ao final";
    }

    return "Livre";
  }

  private getCurrentTeam(): TeamDefinition | null {
    return this.teams.find((team) => team.id === this.currentTeamId) ?? null;
  }

  private getTeamLabel(teamId: string): string {
    if (!teamId) {
      return "Neutro";
    }

    if (teamId === "player") {
      return "Player";
    }

    return this.teams.find((team) => team.id === teamId)?.name ?? teamId;
  }
}

function resolveGameModeSettings(map: GameMap): GameModeSettings {
  const hasFinish = map.objects.some(
    (object) => object.type === "finish" || object.type === "goal"
  );
  const mode = map.gameModeSettings?.mode ?? "freeplay";
  const defaultWinCondition = getDefaultWinCondition(mode, hasFinish);

  return {
    mode,
    roundEnabled: map.gameModeSettings?.roundEnabled ?? false,
    roundTimeLimit: map.gameModeSettings?.roundTimeLimit ?? 180,
    respawnDelay: map.gameModeSettings?.respawnDelay ?? 1,
    teamsEnabled: map.gameModeSettings?.teamsEnabled ?? false,
    requireObjectivesToFinish:
      map.gameModeSettings?.requireObjectivesToFinish ??
      map.gameplaySettings?.requireObjectivesToFinish ??
      false,
    winCondition: {
      type: map.gameModeSettings?.winCondition?.type ?? defaultWinCondition,
      targetAmount: map.gameModeSettings?.winCondition?.targetAmount,
      requireAll: map.gameModeSettings?.winCondition?.requireAll,
    },
    scoring: {
      coinScore: 10,
      enemyDefeatScore: 100,
      objectiveScore: 250,
      deathPenalty: 25,
      ...(map.gameModeSettings?.scoring ?? {}),
    },
  };
}

function resolveTeams(map: GameMap): TeamDefinition[] {
  return (map.teams ?? []).filter((team) => team.id && team.name && team.color);
}

function getDefaultWinCondition(mode: GameMode, hasFinish: boolean): WinConditionType {
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

  return hasFinish ? "finish" : "none";
}

function getScoreValue(
  settings: ScoringSettings | undefined,
  key: keyof ScoringSettings,
  fallback: number
): number {
  const value = settings?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getModeLabel(mode: GameMode): string {
  switch (mode) {
    case "obby":
      return "Obby";
    case "coinCollect":
      return "Coleta";
    case "combatArena":
      return "Arena";
    case "objectiveRun":
      return "Objetivos";
    case "teamBattle":
      return "Times";
    case "capturePoint":
      return "Capture Point";
    case "freeplay":
    default:
      return "Livre";
  }
}

function getCapturePointLabel(state: CapturePointState): string {
  return state.mapObject.name ?? state.pointId;
}

function getString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function getNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function distance2D(a: Vector3, b: Vector3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
