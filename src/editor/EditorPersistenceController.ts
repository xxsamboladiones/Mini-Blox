import { normalizeGameMap } from "../shared/normalizeGameMap";
import { createMapFromTemplate } from "../shared/MapTemplates";
import type { GameMap } from "../shared/types/MapSchema";
import { MapStorage } from "../storage/MapStorage";
import {
  assertEditorMapValidForAction,
  formatMapValidationIssues,
  getBlockingValidationIssues,
  validateEditorMap,
} from "./EditorMapValidator";

export interface EditorPersistenceControllerOptions {
  getSnapshot: () => GameMap;
  loadMap: (map: GameMap) => void | Promise<void>;
  getCurrentMapId?: () => string | null;
  showToast?: (message: string, type?: "success" | "error" | "info") => void;
}

type SaveLocalOptions = {
  map?: GameMap;
  silent?: boolean;
  validate?: boolean;
};

export class EditorPersistenceController {
  constructor(private readonly options: EditorPersistenceControllerOptions) {}

  createNewMap(): GameMap {
    return normalizeGameMap(createMapFromTemplate("obby"));
  }

  getNormalizedSnapshot(): GameMap {
    return normalizeGameMap(this.options.getSnapshot());
  }

  saveLocal(options: SaveLocalOptions = {}): GameMap {
    const source = options.map ?? this.options.getSnapshot();

    if (options.validate !== false) {
      assertEditorMapValidForAction(source);
    }

    const map = normalizeGameMap(source);
    MapStorage.saveMap(map);

    if (!options.silent) {
      this.options.showToast?.("Mapa salvo com sucesso.", "success");
    }

    return map;
  }

  loadLocal(): GameMap | null {
    const map = MapStorage.getLastMap();
    return map ? normalizeGameMap(map) : null;
  }

  exportJson(): GameMap {
    const source = this.options.getSnapshot();
    const issues = validateEditorMap(source);
    const blocking = getBlockingValidationIssues(issues);

    if (blocking.length > 0) {
      throw new Error(formatMapValidationIssues(blocking));
    }

    const map = normalizeGameMap(source);
    downloadJson(map, `mini-blox-${slugify(map.name)}.json`);
    this.options.showToast?.("Mapa exportado.", "success");
    return map;
  }

  async importJsonFile(file: File): Promise<GameMap> {
    let parsed: unknown;

    try {
      parsed = JSON.parse(await file.text());
    } catch {
      throw new Error("JSON invalido. Escolha um arquivo de mapa exportado pelo MiniBlox.");
    }

    const candidate = createGameMapCandidate(parsed);
    const issues = validateEditorMap(candidate);
    const blocking = getBlockingValidationIssues(issues);

    if (blocking.length > 0) {
      throw new Error(formatMapValidationIssues(blocking));
    }

    const importedMap = prepareImportedMap(
      normalizeGameMap(candidate),
      this.options.getCurrentMapId?.() ?? null
    );

    if (!importedMap) {
      throw new Error("Importacao cancelada.");
    }

    const normalized = normalizeGameMap(importedMap);
    await this.options.loadMap(normalized);
    MapStorage.saveMap(normalized);
    this.options.showToast?.("Mapa carregado.", "success");
    return normalized;
  }
}

function createGameMapCandidate(value: unknown): GameMap {
  if (!isRecord(value)) {
    throw new Error("O arquivo nao contem um mapa valido.");
  }

  const now = new Date().toISOString();
  const candidate = value as Partial<GameMap>;

  return {
    ...candidate,
    id: typeof candidate.id === "string" ? candidate.id : createId("map"),
    name: typeof candidate.name === "string" ? candidate.name : "Mapa importado",
    authorId: typeof candidate.authorId === "string" ? candidate.authorId : "local-builder",
    spawnPoint: isRecord(candidate.spawnPoint)
      ? (candidate.spawnPoint as GameMap["spawnPoint"])
      : { x: 0, y: 1, z: 0 },
    objects: Array.isArray(candidate.objects) ? candidate.objects : [],
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : now,
    updatedAt: now,
  };
}

function prepareImportedMap(map: GameMap, currentMapId: string | null): GameMap | null {
  if (!MapStorage.hasMap(map.id) || map.id === currentMapId) {
    return map;
  }

  const choice = window.prompt(
    `Ja existe um mapa com o ID "${map.id}". Digite "substituir", "copia" ou "cancelar".`,
    "copia"
  );

  if (!choice || choice.toLowerCase().trim() === "cancelar") {
    return null;
  }

  if (choice.toLowerCase().trim() === "substituir") {
    return map;
  }

  const now = new Date().toISOString();
  return {
    ...map,
    id: createId("map"),
    name: `${map.name} (importado)`,
    isPublished: false,
    publishedAt: undefined,
    onlineMetadata: undefined,
    createdAt: now,
    updatedAt: now,
  };
}

function downloadJson(map: GameMap, fileName: string): void {
  const blob = new Blob([JSON.stringify(map, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "mapa"
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
