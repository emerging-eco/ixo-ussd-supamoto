# Chore: Add Zambian National ID Validation to Account Creation Flow

## Chore Description

Enhance the customer account creation flow to collect and validate Zambian National Registration Card (NRC) numbers. The NRC follows a specific format: `XXXXXX/XX/X` (6 digits, slash, 2 digits, slash, 1 digit), where the first 6 digits are the registration number, the next 2 digits are the province code (01-10), and the last digit is a check digit.

This chore implements:

1. **Zambian NRC-specific validation** with format normalization (accepts input with or without slashes)
2. **Province code validation** (01-10 for Zambia's 10 provinces)
3. **Check digit validation** (using approximation algorithm as official algorithm is not publicly documented)
4. **Database schema update** to store national_id in customers table
5. **Account creation flow enhancement** to collect national ID between email and PIN entry
6. **Claims Bot integration** to pass national ID to lead creation claim submission
7. **Comprehensive test coverage** for validation logic and state machine flow

The national ID field is **optional** (users can skip with "00"), following the same pattern as the email field.

## Relevant Files

Use these files to resolve the chore:

- **`src/utils/input-validation.ts`** - Core validation utilities; needs new `validateNationalId()` function with Zambian NRC-specific logic, province code validation, and check digit calculation
- **`src/machines/supamoto/guards/validation.guards.ts`** - Validation guard factory; needs new `isValidNationalId` guard and updated `ValidationOptionsMap` type
- **`src/machines/supamoto/account-creation/accountCreationMachine.ts`** - Account creation state machine; needs new `nationalIdEntry` state, context fields, actions, and guards
- **`tests/machines/supamoto/account-creation/accountCreationMachine.ts`** - Test version of account creation machine; needs same updates as production version
- **`src/services/database-storage.ts`** - Database service layer; needs updated `CustomerData` and `CustomerRecord` interfaces, and `createCustomerRecord()` method to handle national_id
- **`src/db/index.ts`** - Database type definitions; needs `national_id` field added to `customers` table interface
- **`src/services/ixo/background-ixo-creation.ts`** - Background IXO account creation; needs updated `BackgroundIxoParams` interface and claim submission to include nationalId
- **`migrations/postgres/000-init-all.sql`** - Main database schema; needs `national_id` column added to customers table (will be modified in-place as it's the init migration)

### New Files

- **`migrations/postgres/001-add-national-id.sql`** - Migration to add national_id column to existing customers table (for production deployments that already ran 000-init-all.sql)
- **`tests/utils/input-validation-nrc.test.ts`** - Comprehensive unit tests for Zambian NRC validation logic
- **`tests/machines/supamoto/account-creation/national-id-entry.test.ts`** - Integration tests for national ID entry state in account creation flow

## Step by Step Tasks

IMPORTANT: Execute every step in order, top to bottom.

### Step 1: Add Database Migration for national_id Column

- Create new migration file `migrations/postgres/001-add-national-id.sql`
- Add `ALTER TABLE customers ADD COLUMN national_id VARCHAR(20) NULL;`
- Add index: `CREATE INDEX idx_customers_national_id ON customers(national_id) WHERE national_id IS NOT NULL;`
- Add column comment: `COMMENT ON COLUMN customers.national_id IS 'Optional Zambian National Registration Card number (format: XXXXXX/XX/X)';`
- Update `migrations/postgres/000-init-all.sql` to include `national_id VARCHAR(20)` column in customers table CREATE statement (line 107, after email column)
- Add index in 000-init-all.sql indexes section (after line 260): `CREATE INDEX idx_customers_national_id ON customers(national_id) WHERE national_id IS NOT NULL;`

### Step 2: Update Database Type Definitions

- Edit `src/db/index.ts` Database interface for customers table (line 97-110)
- Add `national_id: string | null;` field after `email: string | null;` (line 101)

### Step 3: Implement Zambian NRC Validation Logic

- Edit `src/utils/input-validation.ts`
- Add `ZAMBIAN_NRC_RULES` constant to `VALIDATION_RULES` object (after line 59) with pattern regexes, province code limits, and province names mapping
- Implement `validateNationalId(input: string): ValidationResult<string>` function (after line 273)
  - Accept input with or without slashes (e.g., "123456/12/1" or "123456121")
  - Validate format matches `XXXXXX/XX/X` pattern
  - Validate registration number is not all zeros
  - Validate province code is between 01-10
  - Call `calculateZambianNRCCheckDigit()` for check digit validation (log warning if mismatch, don't reject)
  - Normalize to format with slashes
  - Return normalized value
- Implement `calculateZambianNRCCheckDigit(registrationNumber: string, provinceCode: string): string | null` helper function
  - Use weighted sum modulo 10 algorithm as approximation
  - Add documentation warning that official algorithm is not publicly available
  - Return calculated check digit or null on error
- Update `validateUserInput()` function type union (line 372-380) to include `"nationalId"`
- Add case `"nationalId": return validateNationalId(input);` to switch statement (line 393-412)

### Step 4: Add Validation Guard for National ID

- Edit `src/machines/supamoto/guards/validation.guards.ts`
- Add `NationalIdValidationOptions` interface (after line 68): `export interface NationalIdValidationOptions {}`
- Update `ValidationOptionsMap` type (line 73-82) to include `nationalId: NationalIdValidationOptions;`
- Add validation guard export (after line 176): `export const isValidNationalId: CombinedGuard = createValidationGuard("nationalId");`
- Update `validationGuards` collection (line 214-229) to include `isValidNationalId`

### Step 5: Update Database Service Layer

- Edit `src/services/database-storage.ts`
- Update `CustomerData` interface (line 19-25) to add `nationalId?: string;`
- Update `CustomerRecord` interface (line 27-39) to add `nationalId?: string;`
- Update `createCustomerRecord()` method (line 275-290) to include `national_id: customerData.nationalId || null` in insertInto values

### Step 6: Update Account Creation State Machine (Production)

- Edit `src/machines/supamoto/account-creation/accountCreationMachine.ts`
- Add constant `SKIP_NATIONAL_ID_INPUT = "00";` (after line 11)
- Update `AccountCreationContext` interface (line 33-67):
  - Add `nationalId: string;` field
  - Add `isNationalIdSkipped: boolean;` field
  - Add `"nationalIdEntry"` to `currentStep` union type
- Update initial context (line 278-290) to include `nationalId: ""` and `isNationalIdSkipped: false`
- Add actions (after line 154):
  - `setNationalIdMessage: assign(() => ({ message: 'Enter your National ID (format: 123456/12/1):\n${SKIP_NATIONAL_ID_INPUT}. Skip', currentStep: "nationalIdEntry" as const }))`
  - `setNationalId: assign(({ event }) => ({ nationalId: event.type === "INPUT" ? event.input : "", isNationalIdSkipped: false }))`
  - `setSkipNationalId: assign(() => ({ nationalId: "", isNationalIdSkipped: true }))`
- Add guards (after line 260):
  - `isSkipNationalId: ({ event }) => event.type === "INPUT" && event.input === SKIP_NATIONAL_ID_INPUT`
  - `isValidNationalIdValue: ({ event }) => validationGuards.isValidNationalId(null as any, event as any)`
- Add `nationalIdEntry` state (after emailEntry state, around line 345)
- Update `emailEntry` state transitions to target `nationalIdEntry` instead of `pinEntry`
- Update `pinEntry` state backTarget to `nationalIdEntry` instead of `emailEntry`
- Update `createCustomerService` actor input type (line 95-100) to include `nationalId: string`
- Update `createCustomerService` actor implementation (line 108-117) to pass `nationalId` to `createCustomerRecord()`
- Update `createCustomerService` actor implementation to pass `nationalId` to `createIxoAccountBackground()`
- Update actor input mapping (line 412-417) to include `nationalId: context.nationalId || undefined`

### Step 7: Update Account Creation State Machine (Test Version)

- Edit `tests/machines/supamoto/account-creation/accountCreationMachine.ts`
- Apply all the same changes from Step 6 to the test version of the machine

### Step 8: Update Background IXO Creation Service

- Edit `src/services/ixo/background-ixo-creation.ts`
- Update `BackgroundIxoParams` interface (line 33-39) to add `nationalId?: string;`
- Update `submitLeadCreationClaim()` call (line 113-121) to include `nationalId: params.nationalId || undefined`
- Remove comment on line 119 that says "Not collected during USSD account creation"

### Step 9: Create Unit Tests for NRC Validation

- Create new file `tests/utils/input-validation-nrc.test.ts`
- Add test suite "Zambian NRC Validation" with describe blocks:
  - "Valid NRC Numbers" - test with slashes, without slashes, all province codes 01-10, leading zeros
  - "Invalid NRC Numbers" - test empty input, all zeros, invalid province codes (00, 11, 99), wrong length, alphabetic/special characters
  - "Normalization" - test input normalization, whitespace trimming
  - "Province Code Validation" - test all 10 Zambian provinces validate correctly

### Step 10: Create Integration Tests for National ID Entry

- Create new file `tests/machines/supamoto/account-creation/national-id-entry.test.ts`
- Add test suite "National ID Entry - Zambian NRC" with tests:
  - Accept valid NRC with slashes
  - Accept valid NRC without slashes and normalize
  - Reject invalid province code
  - Allow skipping with "00"
  - Test back navigation to emailEntry
  - Test forward navigation to pinEntry

### Step 11: Run Validation Commands

Execute all validation commands to ensure zero regressions:

- `pnpm install` - Ensure dependencies are installed
- `pnpm format` - Format all code
- `pnpm lint` - Lint all code
- `pnpm tsc --noEmit` - Type check
- `pnpm build` - Build the project
- `pnpm validate:machines` - Validate state machines
- `pnpm test` - Run all tests including new NRC validation tests

## Validation Commands

Execute every command to validate the chore is complete with zero regressions.

- `pnpm install && pnpm format && pnpm lint && pnpm tsc --noEmit && pnpm build && pnpm validate:machines && pnpm test` - Run tests to validate the chore is complete with zero regressions.
- `pnpm test tests/utils/input-validation-nrc.test.ts` - Run NRC validation unit tests specifically
- `pnpm test tests/machines/supamoto/account-creation/national-id-entry.test.ts` - Run national ID entry integration tests specifically
- `pnpm test tests/machines/supamoto/account-creation/accountCreationMachine.test.ts` - Run account creation machine tests to ensure no regressions

## Notes

### Zambian NRC Format Details

- **Format**: `XXXXXX/XX/X` (12 characters including slashes)
- **Registration Number**: 6 digits (000001-999999, cannot be all zeros)
- **Province Code**: 2 digits (01-10 for Zambia's 10 provinces)
- **Check Digit**: 1 digit (0-9)
- **Example**: `123456/05/1` (Lusaka Province)

### Zambian Provinces (Codes 01-10)

1. **01** - Central Province
2. **02** - Copperbelt Province
3. **03** - Eastern Province
4. **04** - Luapula Province
5. **05** - Lusaka Province
6. **06** - Northern Province
7. **07** - North-Western Province
8. **08** - Southern Province
9. **09** - Western Province
10. **10** - Muchinga Province

### Check Digit Algorithm Limitation

⚠️ **IMPORTANT**: The Zambian government's official check digit calculation algorithm is **not publicly documented**. The implementation uses a weighted sum modulo 10 algorithm as an **approximation**. The validation logs check digit mismatches but does not reject based on check digit alone until the official algorithm is confirmed.

**Recommendations**:

- Contact Zambian Department of National Registration and Card Services for official algorithm
- Monitor logs for check digit mismatches to gather data
- Update `calculateZambianNRCCheckDigit()` function when official algorithm is available

### User Experience Flow

```
1. Enter your full name:
   > John Doe

2. Enter your email address (optional):
   00. Skip
   > 00

3. Enter your National ID (format: 123456/12/1):  ← NEW STEP
   00. Skip
   > 123456051

   [System normalizes to: 123456/05/1]
   [System validates: Province 05 = Lusaka ✓]

4. Create a 5-digit PIN for your account:
   > 12345
```

### Database Storage

- **Stored format**: Always normalized with slashes (e.g., `123456/05/1`)
- **User input**: Accepts with or without slashes (e.g., `123456/05/1` or `123456051`)
- **Column type**: `VARCHAR(20)` to accommodate format with slashes
- **Nullable**: Yes (optional field, users can skip)
- **Indexed**: Yes (partial index where national_id IS NOT NULL for efficient lookups)

### Migration Strategy

- **New deployments**: Use updated `000-init-all.sql` with national_id column included
- **Existing deployments**: Run `001-add-national-id.sql` migration to add column to existing customers table
- **Idempotent**: Migration script checks if column exists before adding

### Claims Bot Integration

The national ID is passed to the Claims Bot SDK's `submitLeadCreationClaim()` method as an optional field. This enables the Claims Bot to track national IDs for lead generation claims submitted via USSD signup.

### Testing Strategy

1. **Unit tests** validate the core NRC validation logic (format, province codes, normalization)
2. **Integration tests** validate the state machine flow (entry, skip, navigation)
3. **Manual testing** via `pnpm test:interactive` to verify USSD user experience
4. **Regression tests** ensure existing account creation flow still works without national ID

### No New Dependencies Required

All functionality is implemented using existing dependencies. No new packages need to be installed.
