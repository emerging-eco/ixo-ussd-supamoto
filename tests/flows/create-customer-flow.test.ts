/**
 * Generated Test: create-customer-flow
 *
 * This test was automatically generated from a recorded USSD session.
 *
 * Session Details:
 * - Flow: create-customer-flow
 * - Session ID: interactive-test-1761576171672
 * - Phone: +260971230001
 * - Service Code: *2233#
 * - Recorded: 2025-10-27T14:42:51.676Z
 * - Turns: 17
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
 *    pnpm test tests/flows/create-customer-flow.test.ts  # Won't work
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
 * 3. Run: pnpm generate:test <log-file> create-customer-flow
 *
 * @generated
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { CUSTOMER_ID_PATTERN } from "../../src/utils/customer-id.js";

// Test Configuration
const SERVER_URL =
  process.env.USSD_TEST_SERVER_URL || "https://ixo-ussd-supamoto-development.up.railway.app/api/ussd";
// Dynamic session ID to prevent conflicts when running tests multiple times
const SESSION_ID = `flow-test-create-customer-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
const PHONE_NUMBER = "+260971230001";
const SERVICE_CODE = "*2233#";
const REQUEST_TIMEOUT = 5000; // 5 seconds

// Variable to store the dynamically generated Customer ID
let capturedCustomerId: string | null = null;

/**
 * Extract Customer ID from response message
 * Expected format: "CON Account created successfully!\nYour Customer ID: C1F53E2F7\n..."
 */
function extractCustomerId(response: string): string | null {
  const match = response.match(/Your Customer ID: (C[A-F0-9]{8})/);
  return match ? match[1] : null;
}

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

describe("create-customer-flow - USSD Flow Test", () => {
  beforeAll(() => {
    console.log("🚀 Starting USSD flow test");
    console.log(`📡 Server: ${SERVER_URL}`);
    console.log(`📱 Phone: ${PHONE_NUMBER}`);
    console.log(`🔢 Service: ${SERVICE_CODE}`);
  });

  afterAll(() => {
    console.log("✅ USSD flow test completed");
    if (capturedCustomerId) {
      console.log(`📋 Customer ID used in test: ${capturedCustomerId}`);
    }
  });

  it("Turn 1: Initial dial", async () => {
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("");

    // Expected server response
    const expected =
      "CON Welcome to USSD Supamoto App\n1. Know More\n2. Account Menu\n*. Exit";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 2: Input: "2"', async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("2");

    // Expected server response
    const expected =
      "CON Account Menu\n\nDo you have an existing account?\n1. Yes, log me in\n2. No, create my account\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 3: Input: "2"', async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*2"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("2*2");

    // Expected server response
    const expected =
      "CON Welcome to USSD Supamoto App\nEnter your full name:\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 4: Input: "Cust Omer"', async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*2*Cust Omer"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("2*2*Cust Omer");

    // Expected server response
    const expected =
      "CON Enter your email address (optional):\n00. Skip\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 5: Input: "cust@om.er"', async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*2*Cust Omer*cust@om.er"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("2*2*Cust Omer*cust@om.er");

    // Expected server response
    const expected = "CON Create a 5-digit PIN for your account:\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 6: Input: "10101"', async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*2*Cust Omer*cust@om.er*10101"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("2*2*Cust Omer*cust@om.er*10101");

    // Expected server response
    const expected = "CON Confirm your 5-digit PIN:\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 7: Input: "10101"', async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*2*Cust Omer*cust@om.er*10101*10101"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(
      "2*2*Cust Omer*cust@om.er*10101*10101"
    );

    // Expected server response
    const expected = "CON Creating your account...\n1. View your Customer ID";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 8: Input: "1"', async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*2*Cust Omer*cust@om.er*10101*10101*1"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(
      "2*2*Cust Omer*cust@om.er*10101*10101*1"
    );

    // Extract the dynamically generated Customer ID
    capturedCustomerId = extractCustomerId(response);

    // Validate that a Customer ID was returned
    expect(capturedCustomerId).not.toBeNull();
    expect(capturedCustomerId).toMatch(CUSTOMER_ID_PATTERN);

    // Validate the response structure with dynamic Customer ID
    const expected = `CON Account created successfully!\nYour Customer ID: ${capturedCustomerId}\nSave your Customer ID to access services.\n1. Back to Account Menu`;
    expect(response).toBe(expected);

    console.log(`✅ Customer ID captured: ${capturedCustomerId}`);
  }, 10000); // 10 second timeout for this test

  it('Turn 9: Input: "1"', async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*2*Cust Omer*cust@om.er*10101*10101*1*1"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(
      "2*2*Cust Omer*cust@om.er*10101*10101*1*1"
    );

    // Expected server response
    const expected =
      "CON Account Menu\n\nDo you have an existing account?\n1. Yes, log me in\n2. No, create my account\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 10: Input: "1"', async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*2*Cust Omer*cust@om.er*10101*10101*1*1*1"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(
      "2*2*Cust Omer*cust@om.er*10101*10101*1*1*1"
    );

    // Expected server response
    const expected = "CON Enter your Customer ID to log in:\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it("Turn 11: Input: Customer ID", async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Ensure we have a captured Customer ID from Turn 8
    expect(capturedCustomerId).not.toBeNull();

    // Cumulative USSD text: "2*2*Cust Omer*cust@om.er*10101*10101*1*1*1*{CUSTOMER_ID}"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(
      `2*2*Cust Omer*cust@om.er*10101*10101*1*1*1*${capturedCustomerId}`
    );

    // Expected server response
    const expected = "CON Verifying Customer ID...\n1. Continue";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 12: Input: "1"', async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    expect(capturedCustomerId).not.toBeNull();

    // Cumulative USSD text: "2*2*Cust Omer*cust@om.er*10101*10101*1*1*1*{CUSTOMER_ID}*1"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(
      `2*2*Cust Omer*cust@om.er*10101*10101*1*1*1*${capturedCustomerId}*1`
    );

    // Expected server response
    const expected = "CON Enter your PIN:\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 13: Input: "10101"', async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    expect(capturedCustomerId).not.toBeNull();

    // Cumulative USSD text: "2*2*Cust Omer*cust@om.er*10101*10101*1*1*1*{CUSTOMER_ID}*1*10101"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(
      `2*2*Cust Omer*cust@om.er*10101*10101*1*1*1*${capturedCustomerId}*1*10101`
    );

    // Expected server response
    const expected = "CON Verifying PIN...\n1. Continue";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 14: Input: "1"', async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    expect(capturedCustomerId).not.toBeNull();

    // Cumulative USSD text: "2*2*Cust Omer*cust@om.er*10101*10101*1*1*1*{CUSTOMER_ID}*1*10101*1"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(
      `2*2*Cust Omer*cust@om.er*10101*10101*1*1*1*${capturedCustomerId}*1*10101*1`
    );

    // Expected server response with dynamic Customer ID
    const expected = `CON Welcome, Cust Omer!\nLogin successful for Customer ID: ${capturedCustomerId}.\n1. Continue`;

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 15: Input: "1"', async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    expect(capturedCustomerId).not.toBeNull();

    // Cumulative USSD text: "2*2*Cust Omer*cust@om.er*10101*10101*1*1*1*{CUSTOMER_ID}*1*10101*1*1"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(
      `2*2*Cust Omer*cust@om.er*10101*10101*1*1*1*${capturedCustomerId}*1*10101*1*1`
    );

    // Expected server response
    const expected =
      "CON Customer Tools\n1. Confirm Receival of Beans\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 16: Input: "0"', async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    expect(capturedCustomerId).not.toBeNull();

    // Cumulative USSD text: "2*2*Cust Omer*cust@om.er*10101*10101*1*1*1*{CUSTOMER_ID}*1*10101*1*1*0"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(
      `2*2*Cust Omer*cust@om.er*10101*10101*1*1*1*${capturedCustomerId}*1*10101*1*1*0`
    );

    // Expected server response
    const expected =
      "CON Welcome to USSD Supamoto App\n1. Know More\n2. Account Menu\n3. Services\n*. Exit";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 17: Input: "*"', async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    expect(capturedCustomerId).not.toBeNull();

    // Cumulative USSD text: "2*2*Cust Omer*cust@om.er*10101*10101*1*1*1*{CUSTOMER_ID}*1*10101*1*1*0**"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(
      `2*2*Cust Omer*cust@om.er*10101*10101*1*1*1*${capturedCustomerId}*1*10101*1*1*0**`
    );

    // Expected server response
    const expected = "CON Thank you for using USSD Supamoto App. Goodbye!";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test
});
