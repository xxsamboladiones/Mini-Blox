import { createHash, randomBytes } from "node:crypto";

export function createAuthToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashAuthToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function getTokenExpiration(): string {
  const ttlDays = Math.max(1, Number(process.env.AUTH_TOKEN_TTL_DAYS) || 30);
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
  return expiresAt.toISOString();
}

export function readBearerToken(header: string | undefined): string | null {
  if (!header) {
    return null;
  }

  const [type, token] = header.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token?.trim()) {
    return null;
  }

  return token.trim();
}
