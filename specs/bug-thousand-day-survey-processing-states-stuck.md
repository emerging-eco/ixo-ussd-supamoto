# Bug: 1,000 Day Survey - Users Stuck at Processing States ("Creating claim record...")

## Bug Description

Users get stuck at processing states in the 1,000 Day Survey and cannot proceed forward. When the survey machine enters an invoke state (e.g., `creatingClaim`, `savingBeneficiaryCategory`, etc.), the user sees a processing message like "Creating claim record..." or "Saving answer..." with only "0. Back" option, but no way to continue forward.

**Symptoms:**

- User enters Customer ID for the survey
- System displays: "CON Creating claim record..." with "0. Back"
- User cannot proceed - pressing "0" doesn't help, pressing "1" doesn't work
- User is stuck in an infinite loop showing the same processing message
- The async operation completes successfully, but the UI never advances

**Expected Behavior:**
After async operations complete, users should see "1. Continue" option and be able to press "1" to proceed to the next state.

**Actual Behavior:**
Processing states show no "1. Continue" option and have no INPUT handler, causing users to get stuck indefinitely.

## Problem Statement

The `thousandDaySurveyMachine` has 12 invoke states that perform async operations (database saves, claim creation, etc.). These states follow XState's standard pattern of transitioning automatically via `onDone`, but this conflicts with USSD's request-response architecture where every state transition requires user input. The states lack `on: { INPUT: ... }` handlers, making it impossible for users to trigger the transition to the next state after the async operation completes.

## Solution Statement

Add "1. Continue" prompts and INPUT handlers to all 12 invoke states, following the established pattern from `loginMachine`. Move the `target` from `onDone` to the `on.INPUT` handler, allowing users to trigger the transition after the async operation completes. This maintains XState best practices while adapting to USSD's request-response constraints.

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
11. Enter a valid Customer ID (e.g., "C73DE2A07")
12. **BUG**: System displays "CON Creating claim record..." with only "0. Back"
13. User cannot proceed - no "1. Continue" option available
14. Pressing "0" or "1" or any input just shows the same message again

## Root Cause Analysis

**Session Log Evidence** (`logs/sessions/session-2025-10-28-06-32-47.log`):

- Line 15-16: Machine enters `creatingClaim` state, shows "Creating claim record..."
- Line 17-18: User presses "0" → still shows "Creating claim record..."
- Line 19-20: User presses "1" → still shows "Creating claim record..."
- User is stuck in infinite loop

**Architectural Mismatch:**

**XState Standard Pattern:**

- Invoke states with async operations transition automatically via `onDone`/`onError`
- No user input required - machine transitions when promise resolves
- Works perfectly in event-driven architectures

**USSD System Constraint:**

- Request-response protocol - server sends message, waits for user input
- Each state transition requires a new HTTP request from client
- Client cannot "push" next state - must wait for user input
- Server cannot auto-advance without receiving a request

**The Conflict:**

1. Async operation completes → `onDone` updates context
2. XState is ready to transition to next state
3. BUT USSD client is still showing old message
4. Client has no way to trigger transition without user input
5. State has no `on: { INPUT: ... }` handler
6. User is stuck forever

**Why LoginMachine Works:**

The `loginMachine` solves this by adding INPUT handlers to invoke states:

```typescript
verifyingCustomerId: {
  entry: assign({ message: "Verifying Customer ID...\n1. Continue" }),
  invoke: {
    src: "customerLookupService",
    onDone: {
      // No target - just store result
      actions: [assign(({ event }) => ({ customer: event.output }))],
    },
  },
  on: {
    INPUT: withNavigation([
      { target: "pinEntry", guard: "isCustomerFound" },
      // ... other transitions based on stored result
    ], NavigationPatterns.loginChild),
  },
},
```

**Key Pattern:**

1. Message includes "1. Continue"
2. `onDone` stores result in context (no target)
3. `on: { INPUT: ... }` handler waits for user input
4. Guards check stored result and transition accordingly

## Relevant Files

Use these files to fix the bug:

- **src/machines/supamoto/thousand-day-survey/thousandDaySurveyMachine.ts** (lines 462-1240)
  - Contains all 12 invoke states that need fixing
  - Each state needs message update and INPUT handler added
  - Must preserve conditional transition logic where applicable

- **src/machines/supamoto/account-login/loginMachine.ts** (lines 350-547)
  - Reference implementation showing correct pattern
  - Example of how to handle invoke states in USSD context
  - Pattern to follow for all 12 states

- **tests/flows/1000-day-household-survey-flow.test.ts**
  - Existing test file for survey flow
  - Needs updates to include "1" inputs after processing states
  - Assertions need to expect "1. Continue" in messages

### New Files

- **tests/flows/1000-day-survey-processing-states.test.ts**
  - New dedicated test for processing state pattern
  - Validates all 12 states show "1. Continue"
  - Ensures all states accept "1" and transition correctly

## Step by Step Tasks

### Step 1: Fix creatingClaim State (line 462)

- Update message to include "\n\n1. Continue"
- Remove `target: "recoveringSession"` from `onDone`
- Keep `actions: assign({ claimId: ... })` in `onDone`
- Add `on: { INPUT: { target: "recoveringSession" } }`
- Keep `onError` unchanged

### Step 2: Fix recoveringSession State (line 496)

- Update message to include "\n\n1. Continue"
- Remove `target: "askBeneficiaryCategory"` from `onDone`
- Keep context assignment actions in `onDone`
- Add `on: { INPUT: { target: "askBeneficiaryCategory" } }`
- Keep `onError` unchanged

### Step 3: Fix savingBeneficiaryCategory State (line 577)

- Update message to include "\n\n1. Continue"
- Remove `target` from `onDone` array
- Keep conditional guards in place
- Add `on: { INPUT: [...] }` with same conditional logic
- Use guards: `shouldShowChildAge` → `askChildAge`, else → `askBeanIntakeFrequency`
- Keep `onError` unchanged

### Step 4: Fix savingChildAge State (line 642)

- Update message to include "\n\n1. Continue"
- Remove `target: "askBeanIntakeFrequency"` from `onDone`
- Add `on: { INPUT: { target: "askBeanIntakeFrequency" } }`
- Keep `onError` unchanged

### Step 5: Fix savingBeanIntakeFrequency State (line 704)

- Update message to include "\n\n1. Continue"
- Remove `target: "askPriceSpecification"` from `onDone`
- Add `on: { INPUT: { target: "askPriceSpecification" } }`
- Keep `onError` unchanged

### Step 6: Fix savingPriceSpecification State (line 766)

- Update message to include "\n\n1. Continue"
- Remove `target: "askAwarenessIronBeans"` from `onDone`
- Add `on: { INPUT: { target: "askAwarenessIronBeans" } }`
- Keep `onError` unchanged

### Step 7: Fix savingAwarenessIronBeans State (line 826)

- Update message to include "\n\n1. Continue"
- Remove `target: "askKnowsNutritionalBenefits"` from `onDone`
- Add `on: { INPUT: { target: "askKnowsNutritionalBenefits" } }`
- Keep `onError` unchanged

### Step 8: Fix savingKnowsNutritionalBenefits State (line 886)

- Update message to include "\n\n1. Continue"
- Remove `target: "askNutritionalBenefit1"` from `onDone`
- Add `on: { INPUT: { target: "askNutritionalBenefit1" } }`
- Keep `onError` unchanged

### Step 9: Fix savingNutritionalBenefits State (line 1106)

- Update message to include "\n\n1. Continue"
- Remove `target: "askAntenatalCardVerified"` from `onDone`
- Add `on: { INPUT: { target: "askAntenatalCardVerified" } }`
- Keep `onError` unchanged

### Step 10: Fix savingAntenatalCardVerified State (line 1165)

- Update message to include "\n\n1. Continue"
- Remove `target: "markingComplete"` from `onDone`
- Add `on: { INPUT: { target: "markingComplete" } }`
- Keep `onError` unchanged

### Step 11: Fix markingComplete State (line 1191)

- Update message to include "\n\n1. Continue"
- Remove `target: "submittingClaim"` from `onDone`
- Add `on: { INPUT: { target: "submittingClaim" } }`
- Keep `onError` unchanged

### Step 12: Fix submittingClaim State (line 1212)

- Update message to include "\n\n1. Continue"
- Remove `target: "claimSubmitted"` from `onDone`
- Add `on: { INPUT: { target: "claimSubmitted" } }`
- Keep `onError` with `target: "claimSubmissionFailed"` unchanged

### Step 13: Create Processing States Test File

- Create `tests/flows/1000-day-survey-processing-states.test.ts`
- Test each of the 12 processing states individually
- Verify "1. Continue" appears in messages
- Verify pressing "1" transitions to next state
- Test complete flow with all continue steps

### Step 14: Update Existing Flow Tests

- Update `tests/flows/1000-day-household-survey-flow.test.ts`
- Add "1" inputs after each processing state
- Update assertions to expect "1. Continue" in messages
- Ensure test completes successfully with new pattern

### Step 15: Run Validation Commands

- Execute all validation commands listed below
- Fix any issues that arise
- Ensure zero regressions

## Validation Commands

Execute every command to validate the bug is fixed with zero regressions.

- `pnpm install` - Install dependencies
- `pnpm format` - Format code
- `pnpm lint` - Lint code
- `pnpm tsc --noEmit` - Type check
- `pnpm build` - Build project
- `pnpm validate:machines` - Validate state machines
- `pnpm test` - Run all tests
- `pnpm test:interactive` - Manually test the complete survey flow (verify users can now proceed through all processing states)

## Notes

**Pattern Consistency:**
This fix follows the exact pattern established in `loginMachine` for handling async operations in USSD context. All 12 states will use the same pattern for consistency and maintainability.

**Why "1. Continue" Instead of Auto-Advance:**
USSD is a request-response protocol. The server cannot push new states to the client. Every state transition requires a new HTTP request triggered by user input. This is a fundamental constraint of the USSD architecture, not a limitation of our implementation.

**XState Best Practices Maintained:**

- Still using `invoke` for async operations
- Still storing results in context via `onDone` actions
- Still handling errors via `onError`
- Only addition is the INPUT handler to trigger transitions

**User Experience Impact:**
Users will need to press "1" after each processing state (12 additional inputs throughout the survey). This is unavoidable given USSD's architecture, but it's far better than users getting stuck indefinitely.

**Testing Strategy:**

- Unit tests validate each state individually
- Flow tests validate complete survey journey
- Manual testing via interactive mode validates real-world usage
- All three levels of testing ensure comprehensive coverage

**Estimated Changes:**

- ~120 lines modified in `thousandDaySurveyMachine.ts` (10 lines per state × 12 states)
- ~200 lines in new test file
- ~50 lines updated in existing test file
- Total: ~370 lines changed across 3 files
