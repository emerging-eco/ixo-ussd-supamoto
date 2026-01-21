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
const HEALTH_URL = SERVER_URL.replace("/api/ussd", "/api/health");
const MAX_STARTUP_WAIT_MS = 30000;
const HEALTH_CHECK_INTERVAL_MS = 1000;

async function waitForServer(): Promise<boolean> {
  const startTime = Date.now();
  console.log(`⏳ Waiting for server at ${HEALTH_URL}...`);

  while (Date.now() - startTime < MAX_STARTUP_WAIT_MS) {
    try {
      const response = await fetch(HEALTH_URL, {
        method: "GET",
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
    if (server && server.pid) {
      console.log("\n🛑 Stopping server...");

      // Kill the entire process group to ensure child processes are terminated
      // Using negative PID kills the process group on Unix systems
      try {
        process.kill(-server.pid, "SIGTERM");
      } catch {
        // Process group kill not supported or already dead, try direct kill
        server.kill("SIGTERM");
      }

      // Wait for graceful shutdown, then force kill if still running
      const killTimeout = 3000;
      const startTime = Date.now();

      while (Date.now() - startTime < killTimeout) {
        try {
          // Check if process is still running (signal 0 doesn't kill, just checks)
          process.kill(server.pid, 0);
          await delay(100);
        } catch {
          // Process no longer exists
          break;
        }
      }

      // Force kill if still running
      try {
        process.kill(-server.pid, "SIGKILL");
      } catch {
        // Already dead or process group not supported
        try {
          server.kill("SIGKILL");
        } catch {
          // Already dead
        }
      }
    }
  }

  process.exit(exitCode);
}

main();
