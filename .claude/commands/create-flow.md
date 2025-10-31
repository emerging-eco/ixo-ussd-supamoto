# Create USSD Flow Test

Generate a Vitest test file from a recorded USSD session log. This command automates the creation of integration tests that replay complete USSD interaction flows against a running server.

## Command Usage

```
/create-flow <session-file-path> <flow-name>
```

**Arguments:**

- `<session-file-path>`: Path to the session log file (e.g., `logs/sessions/session-2025-10-30-13-59-00.log`)
- `<flow-name>`: Descriptive name for the flow test (e.g., `know-more-flow`, `customer-activation-flow`)

**Example:**

```
/create-flow logs/sessions/session-2025-10-30-13-59-00.log bean-delivery-flow
```

## Prerequisites

Before running this command:

1. **Record a session** using the interactive test tool:

   ```bash
   # Terminal 1: Start the USSD server
   pnpm dev

   # Terminal 2: Run interactive test
   pnpm test:interactive
   ```

2. **Complete the flow** you want to test by navigating through the USSD menus

3. **Note the log file path** displayed at the end of the session (e.g., `logs/sessions/session-2025-10-30-13-59-00.log`)

## Implementation Steps

Follow these steps to generate the flow test:

### Step 1: Validate Arguments

- Check that both `<session-file-path>` and `<flow-name>` arguments are provided
- If missing, display usage instructions and exit

### Step 2: Validate Session Log File

- Resolve the session log file path (handle both absolute and relative paths)
- Check if the file exists at the resolved path
- If file doesn't exist:
  - Display error message with the attempted path
  - List available session logs in `logs/sessions/` directory
  - Exit with error

### Step 3: Sanitize Flow Name

- Trim whitespace from flow name
- Convert to lowercase
- Replace special characters with hyphens
- Replace multiple consecutive hyphens with single hyphen
- Remove leading/trailing hyphens
- If sanitized name differs from input, display the sanitization change

**Example sanitizations:**

- `"Bean Delivery Flow"` → `"bean-delivery-flow"`
- `"1000-Day Survey"` → `"1000-day-survey"`
- `"Know_More!!!"` → `"know-more"`

### Step 4: Parse Session Log

Use the existing `SessionLogParser` utility:

```typescript
import { SessionLogParser } from "../src/utils/session-log-parser.js";

const parser = new SessionLogParser();
const fixture = parser.parseLogFile(resolvedLogPath);

// Override flow name with user-provided name
fixture.flowName = sanitizedFlowName;
```

**Display parsed information:**

- Session ID
- Phone number
- Service code
- Number of conversation turns
- Timestamp

**Validate fixture:**

- Ensure fixture has required fields (sessionId, phoneNumber, serviceCode, turns)
- Ensure turns array is not empty
- If validation fails, display error and exit

### Step 5: Generate Test Code

Use the existing `VitestGenerator` utility:

```typescript
import { VitestGenerator } from "../src/utils/vitest-generator.js";

const generator = new VitestGenerator();
const testCode = generator.generateTestFile(fixture, sanitizedFlowName);
```

**Validate generated code:**

- Ensure code is not empty
- Ensure code contains required imports
- Ensure code contains test suite
- If validation fails, display error and exit

### Step 6: Save Test File

- Create `tests/flows/` directory if it doesn't exist
- Generate test filename: `{sanitized-flow-name}.test.ts`
- Construct full path: `tests/flows/{sanitized-flow-name}.test.ts`
- Check if file already exists:
  - If exists, display warning that it will be overwritten
  - Proceed with overwrite (user can cancel if needed)
- Write test code to file with UTF-8 encoding

### Step 7: Display Success Message

Show completion message with:

1. **Success confirmation:**

   ```
   🎉 Success! Flow test generated successfully.
   ```

2. **Generated file path:**

   ```
   ✅ Test file saved: tests/flows/bean-delivery-flow.test.ts
   ```

3. **Next steps:**

   ```
   📋 Next steps:

   1. Review the generated test:
      cat tests/flows/bean-delivery-flow.test.ts

   2. Start the USSD server (if not already running):
      pnpm dev

   3. Run the generated test:
      pnpm test:flows:run

      Or run in watch mode:
      pnpm test:flows

      Or run specific test:
      pnpm vitest run --config vitest.flows.config.ts tests/flows/bean-delivery-flow.test.ts

   ⚠️  IMPORTANT: Flow tests require a running server!
   ⚠️  Do NOT use 'pnpm test ./tests/flows/' - it won't work!

   4. (Optional) Customize the test as needed:
      - Handle dynamic values (Customer IDs, OTPs, etc.)
      - Add additional assertions
      - Add setup/teardown logic
   ```

## Generated Test Structure

The generated test file will include:

### File Header

- Comprehensive documentation comment with:
  - Flow name and session details
  - Important warnings about how to run flow tests
  - Prerequisites (server must be running)
  - Instructions for regenerating the test

### Test Configuration

- `SERVER_URL`: Configurable via `USSD_TEST_SERVER_URL` environment variable
- `SESSION_ID`: **Dynamic** session ID to prevent conflicts (format: `flow-test-{flowName}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`)
- `PHONE_NUMBER`: From recorded session
- `SERVICE_CODE`: From recorded session
- `REQUEST_TIMEOUT`: 5 seconds

### HTTP Helper Function

- `sendUssdRequest(text: string)`: Sends POST request to USSD endpoint
- Handles errors and timeouts
- Returns response text

### Test Suite

- `describe()` block with flow name
- `beforeAll()` hook with startup logging
- `afterAll()` hook with completion logging
- Individual `it()` test cases for each conversation turn:
  - Turn 1: Initial dial (no delay)
  - Turn 2+: User inputs with **2-second delay** to simulate realistic interaction
  - Cumulative USSD text handling (e.g., `"1*2*3"`)
  - Expected response assertions
  - 10-second timeout per test case

## Error Handling

Handle these error scenarios:

### Missing Arguments

```
❌ Error: Missing required arguments

Usage: /create-flow <session-file-path> <flow-name>

Example:
  /create-flow logs/sessions/session-2025-10-30-13-59-00.log bean-delivery-flow
```

### File Not Found

```
❌ Error: Log file not found: logs/sessions/session-2025-10-30-13-59-00.log

Available session logs:
  - logs/sessions/session-2025-10-30-12-30-15.log
  - logs/sessions/session-2025-10-30-13-45-22.log
```

### Invalid Log Format

```
❌ Error: Could not parse session log

The log file does not contain valid session metadata.
Please ensure the log was created using 'pnpm test:interactive'.
```

### Empty Flow Name

```
❌ Error: Flow name cannot be empty

Please provide a descriptive name for the flow test.
```

## Troubleshooting Tips

Include these tips in error messages when relevant:

1. **Session log not found:**
   - Verify you completed an interactive test session
   - Check the `logs/sessions/` directory for available logs
   - Use the full path from the interactive test output

2. **Invalid log format:**
   - Ensure the log was created using `pnpm test:interactive`
   - Don't manually edit session log files
   - Re-record the session if the log is corrupted

3. **Test generation fails:**
   - Check that the session log contains at least one conversation turn
   - Verify the log file is not empty
   - Ensure the log file has proper metadata header

4. **Generated test fails to run:**
   - Make sure the USSD server is running (`pnpm dev`)
   - Use `pnpm test:flows:run` (NOT `pnpm test`)
   - Check server URL matches your configuration
   - Verify database is accessible and has required data

## Reference Files

This command uses the following utilities:

- **Session Parser:** `src/utils/session-log-parser.ts` - Parses session logs into fixtures
- **Test Generator:** `src/utils/vitest-generator.ts` - Generates Vitest test code
- **Generation Script:** `scripts/generate-test-from-log.ts` - Reference implementation
- **Example Tests:** `tests/flows/know-more-flow.test.ts`, `tests/flows/create-customer-flow.test.ts`
- **Documentation:** `tests/flows/README.md`, `tests/flows/QUICK_START.md`

## Expected Outcome

After running this command successfully:

1. ✅ A new test file is created at `tests/flows/{flow-name}.test.ts`
2. ✅ The test file contains all conversation turns from the recorded session
3. ✅ The test uses dynamic session IDs to prevent conflicts
4. ✅ The test includes 2-second delays between turns (except Turn 1)
5. ✅ The test can be run with `pnpm test:flows:run` against a running server
6. ✅ The test validates the complete USSD flow end-to-end

## Notes

- Flow tests are **integration tests** that require a running USSD server
- They use a separate Vitest configuration (`vitest.flows.config.ts`)
- They cannot be run with the default `pnpm test` command
- Session IDs are dynamically generated to allow multiple test runs without conflicts
- Tests include realistic 2-second delays to prevent race conditions with async operations
- Generated tests can be customized to handle dynamic values (Customer IDs, OTPs, etc.)
