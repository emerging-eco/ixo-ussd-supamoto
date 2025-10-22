# Chore: PIN Login Attempt Limiting with Account Lockout

## Chore Description

Fix the PIN login attempt limiting and account lockout feature to ensure:

1. **Warning messages display correctly on the "Enter your PIN:" screen** after each failed attempt (attempts 1 and 2)
   - Attempt 1: "1 of 3 attempts - 2 left - account will be locked upon 3 incorrect attempts"
   - Attempt 2: "2 of 3 attempts - 1 left - account will be locked upon 3 incorrect attempts"

2. **After 3 failed attempts, the user is redirected to the Pre-Menu** (not Account Menu) with the account lockout message displayed:
   - "Your account was locked after 3 incorrect PIN attempts. Please contact your LG to activate your account."

3. **The PIN is deleted from the database** (encrypted_pin column set to NULL) after 3 failed attempts

### Current Issues

1. Warning messages are not displayed on the "Enter your PIN:" screen after incorrect attempts (they may be appearing on a different screen or not at all)
2. After 3 incorrect attempts, the user is being redirected to the Account Menu instead of the Pre-Menu
3. The account lockout message is not being shown to the user

## Relevant Files

- `src/machines/supamoto/account-login/loginMachine.ts` - Contains PIN verification logic, message templates, and state transitions
  - Defines `INCORRECT_PIN_MSG()` function that generates warning messages
  - Implements `pinVerificationService` that handles PIN verification and attempt tracking
  - Manages state transitions for PIN entry and verification
  - Currently routes MAX_ATTEMPTS_EXCEEDED to `routeToMain` (final state)

- `src/machines/supamoto/parentMachine.ts` - Parent machine that routes login output
  - Handles `LoginOutput.MAX_ATTEMPTS_EXCEEDED` by routing back to `accountMenu` (line 372-378)
  - Should route to `preMenu` instead to display the lockout message

- `tests/machines/supamoto/account-login/loginMachine.test.ts` - Tests for login machine
  - Contains test for max attempts exceeded scenario
  - Tests verify PIN clearing and state transitions

- `src/services/database-storage.ts` - Database service
  - Contains `clearCustomerPin()` method that sets encrypted_pin to NULL
  - Already implemented and called on 3rd failed attempt

- `src/templates/sms/activation.ts` - SMS templates
  - Contains `accountLockedSMS()` function for SMS notification

## Step by Step Tasks

### Step 1: Fix Warning Message Display on PIN Entry Screen

**Issue**: The warning messages are not being displayed on the "Enter your PIN:" screen after incorrect attempts.

**Root Cause**: In `loginMachine.ts`, when an incorrect PIN is entered, the message is set in the `verifyingPin` state's `onError` handler (line 503), but the state transitions back to `pinEntry`. However, the `pinEntry` state's `entry` action (line 426) overwrites the message with just `PIN_PROMPT`, losing the warning message.

**Fix**:

- Modify the `pinEntry` state to check if there are previous failed attempts and include the warning message in the entry action
- Update the message assignment logic to preserve the warning message when re-entering `pinEntry` after a failed attempt

### Step 2: Update Message Templates to Match Specification

**Issue**: Current message format doesn't match the specification.

**Current Format**: "Incorrect PIN. Please try again. (Attempt X of 3)"
**Expected Format**: "X of 3 attempts - Y left - account will be locked upon 3 incorrect attempts"

**Fix**:

- Update `INCORRECT_PIN_MSG()` function in `loginMachine.ts` to generate messages in the specified format
- Ensure messages are displayed on the same screen as the PIN prompt

### Step 3: Route MAX_ATTEMPTS_EXCEEDED to Pre-Menu Instead of Account Menu

**Issue**: After 3 failed attempts, the user is routed to Account Menu instead of Pre-Menu.

**Root Cause**: In `parentMachine.ts` (lines 372-378), `LoginOutput.MAX_ATTEMPTS_EXCEEDED` is routed to `accountMenu` state.

**Fix**:

- Change the routing in `parentMachine.ts` to route `MAX_ATTEMPTS_EXCEEDED` to `preMenu` instead of `accountMenu`
- Ensure the lockout message is displayed when the user reaches the Pre-Menu

### Step 4: Display Account Lockout Message on Pre-Menu

**Issue**: The account lockout message is not being displayed to the user.

**Root Cause**: The message set in the login machine is not being propagated to the parent machine's Pre-Menu state.

**Fix**:

- Ensure the message from the login machine is preserved when transitioning to Pre-Menu
- Display the lockout message before showing the Pre-Menu options
- After the user acknowledges the message (by pressing any key), show the Pre-Menu

### Step 5: Update Tests to Verify Correct Behavior

**Fix**:

- Update existing tests to verify warning messages are displayed on PIN entry screen
- Update tests to verify routing to Pre-Menu after max attempts
- Add tests to verify message format matches specification
- Ensure all tests pass with zero regressions

## Validation Commands

Execute every command to validate the chore is complete with zero regressions.

- `pnpm format && pnpm lint && pnpm tsc --noEmit && pnpm install && pnpm build && pnpm validate:machines && pnpm test` - Run tests to validate the chore is complete with zero regressions.

## Notes

- The PIN clearing functionality is already implemented in `dataService.clearCustomerPin()` and is called on the 3rd failed attempt
- SMS notification is already sent when account is locked
- The audit log entry is already created when account is locked
- Focus on fixing the message display and routing logic
- The specification requires the message format to be: "X of 3 attempts - Y left - account will be locked upon 3 incorrect attempts"
- After 3 failed attempts, the user should see the lockout message on the Pre-Menu screen, not the Account Menu
