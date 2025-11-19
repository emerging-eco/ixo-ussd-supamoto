/**
 * Test: 1000 Day Survey Session Recovery
 *
 * This test validates that the survey can be interrupted and resumed from the correct question.
 * It tests session recovery at various points in the survey flow.
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
 *    pnpm test tests/flows/1000-day-survey-session-recovery.test.ts  # Won't work
 *
 * Prerequisites:
 * 1. Start the USSD server: pnpm dev
 * 2. Server must be running at: http://127.0.0.1:3005/api/ussd (or set USSD_TEST_SERVER_URL)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";

// Test Configuration
const SERVER_URL =
  process.env.USSD_TEST_SERVER_URL || "http://127.0.0.1:3005/api/ussd";
const PHONE_NUMBER = "+260971230001";
const SERVICE_CODE = "*2233#";
const REQUEST_TIMEOUT = 5000; // 5 seconds

/**
 * Send a USSD request to the server
 */
async function sendUssdRequest(
  sessionId: string,
  text: string
): Promise<string> {
  const response = await fetch(SERVER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Vitest-Session-Recovery-Test/1.0",
    },
    body: JSON.stringify({
      sessionId,
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

/**
 * Helper to navigate to the survey start
 */
async function navigateToSurvey(sessionId: string): Promise<void> {
  // Initial dial
  await sendUssdRequest(sessionId, "");
  // Select Account Menu
  await sendUssdRequest(sessionId, "2");
  // Select Login
  await sendUssdRequest(sessionId, "1");
  // Enter Customer ID (Lead Generator)
  await sendUssdRequest(sessionId, "2*1*C142316B7");
  // Continue after verification
  await sendUssdRequest(sessionId, "2*1*C142316B7*1");
  // Enter PIN
  await sendUssdRequest(sessionId, "2*1*C142316B7*1*10101");
  // Continue after PIN verification
  await sendUssdRequest(sessionId, "2*1*C142316B7*1*10101*1");
  // Continue to Agent Tools
  await sendUssdRequest(sessionId, "2*1*C142316B7*1*10101*1*1");
  // Select 1,000 Day Survey
  await sendUssdRequest(sessionId, "2*1*C142316B7*1*10101*1*1*2");
}

describe("1000 Day Survey - Session Recovery", () => {
  beforeAll(() => {
    console.log("🚀 Starting session recovery tests");
    console.log(`📡 Server: ${SERVER_URL}`);
    console.log(`📱 Phone: ${PHONE_NUMBER}`);
  });

  afterAll(() => {
    console.log("✅ Session recovery tests completed");
  });

  it("Test Case 1: Resume after answering Question 1 (Beneficiary Category)", async () => {
    const customerId = `CTEST${Date.now().toString().slice(-5)}`;
    const sessionId1 = `recovery-test-1-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // First session: Answer Question 1 only
    await navigateToSurvey(sessionId1);

    // Enter Customer ID - should go directly to Question 1
    let response = await sendUssdRequest(
      sessionId1,
      `2*1*C142316B7*1*10101*1*1*2*${customerId}`
    );
    expect(response).toContain("Select all TRUE options for your household");

    // Answer Question 1: Pregnant Woman (option 1)
    response = await sendUssdRequest(
      sessionId1,
      `2*1*C142316B7*1*10101*1*1*2*${customerId}*1`
    );

    // Session ends here (simulating interruption)

    // Second session: Resume and verify it goes to Question 2 (Price Specification)
    const sessionId2 = `recovery-test-1-resume-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    await navigateToSurvey(sessionId2);

    // Enter same Customer ID - should resume at Price Specification
    response = await sendUssdRequest(
      sessionId2,
      `2*1*C142316B7*1*10101*1*1*2*${customerId}`
    );

    // Verify we're at Price Specification, not Beneficiary Category
    expect(response).toContain("How much are you willing to pay");
    expect(response).not.toContain(
      "Select all TRUE options for your household"
    );
  });

  it("Test Case 2: Resume with conditional question (child selected)", async () => {
    const customerId = `CTEST${Date.now().toString().slice(-5)}`;
    const sessionId1 = `recovery-test-2-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // First session: Answer Question 1 with child selected
    await navigateToSurvey(sessionId1);

    // Enter Customer ID - should go directly to Question 1
    await sendUssdRequest(
      sessionId1,
      `2*1*C142316B7*1*10101*1*1*2*${customerId}`
    );

    // Answer Question 1 with "Child under 2 years" (option 3)
    let response = await sendUssdRequest(
      sessionId1,
      `2*1*C142316B7*1*10101*1*1*2*${customerId}*3`
    );

    // Session ends here

    // Second session: Resume and verify it goes to Child Age question
    const sessionId2 = `recovery-test-2-resume-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    await navigateToSurvey(sessionId2);

    // Enter same Customer ID - should resume at Child Age
    response = await sendUssdRequest(
      sessionId2,
      `2*1*C142316B7*1*10101*1*1*2*${customerId}`
    );

    // Verify we're at Child Age question
    expect(response).toContain("What is the child's age in months");
  });

  it("Test Case 3: Resume after multiple questions answered", async () => {
    const customerId = `CTEST${Date.now().toString().slice(-5)}`;
    const sessionId1 = `recovery-test-3-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // First session: Answer Questions 1 and 2
    await navigateToSurvey(sessionId1);

    // Q1: Pregnant Woman - no child (option 1)
    await sendUssdRequest(
      sessionId1,
      `2*1*C142316B7*1*10101*1*1*2*${customerId}`
    );
    await sendUssdRequest(
      sessionId1,
      `2*1*C142316B7*1*10101*1*1*2*${customerId}*1`
    );

    // Q2: Price specification (e.g. 10)
    await sendUssdRequest(
      sessionId1,
      `2*1*C142316B7*1*10101*1*1*2*${customerId}*1*10`
    );

    // Session ends here

    // Second session: Resume and verify it goes to Q3 (Awareness Iron Beans)
    const sessionId2 = `recovery-test-3-resume-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    await navigateToSurvey(sessionId2);

    const response = await sendUssdRequest(
      sessionId2,
      `2*1*C142316B7*1*10101*1*1*2*${customerId}`
    );

    // Verify we're at Awareness Iron Beans question
    expect(response).toContain(
      "Have you ever heard about iron-fortified beans"
    );
  });
});
