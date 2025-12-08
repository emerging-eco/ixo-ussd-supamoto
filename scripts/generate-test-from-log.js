#!/usr/bin/env node
/**
 * Generate Vitest Test from Session Log
 *
 * This script converts a recorded USSD session log into an executable Vitest test file.
 *
 * Usage:
 *   pnpm generate:test <log-file-path> <flow-name>
 *
 * Example:
 *   pnpm generate:test logs/sessions/session-2025-10-25-05-45-15.log login-flow
 *
 * The generated test will be saved to: tests/flows/<flow-name>.test.ts
 */
import fs from "fs";
import path from "path";
import { SessionLogParser } from "../src/utils/session-log-parser.js";
import { VitestGenerator } from "../src/utils/vitest-generator.js";
// ============================================================================
// ARGUMENT PARSING
// ============================================================================
const args = process.argv.slice(2);
if (args.length < 2) {
    console.error("❌ Error: Missing required arguments\n");
    console.log("Usage: pnpm generate:test <log-file-path> <flow-name>\n");
    console.log("Example:");
    console.log("  pnpm generate:test logs/sessions/session-2025-10-25-05-45-15.log login-flow\n");
    console.log("Arguments:");
    console.log("  <log-file-path>  Path to the session log file");
    console.log("  <flow-name>      Name for the flow (used in test filename)\n");
    process.exit(1);
}
const logFilePath = args[0];
const flowName = args[1];
// ============================================================================
// VALIDATION
// ============================================================================
// Validate log file exists
const resolvedLogPath = path.isAbsolute(logFilePath)
    ? logFilePath
    : path.join(process.cwd(), logFilePath);
if (!fs.existsSync(resolvedLogPath)) {
    console.error(`❌ Error: Log file not found: ${resolvedLogPath}\n`);
    console.log("Please check the file path and try again.\n");
    console.log("Available session logs:");
    const logsDir = path.join(process.cwd(), "logs", "sessions");
    if (fs.existsSync(logsDir)) {
        const logFiles = fs.readdirSync(logsDir).filter(f => f.endsWith(".log"));
        if (logFiles.length > 0) {
            logFiles.forEach(file => {
                console.log(`  - logs/sessions/${file}`);
            });
        }
        else {
            console.log("  (No session logs found)");
        }
    }
    else {
        console.log("  (logs/sessions directory does not exist)");
    }
    console.log("");
    process.exit(1);
}
// Validate flow name
if (!flowName || flowName.trim().length === 0) {
    console.error("❌ Error: Flow name cannot be empty\n");
    process.exit(1);
}
// Sanitize flow name (remove special characters, replace spaces with hyphens)
const sanitizedFlowName = flowName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
if (sanitizedFlowName !== flowName) {
    console.log(`ℹ️  Flow name sanitized: "${flowName}" → "${sanitizedFlowName}"`);
}
// ============================================================================
// MAIN LOGIC
// ============================================================================
console.log("🚀 Generating Vitest test from session log\n");
console.log(`📁 Log file: ${resolvedLogPath}`);
console.log(`🎯 Flow name: ${sanitizedFlowName}\n`);
try {
    // Step 1: Parse the log file
    console.log("📖 Step 1: Parsing session log...");
    const parser = new SessionLogParser();
    const fixture = parser.parseLogFile(resolvedLogPath);
    // Override flow name with user-provided name
    fixture.flowName = sanitizedFlowName;
    console.log(`✅ Parsed successfully`);
    console.log(`   - Session ID: ${fixture.sessionId}`);
    console.log(`   - Phone: ${fixture.phoneNumber}`);
    console.log(`   - Service Code: ${fixture.serviceCode}`);
    console.log(`   - Conversation turns: ${fixture.turns.length}\n`);
    // Validate fixture
    if (!parser.validateFixture(fixture)) {
        throw new Error("Fixture validation failed");
    }
    // Step 2: Generate test code
    console.log("🔨 Step 2: Generating Vitest test code...");
    const generator = new VitestGenerator();
    const testCode = generator.generateTestFile(fixture, sanitizedFlowName);
    console.log(`✅ Generated test code (${testCode.length} characters)\n`);
    // Validate generated code
    if (!generator.validateGeneratedCode(testCode)) {
        throw new Error("Generated code validation failed");
    }
    // Step 3: Save test file
    console.log("💾 Step 3: Saving test file...");
    // Create tests/flows directory if it doesn't exist
    const flowsDir = path.join(process.cwd(), "tests", "flows");
    if (!fs.existsSync(flowsDir)) {
        fs.mkdirSync(flowsDir, { recursive: true });
        console.log(`   Created directory: ${flowsDir}`);
    }
    // Generate test filename
    const testFilename = `${sanitizedFlowName}.test.ts`;
    const testFilePath = path.join(flowsDir, testFilename);
    // Check if file already exists
    if (fs.existsSync(testFilePath)) {
        console.warn(`⚠️  Warning: Test file already exists: ${testFilePath}`);
        console.warn(`   It will be overwritten.\n`);
    }
    // Write test file
    fs.writeFileSync(testFilePath, testCode, "utf-8");
    console.log(`✅ Test file saved: ${testFilePath}\n`);
    // Step 4: Display success message and next steps
    console.log("🎉 Success! Test generated successfully.\n");
    console.log("📋 Next steps:\n");
    console.log("1. Review the generated test:");
    console.log(`   cat ${testFilePath}\n`);
    console.log("2. Start the USSD server (if not already running):");
    console.log(`   pnpm dev\n`);
    console.log("3. Run the generated test:");
    console.log(`   pnpm test:flows:run\n`);
    console.log("   Or run in watch mode:");
    console.log(`   pnpm test:flows\n`);
    console.log("   Or run specific test:");
    console.log(`   pnpm vitest run --config vitest.flows.config.ts ${testFilePath}\n`);
    console.log("   ⚠️  Note: Flow tests require the flow-specific config (vitest.flows.config.ts)");
    console.log("   ⚠️  Do NOT use 'pnpm test ./tests/flows/' - it won't work!\n");
    console.log("4. (Optional) Customize the test as needed");
    console.log(`   Edit: ${testFilePath}\n`);
    process.exit(0);
}
catch (error) {
    console.error("\n❌ Error generating test:\n");
    console.error(error instanceof Error ? error.message : String(error));
    console.error("");
    if (error instanceof Error && error.stack) {
        console.error("Stack trace:");
        console.error(error.stack);
        console.error("");
    }
    console.log("💡 Troubleshooting tips:");
    console.log("- Ensure the log file is a valid session log from pnpm test:interactive");
    console.log("- Check that the log file contains the metadata header");
    console.log("- Verify the log file has at least one conversation turn");
    console.log("");
    process.exit(1);
}
//# sourceMappingURL=generate-test-from-log.js.map