import { createIcons, icons } from "lucide";
import { AuthService, type AuthSession } from "../services/AuthService.js";

type AuthMode = "login" | "register";

export class AuthModal {
  private backdrop: HTMLElement | null = null;
  private mode: AuthMode = "login";
  private onSuccess: ((session: AuthSession) => void) | null = null;

  show(onSuccess: (session: AuthSession) => void): void {
    this.onSuccess = onSuccess;
    this.mode = "login";
    this.render();
  }

  close(): void {
    this.backdrop?.remove();
    this.backdrop = null;
  }

  private render(errorMessage = ""): void {
    this.close();

    this.backdrop = document.createElement("div");
    this.backdrop.className = "modal-backdrop";
    this.backdrop.innerHTML = `
      <form class="modal-content auth-modal" data-auth-form>
        <header class="detail-header">
          <h2>${this.mode === "login" ? "Entrar online" : "Criar conta"}</h2>
          <button class="icon-button" type="button" data-auth-action="close" title="Fechar" aria-label="Fechar">
            <i data-lucide="x"></i>
          </button>
        </header>
        <div class="auth-modal-body">
          <label class="field">
            <span>Usuario</span>
            <input name="username" autocomplete="username" required minlength="3" maxlength="32" />
          </label>
          ${
            this.mode === "register"
              ? `
            <label class="field">
              <span>Nome publico</span>
              <input name="displayName" autocomplete="nickname" maxlength="32" />
            </label>
          `
              : ""
          }
          <label class="field">
            <span>Senha</span>
            <input name="password" type="password" autocomplete="${this.mode === "login" ? "current-password" : "new-password"}" required minlength="8" maxlength="128" />
          </label>
          ${errorMessage ? `<p class="form-error">${escapeHtml(errorMessage)}</p>` : ""}
        </div>
        <footer class="detail-footer">
          <button class="action-button primary" type="submit">
            <i data-lucide="${this.mode === "login" ? "log-in" : "user-plus"}"></i>
            <span>${this.mode === "login" ? "Entrar" : "Registrar"}</span>
          </button>
          <button class="action-button" type="button" data-auth-action="toggle">
            <span>${this.mode === "login" ? "Criar conta" : "Ja tenho conta"}</span>
          </button>
        </footer>
      </form>
    `;

    document.body.appendChild(this.backdrop);
    this.backdrop.addEventListener("click", this.handleBackdropClick);
    this.backdrop.querySelector<HTMLFormElement>("[data-auth-form]")?.addEventListener("submit", this.handleSubmit);
    this.backdrop
      .querySelector<HTMLElement>("[data-auth-action='close']")
      ?.addEventListener("click", () => this.close());
    this.backdrop
      .querySelector<HTMLElement>("[data-auth-action='toggle']")
      ?.addEventListener("click", () => {
        this.mode = this.mode === "login" ? "register" : "login";
        this.render();
      });
    createIcons({ icons });
  }

  private readonly handleBackdropClick = (event: MouseEvent): void => {
    if (event.target === this.backdrop) {
      this.close();
    }
  };

  private readonly handleSubmit = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const username = String(data.get("username") ?? "");
    const password = String(data.get("password") ?? "");
    const displayName = String(data.get("displayName") ?? username);

    try {
      const session =
        this.mode === "login"
          ? await AuthService.login({ username, password })
          : await AuthService.register({ username, password, displayName });
      this.onSuccess?.(session);
      this.close();
    } catch (error) {
      this.render(error instanceof Error ? error.message : "Falha ao autenticar.");
    }
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
