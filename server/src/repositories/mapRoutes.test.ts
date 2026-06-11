import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  createHttpTestServer,
  type HttpTestServer,
} from "../testing/createHttpTestServer";
import { createOnlineTestMap } from "../testing/createOnlineTestMap";
import type { GameMap } from "../types/OnlineMapSchema";

type AuthResponse = {
  ok: boolean;
  token?: string;
};

type PublishResponse = {
  ok: boolean;
  onlineId?: string;
  error?: string;
};

type LikeResponse = {
  liked: boolean;
  likeCount: number;
};

type OnlineMapSummary = {
  id: string;
  name: string;
  playCount: number;
  likeCount: number;
  ownerUserId?: string | null;
  isOwner?: boolean;
  passwordHash?: string;
  token?: string;
};

describe("map routes and repositories", () => {
  let server: HttpTestServer;
  let ownerToken: string;
  let otherToken: string;

  beforeAll(async () => {
    vi.resetModules();
    server = await createHttpTestServer();
    ownerToken = await registerUser(server, "owner_test");
    otherToken = await registerUser(server, "other_test");
  });

  afterAll(async () => {
    await server.close();
  });

  it("exige auth para publicar mapa", async () => {
    const response = await server.requestJson<PublishResponse>("/api/maps", {
      method: "POST",
      body: {
        map: createOnlineTestMap({ id: "unauth-map" }),
        creatorName: "Tester",
        clientId: "legacy-client",
      },
    });

    expect(response.status).toBe(401);
    expect(response.body.ok).toBe(false);
  });

  it("publica com auth, incrementa play count, lista metadata e carrega o mapa", async () => {
    const map = createOnlineTestMap({ id: "query-map", name: "Mapa Consultavel" });
    const published = await server.requestJson<PublishResponse>("/api/maps", {
      method: "POST",
      token: ownerToken,
      body: {
        map,
        creatorName: "Owner",
        clientId: "legacy-owner",
      },
    });

    expect(published.status).toBe(200);
    const onlineId = published.body.onlineId;
    expect(onlineId).toEqual(expect.any(String));

    const getMap = await server.requestJson<GameMap>(`/api/maps/${onlineId}`);
    expect(getMap.status).toBe(200);
    expect(getMap.body.name).toBe("Mapa Consultavel");

    const play = await server.requestJson<{ ok: boolean }>(`/api/maps/${onlineId}/play`, {
      method: "POST",
    });
    expect(play.status).toBe(200);
    expect(play.body.ok).toBe(true);

    const list = await server.requestJson<OnlineMapSummary[]>("/api/maps", {
      token: ownerToken,
    });
    const summary = list.body.find((candidate) => candidate.id === onlineId);
    expect(summary).toMatchObject({
      id: onlineId,
      name: "Mapa Consultavel",
      playCount: 1,
      isOwner: true,
    });
    expect(summary).not.toHaveProperty("passwordHash");
    expect(summary).not.toHaveProperty("token");
  });

  it("exige auth para like", async () => {
    const published = await server.requestJson<PublishResponse>("/api/maps", {
      method: "POST",
      token: ownerToken,
      body: {
        map: createOnlineTestMap({ id: "like-auth-map" }),
        creatorName: "Owner",
        clientId: "legacy-owner",
      },
    });
    const onlineId = published.body.onlineId;
    expect(onlineId).toEqual(expect.any(String));

    const like = await server.requestJson<{ ok: boolean; error?: string }>(
      `/api/maps/${onlineId}/like`,
      {
        method: "POST",
        body: { clientId: "anonymous" },
      }
    );

    expect(like.status).toBe(401);
    expect(like.body.ok).toBe(false);
  });

  it("permite publicar, protege update/delete por dono real e alterna like/unlike", async () => {
    const published = await server.requestJson<PublishResponse>("/api/maps", {
      method: "POST",
      token: ownerToken,
      body: {
        map: createOnlineTestMap({ id: "owned-map", name: "Mapa do Dono" }),
        creatorName: "Owner",
        clientId: "legacy-owner",
      },
    });

    expect(published.status).toBe(200);
    expect(published.body.ok).toBe(true);
    const onlineId = published.body.onlineId;
    expect(onlineId).toEqual(expect.any(String));

    const deniedUpdate = await server.requestJson<PublishResponse>(`/api/maps/${onlineId}`, {
      method: "PUT",
      token: otherToken,
      body: {
        map: createOnlineTestMap({ id: "owned-map", name: "Tentativa de invasao" }),
        clientId: "other-client",
      },
    });
    expect(deniedUpdate.status).toBe(403);

    const firstLike = await server.requestJson<LikeResponse>(`/api/maps/${onlineId}/like`, {
      method: "POST",
      token: otherToken,
      body: { clientId: "other-client" },
    });
    expect(firstLike.status).toBe(200);
    expect(firstLike.body).toEqual({ liked: true, likeCount: 1 });

    const secondLike = await server.requestJson<LikeResponse>(`/api/maps/${onlineId}/like`, {
      method: "POST",
      token: otherToken,
      body: { clientId: "other-client" },
    });
    expect(secondLike.status).toBe(200);
    expect(secondLike.body).toEqual({ liked: false, likeCount: 0 });

    const ownerUpdate = await server.requestJson<PublishResponse>(`/api/maps/${onlineId}`, {
      method: "PUT",
      token: ownerToken,
      body: {
        map: createOnlineTestMap({ id: "owned-map", name: "Mapa Atualizado" }),
        clientId: "legacy-owner",
      },
    });
    expect(ownerUpdate.status).toBe(200);
    expect(ownerUpdate.body.ok).toBe(true);

    const deniedDelete = await server.requestJson<PublishResponse>(`/api/maps/${onlineId}`, {
      method: "DELETE",
      token: otherToken,
      body: { clientId: "other-client" },
    });
    expect(deniedDelete.status).toBe(403);

    const ownerDelete = await server.requestJson<PublishResponse>(`/api/maps/${onlineId}`, {
      method: "DELETE",
      token: ownerToken,
      body: { clientId: "legacy-owner" },
    });
    expect(ownerDelete.status).toBe(200);
    expect(ownerDelete.body.ok).toBe(true);
  });
});

async function registerUser(server: HttpTestServer, username: string): Promise<string> {
  const response = await server.requestJson<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: {
      username,
      password: "password123",
      displayName: username,
    },
  });

  if (!response.body.token) {
    throw new Error(`Falha ao registrar usuario de teste: ${username}`);
  }

  return response.body.token;
}
