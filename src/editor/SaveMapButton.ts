import { createIcons, icons } from "lucide";

type SaveMapButtonActions = {
  onTest: () => void;
  onSave: () => void;
  onPublish: () => void;
  onExport: () => void;
  onImport: () => void;
  onMenu: () => void;
};

export class SaveMapButton {
  private testing = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly actions: SaveMapButtonActions
  ) {}

  render(): void {
    this.root.innerHTML = `
      <button class="top-action" type="button" data-action="test">
        <i data-lucide="${this.testing ? "square" : "play"}"></i>
        <span>${this.testing ? "Editar" : "Testar"}</span>
      </button>
      <button class="top-action primary" type="button" data-action="save">
        <i data-lucide="save"></i>
        <span>Salvar</span>
      </button>
      <button class="top-action" type="button" data-action="publish">
        <i data-lucide="send"></i>
        <span>Publicar</span>
      </button>
      <button class="top-action" type="button" data-action="export">
        <i data-lucide="download"></i>
        <span>Exportar</span>
      </button>
      <button class="top-action" type="button" data-action="import">
        <i data-lucide="file-up"></i>
        <span>Importar</span>
      </button>
      <button class="top-action" type="button" data-action="menu">
        <i data-lucide="house"></i>
        <span>Voltar ao Menu</span>
      </button>
    `;

    this.root.querySelector<HTMLButtonElement>('[data-action="test"]')
      ?.addEventListener("click", this.actions.onTest);
    this.root.querySelector<HTMLButtonElement>('[data-action="save"]')
      ?.addEventListener("click", this.actions.onSave);
    this.root.querySelector<HTMLButtonElement>('[data-action="publish"]')
      ?.addEventListener("click", this.actions.onPublish);
    this.root.querySelector<HTMLButtonElement>('[data-action="export"]')
      ?.addEventListener("click", this.actions.onExport);
    this.root.querySelector<HTMLButtonElement>('[data-action="import"]')
      ?.addEventListener("click", this.actions.onImport);
    this.root.querySelector<HTMLButtonElement>('[data-action="menu"]')
      ?.addEventListener("click", this.actions.onMenu);

    createIcons({ icons });
  }

  setTesting(testing: boolean): void {
    this.testing = testing;
    this.render();
  }
}
