import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inflateSync } from "node:zlib";

const DEBUG_PORT = 9223;
const APP_URL = "http://127.0.0.1:5173/";

async function main() {
  const userDataDir = join(tmpdir(), `mini-blox-edge-${Date.now()}`);

  await mkdir(userDataDir, { recursive: true });

  const browserPath = resolveBrowserPath();
  const browser = spawn(
    browserPath,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${userDataDir}`,
      "about:blank",
    ],
    {
      stdio: "ignore",
      windowsHide: true,
    }
  );

  try {
    const version = await waitForVersion();
    const client = new CdpClient(version.webSocketDebuggerUrl);
    await client.open();

    const desktop = await inspectViewport(client, 1440, 900, false, "desktop");
    const mobile = await inspectViewport(client, 390, 844, true, "mobile");

    await client.close();
    console.log(JSON.stringify({ desktop, mobile }, null, 2));
  } finally {
    await stopBrowser(browser);
    await rmWithRetry(userDataDir);
  }
}

function resolveBrowserPath() {
  const configuredPath = process.env.MINIBLOX_BROWSER_PATH ?? process.env.BROWSER_PATH;
  if (configuredPath && existsSync(configuredPath)) {
    return configuredPath;
  }

  const candidates =
    process.platform === "win32"
      ? [
          "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
          "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
          "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
          "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        ]
      : process.platform === "darwin"
        ? [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
          ]
        : [
            "/usr/bin/google-chrome-stable",
            "/usr/bin/google-chrome",
            "/usr/bin/chromium-browser",
            "/usr/bin/chromium",
          ];

  const browserPath = candidates.find((candidate) => existsSync(candidate));
  if (!browserPath) {
    throw new Error(
      "No Chromium-based browser found. Set MINIBLOX_BROWSER_PATH to run verify-render."
    );
  }

  return browserPath;
}

async function inspectViewport(client, width, height, mobile, name) {
  const { targetId } = await client.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await client.send("Target.attachToTarget", {
    targetId,
    flatten: true,
  });

  await client.send("Page.enable", {}, sessionId);
  await client.send("Runtime.enable", {}, sessionId);
  await client.send(
    "Emulation.setDeviceMetricsOverride",
    {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
    },
    sessionId
  );
  await client.send("Page.navigate", { url: APP_URL }, sessionId);
  await wait(1200);
  await client.send(
    "Runtime.evaluate",
    {
      expression: `document.querySelector('[data-action="create"]')?.click()`,
    },
    sessionId
  );
  await wait(1200);

  const rect = await evaluateJson(
    client,
    sessionId,
    `(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return null;
    const r = canvas.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  })()`
  );

  const errors = await evaluateJson(
    client,
    sessionId,
    `(() => {
    return window.__miniBloxErrors ?? [];
  })()`
  );

  if (!rect || rect.width < 20 || rect.height < 20) {
    throw new Error(`Canvas is not visible in ${name} viewport.`);
  }

  const { data } = await client.send(
    "Page.captureScreenshot",
    {
      format: "png",
      clip: {
        x: Math.max(0, rect.x),
        y: Math.max(0, rect.y),
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
        scale: 1,
      },
    },
    sessionId
  );

  const image = parsePng(Buffer.from(data, "base64"));
  const pixelSummary = summarizePixels(image);
  await writeFile(join("dist", `verify-${name}.png`), Buffer.from(data, "base64"));

  await client.send("Target.closeTarget", { targetId });

  return {
    viewport: `${width}x${height}`,
    canvas: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
    uniqueSampleColors: pixelSummary.uniqueSampleColors,
    nonBlankSamples: pixelSummary.nonBlankSamples,
    errors,
  };
}

function summarizePixels(image) {
  const samples = new Set();
  let nonBlankSamples = 0;

  for (let y = 0; y < image.height; y += Math.max(1, Math.floor(image.height / 28))) {
    for (let x = 0; x < image.width; x += Math.max(1, Math.floor(image.width / 28))) {
      const index = (y * image.width + x) * image.channels;
      const r = image.pixels[index];
      const g = image.channels === 1 ? r : image.pixels[index + 1];
      const b = image.channels === 1 ? r : image.pixels[index + 2];

      samples.add(`${r},${g},${b}`);

      if (!(r > 245 && g > 245 && b > 245) && !(r < 8 && g < 8 && b < 8)) {
        nonBlankSamples += 1;
      }
    }
  }

  return {
    uniqueSampleColors: samples.size,
    nonBlankSamples,
  };
}

function parsePng(buffer) {
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  let bitDepth = 0;
  const idat = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;

    if (type === "IHDR") {
      width = buffer.readUInt32BE(dataStart);
      height = buffer.readUInt32BE(dataStart + 4);
      bitDepth = buffer[dataStart + 8];
      colorType = buffer[dataStart + 9];
    } else if (type === "IDAT") {
      idat.push(buffer.subarray(dataStart, dataEnd));
    } else if (type === "IEND") {
      break;
    }

    offset = dataEnd + 4;
  }

  const channels = colorType === 0 ? 1 : colorType === 2 ? 3 : colorType === 6 ? 4 : 0;

  if (bitDepth !== 8 || channels === 0) {
    throw new Error(`Unsupported PNG bitDepth=${bitDepth} colorType=${colorType}`);
  }

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(width * height * channels);
  let rawOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = raw[rawOffset++];
    const rowStart = y * stride;

    for (let x = 0; x < stride; x += 1) {
      const current = raw[rawOffset++];
      const left = x >= channels ? pixels[rowStart + x - channels] : 0;
      const up = y > 0 ? pixels[rowStart - stride + x] : 0;
      const upLeft = y > 0 && x >= channels ? pixels[rowStart - stride + x - channels] : 0;
      let value = current;

      if (filter === 1) {
        value = current + left;
      } else if (filter === 2) {
        value = current + up;
      } else if (filter === 3) {
        value = current + Math.floor((left + up) / 2);
      } else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        value = current + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft);
      } else if (filter !== 0) {
        throw new Error(`Unsupported PNG filter ${filter}`);
      }

      pixels[rowStart + x] = value & 255;
    }
  }

  return { width, height, channels, pixels };
}

async function evaluateJson(client, sessionId, expression) {
  const result = await client.send(
    "Runtime.evaluate",
    {
      expression: `JSON.stringify(${expression})`,
      returnByValue: true,
    },
    sessionId
  );

  return JSON.parse(result.result.value);
}

async function waitForVersion() {
  for (let index = 0; index < 80; index += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);

      if (response.ok) {
        return response.json();
      }
    } catch {
      await wait(100);
    }
  }

  throw new Error("Timed out waiting for Edge remote debugging.");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function stopBrowser(browserProcess) {
  if (browserProcess.exitCode !== null) {
    return;
  }

  await new Promise((resolve) => {
    browserProcess.once("exit", resolve);
    browserProcess.kill();
    setTimeout(resolve, 1000);
  });
}

async function rmWithRetry(path) {
  for (let index = 0; index < 6; index += 1) {
    try {
      await rm(path, { recursive: true, force: true });
      return;
    } catch (error) {
      if (error.code !== "EBUSY" && error.code !== "EPERM") {
        throw error;
      }

      await wait(250);
    }
  }
}

class CdpClient {
  nextId = 1;
  pending = new Map();

  constructor(url) {
    this.url = url;
  }

  open() {
    return new Promise((resolve, reject) => {
      this.socket = new WebSocket(this.url);
      this.socket.addEventListener("open", () => resolve());
      this.socket.addEventListener("error", reject);
      this.socket.addEventListener("message", (event) => this.handleMessage(event));
    });
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    const payload = { id, method, params };

    if (sessionId) {
      payload.sessionId = sessionId;
    }

    this.socket.send(JSON.stringify(payload));

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  handleMessage(event) {
    const message = JSON.parse(event.data);

    if (!message.id) {
      return;
    }

    const pending = this.pending.get(message.id);

    if (!pending) {
      return;
    }

    this.pending.delete(message.id);

    if (message.error) {
      pending.reject(new Error(message.error.message));
    } else {
      pending.resolve(message.result);
    }
  }

  close() {
    this.socket.close();
  }
}

await main();
