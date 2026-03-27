import { SessionFixture } from "../helpers/session-recorder.js";

/**
 * Metadata that controls how generated tests handle dynamic values like Customer IDs.
 */
export interface FlowMetadata {
  /** If true, this flow needs to query DB for customer ID before running */
  needsCustomerId?: boolean;
  /** If true, promote first customer to lead_generator before this flow */
  needsLeadGeneratorPromotion?: boolean;
  /** If true, this flow needs a second customer ID (for agent activation) */
  needsSecondCustomerId?: boolean;
  /** Placeholder customer ID used during recording (will be replaced at runtime) */
  recordedCustomerId?: string;
  /** Second placeholder customer ID used during recording */
  recordedSecondCustomerId?: string;
  /** If true, response contains a generated Customer ID — use regex matching */
  hasCustomerIdInResponse?: boolean;
  /** If true, login success responses use regex matching for customer name */
  hasLoginSuccessResponse?: boolean;
  /** If true, responses containing role-dependent menus use flexible matching */
  hasRoleDependentMenu?: boolean;
}

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
   * @param metadata - Optional metadata for dynamic value handling
   * @returns Complete TypeScript test file content as a string
   */
  generateTestFile(fixture: SessionFixture, flowName: string, metadata?: FlowMetadata): string {
    const parts: string[] = [];

    // Add file header comment
    parts.push(this.generateFileHeader(fixture, flowName));

    // Add imports
    parts.push(this.generateImports(metadata));

    // Add DB-aware module-level variables
    if (metadata?.needsCustomerId) {
      parts.push(this.generateDbVariables(metadata));
    }

    // Add test configuration constants
    parts.push(this.generateTestConfig(fixture));

    // Add helper function for HTTP requests
    parts.push(this.generateHttpHelper());

    // Add main test suite
    parts.push(this.generateTestSuite(fixture, flowName, metadata));

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
   * Generate DB-aware module-level variables
   */
  private generateDbVariables(metadata: FlowMetadata): string {
    const lines: string[] = [];
    lines.push(`// Dynamic Customer IDs — resolved from DB at runtime`);
    lines.push(`let CUSTOMER_ID: string;`);
    if (metadata.needsSecondCustomerId) {
      lines.push(`let SECOND_CUSTOMER_ID: string;`);
    }
    return lines.join("\n");
  }

  /**
   * Generate import statements
   */
  private generateImports(metadata?: FlowMetadata): string {
    const lines: string[] = [];
    lines.push(`import { describe, it, expect, beforeAll, afterAll } from "vitest";`);
    if (metadata?.needsCustomerId) {
      const helpers = ["getFirstCustomerId"];
      if (metadata.needsSecondCustomerId) helpers.push("getCustomerIds");
      if (metadata.needsLeadGeneratorPromotion) helpers.push("promoteToLeadGenerator");
      helpers.push("closeDbPool");
      lines.push(`import { ${helpers.join(", ")} } from "./setup.js";`);
    }
    return lines.join("\n");
  }

  /**
   * Generate test configuration constants
   */
  private generateTestConfig(fixture: SessionFixture): string {
    // Sanitize flow name for use in session ID (remove non-alphanumeric characters, convert to lowercase)
    const flowNameForId = fixture.flowName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-");

    return `// Test Configuration
const SERVER_URL = process.env.USSD_TEST_SERVER_URL || "http://127.0.0.1:3005/api/ussd";
// Dynamic session ID to prevent conflicts when running tests multiple times
const SESSION_ID = \`flow-test-${flowNameForId}-\${Date.now()}-\${Math.random().toString(36).substring(2, 9)}\`;
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
  private generateTestSuite(fixture: SessionFixture, flowName: string, metadata?: FlowMetadata): string {
    const parts: string[] = [];

    // Start describe block
    parts.push(`describe("${flowName} - USSD Flow Test", () => {`);

    // Add beforeAll hook
    parts.push(this.indent(this.generateBeforeAll(metadata), 1));

    // Add afterAll hook
    parts.push(this.indent(this.generateAfterAll(metadata), 1));

    // Generate test case for each turn with cumulative text
    fixture.turns.forEach((turn, index) => {
      // Build cumulative text from all previous turns
      const cumulativeText = this.buildCumulativeText(fixture.turns, index);
      parts.push(
        this.indent(this.generateTestCase(turn, index, cumulativeText, metadata), 1)
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

    // Note: Exit input "*" becomes "prev*inputs**" in cumulative form.
    // This is correct — parseInput handles "**" as an exit signal.
    return inputs.join("*");
  }

  /**
   * Generate beforeAll hook
   */
  private generateBeforeAll(metadata?: FlowMetadata): string {
    const lines: string[] = [];
    lines.push(`beforeAll(async () => {`);

    if (metadata?.needsCustomerId) {
      lines.push(`  CUSTOMER_ID = await getFirstCustomerId();`);
      lines.push(`  console.log(\`🔑 Customer ID from DB: \${CUSTOMER_ID}\`);`);
    }
    if (metadata?.needsSecondCustomerId) {
      lines.push(`  const ids = await getCustomerIds();`);
      lines.push(`  SECOND_CUSTOMER_ID = ids[1];`);
      lines.push(`  console.log(\`🔑 Second Customer ID from DB: \${SECOND_CUSTOMER_ID}\`);`);
    }
    if (metadata?.needsLeadGeneratorPromotion) {
      lines.push(`  await promoteToLeadGenerator(CUSTOMER_ID);`);
      lines.push(`  console.log(\`👑 Promoted \${CUSTOMER_ID} to lead_generator\`);`);
    }

    lines.push(`  console.log("🚀 Starting USSD flow test");`);
    lines.push(`  console.log(\`📡 Server: \${SERVER_URL}\`);`);
    lines.push(`  console.log(\`📱 Phone: \${PHONE_NUMBER}\`);`);
    lines.push(`  console.log(\`🔢 Service: \${SERVICE_CODE}\`);`);
    lines.push(`});`);
    return lines.join("\n");
  }

  /**
   * Generate afterAll hook
   */
  private generateAfterAll(metadata?: FlowMetadata): string {
    if (metadata?.needsCustomerId) {
      return `afterAll(async () => {
  await closeDbPool();
  console.log("✅ USSD flow test completed");
});`;
    }
    return `afterAll(() => {
  console.log("✅ USSD flow test completed");
});`;
  }

  /**
   * Check if a string contains a recorded Customer ID that should be replaced
   */
  private containsRecordedId(text: string, metadata?: FlowMetadata): boolean {
    if (!metadata) return false;
    if (metadata.recordedCustomerId && text.includes(metadata.recordedCustomerId)) return true;
    if (metadata.recordedSecondCustomerId && text.includes(metadata.recordedSecondCustomerId)) return true;
    return false;
  }

  /**
   * Replace recorded Customer IDs with template literal expressions.
   * Returns the string with `${CUSTOMER_ID}` or `${SECOND_CUSTOMER_ID}` substituted.
   */
  private substituteCustomerIds(text: string, metadata: FlowMetadata): string {
    let result = text;
    if (metadata.recordedCustomerId) {
      result = result.split(metadata.recordedCustomerId).join("${CUSTOMER_ID}");
    }
    if (metadata.recordedSecondCustomerId) {
      result = result.split(metadata.recordedSecondCustomerId).join("${SECOND_CUSTOMER_ID}");
    }
    return result;
  }

  /**
   * Escape a string for use inside a template literal (backtick-delimited).
   * Only backticks and ${} need escaping (newlines etc. are still escaped for readability).
   */
  private escapeForTemplateLiteral(str: string): string {
    return str
      .replace(/\\/g, "\\\\")
      .replace(/`/g, "\\`")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t");
  }

  /**
   * Check whether a server reply contains a newly generated Customer ID (account creation).
   * These responses have a Customer ID we can't predict, so we use regex matching.
   */
  private responseHasDynamicCustomerId(reply: string, metadata?: FlowMetadata): boolean {
    if (!metadata?.hasCustomerIdInResponse) return false;
    // Check for the known pattern: "Your Customer ID: C..."
    return /Your Customer ID: C[0-9A-F]+/.test(reply);
  }

  /**
   * Check whether a server reply is a login success message.
   * These contain the customer name which varies depending on which account was created first.
   * Pattern: "CON Welcome, <name>!\nLogin successful for Customer ID: <id>.\n1. Continue"
   */
  private isLoginSuccessResponse(reply: string, metadata?: FlowMetadata): boolean {
    if (!metadata?.hasLoginSuccessResponse) return false;
    return reply.includes("Welcome, ") && reply.includes("Login successful for Customer ID:");
  }

  /**
   * Check whether a server reply contains a role-dependent menu heading.
   * During replay, the customer role may differ from the recording if previous tests
   * promoted the account. Use flexible matching for "Customer Tools" vs "Agent Tools".
   */
  private isRoleDependentMenu(reply: string, metadata?: FlowMetadata): boolean {
    if (!metadata?.hasRoleDependentMenu) return false;
    return /CON (Customer|Agent) Tools/.test(reply);
  }

  /**
   * Generate a single test case for a conversation turn
   */
  private generateTestCase(
    turn: { textSent: string; serverReply: string; timestamp: string },
    index: number,
    cumulativeText: string,
    metadata?: FlowMetadata,
  ): string {
    const turnNumber = index + 1;
    const inputDescription =
      turn.textSent === "" ? "Initial dial" : `Input: "${turn.textSent}"`;
    const escapedDescription = this.escapeString(inputDescription);

    // Add 2-second delay for all turns except the first
    const delayCode =
      turnNumber > 1
        ? `\n  // Simulate realistic user interaction timing (2-second delay)\n  await new Promise(resolve => setTimeout(resolve, 2000));\n`
        : "";

    // Determine whether we need template literals for dynamic Customer IDs
    const inputHasId = this.containsRecordedId(cumulativeText, metadata);
    const responseHasId = this.containsRecordedId(turn.serverReply, metadata);
    const responseHasDynamic = this.responseHasDynamicCustomerId(turn.serverReply, metadata);
    const isLoginSuccess = this.isLoginSuccessResponse(turn.serverReply, metadata);
    const isRoleMenu = this.isRoleDependentMenu(turn.serverReply, metadata);

    // Build the sendUssdRequest argument
    let requestArg: string;
    if (inputHasId && metadata) {
      const substituted = this.substituteCustomerIds(cumulativeText, metadata);
      const escaped = this.escapeForTemplateLiteral(substituted);
      // Restore the ${...} expressions (they were not double-escaped because we used split/join)
      requestArg = `\`${escaped}\``;
    } else {
      requestArg = `"${this.escapeString(cumulativeText)}"`;
    }

    // Build cumulative comment
    const cumulativeComment =
      cumulativeText !== "" && cumulativeText !== turn.textSent
        ? `\n  // Cumulative USSD text: "${this.escapeString(cumulativeText)}"`
        : "";

    // Build assertion
    let assertionBlock: string;

    if (responseHasDynamic) {
      // Account creation response — Customer ID is newly generated, use regex/contains
      const parts = turn.serverReply.split(/C[0-9A-F]+/);
      const assertions: string[] = [];
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed) {
          // Use the first substantial chunk for toContain
          const escapedPart = this.escapeString(trimmed.split("\n")[0]);
          if (escapedPart.length > 5) {
            assertions.push(`  expect(response).toContain("${escapedPart}");`);
          }
        }
      }
      assertions.push(`  expect(response).toMatch(/Your Customer ID: C[0-9A-F]+/);`);
      assertionBlock = assertions.join("\n");
    } else if (isLoginSuccess) {
      // Login success response — customer name is dynamic (depends on which account was created first)
      assertionBlock = `  // Login success — customer name and ID are dynamic
  expect(response).toMatch(/CON Welcome, .+!\\nLogin successful for Customer ID: C[0-9A-F]+\\.\\n1\\. Continue/);`;
    } else if (isRoleMenu) {
      // Role-dependent menu — could be "Customer Tools" or "Agent Tools" depending on role state
      // Extract menu items after the heading to still validate them
      const menuBody = turn.serverReply.replace(/CON (Customer|Agent) Tools/, "").trim();
      const escapedMenuBody = this.escapeString(menuBody);
      assertionBlock = `  // Role-dependent menu heading — customer may have been promoted to lead_generator
  expect(response).toMatch(/CON (Customer|Agent) Tools/);
  expect(response).toContain("${escapedMenuBody}");`;
    } else if (responseHasId && metadata) {
      // Response contains a known Customer ID — substitute and use template literal
      const substituted = this.substituteCustomerIds(turn.serverReply, metadata);
      const escaped = this.escapeForTemplateLiteral(substituted);
      assertionBlock = `  // Expected server response (with dynamic Customer ID)
  const expected = \`${escaped}\`;

  // Assert response matches expected
  expect(response).toBe(expected);`;
    } else {
      // Static response — simple string comparison
      const escapedExpected = this.escapeString(turn.serverReply);
      assertionBlock = `  // Expected server response
  const expected = "${escapedExpected}";

  // Assert response matches expected
  expect(response).toBe(expected);`;
    }

    return `it("Turn ${turnNumber}: ${escapedDescription}", async () => {${delayCode}${cumulativeComment}
  // Send user input (USSD requires cumulative text)
  const response = await sendUssdRequest(${requestArg});

${assertionBlock}
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
      console.error(
        "❌ Generated code validation failed:",
        error instanceof Error ? error.message : String(error)
      );
      return false;
    }
  }
}
