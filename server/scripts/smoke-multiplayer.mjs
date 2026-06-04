import { createServer } from "node:http";
import { WebSocket } from "ws";
import { createApp } from "../dist/app.js";
import { MultiplayerServer } from "../dist/multiplayer/MultiplayerServer.js";
import { RoomManager } from "../dist/multiplayer/RoomManager.js";

const OWNER_CLIENT_ID = "smoke-owner-client";
const CLOSE_TIMEOUT_MS = 2500;
const ENEMY_OBJECT_ID = "enemy-smoke-1";
const COIN_OBJECT_ID = "coin-smoke-1";

async function main() {
  console.log("=== MiniBlox Multiplayer Smoke Test ===\n");

  const roomManager = new RoomManager(8, 1000);
  const app = createApp(roomManager);
  const httpServer = createServer(app);
  const multiplayerServer = new MultiplayerServer(httpServer, roomManager);
  const clients = [];
  let onlineId = null;

  await listen(httpServer);
  const { port } = httpServer.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const wsBaseUrl = `ws://127.0.0.1:${port}`;

  try {
    onlineId = await publishSmokeMap(baseUrl);
    console.log(`Published smoke map: ${onlineId}`);

    const roomId = await createRoom(baseUrl, onlineId);
    console.log(`Created room: ${roomId}`);

    const clientA = await connectClient(wsBaseUrl, roomId, "smoke-client-a", "Smoke A");
    clients.push(clientA);
    const welcomeA = await clientA.waitFor((message) => message.type === "welcome", "A welcome");
    await clientA.waitFor((message) => message.type === "enemyState", "A enemyState");
    await clientA.waitFor((message) => message.type === "roomState", "A roomState");
    console.log(`Client A joined as ${welcomeA.playerId}`);

    const clientB = await connectClient(wsBaseUrl, roomId, "smoke-client-b", "Smoke B");
    clients.push(clientB);
    const welcomeB = await clientB.waitFor((message) => message.type === "welcome", "B welcome");
    await clientB.waitFor(
      (message) => message.type === "roomState" && Object.keys(message.players).length === 2,
      "B roomState with two players"
    );
    console.log(`Client B joined as ${welcomeB.playerId}`);

    clientA.send({ type: "chatMessage", text: "hello from smoke" });
    await clientB.waitFor(
      (message) =>
        message.type === "chatMessage" &&
        message.message?.type === "player" &&
        message.message.text === "hello from smoke",
      "B chatMessage from A"
    );
    console.log("Chat message broadcast reached the other client");

    clientA.send({
      type: "playerState",
      position: { x: 0, y: 1, z: 0 },
      rotationY: 0,
      health: 100,
      equippedWeaponId: "basic_sword",
      score: 0,
    });
    clientB.send({
      type: "playerState",
      position: { x: 1, y: 1, z: 0 },
      rotationY: 0,
      health: 100,
      equippedWeaponId: "basic_sword",
      score: 0,
    });
    await clientB.waitFor(
      (message) => message.type === "playerUpdated" && message.playerId === welcomeA.playerId,
      "B playerUpdated from A"
    );

    clientA.send({
      type: "playerAttack",
      weaponId: "basic_sword",
      origin: { x: 0, y: 1, z: 0 },
      direction: { x: 1, y: 0, z: 0 },
      range: 2,
      damage: 25,
      targetPlayerId: welcomeB.playerId,
    });
    await clientB.waitFor(
      (message) =>
        message.type === "playerDamaged" &&
        message.targetPlayerId === welcomeB.playerId &&
        message.health === 75,
      "B playerDamaged from A"
    );
    console.log("PvP damage was validated and broadcast");

    clientA.send({
      type: "enemyHit",
      enemyObjectId: ENEMY_OBJECT_ID,
      damage: 60,
      weaponId: "basic_sword",
    });
    await clientB.waitFor(
      (message) => message.type === "enemyUpdated" && message.enemy?.objectId === ENEMY_OBJECT_ID,
      "B enemyUpdated from A"
    );
    await clientB.waitFor(
      (message) => message.type === "enemyDefeated" && message.enemyObjectId === ENEMY_OBJECT_ID,
      "B enemyDefeated from A"
    );
    console.log("Enemy damage and defeat were synchronized");

    clientA.send({
      type: "worldEvent",
      event: {
        type: "coinCollected",
        objectId: COIN_OBJECT_ID,
      },
    });
    await clientB.waitFor(
      (message) =>
        message.type === "worldEvent" &&
        message.event?.type === "coinCollected" &&
        message.event.objectId === COIN_OBJECT_ID,
      "B worldEvent coinCollected from A"
    );
    console.log("Valid world event broadcast reached the other client");

    clientA.send({
      type: "worldEvent",
      event: {
        type: "coinCollected",
        objectId: "missing-coin",
      },
    });
    clientA.send({
      type: "playerState",
      position: { x: 999999, y: 999999, z: 999999 },
      rotationY: 0,
      health: 100,
      equippedWeaponId: "basic_sword",
      score: 99999,
    });
    clientA.send({ type: "ping" });
    await clientA.waitFor((message) => message.type === "pong", "A pong after invalid events");
    console.log("Invalid world event and absurd player state did not crash the server");

    const clientC = await connectClient(wsBaseUrl, roomId, "smoke-client-c", "Smoke C");
    clients.push(clientC);
    await clientC.waitFor((message) => message.type === "welcome", "C welcome");
    await clientC.waitFor(
      (message) =>
        message.type === "enemyState" && message.enemies?.[ENEMY_OBJECT_ID]?.alive === false,
      "C enemyState with defeated enemy"
    );
    await clientC.waitFor(
      (message) =>
        message.type === "worldState" &&
        message.state?.collectedCoinObjectIds?.includes(COIN_OBJECT_ID),
      "C worldState with collected coin"
    );
    console.log("Late joiner received defeated enemy and shared world state");

    await clientA.close();
    await clientB.waitFor(
      (message) => message.type === "playerLeft" && message.playerId === welcomeA.playerId,
      "B playerLeft for A"
    );
    await clientB.waitFor(
      (message) => message.type === "hostChanged" && message.hostPlayerId === welcomeB.playerId,
      "B hostChanged after A left"
    );
    console.log("Host migration selected the next player");

    await clientB.close();
    await clientC.close();
    clients.length = 0;

    console.log("\n=== Multiplayer smoke passed ===");
  } finally {
    await Promise.allSettled(clients.map((client) => client.close()));
    if (onlineId) {
      await deleteSmokeMap(baseUrl, onlineId).catch(() => undefined);
    }
    await multiplayerServer.shutdown();
    roomManager.dispose();
    await closeHttpServer(httpServer);
  }
}

async function publishSmokeMap(baseUrl) {
  const response = await fetch(`${baseUrl}/api/maps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      map: createSmokeMap(),
      creatorName: "Smoke Creator",
      clientId: OWNER_CLIENT_ID,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to publish smoke map: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.ok || typeof data.onlineId !== "string") {
    throw new Error("Publish smoke map returned an invalid response.");
  }

  return data.onlineId;
}

async function deleteSmokeMap(baseUrl, onlineId) {
  await fetch(`${baseUrl}/api/maps/${onlineId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: OWNER_CLIENT_ID }),
  });
}

async function createRoom(baseUrl, onlineMapId) {
  const response = await fetch(`${baseUrl}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      onlineMapId,
      clientId: "smoke-client-a",
      playerName: "Smoke A",
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create room: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.ok || typeof data.roomId !== "string") {
    throw new Error("Create room returned an invalid response.");
  }

  return data.roomId;
}

function createSmokeMap() {
  return {
    version: 1,
    id: "smoke-multiplayer-map",
    name: "Smoke Multiplayer Map",
    authorId: "smoke",
    description: "Temporary map for multiplayer smoke tests",
    creatorName: "Smoke Creator",
    spawnPoint: { x: 0, y: 1, z: 0 },
    multiplayerSettings: {
      pvpEnabled: true,
      friendlyFire: false,
    },
    gameModeSettings: {
      mode: "freeplay",
      respawnDelay: 0.2,
      teamsEnabled: false,
      winCondition: { type: "none" },
    },
    visualSettings: { theme: "classic" },
    objects: [
      {
        id: "floor-smoke",
        type: "platform",
        position: { x: 0, y: 0, z: 0 },
        scale: { x: 12, y: 0.4, z: 12 },
        properties: { collision: true },
      },
      {
        id: COIN_OBJECT_ID,
        type: "coin",
        position: { x: 2, y: 1, z: 0 },
        properties: { value: 1 },
      },
      {
        id: ENEMY_OBJECT_ID,
        type: "enemy",
        position: { x: -2, y: 0.5, z: 0 },
        properties: {
          health: 50,
          damage: 8,
          speed: 1,
          detectionRange: 6,
          attackRange: 1.4,
          behavior: "idle",
          collision: false,
        },
      },
      {
        id: "door-smoke",
        type: "door",
        position: { x: 0, y: 1.8, z: -4 },
        properties: { doorId: "door-smoke", collision: true },
      },
      {
        id: "button-smoke",
        type: "button",
        position: { x: 0, y: 0.5, z: 3 },
        properties: { targetDoorId: "door-smoke", collision: false },
      },
      {
        id: "finish-smoke",
        type: "finish",
        position: { x: 0, y: 1, z: -5 },
        properties: { message: "done" },
      },
    ],
    objectives: [],
    logic: [],
    tags: ["smoke"],
  };
}

function connectClient(wsBaseUrl, roomId, clientId, playerName) {
  const ws = new WebSocket(
    `${wsBaseUrl}/ws?roomId=${encodeURIComponent(roomId)}&clientId=${encodeURIComponent(clientId)}`
  );
  const messages = [];
  const waiters = [];

  ws.on("message", (data) => {
    const message = JSON.parse(data.toString());
    messages.push(message);

    for (const waiter of [...waiters]) {
      if (waiter.predicate(message)) {
        waiters.splice(waiters.indexOf(waiter), 1);
        clearTimeout(waiter.timeoutId);
        waiter.resolve(message);
      }
    }
  });

  const client = {
    ws,
    send(message) {
      ws.send(JSON.stringify(message));
    },
    waitFor(predicate, label) {
      const existingIndex = messages.findIndex(predicate);
      if (existingIndex >= 0) {
        const [message] = messages.splice(existingIndex, 1);
        return Promise.resolve(message);
      }

      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          const index = waiters.findIndex((waiter) => waiter.resolve === resolve);
          if (index >= 0) {
            waiters.splice(index, 1);
          }
          reject(new Error(`Timed out waiting for ${label}`));
        }, 5000);

        waiters.push({ predicate, resolve, timeoutId });
      });
    },
    close() {
      return closeWebSocket(ws);
    },
  };

  return waitForOpen(ws).then(() => {
    client.send({ type: "join", playerName });
    return client;
  });
}

function waitForOpen(ws) {
  if (ws.readyState === WebSocket.OPEN) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error("Timed out waiting for WebSocket open."));
    }, 5000);

    ws.once("open", () => {
      clearTimeout(timeoutId);
      resolve();
    });
    ws.once("error", (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });
  });
}

function closeWebSocket(ws) {
  if (ws.readyState === WebSocket.CLOSED) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timeoutId = setTimeout(resolve, CLOSE_TIMEOUT_MS);
    ws.once("close", () => {
      clearTimeout(timeoutId);
      resolve();
    });

    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close(1000, "smoke complete");
    }
  });
}

function listen(httpServer) {
  return new Promise((resolve) => {
    httpServer.listen(0, "127.0.0.1", resolve);
  });
}

function closeHttpServer(httpServer) {
  return new Promise((resolve, reject) => {
    httpServer.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

main().catch((error) => {
  console.error("\nMultiplayer smoke failed:", error);
  process.exitCode = 1;
});
