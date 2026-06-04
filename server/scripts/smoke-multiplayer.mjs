import { createServer } from "node:http";
import { WebSocket } from "ws";
import { createApp } from "../dist/app.js";
import { MultiplayerServer } from "../dist/multiplayer/MultiplayerServer.js";
import { RoomManager } from "../dist/multiplayer/RoomManager.js";

const ONLINE_MAP_ID = "smoke-online-map";
const CLOSE_TIMEOUT_MS = 2500;

async function main() {
  console.log("=== MiniBlox Multiplayer Smoke Test ===\n");

  const roomManager = new RoomManager(8, 1000);
  const app = createApp(roomManager);
  const httpServer = createServer(app);
  const multiplayerServer = new MultiplayerServer(httpServer, roomManager);
  const clients = [];

  await listen(httpServer);
  const { port } = httpServer.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const wsBaseUrl = `ws://127.0.0.1:${port}`;

  try {
    const roomId = await createRoom(baseUrl);
    console.log(`Created room: ${roomId}`);

    const clientA = await connectClient(wsBaseUrl, roomId, "smoke-client-a", "Smoke A");
    clients.push(clientA);
    const welcomeA = await clientA.waitFor((message) => message.type === "welcome", "A welcome");
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

    clientA.send({
      type: "playerState",
      position: { x: 4, y: 2, z: -3 },
      rotationY: 1.25,
      health: 87,
      equippedWeaponId: null,
      score: 12,
    });

    await clientB.waitFor(
      (message) => message.type === "playerUpdated" && message.playerId === welcomeA.playerId,
      "B playerUpdated from A"
    );
    console.log("Player state broadcast reached the other client");

    const collectedCoinObjectId = "coin-smoke-1";
    clientA.send({
      type: "worldEvent",
      event: {
        type: "coinCollected",
        objectId: collectedCoinObjectId,
      },
    });

    await clientB.waitFor(
      (message) =>
        message.type === "worldEvent" &&
        message.event?.type === "coinCollected" &&
        message.event.objectId === collectedCoinObjectId,
      "B worldEvent coinCollected from A"
    );
    console.log("World event broadcast reached the other client");

    const clientC = await connectClient(wsBaseUrl, roomId, "smoke-client-c", "Smoke C");
    clients.push(clientC);
    const welcomeC = await clientC.waitFor((message) => message.type === "welcome", "C welcome");
    await clientC.waitFor(
      (message) => message.type === "roomState" && Object.keys(message.players).length === 3,
      "C roomState with three players"
    );
    await clientC.waitFor(
      (message) =>
        message.type === "worldState" &&
        message.state?.collectedCoinObjectIds?.includes(collectedCoinObjectId),
      "C worldState with collected coin"
    );
    console.log(`Client C joined as ${welcomeC.playerId} and received shared world state`);

    await clientA.close();
    await clientB.waitFor(
      (message) => message.type === "playerLeft" && message.playerId === welcomeA.playerId,
      "B playerLeft for A"
    );
    console.log("Disconnect broadcast reached the remaining client");

    await clientB.close();
    await clientC.close();
    clients.length = 0;

    console.log("\n=== Multiplayer smoke passed ===");
  } finally {
    await Promise.allSettled(clients.map((client) => client.close()));
    await multiplayerServer.shutdown();
    roomManager.dispose();
    await closeHttpServer(httpServer);
  }
}

async function createRoom(baseUrl) {
  const response = await fetch(`${baseUrl}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      onlineMapId: ONLINE_MAP_ID,
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
