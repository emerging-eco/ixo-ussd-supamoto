/**
 * Generated Test: 02-create-account-skip-email
 *
 * This test was automatically generated from a recorded USSD session.
 *
 * Session Details:
 * - Flow: 02-create-account-skip-email
 * - Session ID: rec-02-create-account-skip-email-1774612327999-4
 * - Phone: +260971230001
 * - Service Code: *2233#
 * - Recorded: 2026-03-27T11:52:13.935Z
 * - Turns: 10
 *
 * ⚠️  IMPORTANT: How to run this test
 *
 * Flow tests use a separate configuration and CANNOT be run with the default test command.
 *
 * ✅ CORRECT:
 *    pnpm test:flows:run              # Run all flow tests
 *    pnpm test:flows                  # Run in watch mode
 *
 * ❌ INCORRECT (will fail):
 *    pnpm test ./tests/flows/         # Won't work - flow tests are excluded
 *    pnpm test tests/flows/02-create-account-skip-email.test.ts  # Won't work
 *
 * Prerequisites:
 * 1. Start the USSD server: pnpm dev
 * 2. Server must be running at: http://127.0.0.1:3005/api/ussd (or set USSD_TEST_SERVER_URL)
 *
 * Environment variables:
 * - USSD_TEST_SERVER_URL: Override server URL (default: http://127.0.0.1:3005/api/ussd)
 *
 * To regenerate this test:
 * 1. Run: pnpm test:interactive
 * 2. Complete the flow you want to test
 * 3. Run: pnpm generate:test <log-file> 02-create-account-skip-email
 *
 * @generated
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";

// Test Configuration
const SERVER_URL = process.env.USSD_TEST_SERVER_URL || "http://127.0.0.1:3005/api/ussd";
// Dynamic session ID to prevent conflicts when running tests multiple times
const SESSION_ID = `flow-test-02-create-account-skip-email-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
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
      "User-Agent": "Vitest-Generated-Test/1.0",
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

describe("02-create-account-skip-email - USSD Flow Test", () => {

  beforeAll(async () => {
    console.log("🚀 Starting USSD flow test");
    console.log(`📡 Server: ${SERVER_URL}`);
    console.log(`📱 Phone: ${PHONE_NUMBER}`);
    console.log(`🔢 Service: ${SERVICE_CODE}`);
  });

  afterAll(() => {
    console.log("✅ USSD flow test completed");
  });

  it("Turn 1: Initial dial", async () => {
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("");

    // Expected server response
    const expected = "CON Welcome to USSD Supamoto App\n1. Know More\n2. Account Menu\n*. Exit";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it("Turn 2: Input: \"2\"", async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("2");

    // Expected server response
    const expected = "CON Account Menu\n\nDo you have an existing account?\n1. Yes, log me in\n2. No, create my account\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it("Turn 3: Input: \"2\"", async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*2"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("2*2");

    // Expected server response
    const expected = "CON Welcome to USSD Supamoto App\nEnter your full name:\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it("Turn 4: Input: \"Jane Smith\"", async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*2*Jane Smith"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("2*2*Jane Smith");

    // Expected server response
    const expected = "CON Enter your email address (optional):\n00. Skip\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it("Turn 5: Input: \"00\"", async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*2*Jane Smith*00"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("2*2*Jane Smith*00");

    // Expected server response
    const expected = "CON Enter your National ID (format: 123456/12/1):\n00. Skip\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it("Turn 6: Input: \"654321/98/7\"", async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*2*Jane Smith*00*654321/98/7"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("2*2*Jane Smith*00*654321/98/7");

    // Expected server response
    const expected = "CON Create a 5-digit PIN for your account:\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it("Turn 7: Input: \"12345\"", async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*2*Jane Smith*00*654321/98/7*12345"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("2*2*Jane Smith*00*654321/98/7*12345");

    // Expected server response
    const expected = "CON Confirm your 5-digit PIN:\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it("Turn 8: Input: \"12345\"", async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*2*Jane Smith*00*654321/98/7*12345*12345"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("2*2*Jane Smith*00*654321/98/7*12345*12345");

    // Expected server response
    const expected = "CON Creating your account...\n1. View your Customer ID";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it("Turn 9: Input: \"1\"", async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*2*Jane Smith*00*654321/98/7*12345*12345*1"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("2*2*Jane Smith*00*654321/98/7*12345*12345*1");

    expect(response).toContain("CON Account created successfully!");
    expect(response).toContain("Save your Customer ID to access services.");
    expect(response).toMatch(/Your Customer ID: C[0-9A-F]+/);
  }, 10000); // 10 second timeout for this test

  it("Turn 10: Input: \"1\"", async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*2*Jane Smith*00*654321/98/7*12345*12345*1*1"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("2*2*Jane Smith*00*654321/98/7*12345*12345*1*1");

    // Expected server response
    const expected = "CON Account Menu\n\nDo you have an existing account?\n1. Yes, log me in\n2. No, create my account\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

});