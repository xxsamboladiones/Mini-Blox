const BASE_URL = "http://localhost:3001";

function authHeaders(token) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function testHealth() {
  console.log("Testing GET /health...");
  const response = await fetch(`${BASE_URL}/health`);
  const data = await response.json();
  console.log("ok Health check:", data);
  return data.ok === true;
}

async function registerUser(username) {
  console.log(`\nTesting POST /api/auth/register (${username})...`);
  const response = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      password: "senha-forte-123",
      displayName: username,
    }),
  });
  const data = await response.json();
  console.log("ok Register:", { ok: data.ok, user: data.user });
  return data.token;
}

async function testMe(token) {
  console.log("\nTesting GET /api/auth/me...");
  const response = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  console.log("ok Me:", data);
  return data.ok === true && data.user?.id;
}

function createSmokeMap(name = "Test Map") {
  return {
    id: "test-map-123",
    name,
    authorId: "test-author",
    description: "A test map for smoke testing",
    creatorName: "Test Creator",
    spawnPoint: { x: 0, y: 1, z: 0 },
    objects: [
      {
        id: "obj-1",
        type: "cube",
        position: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
    ],
    visualSettings: { theme: "classic" },
    gameModeSettings: { mode: "freeplay" },
  };
}

async function testPublishMap(token) {
  console.log("\nTesting POST /api/maps...");
  const response = await fetch(`${BASE_URL}/api/maps`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      map: createSmokeMap(),
      creatorName: "Test Creator",
      clientId: "test-client-123",
    }),
  });

  const data = await response.json();
  console.log("ok Publish map:", data);
  return data.ok === true ? data.onlineId : null;
}

async function testUnauthorizedPublish() {
  console.log("\nTesting unauthenticated POST /api/maps...");
  const response = await fetch(`${BASE_URL}/api/maps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ map: createSmokeMap(), creatorName: "No Auth" }),
  });
  const data = await response.json();
  console.log("ok Unauthenticated publish rejected:", data);
  return response.status === 401 && data.ok === false;
}

async function testListMaps() {
  console.log("\nTesting GET /api/maps...");
  const response = await fetch(`${BASE_URL}/api/maps`);
  const data = await response.json();
  console.log(`ok List maps: ${data.length} maps found`);
  return Array.isArray(data);
}

async function testInvalidPublishMap(label, token, mutateMap) {
  console.log(`\nTesting invalid POST /api/maps (${label})...`);
  const map = createSmokeMap(`Invalid Map ${label}`);
  mutateMap(map);

  const response = await fetch(`${BASE_URL}/api/maps`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      map,
      creatorName: "Test Creator",
      clientId: "test-client-123",
    }),
  });

  const data = await response.json().catch(() => ({}));
  console.log(`ok Invalid publish rejected (${label}):`, data);
  return response.status === 400 && data.ok === false;
}

async function testGetMap(onlineId) {
  console.log("\nTesting GET /api/maps/:id...");
  const response = await fetch(`${BASE_URL}/api/maps/${onlineId}`);
  const data = await response.json();
  console.log("ok Get map:", data.name);
  return data.name === "Test Map";
}

async function testRegisterPlay(onlineId) {
  console.log("\nTesting POST /api/maps/:id/play...");
  const response = await fetch(`${BASE_URL}/api/maps/${onlineId}/play`, {
    method: "POST",
  });
  const data = await response.json();
  console.log("ok Register play:", data);
  return data.ok === true;
}

async function testLikeMap(onlineId, token) {
  console.log("\nTesting POST /api/maps/:id/like...");
  const response = await fetch(`${BASE_URL}/api/maps/${onlineId}/like`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
  const data = await response.json();
  console.log("ok Like map:", data);
  return data.liked === true;
}

async function testForbiddenUpdate(onlineId, token) {
  console.log("\nTesting PUT /api/maps/:id forbidden for another user...");
  const response = await fetch(`${BASE_URL}/api/maps/${onlineId}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ map: createSmokeMap("Forbidden Update") }),
  });
  const data = await response.json();
  console.log("ok Forbidden update rejected:", data);
  return response.status === 403;
}

async function testUpdateMap(onlineId, token) {
  console.log("\nTesting PUT /api/maps/:id...");
  const response = await fetch(`${BASE_URL}/api/maps/${onlineId}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({
      map: createSmokeMap("Test Map Updated"),
      clientId: "test-client-123",
    }),
  });

  const data = await response.json();
  console.log("ok Update map:", data);
  return data.ok === true && data.map?.name === "Test Map Updated";
}

async function testForbiddenDelete(onlineId, token) {
  console.log("\nTesting DELETE /api/maps/:id forbidden for another user...");
  const response = await fetch(`${BASE_URL}/api/maps/${onlineId}`, {
    method: "DELETE",
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
  const data = await response.json();
  console.log("ok Forbidden delete rejected:", data);
  return response.status === 403;
}

async function testDeleteMap(onlineId, token) {
  console.log("\nTesting DELETE /api/maps/:id...");
  const response = await fetch(`${BASE_URL}/api/maps/${onlineId}`, {
    method: "DELETE",
    headers: authHeaders(token),
    body: JSON.stringify({ clientId: "test-client-123" }),
  });

  const data = await response.json();
  console.log("ok Delete map:", data);
  return data.ok === true;
}

async function main() {
  console.log("=== MiniBlox Server Smoke Test ===\n");
  console.log(`Server URL: ${BASE_URL}\n`);

  try {
    const healthOk = await testHealth();
    if (!healthOk) throw new Error("Health check failed");

    const suffix = Date.now().toString(36);
    const ownerToken = await registerUser(`owner_${suffix}`);
    const otherToken = await registerUser(`other_${suffix}`);
    if (!ownerToken || !otherToken) throw new Error("Auth register failed");
    if (!(await testMe(ownerToken))) throw new Error("Auth me failed");
    if (!(await testUnauthorizedPublish()))
      throw new Error("Unauthenticated publish was not rejected");

    const onlineId = await testPublishMap(ownerToken);
    if (!onlineId) throw new Error("Publish map failed");

    const invalidScaleRejected = await testInvalidPublishMap("scale", ownerToken, (map) => {
      map.objects[0].scale = { x: 100000, y: 1, z: 1 };
    });
    const invalidDamageRejected = await testInvalidPublishMap("damage", ownerToken, (map) => {
      map.objects[0].type = "enemy";
      map.objects[0].properties = { health: 100, damage: 9999, speed: 1 };
    });
    const suspiciousFieldRejected = await testInvalidPublishMap(
      "suspicious-field",
      ownerToken,
      (map) => {
        map.objects[0].properties = { outerHTML: "<script>alert(1)</script>" };
      }
    );

    if (!invalidScaleRejected || !invalidDamageRejected || !suspiciousFieldRejected) {
      throw new Error("Invalid publish validation failed");
    }

    if (!(await testListMaps())) throw new Error("List maps failed");
    if (!(await testGetMap(onlineId))) throw new Error("Get map failed");
    if (!(await testRegisterPlay(onlineId))) throw new Error("Register play failed");
    if (!(await testLikeMap(onlineId, ownerToken))) throw new Error("Like map failed");
    if (!(await testForbiddenUpdate(onlineId, otherToken)))
      throw new Error("Forbidden update failed");
    if (!(await testUpdateMap(onlineId, ownerToken))) throw new Error("Update map failed");
    if (!(await testForbiddenDelete(onlineId, otherToken)))
      throw new Error("Forbidden delete failed");
    if (!(await testDeleteMap(onlineId, ownerToken))) throw new Error("Delete map failed");

    console.log("\n=== All tests passed! ===");
  } catch (error) {
    console.error("\nTest failed with error:", error.message);
    process.exit(1);
  }
}

main();
