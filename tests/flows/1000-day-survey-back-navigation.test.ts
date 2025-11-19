/**
 * Test: 1,000 Day Survey Back Navigation
 *
 * This test validates that pressing "0" (back) from the initial survey question
 * properly returns to the Agent Tools menu without triggering an error state.
 *
 * Bug Fix: Missing navigation guards (isBack, isExit) in thousandDaySurveyMachine
 *
 * Prerequisites:
 * 1. Start the USSD server: pnpm dev
 * 2. Server must be running at: http://127.0.0.1:3005/api/ussd (or set USSD_TEST_SERVER_URL)
 *
 * How to run:
 * - pnpm test:flows:run              # Run all flow tests
 * - pnpm test:flows                  # Run in watch mode
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";

// Test Configuration
const SERVER_URL =
  process.env.USSD_TEST_SERVER_URL || "http://127.0.0.1:3005/api/ussd";
// Dynamic session ID to prevent conflicts when running tests multiple times
const SESSION_ID = `flow-test-1000-day-survey-back-nav-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
const PHONE_NUMBER = "+260971230001";
const SERVICE_CODE = "*2233#";
const REQUEST_TIMEOUT = 5000; // 5 seconds

/**
 * Send a USSD request to the server
 */
async function sendUssdRequest(text: string): Promise<string> {
  const response = await fetch(SERVER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Vitest-Flow-Test/1.0",
    },
    body: JSON.stringify({
      sessionId: SESSION_ID,
      serviceCode: SERVICE_CODE,
      phoneNumber: PHONE_NUMBER,
      text,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Server returned error: ${response.status} ${errorText}`);
  }

  return response.text();
}

describe("1,000 Day Survey - Back Navigation Test", () => {
  beforeAll(() => {
    console.log("🚀 Starting 1,000 Day Survey back navigation test");
    console.log(`📡 Server: ${SERVER_URL}`);
    console.log(`📱 Phone: ${PHONE_NUMBER}`);
    console.log(`🔢 Service: ${SERVICE_CODE}`);
  });

  afterAll(() => {
    console.log("✅ 1,000 Day Survey back navigation test completed");
  });

  it("should navigate to survey and back without error", async () => {
    // Step 1: Initial dial
    let response = await sendUssdRequest("");
    expect(response).toContain("Welcome to USSD Supamoto App");
    expect(response).toContain("1. Know More");
    expect(response).toContain("2. Account Menu");

    // Step 2: Select Account Menu
    response = await sendUssdRequest("2");
    expect(response).toContain("Account Menu");
    expect(response).toContain("1. Yes, log me in");
    expect(response).toContain("2. No, create my account");

    // Step 3: Select Login
    response = await sendUssdRequest("2*1");
    expect(response).toContain("Enter your Customer ID to log in:");

    // Step 4: Enter Customer ID
    response = await sendUssdRequest("2*1*C73DE2A07");
    expect(response).toContain("Verifying Customer ID...");

    // Step 5: Continue after verification
    response = await sendUssdRequest("2*1*C73DE2A07*1");
    expect(response).toContain("Enter your PIN:");

    // Step 6: Enter PIN
    response = await sendUssdRequest("2*1*C73DE2A07*1*10101");
    expect(response).toContain("Verifying PIN...");

    // Step 7: Continue after PIN verification
    response = await sendUssdRequest("2*1*C73DE2A07*1*10101*1");
    expect(response).toContain("Welcome, Lead Generator!");
    expect(response).toContain("Login successful");

    // Step 8: Continue to Agent Tools
    response = await sendUssdRequest("2*1*C73DE2A07*1*10101*1*1");
    expect(response).toContain("Agent Tools");
    expect(response).toContain("1. Activate a Customer");
    expect(response).toContain("2. 1,000 Day Survey");

    // Step 9: Select 1,000 Day Survey
    response = await sendUssdRequest("2*1*C73DE2A07*1*10101*1*1*2");
    expect(response).toContain(
      "A Lead Generator completes this survey on behalf of a Customer."
    );
    expect(response).toContain(
      "Enter the Customer ID on whose behalf you are completing the survey."
    );
    expect(response).toContain("0. Back to Agent Tools");

    // Step 10: Press "0" to go back - THIS IS THE KEY TEST
    response = await sendUssdRequest("2*1*C73DE2A07*1*10101*1*1*2*0");

    // CRITICAL ASSERTIONS: Verify no error state
    expect(response).not.toContain("System error");
    expect(response).not.toContain("Error:");
    expect(response).not.toContain("An unexpected error occurred");

    // Verify we're back at Agent Tools menu
    expect(response).toContain("Agent Tools");
    expect(response).toContain("1. Activate a Customer");
    expect(response).toContain("2. 1,000 Day Survey");
  }, 30000); // 30 second timeout for full flow

  it("should handle exit (*) from survey initial state", async () => {
    // Use a different session ID for this test
    const exitSessionId = `flow-test-1000-day-survey-exit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    async function sendExitRequest(text: string): Promise<string> {
      const response = await fetch(SERVER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Vitest-Flow-Test/1.0",
        },
        body: JSON.stringify({
          sessionId: exitSessionId,
          serviceCode: SERVICE_CODE,
          phoneNumber: PHONE_NUMBER,
          text,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Server returned error: ${response.status} ${errorText}`
        );
      }

      return response.text();
    }

    // Navigate to survey (abbreviated path)
    await sendExitRequest("");
    await sendExitRequest("2");
    await sendExitRequest("2*1");
    await sendExitRequest("2*1*C73DE2A07");
    await sendExitRequest("2*1*C73DE2A07*1");
    await sendExitRequest("2*1*C73DE2A07*1*10101");
    await sendExitRequest("2*1*C73DE2A07*1*10101*1");
    await sendExitRequest("2*1*C73DE2A07*1*10101*1*1");
    await sendExitRequest("2*1*C73DE2A07*1*10101*1*1*2");

    // Press "*" to exit from survey
    const response = await sendExitRequest("2*1*C73DE2A07*1*10101*1*1*2**");

    // Verify no error state
    expect(response).not.toContain("System error");
    expect(response).not.toContain("Error:");

    // Should exit cleanly (END response or back to main menu)
    // The exact behavior depends on the parent machine's exit handling
  }, 30000);
});
