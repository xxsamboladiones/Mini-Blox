import { createIcons, icons } from "lucide";
import { OBJECT_CATALOG } from "../shared/ObjectCatalog";
import type { BuiltInObjectType } from "../shared/types/ObjectSchema";

type PaletteCategory = {
  title: string;
  types: BuiltInObjectType[];
};

const PALETTE_CATEGORIES: PaletteCategory[] = [
  {
    title: "Basicos",
    types: ["cube", "platform", "ramp", "spawn"],
  },
  {
    title: "Gameplay",
    types: ["checkpoint", "damage", "coin", "door", "button", "finish", "npc", "enemy"],
  },
  {
    title: "Mecanicas",
    types: [
      "jumpPad",
      "teleporter",
      "movingPlatform",
      "disappearingBlock",
      "messageZone",
      "key",
      "itemSpawner",
      "teamSpawn",
      "capturePoint",
    ],
  },
  {
    title: "Decoracao",
    types: ["tree", "rock", "crate", "barrel", "sign", "lamp", "arch", "pillar"],
  },
];

export class ObjectPanel {
  constructor(
    private readonly root: HTMLElement,
    private readonly onAddObject: (type: BuiltInObjectType) => void
  ) {}

  render(): void {
    this.root.innerHTML = `
      <div class="panel-heading">
        <h2>Pecas</h2>
      </div>
      ${PALETTE_CATEGORIES.map((category) => this.renderCategory(category)).join("")}
    `;

    this.root.querySelectorAll<HTMLButtonElement>("[data-type]").forEach((button) => {
      button.addEventListener("click", () => {
        this.onAddObject(button.dataset.type as BuiltInObjectType);
      });
    });

    createIcons({ icons });
  }

  private renderCategory(category: PaletteCategory): string {
    const items = category.types
      .map((type) => OBJECT_CATALOG.find((item) => item.type === type))
      .filter((item): item is (typeof OBJECT_CATALOG)[number] => Boolean(item));

    return `
      <div class="palette-category">
        <h3>${category.title}</h3>
        <div class="object-grid">
          ${items
            .map(
              (item) => `
            <button class="palette-button" type="button" data-type="${item.type}" title="${item.description}">
              <i data-lucide="${item.icon}"></i>
              <span>${item.label}</span>
            </button>
          `
            )
            .join("")}
        </div>
      </div>
    `;
  }
}
