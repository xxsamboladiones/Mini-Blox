import type { EditorTool } from "./ToolManager";

export interface EditorShortcutControllerOptions {
  isEnabled: () => boolean;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onImport: () => void;
  onDuplicate: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onDeselect: () => void;
  onToolChange: (tool: EditorTool) => void;
  onFocusSelected: () => void;
  onFocusMap: () => void;
}

export class EditorShortcutController {
  constructor(private readonly options: EditorShortcutControllerOptions) {
    window.addEventListener("keydown", this.handleKeyDown);
  }

  dispose(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.options.isEnabled() || isEditableTarget(event.target)) {
      return;
    }

    const key = event.key.toLowerCase();

    if (event.ctrlKey || event.metaKey) {
      this.handleCommandShortcut(event, key);
      return;
    }

    if (key === "delete" || key === "backspace") {
      event.preventDefault();
      this.options.onDelete();
    } else if (key === "escape") {
      event.preventDefault();
      this.options.onDeselect();
    } else if (key === "w") {
      event.preventDefault();
      this.options.onToolChange("translate");
    } else if (key === "e") {
      event.preventDefault();
      this.options.onToolChange("rotate");
    } else if (key === "r") {
      event.preventDefault();
      this.options.onToolChange("scale");
    } else if (key === "f") {
      event.preventDefault();
      this.options.onFocusSelected();
    } else if (key === "home") {
      event.preventDefault();
      this.options.onFocusMap();
    }
  };

  private handleCommandShortcut(event: KeyboardEvent, key: string): void {
    if (key === "z" && event.shiftKey) {
      event.preventDefault();
      this.options.onRedo();
    } else if (key === "z") {
      event.preventDefault();
      this.options.onUndo();
    } else if (key === "y") {
      event.preventDefault();
      this.options.onRedo();
    } else if (key === "s") {
      event.preventDefault();
      this.options.onSave();
    } else if (key === "o") {
      event.preventDefault();
      this.options.onImport();
    } else if (key === "d") {
      event.preventDefault();
      this.options.onDuplicate();
    } else if (key === "c") {
      event.preventDefault();
      this.options.onCopy();
    } else if (key === "v") {
      event.preventDefault();
      this.options.onPaste();
    }
  }
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}
