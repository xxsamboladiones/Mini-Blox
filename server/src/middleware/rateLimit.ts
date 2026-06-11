import type { NextFunction, Request, Response } from "express";
import { logger } from "../logger.js";

type RateLimitOptions = {
  windowMs?: number;
  max?: number;
  keyPrefix: string;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function createRateLimit(options: RateLimitOptions) {
  const windowMs =
    options.windowMs ?? (Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000);
  const max = options.max ?? (Number(process.env.RATE_LIMIT_MAX) || 100);

  return (req: Request, res: Response, next: NextFunction): void => {
    if (String(process.env.RATE_LIMIT_ENABLED ?? "true").toLowerCase() === "false") {
      next();
      return;
    }

    const now = Date.now();
    const key = `${options.keyPrefix}:${getClientKey(req)}`;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > max) {
      logger.warn("rate limit hit", {
        keyPrefix: options.keyPrefix,
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      res.status(429).json({ ok: false, error: "Too many requests" });
      return;
    }

    next();
  };
}

export function clearRateLimitBuckets(): void {
  buckets.clear();
}

function getClientKey(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}
