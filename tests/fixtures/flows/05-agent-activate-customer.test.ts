/**
 * Generated Test: 05-agent-activate-customer
 *
 * This test was automatically generated from a recorded USSD session.
 *
 * Session Details:
 * - Flow: 05-agent-activate-customer
 * - Session ID: rec-05-agent-activate-customer-1774612381973-14
 * - Phone: +260971230001
 * - Service Code: *2233#
 * - Recorded: 2026-03-27T11:53:08.513Z
 * - Turns: 11
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
 *    pnpm test tests/flows/05-agent-activate-customer.test.ts  # Won't work
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
 * 3. Run: pnpm generate:test <log-file> 05-agent-activate-customer
 *
 * @generated
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getFirstCustomerId, getCustomerIds, promoteToLeadGenerator, closeDbPool } from "./setup.js";

// Dynamic Customer IDs — resolved from DB at runtime
let CUSTOMER_ID: string;
let SECOND_CUSTOMER_ID: string;

// Test Configuration
const SERVER_URL = process.env.USSD_TEST_SERVER_URL || "http://127.0.0.1:3005/api/ussd";
// Dynamic session ID to prevent conflicts when running tests multiple times
const SESSION_ID = `flow-test-05-agent-activate-customer-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
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

describe("05-agent-activate-customer - USSD Flow Test", () => {

  beforeAll(async () => {
    CUSTOMER_ID = await getFirstCustomerId();
    console.log(`🔑 Customer ID from DB: ${CUSTOMER_ID}`);
    const ids = await getCustomerIds();
    SECOND_CUSTOMER_ID = ids[1];
    console.log(`🔑 Second Customer ID from DB: ${SECOND_CUSTOMER_ID}`);
    await promoteToLeadGenerator(CUSTOMER_ID);
    console.log(`👑 Promoted ${CUSTOMER_ID} to lead_generator`);
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

  it("Turn 4: Input: \"CBDAAD707\"", async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*1*CBDAAD707"
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

    // Cumulative USSD text: "2*1*CBDAAD707*12345"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(`2*1*${CUSTOMER_ID}*12345`);

    // Login success — customer name and ID are dynamic
    expect(response).toMatch(/CON Welcome, .+!\nLogin successful for Customer ID: C[0-9A-F]+\.\n1\. Continue/);
  }, 10000); // 10 second timeout for this test

  it("Turn 6: Input: \"1\"", async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*1*CBDAAD707*12345*1"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(`2*1*${CUSTOMER_ID}*12345*1`);

    // Expected server response
    const expected = "CON Agent Tools\n1. Confirm Receival of Beans\n2. Activate a Customer\n3. 1,000 Day Survey\n4. Register Intent to Deliver Beans\n5. Submit Customer OTP\n6. Confirm Bean Delivery\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it("Turn 7: Input: \"1\"", async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*1*CBDAAD707*12345*1*1"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(`2*1*${CUSTOMER_ID}*12345*1*1`);

    // Expected server response
    const expected = "CON Customer Tools\n1. Confirm Receival of Beans\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it("Turn 8: Input: \"2\"", async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*1*CBDAAD707*12345*1*1*2"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(`2*1*${CUSTOMER_ID}*12345*1*1*2`);

    // Expected server response
    const expected = "CON Customer Tools\n1. Confirm Receival of Beans\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it("Turn 9: Input: \"C9F481C55\"", async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*1*CBDAAD707*12345*1*1*2*C9F481C55"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(`2*1*${CUSTOMER_ID}*12345*1*1*2*${SECOND_CUSTOMER_ID}`);

    // Expected server response
    const expected = "CON Customer Tools\n1. Confirm Receival of Beans\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it("Turn 10: Input: \"+260971230002\"", async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*1*CBDAAD707*12345*1*1*2*C9F481C55*+260971230002"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(`2*1*${CUSTOMER_ID}*12345*1*1*2*${SECOND_CUSTOMER_ID}*+260971230002`);

    // Expected server response
    const expected = "CON Customer Tools\n1. Confirm Receival of Beans\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it("Turn 11: Input: \"1\"", async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*1*CBDAAD707*12345*1*1*2*C9F481C55*+260971230002*1"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(`2*1*${CUSTOMER_ID}*12345*1*1*2*${SECOND_CUSTOMER_ID}*+260971230002*1`);

    // Expected server response
    const expected = "CON No pending delivery confirmation found. Please contact your Lead Generator.\n\n1. Back\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

});