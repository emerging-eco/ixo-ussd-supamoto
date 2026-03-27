/**
 * Generated Test: 04-customer-confirm-beans
 *
 * This test was automatically generated from a recorded USSD session.
 *
 * Session Details:
 * - Flow: 04-customer-confirm-beans
 * - Session ID: rec-04-customer-confirm-beans-1774608358991-12
 * - Phone: +260971230001
 * - Service Code: *2233#
 * - Recorded: 2026-03-27T10:46:04.923Z
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
 *    pnpm test tests/flows/04-customer-confirm-beans.test.ts  # Won't work
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
 * 3. Run: pnpm generate:test <log-file> 04-customer-confirm-beans
 *
 * @generated
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getFirstCustomerId, closeDbPool } from "./setup.js";

// Dynamic Customer IDs — resolved from DB at runtime
let CUSTOMER_ID: string;

// Test Configuration
const SERVER_URL = process.env.USSD_TEST_SERVER_URL || "http://127.0.0.1:3005/api/ussd";
// Dynamic session ID to prevent conflicts when running tests multiple times
const SESSION_ID = `flow-test-04-customer-confirm-beans-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
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

describe("04-customer-confirm-beans - USSD Flow Test", () => {

  beforeAll(async () => {
    CUSTOMER_ID = await getFirstCustomerId();
    console.log(`🔑 Customer ID from DB: ${CUSTOMER_ID}`);
    console.log("🚀 Starting USSD flow test");
    console.log(`📡 Server: ${SERVER_URL}`);
    console.log(`📱 Phone: ${PHONE_NUMBER}`);
    console.log(`🔢 Service: ${SERVICE_CODE}`);
  });

  afterAll(async () => {
    await closeDbPool();
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

  it("Turn 3: Input: \"1\"", async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*1"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("2*1");

    // Expected server response
    const expected = "CON Enter your National ID Number or Customer ID to log in:\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it("Turn 4: Input: \"CCDDE6B04\"", async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*1*CCDDE6B04"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(`2*1*${CUSTOMER_ID}`);

    // Expected server response
    const expected = "CON Enter your PIN:\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it("Turn 5: Input: \"12345\"", async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*1*CCDDE6B04*12345"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(`2*1*${CUSTOMER_ID}*12345`);

    // Login success — customer name and ID are dynamic
    expect(response).toMatch(/CON Welcome, .+!\nLogin successful for Customer ID: C[0-9A-F]+\.\n1\. Continue/);
  }, 10000); // 10 second timeout for this test

  it("Turn 6: Input: \"1\"", async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*1*CCDDE6B04*12345*1"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(`2*1*${CUSTOMER_ID}*12345*1`);

    // Role-dependent menu heading — customer may have been promoted to lead_generator
    expect(response).toMatch(/CON (Customer|Agent) Tools/);
    expect(response).toContain("1. Confirm Receival of Beans\n0. Back");
  }, 10000); // 10 second timeout for this test

  it("Turn 7: Input: \"1\"", async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*1*CCDDE6B04*12345*1*1"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(`2*1*${CUSTOMER_ID}*12345*1*1`);

    // Expected server response
    const expected = "CON No pending delivery confirmation found. Please contact your Lead Generator.\n\n1. Back\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it("Turn 8: Input: \"1\"", async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*1*CCDDE6B04*12345*1*1*1"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(`2*1*${CUSTOMER_ID}*12345*1*1*1`);

    // Role-dependent menu heading — customer may have been promoted to lead_generator
    expect(response).toMatch(/CON (Customer|Agent) Tools/);
    expect(response).toContain("1. Confirm Receival of Beans\n0. Back");
  }, 10000); // 10 second timeout for this test

  it("Turn 9: Input: \"1\"", async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*1*CCDDE6B04*12345*1*1*1*1"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(`2*1*${CUSTOMER_ID}*12345*1*1*1*1`);

    // Expected server response
    const expected = "CON No pending delivery confirmation found. Please contact your Lead Generator.\n\n1. Back\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it("Turn 10: Input: \"1\"", async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*1*CCDDE6B04*12345*1*1*1*1*1"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(`2*1*${CUSTOMER_ID}*12345*1*1*1*1*1`);

    // Role-dependent menu heading — customer may have been promoted to lead_generator
    expect(response).toMatch(/CON (Customer|Agent) Tools/);
    expect(response).toContain("1. Confirm Receival of Beans\n0. Back");
  }, 10000); // 10 second timeout for this test

});