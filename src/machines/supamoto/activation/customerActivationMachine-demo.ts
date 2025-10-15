/**
 * Customer Activation Machine - Interactive Demo
 *
 * This demo file allows you to test the customer activation flow interactively.
 *
 * Run with: pnpm tsx src/machines/supamoto/activation/customerActivationMachine-demo.ts
 */

import { createActor } from "xstate";
import { customerActivationMachine } from "./customerActivationMachine.js";
import * as readline from "readline";

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Helper to prompt for input
function prompt(question: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer);
    });
  });
}

// Create and start the actor
const actor = createActor(customerActivationMachine, {
  input: {
    sessionId: "demo-session-" + Date.now(),
    phoneNumber: "+260971234567",
    serviceCode: "*2233#",
    isLeadGenerator: true,
  },
});

// Subscribe to state changes
actor.subscribe(state => {
  console.log("\n" + "=".repeat(60));
  console.log("📍 Current State:", state.value);
  console.log("=".repeat(60));
  console.log("\n💬 Message:");
  console.log(state.context.message);
  console.log("\n" + "-".repeat(60));

  if (state.context.error) {
    console.log("❌ Error:", state.context.error);
  }

  // Show context for debugging
  console.log("\n🔍 Context:");
  console.log("  Customer ID:", state.context.customerId || "N/A");
  console.log("  Customer Phone:", state.context.customerPhone || "N/A");
  console.log("  Is Activated:", state.context.isActivated);
  console.log("  Is Eligible:", state.context.isEligible ?? "N/A");
  console.log("  Claim ID:", state.context.claimId || "N/A");
  console.log("-".repeat(60) + "\n");
});

// Start the machine
actor.start();

// Interactive loop
async function runDemo() {
  console.log("\n🚀 Customer Activation Machine - Interactive Demo");
  console.log("=".repeat(60));
  console.log(
    "\nThis demo simulates the customer activation and eligibility flow."
  );
  console.log("Follow the prompts to test the state machine.\n");
  console.log("Test Scenarios:");
  console.log("1. Lead Generator Flow:");
  console.log("   - Enter Customer ID: C12345678");
  console.log("   - Enter Phone: +260971234567");
  console.log("   - System sends SMS (stubbed)");
  console.log("\n2. Customer Activation Flow:");
  console.log("   - Enter 6-digit PIN (any 6 digits for demo)");
  console.log("   - Answer eligibility question (1=Yes, 2=No)");
  console.log("\nType 'exit' or 'quit' to end the demo.\n");
  console.log("=".repeat(60) + "\n");

  while (true) {
    const snapshot = actor.getSnapshot();

    // Check if machine is in final state
    if (snapshot.status === "done") {
      console.log("\n✅ Flow completed!");
      console.log("Final output:", snapshot.output);
      break;
    }

    // Get user input
    const input = await prompt("Enter your input: ");

    // Check for exit commands
    if (input.toLowerCase() === "exit" || input.toLowerCase() === "quit") {
      console.log("\n👋 Exiting demo...");
      break;
    }

    // Send input to machine
    if (input.trim()) {
      actor.send({ type: "INPUT", input: input.trim() });
    }
  }

  rl.close();
  actor.stop();
}

// Run the demo
runDemo().catch(error => {
  console.error("❌ Demo error:", error);
  rl.close();
  process.exit(1);
});
