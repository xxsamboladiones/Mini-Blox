import type { LogicNode } from "../shared/types/ScriptSchema";

export type ScriptContext = {
  emit: (eventName: string, payload?: unknown) => void;
};

export type LogicNodeHandler = (node: LogicNode, context: ScriptContext) => void;

export class ScriptRuntime {
  private readonly handlers = new Map<string, LogicNodeHandler>();

  registerHandler(type: string, handler: LogicNodeHandler): void {
    this.handlers.set(type, handler);
  }

  run(nodes: LogicNode[], context: ScriptContext): void {
    for (const node of nodes) {
      this.handlers.get(node.type)?.(node, context);
    }
  }
}
