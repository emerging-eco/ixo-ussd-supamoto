#!/usr/bin/env ts-node
/**
 * Record All USSD Flows
 *
 * Programmatically walks every USSD user flow against a running server,
 * generating JSON fixture files and Vitest test files.
 *
 * Usage:
 *   pnpm record:flows
 *
 * Prerequisites:
 *   - USSD server running at SERVER_URL (default: http://127.0.0.1:3005/api/ussd)
 *   - PostgreSQL database accessible via DATABASE_URL
 *   - Clean/seeded database state
 *
 * Environment Variables:
 *   - SERVER_URL: Override USSD server endpoint
 *   - DATABASE_URL: PostgreSQL connection string for mid-flow DB queries
 */

import fs from "fs";
import path from "path";
import pg from "pg";
import { SessionFixture } from "../helpers/session-recorder.js";
import { VitestGenerator, FlowMetadata } from "../utils/vitest-generator.js";

// ──────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────
const SERVER_URL =
  process.env.SERVER_URL || "http://127.0.0.1:3005/api/ussd";
const DATABASE_URL = process.env.DATABASE_URL;
const PHONE_NUMBER = "+260971230001";
const SERVICE_CODE = "*2233#";
const FIXTURES_DIR = path.join(process.cwd(), "tests", "fixtures", "flows");
const REQUEST_DELAY_MS = 500;

// PIN used during account creation flows (user-chosen, 5 digits)
const TEST_PIN = "12345";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
interface FlowStep {
  input: string; // Individual user input for this turn
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
let sessionCounter = 0;

function generateSessionId(flowName: string): string {
  sessionCounter++;
  const ts = Date.now();
  return `rec-${flowName.replace(/[^a-zA-Z0-9-]/g, "")}-${ts}-${sessionCounter}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build cumulative USSD text from individual inputs up to the given index.
 * Initial dial (empty string "") is skipped in cumulation.
 */
function buildCumulativeText(inputs: string[], upToIndex: number): string {
  const parts: string[] = [];
  for (let i = 0; i <= upToIndex; i++) {
    if (inputs[i] !== "") {
      parts.push(inputs[i]);
    }
  }
  return parts.join("*");
}

/**
 * Send a single USSD request and return the raw response text.
 */
async function sendUssdRequest(
  sessionId: string,
  cumulativeText: string
): Promise<string> {
  const response = await fetch(SERVER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "FlowRecorder/1.0",
    },
    body: JSON.stringify({
      sessionId,
      serviceCode: SERVICE_CODE,
      phoneNumber: PHONE_NUMBER,
      text: cumulativeText,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Server error ${response.status}: ${errorText}`);
  }

  return response.text();
}

// ──────────────────────────────────────────────
// Database helpers
// ──────────────────────────────────────────────
let dbPool: pg.Pool | null = null;

function getDbPool(): pg.Pool {
  if (!dbPool) {
    if (!DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is required for DB queries");
    }
    dbPool = new pg.Pool({ connectionString: DATABASE_URL });
  }
  return dbPool;
}

async function dbQuery(sql: string, params: any[] = []): Promise<any[]> {
  const pool = getDbPool();
  const result = await pool.query(sql, params);
  return result.rows;
}

async function getFirstCustomerId(): Promise<string | null> {
  const rows = await dbQuery(
    "SELECT customer_id FROM customers ORDER BY created_at ASC LIMIT 1"
  );
  return rows.length > 0 ? rows[0].customer_id : null;
}

async function getCustomerIds(): Promise<string[]> {
  const rows = await dbQuery(
    "SELECT customer_id FROM customers ORDER BY created_at ASC"
  );
  return rows.map((r: any) => r.customer_id);
}

async function updateCustomerRole(customerId: string, role: string): Promise<void> {
  await dbQuery(
    "UPDATE customers SET role = $1 WHERE customer_id = $2",
    [role, customerId]
  );
  console.log(`  📝 Updated role for ${customerId} to '${role}'`);
}

async function closeDb(): Promise<void> {
  if (dbPool) {
    await dbPool.end();
    dbPool = null;
  }
}

// ──────────────────────────────────────────────
// Core recording function
// ──────────────────────────────────────────────
/**
 * Record a single USSD flow by sending a sequence of inputs.
 * Returns a SessionFixture with all recorded turns.
 */
async function recordFlow(
  flowName: string,
  inputs: string[],
  description: string
): Promise<SessionFixture> {
  const sessionId = generateSessionId(flowName);
  console.log(`\n🔴 Recording: ${flowName}`);
  console.log(`   ${description}`);
  console.log(`   Session: ${sessionId}`);
  console.log(`   Steps: ${inputs.length}`);

  const turns: SessionFixture["turns"] = [];

  for (let i = 0; i < inputs.length; i++) {
    const cumulativeText = buildCumulativeText(inputs, i);
    const individualInput = inputs[i];

    try {
      const response = await sendUssdRequest(sessionId, cumulativeText);
      turns.push({
        textSent: individualInput,
        serverReply: response,
        sessionId,
        timestamp: new Date().toISOString(),
      });

      const prefix = response.startsWith("END ") ? "🔚" : "📱";
      console.log(
        `   ${prefix} [${i + 1}/${inputs.length}] "${individualInput}" → ${response.substring(0, 60)}...`
      );

      // Break early if session ended
      if (response.startsWith("END ")) {
        if (i < inputs.length - 1) {
          console.log(`   ⚠️  Session ended early at step ${i + 1}`);
        }
        break;
      }

      await sleep(REQUEST_DELAY_MS);
    } catch (error) {
      console.error(
        `   ❌ Error at step ${i + 1}: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  const fixture: SessionFixture = {
    flowName,
    timestamp: new Date().toISOString(),
    sessionId,
    phoneNumber: PHONE_NUMBER,
    serviceCode: SERVICE_CODE,
    turns,
  };

  console.log(`   ✅ Recorded ${turns.length} turns`);
  return fixture;
}

/**
 * Save a fixture to JSON and generate its test file.
 */
function saveFixtureAndTest(fixture: SessionFixture, metadata?: FlowMetadata): void {
  // Ensure directory exists
  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  }

  // Save JSON fixture (no timestamp prefix - use flow name directly)
  const jsonPath = path.join(FIXTURES_DIR, `${fixture.flowName}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(fixture, null, 2));
  console.log(`   📁 Saved fixture: ${jsonPath}`);

  // Generate test file
  const generator = new VitestGenerator();
  const testCode = generator.generateTestFile(fixture, fixture.flowName, metadata);
  const testPath = path.join(FIXTURES_DIR, `${fixture.flowName}.test.ts`);
  fs.writeFileSync(testPath, testCode);
  console.log(`   📝 Generated test: ${testPath}`);
}

/**
 * Delete all existing stale .json and .test.ts files in fixtures/flows/
 * Preserves setup.ts
 */
function cleanFixturesDir(): void {
  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
    return;
  }

  const files = fs.readdirSync(FIXTURES_DIR);
  let deleted = 0;
  for (const file of files) {
    if (file === "setup.ts") continue;
    if (file.endsWith(".test.ts") || file.endsWith(".json")) {
      fs.unlinkSync(path.join(FIXTURES_DIR, file));
      deleted++;
    }
  }
  console.log(`🗑️  Cleaned ${deleted} stale files from ${FIXTURES_DIR}`);
}


// ──────────────────────────────────────────────
// Main recording orchestrator
// ──────────────────────────────────────────────
async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  USSD Flow Recorder — Recording all 17 flows");
  console.log(`  Server: ${SERVER_URL}`);
  console.log(`  Phone: ${PHONE_NUMBER}`);
  console.log(`  Output: ${FIXTURES_DIR}`);
  console.log("═══════════════════════════════════════════════════════════════");

  // Step 0: Clean existing fixtures
  cleanFixturesDir();

  // Track fixtures alongside their metadata for test generation
  const recorded: Array<{ fixture: SessionFixture; metadata?: FlowMetadata }> = [];
  let customerId: string | null = null;

  try {
    // ════════════════════════════════════════════
    // Phase 1: Pre-auth flows (1-2) — Empty DB
    // ════════════════════════════════════════════
    console.log("\n\n═══ Phase 1: Pre-auth flows ═══");

    // Flow 1: know-more-flow
    recorded.push({
      fixture: await recordFlow("01-know-more-flow", [
        "",   // Initial dial → welcome menu
        "1",  // Know More → info menu
        "1",  // How it works → info page
        "0",  // Back → info menu
        "4",  // More Information → SMS prompt
        "1",  // Yes, send SMS → confirmation
        "0",  // Back → info menu
        "0",  // Back → main menu
      ], "Browse know more menu, send SMS, navigate back"),
    });

    // Flow 2: know-more-back-navigation
    recorded.push({
      fixture: await recordFlow("01-know-more-back-navigation", [
        "",   // Initial dial → welcome menu
        "1",  // Know More → info menu
        "2",  // Why SupaMoto → info page
        "0",  // Back → info menu
        "3",  // Requirements → info page
        "0",  // Back → info menu
        "0",  // Back → main menu
      ], "Navigate forward and back through know more menu"),
    });

    // ════════════════════════════════════════════
    // Phase 2: Account creation flows (3-7)
    // ════════════════════════════════════════════
    console.log("\n\n═══ Phase 2: Account creation flows ═══");

    // Flow 3: create-account-full
    recorded.push({
      fixture: await recordFlow("02-create-account-full", [
        "",                // Initial dial → welcome menu
        "2",               // Account Menu → account menu
        "2",               // Create Account → enter name
        "John Doe",        // Name → enter email
        "john@test.com",   // Email → enter national ID
        "123456/12/1",     // National ID → enter PIN
        TEST_PIN,          // PIN → confirm PIN
        TEST_PIN,          // Confirm PIN → creating account...
        "1",               // View Customer ID → success page
        "1",               // Continue → main menu
      ], "Full account creation with all fields"),
      metadata: { hasCustomerIdInResponse: true },
    });

    // Flow 4: create-account-skip-email
    recorded.push({
      fixture: await recordFlow("02-create-account-skip-email", [
        "",                // Initial dial
        "2",               // Account Menu
        "2",               // Create Account → enter name
        "Jane Smith",      // Name → enter email
        "00",              // Skip email → enter national ID
        "654321/98/7",     // National ID → enter PIN
        TEST_PIN,          // PIN → confirm PIN
        TEST_PIN,          // Confirm PIN → creating account
        "1",               // View Customer ID
        "1",               // Continue
      ], "Account creation skipping email"),
      metadata: { hasCustomerIdInResponse: true },
    });

    // Flow 5: create-account-skip-national-id
    recorded.push({
      fixture: await recordFlow("02-create-account-skip-national-id", [
        "",                // Initial dial
        "2",               // Account Menu
        "2",               // Create Account → enter name
        "Bob Wilson",      // Name → enter email
        "bob@test.com",    // Email → enter national ID
        "00",              // Skip national ID → enter PIN
        TEST_PIN,          // PIN → confirm PIN
        TEST_PIN,          // Confirm PIN → creating account
        "1",               // View Customer ID
        "1",               // Continue
      ], "Account creation skipping national ID"),
      metadata: { hasCustomerIdInResponse: true },
    });

    // Flow 6: create-account-skip-both
    recorded.push({
      fixture: await recordFlow("02-create-account-skip-both", [
        "",                // Initial dial
        "2",               // Account Menu
        "2",               // Create Account → enter name
        "Alice Brown",     // Name → enter email
        "00",              // Skip email → enter national ID
        "00",              // Skip national ID → enter PIN
        TEST_PIN,          // PIN → confirm PIN
        TEST_PIN,          // Confirm PIN → creating account
        "1",               // View Customer ID
        "1",               // Continue
      ], "Account creation skipping both email and national ID"),
      metadata: { hasCustomerIdInResponse: true },
    });

    // Flow 7: create-account-pin-mismatch
    recorded.push({
      fixture: await recordFlow("02-create-account-pin-mismatch", [
        "",                // Initial dial
        "2",               // Account Menu
        "2",               // Create Account → enter name
        "Charlie Davis",   // Name → enter email
        "00",              // Skip email
        "00",              // Skip national ID → enter PIN
        TEST_PIN,          // PIN → confirm PIN
        "99999",           // Wrong confirm PIN → mismatch error, back to PIN entry
        TEST_PIN,          // Re-enter PIN → confirm PIN
        TEST_PIN,          // Correct confirm PIN → creating account
        "1",               // View Customer ID
        "1",               // Continue
      ], "Account creation with PIN mismatch then correct"),
      metadata: { hasCustomerIdInResponse: true },
    });

    // ════════════════════════════════════════════
    // Phase 3: Login flows (8-10) — Uses accounts from Phase 2
    // ════════════════════════════════════════════
    console.log("\n\n═══ Phase 3: Login flows ═══");

    // Query DB for the first customer ID created in flow 3
    customerId = await getFirstCustomerId();
    if (!customerId) {
      throw new Error("No customer found in DB after account creation flows. Did Phase 2 succeed?");
    }
    console.log(`  🔑 Using customer ID from DB: ${customerId}`);

    // Flow 8: login-success
    recorded.push({
      fixture: await recordFlow("03-login-success", [
        "",               // Initial dial → welcome menu
        "2",              // Account Menu
        "1",              // Login → enter customer ID
        customerId,       // Customer ID → enter PIN
        TEST_PIN,         // PIN → verifying credentials...
        "1",              // Continue → login success message
        "1",              // Continue → services menu
        "0",              // Back → main menu
      ], "Successful login with correct credentials"),
      metadata: { needsCustomerId: true, recordedCustomerId: customerId, hasLoginSuccessResponse: true, hasRoleDependentMenu: true },
    });

    // Flow 9: login-wrong-pin
    recorded.push({
      fixture: await recordFlow("03-login-wrong-pin", [
        "",               // Initial dial
        "2",              // Account Menu
        "1",              // Login → enter customer ID
        customerId,       // Customer ID → enter PIN
        "99999",          // Wrong PIN → error + retry prompt
        TEST_PIN,         // Correct PIN → verifying → success
        "1",              // Continue → success
        "1",              // Continue → services menu
        "0",              // Back → main menu
      ], "Login with wrong PIN then correct PIN"),
      metadata: { needsCustomerId: true, recordedCustomerId: customerId, hasLoginSuccessResponse: true, hasRoleDependentMenu: true },
    });

    // Flow 10: login-invalid-customer-id (no dynamic ID needed)
    recorded.push({
      fixture: await recordFlow("03-login-invalid-customer-id", [
        "",               // Initial dial
        "2",              // Account Menu
        "1",              // Login → enter customer ID
        "CNOTEXIST99",    // Invalid customer ID → enter PIN (format valid)
        TEST_PIN,         // PIN → verifying → customer not found error
        "1",              // Continue/acknowledge error
      ], "Login attempt with non-existent customer ID"),
    });

    // ════════════════════════════════════════════
    // Phase 4: Customer services flows (11-12)
    // ════════════════════════════════════════════
    console.log("\n\n═══ Phase 4: Customer services flows ═══");

    // Flow 11: customer-tools-menu
    recorded.push({
      fixture: await recordFlow("04-customer-tools-menu", [
        "",               // Initial dial
        "2",              // Account Menu
        "1",              // Login
        customerId!,      // Customer ID
        TEST_PIN,         // PIN → verifying
        "1",              // Continue → success
        "1",              // Continue → customer tools menu
        "0",              // Back from customer tools → main menu
      ], "Login and browse customer tools menu"),
      metadata: { needsCustomerId: true, recordedCustomerId: customerId!, hasLoginSuccessResponse: true, hasRoleDependentMenu: true },
    });

    // Flow 12: customer-confirm-beans
    recorded.push({
      fixture: await recordFlow("04-customer-confirm-beans", [
        "",               // Initial dial
        "2",              // Account Menu
        "1",              // Login
        customerId!,      // Customer ID
        TEST_PIN,         // PIN → verifying
        "1",              // Continue → success
        "1",              // Continue → customer tools menu
        "1",              // Confirm Receival of Beans → receipt question
        "1",              // Yes → processing/result
        "1",              // Continue/acknowledge → back to tools
      ], "Login and confirm bean receival"),
      metadata: { needsCustomerId: true, recordedCustomerId: customerId!, hasLoginSuccessResponse: true, hasRoleDependentMenu: true },
    });

    // ════════════════════════════════════════════
    // Phase 4.5: SQL UPDATE — Change one account's role to 'lead_generator'
    // ════════════════════════════════════════════
    console.log("\n\n═══ Phase 4.5: SQL UPDATE — Set role to lead_generator ═══");
    await updateCustomerRole(customerId!, "lead_generator");

    // ════════════════════════════════════════════
    // Phase 5: Agent/Lead Generator flows (13-15)
    // ════════════════════════════════════════════
    console.log("\n\n═══ Phase 5: Agent/Lead Generator flows ═══");

    // Get a second customer ID for the activation target
    const allCustomerIds = await getCustomerIds();
    const secondCustomerId = allCustomerIds.length > 1 ? allCustomerIds[1] : null;
    console.log(`  🔑 LG customer ID: ${customerId}`);
    console.log(`  🔑 Target customer ID for activation: ${secondCustomerId || "none"}`);

    // Flow 13: agent-tools-menu
    recorded.push({
      fixture: await recordFlow("05-agent-tools-menu", [
        "",               // Initial dial
        "2",              // Account Menu
        "1",              // Login
        customerId!,      // Customer ID (now LG)
        TEST_PIN,         // PIN → verifying
        "1",              // Continue → success
        "1",              // Continue → agent tools menu
        "0",              // Back → main menu
      ], "Login as lead generator and browse agent tools menu"),
      metadata: {
        needsCustomerId: true,
        needsLeadGeneratorPromotion: true,
        recordedCustomerId: customerId!,
        hasLoginSuccessResponse: true,
      },
    });

    // Flow 14: agent-activate-customer
    recorded.push({
      fixture: await recordFlow("05-agent-activate-customer", [
        "",               // Initial dial
        "2",              // Account Menu
        "1",              // Login
        customerId!,      // LG Customer ID
        TEST_PIN,         // PIN → verifying
        "1",              // Continue → success
        "1",              // Continue → agent tools menu
        "2",              // Activate a Customer → enter customer ID prompt
        secondCustomerId || "CNOTEXIST99", // Target customer ID → enter phone
        "+260971230002",  // Phone number → SMS sending/result
        "1",              // Continue → back to agent tools
      ], "Agent activates a customer via LG flow"),
      metadata: {
        needsCustomerId: true,
        needsSecondCustomerId: true,
        needsLeadGeneratorPromotion: true,
        recordedCustomerId: customerId!,
        recordedSecondCustomerId: secondCustomerId || undefined,
        hasLoginSuccessResponse: true,
      },
    });

    // Flow 15: agent-1000-day-survey
    recorded.push({
      fixture: await recordFlow("05-agent-1000-day-survey", [
        "",               // Initial dial
        "2",              // Account Menu
        "1",              // Login
        customerId!,      // LG Customer ID
        TEST_PIN,         // PIN → verifying
        "1",              // Continue → success
        "1",              // Continue → agent tools menu
        "3",              // 1,000 Day Survey → ask customer ID
        secondCustomerId || "CNOTEXIST99", // Customer ID → processing/first question
        "3",              // Beneficiary: C (Child under 2) → child age question
        "12",             // Child age in months → bean intake frequency
        "3",              // 3-4 times a week → price specification
        "500",            // ZMW amount → awareness question
        "1",              // Yes (heard of iron beans) → knows benefits?
        "1",              // Yes (knows benefits) → benefit 1/5
        "1",              // Yes → benefit 2/5
        "1",              // Yes → benefit 3/5
        "1",              // Yes → benefit 4/5
        "1",              // Yes → benefit 5/5
        "1",              // Yes → antenatal card question
        "1",              // Yes (antenatal card verified) → submitting claim
        "1",              // Continue → claim submitted
        "1",              // Back to agent tools
      ], "Agent completes 1000-day survey for a customer"),
      metadata: {
        needsCustomerId: true,
        needsSecondCustomerId: true,
        needsLeadGeneratorPromotion: true,
        recordedCustomerId: customerId!,
        recordedSecondCustomerId: secondCustomerId || undefined,
        hasLoginSuccessResponse: true,
      },
    });

    // ════════════════════════════════════════════
    // Phase 6: Navigation edge cases (16-17)
    // ════════════════════════════════════════════
    console.log("\n\n═══ Phase 6: Navigation edge cases ═══");

    // Flow 16: exit-from-any-menu
    recorded.push({
      fixture: await recordFlow("06-exit-from-any-menu", [
        "",               // Initial dial → welcome menu
        "1",              // Know More → info menu
        "1",              // How it works → info page
        "*",              // Exit from depth 3 → goodbye/end
      ], "Test exit from deep menu via * input"),
    });

    // Flow 17: back-navigation-chain
    recorded.push({
      fixture: await recordFlow("06-back-navigation-chain", [
        "",               // Initial dial → welcome menu
        "2",              // Account Menu → account menu
        "0",              // Back → welcome menu
        "1",              // Know More → info menu
        "1",              // How it works → info page
        "0",              // Back → info menu
        "0",              // Back → welcome menu
        "2",              // Account Menu → account menu
        "2",              // Create Account → name entry
        "0",              // Back → account menu (back from name entry)
        "0",              // Back → welcome menu
      ], "Navigate deep and back out through multiple menus"),
    });

    // ════════════════════════════════════════════
    // Save all fixtures and generate tests
    // ════════════════════════════════════════════
    console.log("\n\n═══ Saving fixtures and generating tests ═══");

    for (const { fixture, metadata } of recorded) {
      saveFixtureAndTest(fixture, metadata);
    }

    // ════════════════════════════════════════════
    // Summary
    // ════════════════════════════════════════════
    console.log("\n\n═══════════════════════════════════════════════════════════════");
    console.log(`  ✅ Successfully recorded ${recorded.length} flows`);
    console.log(`  📁 Fixtures saved to: ${FIXTURES_DIR}`);
    console.log("═══════════════════════════════════════════════════════════════");

    for (const { fixture } of recorded) {
      const turnCount = fixture.turns.length;
      const lastReply = fixture.turns[turnCount - 1]?.serverReply || "";
      const ended = lastReply.startsWith("END ") ? "🔚" : "📱";
      console.log(`  ${ended} ${fixture.flowName} (${turnCount} turns)`);
    }

  } catch (error) {
    console.error("\n\n❌ FATAL ERROR:", error);
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}

// ──────────────────────────────────────────────
// Entry point
// ──────────────────────────────────────────────
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});