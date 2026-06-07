import { GameRuntime } from "../engine/GameRuntime";
import { normalizeGameMap } from "../shared/normalizeGameMap";
import type { GameMap } from "../shared/types/MapSchema";
import {
  formatMapValidationIssues,
  getBlockingValidationIssues,
  validateEditorMap,
} from "./EditorMapValidator";

export interface EditorTestModeControllerOptions {
  getSnapshot: () => GameMap;
  mountElement: HTMLElement;
  enterEditorTestMode: () => void;
  exitEditorTestMode: () => void;
  onStarted?: (map: GameMap) => void;
  showToast?: (message: string, type?: "success" | "error" | "info") => void;
}

export class EditorTestModeController {
  private runtime: GameRuntime | null = null;
  private starting = false;

  constructor(private readonly options: EditorTestModeControllerOptions) {}

  async start(): Promise<void> {
    if (this.runtime || this.starting) {
      return;
    }

    const source = this.options.getSnapshot();
    const blocking = getBlockingValidationIssues(validateEditorMap(source));

    if (blocking.length > 0) {
      this.options.showToast?.(formatMapValidationIssues(blocking), "error");
      return;
    }

    const map = normalizeGameMap(source);
    this.starting = true;

    try {
      this.options.enterEditorTestMode();
      const runtime = new GameRuntime(this.options.mountElement, {
        onBackToMenu: () => this.stop(),
        onEditMap: () => this.stop(),
        isTestMode: true,
      });
      this.runtime = runtime;
      await runtime.loadMap(map);
      this.options.onStarted?.(map);
      this.options.showToast?.("Teste iniciado.", "success");
    } catch {
      this.runtime?.dispose();
      this.runtime = null;
      this.options.exitEditorTestMode();
      this.options.showToast?.("Nao foi possivel iniciar o test mode.", "error");
    } finally {
      this.starting = false;
    }
  }

  stop(): void {
    if (!this.runtime && !this.starting) {
      return;
    }

    this.runtime?.dispose();
    this.runtime = null;
    this.starting = false;
    this.options.exitEditorTestMode();
    this.options.showToast?.("Modo edicao.", "info");
  }

  async toggle(): Promise<void> {
    if (this.isRunning()) {
      this.stop();
      return;
    }

    await this.start();
  }

  isRunning(): boolean {
    return Boolean(this.runtime);
  }

  dispose(): void {
    this.stop();
  }
}
