# Bug: 1,000 Day Survey Returns "System error. Please try again." When Pressing Back (0)

## Bug Description

When a user navigates to the 1,000 Day Survey from Agent Tools and presses "0" to go back from the initial survey question (asking for Customer ID), the system displays "CON System error. Please try again." instead of properly navigating back to the Agent Tools menu.

**Symptoms:**

- User enters Agent Tools menu
- Selects "2. 1,000 Day Survey"
- System prompts: "What is the Customer ID for the Customer on whose behalf you are completing the survey?"
- User presses "0" to go back
- System displays: "CON System error. Please try again." with "0. Back" option
- Expected: Should return to Agent Tools menu

**Expected Behavior:**
Pressing "0" should navigate back to the Agent Tools menu cleanly without any error message.

**Actual Behavior:**
The machine transitions to the `error` state and displays a generic system error message.

## Problem Statement

The `thousandDaySurveyMachine` is missing the required navigation guards (`isBack` and `isExit`) in its XState v5 setup section. The `withNavigation` mixin adds navigation transitions that reference these guards, but when XState tries to evaluate them, they don't exist in the machine's guard definitions, causing the machine to fail and transition to the error state.

## Solution Statement

Add the missing `isBack` and `isExit` navigation guards to the `thousandDaySurveyMachine` setup section, following the same pattern used in other machines like `loginMachine`, `accountCreationMachine`, and `knowMoreMachine`. These guards should delegate to the centralized `navigationGuards.isBackCommand` and `navigationGuards.isExitCommand` functions.

## Steps to Reproduce

1. Start the interactive USSD test: `pnpm test:interactive`
2. Press Enter to dial \*2233#
3. Enter "2" to select Account Menu
4. Enter "1" to select Login
5. Enter a valid Customer ID (e.g., "C73DE2A07")
6. Enter "1" to continue
7. Enter a valid PIN (e.g., "10101")
8. Enter "1" to continue (login successful)
9. Enter "1" to continue to Agent Tools
10. Enter "2" to select "1,000 Day Survey"
11. System prompts for Customer ID
12. Enter "0" to go back
13. **BUG**: System displays "CON System error. Please try again." instead of returning to Agent Tools

## Root Cause Analysis

The root cause is in `src/machines/supamoto/thousand-day-survey/thousandDaySurveyMachine.ts`:

**Missing Guards:**
The machine's setup section (lines 342-402) defines guards for survey validation (`isValidCustomerId`, `isValidBeneficiaryCategory`, etc.) but does NOT define the `isBack` and `isExit` guards that are required by the `withNavigation` mixin.

**How the Error Occurs:**

1. The `askCustomerId` state uses `withNavigation` with `backTarget: "routeToMain"` (line 452)
2. `withNavigation` adds a transition that checks the `isBack` guard (from `navigation-mixin.ts` line 32)
3. When user inputs "0", XState tries to evaluate the `isBack` guard
4. The guard doesn't exist in the machine's setup, so XState cannot evaluate it
5. XState treats this as an error condition and the machine transitions to the `error` state
6. The error state displays "System error. Please try again."

**Comparison with Working Machines:**
Other machines like `loginMachine` (line 283-286), `accountCreationMachine`, and `knowMoreMachine` (line 83-86) all properly define these guards:

```typescript
guards: {
  // ... other guards
  isBack: ({ event }) =>
    navigationGuards.isBackCommand(null as any, event as any),
  isExit: ({ event }) =>
    navigationGuards.isExitCommand(null as any, event as any),
}
```

## Relevant Files

Use these files to fix the bug:

- **src/machines/supamoto/thousand-day-survey/thousandDaySurveyMachine.ts** (lines 342-402)
  - Contains the machine setup section where guards are defined
  - Missing `isBack` and `isExit` guard definitions
  - Needs to import `navigationGuards` from guards module

- **src/machines/supamoto/guards/navigation.guards.ts**
  - Contains the centralized navigation guard functions
  - Provides `isBackCommand` and `isExitCommand` that should be used

- **src/machines/supamoto/account-login/loginMachine.ts** (lines 283-286)
  - Reference implementation showing correct guard pattern
  - Example of how to properly define navigation guards

- **src/machines/supamoto/information/knowMoreMachine.ts** (lines 83-86)
  - Another reference implementation
  - Shows the same pattern for navigation guards

- **tests/flows/1000-day-household-survey-flow.test.ts**
  - Existing test file for the survey flow
  - Should be updated to include test for back navigation from initial state

### New Files

- **tests/flows/1000-day-survey-back-navigation.test.ts**
  - New test file specifically for testing back navigation behavior
  - Validates that pressing "0" from askCustomerId returns to Agent Tools
  - Ensures no error state is triggered

## Step by Step Tasks

### Step 1: Add Missing Navigation Guards to thousandDaySurveyMachine

- Import `navigationGuards` from the guards module at the top of the file
- Add `isBack` and `isExit` guard definitions to the setup section's guards object
- Follow the exact pattern used in other machines (loginMachine, knowMoreMachine)
- Place the navigation guards after the survey-specific guards for consistency

### Step 2: Verify Import Statement

- Ensure `navigationGuards` is imported from `../guards/navigation.guards.js`
- Verify the import path is correct and uses `.js` extension
- Check that the import is added alongside existing imports

### Step 3: Create Test for Back Navigation

- Create a new test file `tests/flows/1000-day-survey-back-navigation.test.ts`
- Test the specific scenario: navigate to survey, press "0", verify return to Agent Tools
- Ensure no error state is triggered
- Verify the message does not contain "System error"

### Step 4: Update Existing Survey Flow Tests

- Review `tests/flows/1000-day-household-survey-flow.test.ts`
- Add test case for back navigation from the initial askCustomerId state
- Ensure test validates clean navigation without errors

### Step 5: Run Validation Commands

- Execute all validation commands listed below
- Ensure zero regressions
- Verify the bug is fixed by running the reproduction steps
- Confirm all tests pass

## Validation Commands

Execute every command to validate the bug is fixed with zero regressions.

- `pnpm test:interactive` - Manually reproduce the bug scenario (steps 1-13 above) and verify "0" now returns to Agent Tools without error
- `pnpm test:flows:1000daysurvey` - Run the 1,000 Day Survey flow tests to ensure no regressions
- `pnpm tsc --noEmit` - Verify TypeScript compilation succeeds with no errors
- `pnpm lint` - Ensure code style and linting rules are followed
- `pnpm build` - Verify the build completes successfully
- `pnpm validate:machines` - Validate all state machines are properly configured
- `pnpm test` - Run full test suite to ensure zero regressions across the codebase
- `pnpm install && pnpm format && pnpm lint && pnpm tsc --noEmit && pnpm build && pnpm validate:machines && pnpm test` - Run complete validation pipeline

## Notes

**Why the `null as any, event as any` Pattern:**
The navigation guards use this pattern because:

- Centralized validators expect different type signatures than XState guards
- `null as any` bypasses the context parameter (navigation only needs event data)
- `event as any` ensures compatibility with the centralized validation interface
- This is the established pattern used throughout the codebase

**Minimal Change Philosophy:**
This fix adds exactly 2 guard definitions (isBack and isExit) and 1 import statement. No other changes are needed. The `withNavigation` mixin already has the correct logic; it just needs the guards to be defined.

**Testing Strategy:**
The bug is easily reproducible via interactive testing. The fix should be validated both manually (via `pnpm test:interactive`) and automatically (via flow tests) to ensure complete coverage.

**Related Patterns:**
All child machines that use `withNavigation` must define `isBack` and `isExit` guards. This is documented in the MACHINE_TEMPLATE.ts file and should be followed consistently.
