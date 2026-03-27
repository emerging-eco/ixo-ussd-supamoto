/**
 * Generated Test: 01-know-more-flow
 *
 * This test was automatically generated from a recorded USSD session.
 *
 * Session Details:
 * - Flow: 01-know-more-flow
 * - Session ID: rec-01-know-more-flow-1774608300875-1
 * - Phone: +260971230001
 * - Service Code: *2233#
 * - Recorded: 2026-03-27T10:45:05.654Z
 * - Turns: 8
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
 *    pnpm test tests/flows/01-know-more-flow.test.ts  # Won't work
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
 * 3. Run: pnpm generate:test <log-file> 01-know-more-flow
 *
 * @generated
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";

// Test Configuration
const SERVER_URL = process.env.USSD_TEST_SERVER_URL || "http://127.0.0.1:3005/api/ussd";
// Dynamic session ID to prevent conflicts when running tests multiple times
const SESSION_ID = `flow-test-01-know-more-flow-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
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

describe("01-know-more-flow - USSD Flow Test", () => {

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

  it("Turn 2: Input: \"1\"", async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("1");

    // Expected server response
    const expected = "CON SupaMoto Info\n1. Get a stove\n2. Pellet prices\n3. Delivery info\n4. Stove repairs\n5. Performance\n6. Digital voucher\n7. Contract info\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it("Turn 3: Input: \"1\"", async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "1*1"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("1*1");

    // Expected server response
    const expected = "CON SMS sent successfully! Check your phone for details.\n1. Back to Main Menu\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it("Turn 4: Input: \"0\"", async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "1*1*0"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("1*1*0");

    // Expected server response
    const expected = "CON SupaMoto Info\n1. Get a stove\n2. Pellet prices\n3. Delivery info\n4. Stove repairs\n5. Performance\n6. Digital voucher\n7. Contract info\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it("Turn 5: Input: \"4\"", async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "1*1*0*4"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("1*1*0*4");

    // Expected server response
    const expected = "CON SMS sent successfully! Check your phone for details.\n1. Back to Main Menu\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it("Turn 6: Input: \"1\"", async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "1*1*0*4*1"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("1*1*0*4*1");

    // Expected server response
    const expected = "CON Welcome to USSD Supamoto App\n1. Know More\n2. Account Menu\n*. Exit";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it("Turn 7: Input: \"0\"", async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "1*1*0*4*1*0"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("1*1*0*4*1*0");

    // Expected server response
    const expected = "CON Invalid selection. Please choose 1 or 2.\n\nWelcome to USSD Supamoto App\n1. Know More\n2. Account Menu\n*. Exit";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it("Turn 8: Input: \"0\"", async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "1*1*0*4*1*0*0"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("1*1*0*4*1*0*0");

    // Expected server response
    const expected = "CON Invalid selection. Please choose 1 or 2.\n\nWelcome to USSD Supamoto App\n1. Know More\n2. Account Menu\n*. Exit";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

});