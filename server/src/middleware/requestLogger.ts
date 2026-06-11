import type { NextFunction, Request, Response } from "express";
import { logger } from "../logger.js";
import type { AuthenticatedRequest } from "./auth.js";

export function requestLogger(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const startedAt = performance.now();

  res.on("finish", () => {
    logger.info("http request", {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
      userId: req.user?.id,
    });
  });

  next();
}
