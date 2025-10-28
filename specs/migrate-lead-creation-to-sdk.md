# Chore: Migrate Lead Creation Claim Submission from Direct Blockchain to ixo-supamoto-bot-sdk

## Chore Description

Migrate the lead creation claim submission mechanism from direct blockchain transactions (using `@ixo/impactxclient-sdk`) to the API-based approach using `@ixo/supamoto-bot-sdk`. This migration simplifies the implementation, improves performance, and centralizes claim management through the claims bot service.

**Current State**: When a new customer account is created via USSD, the system submits a "Lead Generation" claim directly to the IXO blockchain using `MsgSubmitClaim` transactions. This requires:

- Customer's mnemonic for blockchain signing
- Feegranter configuration for gas fees
- Direct RPC connection to IXO blockchain
- Manual claim ID generation using SHA256 hashing

**Target State**: Use the `@ixo/supamoto-bot-sdk` to submit lead creation claims via HTTP API to the claims bot service. This approach:

- Uses bot access token for authentication (no mnemonic needed)
- Eliminates blockchain gas fees and feegranter complexity
- Provides faster response times (HTTP API vs blockchain transaction)
- Centralizes claim tracking in the bot service
- Uses standardized SDK enums for data validation

**Scope**: This migration affects only the lead creation claim submission during customer account creation. The 1,000 Day Household claim submission (already using the SDK) remains unchanged.

## Relevant Files

Use these files to resolve the chore:

- **`src/services/ixo/background-ixo-creation.ts`** (Lines 89-148)
  - Contains the current direct blockchain claim submission logic
  - Needs to be replaced with SDK-based approach
  - Imports need updating (remove blockchain-specific, add SDK imports)

- **`src/services/claims-bot.ts`**
  - Already contains SDK client initialization pattern for 1,000 Day Household claims
  - Provides reference implementation for SDK usage
  - Contains helper functions for enum mapping (can be used as reference)

- **`src/config.ts`**
  - Contains configuration for CLAIMS_BOT URL and ACCESS_TOKEN
  - Needs verification that claims bot config is properly exposed

- **`.env.example`**
  - Needs updating to document required CLAIMS_BOT environment variables
  - Should remove or deprecate LEADGEN_COLLECTION_ID and LEADGEN_TEMPLATE_URL

- **`.env.test`**
  - Already contains CLAIMS_BOT_URL and CLAIMS_BOT_ACCESS_TOKEN
  - Verify these are properly configured for testing

- **`src/services/ixo/ixo-claims.ts`**
  - Current direct blockchain submission implementation
  - Will remain for other claim types but not used for lead creation after migration

- **`package.json`**
  - Already has `@ixo/supamoto-bot-sdk` version 0.0.9 installed
  - No new dependencies needed

- **`docs/supamoto/README.md`**
  - Needs updating to reflect new SDK-based claim submission approach
  - Update integration points section

### New Files

- **`tests/services/ixo/lead-creation-claim.test.ts`**
  - New unit test file for SDK-based lead creation claim submission
  - Test successful claim submission
  - Test error handling scenarios
  - Mock SDK client responses

## Step by Step Tasks

IMPORTANT: Execute every step in order, top to bottom.

### Step 1: Update Environment Configuration

- Review `.env.example` and ensure CLAIMS_BOT configuration is documented
- Add comments explaining the migration from LEADGEN*\* to CLAIMS_BOT*\* variables
- Mark LEADGEN_COLLECTION_ID and LEADGEN_TEMPLATE_URL as deprecated (optional, for backward compatibility)
- Verify `.env.test` has correct CLAIMS_BOT_URL and CLAIMS_BOT_ACCESS_TOKEN values

### Step 2: Verify Configuration Service

- Open `src/config.ts` and verify CLAIMS_BOT configuration is properly exported
- Ensure `config.CLAIMS_BOT.URL` and `config.CLAIMS_BOT.ACCESS_TOKEN` are accessible
- Add validation to throw clear error if claims bot config is missing

### Step 3: Create SDK Client Helper in background-ixo-creation.ts

- Add imports at top of `src/services/ixo/background-ixo-creation.ts`:
  - `import { createClaimsBotClient, ClaimsBotTypes } from "@ixo/supamoto-bot-sdk";`
  - `import { config } from "../../config.js";`
- Remove unused imports after migration:
  - `import { submitClaim } from "./ixo-claims.js";` (no longer needed for lead claims)
  - `import { sha256 } from "@cosmjs/crypto";` (no longer needed)
  - `import { toHex } from "@cosmjs/encoding";` (no longer needed)
- Remove environment variable defaults for LEADGEN_COLLECTION_ID and LEADGEN_TEMPLATE_URL (lines 18-20)
- Add singleton claims bot client getter function (similar to `src/services/claims-bot.ts`):

  ```typescript
  let claimsBotClient: ReturnType<typeof createClaimsBotClient> | null = null;

  function getClaimsBotClient() {
    if (!claimsBotClient) {
      claimsBotClient = createClaimsBotClient({
        botUrl: config.CLAIMS_BOT.URL,
        accessToken: config.CLAIMS_BOT.ACCESS_TOKEN,
      });
    }
    return claimsBotClient;
  }
  ```

### Step 4: Replace Claim Submission Logic

- Locate the claim submission block in `src/services/ixo/background-ixo-creation.ts` (lines 89-148)
- Replace the entire try-catch block with SDK-based implementation:
  - Initialize claims bot client using `getClaimsBotClient()`
  - Parse `params.fullName` into `givenName` and `familyName` (split on whitespace)
  - Call `claimsBot.claims.v1.submitLeadCreationClaim()` with:
    - `customerId`: `params.customerId`
    - `leadGenerator`: `ClaimsBotTypes.LeadGenerator.ussdSignup`
    - `givenName`: First part of full name (optional)
    - `familyName`: Remaining parts of full name (optional)
    - `telephone`: `params.phoneNumber`
    - `nationalId`: undefined (not collected during account creation)
    - `leadGeneratorName`: undefined (not applicable for USSD signup)
  - Update success logging to log `response.data.claimId` instead of `txHash` and `height`
  - Update error logging to include HTTP-specific error details (status code, response data)

### Step 5: Update Error Handling

- Enhance error catch block to handle HTTP errors specifically
- Log `statusCode` from `(claimError as any)?.response?.status` if available
- Log `responseData` from `(claimError as any)?.response?.data` if available
- Keep error as non-critical (warning level) since it shouldn't block account creation
- Ensure error message clearly indicates SDK-based submission failure

### Step 6: Create Unit Tests

- Create new test file `tests/services/ixo/lead-creation-claim.test.ts`
- Import necessary testing utilities (vitest, mocks)
- Mock `createClaimsBotClient` from `@ixo/supamoto-bot-sdk`
- Test successful claim submission:
  - Mock successful SDK response with claim ID
  - Verify correct parameters passed to SDK
  - Verify success logging
- Test error scenarios:
  - Mock 401 Unauthorized error
  - Mock 500 Internal Server Error
  - Mock network timeout
  - Verify error logging includes HTTP details
- Test name parsing:
  - Single name (e.g., "John")
  - Full name (e.g., "John Doe")
  - Multiple names (e.g., "John Michael Doe")
  - Empty name handling

### Step 7: Update Integration Tests

- Review `tests/services/ixo/background-ixo-creation.test.ts` (if exists)
- Update any tests that verify claim submission behavior
- Mock SDK client instead of blockchain signing client
- Verify claim ID is returned instead of transaction hash
- Update assertions to match new response format

### Step 8: Update Documentation

- Update `docs/supamoto/README.md` section on "Integration Points" (around line 130-144)
- Change "IXO Blockchain: Web3 integration for wallet creation and claims" to clarify:
  - Wallet creation still uses direct blockchain
  - Lead creation claims now use claims bot SDK
  - 1,000 Day Household claims use claims bot SDK
- Update "External Services" section to emphasize claims bot role
- Add note about migration from direct blockchain to SDK approach

### Step 9: Update Sequence Diagrams (if applicable)

- Review `docs/supamoto/SEQUENCE_DIAGRAM.md` for any references to lead generation claims
- Update sequence diagrams to show HTTP API call to claims bot instead of blockchain transaction
- Update any references to transaction hashes to claim IDs

### Step 10: Run Validation Commands

- Execute all validation commands to ensure zero regressions
- Fix any TypeScript compilation errors
- Fix any linting issues
- Ensure all existing tests pass
- Ensure new tests pass

## Validation Commands

Execute every command to validate the chore is complete with zero regressions.

- `pnpm install` - Ensure all dependencies are installed (SDK already present)
- `pnpm format` - Format all code changes
- `pnpm lint` - Lint all code changes and fix any issues
- `pnpm tsc --noEmit` - Verify TypeScript compilation with no errors
- `pnpm build` - Build the project to ensure no build errors
- `pnpm validate:machines` - Validate state machine configurations
- `pnpm test` - Run all unit tests (including new lead creation claim tests)
- `pnpm test:flows` - Run flow tests to ensure account creation flow still works
- `pnpm test:flows:createcustomer` - Specifically test customer creation flow end-to-end

## Notes

### SDK Version

- Currently using `@ixo/supamoto-bot-sdk` version `^0.0.9`
- No upgrade needed for this migration

### Backward Compatibility

- The migration does NOT affect existing customer accounts
- Only affects new account creation going forward
- Old environment variables (LEADGEN\_\*) can be kept for backward compatibility but are no longer used

### Non-Breaking Change

- This is a non-breaking change from the user's perspective
- Account creation flow remains identical
- Only the backend claim submission mechanism changes

### Performance Improvement

- Expected performance improvement: ~5-10 seconds (blockchain) → ~1-3 seconds (HTTP API)
- No gas fees or feegranter configuration needed
- More predictable response times

### Error Handling Philosophy

- Claim submission failures are logged as warnings (non-critical)
- Account creation succeeds even if claim submission fails
- This maintains existing behavior where claim submission is fire-and-forget

### Testing Strategy

- Unit tests mock SDK client to avoid external dependencies
- Integration tests can use staging claims bot environment
- Flow tests verify end-to-end account creation still works

### Configuration Requirements

- `CLAIMS_BOT_URL` must be set in environment
- `CLAIMS_BOT_ACCESS_TOKEN` must be set in environment
- Both are already configured in `.env.test`
- Production deployment needs these variables configured

### Reference Implementation

- The 1,000 Day Household claim submission in `src/services/claims-bot.ts` already uses the SDK
- Use this as a reference for patterns and error handling
- The `getClaimsBotClient()` singleton pattern is proven and tested

### Future Considerations

- Other claim types may be migrated to SDK in future
- The `src/services/ixo/ixo-claims.ts` file remains for any claims that still need direct blockchain submission
- Consider consolidating all SDK claim submissions into `src/services/claims-bot.ts` in future refactoring
