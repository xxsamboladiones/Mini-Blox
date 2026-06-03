import { createIcons, icons } from "lucide";
import type { MapAsset } from "../shared/types/ObjectSchema";

export class AssetPanel {
  private assets: MapAsset[] = [];

  constructor(
    private readonly root: HTMLElement,
    private readonly onImportModel: (file: File) => void
  ) {}

  render(): void {
    this.root.innerHTML = `
      <div class="panel-heading">
        <h2>Assets</h2>
      </div>
      <input class="sr-only" id="model-import" type="file" accept=".glb,.gltf,model/gltf+json,model/gltf-binary" />
      <button class="wide-action" type="button" data-import-model>
        <i data-lucide="upload"></i>
        <span>Importar modelo</span>
      </button>
      <div class="asset-list">
        ${this.assets.length === 0 ? `<div class="empty-row">Nenhum asset</div>` : ""}
        ${this.assets.map((asset) => `
          <div class="asset-row" title="${asset.name}">
            <i data-lucide="box"></i>
            <span>${asset.name}</span>
          </div>
        `).join("")}
      </div>
    `;

    const input = this.root.querySelector<HTMLInputElement>("#model-import");
    const button = this.root.querySelector<HTMLButtonElement>("[data-import-model]");
    button?.addEventListener("click", () => input?.click());
    input?.addEventListener("change", () => {
      const file = input.files?.[0];

      if (file) {
        this.onImportModel(file);
      }

      input.value = "";
    });

    createIcons({ icons });
  }

  setAssets(assets: MapAsset[]): void {
    this.assets = assets;
    this.render();
  }
}
