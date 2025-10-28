import { SessionFixture } from "../../tests/helpers/session-recorder.js";

/**
 * VitestGenerator generates Vitest test files from SessionFixture objects.
 *
 * The generated tests replay the session against a running USSD server via HTTP,
 * comparing actual responses with expected responses from the recorded session.
 *
 * @example
 * ```typescript
 * const generator = new VitestGenerator();
 * const testCode = generator.generateTestFile(fixture, 'login-flow');
 * fs.writeFileSync('tests/flows/login-flow.test.ts', testCode);
 * ```
 */
export class VitestGenerator {
  /**
   * Generate a complete Vitest test file from a SessionFixture
   *
   * @param fixture - The session fixture containing conversation turns
   * @param flowName - Name of the flow (used for test suite name and filename)
   * @returns Complete TypeScript test file content as a string
   */
  generateTestFile(fixture: SessionFixture, flowName: string): string {
    const parts: string[] = [];

    // Add file header comment
    parts.push(this.generateFileHeader(fixture, flowName));

    // Add imports
    parts.push(this.generateImports());

    // Add test configuration constants
    parts.push(this.generateTestConfig(fixture));

    // Add helper function for HTTP requests
    parts.push(this.generateHttpHelper());

    // Add main test suite
    parts.push(this.generateTestSuite(fixture, flowName));

    return parts.join("\n\n");
  }

  /**
   * Generate file header comment with metadata
   */
  private generateFileHeader(
    fixture: SessionFixture,
    flowName: string
  ): string {
    return `/**
 * Generated Test: ${flowName}
 *
 * This test was automatically generated from a recorded USSD session.
 *
 * Session Details:
 * - Flow: ${fixture.flowName}
 * - Session ID: ${fixture.sessionId}
 * - Phone: ${fixture.phoneNumber}
 * - Service Code: ${fixture.serviceCode}
 * - Recorded: ${fixture.timestamp}
 * - Turns: ${fixture.turns.length}
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
 *    pnpm test tests/flows/${flowName}.test.ts  # Won't work
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
 * 3. Run: pnpm generate:test <log-file> ${flowName}
 *
 * @generated
 */`;
  }

  /**
   * Generate import statements
   */
  private generateImports(): string {
    return `import { describe, it, expect, beforeAll, afterAll } from "vitest";`;
  }

  /**
   * Generate test configuration constants
   */
  private generateTestConfig(fixture: SessionFixture): string {
    return `// Test Configuration
const SERVER_URL = process.env.USSD_TEST_SERVER_URL || "http://127.0.0.1:3005/api/ussd";
const SESSION_ID = "${fixture.sessionId}";
const PHONE_NUMBER = "${fixture.phoneNumber}";
const SERVICE_CODE = "${fixture.serviceCode}";
const REQUEST_TIMEOUT = 5000; // 5 seconds`;
  }

  /**
   * Generate HTTP helper function
   */
  private generateHttpHelper(): string {
    return `/**
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
    throw new Error(\`Server returned error: \${response.status} \${errorText}\`);
  }

  return response.text();
}`;
  }

  /**
   * Generate main test suite with all test cases
   */
  private generateTestSuite(fixture: SessionFixture, flowName: string): string {
    const parts: string[] = [];

    // Start describe block
    parts.push(`describe("${flowName} - USSD Flow Test", () => {`);

    // Add beforeAll hook
    parts.push(this.indent(this.generateBeforeAll(), 1));

    // Add afterAll hook
    parts.push(this.indent(this.generateAfterAll(), 1));

    // Generate test case for each turn with cumulative text
    fixture.turns.forEach((turn, index) => {
      // Build cumulative text from all previous turns
      const cumulativeText = this.buildCumulativeText(fixture.turns, index);
      parts.push(
        this.indent(this.generateTestCase(turn, index, cumulativeText), 1)
      );
    });

    // Close describe block
    parts.push("});");

    return parts.join("\n\n");
  }

  /**
   * Build cumulative USSD text for a given turn index
   * USSD requires cumulative input like "1*2*3" not individual inputs
   */
  private buildCumulativeText(
    turns: Array<{ textSent: string }>,
    currentIndex: number
  ): string {
    const inputs: string[] = [];

    for (let i = 0; i <= currentIndex; i++) {
      const input = turns[i].textSent;
      // Only add non-empty inputs (skip initial dial)
      if (input !== "") {
        inputs.push(input);
      }
    }

    return inputs.join("*");
  }

  /**
   * Generate beforeAll hook
   */
  private generateBeforeAll(): string {
    return `beforeAll(() => {
  console.log("🚀 Starting USSD flow test");
  console.log(\`📡 Server: \${SERVER_URL}\`);
  console.log(\`📱 Phone: \${PHONE_NUMBER}\`);
  console.log(\`🔢 Service: \${SERVICE_CODE}\`);
});`;
  }

  /**
   * Generate afterAll hook
   */
  private generateAfterAll(): string {
    return `afterAll(() => {
  console.log("✅ USSD flow test completed");
});`;
  }

  /**
   * Generate a single test case for a conversation turn
   */
  private generateTestCase(
    turn: { textSent: string; serverReply: string; timestamp: string },
    index: number,
    cumulativeText: string
  ): string {
    const turnNumber = index + 1;
    const inputDescription =
      turn.textSent === "" ? "Initial dial" : `Input: "${turn.textSent}"`;
    // Escape the input description for use in the test name
    const escapedDescription = this.escapeString(inputDescription);
    const escapedCumulativeText = this.escapeString(cumulativeText);
    const escapedExpected = this.escapeString(turn.serverReply);

    // Add 2-second delay for all turns except the first (to simulate realistic user interaction)
    // Turn 1 is the initial dial and doesn't need a delay
    const delayCode =
      turnNumber > 1
        ? `\n  // Simulate realistic user interaction timing (2-second delay)\n  await new Promise(resolve => setTimeout(resolve, 2000));\n`
        : "";

    // Add comment explaining cumulative text if not initial dial
    const cumulativeComment =
      cumulativeText !== "" && cumulativeText !== turn.textSent
        ? `\n  // Cumulative USSD text: "${escapedCumulativeText}"`
        : "";

    return `it("Turn ${turnNumber}: ${escapedDescription}", async () => {${delayCode}${cumulativeComment}
  // Send user input (USSD requires cumulative text)
  const response = await sendUssdRequest("${escapedCumulativeText}");

  // Expected server response
  const expected = "${escapedExpected}";

  // Assert response matches expected
  expect(response).toBe(expected);
}, 10000); // 10 second timeout for this test`;
  }

  /**
   * Escape special characters in strings for TypeScript code
   */
  private escapeString(str: string): string {
    return str
      .replace(/\\/g, "\\\\") // Escape backslashes
      .replace(/"/g, '\\"') // Escape double quotes
      .replace(/\n/g, "\\n") // Escape newlines
      .replace(/\r/g, "\\r") // Escape carriage returns
      .replace(/\t/g, "\\t"); // Escape tabs
  }

  /**
   * Indent text by a number of levels (2 spaces per level)
   */
  private indent(text: string, levels: number): string {
    const indentation = "  ".repeat(levels);
    return text
      .split("\n")
      .map(line => (line.trim() ? indentation + line : line))
      .join("\n");
  }

  /**
   * Validate that generated code is syntactically valid TypeScript
   * This is a basic check - full validation would require TypeScript compiler
   */
  validateGeneratedCode(code: string): boolean {
    try {
      // Basic syntax checks
      if (!code.includes("describe(")) {
        throw new Error("Missing describe block");
      }
      // Note: Empty sessions may not have test cases, so we don't require it()
      if (!code.includes("import")) {
        throw new Error("Missing imports");
      }

      // Check for balanced braces
      const openBraces = (code.match(/{/g) || []).length;
      const closeBraces = (code.match(/}/g) || []).length;
      if (openBraces !== closeBraces) {
        throw new Error("Unbalanced braces");
      }

      // Check for balanced parentheses
      const openParens = (code.match(/\(/g) || []).length;
      const closeParens = (code.match(/\)/g) || []).length;
      if (openParens !== closeParens) {
        throw new Error("Unbalanced parentheses");
      }

      return true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        "❌ Generated code validation failed:",
        error instanceof Error ? error.message : String(error)
      );
      return false;
    }
  }
}
