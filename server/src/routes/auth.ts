import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import { createAuthToken, getTokenExpiration, hashAuthToken } from "../auth/tokens.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { logger } from "../logger.js";
import { userRepository } from "../repositories/UserRepository.js";
import { createId } from "../utils/createId.js";

type AuthRequestBody = {
  username?: unknown;
  password?: unknown;
  displayName?: unknown;
};

type ValidationResult = { valid: true; value: string } | { valid: false; error: string };

export async function registerRoute(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as AuthRequestBody;
    const username = normalizeUsername(body.username);
    const password = normalizePassword(body.password);

    if (!username.valid) {
      res.status(400).json({ ok: false, error: username.error });
      return;
    }

    if (!password.valid) {
      res.status(400).json({ ok: false, error: password.error });
      return;
    }

    const displayName = normalizeDisplayName(body.displayName, username.value);
    if (!displayName.valid) {
      res.status(400).json({ ok: false, error: displayName.error });
      return;
    }

    if (userRepository.findByUsername(username.value)) {
      res.status(409).json({ ok: false, error: "Username is already in use" });
      return;
    }

    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash(password.value, 12);
    const user = userRepository.createUser({
      id: createId("user"),
      username: username.value,
      passwordHash,
      displayName: displayName.value,
      now,
    });
    const session = createSession(user.id);

    logger.info("auth register success", { userId: user.id, username: user.username });
    res.json({
      ok: true,
      user: toPublicUser(user),
      token: session.token,
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    logger.error("auth register failed", { error });
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
}

export async function loginRoute(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as AuthRequestBody;
    const username = normalizeUsername(body.username);
    const password = normalizePassword(body.password);

    if (!username.valid) {
      res.status(400).json({ ok: false, error: username.error });
      return;
    }

    if (!password.valid) {
      res.status(400).json({ ok: false, error: password.error });
      return;
    }

    const user = userRepository.findByUsername(username.value);
    const passwordMatches = user ? await bcrypt.compare(password.value, user.passwordHash) : false;

    if (!user || !passwordMatches) {
      logger.warn("auth login rejected", { username: username.value });
      res.status(401).json({ ok: false, error: "Invalid username or password" });
      return;
    }

    const session = createSession(user.id);
    logger.info("auth login success", { userId: user.id, username: user.username });
    res.json({
      ok: true,
      user: toPublicUser(user),
      token: session.token,
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    logger.error("auth login failed", { error });
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
}

export async function logoutRoute(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (req.authTokenHash) {
    userRepository.deleteSessionByTokenHash(req.authTokenHash);
  }

  res.json({ ok: true });
}

export async function meRoute(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ ok: false, error: "Authentication required" });
    return;
  }

  res.json({ ok: true, user: req.user });
}

function createSession(userId: string): { token: string; expiresAt: string } {
  userRepository.deleteExpiredSessions(new Date().toISOString());
  const token = createAuthToken();
  const expiresAt = getTokenExpiration();
  userRepository.createSession({
    id: createId("session"),
    userId,
    tokenHash: hashAuthToken(token),
    expiresAt,
    now: new Date().toISOString(),
  });
  return { token, expiresAt };
}

function toPublicUser(user: { id: string; username: string; displayName: string }) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
  };
}

function normalizeUsername(value: unknown): ValidationResult {
  if (typeof value !== "string") {
    return { valid: false, error: "Username is required" };
  }

  const username = value.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,32}$/.test(username)) {
    return {
      valid: false,
      error: "Username must have 3-32 characters using letters, numbers or underscore",
    };
  }

  return { valid: true, value: username };
}

function normalizePassword(value: unknown): ValidationResult {
  if (typeof value !== "string") {
    return { valid: false, error: "Password is required" };
  }

  if (value.length < 8 || value.length > 128) {
    return { valid: false, error: "Password must have 8-128 characters" };
  }

  return { valid: true, value };
}

function normalizeDisplayName(value: unknown, fallback: string): ValidationResult {
  const displayName =
    typeof value === "string" && value.trim().length > 0
      ? value.trim().replace(/\s+/g, " ")
      : fallback;

  if (displayName.length < 1 || displayName.length > 32) {
    return { valid: false, error: "Display name must have 1-32 characters" };
  }

  return { valid: true, value: displayName };
}
