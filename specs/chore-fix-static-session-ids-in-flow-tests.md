# Chore: Fix Static Session IDs in Flow Tests

## Chore Description

The flow tests in `tests/flows/` directory currently use hardcoded static session IDs that are captured from the original recorded USSD sessions. This causes test failures when running the same test multiple times against a running server instance because:

1. **Session State Persistence**: The USSD server maintains session state in memory or database
2. **ID Reuse Conflicts**: Running the same test twice reuses the same session ID, causing the server to see "old" session state
3. **Unexpected Responses**: The server produces responses based on stale session state, causing assertion failures
4. **Test Brittleness**: Tests cannot be run consecutively without server restart

**Current Problem:**

- 4 out of 5 flow tests use static session IDs (e.g., `"interactive-test-1761579674600"`)
- Only 1 test (`1000-day-survey-back-navigation.test.ts`) already uses dynamic session IDs
- The test generator (`src/utils/vitest-generator.ts`) hardcodes the session ID from the recorded log

**Solution:**
Generate unique session IDs dynamically for each test run using a combination of:

- Flow name prefix (for identification in logs)
- Timestamp (for uniqueness across time)
- Random component (for uniqueness within same millisecond)

**Format**: `flow-test-${flowName}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

**Example**: `flow-test-activate-customer-1761650123456-x7k9m2p`

This ensures:

- Each test run gets a unique session ID
- Tests can run multiple times without server restart
- Parallel test execution is supported
- Session IDs are traceable in server logs

## Relevant Files

Use these files to resolve the chore:

- **src/utils/vitest-generator.ts** (lines 103-110)
  - Contains `generateTestConfig()` method that generates the SESSION_ID constant
  - Currently hardcodes `const SESSION_ID = "${fixture.sessionId}";`
  - Needs to generate dynamic session ID template instead
  - This is the root cause - fixing this prevents future tests from having static IDs

- **tests/flows/activate-customer-flow.test.ts** (line 46)
  - Generated test with static SESSION_ID: `"interactive-test-1761579674600"`
  - Needs manual update to use dynamic session ID
  - Most commonly run test, high priority to fix

- **tests/flows/create-customer-flow.test.ts** (line 47)
  - Generated test with static SESSION_ID: `"interactive-test-1761576171672"`
  - Needs manual update to use dynamic session ID
  - Contains dynamic customer ID extraction logic, should also have dynamic session ID

- **tests/flows/know-more-flow.test.ts** (line 45)
  - Generated test with static SESSION_ID: `"interactive-test-1761647447031"`
  - Needs manual update to use dynamic session ID
  - Simple flow test, good candidate for validation

- **tests/flows/1000-day-household-survey-flow.test.ts** (line 46)
  - Generated test with static SESSION_ID: `"interactive-test-1761543921905"`
  - Needs manual update to use dynamic session ID
  - Complex multi-turn flow, critical to fix for reliability

- **tests/flows/1000-day-survey-back-navigation.test.ts** (line 23)
  - Already uses dynamic SESSION_ID: `"test-1000-day-survey-back-nav-" + Date.now()`
  - Reference implementation showing the pattern works
  - Optional: Can be improved to match new format with random component

- **tests/flows/README.md** (lines 365-371)
  - Documents parallel test execution section
  - Currently shows example: `const SESSION_ID = \`test-${Date.now()}-${Math.random()}\`;`
  - Needs update to reflect new standard format and explain automatic generation

- **tests/flows/setup.ts**
  - Flow test setup file (no changes needed)
  - Included for context - does not define session IDs
  - Tests define their own session IDs at the test file level

### New Files

No new files need to be created. All changes are modifications to existing files.

## Step by Step Tasks

IMPORTANT: Execute every step in order, top to bottom.

### Step 1: Update Test Generator to Generate Dynamic Session IDs

- Open `src/utils/vitest-generator.ts`
- Locate the `generateTestConfig()` method (lines 103-110)
- Replace the static session ID generation with dynamic template
- Extract and sanitize flow name for use in session ID (remove non-alphanumeric characters)
- Generate code that creates unique session ID at runtime using:
  - Flow name prefix (sanitized)
  - `Date.now()` for timestamp uniqueness
  - `Math.random().toString(36).substring(2, 9)` for random component
- Add comment explaining why session ID is dynamic
- Format: ``const SESSION_ID = `flow-test-${flowName}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;``
- This ensures all future generated tests automatically use dynamic session IDs

### Step 2: Update activate-customer-flow.test.ts

- Open `tests/flows/activate-customer-flow.test.ts`
- Locate line 46 with static SESSION_ID constant
- Replace `const SESSION_ID = "interactive-test-1761579674600";` with:
  ```typescript
  // Dynamic session ID to prevent conflicts when running tests multiple times
  const SESSION_ID = `flow-test-activate-customer-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  ```
- Add comment explaining the dynamic session ID prevents test conflicts
- Verify the session ID is used in `sendUssdRequest()` function (should already be correct)

### Step 3: Update create-customer-flow.test.ts

- Open `tests/flows/create-customer-flow.test.ts`
- Locate line 47 with static SESSION_ID constant
- Replace `const SESSION_ID = "interactive-test-1761576171672";` with:
  ```typescript
  // Dynamic session ID to prevent conflicts when running tests multiple times
  const SESSION_ID = `flow-test-create-customer-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  ```
- Add comment explaining the dynamic session ID prevents test conflicts
- Verify the session ID is used in `sendUssdRequest()` function (should already be correct)

### Step 4: Update know-more-flow.test.ts

- Open `tests/flows/know-more-flow.test.ts`
- Locate line 45 with static SESSION_ID constant
- Replace `const SESSION_ID = "interactive-test-1761647447031";` with:
  ```typescript
  // Dynamic session ID to prevent conflicts when running tests multiple times
  const SESSION_ID = `flow-test-know-more-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  ```
- Add comment explaining the dynamic session ID prevents test conflicts
- Verify the session ID is used in `sendUssdRequest()` function (should already be correct)

### Step 5: Update 1000-day-household-survey-flow.test.ts

- Open `tests/flows/1000-day-household-survey-flow.test.ts`
- Locate line 46 with static SESSION_ID constant
- Replace `const SESSION_ID = "interactive-test-1761543921905";` with:
  ```typescript
  // Dynamic session ID to prevent conflicts when running tests multiple times
  const SESSION_ID = `flow-test-1000-day-household-survey-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  ```
- Add comment explaining the dynamic session ID prevents test conflicts
- Verify the session ID is used in `sendUssdRequest()` function (should already be correct)

### Step 6: Optionally Update 1000-day-survey-back-navigation.test.ts

- Open `tests/flows/1000-day-survey-back-navigation.test.ts`
- Locate line 23 with existing dynamic SESSION_ID
- Current: `const SESSION_ID = "test-1000-day-survey-back-nav-" + Date.now();`
- Optionally update to match new format with random component:
  ```typescript
  // Dynamic session ID to prevent conflicts when running tests multiple times
  const SESSION_ID = `flow-test-1000-day-survey-back-nav-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  ```
- This is optional since the test already uses dynamic IDs, but improves consistency
- Also update line 133 `exitSessionId` to use same format for consistency

### Step 7: Update Flow Tests Documentation

- Open `tests/flows/README.md`
- Locate the "Parallel Test Execution" section (lines 365-371)
- Replace the example code with updated explanation:

  ````markdown
  ### Parallel Test Execution

  Flow tests automatically use unique session IDs to prevent conflicts. The session ID format is:

  ```typescript
  const SESSION_ID = `flow-test-${flowName}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  ```
  ````

  This ensures:
  - Each test run gets a unique session ID
  - Tests can run multiple times without server restart
  - Parallel execution doesn't cause session conflicts
  - Session IDs are traceable in server logs (prefix shows flow name)

  ```

  ```

- Update the "Clean Session State" section (lines 302-308) to mention automatic unique session IDs
- Add note that newly generated tests automatically use dynamic session IDs

### Step 8: Run Validation Commands

- Execute all validation commands listed below to ensure zero regressions
- Verify all tests pass with dynamic session IDs
- Run flow tests multiple times consecutively to confirm no session conflicts
- Check that each test run uses a different session ID (visible in console logs)

## Validation Commands

Execute every command to validate the chore is complete with zero regressions.

- `pnpm install` - Ensure dependencies are installed
- `pnpm format` - Format all modified files
- `pnpm lint` - Verify no linting errors
- `pnpm tsc --noEmit` - Verify TypeScript compilation
- `pnpm build` - Build the project including test generator
- `pnpm test` - Run unit tests to ensure no regressions
- `pnpm test:flows:run` - Run all flow tests once (requires server running: `pnpm dev` in separate terminal)
- `pnpm test:flows:run` - Run all flow tests AGAIN to verify no session conflicts
- `pnpm test:flows:run` - Run all flow tests THIRD TIME to triple-verify idempotency
- `pnpm vitest run --config vitest.flows.config.ts tests/flows/activate-customer-flow.test.ts` - Test specific flow multiple times
- `pnpm vitest run --config vitest.flows.config.ts tests/flows/create-customer-flow.test.ts` - Test specific flow multiple times
- `pnpm vitest run --config vitest.flows.config.ts tests/flows/know-more-flow.test.ts` - Test specific flow multiple times

## Notes

### Why This Matters

- **Test Reliability**: Tests should be idempotent and not depend on external state
- **CI/CD Compatibility**: Automated test runs need to work without manual intervention
- **Developer Experience**: Developers should be able to run tests repeatedly during development
- **Parallel Execution**: Multiple tests can run simultaneously without conflicts

### Session ID Format Rationale

The format `flow-test-${flowName}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` provides:

1. **Prefix** (`flow-test-`): Identifies this as a flow test session in server logs
2. **Flow Name**: Makes it easy to trace which test generated the session
3. **Timestamp**: Ensures uniqueness across time (millisecond precision)
4. **Random Component**: Ensures uniqueness within same millisecond (7 alphanumeric characters = 78 billion combinations)

### Backward Compatibility

- The server doesn't care about session ID format, only that they're unique
- No API changes required
- No database schema changes required
- Existing session handling code works unchanged

### Future Test Generation

Once the generator is updated, all newly generated tests will automatically use dynamic session IDs. Developers won't need to manually fix this issue for new tests.

### Testing Strategy

Run each flow test 3 times consecutively to verify:

1. First run: Fresh session, should pass
2. Second run: New session ID, should pass (not reuse old session)
3. Third run: Another new session ID, should pass (confirms pattern works consistently)

### Reference Implementation

The `1000-day-survey-back-navigation.test.ts` file already demonstrates this pattern works correctly. It has been running successfully with dynamic session IDs since creation.
