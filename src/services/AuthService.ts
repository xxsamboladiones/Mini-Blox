const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const SESSION_KEY = "mini-blox-auth-session";

export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
};

export type AuthSession = {
  user: AuthUser;
  token: string;
  expiresAt: string;
};

type AuthResponse = {
  ok: true;
  user: AuthUser;
  token: string;
  expiresAt: string;
};

export const AuthService = {
  getSession(): AuthSession | null {
    return readSession();
  },

  getCurrentUser(): AuthUser | null {
    return readSession()?.user ?? null;
  },

  getToken(): string | null {
    const session = readSession();
    if (!session) {
      return null;
    }

    if (Date.parse(session.expiresAt) <= Date.now()) {
      clearSession();
      return null;
    }

    return session.token;
  },

  getAuthHeaders(): HeadersInit {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },

  requireAuthToken(): string {
    const token = this.getToken();
    if (!token) {
      throw new Error("Entre na sua conta online para fazer essa acao.");
    }
    return token;
  },

  async register(input: {
    username: string;
    password: string;
    displayName: string;
  }): Promise<AuthSession> {
    return authenticate("/api/auth/register", input);
  },

  async login(input: { username: string; password: string }): Promise<AuthSession> {
    return authenticate("/api/auth/login", input);
  },

  async logout(): Promise<void> {
    const token = this.getToken();
    clearSession();

    if (!token) {
      return;
    }

    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => undefined);
  },

  async refreshMe(): Promise<AuthUser | null> {
    const token = this.getToken();
    if (!token) {
      return null;
    }

    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      clearSession();
      return null;
    }

    const data = (await response.json()) as { ok: true; user: AuthUser };
    const current = readSession();
    if (current) {
      writeSession({ ...current, user: data.user });
    }
    return data.user;
  },
};

async function authenticate(path: string, body: Record<string, string>): Promise<AuthSession> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await readError(response);
    throw new Error(error || "Nao foi possivel autenticar.");
  }

  const data = (await response.json()) as AuthResponse;
  const session = {
    user: data.user,
    token: data.token,
    expiresAt: data.expiresAt,
  };
  writeSession(session);
  return session;
}

async function readError(response: Response): Promise<string | null> {
  try {
    const data = (await response.json()) as { error?: unknown };
    return typeof data.error === "string" ? data.error : null;
  } catch {
    return null;
  }
}

function readSession(): AuthSession | null {
  try {
    const raw = globalThis.localStorage?.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as AuthSession;
    if (
      !parsed ||
      typeof parsed.token !== "string" ||
      typeof parsed.expiresAt !== "string" ||
      !parsed.user
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeSession(session: AuthSession): void {
  try {
    globalThis.localStorage?.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // localStorage pode estar indisponivel em navegadores embutidos.
  }
}

function clearSession(): void {
  try {
    globalThis.localStorage?.removeItem(SESSION_KEY);
  } catch {
    // localStorage pode estar indisponivel em navegadores embutidos.
  }
}
