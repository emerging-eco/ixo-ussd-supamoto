# Bug: "CON Service unavailable" Error After Successful Customer Login

## Bug Description

After a customer successfully logs in through the USSD menu, the system displays "CON Service unavailable" instead of the expected Services menu (Customer Tools or Agent Tools based on role). The login process completes successfully and displays the login success message, but when the user selects "1. Continue", the next screen shows the error message instead of the appropriate services menu.

**Symptoms:**

- Login completes successfully with message: "Welcome, ccc! Login successful for Customer ID: C58F18E14. 1. Continue"
- User selects "1. Continue"
- System displays: "CON Service unavailable 0. Back"
- Expected: Display the Services menu (Customer Tools for customers, Agent Tools for lead generators)

**Affected Users:** All users with the 'customer' role (tested with customer ID C58F18E14). Lead generator role users are not affected.

## Problem Statement

The `userServicesMachine` in production code initializes with an empty message (`message: ""`) and uses a `determineInitialState` state that transitions directly to either `customerTools` or `agent` states without setting an initial message. The `customerTools` state invokes the `customerToolsMachine` but lacks an `onSnapshot` handler to capture and propagate the child machine's message to the parent context. This causes the USSD response service to fall back to the "Service unavailable" message when no message is available in the context.

## Solution Statement

Fix the `userServicesMachine` to properly initialize and maintain the message context by:

1. Adding an `onSnapshot` handler to the `customerTools` state to capture messages from the child `customerToolsMachine`
2. Adding an `onSnapshot` handler to the `agent` state to capture messages from the child agent machine
3. Ensuring the `determineInitialState` state properly transitions with message initialization
4. Aligning the production code structure with the test version which has a working `menu` state pattern

## Steps to Reproduce

1. From Pre-Menu, select: 2 (Account Menu)
2. Select: 1 (Yes, log me in)
3. Enter Customer ID: C58F18E14
4. Select: 1 (Continue)
5. Enter PIN: 10101
6. Select: 1 (Continue)
7. System displays: "CON Welcome, ccc! Login successful for Customer ID: C58F18E14. 1. Continue"
8. Select: 1 (Continue)
9. **Expected:** Display the Services menu (Customer Tools or Agent Tools based on role)
10. **Actual:** Display "CON Service unavailable 0. Back"

## Root Cause Analysis

The root cause is a mismatch between the production and test versions of `userServicesMachine`:

1. **Production version** (`src/machines/supamoto/user-services/userServicesMachine.ts`):
   - Initial state: `determineInitialState` (always transition)
   - Initial message: `""` (empty string)
   - `customerTools` state: No `onSnapshot` handler to capture child machine messages
   - `agent` state: No `onSnapshot` handler to capture child machine messages

2. **Test version** (`tests/machines/supamoto/user-services/userServicesMachine.ts`):
   - Initial state: `menu` (proper menu state)
   - Initial message: `buildMenuMessage(input?.customerRole)` (properly initialized)
   - Has entry actions: `["setMenuMessage", "clearErrors"]`
   - Properly routes to child machines on user input

3. **Result**: When the parent machine transitions to `userMainMenu` after login, it invokes `userServicesMachine`. The machine starts with an empty message and immediately transitions to `customerTools` without setting a message. The `customerTools` state invokes `customerToolsMachine` but doesn't capture its message via `onSnapshot`, leaving the parent context with an empty message. The USSD response service then falls back to "Service unavailable".

## Relevant Files

- `src/machines/supamoto/user-services/userServicesMachine.ts` - Production version with the bug
  - Missing `onSnapshot` handlers in `customerTools` and `agent` states
  - Incorrect initial state structure (`determineInitialState` instead of `menu`)
  - Empty initial message instead of properly initialized message

- `tests/machines/supamoto/user-services/userServicesMachine.ts` - Test version with correct implementation
  - Has proper `menu` state with entry actions
  - Properly initializes message with `buildMenuMessage()`
  - Reference implementation for the fix

- `src/machines/supamoto/parentMachine.ts` - Parent machine that invokes userServicesMachine
  - Has `onSnapshot` handler that captures messages from child machines
  - Shows the correct pattern to follow

- `src/services/ussd-response.ts` - USSD response service
  - Falls back to "Service unavailable" when message is empty
  - Correctly implements the fallback behavior

- `tests/machines/supamoto/user-services/userServicesMachine.test.ts` - Test file
  - Tests for the machine behavior
  - Should be updated to test the fixed production version

## Step by Step Tasks

### 1. Update userServicesMachine to add onSnapshot handlers

- Add `onSnapshot` handler to `customerTools` state to capture messages from `customerToolsMachine`
- Add `onSnapshot` handler to `agent` state to capture messages from agent-related child machines
- These handlers should update the parent context message with the child machine's message

### 2. Ensure proper message initialization

- Verify the initial message is properly set when entering `customerTools` or `agent` states
- Add entry actions to set appropriate messages if needed

### 3. Run tests to validate the fix

- Run existing tests to ensure no regressions
- Verify the login flow works end-to-end
- Test both customer and lead_generator roles

### 4. Validate with manual testing

- Reproduce the bug scenario from the steps above
- Verify the Services menu displays correctly after login
- Test with both customer and lead_generator roles

## Validation Commands

Execute every command to validate the bug is fixed with zero regressions.

- `pnpm format && pnpm lint && pnpm tsc --noEmit` - Validate code quality
- `pnpm build` - Build the project
- `pnpm validate:machines` - Validate state machines
- `pnpm test` - Run all tests
- `pnpm test:interactive` - Manual testing of the login flow

## Notes

- The test version of `userServicesMachine` appears to be a reference implementation that should be aligned with the production version
- The fix is minimal and surgical - only adding missing `onSnapshot` handlers to capture child machine messages
- No new dependencies or libraries are needed
- The fix aligns with the pattern used in `parentMachine.ts` which successfully captures messages from child machines
