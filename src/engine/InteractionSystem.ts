export type InteractionHandler = (targetId: string) => void;

export class InteractionSystem {
  private readonly handlers = new Map<string, InteractionHandler>();

  register(targetId: string, handler: InteractionHandler): void {
    this.handlers.set(targetId, handler);
  }

  unregister(targetId: string): void {
    this.handlers.delete(targetId);
  }

  interact(targetId: string): boolean {
    const handler = this.handlers.get(targetId);

    if (!handler) {
      return false;
    }

    handler(targetId);
    return true;
  }
}
