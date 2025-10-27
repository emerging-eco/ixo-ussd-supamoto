# Feature: Refactor 1,000 Day Household Survey to Use JSON Storage

## Feature Description

Simplify the survey data model by consolidating all survey responses into a single encrypted JSONB field in the `household_claims` table, eliminating the need for the separate `household_survey_responses` table with individual columns for each survey field. This refactoring maintains the existing USSD question-by-question user experience while streamlining the database schema and making the system more flexible for future survey form changes.

The system will continue to fetch SurveyJS form definitions from a configured URL, present questions one at a time via USSD, but will store all responses incrementally in a single JSON field that gets updated with each answer. Session recovery will work by reading the partial JSON to determine which questions have been answered.

## User Story

As a system maintainer
I want to store survey responses in a single JSON field instead of individual database columns
So that the system is more flexible, easier to maintain, and can adapt to survey form changes without database migrations

## Problem Statement

The current implementation stores survey responses in the `household_survey_responses` table with separate encrypted columns for each survey field (beneficiary_category, child_max_age, bean_intake_frequency, etc.). This approach has several limitations:

1. **Schema Rigidity**: Adding or removing survey questions requires database migrations
2. **Data Duplication**: Survey structure is defined in both the SurveyJS form and database schema
3. **Maintenance Overhead**: Field mapping logic (`mapQuestionNameToFieldName`) must be maintained
4. **Table Proliferation**: Separate table for survey responses when they're tightly coupled to claims
5. **Complexity**: Multiple tables to manage for a single logical entity (claim + survey)

## Solution Statement

Consolidate survey responses into the `household_claims` table by:

1. Adding a `survey_form` JSONB column to store the complete SurveyJS form with user responses embedded
2. Encrypting the entire JSON structure before storage
3. Removing the `household_survey_responses` table
4. Updating storage services to work with JSON instead of individual columns
5. Maintaining the existing USSD presentation flow (no user-facing changes)
6. Supporting session recovery by reading partial JSON responses

This approach provides a flexible, maintainable solution that decouples the database schema from survey form structure.

## Relevant Files

### Existing Files to Modify

- **`migrations/postgres/000-init-all.sql`** - ✅ COMPLETED: Consolidated migration includes `survey_form` JSONB column in `household_claims` table, `household_survey_responses` table removed
- **`src/db/index.ts`** - Update `household_claims` interface to include `survey_form` field, remove `household_survey_responses` interface
- **`src/services/database-storage.ts`** - Update `HouseholdClaimRecord` interface, remove survey response methods, add methods to update claim with survey JSON
- **`src/services/survey-response-storage.ts`** - Refactor to work with JSON storage in claims table instead of separate survey responses table
- **`src/machines/supamoto/activation/householdSurveyMachine.ts`** - Update to pass claim ID context, minimal changes to state machine logic
- **`src/machines/supamoto/user-services/userServicesMachine.ts`** - Update survey completion check to read from claims table JSON field

### New Files

- **`tests/services/survey-json-storage.test.ts`** - Unit tests for new JSON-based storage methods
- **`tests/integration/survey-refactor.test.ts`** - Integration tests for complete survey flow with JSON storage

### Note on Migration Consolidation

The migration script `001-refactor-survey-json-storage.sql` has been consolidated into `000-init-all.sql` since the server is not yet in production. This simplifies the migration process by having a single idempotent initialization script that creates all tables with their final schema.

## Implementation Plan

### Phase 1: Foundation

1. **Create Migration Script**: Add `survey_form` JSONB column to `household_claims`, create data migration function to copy existing survey responses to JSON format
2. **Update Type Definitions**: Modify TypeScript interfaces in `src/db/index.ts` and `src/services/database-storage.ts` to reflect new schema
3. **Add JSON Encryption Utilities**: Create helper functions to encrypt/decrypt entire JSON objects (reuse existing `encrypt`/`decrypt` functions)

### Phase 2: Core Implementation

1. **Refactor Survey Response Storage Service**: Update `survey-response-storage.ts` to work with claims table and JSON field
2. **Update Database Storage Methods**: Add methods to `database-storage.ts` for updating claim survey JSON
3. **Modify Survey State Machine**: Update `householdSurveyMachine.ts` to work with new storage approach
4. **Update Survey Completion Check**: Modify `userServicesMachine.ts` to check `all_fields_completed` from JSON

### Phase 3: Integration

1. **Run Data Migration**: Execute migration to move existing data from old table to new JSON field
2. **Update Tests**: Create comprehensive tests for JSON storage approach
3. **Validate End-to-End Flow**: Test complete survey flow from start to finish with session recovery
4. **Clean Up**: Remove deprecated code and old table references

## Step by Step Tasks

### 1. ✅ Database Migration Script (COMPLETED)

- ✅ Consolidated into `migrations/postgres/000-init-all.sql`
- ✅ Added `survey_form` TEXT column to `household_claims` table
- ✅ Added `survey_form_updated_at` TIMESTAMP column to track last update
- ✅ Removed `household_survey_responses` table from schema
- ✅ Added composite index on `household_claims(lg_customer_id, customer_id)` for efficient lookups
- ✅ Added GIN index on `survey_form` JSONB column for JSON querying capabilities
- ✅ Added comments explaining the new schema
- ✅ Made script idempotent with DROP TABLE IF EXISTS statements

### 2. Update Database Type Definitions

- Update `src/db/index.ts`:
  - Add `survey_form` (any/JSONB) and `survey_form_updated_at` (Date | null) to `household_claims` interface
  - Remove `household_survey_responses` interface entirely
- Update `src/services/database-storage.ts`:
  - Add `surveyForm` and `surveyFormUpdatedAt` to `HouseholdClaimRecord` interface
  - Remove `HouseholdSurveyResponseRecord` and `HouseholdSurveyResponseData` interfaces
  - Remove `mapSurveyResponseRecord` helper method

### 3. Create JSON Storage Helper Functions

- Add to `src/services/survey-response-storage.ts`:
  - `encryptSurveyJson(surveyData: any): string` - Encrypts entire JSON object
  - `decryptSurveyJson(encryptedJson: string): any` - Decrypts JSON object
  - `buildSurveyFormJson(formDefinition: ParsedSurveyForm, answers: Record<string, any>): any` - Combines form structure with answers
  - `extractAnswersFromJson(surveyJson: any): Record<string, any>` - Extracts just the answers
  - `isAllFieldsCompleted(surveyJson: any, requiredQuestions: SurveyQuestion[]): boolean` - Checks completion status

### 4. Refactor Survey Response Storage Service

- Update `src/services/survey-response-storage.ts`:
  - Change `saveSurveyAnswer()` to update claim's `survey_form` JSON field instead of survey responses table
  - Update `getSurveyResponseState()` to read from claim's `survey_form` field
  - Update `markSurveyComplete()` to set completion flag within JSON structure
  - Remove `mapQuestionNameToFieldName()` method (no longer needed)
  - Add `getOrCreateClaimForSurvey()` helper to ensure claim exists before saving answers

### 5. Update Database Storage Methods

- Update `src/services/database-storage.ts`:
  - Remove `createOrUpdateSurveyResponse()` method
  - Remove `markSurveyComplete()` method
  - Remove `getSurveyResponse()` method
  - Add `updateClaimSurveyForm(lgCustomerId: string, customerId: string, surveyFormJson: any): Promise<void>` method
  - Add `getClaimByLgAndCustomer(lgCustomerId: string, customerId: string): Promise<HouseholdClaimRecord | null>` method
  - Update `createHouseholdClaim()` to accept optional `surveyForm` parameter
  - Ensure JSONB fields are properly stringified/parsed in database operations

### 6. Update Household Survey State Machine

- Update `src/machines/supamoto/activation/householdSurveyMachine.ts`:
  - Add `claimId` to `HouseholdSurveyContext` (optional, created on first save)
  - Update `saveAnswerService` to call new JSON-based storage method
  - Update `recoverSessionService` to read from claim's survey_form field
  - Update `markCompleteService` to update JSON completion flag
  - Add `formDefinition` to context to store the original SurveyJS form structure
  - Ensure state machine builds complete JSON with form + answers on each save

### 7. Update Survey Completion Check

- Update `src/machines/supamoto/user-services/userServicesMachine.ts`:
  - Modify `checkSurveyCompletionService` to read from claim's `survey_form` field
  - Parse JSON and check `all_fields_completed` flag within the JSON structure
  - Handle cases where claim exists but survey_form is null (not started)

### 8. Create Unit Tests

- Create `tests/services/survey-json-storage.test.ts`:
  - Test `encryptSurveyJson()` and `decryptSurveyJson()` functions
  - Test `buildSurveyFormJson()` with various form structures
  - Test `extractAnswersFromJson()` correctly extracts answers
  - Test `isAllFieldsCompleted()` with complete and incomplete surveys
  - Test incremental answer updates to JSON structure
  - Test session recovery from partial JSON

### 9. Create Integration Tests

- Create `tests/integration/survey-refactor.test.ts`:
  - Test complete survey flow from start to finish with JSON storage
  - Test session interruption and recovery
  - Test survey completion check before claim submission
  - Test data migration from old schema to new schema
  - Test encryption/decryption of survey JSON
  - Test concurrent survey updates (race conditions)

### 10. Run Database Migration

- Execute `pnpm build && node dist/src/migrations/run-migrations.js`
- Verify `survey_form` column added to `household_claims`
- Verify existing survey responses migrated to JSON format
- Verify `household_survey_responses` table dropped
- Verify indexes created correctly
- Check migration logs for any errors

### 11. Update Documentation

- Update `docs/supamoto/README.md` to reflect new JSON storage approach
- Update `docs/supamoto/SEQUENCE_DIAGRAM.md` if database operations changed
- Add comments in code explaining JSON structure format
- Document the survey JSON schema structure

### 12. Run Validation Commands

- Execute all validation commands to ensure zero regressions
- Run unit tests: `pnpm test`
- Run type checking: `pnpm tsc --noEmit`
- Run linting: `pnpm lint`
- Run formatting: `pnpm format`
- Validate state machines: `pnpm validate:machines`
- Run full build: `pnpm build`

## Testing Strategy

### Unit Tests

- **JSON Encryption/Decryption**: Verify encrypt/decrypt functions work correctly with complex JSON objects
- **JSON Building**: Test `buildSurveyFormJson()` correctly merges form definition with answers
- **Answer Extraction**: Test `extractAnswersFromJson()` handles various JSON structures
- **Completion Check**: Test `isAllFieldsCompleted()` with required vs optional questions
- **Incremental Updates**: Test updating JSON with new answers preserves existing answers
- **Storage Methods**: Test new database methods for updating claim survey form

### Integration Tests

- **Complete Survey Flow**: Test full survey from start to finish with JSON storage
- **Session Recovery**: Interrupt survey mid-way, verify resume works correctly
- **Claim Creation**: Test claim is created on first survey answer if it doesn't exist
- **Survey Completion Gate**: Test claim submission blocked until survey complete
- **Data Migration**: Test migration script correctly converts old data to new format
- **Concurrent Access**: Test multiple LGs updating surveys for different customers simultaneously

### Edge Cases

- **Empty Survey**: Survey with no questions (should mark complete immediately)
- **All Optional Questions**: Survey with no required questions (completion logic)
- **Conditional Questions**: Questions with `visibleIf` conditions (skip correctly)
- **Large JSON**: Survey with many questions (performance, encryption overhead)
- **Corrupted JSON**: Handle decryption failures gracefully
- **Missing Claim**: Survey started but claim doesn't exist (create claim first)
- **Duplicate Answers**: Same question answered multiple times (last answer wins)
- **Session Timeout**: Very long survey interrupted by session timeout (recovery)
- **Form Definition Changes**: Survey form updated while survey in progress (version handling)

## Acceptance Criteria

- [ ] `survey_form` JSONB column added to `household_claims` table
- [ ] `household_survey_responses` table dropped after data migration
- [ ] All existing survey responses successfully migrated to JSON format in claims table
- [ ] Survey responses stored as encrypted JSON in single field
- [ ] Each answer incrementally updates the JSON field (not batch at end)
- [ ] Session recovery works by reading partial JSON from claims table
- [ ] Survey completion check reads `all_fields_completed` flag from JSON
- [ ] USSD question-by-question presentation flow unchanged (no user-facing changes)
- [ ] All unit tests pass with 100% coverage of new JSON storage methods
- [ ] All integration tests pass including session recovery scenarios
- [ ] Zero regressions in existing functionality
- [ ] Code passes linting, formatting, and TypeScript checks
- [ ] State machine validation passes
- [ ] Documentation updated to reflect new architecture

## Validation Commands

Execute every command to validate the feature works correctly with zero regressions.

- `pnpm install && pnpm format && pnpm lint && pnpm tsc --noEmit && pnpm build && pnpm validate:machines && pnpm test` - Run tests to validate the refactoring is complete with zero regressions.
- `pnpm test tests/services/survey-json-storage.test.ts` - Run unit tests for JSON storage methods
- `pnpm test tests/integration/survey-refactor.test.ts` - Run integration tests for survey refactoring
- `pnpm test:interactive` - Manually test survey flow via interactive USSD simulator

## Notes

### JSON Structure Format

The `survey_form` JSONB field will store:

```json
{
  "formDefinition": {
    "title": "1,000 Day Household Survey",
    "questions": [
      {
        "name": "beneficiaryCategory",
        "title": "Beneficiary Category?",
        "type": "radiogroup",
        "choices": [...],
        "required": true
      },
      ...
    ]
  },
  "answers": {
    "beneficiaryCategory": "pregnant_woman",
    "childMaxAge": "6_months",
    ...
  },
  "metadata": {
    "startedAt": "2025-01-15T10:30:00Z",
    "lastUpdatedAt": "2025-01-15T10:35:00Z",
    "completedAt": null,
    "allFieldsCompleted": false,
    "version": "1.0"
  }
}
```

### Encryption Approach

- Encrypt the entire JSON object as a string using existing `encrypt()` function
- Store encrypted string in JSONB column (PostgreSQL handles JSON validation after decryption)
- Decrypt when reading, parse JSON, extract answers for session recovery

### Backward Compatibility

- Migration script will convert existing `household_survey_responses` records to JSON format
- Old records will be preserved in JSON structure with same field names
- No data loss during migration
- Migration is reversible (can recreate old table from JSON if needed)

### Performance Considerations

- **Pros**: Single table join instead of two, simpler queries, smaller database footprint
- **Cons**: Slightly larger encrypted payload per claim, JSON parsing overhead
- **Mitigation**: GIN index on JSONB for efficient querying, encryption happens once per answer update
- **Overall**: Performance impact minimal, benefits outweigh costs

### Trade-offs

**Advantages:**

- Flexible schema - add/remove questions without migrations
- Simpler data model - one table instead of two
- Easier to version survey forms
- Complete survey context in one place
- Reduced code complexity (no field mapping)

**Disadvantages:**

- Cannot query individual survey fields directly (must decrypt JSON first)
- Slightly larger storage per record (full form definition included)
- JSON parsing overhead on every read
- Less type safety (any vs specific fields)

**Decision**: Advantages significantly outweigh disadvantages for this use case. Survey responses are primarily written once and read occasionally for session recovery, making the flexibility and simplicity worth the trade-offs.

### Future Enhancements

- Add survey form versioning to handle form definition changes over time
- Implement JSON schema validation for survey_form structure
- Add analytics queries using PostgreSQL JSONB operators
- Consider compression for large survey forms
- Add survey response export functionality (JSON to CSV)
