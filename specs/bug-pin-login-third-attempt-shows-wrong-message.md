# Bug: PIN Login Third Attempt Shows Wrong Message

## Bug Description

When a user has forgotten their PIN and enters 3 failed login attempts:

**Expected behavior**: After the 3rd failed attempt, the user should see the Pre-Menu with the message "Your account was locked after 3 incorrect PIN attempts. Please contact your LG to activate your account."

**Actual behavior**: The user sees the message "CON 2 of 3 attempts - 1 left - account will be locked upon 3 incorrect attempts" again (the same message from the 2nd attempt). However, the PIN is correctly deleted from the `encrypted_pin` field in the database.

The system correctly:

- Detects the 3rd failed attempt
- Clears the PIN from the database
- Creates an audit log entry
- Sends an SMS notification

But incorrectly:

- Shows the wrong message to the user (2nd attempt message instead of lockout message)
- Does not route to the Pre-Menu as expected

## Problem Statement

The issue occurs in the `loginMachine` state flow. After the 3rd failed PIN attempt, the `pinVerificationService` correctly throws `MAX_ATTEMPTS_EXCEEDED`, and the `onError` handler sets the message to `MAX_ATTEMPTS_MSG` and transitions to `routeToMain`. However, the `verifyingPin` state has an `on: INPUT` handler (lines 534-547) with a catch-all transition to `pinEntry` that intercepts the flow before the error handling completes. This causes the machine to transition back to `pinEntry`, where the entry action overwrites the lockout message with the incorrect attempt warning message.

## Solution Statement

The fix requires removing the problematic INPUT handler from the `verifyingPin` state that causes premature transitions before async error handling completes. The `verifyingPin` state should only handle the async promise resolution/rejection through its `invoke` configuration, not through INPUT events. The state transitions should be:

1. **On 3rd failed attempt**: `verifyingPin` → `routeToMain` (with `MAX_ATTEMPTS_MSG`)
2. **On 1st or 2nd failed attempt**: `verifyingPin` → `pinEntry` (with attempt warning message)
3. **On successful PIN**: `verifyingPin` → `loginSuccess`

All transitions should happen through the `invoke.onDone` and `invoke.onError` handlers, not through the `on: INPUT` handler.

## Steps to Reproduce

1. Start the USSD application
2. Navigate to Account Menu → "Yes, log me in"
3. Enter a valid Customer ID (e.g., C32B46554)
4. Enter an incorrect PIN (e.g., 10101)
5. Press "1" to continue verification
6. See message "1 of 3 attempts - 2 left - account will be locked upon 3 incorrect attempts"
7. Enter the same incorrect PIN again
8. Press "1" to continue verification
9. See message "2 of 3 attempts - 1 left - account will be locked upon 3 incorrect attempts"
10. Enter the same incorrect PIN a third time
11. Press "1" to continue verification
12. **BUG**: See message "2 of 3 attempts - 1 left - account will be locked upon 3 incorrect attempts" again
13. **EXPECTED**: Should see "Your account was locked after 3 incorrect PIN attempts. Please contact your LG to activate your account." and be routed to Pre-Menu

## Root Cause Analysis

The root cause is a race condition in the state machine design:

1. **The `verifyingPin` state** (lines 466-548) has two competing transition mechanisms:
   - `invoke.onError` handlers (lines 491-532) that handle async promise rejections
   - `on: INPUT` handlers (lines 534-547) that handle synchronous user input

2. **The problematic flow**:
   - User enters incorrect PIN for the 3rd time
   - User presses "1" to continue → triggers INPUT event
   - `pinVerificationService` is invoked with `attempts: 3`
   - Service detects invalid PIN and `attempts >= 3`
   - Service clears PIN, creates audit log, sends SMS
   - Service throws `MAX_ATTEMPTS_EXCEEDED` error
   - **RACE CONDITION**: The `on: INPUT` handler (line 542) catches the "1" input and transitions to `pinEntry` BEFORE the `onError` handler can transition to `routeToMain`
   - The `pinEntry` entry action (lines 422-435) overwrites the message based on `context.pinAttempts` (which is still 2)

3. **Why the message shows "2 of 3 attempts"**:
   - The `pinAttempts` counter is only incremented in the `onError[1]` handler (line 515)
   - But the machine transitions to `pinEntry` via the `on: INPUT` handler before the error is processed
   - So `context.pinAttempts` is still 2, not 3
   - The entry action generates `INCORRECT_PIN_MSG(2)` = "2 of 3 attempts - 1 left..."

4. **The design flaw**:
   - The `verifyingPin` state should be a "waiting" state that only transitions based on the async service result
   - The `on: INPUT` handler was likely added to handle the "Continue" button press, but this creates the race condition
   - The correct design is to let the `invoke` configuration handle all transitions

## Relevant Files

Use these files to fix the bug:

- **`src/machines/supamoto/account-login/loginMachine.ts`** - Contains the login state machine with the bug
  - Lines 466-548: `verifyingPin` state with problematic INPUT handler
  - Lines 534-547: The `on: INPUT` handler that causes the race condition
  - Lines 491-532: The correct `invoke.onError` handlers that should control transitions
  - Lines 422-435: `pinEntry` entry action that overwrites the message

- **`tests/machines/supamoto/account-login/loginMachine.ts`** - Test version of the machine (needs same fix)
  - Lines 458-534: `verifyingPin` state with same issue

- **`tests/machines/supamoto/account-login/loginMachine.test.ts`** - Unit tests
  - Lines 237-286: Test for "max attempts exceeded" that should verify correct behavior

- **`src/machines/supamoto/parentMachine.ts`** - Parent machine that handles routing
  - Lines 387-397: Already correctly routes `MAX_ATTEMPTS_EXCEEDED` to `preMenu`

## Step by Step Tasks

### Step 1: Remove the problematic INPUT handler from verifyingPin state in loginMachine.ts

The `verifyingPin` state should not have an `on: INPUT` handler because it creates a race condition with the async `invoke` error handling. The state should only transition based on the promise resolution/rejection.

- Remove the entire `on: INPUT` block from the `verifyingPin` state (lines 534-547 in `src/machines/supamoto/account-login/loginMachine.ts`)
- The state will now only transition through `invoke.onDone` and `invoke.onError` handlers
- This ensures the error handling completes before any state transition occurs

### Step 2: Update the invoke.onDone handler to transition to loginSuccess

Since we removed the INPUT handler, the `onDone` handler needs to specify the target state directly instead of relying on the INPUT handler to route to `loginSuccess`.

- Modify the `invoke.onDone` handler (line 483) to include `target: "loginSuccess"`
- Keep the existing action that sets `nextParentState: LoginOutput.LOGIN_SUCCESS`

### Step 3: Apply the same fix to the test version of loginMachine

The test file has a copy of the machine that needs the same fix.

- Remove the `on: INPUT` block from `verifyingPin` state in `tests/machines/supamoto/account-login/loginMachine.ts` (lines 520-533)
- Update the `invoke.onDone` handler to include `target: "loginSuccess"`

### Step 4: Verify the test passes

Run the existing test for max attempts exceeded to ensure it now passes with the correct behavior.

- Run `pnpm test loginMachine.test.ts` to verify the test passes
- The test should verify:
  - State transitions to `routeToMain` after 3rd attempt
  - Message is set to the lockout message
  - PIN is cleared in the database
  - Output result is `MAX_ATTEMPTS_EXCEEDED`

### Step 5: Run full validation suite

Execute all validation commands to ensure zero regressions.

- Run all tests, linting, type checking, and build
- Verify no other tests are broken by this change

## Validation Commands

Execute every command to validate the bug is fixed with zero regressions.

- `pnpm test loginMachine.test.ts` - Run the login machine tests to verify the fix
- `pnpm install && pnpm format && pnpm lint && pnpm tsc --noEmit && pnpm build && pnpm validate:machines && pnpm test` - Run full test suite to validate zero regressions
- `pnpm test:interactive` - Manually test the login flow to verify the user sees the correct message after 3 failed attempts

## Notes

- The PIN clearing functionality is already implemented correctly in `pinVerificationService`
- The parent machine already routes `MAX_ATTEMPTS_EXCEEDED` to `preMenu` correctly (lines 387-397 in parentMachine.ts)
- The SMS notification and audit logging are already working correctly
- The fix is surgical: only remove the problematic INPUT handler that causes the race condition
- This is a state machine design issue, not a business logic issue
- The `loginSuccess` state still has its own INPUT handler (lines 560-581) which is correct because it's a "waiting for user confirmation" state, not an "async operation in progress" state
