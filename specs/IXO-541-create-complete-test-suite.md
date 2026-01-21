# Chore: Create a Complete Set of Tests

## Linear Issue

- **Issue ID**: IXO-541
- **Issue URL**: https://linear.app/ixo-world/issue/IXO-541/create-a-complete-set-of-tests

## Chore Description

Create a comprehensive battery of integration tests that exercise all existing USSD functionality against a running server. The system already has excellent test generation infrastructure:

1. **Session Recorder** (`tests/helpers/session-recorder.ts`) - Records USSD conversations into JSON fixtures
2. **Vitest Generator** (`tests/utils/vitest-generator.ts`) - Converts session fixtures into runnable Vitest tests
3. **Log Parser** (`src/utils/session-log-parser.ts`) - Parses session logs into fixtures
4. **Flow Tests** (`tests/fixtures/flows/`) - Generated tests that run against a real server

The goal is to:
- Record sessions covering ALL major flows (7 identified flows)
- Generate comprehensive flow tests
- Create a pnpm command that starts the server, runs tests, then stops
- Ensure the test battery can be continuously updated as features are added

## Relevant Files

Use these files to resolve the chore:

**Testing Infrastructure (existing, enhance as needed):**
- `tests/utils/vitest-generator.ts` - Generates Vitest tests from session fixtures
- `tests/helpers/session-recorder.ts` - Records USSD sessions to JSON fixtures
- `src/utils/session-log-parser.ts` - Parses session logs into fixtures
- `tests/scripts/test-generate-tests-from-logs.ts` - CLI tool to generate tests from logs
- `tests/fixtures/flows/setup.ts` - Flow tests setup (no mocks, connects to real server)
- `vitest.flows.config.ts` - Configuration for flow tests

**Existing Flow Tests (patterns to follow):**
- `tests/fixtures/flows/know-more-flow.test.ts` - Know More flow test (21 turns)
- `tests/fixtures/flows/create-customer-flow.test.ts` - Account creation flow
- `tests/fixtures/flows/activate-customer-flow.test.ts` - Customer activation flow
- `tests/fixtures/flows/1000-day-household-survey-flow.test.ts` - Survey flow

**Application Source (to understand what to test):**
- `docs/supamoto/MENU_STRUCTURE.md` - Complete menu structure
- `src/machines/supamoto/parentMachine.ts` - Main state machine
- `src/machines/supamoto/user-services/userServicesMachine.ts` - User services (customer/agent)
- `src/machines/supamoto/customer-tools/customerToolsMachine.ts` - Customer tools
- `src/machines/supamoto/agent-tools/agentToolsMachine.ts` - Agent tools

**Configuration:**
- `package.json` - Scripts section (add new test commands)

### New Files

- `tests/scripts/test-integration-flows.ts` - Script to run server + flow tests
- `tests/fixtures/flows/login-flow.test.ts` - Login flow test (to be generated)
- `tests/fixtures/flows/agent-activate-customer-flow.test.ts` - Agent activation flow
- `tests/fixtures/flows/agent-bean-delivery-flow.test.ts` - Bean delivery workflow
- `tests/fixtures/flows/customer-confirm-receipt-flow.test.ts` - Receipt confirmation flow
- `docs/TESTING_GUIDE.md` - Documentation for test generation workflow

## Step by Step Tasks

IMPORTANT: Execute every step in order, top to bottom.

### Step 1: Audit Existing Flow Tests

- Review all existing tests in `tests/fixtures/flows/` directory
- Identify which flows are already covered vs missing
- Check existing session logs in `sessions/` for reusable recordings
- Document the gap between existing tests and complete coverage

### Step 2: Define the Complete Test Matrix

Based on `docs/supamoto/MENU_STRUCTURE.md`, the following flows need tests:

**Unauthenticated Flows:**
1. Know More (Information Services) - **EXISTS: `know-more-flow.test.ts`**
2. Account Menu → Create Account - **EXISTS: `create-customer-flow.test.ts`**
3. Account Menu → Login (success/failure) - **MISSING**

**Customer Flows (authenticated):**
4. Customer Tools → 1,000 Day Household Survey - **EXISTS: `1000-day-household-survey-flow.test.ts`**
5. Customer Tools → Confirm Receival of Beans - **MISSING**

**Agent Flows (authenticated as lead_generator):**
6. Agent Tools → Activate a Customer - **EXISTS: `activate-customer-flow.test.ts`**
7. Agent Tools → Register Intent to Deliver Beans - **MISSING**
8. Agent Tools → Submit Customer OTP - **MISSING**
9. Agent Tools → Confirm Bean Delivery - **MISSING**

### Step 3: Record Missing Sessions Interactively

For each missing flow, record a session:

```bash
# Terminal 1: Start the server
pnpm dev

# Terminal 2: Run interactive test and complete each flow
pnpm test:interactive
```

**Recording Workflow:**
1. Start `pnpm test:interactive`
2. Navigate through the flow you want to test
3. The session is automatically logged to `sessions/session-YYYY-MM-DD-HH-mm-ss.log`
4. Note the log filename for test generation

**Sessions to Record:**
- [ ] Login flow (successful login with existing customer)
- [ ] Customer confirm receipt of beans flow
- [ ] Agent register intent to deliver beans flow
- [ ] Agent submit customer OTP flow
- [ ] Agent confirm bean delivery flow

### Step 4: Generate Tests from Recorded Sessions

For each recorded session, generate a test file:

```bash
# Example for each flow:
pnpm generate:test sessions/session-XXXX-XX-XX-XX-XX-XX.log login-flow
pnpm generate:test sessions/session-XXXX-XX-XX-XX-XX-XX.log customer-confirm-receipt-flow
pnpm generate:test sessions/session-XXXX-XX-XX-XX-XX-XX.log agent-register-intent-flow
pnpm generate:test sessions/session-XXXX-XX-XX-XX-XX-XX.log agent-submit-otp-flow
pnpm generate:test sessions/session-XXXX-XX-XX-XX-XX-XX.log agent-confirm-delivery-flow
```

### Step 5: Create the Integration Test Runner Script

Create `scripts/test-integration-flows.ts`:

```typescript
#!/usr/bin/env node
/**
 * Integration Flow Test Runner
 *
 * Starts the server, waits for it to be ready, runs all flow tests,
 * then shuts down the server.
 *
 * Usage: pnpm test:integration:flows
 */
import { spawn, ChildProcess } from "child_process";
import { setTimeout } from "timers/promises";

const SERVER_URL = "http://127.0.0.1:3005/api/ussd";
const MAX_STARTUP_WAIT_MS = 30000;
const HEALTH_CHECK_INTERVAL_MS = 1000;

async function waitForServer(): Promise<boolean>;
async function startServer(): Promise<ChildProcess>;
async function runFlowTests(): Promise<number>;
async function main(): Promise<void>;
```

Key features:
- Starts server with `pnpm dev`
- Polls health endpoint until ready (max 30s)
- Runs `pnpm test:flows:run`
- Captures exit code
- Kills server on completion
- Returns appropriate exit code for CI

### Step 6: Add New pnpm Scripts

Update `package.json` scripts:

```json
{
  "scripts": {
    "test:integration:flows": "NODE_OPTIONS='--loader ts-node/esm' ts-node tests/scripts/test-integration-flows.ts",
    "test:all": "pnpm install && pnpm format && pnpm lint && pnpm tsc --noEmit && pnpm build && pnpm validate:machines && pnpm test && pnpm test:integration:flows"
  }
}
```

The `test:all` command can be added to CI and used for complete validation.

### Step 7: Verify All Tests Pass

Run the complete test suite:

```bash
# Run all unit tests first
pnpm test

# Run all flow tests (requires server)
pnpm test:integration:flows

# Or run the full validation chain
pnpm test:all
```

### Step 8: Run Validation Commands

Execute every command to validate the chore is complete with zero regressions.

## Validation Commands

Execute every command to validate the chore is complete with zero regressions.

- `pnpm install && pnpm format && pnpm lint && pnpm tsc --noEmit && pnpm build && pnpm validate:machines` - Run base validation to ensure no regressions.
- `pnpm test:flows:run` - Run all flow tests against a running server (start `pnpm dev` first in another terminal).
- `pnpm test:integration:flows` - Run the new integration test runner that starts/stops the server automatically.

## Notes

### Test Generation Workflow (for future features/bugs)

1. **Record**: Run `pnpm test:interactive`, complete the flow, note the log file
2. **Generate**: Run `pnpm generate:test <log-file> <flow-name>`
3. **Verify**: Run `pnpm test:flows:run` to verify the test passes
4. **Commit**: Commit both the log file and generated test

### Important Constraints

- Flow tests use `vitest.flows.config.ts` - DO NOT run with default `pnpm test`
- Flow tests require a running server at `http://127.0.0.1:3005/api/ussd`
- Each test uses a unique session ID to prevent conflicts
- Tests include 2-second delays between turns to simulate realistic timing

### Server URL Configuration

Flow tests default to connecting to the development Railway server:
`https://ixo-ussd-supamoto-development.up.railway.app/api/ussd`

For local testing, set `USSD_TEST_SERVER_URL`:
```bash
USSD_TEST_SERVER_URL=http://127.0.0.1:3005/api/ussd pnpm test:flows:run
```

### Existing Infrastructure Summary

| Component | File | Purpose |
|-----------|------|---------|
| Session Recorder | `tests/helpers/session-recorder.ts` | Records USSD sessions to JSON |
| Log Parser | `src/utils/session-log-parser.ts` | Parses log files to fixtures |
| Vitest Generator | `tests/utils/vitest-generator.ts` | Generates test code from fixtures |
| CLI Tool | `tests/scripts/test-generate-tests-from-logs.ts` | CLI for generating tests |
| Flow Setup | `tests/fixtures/flows/setup.ts` | Test setup without mocks |
| Flow Config | `vitest.flows.config.ts` | Vitest config for flow tests |

### Potential Blockers

- **Database State**: Some flows require specific customer/agent accounts to exist
- **Blockchain State**: Bean vouchers, claims may need specific chain state
- **SMS Services**: SMS sending in tests may need mocking or test phone numbers
- **OTP Verification**: Need to handle OTP generation in test environment

Consider adding test fixtures or seed data for reproducible test runs.
