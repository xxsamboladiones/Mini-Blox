import { EditorApp } from "../../editor/EditorApp";
import type { GameMap } from "../../shared/types/MapSchema";
import type { EditorScreenActions, Screen } from "../AppState";

export class EditorScreen implements Screen {
  private editorApp: EditorApp | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly map: GameMap,
    private readonly actions: EditorScreenActions
  ) {}

  render(): void {
    this.editorApp = new EditorApp(this.root, {
      initialMap: this.map,
      onBackToMenu: this.actions.onBackToMenu,
      onPlayMap: this.actions.onPlayMap
    });
    this.editorApp.start();
  }

  destroy(): void {
    this.editorApp?.destroy();
  }
}
