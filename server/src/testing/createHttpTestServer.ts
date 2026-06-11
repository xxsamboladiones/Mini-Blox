import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";

type JsonBody = Record<string, unknown> | unknown[];

export type JsonResponse<TBody = unknown> = {
  status: number;
  body: TBody;
};

export type HttpTestServer = {
  baseUrl: string;
  requestJson: <TBody = unknown>(
    route: string,
    init?: {
      method?: string;
      token?: string;
      body?: JsonBody;
    }
  ) => Promise<JsonResponse<TBody>>;
  close: () => Promise<void>;
};

export async function createHttpTestServer(): Promise<HttpTestServer> {
  const previousEnv = {
    databaseUrl: process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV,
    rateLimitEnabled: process.env.RATE_LIMIT_ENABLED,
    logLevel: process.env.LOG_LEVEL,
  };
  const tempDir = await mkdtemp(path.join(tmpdir(), "miniblox-server-test-"));
  const databasePath = path.join(tempDir, "miniblox-test.sqlite");

  process.env.DATABASE_URL = `file:${databasePath}`;
  process.env.NODE_ENV = "test";
  process.env.RATE_LIMIT_ENABLED = "false";
  process.env.LOG_LEVEL = "silent";

  const { createApp } = await import("../app.js");
  const { closeDatabase } = await import("../db/connection.js");
  const app = createApp();
  const server = await listen(app.listen.bind(app));
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Test server did not bind to a TCP port.");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl,
    requestJson: async <TBody = unknown>(route, init = {}) => {
      const headers = new Headers();
      headers.set("content-type", "application/json");
      if (init.token) {
        headers.set("authorization", `Bearer ${init.token}`);
      }

      const response = await fetch(`${baseUrl}${route}`, {
        method: init.method ?? "GET",
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
      const body = (await response.json()) as TBody;
      return { status: response.status, body };
    },
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
      closeDatabase();
      await rm(tempDir, { recursive: true, force: true });
      restoreEnv(previousEnv);
    },
  };
}

function listen(
  listenFn: (port: number, hostname: string, callback: () => void) => Server
): Promise<Server> {
  return new Promise((resolve) => {
    const server = listenFn(0, "127.0.0.1", () => resolve(server));
  });
}

function restoreEnv(previousEnv: {
  databaseUrl?: string;
  nodeEnv?: string;
  rateLimitEnabled?: string;
  logLevel?: string;
}): void {
  restoreEnvValue("DATABASE_URL", previousEnv.databaseUrl);
  restoreEnvValue("NODE_ENV", previousEnv.nodeEnv);
  restoreEnvValue("RATE_LIMIT_ENABLED", previousEnv.rateLimitEnabled);
  restoreEnvValue("LOG_LEVEL", previousEnv.logLevel);
}

function restoreEnvValue(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
