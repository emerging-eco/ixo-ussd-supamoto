/**
 * Generated Test: 1000-day-household-survey
 *
 * This test was automatically generated from a recorded USSD session.
 *
 * Session Details:
 * - Flow: 1000-day-household-survey
 * - Session ID: interactive-test-1761543921905
 * - Phone: +260971230001
 * - Service Code: *2233#
 * - Recorded: 2025-10-27T15:41:14.603Z
 * - Turns: 23
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
 *    pnpm test tests/flows/1000-day-household-survey.test.ts  # Won't work
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
 * 3. Run: pnpm generate:test <log-file> 1000-day-household-survey
 *
 * @generated
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";

// Test Configuration
const SERVER_URL =
  process.env.USSD_TEST_SERVER_URL || "http://127.0.0.1:3005/api/ussd";
// Dynamic session ID to prevent conflicts when running tests multiple times
const SESSION_ID = `flow-test-1000-day-household-survey-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
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

describe("1000-day-household-survey - USSD Flow Test", () => {
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

  it('Turn 3: Input: "1"', async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*1"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("2*1");

    // Expected server response
    const expected = "CON Enter your Customer ID to log in:\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 4: Input: "C73DE2A07"', async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*1*C73DE2A07"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("2*1*C73DE2A07");

    // Expected server response
    const expected = "CON Verifying Customer ID...\n1. Continue";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 5: Input: "1"', async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*1*C73DE2A07*1"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("2*1*C73DE2A07*1");

    // Expected server response
    const expected = "CON Enter your PIN:\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 6: Input: "10101"', async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*1*C73DE2A07*1*10101"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("2*1*C73DE2A07*1*10101");

    // Expected server response
    const expected = "CON Verifying PIN...\n1. Continue";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 7: Input: "1"', async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

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
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*1*C73DE2A07*1*10101*1*1"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("2*1*C73DE2A07*1*10101*1*1");

    // Expected server response
    const expected =
      "CON Agent Tools\n1. Activate a Customer\n2. 1,000 Day Survey\n3. Register Intent to Deliver Beans\n4. Submit Customer OTP\n5. Confirm Bean Delivery\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 9: Input: "2"', async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*1*C73DE2A07*1*10101*1*1*2"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("2*1*C73DE2A07*1*10101*1*1*2");

    // Expected server response
    const expected = "CON Loading survey...\n1. Continue";

    // Assert response matches expected
    expect(response).toBe(expected);

    // Add a delay to allow time for the database query
    await new Promise(resolve => setTimeout(resolve, 500));
  }, 10000); // 10 second timeout for this test

  it('Turn 10: Input: "1"', async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*1*C73DE2A07*1*10101*1*1*2*1"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest("2*1*C73DE2A07*1*10101*1*1*2*1");

    // Expected server response
    const expected =
      "CON A Lead Generator completes this survey on behalf of a Customer.\nWhat is the Customer ID for the Customer on whose behalf you are completing the survey?\n1. Back to Agent Tools";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 11: Input: "C1F53E2F7"', async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*1*C73DE2A07*1*10101*1*1*2*1*C1F53E2F7"
    // Send user input (USSD requires cumulative text)
    // NOTE: Customer ID C1F53E2F7 must exist in the database for validation to pass
    const response = await sendUssdRequest(
      "2*1*C73DE2A07*1*10101*1*1*2*1*C1F53E2F7"
    );

    // Expected server response - now includes customer validation step
    const expected = "CON Validating Customer ID...\n\n1. Continue";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 12: Input: "1" (Continue after validation)', async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*1*C73DE2A07*1*10101*1*1*2*1*C1F53E2F7*1"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(
      "2*1*C73DE2A07*1*10101*1*1*2*1*C1F53E2F7*1"
    );

    // Expected server response - Creating claim record
    const expected = "CON Creating claim record...\n\n1. Continue";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 13: Input: "1" (Continue after claim creation)', async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*1*C73DE2A07*1*10101*1*1*2*1*C1F53E2F7*1*1"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(
      "2*1*C73DE2A07*1*10101*1*1*2*1*C1F53E2F7*1*1"
    );

    // Expected server response - First survey question
    const expected =
      "CON Select all TRUE options for your household\nA: Pregnant Woman\nB: Breastfeeding Mother\nC: Child under 2 years\n1. A\n2. B\n3. C\n4. A + B\n5. A + C\n6. B + C\n7. All\n8. None\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 14: Input: "4" (A + B - no child)', async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*1*C73DE2A07*1*10101*1*1*2*1*C1F53E2F7*1*1*4"
    // Send user input (USSD requires cumulative text)
    // Option 4 = "A + B" (Pregnant Woman + Breastfeeding Mother) - NO child
    // Child age and bean frequency questions should be SKIPPED
    const response = await sendUssdRequest(
      "2*1*C73DE2A07*1*10101*1*1*2*1*C1F53E2F7*1*1*4"
    );

    // Expected server response - should skip directly to price specification
    const expected =
      "CON How much are you willing to pay for a 1 kg bag of beans? (ZMW)\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 15: Input: "10 ZMW"', async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*1*C73DE2A07*1*10101*1*1*2*1*C1F53E2F7*1*1*4*10 ZMW"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(
      "2*1*C73DE2A07*1*10101*1*1*2*1*C1F53E2F7*1*1*4*10 ZMW"
    );

    // Expected server response
    const expected =
      "CON Have you ever heard about iron-fortified beans (mbereshi beans)?\n1. Yes\n2. No\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 16: Input: "2"', async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*1*C73DE2A07*1*10101*1*1*2*1*C1F53E2F7*1*1*4*10 ZMW*2"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(
      "2*1*C73DE2A07*1*10101*1*1*2*1*C1F53E2F7*1*1*4*10 ZMW*2"
    );

    // Expected server response
    const expected =
      "CON Do you know any nutritional benefits of iron-fortified beans (mbereshi beans)?\n1. Yes\n2. No\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 17: Input: "2"', async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*1*C73DE2A07*1*10101*1*1*2*1*C1F53E2F7*1*1*4*10 ZMW*2"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(
      "2*1*C73DE2A07*1*10101*1*1*2*1*C1F53E2F7*1*1*4*10 ZMW*2"
    );

    // Expected server response
    const expected =
      "CON Do you know any nutritional benefits of iron-fortified beans (mbereshi beans)?\n1. Yes\n2. No\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 18: Input: "2"', async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*1*C73DE2A07*1*10101*1*1*2*1*C1F53E2F7*1*1*4*10 ZMW*2*2"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(
      "2*1*C73DE2A07*1*10101*1*1*2*1*C1F53E2F7*1*1*4*10 ZMW*2*2"
    );

    // Expected server response
    const expected =
      "CON Do you think this is a nutritional benefit?\n(1 of 5)\nA: Improve iron status and help reduce iron deficiency/anemia.\n1. Yes\n2. No\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 19: Input: "1"', async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*1*C73DE2A07*1*10101*1*1*2*1*C1F53E2F7*1*1*4*10 ZMW*2*2*1"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(
      "2*1*C73DE2A07*1*10101*1*1*2*1*C1F53E2F7*1*1*4*10 ZMW*2*2*1"
    );

    // Expected server response
    const expected =
      "CON Do you think this is a nutritional benefit?\n(2 of 5)\nB: Support cognitive performance in iron-deficient individuals.\n1. Yes\n2. No\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 20: Input: "2"', async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*1*C73DE2A07*1*10101*1*1*2*1*C1F53E2F7*1*1*4*10 ZMW*2*2*1*2"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(
      "2*1*C73DE2A07*1*10101*1*1*2*1*C1F53E2F7*1*1*4*10 ZMW*2*2*1*2"
    );

    // Expected server response
    const expected =
      "CON Do you think this is a nutritional benefit?\n(3 of 5)\nC: Enhance physical work capacity and reduce fatigue.\n1. Yes\n2. No\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 21: Input: "2"', async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*1*C73DE2A07*1*10101*1*1*2*1*C1F53E2F7*1*1*4*10 ZMW*2*2*1*2*2"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(
      "2*1*C73DE2A07*1*10101*1*1*2*1*C1F53E2F7*1*1*4*10 ZMW*2*2*1*2*2"
    );

    // Expected server response
    const expected =
      "CON Do you think this is a nutritional benefit?\n(4 of 5)\nD: Provide higher iron (and often zinc) than standard bean varieties.\n1. Yes\n2. No\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 22: Input: "1"', async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*1*C73DE2A07*1*10101*1*1*2*1*C1F53E2F7*1*1*4*10 ZMW*2*2*1*2*2*1"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(
      "2*1*C73DE2A07*1*10101*1*1*2*1*C1F53E2F7*1*1*4*10 ZMW*2*2*1*2*2*1"
    );

    // Expected server response
    const expected =
      "CON Do you think this is a nutritional benefit?\n(5 of 5)\nE: Supply plant protein and fiber for satiety and gut health.\n1. Yes\n2. No\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 23: Input: "1"', async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*1*C73DE2A07*1*10101*1*1*2*1*C1F53E2F7*1*1*4*10 ZMW*2*2*1*2*2*1*1"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(
      "2*1*C73DE2A07*1*10101*1*1*2*1*C1F53E2F7*1*1*4*10 ZMW*2*2*1*2*2*1*1"
    );

    // Expected server response
    const expected =
      "CON Lead Generator: I confirm I have seen a recent antenatal card for a household member.\n1. Yes\n2. No\n0. Back";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test

  it('Turn 24: Input: "1"', async () => {
    // Simulate realistic user interaction timing (2-second delay)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cumulative USSD text: "2*1*C73DE2A07*1*10101*1*1*2*1*C1F53E2F7*1*1*4*10 ZMW*2*2*1*2*2*1*1*1"
    // Send user input (USSD requires cumulative text)
    const response = await sendUssdRequest(
      "2*1*C73DE2A07*1*10101*1*1*2*1*C1F53E2F7*1*1*4*10 ZMW*2*2*1*2*2*1*1*1"
    );

    // Expected server response
    const expected =
      "CON Thank you. Your answers have been saved and submitted.\n1. Back to Agent Tools";

    // Assert response matches expected
    expect(response).toBe(expected);
  }, 10000); // 10 second timeout for this test
});
