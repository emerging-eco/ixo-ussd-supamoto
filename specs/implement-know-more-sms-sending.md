# Chore: Implement Know More SMS Sending with All 7 Menu Options

## Chore Description

The Know More menu currently displays only 3 menu options and does NOT actually send SMS messages to users. Instead, it shows a fake message claiming "We have sent you a SMS with more information" without any actual SMS delivery. This chore implements the complete Know More functionality as specified in `specs/SMS Templates for the USSD (1)-Know More.docx.md`, which requires:

1. **Expand menu from 3 to 7 options** with correct wording per specification
2. **Implement actual SMS sending** using the existing SMS infrastructure (Africa's Talking)
3. **Create 7 SMS templates** matching the specification exactly
4. **Add proper error handling** for SMS failures with retry/back options
5. **Update state machine** to use async invoke services (like activation machine pattern)
6. **Update all tests** to verify SMS is actually sent

**Current State**: Menu shows 3 options, no SMS sent, only fake confirmation message  
**Target State**: Menu shows 7 options, actual SMS sent with correct templates, proper error handling

**Specification Reference**: `specs/SMS Templates for the USSD (1)-Know More.docx.md`

## Relevant Files

Use these files to resolve the chore:

- **`specs/SMS Templates for the USSD (1)-Know More.docx.md`** - Contains the exact specification for all 7 menu options and their corresponding SMS message templates. This is the source of truth for menu wording and SMS content.

- **`src/machines/supamoto/information/knowMoreMachine.ts`** - The current Know More state machine that needs to be updated. Currently has 3 menu options and fake SMS sending. Needs to be expanded to 7 options with real SMS sending using invoke services.

- **`src/services/sms.ts`** - The SMS service that handles Africa's Talking integration. Already has `sendSMS()` function and other SMS helpers. Will be used by the new SMS sending service.

- **`src/machines/supamoto/activation/customerActivationMachine.ts`** - Reference implementation showing how to properly invoke SMS services using `fromPromise` and handle success/error states. This is the pattern to follow.

- **`tests/machines/supamoto/information/knowMoreMachine.test.ts`** - Unit tests for the Know More machine. Needs to be updated to test all 7 options and verify SMS sending with mocked SMS service.

- **`tests/machines/supamoto/information/knowMoreMachine-demo.ts`** - Demo file for interactive testing. Needs to be updated to show all 7 menu options.

- **`tests/flows/know-more-flow.test.ts`** - Integration flow test. Needs to be updated with new expected messages and SMS sending states.

- **`src/constants/branding.ts`** - Contains branding messages including `infoCenterTitle()`. May need to be reviewed for consistency.

### New Files

- **`src/templates/sms/information.ts`** - New file to contain all 7 SMS templates for Know More menu options. Will export individual template functions and a helper function to get template by option number.

## Step by Step Tasks

IMPORTANT: Execute every step in order, top to bottom.

### Step 1: Create SMS Templates File

Create `src/templates/sms/information.ts` with all 7 SMS templates matching the specification exactly:

- Copy the exact SMS content from `specs/SMS Templates for the USSD (1)-Know More.docx.md`
- Create individual template functions: `interestedInStoveSMS()`, `pelletPricesSMS()`, `deliveryInfoSMS()`, `stoveRepairSMS()`, `performanceInfoSMS()`, `digitalVoucherInfoSMS()`, `contractInfoSMS()`
- Add a helper function `getKnowMoreSMS(option: number): string` that returns the correct template based on option number (1-7)
- Use the greeting "Chinja Malasha, Chinya Umoyo!" consistently across all templates
- Preserve all formatting, line breaks, and emphasis from the specification
- Add JSDoc comments documenting each template's purpose

### Step 2: Export SMS Templates in Index

Update `src/templates/sms/index.ts`:

- Add `export * from "./information.js";` to make the new templates available throughout the codebase
- Verify the export works by checking TypeScript compilation

### Step 3: Create SMS Service Actor

In `src/machines/supamoto/information/knowMoreMachine.ts`, add a new `fromPromise` actor:

- Import `fromPromise` from `xstate`
- Import `sendSMS` from `../../../services/sms.js`
- Import `getKnowMoreSMS` from `../../../templates/sms/information.js`
- Import `createModuleLogger` from `../../../services/logger.js`
- Create `sendInformationSMSService` actor that:
  - Takes `{ phoneNumber: string; option: number }` as input
  - Calls `getKnowMoreSMS(option)` to get the correct template
  - Calls `sendSMS({ to: phoneNumber, message })` to send the SMS
  - Throws error if `result.success` is false
  - Returns `{ messageId: result.messageId }` on success
  - Logs all steps with appropriate log levels (info, error)
- Follow the exact pattern from `customerActivationMachine.ts` lines 119-210

### Step 4: Update Context Interface

Update the `KnowMoreContext` interface:

- Add `selectedOption?: number` to track which menu option the user selected (1-7)
- Keep all existing fields: `sessionId`, `phoneNumber`, `serviceCode`, `message`, `error`

### Step 5: Update Menu Message

Update the `infoMenuMessage` constant:

- Change from 3 options to 7 options
- Use exact wording from specification:
  - "1. Interested in a stove" (not "Interested in Product")
  - "2. Pellet Bag Prices & Accessories" (not "Pricing & accessories")
  - "3. Can we deliver it to you?"
  - "4. Can a stove be fixed?"
  - "5. What is Performance?"
  - "6. What is a digital voucher?"
  - "7. What is a contract?"
- Keep the title from `messages.infoCenterTitle()`
- Add "0. Back" at the end for navigation

### Step 6: Add New Actions

Add these actions to the `setup()` configuration:

- `setSelectedOption`: Assigns the selected option number to context
- `setSendingMessage`: Sets message to "Sending information SMS...\n1. Continue"
- `setSuccessMessage`: Sets message to "SMS sent successfully! Check your phone for details.\n1. Back to Main Menu\n0. Back"
- `setErrorMessage`: Sets message to "Failed to send SMS. Please try again.\n0. Back\n\*. Exit" and sets error flag
- Keep existing actions: `setInfoMenuMessage`, `setGenericMessage`, `setError`, `clearErrors`

### Step 7: Update State Machine States

Restructure the state machine:

- **infoMenu state**: Update INPUT handlers to route to `sendingSMS` state with guards for options 1-7, each setting `selectedOption` in context
- **sendingSMS state** (new): Replace the old `sendSMS` state with this invoke-based state:
  - Entry action: `setSendingMessage`
  - Invoke: `sendInformationSMSService` with input from context
  - onDone: Transition to `smsSent` state
  - onError: Transition to `smsError` state with error action
- **smsSent state** (new): Show success message, allow user to press 1 to go back to main menu or 0 to go back to info menu
- **smsError state** (new): Show error message, allow user to press 0 to retry (back to infoMenu) or \* to exit
- **error state**: Keep for general errors
- **routeToMain state**: Keep as final state

### Step 8: Register SMS Service Actor

In the `setup()` configuration:

- Add `actors: { sendInformationSMSService }` to register the actor
- Ensure it's available for the invoke in `sendingSMS` state

### Step 9: Update Unit Tests

Update `tests/machines/supamoto/information/knowMoreMachine.test.ts`:

- Mock the SMS service using `vi.mock('../../../services/sms.js')`
- Add tests for all 7 menu options (currently only tests 3)
- Add test: "should send SMS for option 1 (Interested in stove)" - verify SMS service called with correct template
- Add test: "should send SMS for option 4 (Can a stove be fixed?)" - verify new menu option works
- Add test: "should handle SMS send failure gracefully" - mock SMS failure, verify error state
- Add test: "should send correct SMS template for each option" - loop through options 1-7, verify correct template used
- Add test: "should transition to smsSent state on successful SMS" - verify state transitions
- Add test: "should transition to smsError state on failed SMS" - verify error handling
- Update existing tests to match new state names (`sendingSMS` instead of `sendSMS`)
- Use `waitFor` helper to wait for async state transitions

### Step 10: Update Demo File

Update `tests/machines/supamoto/information/knowMoreMachine-demo.ts`:

- Add demos for all 7 menu options (currently only shows 3)
- Add demo for SMS error handling
- Update console output to show all available options
- Add comments explaining each option

### Step 11: Update Flow Tests

Update `tests/flows/know-more-flow.test.ts`:

- Update expected messages to match new state machine messages
- Change "Thank you for your interest. We have sent you a SMS..." to "Sending information SMS...\n1. Continue"
- Add test for successful SMS send: "SMS sent successfully! Check your phone for details..."
- Add tests for new menu options 4-7
- Update cumulative USSD text for all test cases
- Ensure 2-second delays are present between turns (except Turn 1)

### Step 12: Verify TypeScript Compilation

Run TypeScript compiler to catch any type errors:

- Execute `pnpm tsc --noEmit`
- Fix any type errors related to context, events, or actions
- Ensure all imports are correct with `.js` extensions

### Step 13: Run Validation Commands

Execute all validation commands to ensure zero regressions:

- Run `pnpm install` to ensure dependencies are installed
- Run `pnpm format` to format all code
- Run `pnpm lint` to check for linting errors
- Run `pnpm tsc --noEmit` to verify TypeScript compilation
- Run `pnpm build` to build the project
- Run `pnpm validate:machines` to validate state machine structure
- Run `pnpm test` to run all unit tests
- Verify all tests pass with zero failures
- Check that SMS templates are correctly imported and used

## Validation Commands

Execute every command to validate the chore is complete with zero regressions.

- `pnpm install && pnpm format && pnpm lint && pnpm tsc --noEmit && pnpm build && pnpm validate:machines && pnpm test` - Run tests to validate the chore is complete with zero regressions.
- `pnpm test:flows:knowmore` - Run the Know More flow test specifically to verify the integration works end-to-end.

## Notes

### SMS Infrastructure Already Exists

- The SMS service (`src/services/sms.ts`) is fully functional and used in other flows (activation, household)
- Africa's Talking integration is working
- No new dependencies needed - all required libraries are already installed
- SMS can be tested in stub mode (SMS_ENABLED=false) without actual SMS costs

### Pattern to Follow

- Use `customerActivationMachine.ts` as the reference implementation for SMS sending
- The pattern is: `invoke` → `fromPromise` actor → `sendSMS()` → `onDone`/`onError`
- Always check `result.success` and throw error if false to trigger `onError` handler

### Testing Strategy

- Unit tests should mock the SMS service to avoid actual SMS sending during tests
- Flow tests run against the actual server but can use stub mode
- Demo files are for manual interactive testing during development
- Use `pnpm test:interactive` to manually test the flow with real USSD interactions

### SMS Costs

- Each SMS sent costs money via Africa's Talking
- In development, use `SMS_ENABLED=false` in `.env` to enable stub mode
- Stub mode returns success without actually sending SMS
- Production should have `SMS_ENABLED=true` with valid API credentials

### Backward Compatibility

- The menu structure changes from 3 to 7 options (breaking change for users)
- Existing flow tests will need updates to match new messages
- No database schema changes required
- No API changes required

### State Machine Validation

- The `pnpm validate:machines` command checks state machine structure
- Ensure all states are reachable and all transitions are valid
- Ensure all guards and actions are defined in `setup()`
- Ensure all actors are registered in `setup()`

### Error Handling

- SMS failures should show user-friendly error messages
- Users should be able to retry (go back to menu) or exit
- All errors should be logged for monitoring
- Network timeouts are handled by Africa's Talking client

### Future Enhancements (Out of Scope)

- SMS retry logic with exponential backoff (use `sendSMSWithRetry` instead of `sendSMS`)
- Analytics tracking for menu selections
- A/B testing different SMS templates
- Multi-language support for SMS content
- SMS delivery confirmation tracking
