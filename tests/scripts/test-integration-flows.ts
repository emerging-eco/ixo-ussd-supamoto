#!/usr/bin/env node
/**
 * Integration Flow Test Runner
 *
 * Starts the server, waits for it to be ready, runs all flow tests,
 * then shuts down the server.
 *
 * Usage: pnpm test:integration:flows
 */
import { spawn, ChildProcess } from "child_process";
import { setTimeout as delay } from "timers/promises";

const SERVER_URL =
  process.env.USSD_TEST_SERVER_URL || "http://127.0.0.1:3005/api/ussd";
const MAX_STARTUP_WAIT_MS = 30000;
const HEALTH_CHECK_INTERVAL_MS = 1000;

async function waitForServer(): Promise<boolean> {
  const startTime = Date.now();
  console.log(`⏳ Waiting for server at ${SERVER_URL}...`);

  while (Date.now() - startTime < MAX_STARTUP_WAIT_MS) {
    try {
      const response = await fetch(SERVER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "health-check",
          serviceCode: "*2233#",
          phoneNumber: "+260000000000",
          text: "",
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        console.log("✅ Server is ready");
        return true;
      }
    } catch {
      // Server not ready yet
    }

    await delay(HEALTH_CHECK_INTERVAL_MS);
  }

  console.error("❌ Server failed to start within timeout");
  return false;
}

function startServer(): ChildProcess {
  console.log("🚀 Starting USSD server...");

  const server = spawn("pnpm", ["dev"], {
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
    env: { ...process.env, NODE_ENV: "dev" },
  });

  server.stdout?.on("data", (data: Buffer) => {
    const line = data.toString().trim();
    if (line) console.log(`[server] ${line}`);
  });

  server.stderr?.on("data", (data: Buffer) => {
    const line = data.toString().trim();
    if (line) console.error(`[server:err] ${line}`);
  });

  return server;
}

async function runFlowTests(): Promise<number> {
  console.log("🧪 Running flow tests...\n");

  return new Promise((resolve) => {
    const testProcess = spawn(
      "pnpm",
      ["vitest", "run", "--config", "vitest.flows.config.ts"],
      {
        stdio: "inherit",
        shell: true,
        env: {
          ...process.env,
          USSD_TEST_SERVER_URL: SERVER_URL,
        },
      }
    );

    testProcess.on("close", (code) => {
      resolve(code ?? 1);
    });
  });
}

async function main(): Promise<void> {
  let server: ChildProcess | null = null;
  let exitCode = 1;

  try {
    server = startServer();

    const serverReady = await waitForServer();
    if (!serverReady) {
      process.exit(1);
    }

    exitCode = await runFlowTests();
  } catch (error) {
    console.error("❌ Error running integration tests:", error);
    exitCode = 1;
  } finally {
    if (server) {
      console.log("\n🛑 Stopping server...");
      server.kill("SIGTERM");

      // Give it a moment to clean up
      await delay(1000);

      if (!server.killed) {
        server.kill("SIGKILL");
      }
    }
  }

  process.exit(exitCode);
}

main();
