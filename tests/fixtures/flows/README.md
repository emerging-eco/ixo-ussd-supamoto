# Generated Flow Tests

This directory contains automatically generated Vitest tests created from recorded USSD session logs.

## ⚠️ Important: How to Run Flow Tests

Flow tests use a **separate configuration** and **cannot** be run with the default test command.

### ✅ Correct Commands

```bash
# Run all flow tests
pnpm test:flows:run

# Run in watch mode
pnpm test:flows

# Run specific test
pnpm vitest run --config vitest.flows.config.ts tests/flows/know-more-flow.test.ts
```

### ❌ Incorrect Commands (Will NOT Work)

```bash
# These will fail with "No test files found"
pnpm test ./tests/flows/
pnpm test tests/flows/know-more-flow.test.ts
```

**Why?** Flow tests are excluded from the main `vitest.config.ts` because they require a running server and don't use mocked services.

## Overview

Flow tests are integration tests that replay complete USSD interaction flows against a running server. They are generated from session logs captured during interactive testing sessions.

## Workflow

### 1. Record a Session

Start an interactive test session and complete the flow you want to test:

```bash
# Start the USSD server
pnpm dev

# In another terminal, run interactive test
pnpm test:interactive
```

Navigate through the USSD menus to complete your desired flow. The session will be automatically logged to `logs/sessions/session-YYYY-MM-DD-HH-mm-ss.log`.

### 2. Generate Test from Log

After completing your session, generate a test file:

```bash
pnpm generate:test logs/sessions/session-2025-10-25-05-45-15.log login-flow
```

This will:

- Parse the session log
- Extract conversation turns (user inputs and server responses)
- Generate a Vitest test file at `tests/flows/login-flow.test.ts`
- Display next steps

### 3. Run the Generated Test

Run the generated test against your server:

```bash
# Start the server (if not already running)
pnpm dev

# In another terminal, run all flow tests
pnpm test:flows

# Or run in watch mode
pnpm test:flows

# Or run a specific flow test
pnpm vitest run --config vitest.flows.config.ts tests/flows/login-flow.test.ts
```

**Important:** Flow tests use a separate configuration (`vitest.flows.config.ts`) that:

- Does NOT initialize mocked services
- Connects to a real running USSD server
- Uses `tests/flows/setup.ts` instead of the main test setup

### 4. Customize (Optional)

You can edit the generated test file to:

- Add additional assertions
- Modify test descriptions
- Add setup/teardown logic
- Group related tests

## Generated Test Structure

Each generated test file follows this structure:

```typescript
/**
 * Generated Test: flow-name
 *
 * Session Details:
 * - Session ID: ...
 * - Phone: ...
 * - Service Code: ...
 * - Recorded: ...
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";

// Test Configuration
const SERVER_URL =
  process.env.USSD_TEST_SERVER_URL || "http://127.0.0.1:3005/api/ussd";
const SESSION_ID = "...";
const PHONE_NUMBER = "...";
const SERVICE_CODE = "...";

// HTTP Helper Function
async function sendUssdRequest(text: string): Promise<string> {
  // ... makes HTTP POST to USSD endpoint
}

// Test Suite
describe("flow-name - USSD Flow Test", () => {
  beforeAll(() => {
    console.log("🚀 Starting USSD flow test");
  });

  afterAll(() => {
    console.log("✅ USSD flow test completed");
  });

  it("Turn 1: Initial dial", async () => {
    const response = await sendUssdRequest("");
    const expected = "CON Welcome...";
    expect(response).toBe(expected);
  });

  it('Turn 2: Input: "1"', async () => {
    const response = await sendUssdRequest("1");
    const expected = "CON Option 1...";
    expect(response).toBe(expected);
  });

  // ... more test cases for each turn
});
```

## Running Tests

**Prerequisites:** Make sure the USSD server is running before executing flow tests!

```bash
# Terminal 1: Start the server
pnpm dev

# Terminal 2: Run flow tests
```

### Run All Flow Tests

```bash
pnpm test:flows
```

### Run a Specific Flow Test

```bash
pnpm vitest run --config vitest.flows.config.ts tests/flows/login-flow.test.ts
```

### Run in Watch Mode

```bash
pnpm test:flows
# (vitest runs in watch mode by default)
```

## Environment Variables

### USSD_TEST_SERVER_URL

Override the default server URL for tests:

```bash
USSD_TEST_SERVER_URL=http://localhost:3000/api/ussd pnpm test:flows
```

### Why Flow Tests Use a Separate Configuration

Flow tests are **integration tests** that connect to a real running USSD server. They:

- Make actual HTTP POST requests to `/api/ussd`
- Test the complete flow from HTTP request to response
- Verify the entire system works end-to-end

Unlike unit tests, flow tests:

- Do NOT use mocked database services
- Do NOT use mocked IXO blockchain services
- Do NOT use mocked Matrix services
- Require a running server to execute

This is why they use `vitest.flows.config.ts` with `tests/flows/setup.ts` instead of the main test configuration.

## Predefined Flow Test Scripts

For common flows, you can use predefined npm scripts:

```bash
# Run know more flow test
pnpm test:flow:knowmore

# Run login flow test
pnpm test:flow:login

# Run activation flow test
pnpm test:flow:activation
```

## Troubleshooting

### Test Fails: "Server returned error"

**Problem:** The USSD server is not running or not accessible.

**Solution:**

```bash
# Start the server
pnpm dev

# Verify it's running
curl http://127.0.0.1:3005/api/ussd
```

### Test Fails: Response Mismatch

**Problem:** Server response doesn't match expected response.

**Possible causes:**

1. Server code has changed since the session was recorded
2. Database state is different
3. Session state is not clean

**Solutions:**

- Re-record the session and regenerate the test
- Update the expected response in the test file
- Reset database state before running tests
- Use a fresh session ID for each test run

### Test Timeout

**Problem:** Test times out waiting for server response.

**Solution:**

- Increase timeout in test file (default: 10 seconds)
- Check server logs for errors
- Verify server is not overloaded

### Cannot Find Log File

**Problem:** `pnpm generate:test` cannot find the log file.

**Solution:**

```bash
# List available session logs
ls -la logs/sessions/

# Use the full path
pnpm generate:test logs/sessions/session-2025-10-25-05-45-15.log my-flow
```

## Best Practices

### 1. Use Descriptive Flow Names

```bash
# Good
pnpm generate:test logs/sessions/session-*.log customer-activation-flow
pnpm generate:test logs/sessions/session-*.log lead-generator-bean-delivery

# Avoid
pnpm generate:test logs/sessions/session-*.log test1
pnpm generate:test logs/sessions/session-*.log flow
```

### 2. Keep Tests Focused

Each flow test should test a single, complete user journey. If you need to test multiple scenarios, create separate tests.

### 3. Clean Session State

Flow tests automatically use unique session IDs for each test run, preventing session conflicts. For tests that require authentication or specific database state, consider:

- Resetting database state in `beforeAll`
- Creating test-specific user accounts
- Verifying session isolation between test runs

### 4. Document Custom Changes

If you customize a generated test, add comments explaining the changes:

```typescript
it("Turn 3: Login with PIN", async () => {
  // Custom: Using environment variable for test PIN
  const testPin = process.env.TEST_PIN || "12345";
  const response = await sendUssdRequest(testPin);
  expect(response).toContain("Login successful");
});
```

### 5. Version Control

Commit generated tests to version control to:

- Track changes in USSD flows over time
- Enable regression testing in CI/CD
- Share test cases with team members

## Advanced Usage

### Custom Server URL

```typescript
// In generated test file, modify:
const SERVER_URL = "https://staging.example.com/api/ussd";
```

### Dynamic Values

For values that change between runs (e.g., Customer IDs), you can extract and reuse them:

```typescript
it("Turn 2: Create account", async () => {
  const response = await sendUssdRequest("2");

  // Extract Customer ID from response
  const match = response.match(/Customer ID: ([A-Z0-9]+)/);
  const customerId = match ? match[1] : null;

  expect(customerId).toBeTruthy();

  // Store for later use
  (global as any).testCustomerId = customerId;
});

it("Turn 5: Login with extracted ID", async () => {
  const customerId = (global as any).testCustomerId;
  const response = await sendUssdRequest(customerId);
  expect(response).toContain("Enter your PIN");
});
```

### Parallel Test Execution

Flow tests automatically use unique session IDs to prevent conflicts. The session ID format is:

```typescript
const SESSION_ID = `flow-test-${flowName}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
```

This ensures:

- Each test run gets a unique session ID
- Tests can run multiple times without server restart
- Parallel execution doesn't cause session conflicts
- Session IDs are traceable in server logs (prefix shows flow name)

**Note**: All newly generated tests automatically use this dynamic session ID format.

## Contributing

When adding new flow tests:

1. Record a clean, complete session
2. Generate the test with a descriptive name
3. Run the test to verify it passes
4. Add any necessary customizations
5. Document any special setup requirements
6. Commit both the log file and generated test

## Related Documentation

- [Session Log Parser](../../src/utils/session-log-parser.ts) - Parses session logs
- [Vitest Generator](../../src/utils/vitest-generator.ts) - Generates test code
- [Replay Test Helper](../helpers/replay-test-helper.ts) - HTTP replay functionality
- [Interactive Testing](../../scripts/test-interactive.ts) - Record sessions
