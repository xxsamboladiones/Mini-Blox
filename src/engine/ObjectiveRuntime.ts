import type { AudioSystem } from "./AudioSystem";
import type { FeedbackSystem } from "./FeedbackSystem";
import { RuntimeHud, type HudObjectiveState } from "./RuntimeHud";
import type { GameMap, MapObjective } from "../shared/types/MapSchema";
import type { MapObject, Vector3 } from "../shared/types/ObjectSchema";

type ObjectiveState = {
  objective: MapObjective;
  completed: boolean;
  progress: number;
};

type ObjectiveRuntimeOptions = {
  onObjectiveCompleted: (objective: MapObjective) => void;
};

export class ObjectiveRuntime {
  private readonly states = new Map<string, ObjectiveState>();

  constructor(
    private readonly map: GameMap,
    private readonly hud: RuntimeHud,
    private readonly audio: AudioSystem,
    private readonly feedback: FeedbackSystem,
    private readonly options: ObjectiveRuntimeOptions
  ) {
    this.reset();
  }

  reset(): void {
    this.states.clear();

    for (const objective of getObjectives(this.map)) {
      this.states.set(objective.id, {
        objective,
        completed: false,
        progress: 0,
      });
    }

    this.updateHud();
  }

  completeObjective(objectiveId: string): boolean {
    const state = this.states.get(objectiveId);

    if (!state) {
      return false;
    }

    return this.markCompleted(state, this.getObjectivePosition(state.objective));
  }

  onCoinCollected(totalCoins: number): void {
    for (const state of this.states.values()) {
      if (state.objective.type !== "collectCoins" || state.completed) {
        continue;
      }

      const target = getObjectiveTargetAmount(state.objective, 1);
      state.progress = Math.min(target, Math.max(0, totalCoins));

      if (state.progress >= target) {
        this.markCompleted(state);
      }
    }

    this.updateHud();
  }

  onObjectReached(objectId: string): void {
    for (const state of this.states.values()) {
      if (
        state.objective.type === "reachObject" &&
        state.objective.targetObjectId === objectId &&
        !state.completed
      ) {
        this.markCompleted(state, this.getObjectPosition(objectId));
      }
    }
  }

  onKeyCollected(keyId: string): void {
    for (const state of this.states.values()) {
      if (
        state.objective.type === "collectKey" &&
        state.objective.targetKeyId === keyId &&
        !state.completed
      ) {
        this.markCompleted(state, this.getKeyPosition(keyId));
      }
    }
  }

  onButtonActivated(objectId: string): void {
    for (const state of this.states.values()) {
      if (
        state.objective.type === "activateButton" &&
        state.objective.targetObjectId === objectId &&
        !state.completed
      ) {
        this.markCompleted(state, this.getObjectPosition(objectId));
      }
    }
  }

  onDoorOpened(doorId: string): void {
    for (const state of this.states.values()) {
      if (
        state.objective.type === "openDoor" &&
        state.objective.targetDoorId === doorId &&
        !state.completed
      ) {
        this.markCompleted(state, this.getDoorPosition(doorId));
      }
    }
  }

  onEnemyDefeated(defeatedCount: number, totalEnemies: number): void {
    for (const state of this.states.values()) {
      if (state.objective.type !== "defeatEnemies" || state.completed) {
        continue;
      }

      const target = getObjectiveTargetAmount(state.objective, Math.max(1, totalEnemies));
      state.progress = Math.min(target, Math.max(0, defeatedCount));

      if (state.progress >= target) {
        this.markCompleted(state);
      }
    }

    this.updateHud();
  }

  areRequiredObjectivesComplete(): boolean {
    for (const state of this.states.values()) {
      if (state.objective.required !== false && !state.completed) {
        return false;
      }
    }

    return true;
  }

  getRequiredSummary(): { completed: number; total: number } {
    const requiredStates = [...this.states.values()].filter(
      (state) => state.objective.required !== false
    );
    return {
      completed: requiredStates.filter((state) => state.completed).length,
      total: requiredStates.length,
    };
  }

  getCurrentHint(): string | null {
    const next = [...this.states.values()].find(
      (state) =>
        !state.completed && state.objective.visible !== false && state.objective.required !== false
    );

    return next ? next.objective.title : null;
  }

  private markCompleted(state: ObjectiveState, position?: Vector3): boolean {
    if (state.completed) {
      return false;
    }

    state.completed = true;
    state.progress = getObjectiveTargetAmount(state.objective, Math.max(1, state.progress));
    this.updateHud();
    this.audio.play("checkpoint");
    this.feedback.spawn("objective", position, "Objetivo");
    this.hud.showMessage(
      state.objective.completedMessage || `Objetivo concluido: ${state.objective.title}`,
      2400
    );
    this.options.onObjectiveCompleted(state.objective);
    return true;
  }

  private updateHud(): void {
    this.hud.setObjectives(
      [...this.states.values()]
        .filter((state) => state.objective.visible !== false)
        .map(
          (state): HudObjectiveState => ({
            id: state.objective.id,
            title: state.objective.title,
            description: state.objective.description,
            completed: state.completed,
            progress: getProgressValue(state),
            target: getTargetValue(state, this.map),
            required: state.objective.required !== false,
          })
        )
    );
  }

  private getObjectivePosition(objective: MapObjective): Vector3 | undefined {
    if (objective.targetObjectId) {
      return this.getObjectPosition(objective.targetObjectId);
    }

    if (objective.targetKeyId) {
      return this.getKeyPosition(objective.targetKeyId);
    }

    if (objective.targetDoorId) {
      return this.getDoorPosition(objective.targetDoorId);
    }

    return undefined;
  }

  private getObjectPosition(objectId: string): Vector3 | undefined {
    return this.map.objects.find((object) => object.id === objectId)?.position;
  }

  private getKeyPosition(keyId: string): Vector3 | undefined {
    return this.map.objects.find((object) => object.type === "key" && getKeyId(object) === keyId)
      ?.position;
  }

  private getDoorPosition(doorId: string): Vector3 | undefined {
    return this.map.objects.find((object) => object.type === "door" && getDoorId(object) === doorId)
      ?.position;
  }
}

function getObjectives(map: GameMap): MapObjective[] {
  return (map.objectives ?? []).filter(
    (objective) =>
      typeof objective.id === "string" &&
      typeof objective.title === "string" &&
      typeof objective.type === "string"
  );
}

function getProgressValue(state: ObjectiveState): number | undefined {
  if (state.objective.type === "collectCoins" || state.objective.type === "defeatEnemies") {
    return state.completed
      ? getObjectiveTargetAmount(state.objective, Math.max(1, state.progress))
      : state.progress;
  }

  return undefined;
}

function getTargetValue(state: ObjectiveState, map: GameMap): number | undefined {
  if (state.objective.type === "collectCoins") {
    return getObjectiveTargetAmount(state.objective, 1);
  }

  if (state.objective.type === "defeatEnemies") {
    const enemyCount = map.objects.filter((object) => object.type === "enemy").length;
    return getObjectiveTargetAmount(state.objective, Math.max(1, enemyCount));
  }

  return undefined;
}

function getObjectiveTargetAmount(objective: MapObjective, fallback: number): number {
  return Math.max(
    1,
    Math.floor(typeof objective.targetAmount === "number" ? objective.targetAmount : fallback)
  );
}

function getDoorId(object: MapObject): string {
  return typeof object.properties?.doorId === "string" && object.properties.doorId.length > 0
    ? object.properties.doorId
    : object.id;
}

function getKeyId(object: MapObject): string {
  return typeof object.properties?.keyId === "string" && object.properties.keyId.length > 0
    ? object.properties.keyId
    : object.id;
}
