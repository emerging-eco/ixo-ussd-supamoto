# Chore: Fix 1,000 Day Survey Customer Validation Race Condition

## Chore Description

Fix a race condition in the 1,000 Day Household Survey flow where claim records are created before validating that the customer exists in the database. Currently, the survey machine validates the customer ID **format** (pattern: `^C[A-Za-z0-9]{8,}$`) but does not verify the customer **exists** in the database before attempting to create a household claim record.

This causes a poor user experience where:

1. User enters a valid-format customer ID (e.g., `CBBB807C4`)
2. System displays "Creating claim record..."
3. Database foreign key constraint violation occurs
4. User sees error: "Customer ID CBBB807C4 not found in the system"

The fix adds an explicit customer existence validation step **before** claim creation, providing immediate feedback if the customer doesn't exist and preventing unnecessary database operations.

**Root Cause:** The `validateCustomerId` function in `src/machines/supamoto/thousand-day-survey/survey-validators.ts` only validates format, not existence. The state machine transitions directly from `askCustomerId` to `creatingClaim` without checking if the customer exists.

**Impact:** This is a UX issue, not a data integrity issue. PostgreSQL foreign key constraints prevent orphaned claims, but users see confusing error messages after the system says it's "Creating claim record...".

**Solution:** Add a new `validatingCustomer` state between `askCustomerId` and `creatingClaim` that verifies the customer exists in the database using `dataService.getCustomerByCustomerId()`.

## Relevant Files

Use these files to resolve the chore:

- **`src/machines/supamoto/thousand-day-survey/thousandDaySurveyMachine.ts`** (lines 94-151, 428-498)
  - Main state machine that needs the new validation state
  - Contains `createClaimService` that currently fails on FK violation
  - Needs new `validateCustomerExistsService` actor
  - Needs new `validatingCustomer` state between `askCustomerId` and `creatingClaim`
  - Needs updated transition from `askCustomerId` to target `validatingCustomer` instead of `creatingClaim`

- **`src/machines/supamoto/thousand-day-survey/survey-validators.ts`** (lines 10-23)
  - Contains `validateCustomerId` that only validates format
  - Reference for understanding current validation approach
  - No changes needed (format validation is still useful)

- **`src/services/database-storage.ts`** (lines 346-360)
  - Contains `getCustomerByCustomerId()` method used for validation
  - Returns `CustomerRecord | null`
  - Already used in login machine for customer lookup

- **`src/machines/supamoto/account-login/loginMachine.ts`** (lines 120-141)
  - Reference implementation of `customerLookupService`
  - Shows pattern for validating customer exists before proceeding
  - Use as template for new validation service

- **`migrations/postgres/000-init-all.sql`** (line 228)
  - Shows foreign key constraint: `customer_id VARCHAR(10) NOT NULL REFERENCES customers(customer_id)`
  - Explains why FK violation occurs when customer doesn't exist

### New Files

- **`tests/machines/supamoto/thousand-day-survey/customer-validation.test.ts`**
  - Unit tests for the new customer validation step
  - Test valid customer ID (exists in DB) → proceeds to claim creation
  - Test invalid customer ID format → shows format error
  - Test valid format but non-existent customer → shows "not found" error
  - Test navigation (back/exit) from validation state

## Step by Step Tasks

IMPORTANT: Execute every step in order, top to bottom.

### Step 1: Add Customer Existence Validation Service

- Open `src/machines/supamoto/thousand-day-survey/thousandDaySurveyMachine.ts`
- Add new service actor `validateCustomerExistsService` after `createClaimService` (around line 151)
- Use `fromPromise` pattern similar to `createClaimService`
- Call `dataService.getCustomerByCustomerId(input.customerId)`
- If customer is `null`, throw error: `"Customer ID ${input.customerId} not found in the system. Please verify the Customer ID."`
- If customer exists, return `{ customer }` for logging/debugging
- Add appropriate logging using `logger.info()` for validation start and success
- Follow the pattern from `loginMachine.ts` `customerLookupService` (lines 120-141)

### Step 2: Add Validating Customer State

- In the same file, add new state `validatingCustomer` after `askCustomerId` state (around line 460)
- Set entry action to display message: `"Validating Customer ID...\n\n1. Continue"`
- Add `invoke` block with:
  - `id: "validateCustomerExists"`
  - `src: "validateCustomerExistsService"`
  - `input: ({ context }) => ({ customerId: context.customerId })`
  - `onDone: { target: "creatingClaim" }` - proceed to claim creation on success
  - `onError: { target: "error", actions: assign error message }`
- Add `on.INPUT` handler to allow user to press "1" to continue (transitions to `creatingClaim`)
- Follow the pattern from `creatingClaim` state structure

### Step 3: Update askCustomerId State Transition

- Locate `askCustomerId` state `on.INPUT` transitions (line 432)
- Change the target from `"creatingClaim"` to `"validatingCustomer"`
- Keep the guard `"isValidCustomerId"` (format validation still needed)
- Keep the actions that assign `customerId` to context
- This ensures format validation happens first, then existence validation

### Step 4: Register New Service in Actors

- Locate the `actors` section in the machine setup (around line 389)
- Add `validateCustomerExistsService` to the actors list
- Maintain alphabetical or logical ordering with other services

### Step 5: Create Unit Tests for Customer Validation

- Create new test file `tests/machines/supamoto/thousand-day-survey/customer-validation.test.ts`
- Import necessary dependencies: `describe`, `it`, `expect`, `vi`, `beforeEach`, `createActor`
- Import `thousandDaySurveyMachine` from the machine file
- Mock `dataService.getCustomerByCustomerId` using `vi.mock()`
- Test Case 1: Valid customer ID (exists in DB)
  - Mock `getCustomerByCustomerId` to return a customer record
  - Send customer ID input
  - Verify state transitions to `validatingCustomer` then `creatingClaim`
  - Verify no error is set
- Test Case 2: Invalid customer ID format
  - Send invalid format (e.g., "12345678" without "C" prefix)
  - Verify state remains in `askCustomerId` with format error message
- Test Case 3: Valid format but customer doesn't exist
  - Mock `getCustomerByCustomerId` to return `null`
  - Send valid format customer ID (e.g., "CBBB807C4")
  - Verify state transitions to `validatingCustomer` then `error`
  - Verify error message contains "not found in the system"
- Test Case 4: Back navigation from validatingCustomer
  - Navigate to `validatingCustomer` state
  - Send "0" (back command)
  - Verify proper navigation (should be handled by navigation mixin)

### Step 6: Update Existing Flow Tests

- Open `tests/flows/1000-day-household-survey-flow.test.ts`
- Review existing test flow to ensure it uses a valid customer ID that exists in the test database
- Add comment explaining that customer ID must exist for validation to pass
- If needed, add setup step to create test customer before running flow
- Verify test still passes with new validation step (should see "Validating Customer ID..." message)

### Step 7: Test with Interactive USSD

- Run `pnpm test:interactive` to manually test the flow
- Navigate to: Account Menu → Login (as Lead Generator) → Agent Tools → 1,000 Day Survey
- Test Scenario 1: Enter non-existent customer ID (e.g., "CBBB807C4")
  - Verify message shows "Validating Customer ID..."
  - Verify error shows "Customer ID CBBB807C4 not found in the system"
  - Verify user can press "0" to go back
- Test Scenario 2: Enter existing customer ID
  - Verify message shows "Validating Customer ID..."
  - Verify transitions to "Creating claim record..."
  - Verify survey questions appear
- Document any issues found during manual testing

### Step 8: Run Validation Commands

- Execute all validation commands listed in the Validation Commands section
- Fix any TypeScript errors related to new service/state
- Fix any failing tests
- Ensure zero regressions in existing functionality
- Verify the race condition is resolved

## Validation Commands

Execute every command to validate the chore is complete with zero regressions.

- `pnpm install` - Ensure all dependencies are installed
- `pnpm format` - Format code to match project style
- `pnpm lint` - Check for linting errors
- `pnpm tsc --noEmit` - Verify TypeScript compilation with no errors
- `pnpm build` - Build the project to ensure no build errors
- `pnpm validate:machines` - Validate all state machines are correctly configured
- `pnpm test tests/machines/supamoto/thousand-day-survey/customer-validation.test.ts` - Run new unit tests
- `pnpm test tests/machines/supamoto/thousand-day-survey/` - Run all survey machine tests
- `pnpm test` - Run full test suite to ensure zero regressions

## Notes

### Why This Fix is Important

1. **Better UX**: Users get immediate feedback if customer doesn't exist, instead of seeing "Creating claim record..." followed by an error
2. **Clearer Error Messages**: Error appears during "Validating Customer ID..." step, making it clear the issue is with the customer ID
3. **Prevents Unnecessary DB Operations**: Avoids attempting to INSERT into `household_claims` table when we know it will fail
4. **Follows Existing Patterns**: Uses the same validation approach as the login machine (`customerLookupService`)

### Foreign Key Constraint Details

The database schema has this constraint:

```sql
CREATE TABLE household_claims (
  customer_id VARCHAR(10) NOT NULL REFERENCES customers(customer_id)
);
```

This prevents orphaned claims but causes a database error that's caught and re-thrown. The new validation prevents this error from occurring.

### Lead Creation Claims Are Not Affected

Lead creation claims (submitted during account creation) do NOT have this issue because:

- Customer record is created **before** the background IXO creation process starts
- The `customerId` passed to `createIxoAccountBackground()` is from the just-created customer record
- Claim submission happens **after** database save in `saveIxoAccountData()`

### Testing Strategy

- **Unit Tests**: Test the validation service in isolation with mocked database
- **Flow Tests**: Test the complete USSD flow with real database (requires test customer to exist)
- **Manual Testing**: Use `pnpm test:interactive` to verify UX improvements

### Reference Implementation

The login machine has a similar pattern:

```typescript
const customerLookupService = fromPromise(
  async ({ input }: { input: { customerId: string } }) => {
    const customer = await dataService.getCustomerByCustomerId(
      input.customerId
    );
    if (!customer) {
      throw new Error("CUSTOMER_NOT_FOUND");
    }
    return customer;
  }
);
```

Use this as a template for the new `validateCustomerExistsService`.
