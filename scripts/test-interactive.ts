/* eslint-disable no-console */

/**
 * Interactive USSD Test for State Machine Architecture
 *
 * Usage:
 * 1. Run the server: `pnpm dev`
 * 2. Run this script: `pnpm tsx src/test/interactive/interactive.ts`
 *
 * This script provides an interactive USSD testing interface
 * using the simplified session service on port 3000.
 */

import readline from "readline";

// --- Setup ---

const SERVER_URL = "http://127.0.0.1:3005/api/ussd"; //localhost
// const SERVER_URL =
// "https://ixo-ussd-supamoto-development.up.railway.app/api/ussd"; //development
const sessionId = `interactive-test-${Date.now()}`;
const phoneNumber = "+260971230001"; // Zambian number
const serviceCode = "*2233#"; //*384*46361#	// Zambia

// Create an interface for reading from the command line
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Handle process termination gracefully
process.on("SIGINT", () => {
  console.log("\n\n👋 Goodbye!");
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

function askQuestion(prompt: string) {
  rl.question(prompt, async input => {
    if (input.toLowerCase() === "exit" || input.toLowerCase() === "quit") {
      console.log("👋 Exiting simple interactive test.");
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
        rl.close();
      } else {
        askQuestion(
          "Enter your choice (or 'debug' for session info, 'exit' to quit): "
        );
      }
    } catch (error) {
      console.error("\n❌ Error sending request:", error);
      rl.close();
    }
  });
}

async function main() {
  console.log("🚀 Simple Interactive USSD Test");
  console.log("================================");
  console.log(`📱 Phone: ${phoneNumber}`);
  console.log(`🔢 Service Code: ${serviceCode}`);
  console.log(`🆔 Session ID: ${sessionId}`);
  console.log("");
  console.log("Commands:");
  console.log("  - Type numbers to navigate menus");
  console.log("  - Type 'debug' to see session state");
  console.log("  - Type 'exit' or 'quit' to stop");
  console.log("");

  try {
    // Start the conversation with an empty text field (simulates dialing *2233#)
    console.log("📞 Dialing *2233#...\n");
    const initialResponse = await sendRequest(sessionId, "");
    console.log(`${initialResponse}\n`);

    askQuestion(
      "Enter your choice (or 'debug' for session info, 'exit' to quit): "
    );
  } catch (error) {
    console.error("❌ Error starting session:", error);
    rl.close();
  }
}

main();
