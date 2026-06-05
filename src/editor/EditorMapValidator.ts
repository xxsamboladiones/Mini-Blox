import { isFiniteVector } from "../shared/normalizeGameMap";
import type { GameMap } from "../shared/types/MapSchema";
import type { MapObject, Vector3 } from "../shared/types/ObjectSchema";

export interface EditorMapValidationIssue {
  level: "error" | "warning";
  code: string;
  message: string;
  objectId?: string;
}

export class EditorMapValidationError extends Error {
  constructor(public readonly issues: EditorMapValidationIssue[]) {
    super(formatMapValidationIssues(issues));
    this.name = "EditorMapValidationError";
  }
}

export function validateEditorMap(map: GameMap): EditorMapValidationIssue[] {
  const issues: EditorMapValidationIssue[] = [];

  if (!map || typeof map !== "object") {
    return [
      {
        level: "error",
        code: "map.missing",
        message: "O mapa nao pode ser lido.",
      },
    ];
  }

  if (!isNonEmptyString(map.id)) {
    issues.push({
      level: "error",
      code: "map.id",
      message: "O mapa precisa de um ID valido.",
    });
  }

  if (!isNonEmptyString(map.name)) {
    issues.push({
      level: "warning",
      code: "map.name",
      message: "O mapa esta sem nome; um nome padrao sera usado.",
    });
  }

  if (!isNonEmptyString(map.authorId)) {
    issues.push({
      level: "warning",
      code: "map.authorId",
      message: "O mapa esta sem autor; o autor local sera usado.",
    });
  }

  if (!isFiniteVector(map.spawnPoint)) {
    issues.push({
      level: "warning",
      code: "map.spawnPoint",
      message: "O spawn do mapa esta ausente ou invalido; sera usado o spawn padrao.",
    });
  }

  if (!Array.isArray(map.objects)) {
    issues.push({
      level: "error",
      code: "map.objects",
      message: "A lista de objetos do mapa esta ausente ou invalida.",
    });
    return issues;
  }

  const objectIds = new Set<string>();
  for (const object of map.objects) {
    validateObject(object, objectIds, issues);
  }

  if (!Array.isArray(map.assets ?? [])) {
    issues.push({
      level: "warning",
      code: "map.assets",
      message: "Assets ausentes serao normalizados como lista vazia.",
    });
  }

  if (!Array.isArray(map.logic ?? [])) {
    issues.push({
      level: "warning",
      code: "map.logic",
      message: "Logica ausente sera normalizada como lista vazia.",
    });
  }

  if (!Array.isArray(map.objectives ?? [])) {
    issues.push({
      level: "warning",
      code: "map.objectives",
      message: "Objetivos ausentes serao normalizados como lista vazia.",
    });
  }

  if (!hasFinishObject(map) && requiresFinishWarning(map)) {
    issues.push({
      level: "warning",
      code: "map.finish.missing",
      message: "Este modo de jogo normalmente precisa de um objeto final.",
    });
  }

  return issues;
}

export function getBlockingValidationIssues(
  issues: EditorMapValidationIssue[]
): EditorMapValidationIssue[] {
  return issues.filter((issue) => issue.level === "error");
}

export function assertEditorMapValidForAction(map: GameMap): void {
  const issues = validateEditorMap(map);
  const blocking = getBlockingValidationIssues(issues);

  if (blocking.length > 0) {
    throw new EditorMapValidationError(blocking);
  }
}

export function formatMapValidationIssues(issues: EditorMapValidationIssue[]): string {
  if (issues.length === 0) {
    return "Mapa valido.";
  }

  const firstIssues = issues.slice(0, 3).map((issue) => issue.message);
  const suffix = issues.length > firstIssues.length ? ` (+${issues.length - firstIssues.length})` : "";
  return `Mapa invalido: ${firstIssues.join(" ")}${suffix}`;
}

function validateObject(
  object: MapObject,
  objectIds: Set<string>,
  issues: EditorMapValidationIssue[]
): void {
  const objectId = typeof object?.id === "string" ? object.id : undefined;

  if (!object || typeof object !== "object") {
    issues.push({
      level: "error",
      code: "object.invalid",
      message: "Existe um objeto que nao pode ser lido.",
    });
    return;
  }

  if (!isNonEmptyString(object.id)) {
    issues.push({
      level: "error",
      code: "object.id",
      message: "Existe um objeto sem ID.",
    });
  } else if (objectIds.has(object.id)) {
    issues.push({
      level: "error",
      code: "object.id.duplicate",
      message: `O ID de objeto "${object.id}" esta duplicado.`,
      objectId: object.id,
    });
  } else {
    objectIds.add(object.id);
  }

  if (!isNonEmptyString(object.type)) {
    issues.push({
      level: "error",
      code: "object.type",
      message: objectId
        ? `O objeto "${objectId}" esta sem tipo.`
        : "Existe um objeto sem tipo.",
      objectId,
    });
  }

  validateVector(object.position, "position", objectId, issues);

  if (object.rotation !== undefined) {
    validateVector(object.rotation, "rotation", objectId, issues);
  }

  if (object.scale !== undefined) {
    validateScale(object.scale, objectId, issues);
  }

  if (isFiniteVector(object.position)) {
    const distanceFromCenter = Math.hypot(object.position.x, object.position.y, object.position.z);
    if (distanceFromCenter > 5000) {
      issues.push({
        level: "warning",
        code: "object.position.far",
        message: `O objeto "${objectId ?? "sem ID"}" esta muito longe do centro do mapa.`,
        objectId,
      });
    }
  }
}

function validateVector(
  value: unknown,
  field: "position" | "rotation",
  objectId: string | undefined,
  issues: EditorMapValidationIssue[]
): void {
  if (!isFiniteVector(value)) {
    issues.push({
      level: "error",
      code: `object.${field}`,
      message: `O objeto "${objectId ?? "sem ID"}" tem ${field} invalido.`,
      objectId,
    });
  }
}

function validateScale(
  value: unknown,
  objectId: string | undefined,
  issues: EditorMapValidationIssue[]
): void {
  if (!isFiniteVector(value) || value.x <= 0 || value.y <= 0 || value.z <= 0) {
    issues.push({
      level: "error",
      code: "object.scale",
      message: `O objeto "${objectId ?? "sem ID"}" tem escala invalida ou nao positiva.`,
      objectId,
    });
    return;
  }

  if (isScaleTooLarge(value)) {
    issues.push({
      level: "warning",
      code: "object.scale.large",
      message: `O objeto "${objectId ?? "sem ID"}" tem escala muito grande.`,
      objectId,
    });
  }
}

function isScaleTooLarge(scale: Vector3): boolean {
  return scale.x > 250 || scale.y > 250 || scale.z > 250;
}

function hasFinishObject(map: GameMap): boolean {
  return map.objects.some((object) => object.type === "finish" || object.type === "goal");
}

function requiresFinishWarning(map: GameMap): boolean {
  const mode = map.gameModeSettings?.mode ?? "freeplay";
  return mode === "obby" || mode === "coinCollect" || mode === "objectiveRun";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
