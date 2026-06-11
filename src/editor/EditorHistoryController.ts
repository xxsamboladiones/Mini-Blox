import { normalizeGameMap } from "../shared/normalizeGameMap";
import type { GameMap } from "../shared/types/MapSchema";
import type { EditorSceneChangeReason } from "./EditorScene";
import { getBlockingValidationIssues, validateEditorMap } from "./EditorMapValidator";

export type EditorHistoryChangeListener = () => void;

export interface EditorHistoryEntry {
  id: string;
  reason: EditorSceneChangeReason;
  objectId?: string;
  before: GameMap;
  after: GameMap;
  selectedObjectIdBefore?: string | null;
  selectedObjectIdAfter?: string | null;
  createdAt: number;
}

export interface EditorHistoryControllerOptions {
  getSnapshot: () => GameMap;
  applySnapshot: (map: GameMap, selectedObjectId?: string | null) => void | Promise<void>;
  getSelectedObjectId?: () => string | null;
  normalizeSnapshot?: (map: GameMap) => GameMap;
  validateSnapshot?: (map: GameMap) => boolean;
  canRecord?: () => boolean;
  maxEntries?: number;
}

type PendingHistoryEntry = {
  reason: EditorSceneChangeReason;
  objectId?: string;
  before: GameMap;
  selectedObjectIdBefore: string | null;
};

type PushOptions = {
  objectId?: string;
  selectedObjectIdBefore?: string | null;
  selectedObjectIdAfter?: string | null;
};

export class EditorHistoryController {
  private readonly undoStack: EditorHistoryEntry[] = [];
  private readonly redoStack: EditorHistoryEntry[] = [];
  private readonly listeners = new Set<EditorHistoryChangeListener>();
  private pending: PendingHistoryEntry | null = null;
  private restoring = false;

  constructor(private readonly options: EditorHistoryControllerOptions) {}

  subscribe(listener: EditorHistoryChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  begin(reason: EditorSceneChangeReason, objectId?: string): void {
    if (!this.canRecord()) {
      return;
    }

    this.pending = {
      reason,
      objectId,
      before: this.normalize(this.options.getSnapshot()),
      selectedObjectIdBefore: this.options.getSelectedObjectId?.() ?? null,
    };
  }

  commit(reason?: EditorSceneChangeReason, objectId?: string): void {
    if (!this.pending || !this.canRecord()) {
      this.pending = null;
      return;
    }

    const pending = this.pending;
    this.pending = null;
    this.push(reason ?? pending.reason, pending.before, this.options.getSnapshot(), {
      objectId: objectId ?? pending.objectId,
      selectedObjectIdBefore: pending.selectedObjectIdBefore,
      selectedObjectIdAfter: this.options.getSelectedObjectId?.() ?? null,
    });
  }

  cancel(): void {
    this.pending = null;
  }

  push(
    reason: EditorSceneChangeReason,
    before: GameMap,
    after: GameMap,
    options: PushOptions = {}
  ): boolean {
    if (!this.canRecord()) {
      return false;
    }

    const normalizedBefore = this.normalize(before);
    const normalizedAfter = this.normalize(after);

    if (
      !this.isValidSnapshot(normalizedBefore) ||
      !this.isValidSnapshot(normalizedAfter) ||
      areMapsEquivalent(normalizedBefore, normalizedAfter)
    ) {
      return false;
    }

    this.undoStack.push({
      id: createId("history"),
      reason,
      objectId: options.objectId,
      before: normalizedBefore,
      after: normalizedAfter,
      selectedObjectIdBefore: options.selectedObjectIdBefore,
      selectedObjectIdAfter: options.selectedObjectIdAfter,
      createdAt: Date.now(),
    });

    while (this.undoStack.length > this.maxEntries) {
      this.undoStack.shift();
    }

    this.redoStack.length = 0;
    this.notifyChange();
    return true;
  }

  async undo(): Promise<boolean> {
    const entry = this.undoStack.pop();

    if (!entry) {
      return false;
    }

    this.restoring = true;
    try {
      await this.options.applySnapshot(
        entry.before,
        getRestoredSelection(entry.before, entry.selectedObjectIdBefore)
      );
      this.redoStack.push(entry);
      this.notifyChange();
      return true;
    } catch (error) {
      this.undoStack.push(entry);
      throw error;
    } finally {
      this.restoring = false;
      this.pending = null;
    }
  }

  async redo(): Promise<boolean> {
    const entry = this.redoStack.pop();

    if (!entry) {
      return false;
    }

    this.restoring = true;
    try {
      await this.options.applySnapshot(
        entry.after,
        getRestoredSelection(entry.after, entry.selectedObjectIdAfter)
      );
      this.undoStack.push(entry);
      this.notifyChange();
      return true;
    } catch (error) {
      this.redoStack.push(entry);
      throw error;
    } finally {
      this.restoring = false;
      this.pending = null;
    }
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.pending = null;
    this.notifyChange();
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  isRestoring(): boolean {
    return this.restoring;
  }

  private get maxEntries(): number {
    return Math.max(1, this.options.maxEntries ?? 50);
  }

  private canRecord(): boolean {
    return !this.restoring && (this.options.canRecord?.() ?? true);
  }

  private normalize(map: GameMap): GameMap {
    return (this.options.normalizeSnapshot ?? normalizeGameMap)(map);
  }

  private isValidSnapshot(map: GameMap): boolean {
    if (this.options.validateSnapshot) {
      return this.options.validateSnapshot(map);
    }

    return getBlockingValidationIssues(validateEditorMap(map)).length === 0;
  }

  private notifyChange(): void {
    this.listeners.forEach((listener) => listener());
  }
}

function getRestoredSelection(map: GameMap, objectId: string | null | undefined): string | null {
  if (!objectId) {
    return null;
  }

  return map.objects.some((object) => object.id === objectId) ? objectId : null;
}

function areMapsEquivalent(a: GameMap, b: GameMap): boolean {
  // TODO: replace full snapshot string comparison with a patch/diff strategy if maps grow large.
  return JSON.stringify(a) === JSON.stringify(b);
}

function createId(prefix: string): string {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
