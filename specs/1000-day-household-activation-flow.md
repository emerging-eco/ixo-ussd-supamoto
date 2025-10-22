# Feature: 1000-Day Household Customer Activation Flow with USSD Data Collection

## Feature Description

Implement a database-backed USSD questionnaire system to collect household eligibility data from Lead Generators (LGs) during customer activation. The system will present survey questions dynamically based on SurveyJS form definitions, persist encrypted responses to the database, support session interruption recovery, and gate the final claim submission until all survey responses are collected and validated.

## User Story

As a Lead Generator
I want to collect detailed household eligibility information from customers during activation
So that the system can accurately assess 1,000-day household eligibility and allocate appropriate bean vouchers

## Problem Statement

Currently, the customer activation flow immediately submits a 1,000-day household claim without collecting detailed eligibility data. This prevents accurate assessment of household composition, nutritional awareness, and other critical factors needed to verify true eligibility. The system needs to:

1. Collect structured survey responses from LGs about household characteristics
2. Persist responses securely with encryption
3. Support session interruption recovery (USSD sessions can drop)
4. Gate claim submission until all required data is collected
5. Respect conditional visibility rules (e.g., only ask about child age if "Child Below 2 Years" is selected)

## Solution Statement

Implement a multi-phase solution:

1. **Database Layer**: Create `household_survey_responses` table with encrypted columns for all survey fields
2. **Survey Engine**: Build a state machine that dynamically presents SurveyJS questions via USSD
3. **Data Persistence**: Save each answer independently to support session recovery
4. **Submission Gate**: Block `submit1000DayCustomerClaim` until `all_fields_completed = true`
5. **Sequence Diagram Update**: Insert survey Q&A flow between customer login and claim submission

## Relevant Files

### Existing Files to Modify

- `docs/supamoto/SEQUENCE_DIAGRAM.md` - Update Customer Activation Flow (lines 13-49) to include survey Q&A
- `src/machines/supamoto/activation/customerActivationMachine.ts` - Add survey state and transitions
- `src/machines/supamoto/customer-tools/customerToolsMachine.ts` - Add 1,000-day household claim flow
- `src/services/database-storage.ts` - Add survey response storage methods
- `src/db/index.ts` - Add `household_survey_responses` table interface

### New Files to Create

- `migrations/postgres/006-household-survey-responses.sql` - Database migration for survey responses table
- `src/machines/supamoto/activation/householdSurveyMachine.ts` - State machine for survey Q&A flow
- `src/services/survey-engine.ts` - Service to fetch and parse SurveyJS form definitions
- `src/services/survey-response-storage.ts` - Service to persist encrypted survey responses
- `src/utils/survey-form-parser.ts` - Utility to parse SurveyJS form and extract questions
- `src/utils/encryption-survey.ts` - Encryption utilities for survey data
- `tests/machines/supamoto/activation/householdSurveyMachine.test.ts` - Survey machine tests
- `tests/services/survey-engine.test.ts` - Survey engine tests
- `tests/services/survey-response-storage.test.ts` - Survey storage tests

## Implementation Plan

### Phase 1: Foundation

- Create database migration for `household_survey_responses` table with encrypted columns
- Add table interface to `src/db/index.ts`
- Implement survey response storage service with encryption/decryption
- Create survey form parser utility to extract questions from SurveyJS JSON

### Phase 2: Core Implementation

- Build `householdSurveyMachine` state machine for USSD survey flow
- Implement survey engine service to fetch and manage form definitions
- Add survey state and transitions to `customerActivationMachine`
- Implement session recovery logic to resume from last answered question
- Add submission gate to block claim until all fields completed

### Phase 3: Integration

- Update sequence diagram to show survey Q&A flow
- Integrate survey machine into customer activation flow
- Update customer tools machine to check `all_fields_completed` before allowing claim submission
- Add audit logging for survey responses
- Create end-to-end tests for complete activation flow with survey

## Step by Step Tasks

### 1. Create Database Migration

- Create `migrations/postgres/006-household-survey-responses.sql`
- Define `household_survey_responses` table with columns: `customerId`, `lead_generator_id`, `beneficiaryCategory`, `childMaxAge`, `beanIntakeFrequency`, `priceSpecification`, `awarenessIronBeans`, `knowsNutritionalBenefits`, `nutritionalBenefitDetails`, `confirmAction_antenatal_card_verified`, `all_fields_completed`, `created_at`, `updated_at`
- Add composite unique constraint on `(customerId, lead_generator_id, created_at)`
- Add indexes on `customerId` and `lead_generator_id`
- Encrypt all value columns before insertion

### 2. Update Database Types and Interfaces

- Add `household_survey_responses` table interface to `src/db/index.ts`
- Create TypeScript types for survey response records in `src/services/database-storage.ts`
- Add methods to `DataService` for CRUD operations on survey responses

### 3. Create Survey Form Parser Utility

- Create `src/utils/survey-form-parser.ts` to parse SurveyJS form JSON
- Extract question names, types, and visibility conditions
- Build question sequence respecting `visibleIf` conditions
- Create types for parsed survey questions

### 4. Create Survey Response Storage Service

- Create `src/services/survey-response-storage.ts`
- Implement methods to save individual survey answers
- Implement method to mark survey as complete (`all_fields_completed = true`)
- Implement method to retrieve partial responses for session recovery
- Add encryption/decryption for sensitive fields

### 5. Create Survey Engine Service

- Create `src/services/survey-engine.ts`
- Implement method to fetch SurveyJS form from configured URL
- Cache form definition to avoid repeated fetches
- Implement method to get next question based on current answers
- Handle conditional visibility logic

### 6. Build Household Survey State Machine

- Create `src/machines/supamoto/activation/householdSurveyMachine.ts`
- Implement states: `loadingForm`, `presentingQuestion`, `waitingForAnswer`, `savingAnswer`, `checkingCompletion`, `surveyComplete`, `error`
- Add transitions for INPUT events to capture answers
- Implement session recovery to resume from last question
- Add error handling for network/database failures

### 7. Integrate Survey into Customer Activation

- Update `customerActivationMachine.ts` to invoke survey machine after customer login
- Add state `collectingSurveyData` that spawns survey machine
- Add transition to claim submission only after survey completion
- Update context to track survey completion status

### 8. Update Customer Tools Machine

- Modify `customerToolsMachine.ts` to check `all_fields_completed` before allowing claim
- Show message if survey incomplete: "Please complete household survey first"
- Add link back to survey if incomplete

### 9. Update Sequence Diagram

- Edit `docs/supamoto/SEQUENCE_DIAGRAM.md` lines 39-40
- Insert new section showing LG answering survey questions
- Show each Q&A exchange between USSD and LG
- Show data persistence to database
- Keep `submit1000DayCustomerClaim` call after all responses collected

### 10. Create Unit Tests

- Test survey form parser with various SurveyJS structures
- Test survey response storage with encryption/decryption
- Test survey engine question sequencing
- Test survey machine state transitions
- Test session recovery logic

### 11. Create Integration Tests

- Test complete survey flow from start to finish
- Test session interruption and recovery
- Test conditional question visibility
- Test claim submission gate (blocked until complete)
- Test encrypted data retrieval

### 12. Run Validation Commands

- Run `pnpm format && pnpm lint && pnpm tsc --noEmit`
- Run `pnpm build` to verify TypeScript compilation
- Run `pnpm test` to verify all tests pass
- Run `pnpm validate:machines` to verify state machine validity
- Test end-to-end activation flow with survey

## Testing Strategy

### Unit Tests

- Survey form parser: Test extraction of questions, types, visibility conditions
- Survey response storage: Test encryption, decryption, CRUD operations
- Survey engine: Test question sequencing, conditional logic, form caching
- Survey machine: Test state transitions, context updates, error handling

### Integration Tests

- Complete survey flow: LG answers all questions, data persists, claim gates properly
- Session recovery: Interrupt session mid-survey, resume and complete
- Conditional visibility: Questions appear/disappear based on previous answers
- Claim submission: Verify claim blocked until `all_fields_completed = true`

### Edge Cases

- Network failure during form fetch (retry logic)
- Database failure during answer save (rollback and retry)
- Session timeout mid-survey (recovery on next dial)
- Invalid answer format (validation and re-prompt)
- Conditional question with no parent answer (skip gracefully)
- Multiple survey attempts (create new record, don't update old)

## Acceptance Criteria

- [ ] Database migration creates `household_survey_responses` table with all required columns
- [ ] All survey response values are encrypted before storage
- [ ] Survey questions are fetched from SurveyJS form and presented via USSD
- [ ] Each answer is saved independently to database
- [ ] Session interruption recovery works: resume from last question
- [ ] Conditional visibility respected: questions shown/hidden based on answers
- [ ] Claim submission blocked until `all_fields_completed = true`
- [ ] Sequence diagram updated to show survey Q&A flow
- [ ] All unit and integration tests pass with zero regressions
- [ ] Code passes linting, formatting, and TypeScript checks

## Validation Commands

Execute every command to validate the feature works correctly with zero regressions.

- `pnpm format && pnpm lint && pnpm tsc --noEmit && pnpm install && pnpm build && pnpm validate:machines && pnpm test` - Run all validation checks

## Notes

- Survey form URL is configurable via environment variable `SURVEY_FORM_URL`
- All survey responses encrypted using existing encryption utilities
- Session recovery uses `customerId + lead_generator_id` to identify partial responses
- Composite unique constraint prevents duplicate survey attempts
- Consider implementing survey response versioning for future form updates
- Future enhancement: Add survey response analytics and reporting
