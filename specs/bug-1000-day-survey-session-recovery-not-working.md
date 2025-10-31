# Bug: 1000 Day Survey Session Recovery Not Working

## Bug Description

When a Lead Generator starts a 1,000 Day Survey for a customer, answers some questions, and then exits the survey (either intentionally or due to session timeout), returning to complete the survey later causes the following issues:

**Symptoms:**

1. The survey restarts from the beginning (Question 1) instead of resuming from where the user left off
2. Previously answered questions are shown again and must be re-entered
3. The database may contain duplicate or incomplete survey data
4. Users lose progress and must repeat work

**Expected Behavior:**

1. Survey should resume from the first unanswered question
2. Previously answered questions should be skipped automatically
3. Survey data should be preserved in the database
4. Only one database record should exist per LG/Customer pair

**Actual Behavior:**

1. Survey always starts from Question 1 (Beneficiary Category)
2. Previously answered questions are not skipped
3. Survey data is preserved but not used for recovery
4. Session recovery populates context but doesn't route to the correct question

## Problem Statement

The `recoveringSession` state in `thousandDaySurveyMachine.ts` successfully retrieves and populates the context with previously answered questions, but it always transitions to `askBeneficiaryCategory` (the first question) regardless of which questions have already been answered. There is no routing logic to determine which question should be shown next based on the recovered session data.

## Solution Statement

Add conditional routing logic to the `recoveringSession` state that:

1. Checks which questions have been answered (using guards)
2. Routes to the first unanswered question in the survey sequence
3. Skips all previously answered questions
4. Handles conditional questions (e.g., child age only shown if child selected)
5. Handles multi-part questions (nutritional benefits) appropriately

The solution requires:

- Adding guards to check if each question has been answered
- Implementing conditional routing in the `recoveringSession` state's `INPUT` event handler
- Ensuring the routing logic follows the same question sequence as the normal flow
- Testing session recovery at various points in the survey

## Steps to Reproduce

1. Start the USSD server: `pnpm dev`
2. Run interactive test: `pnpm test:interactive`
3. Login as a Lead Generator (e.g., C142316B7)
4. Select "2. 1,000 Day Survey" from Agent Tools
5. Enter a Customer ID (e.g., CA41E9049)
6. Answer the first 2-3 questions:
   - Question 1 (Beneficiary Category): Select "1" (Pregnant Woman)
   - Question 2 (Price Specification): Enter "10"
   - Question 3 (Awareness Iron Beans): Displayed
7. Type `exit` to interrupt the survey
8. Restart the interactive test: `pnpm test:interactive`
9. Login again as the same Lead Generator (C142316B7)
10. Select "2. 1,000 Day Survey" from Agent Tools
11. Enter the same Customer ID (CA41E9049)
12. **BUG:** Survey shows Question 1 (Beneficiary Category) instead of Question 3 (Awareness Iron Beans)

## Root Cause Analysis

### Primary Cause: Missing Routing Logic

The `recoveringSession` state (lines 598-642 in `thousandDaySurveyMachine.ts`) has the following structure:

```typescript
recoveringSession: {
  entry: assign(() => ({
    message: "Checking for existing survey data...\n\n1. Continue",
  })),
  invoke: {
    id: "recoverSession",
    src: "recoverSessionService",
    input: ({ context }) => ({
      lgCustomerId: context.lgCustomerId,
      customerId: context.customerId,
    }),
    onDone: {
      actions: assign({
        // ✅ Context is populated correctly
        beneficiaryCategory: ({ event }) => event.output?.answers?.["ecs:beneficiaryCategory"],
        childAge: ({ event }) => event.output?.answers?.["schema:childMaxAge"],
        // ... all other fields populated
      }),
    },
  },
  on: {
    INPUT: {
      target: "askBeneficiaryCategory",  // ❌ ALWAYS goes to first question
    },
  },
},
```

**The Problem:**

- The `onDone` action correctly populates context with recovered answers
- The `INPUT` event handler always routes to `askBeneficiaryCategory`
- There are no guards to check which questions have been answered
- There is no conditional routing based on recovered data

### Secondary Cause: No Recovery Guards

The machine lacks guards to determine which questions have been answered:

```typescript
// ❌ MISSING: Guards to check answered questions
guards: {
  hasAntenatalCardVerified: ({ context }) => !!context.antenatalCardVerified,
  hasNutritionalBenefits: ({ context }) => !!context.nutritionalBenefitDetails,
  hasKnowsNutritionalBenefits: ({ context }) => !!context.knowsNutritionalBenefits,
  hasAwarenessIronBeans: ({ context }) => !!context.awarenessIronBeans,
  hasPriceSpecification: ({ context }) => !!context.priceSpecification,
  hasBeanIntakeFrequency: ({ context }) => !!context.beanIntakeFrequency,
  hasChildAge: ({ context }) => !!context.childAge,
  hasBeneficiaryCategory: ({ context }) => !!context.beneficiaryCategory,
}
```

### Data Flow Analysis

1. ✅ **Survey answers are saved correctly** - Each answer is saved to the database via `saveAnswerService`
2. ✅ **Session recovery retrieves data correctly** - `recoverSessionService` fetches and returns survey data
3. ✅ **Context is populated correctly** - The `onDone` action assigns all recovered values to context
4. ❌ **Routing logic is missing** - The `INPUT` handler doesn't use the recovered context to determine next state

### Question Sequence

The survey has the following question sequence:

1. `askBeneficiaryCategory` (always shown)
2. `askChildAge` (conditional - only if child selected)
3. `askBeanIntakeFrequency` (conditional - only if child selected)
4. `askPriceSpecification` (always shown)
5. `askAwarenessIronBeans` (always shown)
6. `askKnowsNutritionalBenefits` (always shown)
7. `askNutritionalBenefit1` through `askNutritionalBenefit5` (multi-part, always shown)
8. `askAntenatalCardVerified` (always shown)

The recovery logic must respect this sequence and conditional visibility rules.

## Relevant Files

Use these files to fix the bug:

- **`src/machines/supamoto/thousand-day-survey/thousandDaySurveyMachine.ts`** (lines 598-642)
  - Contains the `recoveringSession` state that needs routing logic
  - Contains the guards section where recovery guards need to be added
  - Contains all question states that recovery might route to

- **`src/machines/supamoto/thousand-day-survey/survey-mappers.ts`**
  - Contains `shouldShowChildAgeQuestion()` helper for conditional visibility
  - May need additional helpers for recovery routing logic

- **`src/services/survey-response-storage.ts`**
  - Contains `getSurveyResponseState()` that retrieves saved answers
  - Already working correctly - no changes needed

- **`src/services/database-storage.ts`** (lines 1548-1618)
  - Contains `getClaimByLgAndCustomer()` that fetches claim data
  - Already working correctly - no changes needed

### New Files

- **`tests/flows/1000-day-survey-session-recovery.test.ts`**
  - New test file to validate session recovery at various points
  - Test recovery after Question 1, 2, 3, etc.
  - Test recovery with conditional questions
  - Test recovery during multi-part questions

## Step by Step Tasks

IMPORTANT: Execute every step in order, top to bottom.

### Step 1: Add Session Recovery Guards

- Open `src/machines/supamoto/thousand-day-survey/thousandDaySurveyMachine.ts`
- Locate the `guards` section in the machine setup (around line 1400)
- Add new guards to check if each question has been answered:
  - `hasBeneficiaryCategory`: Check if `context.beneficiaryCategory` exists
  - `hasChildAge`: Check if `context.childAge` exists
  - `hasBeanIntakeFrequency`: Check if `context.beanIntakeFrequency` exists
  - `hasPriceSpecification`: Check if `context.priceSpecification` exists
  - `hasAwarenessIronBeans`: Check if `context.awarenessIronBeans` exists
  - `hasKnowsNutritionalBenefits`: Check if `context.knowsNutritionalBenefits` exists
  - `hasNutritionalBenefits`: Check if `context.nutritionalBenefitDetails` exists
  - `hasAntenatalCardVerified`: Check if `context.antenatalCardVerified` exists
- Each guard should return `true` if the answer exists, `false` otherwise

### Step 2: Implement Conditional Routing in recoveringSession State

- Locate the `recoveringSession` state (line 598)
- Replace the simple `INPUT` handler with conditional routing
- Add array of transition objects with guards (evaluated in order):
  1. If `hasAntenatalCardVerified` → route to `askAntenatalCardVerified` (survey complete, show last question)
  2. If `hasNutritionalBenefits` → route to `askAntenatalCardVerified` (skip to last question)
  3. If `hasKnowsNutritionalBenefits` → route to `askNutritionalBenefit1` (resume multi-part questions)
  4. If `hasAwarenessIronBeans` → route to `askKnowsNutritionalBenefits`
  5. If `hasPriceSpecification` → route to `askAwarenessIronBeans`
  6. If `hasBeanIntakeFrequency` → route to `askPriceSpecification`
  7. If `hasChildAge` → route to `askBeanIntakeFrequency`
  8. If `hasBeneficiaryCategory` AND `shouldShowChildAge` → route to `askChildAge`
  9. If `hasBeneficiaryCategory` AND NOT `shouldShowChildAge` → route to `askPriceSpecification`
  10. Default (no guard) → route to `askBeneficiaryCategory` (start from beginning)
- Use `withNavigation()` wrapper to maintain back/exit functionality

### Step 3: Handle Conditional Question Logic

- Ensure routing respects conditional visibility rules
- If child was selected in beneficiary category, route to `askChildAge`
- If child was NOT selected, skip `askChildAge` and `askBeanIntakeFrequency`
- Reuse existing `shouldShowChildAge` guard for this logic

### Step 4: Handle Multi-Part Question Recovery

- Multi-part nutritional benefits questions (1-5) should restart from Question 1
- If `hasKnowsNutritionalBenefits` but NOT `hasNutritionalBenefits`, route to `askNutritionalBenefit1`
- This ensures users complete all 5 questions in sequence
- Do not attempt to resume mid-way through the 5-part question

### Step 5: Add Logging for Recovery Routing

- Add logger statements in the recovery routing logic
- Log which question is being resumed
- Log which answers were recovered
- This helps with debugging and monitoring

### Step 6: Create Session Recovery Flow Test

- Create `tests/flows/1000-day-survey-session-recovery.test.ts`
- Test Case 1: Interrupt after Question 1, resume from Question 2
- Test Case 2: Interrupt after Question 3, resume from Question 4
- Test Case 3: Interrupt after Question 5, resume from Question 6
- Test Case 4: Interrupt during nutritional benefits, resume from Question 1 of benefits
- Test Case 5: Interrupt with conditional question (child selected), resume correctly
- Test Case 6: Interrupt with conditional question (child NOT selected), skip correctly
- Each test should verify the correct question is shown after recovery

### Step 7: Update Existing Flow Test

- Open `tests/flows/1000-day-household-survey-flow.test.ts`
- Add comment explaining that this test does NOT test session recovery
- Reference the new session recovery test file for recovery scenarios

### Step 8: Run Validation Commands

- Execute all validation commands listed below
- Ensure zero regressions
- Verify the bug is fixed by running the reproduction steps
- Confirm session recovery works at all points in the survey

## Validation Commands

Execute every command to validate the bug is fixed with zero regressions.

- `pnpm install && pnpm format && pnpm lint && pnpm tsc --noEmit && pnpm build && pnpm validate:machines && pnpm test` - Run tests to validate the bug is fixed with zero regressions.
- `pnpm test:flows:run` - Run all flow tests including the new session recovery test
- `pnpm test tests/flows/1000-day-survey-session-recovery.test.ts` - Run the specific session recovery test
- `pnpm test:interactive` - Manually test session recovery using interactive mode (follow reproduction steps)

## Notes

### Design Decisions

1. **Multi-Part Question Handling**: The nutritional benefits questions (1-5) are treated as a single unit. If interrupted during these questions, recovery restarts from Question 1 of the 5-part sequence. This is intentional to ensure all 5 answers are collected together.

2. **Conditional Question Logic**: The recovery routing must respect the same conditional visibility rules as the normal flow. If a child was selected in the beneficiary category, the child age and bean intake frequency questions must be shown.

3. **Guard Evaluation Order**: Guards are evaluated in reverse question order (last to first). This ensures we route to the earliest unanswered question.

4. **Database Integrity**: The UNIQUE constraint on `(lg_customer_id, customer_id)` in the `household_claims` table ensures only one record exists per LG/Customer pair. The `createClaimService` already checks for existing claims and reuses them, so no database changes are needed.

### Testing Strategy

- **Unit Tests**: Not needed - the guards are simple existence checks
- **Flow Tests**: Critical - must test recovery at multiple points in the survey
- **Manual Testing**: Important - use interactive mode to verify real-world behavior

### Related Issues

This bug is related to but distinct from:

- `bug-1000-day-survey-not-showing-questions.md` - Different root cause (empty customerId)
- `bug-thousand-day-survey-missing-navigation-guards.md` - Different issue (back navigation)
- `bug-thousand-day-survey-processing-states-stuck.md` - Different issue (processing states)

### Performance Considerations

The recovery routing adds minimal overhead:

- Guards are simple boolean checks on context properties
- No additional database queries required
- Recovery only happens once per session (at the start)

### User Experience Impact

After this fix:

- Users can safely exit and resume surveys without losing progress
- Lead Generators can complete surveys across multiple sessions
- Survey completion rates should improve significantly
- User frustration from re-entering data will be eliminated
