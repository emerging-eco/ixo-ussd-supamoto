/**
 * Interactive USSD Test for State Machine Architecture
 *
 * Usage:
 * 1. Run the server: `pnpm dev`
 * 2. Run this script: `pnpm test:interactive`
 *
 * This script provides an interactive USSD testing interface
 * using the simplified session service on port 3005.
 *
 * Features:
 * - Real-time USSD session simulation
 * - Debug command to inspect session state
 * - Automatic session logging to logs/sessions/ directory
 * - Timestamped log files with session metadata
 * - Captures both user input and server responses
 * - Complete session replay capability from log files
 */

import readline from "readline";
import fs from "fs";
import path from "path";

// ============================================================================
// SESSION LOGGER CLASS
// ============================================================================

/**
 * SessionLogger captures all console output and user input to a timestamped log file
 * while maintaining real-time terminal display.
 *
 * Features:
 * - Captures console.log, console.error, console.warn output
 * - Logs user input with "USER INPUT:" prefix
 * - Timestamps all entries with ISO 8601 format
 * - Writes session metadata at start and end
 * - Graceful error handling (logging failures don't crash session)
 */
class SessionLogger {
  private logStream: fs.WriteStream;
  private logFilePath: string;
  private originalConsoleLog: typeof console.log;
  private originalConsoleError: typeof console.error;
  private originalConsoleWarn: typeof console.warn;

  constructor(sessionId: string, phoneNumber: string, serviceCode: string) {
    // Create sessions directory
    const sessionsDir = path.join(process.cwd(), "sessions");
    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
    }

    // Generate timestamped filename: session-YYYY-MM-DD-HH-mm-ss.log
    const timestamp = new Date()
      .toISOString()
      .replace(/T/, "-")
      .replace(/:/g, "-")
      .slice(0, 19); // YYYY-MM-DD-HH-mm-ss

    this.logFilePath = path.join(sessionsDir, `session-${timestamp}.log`);

    // Create write stream
    this.logStream = fs.createWriteStream(this.logFilePath, {
      flags: "a", // append mode
      encoding: "utf8",
    });

    // Store original console methods
    this.originalConsoleLog = console.log;
    this.originalConsoleError = console.error;
    this.originalConsoleWarn = console.warn;

    // Write session metadata
    this.writeMetadata(sessionId, phoneNumber, serviceCode);
  }

  private writeMetadata(
    sessionId: string,
    phoneNumber: string,
    serviceCode: string
  ): void {
    const metadata = {
      sessionId,
      phoneNumber,
      serviceCode,
      startTime: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      environment: process.env.NODE_ENV || "development",
    };

    this.writeToLog("=".repeat(80) + "\n");
    this.writeToLog("USSD INTERACTIVE TEST SESSION LOG\n");
    this.writeToLog("=".repeat(80) + "\n");
    this.writeToLog(JSON.stringify(metadata, null, 2) + "\n");
    this.writeToLog("=".repeat(80) + "\n\n");
  }

  private writeToLog(message: string): void {
    try {
      this.logStream.write(message);
    } catch (error) {
      // Fail silently to console, don't crash the session
      this.originalConsoleError(
        "⚠️  Failed to write to log file:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Log user input to the session log file
   * @param input - The user's input string
   */
  logUserInput(input: string): void {
    const timestamp = new Date().toISOString();
    this.writeToLog(`[${timestamp}] USER INPUT: ${input}\n`);
  }

  start(): void {
    // Intercept console.log
    console.log = (...args: any[]) => {
      const message = args
        .map(arg =>
          typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
        )
        .join(" ");

      // Write to file with timestamp
      const timestamp = new Date().toISOString();
      this.writeToLog(`[${timestamp}] ${message}\n`);

      // Also display in terminal
      this.originalConsoleLog(...args);
    };

    // Intercept console.error
    console.error = (...args: any[]) => {
      const message = args
        .map(arg =>
          typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
        )
        .join(" ");

      // Write to file with timestamp and ERROR prefix
      const timestamp = new Date().toISOString();
      this.writeToLog(`[${timestamp}] ERROR: ${message}\n`);

      // Also display in terminal
      this.originalConsoleError(...args);
    };

    // Intercept console.warn
    console.warn = (...args: any[]) => {
      const message = args
        .map(arg =>
          typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
        )
        .join(" ");

      // Write to file with timestamp and WARN prefix
      const timestamp = new Date().toISOString();
      this.writeToLog(`[${timestamp}] WARN: ${message}\n`);

      // Also display in terminal
      this.originalConsoleWarn(...args);
    };
  }

  stop(): void {
    // Restore original console methods
    console.log = this.originalConsoleLog;
    console.error = this.originalConsoleError;
    console.warn = this.originalConsoleWarn;

    // Write session end metadata
    const endMetadata = {
      endTime: new Date().toISOString(),
      status: "completed",
    };

    this.writeToLog("\n" + "=".repeat(80) + "\n");
    this.writeToLog("SESSION ENDED\n");
    this.writeToLog(JSON.stringify(endMetadata, null, 2) + "\n");
    this.writeToLog("=".repeat(80) + "\n");

    // Close the stream
    this.logStream.end();
  }

  getLogFilePath(): string {
    return this.logFilePath;
  }
}

// ============================================================================
// SETUP
// ============================================================================

const SERVER_URL =
  // "http://127.0.0.1:3000/api/ussd"; //localhost
  // "https://ixo-ussd-supamoto-development.up.railway.app/api/ussd"; //development
  // "https://ixo-ussd-supamoto-stage.up.railway.app/api/ussd";       //stage
  // "https://ussd-supamoto.devnet.ixo.earth/api/ussd";       //k8s-dev
  "https://ussd-supamoto.testnet.ixo.earth/api/ussd"; //k8s-stage
const sessionId = `interactive-test-${Date.now()}`;
const phoneNumber = "+260971232222"; // Zambian number
const serviceCode = "*2233#"; //*384*46361#	// Zambia

// Session logger instance (initialized in main)
let sessionLogger: SessionLogger | null = null;

// Create an interface for reading from the command line
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Handle process termination gracefully
process.on("SIGINT", () => {
  console.log("\n\n👋 Goodbye!");
  if (sessionLogger) {
    sessionLogger.stop();
  }
  process.exit(0);
});

async function sendRequest(sessionId: string, text: string): Promise<string> {
  const response = await fetch(SERVER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "USSD-Interactive-Test/1.0 (Node.js)",
    },
    body: JSON.stringify({
      sessionId,
      serviceCode,
      phoneNumber,
      text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Server returned an error: ${response.status} ${errorText}`
    );
  }

  return response.text();
}

function promptForTestGeneration() {
  rl.question(
    "\n💡 Would you like to generate a test from this session? (y/n): ",
    answer => {
      if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
        rl.question(
          "Enter a name for this flow (e.g., login-flow): ",
          flowName => {
            if (flowName && flowName.trim().length > 0) {
              const logPath = sessionLogger?.getLogFilePath();
              console.log("\n📝 To generate the test, run:");
              console.log(
                `   pnpm generate:test ${logPath} ${flowName.trim()}\n`
              );
            } else {
              console.log(
                "\n⚠️  Flow name cannot be empty. Skipping test generation.\n"
              );
            }
            rl.close();
          }
        );
      } else {
        console.log("\n👍 Skipping test generation.\n");
        rl.close();
      }
    }
  );
}

function askQuestion(prompt: string) {
  rl.question(prompt, async input => {
    // Log user input to session log file
    if (sessionLogger) {
      sessionLogger.logUserInput(input);
    }

    if (input.toLowerCase() === "exit" || input.toLowerCase() === "quit") {
      console.log("👋 Exiting simple interactive test.");
      if (sessionLogger) {
        console.log(
          `📁 Session log saved to: ${sessionLogger.getLogFilePath()}`
        );
        sessionLogger.stop();
      }
      rl.close();
      return;
    }

    if (input.toLowerCase() === "debug") {
      try {
        const debugResponse = await fetch(`${SERVER_URL}/debug/${sessionId}`);
        const debugData = await debugResponse.json();
        console.log("\n🔍 Debug Info:");
        console.log(JSON.stringify(debugData, null, 2));
        askQuestion(
          "\nEnter your choice (or 'debug' for session info, 'exit' to quit): "
        );
      } catch (error) {
        console.error("❌ Debug error:", error);
        askQuestion(
          "\nEnter your choice (or 'debug' for session info, 'exit' to quit): "
        );
      }
      return;
    }

    try {
      const response = await sendRequest(sessionId, input);
      console.log(`\n${response}\n`);

      if (response.startsWith("END")) {
        console.log("🏁 Session has ended.");
        if (sessionLogger) {
          console.log(
            `📁 Session log saved to: ${sessionLogger.getLogFilePath()}`
          );
          sessionLogger.stop();
        }
        // Prompt for test generation
        promptForTestGeneration();
      } else {
        askQuestion(
          "Enter your choice (or 'debug' for session info, 'exit' to quit): "
        );
      }
    } catch (error) {
      console.error("\n❌ Error sending request:", error);
      if (sessionLogger) {
        console.log(
          `📁 Session log saved to: ${sessionLogger.getLogFilePath()}`
        );
        sessionLogger.stop();
      }
      rl.close();
    }
  });
}

async function main() {
  // Initialize session logger
  sessionLogger = new SessionLogger(sessionId, phoneNumber, serviceCode);

  try {
    // Start logging (intercepts console methods)
    sessionLogger.start();

    console.log("🚀 Simple Interactive USSD Test");
    console.log("================================");
    console.log(`📱 Phone: ${phoneNumber}`);
    console.log(`🔢 Service Code: ${serviceCode}`);
    console.log(`🆔 Session ID: ${sessionId}`);
    console.log(`📝 Session log: ${sessionLogger.getLogFilePath()}`);
    console.log(`📱 Server URL: ${SERVER_URL}`);
    console.log("");
    console.log("Commands:");
    console.log("  - Type numbers to navigate menus");
    console.log("  - Type 'debug' to see session state");
    console.log("  - Type 'exit' or 'quit' to stop");
    console.log("");

    // Start the conversation with an empty text field (simulates dialing *2233#)
    console.log("📞 Dialing *2233#...\n");
    const initialResponse = await sendRequest(sessionId, "");
    console.log(`${initialResponse}\n`);

    askQuestion(
      "Enter your choice (or 'debug' for session info, 'exit' to quit): "
    );
  } catch (error) {
    console.error("❌ Error starting session:", error);
    if (sessionLogger) {
      console.log(`📁 Session log saved to: ${sessionLogger.getLogFilePath()}`);
      sessionLogger.stop();
    }
    rl.close();
  }
}

main();
