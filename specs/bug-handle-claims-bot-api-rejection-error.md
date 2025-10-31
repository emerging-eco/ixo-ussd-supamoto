# Bug: Handle Claims Bot API Rejection Error

## Bug Description

During the customer creation process, an HTTP POST request is made to the claims bot API to submit a lead creation claim. When this API call fails with a 403 Forbidden error (or any other HTTP error), the server crashes due to an unhandled promise rejection.

**Symptoms**:

- Server crashes with "Unhandled rejection error" message
- Error: "You are not authorized to access this resource."
- Error code: 403, errcode: 'IXO_FORBIDDEN'
- Customer creation completes successfully in the database
- IXO account and Matrix vault are created
- But the server process terminates unexpectedly

**Expected Behavior**:

- Server should remain running even when claims bot API fails
- Customer creation should succeed regardless of claims submission status
- Failed claims should be logged and queued for retry
- Error should be properly handled and logged with sufficient context

**Actual Behavior**:

- Server crashes and exits with code 1
- Unhandled promise rejection propagates to Node.js process
- Development workflow is interrupted (requires manual restart)

## Problem Statement

The `createIxoAccountBackground()` function is called as a fire-and-forget async operation during customer account creation. While it has a `.catch()` handler that logs errors to console, the claims bot API call inside this function throws an error that escapes the error handling and becomes an unhandled promise rejection, causing the Node.js process to crash.

The root issue is that the error from the `@ixo/supamoto-bot-sdk` is not being properly caught and handled, despite having try-catch blocks in place. This violates the non-critical nature of claims submission and breaks the customer creation flow.

## Solution Statement

Implement comprehensive error handling for claims bot API failures with the following components:

1. **Prevent Server Crash**: Ensure all promise rejections are properly caught in the background process
2. **Dedicated Logging**: Create a specialized log file (`claims-submission-failures.log`) for tracking failed claims
3. **Retry Queue**: Store failed claims in a database table (`failed_claims_queue`) for automatic retry
4. **Audit Trail**: Log all failures to the `audit_log` table for monitoring
5. **Graceful Degradation**: Ensure customer creation succeeds even when claims submission fails

This approach follows existing patterns in the codebase (SMS retry logic, IXO creation failure logging) and ensures the system is resilient to external API failures.

## Steps to Reproduce

1. Set invalid Matrix access token in `.env`:

   ```bash
   CLAIMS_BOT_ACCESS_TOKEN=syt_ZGlkLWl4by1peG8xamdwd2thbW5kMDltdTZnZXRhYXNzbWtrdWVuNmc5bXNudGw5bHE_bwIZqpLXzAePbfhvFGQH_18Tguo
   ```

2. Start the server:

   ```bash
   pnpm dev
   ```

3. Create a new customer account via USSD:

   ```bash
   pnpm test:interactive
   # Dial *2233#
   # Select: 2 (Account Menu)
   # Select: 2 (Create Account)
   # Enter phone number, name, national ID, PIN
   ```

4. Observe the server logs:
   - Customer creation succeeds
   - IXO account creation starts in background
   - Matrix vault created successfully
   - Claims bot API call fails with 403 Forbidden
   - Server crashes with "Unhandled rejection error"

5. Alternative reproduction using curl:
   ```bash
   curl -X POST https://supamoto.claims.bot.devmx.ixo.earth/action \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer syt_ZGlkLWl4by1peG8xamdwd2thbW5kMDltdTZnZXRhYXNzbWtrdWVuNmc5bXNudGw5bHE_bwIZqpLXzAePbfhvFGQH_18Tguo" \
     -d '{
       "action": "submit-lead-creation-claim",
       "flags": {
         "customerId": "C142316B7",
         "nationalId": "123456/10/1",
         "leadGenerator": "USSD Signup",
         "givenName": "Test",
         "familyName": "User",
         "telephone": "+260971230001"
       }
     }'
   ```

## Root Cause Analysis

The bug has multiple contributing factors:

1. **Promise Chain Escape**: The error from `claimsBot.claims.v1.submitLeadCreationClaim()` is caught in the try-catch block (lines 98-148 in `background-ixo-creation.ts`), but the SDK's error object may contain a thenable or promise that escapes the synchronous catch handler.

2. **Fire-and-Forget Pattern**: The background process is called with `.catch()` in `accountCreationMachine.ts` (line 134-141), but this only logs to console and doesn't prevent the error from propagating to the global unhandled rejection handler.

3. **Global Error Handler**: The `server.ts` file has a global unhandled rejection handler (line 319-321) that calls `process.exit(1)`, which is correct for truly unhandled errors but shouldn't be triggered by non-critical background operations.

4. **SDK Error Format**: The `@ixo/supamoto-bot-sdk` throws a custom `throwResponseError` object that may not be properly handled by standard JavaScript error catching mechanisms.

5. **Missing Top-Level Protection**: The background process doesn't have a final safety net to catch all possible error propagation paths.

**Key Evidence from Logs**:

```
{\"level\":40,\"time\":1761887958402,\"service\":\"ixo-ussd-server\",\"version\":\"0.1.0\",\"module\":\"background-ixo\",\"error\":\"\\[object Promise\\]\",\"customerId\":\"C10DC4567\",\"msg\":\"Lead creation claim submission failed (non-critical)\"}
```

The error is logged as `"[object Promise]"` which indicates the error object itself may be a promise or thenable, explaining why it escapes the try-catch.

## Relevant Files

Use these files to fix the bug:

- **`src/services/ixo/background-ixo-creation.ts`** - Contains the `createIxoAccountBackground()` function and claims submission logic. This is where the unhandled rejection originates. Need to add comprehensive error handling, file logging, and queue insertion.

- **`src/machines/supamoto/account-creation/accountCreationMachine.ts`** - Calls the background process with fire-and-forget pattern. Need to ensure the catch handler is robust.

- **`src/server.ts`** - Contains global unhandled rejection handler. May need adjustment to better handle background process errors (though the real fix should prevent errors from reaching here).

- **`src/services/database-storage.ts`** - Contains `createAuditLog()` function and database operations. Need to add functions for managing the failed claims queue.

- **`src/db/index.ts`** - TypeScript database schema definitions. Need to add interface for `failed_claims_queue` table.

- **`src/config.ts`** - Configuration management. May need to add retry configuration constants.

- **`migrations/postgres/000-init-all.sql`** - Database schema initialization. Need to add `failed_claims_queue` table.

- **`tests/services/ixo/background-ixo-creation.test.ts`** - Tests for background IXO creation. Need to add tests for error handling scenarios.

### New Files

- **`logs/claims-submission-failures.log`** - Will be created automatically by the logging function to track all failed claims submissions.

- **`src/services/claims-retry-queue.ts`** - New service for managing the failed claims retry queue (optional, can be added in future iteration).

## Step by Step Tasks

### 1. Add Failed Claims Queue Database Table

- Open `migrations/postgres/000-init-all.sql`
- Add new table definition after the `household_claims` table (around line 240)
- Create table `failed_claims_queue` with columns:
  - `id` SERIAL PRIMARY KEY
  - `claim_type` VARCHAR(50) NOT NULL (values: 'lead_creation', '1000_day_household')
  - `customer_id` VARCHAR(10) NOT NULL
  - `claim_data` JSONB NOT NULL (stores full claim payload for retry)
  - `error_message` TEXT
  - `http_status_code` INTEGER
  - `retry_count` INTEGER DEFAULT 0
  - `max_retries` INTEGER DEFAULT 3
  - `next_retry_at` TIMESTAMP
  - `last_attempted_at` TIMESTAMP
  - `created_at` TIMESTAMP NOT NULL DEFAULT NOW()
  - `resolved_at` TIMESTAMP NULL
  - `status` VARCHAR(20) DEFAULT 'pending' (values: 'pending', 'retrying', 'failed', 'resolved')
- Add indexes for performance:
  - `idx_failed_claims_status` on `status`
  - `idx_failed_claims_next_retry` on `next_retry_at` WHERE status = 'pending'
  - `idx_failed_claims_customer` on `customer_id`
- Add table comment explaining the retry queue purpose

### 2. Update TypeScript Database Schema

- Open `src/db/index.ts`
- Add interface definition for `failed_claims_queue` table in the `Database` interface
- Include all columns with proper TypeScript types
- Follow existing patterns for nullable fields and optional id

### 3. Add Database Functions for Failed Claims Queue

- Open `src/services/database-storage.ts`
- Add function `insertFailedClaim()` to insert a new failed claim into the queue
  - Parameters: claimType, customerId, claimData, errorMessage, httpStatusCode
  - Calculate `next_retry_at` as NOW() + 5 minutes for first retry
  - Return the created record
- Add function `getFailedClaimsForRetry()` to query pending claims ready for retry
  - Query where `status = 'pending'` AND `next_retry_at <= NOW()`
  - Order by `created_at` ASC
  - Limit to configurable batch size (default 10)
- Add function `updateFailedClaimRetry()` to update retry attempt
  - Increment `retry_count`
  - Update `last_attempted_at`
  - Calculate exponential backoff for `next_retry_at` (5min, 30min, 2hr)
  - Update `status` to 'failed' if `retry_count >= max_retries`
- Add function `markFailedClaimResolved()` to mark claim as successfully retried
  - Set `status = 'resolved'`
  - Set `resolved_at = NOW()`

### 4. Add Claims Failure Logging Function

- Open `src/services/ixo/background-ixo-creation.ts`
- Add new function `logClaimsSubmissionFailure()` after `logIxoCreationFailure()` (around line 359)
- Follow same pattern as `logIxoCreationFailure()`:
  - Create `./logs` directory if it doesn't exist
  - Append to `./logs/claims-submission-failures.log`
  - Log entry should include: timestamp, customerId, claimType, error, httpStatusCode, retryCount
  - Use JSON.stringify() for structured logging
  - Handle logging errors gracefully with try-catch

### 5. Enhance Error Handling in Background IXO Creation

- Open `src/services/ixo/background-ixo-creation.ts`
- Wrap the claims submission try-catch block (lines 98-148) with additional safety:
  - Convert error to plain object immediately to prevent promise escape
  - Extract HTTP status code from error response if available
  - Call `logClaimsSubmissionFailure()` with full error details
  - Call `dataService.insertFailedClaim()` to queue for retry
  - Call `dataService.createAuditLog()` with event type 'CLAIMS_SUBMISSION_FAILED'
  - Ensure no error is re-thrown or allowed to propagate
- Add defensive error handling around the entire function body:
  - Wrap the main try block content in an additional Promise.resolve().then().catch()
  - This ensures even thenable errors are caught
- Update error logging to properly serialize error objects (avoid "[object Promise]")

### 6. Add Comprehensive Error Handling to Fire-and-Forget Call

- Open `src/machines/supamoto/account-creation/accountCreationMachine.ts`
- Update the `.catch()` handler (lines 134-141) to be more robust:
  - Add try-catch inside the catch handler itself
  - Log full error details including stack trace
  - Ensure the catch handler never throws
  - Add comment explaining this is a safety net for background process

### 7. Add Configuration for Retry Logic

- Open `src/config.ts`
- Add new configuration section `CLAIMS_RETRY` after `CLAIMS_BOT` (around line 246):
  - `MAX_RETRIES`: parseInt(process.env.CLAIMS_MAX_RETRIES || "3", 10)
  - `RETRY_DELAYS_MINUTES`: [5, 30, 120] // 5min, 30min, 2hr
  - `BATCH_SIZE`: parseInt(process.env.CLAIMS_RETRY_BATCH_SIZE || "10", 10)
- Export the configuration for use in retry logic

### 8. Add Tests for Error Handling

- Create new test file `tests/services/ixo/background-ixo-creation.test.ts`
- Add test suite "Background IXO Creation Error Handling"
- Test case: "should handle 403 Forbidden error from claims bot"
  - Mock `claimsBot.claims.v1.submitLeadCreationClaim()` to reject with 403 error
  - Call `createIxoAccountBackground()`
  - Assert function returns success (customer creation succeeds)
  - Assert error is logged to file
  - Assert failed claim is inserted into queue
  - Assert audit log entry is created
- Test case: "should handle network timeout error"
  - Mock SDK to reject with timeout error
  - Verify graceful handling
- Test case: "should handle malformed error objects"
  - Mock SDK to reject with non-standard error (thenable, promise, etc.)
  - Verify error is properly serialized and logged
- Test case: "should not crash on logging failures"
  - Mock file system to throw error
  - Verify background process still completes

### 9. Add Integration Test for Customer Creation with Failed Claims

- Open or create `tests/flows/create-customer-with-failed-claims.test.ts`
- Test full customer creation flow with mocked claims bot failure
- Verify:
  - Customer record created in database
  - IXO account created
  - Matrix vault created
  - Failed claim logged to file
  - Failed claim queued in database
  - Audit log entry created
  - Server remains running (no unhandled rejection)

### 10. Update Documentation

- Open `docs/supamoto/README.md`
- Add section under "Error Handling" explaining claims submission failure handling
- Document the retry queue mechanism
- Document the log file location and format
- Add troubleshooting guide for claims submission failures

### 11. Run Database Migration

- Ensure PostgreSQL is running
- Run migration to create new table:
  ```bash
  pnpm build && node dist/src/migrations/run-migrations.js
  ```
- Verify table was created:
  ```bash
  psql -d ixo-ussd-dev -c "\d failed_claims_queue"
  ```

### 12. Manual Testing with Invalid Token

- Set invalid token in `.env`:
  ```bash
  CLAIMS_BOT_ACCESS_TOKEN=syt_ZGlkLWl4by1peG8xamdwd2thbW5kMDltdTZnZXRhYXNzbWtrdWVuNmc5bXNudGw5bHE_bwIZqpLXzAePbfhvFGQH_18Tguo
  ```
- Start server: `pnpm dev`
- Create customer via interactive test: `pnpm test:interactive`
- Verify:
  - Server does NOT crash
  - Customer creation succeeds
  - Error logged to `./logs/claims-submission-failures.log`
  - Failed claim in `failed_claims_queue` table
  - Audit log entry created
- Check log file:
  ```bash
  cat logs/claims-submission-failures.log
  ```
- Check database:
  ```bash
  psql -d ixo-ussd-dev -c "SELECT * FROM failed_claims_queue ORDER BY created_at DESC LIMIT 5;"
  ```

### 13. Run Validation Commands

- Execute all validation commands to ensure zero regressions
- Verify all tests pass
- Verify TypeScript compilation succeeds
- Verify linting passes
- Verify build succeeds

## Validation Commands

Execute every command to validate the bug is fixed with zero regressions.

- `pnpm install` - Install dependencies
- `pnpm format` - Format code
- `pnpm lint` - Lint code
- `pnpm tsc --noEmit` - Type check
- `pnpm build` - Build project
- `node dist/src/migrations/run-migrations.js` - Run database migrations
- `pnpm validate:machines` - Validate state machines
- `pnpm test` - Run all tests
- `pnpm test tests/services/ixo/background-ixo-creation.test.ts` - Run specific error handling tests
- `pnpm test tests/flows/create-customer-with-failed-claims.test.ts` - Run integration test
- Manual test: `pnpm test:interactive` with invalid token - Verify server doesn't crash
- Database verification: `psql -d ixo-ussd-dev -c "SELECT COUNT(*) FROM failed_claims_queue;"` - Verify table exists
- Log file verification: `ls -la logs/claims-submission-failures.log` - Verify log file is created

## Notes

- **Non-Breaking Change**: This fix ensures customer creation always succeeds, maintaining backward compatibility
- **Retry Queue**: The retry queue table is created but the actual retry worker/cron job can be implemented in a future iteration
- **Monitoring**: The log file provides immediate visibility into claims failures for debugging
- **Audit Trail**: All failures are tracked in audit_log for compliance and monitoring
- **Existing Patterns**: Solution follows existing patterns in the codebase (SMS retry, IXO creation logging)
- **Testing Strategy**: Comprehensive tests ensure the fix works and prevents regressions
- **Invalid Token**: Use `syt_ZGlkLWl4by1peG8xamdwd2thbW5kMDltdTZnZXRhYXNzbWtrdWVuNmc5bXNudGw5bHE_bwIZqpLXzAePbfhvFGQH_18Tguo` for testing
- **Future Enhancement**: Consider implementing a background worker to process the retry queue automatically
- **Error Serialization**: Special attention paid to properly serializing SDK errors to prevent "[object Promise]" logging
- **Graceful Degradation**: System remains fully functional even when external claims bot API is unavailable
