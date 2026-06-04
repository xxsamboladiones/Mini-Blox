const CLIENT_ID_KEY = "miniblox-client-id";

export const LocalClientStorage = {
  getClientId(): string {
    try {
      const stored = globalThis.localStorage?.getItem(CLIENT_ID_KEY);

      if (stored && stored.trim().length > 0) {
        return stored;
      }
    } catch {
      // localStorage pode estar indisponível
    }

    const newClientId = this.generateClientId();
    this.setClientId(newClientId);
    return newClientId;
  },

  setClientId(clientId: string): void {
    try {
      globalThis.localStorage?.setItem(CLIENT_ID_KEY, clientId);
    } catch {
      // localStorage pode estar indisponível
    }
  },

  resetClientId(): void {
    try {
      globalThis.localStorage?.removeItem(CLIENT_ID_KEY);
    } catch {
      // localStorage pode estar indisponível
    }
  },

  generateClientId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2);
    return `client-${timestamp}-${random}`;
  },
};
