import type { NextFunction, Request, Response } from "express";
import { hashAuthToken, readBearerToken } from "../auth/tokens.js";
import { userRepository } from "../repositories/UserRepository.js";
import type { PublicUser } from "../repositories/interfaces.js";

export type AuthenticatedRequest = Request & {
  user?: PublicUser;
  authTokenHash?: string;
};

export async function authenticateRequest(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const user = getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ ok: false, error: "Authentication required" });
    return;
  }

  req.user = user.user;
  req.authTokenHash = user.tokenHash;
  next();
}

export async function optionalAuthenticateRequest(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const user = getUserFromRequest(req);
  if (user) {
    req.user = user.user;
    req.authTokenHash = user.tokenHash;
  }
  next();
}

function getUserFromRequest(req: Request): { user: PublicUser; tokenHash: string } | null {
  const token = readBearerToken(req.header("authorization"));
  if (!token) {
    return null;
  }

  const tokenHash = hashAuthToken(token);
  const session = userRepository.findSessionByTokenHash(tokenHash);
  if (!session || Date.parse(session.expiresAt) <= Date.now()) {
    if (session) {
      userRepository.deleteSessionByTokenHash(tokenHash);
    }
    return null;
  }

  const user = userRepository.findById(session.userId);
  if (!user) {
    userRepository.deleteSessionByTokenHash(tokenHash);
    return null;
  }

  return {
    tokenHash,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
    },
  };
}
