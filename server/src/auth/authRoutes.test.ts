import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  createHttpTestServer,
  type HttpTestServer,
} from "../testing/createHttpTestServer";

type AuthResponse = {
  ok: boolean;
  token?: string;
  user?: {
    id: string;
    username: string;
    displayName: string;
  };
  error?: string;
};

describe("auth routes", () => {
  let server: HttpTestServer;
  let token: string;

  beforeAll(async () => {
    vi.resetModules();
    server = await createHttpTestServer();
  });

  afterAll(async () => {
    await server.close();
  });

  it("registra usuario sem expor senha ou hash", async () => {
    const response = await server.requestJson<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: {
        username: "alice_test",
        password: "password123",
        displayName: "Alice",
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user).toMatchObject({
      username: "alice_test",
      displayName: "Alice",
    });
    expect(response.body).not.toHaveProperty("password");
    expect(response.body.user).not.toHaveProperty("passwordHash");

    token = response.body.token ?? "";
  });

  it("loga com senha correta", async () => {
    const response = await server.requestJson<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: {
        username: "alice_test",
        password: "password123",
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.token).toEqual(expect.any(String));
  });

  it("rejeita login com senha errada", async () => {
    const response = await server.requestJson<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: {
        username: "alice_test",
        password: "wrong-password",
      },
    });

    expect(response.status).toBe(401);
    expect(response.body.ok).toBe(false);
  });

  it("retorna usuario autenticado em /me", async () => {
    const response = await server.requestJson<AuthResponse>("/api/auth/me", {
      token,
    });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.user?.username).toBe("alice_test");
  });
});
