export type EditorTool = "select" | "translate" | "rotate" | "scale";

export class ToolManager {
  private tool: EditorTool = "translate";
  private readonly listeners = new Set<(tool: EditorTool) => void>();

  get currentTool(): EditorTool {
    return this.tool;
  }

  setTool(tool: EditorTool): void {
    if (this.tool === tool) {
      return;
    }

    this.tool = tool;
    this.listeners.forEach((listener) => listener(tool));
  }

  onChange(listener: (tool: EditorTool) => void): () => void {
    this.listeners.add(listener);
    listener(this.tool);
    return () => this.listeners.delete(listener);
  }
}
