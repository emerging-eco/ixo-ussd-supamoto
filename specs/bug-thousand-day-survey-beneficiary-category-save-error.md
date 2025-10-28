# Bug: 1,000 Day Survey - Error When Saving Beneficiary Category Answer

## Bug Description

When a Lead Generator completes the 1,000 Day Survey and selects a beneficiary category (e.g., "1. A - Pregnant Woman"), the system successfully saves the selection to context and displays "Saving answer..." with "1. Continue". However, when the user presses "1" to continue, the system transitions to an error state displaying "CON Error: An unexpected error occurred" instead of proceeding to the next question.

**Symptoms:**

- User successfully navigates through survey initialization (creating claim, recovering session)
- User selects beneficiary category option (e.g., "1" for Pregnant Woman)
- System shows "Saving answer..." with "1. Continue" prompt
- User presses "1" to continue
- System displays error: "CON Error: An unexpected error occurred"
- Survey cannot proceed beyond this point

**Expected Behavior:**
After pressing "1" to continue from "Saving answer...", the system should:

- Successfully save the beneficiary category to the database
- Transition to either `askChildAge` (if child selected) or `askBeanIntakeFrequency` (if no child)
- Display the next survey question without errors

**Actual Behavior:**
The `saveAnswerService` throws an error, triggering the `onError` handler which transitions to the `error` state with a generic error message.

## Problem Statement

The `saveSurveyAnswer` function in `survey-response-storage.ts` has a TypeScript type signature that declares the `answer` parameter as `string | boolean | number`, but the `beneficiaryCategory` field is an array (`string[]`). When the `savingBeneficiaryCategory` state invokes `saveAnswerService` with `context.beneficiaryCategory` (which is `["pregnant_woman"]`), there is a type mismatch that may cause runtime errors during JSON serialization, database storage, or encryption.

Additionally, the database schema stores `survey_form` as TEXT (encrypted JSON), and there may be issues with:

1. Serializing array values in the JSON structure
2. Encrypting/decrypting JSON containing arrays
3. The GIN index on `survey_form::jsonb` attempting to cast encrypted text to JSONB

## Solution Statement

Update the type signature of `saveSurveyAnswer` and related functions to explicitly support array types (`string[]`, `number[]`, etc.) in addition to primitive types. Ensure that:

1. The TypeScript type signature for `answer` parameter includes array types
2. JSON serialization properly handles arrays
3. Encryption/decryption works correctly with JSON containing arrays
4. Database storage and retrieval handles array values correctly

The fix should be minimal and surgical - only updating type signatures and ensuring proper handling of array values without changing the overall architecture or data flow.

## Steps to Reproduce

1. Start the USSD server: `pnpm dev`
2. Start interactive test: `pnpm test:interactive`
3. Navigate to Account Menu → Login
4. Enter Lead Generator credentials (Customer ID: C73DE2A07, PIN: 10101)
5. Navigate to Agent Tools → "2. 1,000 Day Survey"
6. Enter a valid Customer ID (e.g., C1F53E2F7)
7. Press "1" to continue through "Creating claim record..."
8. Press "1" to continue through "Checking for existing survey data..."
9. Select beneficiary category "1" (Pregnant Woman)
10. System shows "Saving answer..." with "1. Continue"
11. Press "1" to continue
12. **BUG**: System displays "CON Error: An unexpected error occurred"

## Root Cause Analysis

**Session Log Evidence** (`logs/sessions/session-2025-10-28-08-19-38.log`):

- Line 154: User selects option "1" (Pregnant Woman)
- Line 156-158: System shows "Saving answer..." with "1. Continue"
- Line 160: User presses "1"
- Line 162-164: System shows error state

**Code Analysis:**

1. **Type Mismatch in survey-response-storage.ts (line 140)**:

   ```typescript
   async saveSurveyAnswer(
     lgCustomerId: string,
     customerId: string,
     questionName: string,
     answer: string | boolean | number,  // ❌ Does not include array types
     formDefinition?: ParsedSurveyForm
   ): Promise<void>
   ```

2. **Beneficiary Category is an Array** (survey-mappers.ts line 17-40):

   ```typescript
   export function mapBeneficiaryCategory(ussdInput: string): string[] {
     // Returns array like ["pregnant_woman"] or ["pregnant_woman", "breastfeeding_mother"]
   }
   ```

3. **Machine Passes Array to Service** (thousandDaySurveyMachine.ts line 596):

   ```typescript
   answer: context.beneficiaryCategory,  // This is string[], not string
   ```

4. **Runtime Error**: When `saveSurveyAnswer` receives an array but expects a primitive, it may:
   - Fail during JSON.stringify if there's type validation
   - Fail during encryption if the encryption function expects a string
   - Fail during database insertion if there's a constraint violation
   - Fail silently and store incorrect data

**Why This Wasn't Caught Earlier:**

- TypeScript allows the assignment at compile time (arrays are objects)
- The error only manifests at runtime during actual database operations
- Previous tests may not have covered this specific scenario with array values

## Relevant Files

Use these files to fix the bug:

- **src/services/survey-response-storage.ts** (lines 14-17, 136-196, 201-257)
  - Contains `SurveyAnswer` interface with restrictive type
  - Contains `saveSurveyAnswer` function with `answer: string | boolean | number` parameter
  - Contains `saveSurveyAnswers` function that accepts `Record<string, any>` (already supports arrays)
  - Needs type signature updates to support array values

- **src/machines/supamoto/thousand-day-survey/thousandDaySurveyMachine.ts** (lines 180-207, 585-617)
  - Contains `saveAnswerService` that calls `saveSurveyAnswer`
  - Passes `context.beneficiaryCategory` (array) as answer parameter
  - May need type assertion or validation

- **src/machines/supamoto/thousand-day-survey/survey-mappers.ts** (lines 17-40)
  - Contains `mapBeneficiaryCategory` that returns `string[]`
  - Documents the expected return type
  - Reference for understanding data structure

- **src/services/database-storage.ts** (lines 1478-1540)
  - Contains `updateClaimSurveyForm` that stores encrypted JSON
  - Handles JSON.stringify and encryption
  - Should already support arrays in JSON, but needs verification

- **tests/integration/survey-refactor.test.ts** (lines 242-297)
  - Contains tests for saving survey answers
  - Includes test for `beneficiaryCategory` with string value
  - Needs update to test array values

### New Files

- **tests/integration/survey-array-values.test.ts**
  - New test file specifically for testing array value storage
  - Validates beneficiaryCategory (array) can be saved and retrieved
  - Ensures encryption/decryption works with arrays
  - Tests complete flow from save to retrieve

## Step by Step Tasks

### Step 1: Update Type Signatures in survey-response-storage.ts

- Update `SurveyAnswer` interface to support array types
- Change `answer` field type from `string | boolean | number` to `string | boolean | number | string[] | number[]`
- Update `saveSurveyAnswer` function parameter type to match
- Add JSDoc comments explaining array support
- Ensure backward compatibility with existing primitive values

### Step 2: Verify JSON Serialization Handles Arrays

- Review `buildSurveyFormJson` function to ensure arrays are properly included
- Verify `JSON.stringify` in `updateClaimSurveyForm` handles arrays correctly
- Test that encrypted JSON with arrays can be decrypted successfully
- Ensure no data loss or corruption when round-tripping array values

### Step 3: Add Validation for Array Values

- Add runtime validation in `saveSurveyAnswer` to check if answer is valid type
- Log array values appropriately (don't log full arrays, just length/type)
- Ensure error messages are helpful if validation fails
- Consider adding type guards for better type safety

### Step 4: Update saveAnswerService in thousandDaySurveyMachine

- Review the service implementation to ensure it handles arrays
- Add type assertion if needed: `answer: context.beneficiaryCategory as any`
- Consider adding validation before calling the service
- Ensure error handling provides useful context

### Step 5: Create Comprehensive Tests for Array Values

- Create `tests/integration/survey-array-values.test.ts`
- Test saving beneficiaryCategory with single value: `["pregnant_woman"]`
- Test saving beneficiaryCategory with multiple values: `["pregnant_woman", "breastfeeding_mother"]`
- Test saving and retrieving to verify data integrity
- Test encryption/decryption round-trip with arrays
- Test that other array fields (nutritionalBenefitDetails) also work

### Step 6: Update Existing Tests

- Update `tests/integration/survey-refactor.test.ts`
- Change beneficiaryCategory test to use array: `["pregnant_woman"]` instead of string
- Ensure all existing tests still pass
- Add assertions to verify array structure is preserved

### Step 7: Test Complete Survey Flow

- Run interactive test: `pnpm test:interactive`
- Complete full survey flow with beneficiary category selection
- Verify data is saved correctly to database
- Check that survey can be completed without errors
- Verify claim submission works with array values

### Step 8: Run Validation Commands

- Execute all validation commands listed below
- Fix any issues that arise
- Ensure zero regressions in existing functionality
- Verify the bug is completely resolved

## Validation Commands

Execute every command to validate the bug is fixed with zero regressions.

- `pnpm install` - Ensure all dependencies are installed
- `pnpm format` - Format code to match project standards
- `pnpm lint` - Check for linting errors
- `pnpm tsc --noEmit` - Verify TypeScript compilation with updated types
- `pnpm build` - Build the project to ensure no build errors
- `pnpm validate:machines` - Validate all state machines are properly configured
- `pnpm test:integration` - Run integration tests including new array value tests
- `pnpm test` - Run full test suite to ensure zero regressions
- `pnpm test:interactive` - Manually test the complete survey flow (reproduce bug scenario)
- `pnpm install && pnpm format && pnpm lint && pnpm tsc --noEmit && pnpm build && pnpm validate:machines && pnpm test` - Run complete validation pipeline

## Notes

**Type Safety vs Runtime Flexibility:**
The fix balances TypeScript type safety with JavaScript's runtime flexibility. While we're updating type signatures to include arrays, the underlying JSON serialization and database storage already support arrays - we're just making the types match reality.

**Backward Compatibility:**
All existing code that passes primitive values (string, boolean, number) will continue to work unchanged. The type signature expansion is purely additive.

**Alternative Approaches Considered:**

1. **Convert arrays to strings before saving**: Would require custom serialization/deserialization logic and complicate the codebase
2. **Use separate function for array values**: Would create code duplication and inconsistency
3. **Store arrays as JSON strings**: Would require parsing on retrieval and complicate queries
4. **Change beneficiaryCategory to single value**: Would break the survey design which allows multiple selections

**Chosen Approach Rationale:**
Updating type signatures is the minimal, surgical fix that aligns the code with the actual data structure requirements. It requires no architectural changes and maintains consistency with the existing `saveSurveyAnswers` function which already accepts `Record<string, any>`.

**Database Considerations:**
The PostgreSQL JSONB storage already handles arrays natively. The encrypted TEXT storage also works fine with arrays since we're encrypting the JSON.stringify output. No database schema changes are needed.

**Testing Strategy:**
The new integration test specifically validates array value handling, while the interactive test validates the complete user flow. This two-pronged approach ensures both unit-level correctness and end-to-end functionality.
