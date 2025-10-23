# Bug: 1,000 Day Survey Not Showing Questions

## Bug Description

When a Lead Generator successfully logs in and navigates to 'Agent Tools' and selects '2. 1,000 Day Survey', they do not see the survey questions. Instead, they immediately see 'CON Loading survey... 0. Back'. When they try to interact (pressing 0 to go back), the message 'Survey complete!' is shown, and any further interaction continues to show 'Survey complete!'.

**Expected behavior:**

- After selecting '2. 1,000 Day Survey', the Lead Generator should see the first survey question with its choices
- They should be able to navigate through all survey questions
- Only after answering all required questions should they see 'Survey complete!'

**Actual behavior:**

- The survey shows 'Loading survey... 0. Back' and never progresses to questions
- Pressing '0' shows 'Survey complete!' immediately
- The survey cannot be completed properly

## Problem Statement

The household survey machine is not properly handling the initial state when `customerId` is empty. When the Lead Generator enters the survey flow, the `customerId` is intentionally empty (as it will be entered during the survey), but the session recovery logic attempts to find unanswered questions with an empty `customerId`, which causes `findIndex` to return `-1`. This results in `currentQuestionIndex` being set to `-1`, which makes `allQuestions[-1]` return `undefined`, triggering the "Survey complete!" message immediately.

Additionally, there is a SQL syntax error in the `markSurveyComplete` function that uses `ORDER BY` and `LIMIT` in an UPDATE statement, which is not valid SQL syntax. This causes a database error when trying to mark the survey as complete.

## Solution Statement

1. **Fix the session recovery logic**: When `customerId` is empty or when `findIndex` returns `-1`, ensure `currentQuestionIndex` defaults to `0` to start from the first question.

2. **Fix the SQL syntax error**: Rewrite the `markSurveyComplete` query to first SELECT the record ID using a subquery, then UPDATE that specific record without using `ORDER BY` and `LIMIT` in the UPDATE statement.

## Steps to Reproduce

1. Start the interactive test: `pnpm test:interactive`
2. Navigate to Account Menu (option 2)
3. Select "Yes, log me in" (option 1)
4. Enter Customer ID: `CD7C6BE58`
5. Continue (option 1)
6. Enter PIN: `10101`
7. Continue (option 1)
8. Continue to main menu (option 1)
9. Select "Agent Tools" (option 2) - assuming the user is a Lead Generator
10. Select "1,000 Day Survey" (option 2)
11. Observe: Shows "Loading survey... 0. Back" instead of first question
12. Press 0 to go back
13. Observe: Shows "Survey complete!" instead of returning to menu

## Root Cause Analysis

### Primary Issue: Invalid currentQuestionIndex

In `src/machines/supamoto/activation/householdSurveyMachine.ts`, the `recoveringSession` state's `onDone` action sets `currentQuestionIndex` using:

```typescript
currentQuestionIndex: ({ context, event }) => {
  // Find first unanswered question
  const answers = event.output?.answers || {};
  return context.allQuestions.findIndex(
    q => answers[q.name] === undefined
  );
},
```

When `customerId` is empty (which it is initially in the agent survey flow), the recovery service returns `null` or an empty answers object. The `findIndex` method returns `-1` when no matching element is found (which happens when all questions are "unanswered" because answers is empty). This `-1` value is then used as the `currentQuestionIndex`.

In the `presentingQuestion` state, when accessing `context.allQuestions[context.currentQuestionIndex]` with index `-1`, it returns `undefined`, which triggers the "Survey complete!" message:

```typescript
const question = context.allQuestions[context.currentQuestionIndex];
if (!question) {
  return "Survey complete!\n\n1. Continue";
}
```

### Secondary Issue: SQL Syntax Error

In `src/services/database-storage.ts`, the `markSurveyComplete` function uses:

```typescript
const result = await db
  .updateTable("household_survey_responses")
  .set({
    all_fields_completed: true,
    updated_at: new Date(),
  })
  .where("lg_customer_id", "=", lgCustomerId)
  .where("customer_id", "=", customerId)
  .orderBy("created_at", "desc")
  .limit(1)
  .returningAll()
  .executeTakeFirstOrThrow();
```

PostgreSQL does not support `ORDER BY` and `LIMIT` clauses directly in UPDATE statements. This causes the error: `syntax error at or near "order"`.

## Relevant Files

Use these files to fix the bug:

- **src/machines/supamoto/activation/householdSurveyMachine.ts** - Contains the survey state machine with the session recovery logic that needs to be fixed to handle the `-1` index case
- **src/services/database-storage.ts** - Contains the `markSurveyComplete` function with the invalid SQL syntax that needs to be rewritten
- **logs/console.localhost.log** - Contains the error logs showing the SQL syntax error

## Step by Step Tasks

### 1. Fix currentQuestionIndex in householdSurveyMachine

- Update the `recoveringSession` state's `onDone` action in `src/machines/supamoto/activation/householdSurveyMachine.ts`
- Ensure that when `findIndex` returns `-1`, the `currentQuestionIndex` is set to `0` instead
- Use `Math.max(0, findIndex(...))` to ensure the index is never negative

### 2. Fix SQL syntax error in markSurveyComplete

- Update the `markSurveyComplete` function in `src/services/database-storage.ts`
- Rewrite the query to use a subquery approach: first SELECT the ID of the record to update, then UPDATE that specific record
- Remove the `orderBy` and `limit` clauses from the UPDATE statement
- Ensure the query still updates only the most recent record for the given LG-Customer pair

### 3. Run validation commands

- Execute all validation commands to ensure the bug is fixed with zero regressions
- Test the interactive flow manually to verify the survey questions now appear correctly

## Validation Commands

Execute every command to validate the bug is fixed with zero regressions.

- `pnpm test:interactive` - Manually test the flow: login as Lead Generator (CD7C6BE58, PIN 10101), navigate to Agent Tools > 1,000 Day Survey, and verify that survey questions are displayed instead of "Survey complete!"
- `pnpm install && pnpm format && pnpm lint && pnpm tsc --noEmit && pnpm build && pnpm validate:machines && pnpm test` - Run tests to validate the bug is fixed with zero regressions

## Notes

- The bug has two separate root causes that both need to be fixed:
  1. The state machine logic issue (currentQuestionIndex = -1)
  2. The SQL syntax error (ORDER BY in UPDATE statement)
- The first issue prevents the survey from showing questions
- The second issue prevents the survey from being marked as complete even if questions were answered
- Both issues must be fixed for the survey to work end-to-end
- The fix should be minimal and surgical - only change what's necessary to fix these specific issues
- The `customerId` being empty initially is intentional design (it will be entered during the survey flow), so the fix should handle this case gracefully
