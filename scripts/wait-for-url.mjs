#!/usr/bin/env node

const [, , url, timeoutArg = "30000"] = process.argv;
const timeoutMs = Number(timeoutArg);

if (!url || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  console.error("Usage: node scripts/wait-for-url.mjs <url> [timeoutMs]");
  process.exit(1);
}

const startedAt = Date.now();
let lastError = null;

while (Date.now() - startedAt < timeoutMs) {
  try {
    const response = await fetch(url);
    if (response.ok || response.status < 500) {
      console.log(`URL ready: ${url} (${response.status})`);
      process.exit(0);
    }
    lastError = new Error(`HTTP ${response.status}`);
  } catch (error) {
    lastError = error;
  }

  await sleep(500);
}

console.error(`Timed out waiting for ${url}`);
if (lastError) {
  console.error(lastError instanceof Error ? lastError.message : String(lastError));
}
process.exit(1);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
