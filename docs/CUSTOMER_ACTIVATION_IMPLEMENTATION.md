# Customer Activation and Eligibility Verification - Implementation Guide

This document describes the implementation of the Customer Activation and Eligibility Verification feature for the bean distribution program.

## Overview

This feature implements the sequence described in `docs/Sequence-Diagram-Bean-Distribution-with-systems.md` (lines 25-37), enabling:

1. Lead Generators to verify customers at distribution points
2. Customers to activate their USSD accounts via temporary PIN
3. Customers to declare eligibility for the 1,000-day household program
4. System to submit claims and transfer BEAN tokens to eligible customers

## Implementation Status

### ✅ Completed

1. **Database Schema** (`migrations/postgres/002-activation-eligibility.sql`)
   - `temp_pins` table for temporary activation PINs
   - `eligibility_verifications` table for audit trail
   - `distribution_otps` table for bean distribution confirmation

2. **SMS Service** (`src/services/sms.ts`)
   - Africa's Talking integration
   - Stub mode for development without credentials
   - Helper functions for activation, confirmation, and OTP SMS

3. **Database Service Extensions** (`src/services/database-storage.ts`)
   - `setTempPin()` - Store temporary activation PIN (30-minute expiry)
   - `verifyTempPin()` - Verify and consume temp PIN
   - `recordEligibility()` - Record eligibility verification
   - `updateEligibilityWithClaim()` - Update with claim information
   - `generateDistributionOTP()` - Generate OTP (10-minute expiry)
   - `verifyDistributionOTP()` - Verify distribution OTP

4. **State Machine** (`src/machines/supamoto/activation/customerActivationMachine.ts`)
   - Complete XState v5 implementation
   - Lead Generator flow (verify customer, send activation SMS)
   - Customer flow (activate account, answer eligibility question)
   - Error handling and validation

5. **Configuration** (`src/config.ts`, `env.example`)
   - SMS configuration section
   - Feature flags for development

6. **Testing** (`src/machines/supamoto/activation/customerActivationMachine.test.ts`)
   - Unit tests for validation logic
   - State transition tests

7. **Demo** (`src/machines/supamoto/activation/customerActivationMachine-demo.ts`)
   - Interactive demo for testing the flow
   - Run with: `pnpm demo:activation`

### ⚠️ Stubbed (Requires Future Implementation)

1. **Claim Submission** (in `customerActivationMachine.ts`)
   - Currently logs a warning and creates stub claim ID
   - **TODO**: Implement actual claim submission to `ixo-matrix-supamoto-claims-bot`
   - **Requirements**:
     - Retrieve customer's IXO DID and address from database
     - Decrypt customer's mnemonic using PIN
     - Get collection ID for 1,000-day household claims
     - Call `submitClaim()` with actual parameters

2. **Token Transfer** (in `customerActivationMachine.ts`)
   - Currently logs a warning
   - **TODO**: Integrate with `subscriptions-service-supamoto` API
   - **Requirements**:
     - API endpoint for token transfer
     - Customer's subscription ID
     - BEAN token transfer logic

3. **Integration with User Services Menu**
   - **TODO**: Add "Verify Customer" option to Agent Tools menu
   - **TODO**: Wire up the activation machine as a child machine

## File Structure

```
migrations/postgres/
  └── 002-activation-eligibility.sql          # Database schema

src/services/
  ├── sms.ts                                  # SMS service (new)
  └── database-storage.ts                     # Extended with activation methods

src/machines/supamoto/activation/
  ├── customerActivationMachine.ts            # Main state machine
  ├── customerActivationMachine.test.ts       # Unit tests
  ├── customerActivationMachine-demo.ts       # Interactive demo
  ├── index.ts                                # Module exports
  └── README.md                               # Module documentation

src/config.ts                                 # Updated with SMS config
env.example                                   # Updated with SMS env vars
docs/CUSTOMER_ACTIVATION_IMPLEMENTATION.md    # This file
```

## Environment Variables

Add to your `.env` file:

```bash
# SMS Configuration (Africa's Talking)
SMS_ENABLED=false                              # Set to true when you have credentials
AFRICASTALKING_API_KEY=your_api_key_here
AFRICASTALKING_USERNAME=sandbox
AFRICASTALKING_SENDER_ID=SUPAMOTO
```

## Database Migration

Run the migration to create the required tables:

```bash
pnpm build
node dist/src/migrations/run-migrations.js
```

Or if using the migration runner directly:

```bash
psql -U your_user -d your_database -f migrations/postgres/002-activation-eligibility.sql
```

## Testing

### Run Unit Tests

```bash
pnpm test src/machines/supamoto/activation/customerActivationMachine.test.ts
```

### Run Interactive Demo

```bash
pnpm demo:activation
```

Follow the prompts to test the flow:

1. Enter Customer ID: `C12345678`
2. Enter Phone: `+260971234567`
3. System sends SMS (stubbed in demo mode)
4. Enter any 6-digit PIN (e.g., `123456`)
5. Answer eligibility: `1` for Yes, `2` for No

## Integration Steps

### Step 1: Add to User Services Menu

In `src/machines/supamoto/user-services/userServicesMachine.ts`:

```typescript
import { customerActivationMachine } from "../activation/customerActivationMachine.js";

// Add to agent tools menu
const agentToolsMessage =
  "Agent Tools\n" +
  "1. Verify Customer\n" +  // New option
  "0. Back";

// Add state
states: {
  // ... existing states ...

  verifyCustomer: {
    invoke: {
      id: "customerActivation",
      src: customerActivationMachine,
      input: ({ context }) => ({
        sessionId: context.sessionId,
        phoneNumber: context.phoneNumber,
        serviceCode: context.serviceCode,
        isLeadGenerator: true,
      }),
      onDone: {
        target: "agentTools",
      },
    },
  },
}
```

### Step 2: Configure SMS (Production)

When ready to use real SMS:

1. Sign up for Africa's Talking account
2. Get API key and username
3. Update `.env`:
   ```bash
   SMS_ENABLED=true
   AFRICASTALKING_API_KEY=your_real_api_key
   AFRICASTALKING_USERNAME=your_username
   AFRICASTALKING_SENDER_ID=SUPAMOTO
   ```

### Step 3: Implement Claim Submission

In `customerActivationMachine.ts`, update `submitClaimService`:

```typescript
const submitClaimService = fromPromise(async ({ input }) => {
  // 1. Get customer's IXO profile from database
  const customer = await dataService.getCustomerByCustomerId(input.customerId);
  const ixoProfile = await dataService.getIxoProfileByCustomerId(customer.id);

  // 2. Decrypt mnemonic (requires customer's PIN)
  const mnemonic = decrypt(ixoProfile.encryptedMnemonic, customerPin);

  // 3. Submit claim
  const result = await submitClaim({
    mnemonic,
    chainRpcUrl: config.IXO.BLOCKCHAIN_URL,
    claim: {
      collectionId: process.env.IXO_1000DAY_COLLECTION_ID,
      agentDid: ixoProfile.did,
      agentAddress: ixoProfile.address,
    },
  });

  // 4. Update eligibility record
  await dataService.updateEligibilityWithClaim(
    input.eligibilityRecordId,
    result.transactionHash,
    "submitted"
  );

  return { claimId: result.transactionHash };
});
```

### Step 4: Implement Token Transfer

In `customerActivationMachine.ts`, update `sendConfirmationService`:

```typescript
const sendConfirmationService = fromPromise(async ({ input }) => {
  // 1. Send SMS
  await sendEligibilityConfirmationSMS(input.phoneNumber);

  // 2. Transfer BEAN token
  const response = await axios.post(
    `${config.SUBSCRIPTIONS_SERVICE_URL}/transfer`,
    {
      customerId: input.customerId,
      did: input.did,
      subscriptionId: input.subscriptionId,
      tokenType: "BEAN",
      amount: 1,
    }
  );

  return { sent: true, transferId: response.data.transferId };
});
```

## Security Considerations

1. **PIN Expiry**: Temporary PINs expire after 30 minutes
2. **OTP Expiry**: Distribution OTPs expire after 10 minutes
3. **One-Time Use**: PINs and OTPs are marked as used after verification
4. **Audit Trail**: All eligibility responses (Yes and No) are stored
5. **Upsert Pattern**: Temp PIN generation uses upsert to handle retries safely

## Monitoring and Logging

All operations are logged with the `customerActivation` logger:

- PIN generation and verification
- SMS sending (success/failure)
- Eligibility recording
- Claim submission
- Token transfer

Check logs for:

```
[customerActivation] Generating and sending activation PIN
[customerActivation] Verifying temporary PIN
[customerActivation] Recording eligibility verification
[customerActivation] STUB: Would submit claim to ixo-matrix-supamoto-claims-bot
```

## Next Steps

1. **Test the flow** using the interactive demo
2. **Run database migration** to create tables
3. **Configure SMS** (or use stub mode for development)
4. **Integrate with user services menu** to make it accessible
5. **Implement claim submission** when IXO integration is ready
6. **Implement token transfer** when subscriptions service is ready
7. **Add distribution OTP flow** (lines 54-60 in sequence diagram)

## Support

For questions or issues:

- Check the machine README: `src/machines/supamoto/activation/README.md`
- Review the sequence diagram: `docs/Sequence-Diagram-Bean-Distribution-with-systems.md`
- Run the demo: `pnpm demo:activation`
- Check logs for detailed error messages
