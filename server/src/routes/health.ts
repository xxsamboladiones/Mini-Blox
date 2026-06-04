import type { Request, Response } from "express";
import type { HealthResponse } from "../types/OnlineMapSchema.js";

export function healthRoute(_req: Request, res: Response): void {
  const response: HealthResponse = {
    ok: true,
    service: "miniblox-server",
    version: "0.1.0",
  };

  res.json(response);
}
