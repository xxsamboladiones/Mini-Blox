const BASE_URL = "http://localhost:3001";

async function testHealth() {
  console.log("Testing GET /health...");
  const response = await fetch(`${BASE_URL}/health`);
  const data = await response.json();
  console.log("✓ Health check:", data);
  return data.ok === true;
}

async function testPublishMap() {
  console.log("\nTesting POST /api/maps...");
  const testMap = {
    map: {
      id: "test-map-123",
      name: "Test Map",
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
    },
    creatorName: "Test Creator",
    clientId: "test-client-123",
  };

  const response = await fetch(`${BASE_URL}/api/maps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(testMap),
  });

  const data = await response.json();
  console.log("✓ Publish map:", data);
  return data.ok === true ? data.onlineId : null;
}

async function testListMaps() {
  console.log("\nTesting GET /api/maps...");
  const response = await fetch(`${BASE_URL}/api/maps`);
  const data = await response.json();
  console.log(`✓ List maps: ${data.length} maps found`);
  return Array.isArray(data);
}

async function testInvalidPublishMap(label, mutateMap) {
  console.log(`\nTesting invalid POST /api/maps (${label})...`);
  const map = {
    id: `invalid-map-${label}`,
    name: `Invalid Map ${label}`,
    authorId: "test-author",
    description: "Invalid smoke map",
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

  mutateMap(map);

  const response = await fetch(`${BASE_URL}/api/maps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      map,
      creatorName: "Test Creator",
      clientId: "test-client-123",
    }),
  });

  const data = await response.json().catch(() => ({}));
  console.log(`âœ“ Invalid publish rejected (${label}):`, data);
  return response.status === 400 && data.ok === false;
}

async function testGetMap(onlineId) {
  console.log("\nTesting GET /api/maps/:id...");
  const response = await fetch(`${BASE_URL}/api/maps/${onlineId}`);
  const data = await response.json();
  console.log("✓ Get map:", data.name);
  return data.id === onlineId;
}

async function testRegisterPlay(onlineId) {
  console.log("\nTesting POST /api/maps/:id/play...");
  const response = await fetch(`${BASE_URL}/api/maps/${onlineId}/play`, {
    method: "POST",
  });
  const data = await response.json();
  console.log("✓ Register play:", data);
  return data.ok === true;
}

async function testLikeMap(onlineId) {
  console.log("\nTesting POST /api/maps/:id/like...");
  const response = await fetch(`${BASE_URL}/api/maps/${onlineId}/like`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: "test-client-123" }),
  });
  const data = await response.json();
  console.log("✓ Like map:", data);
  return data.liked === true;
}

async function testUpdateMap(onlineId) {
  console.log("\nTesting PUT /api/maps/:id...");
  const testMap = {
    map: {
      id: "test-map-123",
      name: "Test Map Updated",
      authorId: "test-author",
      description: "Updated test map",
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
    },
    clientId: "test-client-123",
  };

  const response = await fetch(`${BASE_URL}/api/maps/${onlineId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(testMap),
  });

  const data = await response.json();
  console.log("✓ Update map:", data);
  return data.ok === true;
}

async function testDeleteMap(onlineId) {
  console.log("\nTesting DELETE /api/maps/:id...");
  const response = await fetch(`${BASE_URL}/api/maps/${onlineId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: "test-client-123" }),
  });

  const data = await response.json();
  console.log("✓ Delete map:", data);
  return data.ok === true;
}

async function main() {
  console.log("=== MiniBlox Server Smoke Test ===\n");
  console.log(`Server URL: ${BASE_URL}\n`);

  try {
    const healthOk = await testHealth();
    if (!healthOk) {
      console.error("❌ Health check failed");
      process.exit(1);
    }

    const onlineId = await testPublishMap();
    if (!onlineId) {
      console.error("❌ Publish map failed");
      process.exit(1);
    }

    const invalidScaleRejected = await testInvalidPublishMap("scale", (map) => {
      map.objects[0].scale = { x: 100000, y: 1, z: 1 };
    });
    const invalidDamageRejected = await testInvalidPublishMap("damage", (map) => {
      map.objects[0].type = "enemy";
      map.objects[0].properties = { health: 100, damage: 9999, speed: 1 };
    });
    const suspiciousFieldRejected = await testInvalidPublishMap("suspicious-field", (map) => {
      map.objects[0].properties = { outerHTML: "<script>alert(1)</script>" };
    });

    if (!invalidScaleRejected || !invalidDamageRejected || !suspiciousFieldRejected) {
      console.error("âŒ Invalid publish validation failed");
      process.exit(1);
    }

    await testListMaps();
    await testGetMap(onlineId);
    await testRegisterPlay(onlineId);
    await testLikeMap(onlineId);
    await testUpdateMap(onlineId);
    await testDeleteMap(onlineId);

    console.log("\n=== All tests passed! ===");
  } catch (error) {
    console.error("\n❌ Test failed with error:", error.message);
    process.exit(1);
  }
}

main();
