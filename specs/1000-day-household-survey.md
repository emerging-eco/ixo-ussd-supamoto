# Feature: 1,000 Day Household Survey

## Feature Description

Implement a comprehensive USSD survey flow for Lead Generators to collect detailed household eligibility data on behalf of customers. This feature replaces the manual "Submit 1,000 Day Household Claim" option with a structured survey that collects beneficiary information, nutritional awareness data, and verification details. The survey uses hardcoded questions based on a SurveyJS form definition, supports session recovery, evaluates conditional visibility rules, and automatically submits claims to the IXO blockchain upon completion.

The survey collects critical data including:

- Customer identification
- Household beneficiary categories (pregnant women, breastfeeding mothers, children under 2)
- Child age (conditional)
- Bean consumption patterns
- Price sensitivity
- Nutritional awareness and knowledge
- Lead Generator verification of antenatal cards

All survey responses are encrypted and stored in the `household_claims.survey_form` JSONB field, with automatic claim submission to the IXO blockchain using the existing `submitClaim` service.

## User Story

As a Lead Generator
I want to complete a structured survey on behalf of customers
So that I can collect detailed household eligibility data and automatically submit verified 1,000 Day Household claims to the blockchain

## Problem Statement

Currently, the Agent Tools menu includes a manual "Submit 1,000 Day Household Claim" option (option 3) that doesn't collect sufficient data to verify household eligibility. The system needs to:

1. Replace manual claim submission with a structured survey flow
2. Collect comprehensive household data through USSD questions
3. Support session interruption and recovery (USSD sessions can drop)
4. Handle conditional questions (e.g., child age only if "Child Below 2 Years" selected)
5. Handle multi-part questions (5 nutritional benefit questions)
6. Validate all inputs according to business rules
7. Encrypt and persist survey responses securely
8. Automatically submit claims to IXO blockchain upon survey completion
9. Handle submission failures with retry capability
10. Provide "0. Back" navigation throughout the survey

## Solution Statement

Implement a multi-phase solution:

1. **State Machine**: Create `thousandDaySurveyMachine.ts` with hardcoded survey questions
2. **Menu Integration**: Remove "Submit 1,000 Day Household Claim" from Agent Tools menu and renumber remaining options
3. **Data Persistence**: Use existing `household_claims.survey_form` JSONB field for encrypted storage
4. **Claim Submission**: Integrate with existing `submitClaim` service from `src/services/ixo/ixo-claims.ts`
5. **Session Recovery**: Support resuming from last answered question (except during multi-part nutritional benefits)
6. **Validation**: Reuse existing validation patterns for customer IDs and implement new validators for survey-specific inputs
7. **Error Handling**: Save survey data and mark claim as FAILED on submission errors, allow manual retry
8. **Testing**: Generate flow tests from session log using `pnpm generate:test` with `specs/1000-day-household-session-flow-with-logic.txt` as session recording

## Relevant Files

### Existing Files to Modify

- **`src/machines/supamoto/user-services/userServicesMachine.ts`** - Remove option 3 "Submit 1,000 Day Household Claim", renumber options 4→3, 5→4, 6→5, add route to new survey machine
- **`tests/machines/supamoto/user-services/userServicesMachine.ts`** - Update test expectations for menu structure
- **`src/config.ts`** - Remove `SURVEY_FORM_URL` environment variable reference
- **`.env.example`** - Remove `SURVEY_FORM_URL` line
- **`.env.test`** - Remove `SURVEY_FORM_URL` line

### Existing Files to Reference (No Changes)

- **`src/services/database-storage.ts`** - Use existing `createHouseholdClaim`, `updateHouseholdClaim`, `updateClaimSurveyForm`, `getClaimByLgAndCustomer` methods
- **`src/services/survey-response-storage.ts`** - Use existing `saveSurveyAnswer`, `saveSurveyAnswers`, `markSurveyComplete`, `getSurveyResponseState` methods
- **`src/services/ixo/ixo-claims.ts`** - Use existing `submitClaim` function for blockchain submission
- **`src/utils/input-validation.ts`** - Reuse existing `validateCustomerId` function
- **`src/machines/supamoto/activation/customerActivationMachine.ts`** - Reference customer ID validation pattern `/^C[A-Za-z0-9]{8,}$/`
- **`src/machines/supamoto/activation/householdSurveyMachine.ts`** - Reference session recovery patterns
- **`src/machines/supamoto/utils/navigation-mixin.ts`** - Use `withNavigation` for consistent navigation
- **`src/machines/supamoto/guards/navigation.guards.ts`** - Use existing navigation guards
- **`migrations/postgres/000-init-all.sql`** - Reference `household_claims` table structure
- **`specs/1000-day-household-session-flow-with-logic.txt`** - Use to generate tests

### New Files

- **`src/machines/supamoto/thousand-day-survey/thousandDaySurveyMachine.ts`** - Main survey state machine
- **`src/machines/supamoto/thousand-day-survey/index.ts`** - Export module
- **`src/machines/supamoto/thousand-day-survey/survey-questions.ts`** - Hardcoded survey question definitions
- **`src/machines/supamoto/thousand-day-survey/survey-validators.ts`** - Survey-specific validation functions
- **`src/machines/supamoto/thousand-day-survey/survey-mappers.ts`** - USSD input to SurveyJS value mappers
- **`tests/machines/supamoto/thousand-day-survey/thousandDaySurveyMachine.test.ts`** - Unit tests
- **`tests/flows/1000-day-survey-flow.test.ts`** - Integration test generated from session log
- **`specs/1000-day-household-session-flow-with-logic.log`** - Session log for test generation (already exists)

## Implementation Plan

### Phase 1: Foundation

Remove deprecated environment variable and update menu structure to prepare for new survey integration.

**Tasks:**

1. Remove `SURVEY_FORM_URL` from all configuration files
2. Update Agent Tools menu in `userServicesMachine.ts` to remove option 3
3. Renumber remaining Agent Tools options (4→3, 5→4, 6→5)
4. Update corresponding tests for menu structure changes

### Phase 2: Core Implementation

Build the survey state machine with hardcoded questions, validation, and data persistence.

**Tasks:**

1. Create survey question definitions based on SurveyJS form
2. Implement survey validators for all question types
3. Implement USSD-to-SurveyJS value mappers
4. Build main survey state machine with all states and transitions
5. Integrate session recovery logic
6. Handle conditional visibility (child age question)
7. Handle multi-part questions (5 nutritional benefits)
8. Add comprehensive unit tests

### Phase 3: Integration

Connect the survey machine to the parent machine, implement claim submission, and add end-to-end testing.

**Tasks:**

1. Register survey machine as actor in `userServicesMachine.ts`
2. Add routing from Agent Tools menu to survey machine
3. Implement claim submission service using existing `submitClaim`
4. Add error handling with retry capability
5. Generate and validate flow test from session log
6. Run full test suite to ensure zero regressions

## Step by Step Tasks

### Step 1: Remove SURVEY_FORM_URL Environment Variable

- Remove `SURVEY_FORM_URL` from `.env.example`
- Remove `SURVEY_FORM_URL` from `.env.test`
- Remove `SURVEY_FORM_URL` from `src/config.ts`
- Verify no other references exist in codebase

### Step 2: Update Agent Tools Menu Structure

- Edit `src/machines/supamoto/user-services/userServicesMachine.ts`:
  - Remove line for option 3 "Submit 1,000 Day Household Claim"
  - Update menu message to show options 1, 2, 3, 4, 5 (renumbered)
  - Remove `agentSubmitHouseholdClaim` state
  - Remove `submitHouseholdClaimService` actor
  - Update input guards and transitions
- Edit `tests/machines/supamoto/user-services/userServicesMachine.ts`:
  - Update test expectations for new menu structure
  - Remove tests for removed claim submission option
- Run tests: `pnpm test tests/machines/supamoto/user-services/`

### Step 3: Create Survey Question Definitions

- Create `src/machines/supamoto/thousand-day-survey/survey-questions.ts`
- Define hardcoded survey questions array based on SurveyJS form:
  - `ecs:customerId` - Customer ID input
  - `ecs:beneficiaryCategory` - Multi-select beneficiary categories
  - `schema:childMaxAge` - Conditional child age
  - `ecs:beanIntakeFrequency` - Bean consumption frequency
  - `schema:priceSpecification` - Price willingness
  - `ecs:awarenessIronBeans` - Iron bean awareness
  - `ecs:knowsNutritionalBenefits` - Nutritional knowledge
  - `ecs:nutritionalBenefitDetails` - 5-part nutritional benefits
  - `ecs:confirmAction_antenatal_card_verified` - LG verification
- Include question metadata: name, title, type, required, visibleIf, choices

### Step 4: Implement Survey Validators

- Create `src/machines/supamoto/thousand-day-survey/survey-validators.ts`
- Implement validation functions:
  - `validateCustomerId` - Reuse from existing validation utils
  - `validateBeneficiaryCategory` - Validate options 1-8
  - `validateChildAge` - Validate 0-24 months
  - `validateBeanIntakeFrequency` - Validate options 1-5
  - `validatePriceSpecification` - Strip "ZMW", validate number
  - `validateYesNo` - Validate options 1-2
  - `validateNutritionalBenefit` - Validate options 1-2
- Add unit tests for each validator

### Step 5: Implement USSD-to-SurveyJS Mappers

- Create `src/machines/supamoto/thousand-day-survey/survey-mappers.ts`
- Implement mapping functions:
  - `mapBeneficiaryCategory` - Map USSD options 1-8 to checkbox arrays
  - `mapChildAge` - Convert string to number
  - `mapBeanIntakeFrequency` - Map option to text value
  - `mapPriceSpecification` - Strip "ZMW", convert to number
  - `mapYesNo` - Map 1/2 to "Yes"/"No"
  - `mapNutritionalBenefits` - Collect 5 answers, convert to checkbox array
  - `mapAntenatalCardVerified` - Map 1/2 to true/false
- Add unit tests for each mapper

### Step 6: Create Survey State Machine

- Create `src/machines/supamoto/thousand-day-survey/thousandDaySurveyMachine.ts`
- Define context interface with all survey fields
- Define event types (INPUT, ERROR)
- Implement states:
  - `creatingClaim` - Create household claim record
  - `recoveringSession` - Check for existing survey data
  - `askCustomerId` - First question
  - `askBeneficiaryCategory` - Second question
  - `askChildAge` - Conditional third question
  - `askBeanIntakeFrequency` - Fourth question
  - `askPriceSpecification` - Fifth question
  - `askAwarenessIronBeans` - Sixth question
  - `askKnowsNutritionalBenefits` - Seventh question
  - `askNutritionalBenefit1` through `askNutritionalBenefit5` - Multi-part question
  - `askAntenatalCardVerified` - Final question
  - `submittingClaim` - Submit to blockchain
  - `claimSubmitted` - Success state
  - `claimSubmissionFailed` - Error state with retry
  - `routeToMain` - Final state
  - `error` - General error state
- Implement guards for validation and conditional visibility
- Implement actions for saving answers and updating context
- Implement services for database operations and claim submission
- Use `withNavigation` for "0. Back" support on all questions

### Step 7: Implement Session Recovery Logic

- In `recoveringSession` state:
  - Call `getSurveyResponseState` to fetch existing data
  - If data exists, populate context with answers
  - Determine next unanswered question
  - Transition to appropriate question state
- Handle special case: If session dropped during nutritional benefits (questions 1-4 of 5), restart from question 1

### Step 8: Implement Claim Submission Service

- Create `submitClaimService` using `fromPromise`
- Enhance `submitClaimService` to support claim submission using `@ixo/supamoto-bot-sdk` package; specifically the `claims.v1.submit1000DayHouseholdClaim` function.
- Example of function signature:

```typescript
const householdClaim = await claimsBot.claims.v1.submit1000DayHouseholdClaim({
  customerId: "C123", // Required
  beneficiaryCategory: BeneficiaryCategory.pregnant, // Required: 'Pregnant Woman', 'Breastfeeding Woman', 'Chile Below 2 Years'
  childMaxAge: 18, // Required: Maximum age of child in months
  beanIntakeFrequency: BeanIntakeFrequency.daily, // Required: 'None at all', '1-2 times a week', '3-4 times a week', '5-6 times a week', 'Daily'
  priceSpecification: "5 ZMW", // Required: Price specification
  awarenessIronBeans: AwarenessIronBeans.yes, // Required: 'Yes' or 'No'
  knowsNutritionalBenefits: KnowsNutritionalBenefits.yes, // Required: 'Yes' or 'No'
  nutritionalBenefitsDetails: NutritionalBenefitsDetails.ironStatus, // Required: 'iron_status', 'cognitive_support', 'work_capacity', 'high_iron_zinc', 'protein_fiber'
  antenatalCardVerified: true, // Required: Boolean indicating if antenatal card is verified
});
```

- Map user responses to function parameters
- Update claim status to "PROCESSED" on success
- Update claim status to "FAILED" on error
- Return result for state machine handling

### Step 9: Add Unit Tests

- Create `tests/machines/supamoto/thousand-day-survey/thousandDaySurveyMachine.test.ts`
- Test all question states and transitions
- Test validation guards
- Test conditional visibility (child age)
- Test multi-part question handling
- Test session recovery scenarios
- Test claim submission success and failure
- Test "0. Back" navigation
- Test error handling
- Run tests: `pnpm test tests/machines/supamoto/thousand-day-survey/`

### Step 10: Integrate with User Services Machine

- Edit `src/machines/supamoto/user-services/userServicesMachine.ts`:
  - Import `thousandDaySurveyMachine`
  - Add to actors configuration
  - Update `agent` state to route option 2 to survey machine
  - Add `agentSurvey` state that invokes survey machine
  - Handle `onDone` and `onError` from survey machine
- Edit `tests/machines/supamoto/user-services/userServicesMachine.ts`:
  - Add tests for survey machine integration
- Run tests: `pnpm test tests/machines/supamoto/user-services/`

### Step 11: Create Export Module

- Create `src/machines/supamoto/thousand-day-survey/index.ts`
- Export machine, types, and utilities
- Update `src/machines/index.ts` to include new machine

### Step 12: Generate Flow Test from Session Log

- Run: `pnpm generate:test specs/1000-day-household-session-flow-with-logic.log 1000-day-survey-flow`
- Review generated test file: `tests/flows/1000-day-survey-flow.test.ts`
- Manually remove any lines generated from "LOGIC:" comments in the session log
- Verify test structure matches expected flow
- Run flow test: `pnpm test:flows:run tests/flows/1000-day-survey-flow.test.ts`

### Step 13: Run Full Validation

- Execute all validation commands (see Validation Commands section)
- Fix any failing tests or type errors
- Ensure zero regressions in existing functionality
- Verify survey flow works end-to-end

## Testing Strategy

### Unit Tests

**Survey Validators** (`survey-validators.test.ts`):

- Test customer ID validation with valid/invalid formats
- Test beneficiary category validation with all 8 options
- Test child age validation with boundary values (0, 24, -1, 25)
- Test price specification validation with/without "ZMW" suffix
- Test yes/no validation
- Test nutritional benefit validation

**Survey Mappers** (`survey-mappers.test.ts`):

- Test beneficiary category mapping for all 8 combinations
- Test child age string-to-number conversion
- Test price specification "ZMW" stripping and number conversion
- Test yes/no to text mapping
- Test nutritional benefits array building from 5 answers
- Test antenatal card verification boolean mapping

**State Machine** (`thousandDaySurveyMachine.test.ts`):

- Test initial state and claim creation
- Test each question state and transition
- Test validation guards for each question
- Test conditional visibility (child age only shown when applicable)
- Test multi-part question flow (5 nutritional benefits)
- Test session recovery with partial data
- Test session recovery restart for nutritional benefits
- Test claim submission success
- Test claim submission failure and retry
- Test "0. Back" navigation from each question
- Test error handling

### Integration Tests

**Flow Test** (`1000-day-survey-flow.test.ts`):

- Generated from `specs/1000-day-household-session-flow-with-logic.log`
- Tests complete survey flow from Agent Tools menu to claim submission
- Validates all question prompts and responses
- Verifies data persistence at each step
- Confirms claim submission to blockchain

**User Services Integration** (`userServicesMachine.test.ts`):

- Test Agent Tools menu shows correct options (1-5, not 1-6)
- Test option 2 routes to survey machine
- Test survey machine completion returns to Agent Tools
- Test survey machine error handling

### Edge Cases

1. **Session Drop During Survey**:
   - Drop session after question 3, resume from question 4
   - Drop session during nutritional benefit question 3, restart from question 1

2. **Invalid Inputs**:
   - Invalid customer ID format
   - Out-of-range child age (negative, >24)
   - Invalid option selections
   - Non-numeric price input

3. **Conditional Visibility**:
   - Select beneficiary categories without "Child Below 2 Years" - child age question skipped
   - Select "Child Below 2 Years" - child age question shown

4. **Claim Submission Failures**:
   - Network error during submission
   - Blockchain transaction failure
   - Retry after failure with existing data

5. **Navigation**:
   - Press "0. Back" from each question
   - Press "\*. Exit" during survey (data saved)

6. **Data Persistence**:
   - Verify encrypted storage in database
   - Verify survey form JSON structure
   - Verify claim status updates

## Acceptance Criteria

1. ✅ Agent Tools menu shows 5 options (not 6), with option 3 removed
2. ✅ Option 2 "1,000 Day Survey" routes to survey machine
3. ✅ Survey asks all 9 questions in correct order
4. ✅ Customer ID validation uses existing regex pattern `/^C[A-Za-z0-9]{8,}$/`
5. ✅ Child age question only shown when "Child Below 2 Years" selected
6. ✅ All 5 nutritional benefit questions asked before saving answer
7. ✅ Each answer saved to `household_claims.survey_form` JSONB field
8. ✅ Survey data encrypted using existing encryption service
9. ✅ Session recovery works for all questions except mid-nutritional-benefits
10. ✅ "0. Back" navigation available on all questions
11. ✅ Claim created at start of survey with `is_1000_day_household = true`
12. ✅ Claim submitted to blockchain using existing `submitClaim` service
13. ✅ Claim status updated to "PROCESSED" on success
14. ✅ Claim status updated to "FAILED" on error, with retry option
15. ✅ Survey completion message shown after successful submission
16. ✅ All existing tests pass with zero regressions
17. ✅ Flow test generated from session log passes
18. ✅ `SURVEY_FORM_URL` environment variable removed from all files
19. ✅ Partial `survey_form` data saved to database after interactions during survey form data capture

## Validation Commands

Execute every command to validate the feature works correctly with zero regressions.

- `pnpm install` - Install dependencies
- `pnpm format` - Format code
- `pnpm lint` - Lint code
- `pnpm tsc --noEmit` - Type check
- `pnpm build` - Build project
- `pnpm validate:machines` - Validate state machines
- `pnpm test` - Run all unit tests
- `pnpm test tests/machines/supamoto/thousand-day-survey/` - Run survey machine tests
- `pnpm test tests/machines/supamoto/user-services/` - Run user services tests
- `pnpm generate:test specs/1000-day-household-session-flow-with-logic.log 1000-day-survey-flow` - Generate flow test
- `pnpm test:flows:run tests/flows/1000-day-survey-flow.test.ts` - Run generated flow test
- `pnpm test:flows` - Run all flow tests
- `pnpm test:coverage` - Run tests with coverage

## Notes

### SurveyJS Form Reference

The hardcoded survey questions are based on the SurveyJS form available at:
`https://devmx.ixo.earth/_matrix/media/v3/download/devmx.ixo.earth/rzmqolmRxTyVRuPWfrvkjZbX`

### Customer ID Validation Pattern

Use the existing pattern from `customerActivationMachine.ts` and `loginMachine.ts`:

```typescript
/^C[A-Za-z0-9]{8,}$/;
```

This matches customer IDs like `CDDA2FB60` (hexadecimal format).

### Claim Submission

The feature uses the existing `submitClaim` function from `src/services/ixo/ixo-claims.ts`. The `@ixo/supamoto-bot-sdk` package does NOT have a `submit1000DayHouseholdClaim` function as originally expected.

### Session Log LOGIC Comments

The session log file `specs/1000-day-household-session-flow-with-logic.log` contains "LOGIC:" comments that explain the implementation requirements. These comments are NOT part of the actual session recording and should be filtered out when generating tests.

### Multi-Part Question Handling

The 5 nutritional benefit questions are treated as a single logical question. All 5 answers must be collected before saving to the database. If the session drops during questions 1-4, the survey restarts from question 1 of 5 (losing the partial answers).

### Database Schema

The `household_claims.survey_form` field is defined as TEXT but contains JSON data. It has a GIN index for efficient JSONB querying:

```sql
CREATE INDEX idx_household_claims_survey_form ON household_claims USING GIN ((survey_form::jsonb));
```

### Future Considerations

- Consider adding analytics to track survey completion rates
- Consider adding survey version tracking for future form updates
- Consider adding LG performance metrics (surveys completed per day)
- Consider adding customer feedback mechanism
- Consider internationalizing survey questions for multiple languages
