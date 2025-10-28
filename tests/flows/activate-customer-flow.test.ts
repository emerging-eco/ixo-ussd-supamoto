/**
 * Generated Test: activate-customer
 *
 * This test was automatically generated from a recorded USSD session.
 *
 * Session Details:
 * - Flow: activate-customer
 * - Session ID: interactive-test-1761579674600
 * - Phone: +260971230001
 * - Service Code: *2233#
 * - Recorded: 2025-10-27T15:41:14.603Z
 * - Turns: 14
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
 *    pnpm test tests/flows/activate-customer.test.ts  # Won't work
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
 * 3. Run: pnpm generate:test <log-file> activate-customer
 *
 * @generated
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";

// Test Configuration
const SERVER_URL =
  process.env.USSD_TEST_SERVER_URL || "http://127.0.0.1:3005/api/ussd";
const SESSION_ID = "interactive-test-1761579674600";
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

describe("activate-customer - USSD Flow Test", () => {
  beforeAll(() => {
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
    const expected =
      "CON Welcome to USSD Supamoto App\n1. Know More\n2. Account Menu\n*. Exit";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 2: Input: "2"', async () => {
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("2");

    // Expected server response
    const expected =
      "CON Account Menu\n\nDo you have an existing account?\n1. Yes, log me in\n2. No, create my account\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 3: Input: "1"', async () => {
    // Cumulative USSD text: "2*1"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("2*1");

    // Expected server response
    const expected = "CON Enter your Customer ID to log in:\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 4: Input: "C73DE2A07"', async () => {
    // Cumulative USSD text: "2*1*C73DE2A07"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("2*1*C73DE2A07");

    // Expected server response
    const expected = "CON Verifying Customer ID...\n1. Continue";

    // Assert response matches expected
    expect(response).toBe(expected);

    // Allow async database lookup to complete before next turn
    await new Promise(resolve => setTimeout(resolve, 500));
  }, 10000); // 10 second timeout for this test

  it('Turn 5: Input: "1"', async () => {
    // Cumulative USSD text: "2*1*C73DE2A07*1"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("2*1*C73DE2A07*1");

    // Expected server response
    const expected = "CON Enter your PIN:\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 6: Input: "10101"', async () => {
    // Cumulative USSD text: "2*1*C73DE2A07*1*10101"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("2*1*C73DE2A07*1*10101");

    // Expected server response
    const expected = "CON Verifying PIN...\n1. Continue";

    // Assert response matches expected
    expect(response).toBe(expected);

    // Add a delay to allow time for the database query
    await new Promise(resolve => setTimeout(resolve, 500));
  }, 10000); // 10 second timeout for this test

  it('Turn 7: Input: "1"', async () => {
    // Cumulative USSD text: "2*1*C73DE2A07*1*10101*1"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("2*1*C73DE2A07*1*10101*1");

    // Expected server response
    const expected =
      "CON Welcome, Lead Generator!\nLogin successful for Customer ID: C73DE2A07.\n1. Continue";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 8: Input: "1"', async () => {
    // Cumulative USSD text: "2*1*C73DE2A07*1*10101*1*1"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("2*1*C73DE2A07*1*10101*1*1");

    // Expected server response
    const expected =
      "CON Agent Tools\n1. Activate a Customer\n2. 1,000 Day Survey\n3. Register Intent to Deliver Beans\n4. Submit Customer OTP\n5. Confirm Bean Delivery\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 9: Input: "1"', async () => {
    // Cumulative USSD text: "2*1*C73DE2A07*1*10101*1*1*1"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("2*1*C73DE2A07*1*10101*1*1*1");

    // Expected server response
    const expected = "CON Verify Customer\nEnter Customer ID:\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 10: Input: "C101EC031"', async () => {
    // Cumulative USSD text: "2*1*C73DE2A07*1*10101*1*1*1*C101EC031"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(
      "2*1*C73DE2A07*1*10101*1*1*1*C101EC031"
    );

    // Expected server response
    const expected =
      "CON Enter customer's phone number (with country code, e.g., +260971234567):\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 11: Input: "+260971230001"', async () => {
    // Cumulative USSD text: "2*1*C73DE2A07*1*10101*1*1*1*C101EC031*+260971230001"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(
      "2*1*C73DE2A07*1*10101*1*1*1*C101EC031*+260971230001"
    );

    // Expected server response
    const expected = "CON Sending activation SMS...\n1. Continue";

    // Assert response matches expected
    expect(response).toBe(expected);

    // Add a delay to allow time for the database query
    await new Promise(resolve => setTimeout(resolve, 500));
  }, 10000); // 10 second timeout for this test

  it('Turn 12: Input: "1"', async () => {
    // Cumulative USSD text: "2*1*C73DE2A07*1*10101*1*1*1*C101EC031*+260971230001*1"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(
      "2*1*C73DE2A07*1*10101*1*1*1*C101EC031*+260971230001*1"
    );

    // Expected server response
    const expected =
      "CON Agent Tools\n1. Activate a Customer\n2. 1,000 Day Survey\n3. Register Intent to Deliver Beans\n4. Submit Customer OTP\n5. Confirm Bean Delivery\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 13: Input: "0"', async () => {
    // Cumulative USSD text: "2*1*C73DE2A07*1*10101*1*1*1*C101EC031*+260971230001*1*0"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(
      "2*1*C73DE2A07*1*10101*1*1*1*C101EC031*+260971230001*1*0"
    );

    // Expected server response
    const expected =
      "CON Welcome to USSD Supamoto App\n1. Know More\n2. Account Menu\n3. Services\n*. Exit";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 14: Input: "*"', async () => {
    // Cumulative USSD text: "2*1*C73DE2A07*1*10101*1*1*1*C101EC031*+260971230001*1*0**"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(
      "2*1*C73DE2A07*1*10101*1*1*1*C101EC031*+260971230001*1*0**"
    );

    // Expected server response
    const expected = "CON Thank you for using USSD Supamoto App. Goodbye!";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test
});
