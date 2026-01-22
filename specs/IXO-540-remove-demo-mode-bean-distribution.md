# Chore: Remove DEMO MODE from Bean Distribution Flow

## Linear Issue

- **Issue ID**: IXO-540
- **Issue URL**: https://linear.app/ixo-world/issue/IXO-540

## Chore Description

The bean distribution workflow in `agentToolsMachine.ts` currently operates in **DEMO MODE**, bypassing actual blockchain transactions and hardcoding values. This chore removes all DEMO MODE bypasses and implements real blockchain integration for:

1. **`submitBeanClaimIntentService`** - Currently returns hardcoded `DEMO_INTENT_{timestamp}` instead of calling `submitClaimIntent()` to create a real `MsgClaimIntent` on blockchain
2. **`submitBeanClaimService`** - Currently returns hardcoded `DEMO-CLAIM-{timestamp}` instead of calling `submitClaim()` to create a real `MsgSubmitClaim` on blockchain
3. **`checkVoucherService`** - Currently hardcoded to `hasBeanVoucher = true` instead of querying the subscriptions service
4. **`getCustomerCollectionId`** - Currently hardcoded to return `"632"` instead of querying the Claims Bot Database

### Current DEMO MODE Bypasses

| Component | Current Behavior | Required Behavior |
|-----------|-----------------|-------------------|
| `submitClaimIntent` import | Commented out | Uncomment and use |
| `submitClaim` import | Commented out | Uncomment and use |
| `CHAIN_RPC_URL` import | Commented out | Uncomment and use |
| `submitBeanClaimIntentService` | Returns `DEMO_INTENT_{timestamp}` | Call `submitClaimIntent()` with LG wallet |
| `submitBeanClaimService` | Returns `DEMO-CLAIM-{timestamp}` | Call `submitClaim()` with `useIntent=true` |
| `checkVoucherService` | Returns `hasBeanVoucher = true` | Query subscriptions service API |
| `getCustomerCollectionId()` | Returns hardcoded `"632"` | Query Claims Bot DB for customer's collection |

## Relevant Files

Use these files to resolve the chore:

- `src/machines/supamoto/agent-tools/agentToolsMachine.ts` - **Primary file to modify**. Contains all DEMO MODE bypasses in actor services. Need to uncomment blockchain imports and implement real calls.

- `src/services/ixo/ixo-claims.ts` - Contains fully implemented `submitClaimIntent()` and `submitClaim()` functions. Already production-ready, just not being called.

- `src/services/claims-bot-api-client.ts` - Contains `getCustomerCollectionId()` which is hardcoded. Need to implement real database query using Claims Bot DB client.

- `src/services/claims-bot-db-client.ts` - Provides database client for Claims Bot DB. The SDK needs to expose subscriptions/customer_subscriptions tables.

- `src/constants/ixo-blockchain.ts` - Contains `CHAIN_RPC_URL` constant needed for blockchain calls.

- `src/config.ts` - Contains `BEAN_DISTRIBUTION.COLLECTION_ID` fallback and other config values.

- `tests/services/ixo/ixo-claims.test.ts` - Existing tests for ixo-claims. Need to add tests for `submitClaimIntent`.

### New Files

- `src/services/subscriptions-service-client.ts` - New service to query the subscriptions service API for voucher eligibility checks.

## Step by Step Tasks

IMPORTANT: Execute every step in order, top to bottom.

### 1. Verify SDK supports required database tables

- Check if `@ixo/supamoto-bot-sdk` exposes `subscriptions` and `customer_subscriptions` tables in the database client
- If not available, coordinate with SDK team or use fallback collection ID from config
- Document any SDK limitations that prevent full implementation

### 2. Implement `getCustomerCollectionId()` in claims-bot-api-client.ts

- Remove hardcoded `return "632"` value
- Uncomment the database query logic that looks up customer's collection ID
- If SDK doesn't support the required tables, use `config.BEAN_DISTRIBUTION.COLLECTION_ID` as fallback with a warning log
- Add proper error handling for database query failures

### 3. Create subscriptions service client for voucher checks

- Create new file `src/services/subscriptions-service-client.ts`
- Implement `checkBeanVoucherEligibility(customerId: string): Promise<boolean>` function
- Use `config.SUBSCRIPTIONS.API_BASE_URL` for the API endpoint
- Handle API errors gracefully with fallback behavior
- Add proper logging for voucher check results

### 4. Update `checkVoucherService` in agentToolsMachine.ts

- Remove hardcoded `hasBeanVoucher = true`
- Import and call the new `checkBeanVoucherEligibility()` function
- Handle API errors - consider whether to fail closed (deny) or fail open (allow) based on business requirements
- Maintain proper logging for audit trail

### 5. Implement real blockchain calls in `submitBeanClaimIntentService`

- Uncomment the blockchain imports at top of file:
  - `import { CHAIN_RPC_URL } from "../../../constants/ixo-blockchain.js";`
  - `import { submitClaimIntent } from "../../../services/ixo/ixo-claims.js";`
- Remove the hardcoded `DEMO_INTENT_{timestamp}` logic
- Call `submitClaimIntent()` with:
  - `mnemonic`: LG's mnemonic from Claims Bot DB (already retrieved)
  - `chainRpcUrl`: `CHAIN_RPC_URL`
  - `intent`: `{ collectionId, agentDid: lgDid, agentAddress: lgAddress }`
- Extract `claimIntentId` from the transaction response
- Handle blockchain errors with proper user-facing messages

### 6. Implement real blockchain calls in `submitBeanClaimService`

- Import `submitClaim` from `../../../services/ixo/ixo-claims.js`
- Remove the hardcoded `DEMO-CLAIM-{timestamp}` logic
- Call `submitClaim()` with:
  - `mnemonic`: LG's mnemonic from Claims Bot DB
  - `chainRpcUrl`: `CHAIN_RPC_URL`
  - `claim`: `{ collectionId, agentDid: lgDid, agentAddress: lgAddress, useIntent: true }`
- Extract `claimId` and transaction hash from response
- Handle blockchain errors with proper user-facing messages

### 7. Add tests for new functionality

- Add unit test for `submitClaimIntent` in `tests/services/ixo/ixo-claims.test.ts`
- Add unit test for `checkBeanVoucherEligibility` in new test file
- Add unit test for `getCustomerCollectionId` with real database query (mocked)
- Update agentToolsMachine tests to mock blockchain calls

### 8. Update documentation

- Update `docs/supamoto/SEQUENCE_DIAGRAM.md` to mark bean distribution as fully implemented
- Remove "DEMO MODE" references from implementation status sections
- Update any TODO comments to reflect completed work

### 9. Run validation commands

- Execute all validation commands to ensure zero regressions

## Validation Commands

Execute every command to validate the chore is complete with zero regressions.

- `pnpm install && pnpm format && pnpm lint && pnpm tsc --noEmit && pnpm validate:machines && pnpm build` - Run linting, type checking, and build.
- `pnpm test` - Run all unit tests.
- `pnpm test:flows:run` - Run all flow tests against a running server (start `pnpm dev` first in another terminal).
- `pnpm test:integration:flows` - Run the new integration test runner that starts/stops the server automatically.

## Notes

- **SDK Dependency**: The `@ixo/supamoto-bot-sdk` may not yet expose the `subscriptions` and `customer_subscriptions` tables. Check SDK version and coordinate with SDK team if needed. Use config fallback if tables are unavailable.

- **AuthZ Permissions**: The comments mention "blockchain AuthZ issues". Ensure the Lead Generator has proper authorization (via `MsgGrant`) to submit claims on behalf of customers. This may require a separate setup step or admin action.

- **Fail-Safe Behavior**: For voucher checks, decide whether to fail closed (deny beans if service unavailable) or fail open (allow beans). Recommend fail closed for security.

- **Transaction Fees**: Blockchain transactions require gas fees. Ensure LG accounts have sufficient `uixo` balance or configure a feegranter address.

- **No new libraries required**: All blockchain functionality already exists in `@ixo/impactxclient-sdk` and `src/services/ixo/ixo-claims.ts`.

- **Environment Variables**: Ensure these are configured:
  - `CHAIN_NETWORK` (defaults to "devnet")
  - `SUBSCRIPTIONS_API_BASE_URL` (for voucher checks)
  - `CLAIMS_BOT_DB_*` (for database access)
  - `CLAIMS_BOT_DB_ENCRYPTION_KEY` (for decrypting mnemonics)

