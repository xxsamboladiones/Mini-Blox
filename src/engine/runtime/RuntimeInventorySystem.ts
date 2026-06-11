import type { InventoryItem } from "../../shared/types/ItemSchema";

export class RuntimeInventorySystem {
  private readonly items = new Map<string, InventoryItem>();

  clear(): void {
    this.items.clear();
  }

  upsertItem(itemId: string, quantity = 1, collectedAt = new Date().toISOString()): InventoryItem {
    const existing = this.items.get(itemId);
    if (existing) {
      existing.quantity = Math.max(1, existing.quantity + quantity);
      existing.collectedAt = collectedAt;
      return existing;
    }

    const item: InventoryItem = {
      itemId,
      quantity: Math.max(1, quantity),
      collectedAt,
    };
    this.items.set(itemId, item);
    return item;
  }

  setSingleItem(itemId: string, collectedAt = new Date().toISOString()): InventoryItem {
    const existing = this.items.get(itemId);
    if (existing) {
      existing.quantity = Math.max(1, existing.quantity);
      existing.collectedAt = collectedAt;
      return existing;
    }

    return this.upsertItem(itemId, 1, collectedAt);
  }

  getHudItems(): InventoryItem[] {
    return [...this.items.values()];
  }
}
