# Customer Activation Machine

This machine implements the customer activation and eligibility verification flow for the bean distribution program, as described in the sequence diagram at `docs/Sequence-Diagram-Bean-Distribution-with-systems.md` (lines 25-37).

## Overview

The customer activation flow involves two separate USSD sessions:

1. **Lead Generator Session**: Lead Generator verifies customer at distribution point
2. **Customer Session**: Customer activates their account and answers eligibility question

## Flow Diagram

```
Lead Generator Flow:
verifyCustomer → enterPhone → sendingActivationSMS → waitingForCustomer → complete

Customer Flow:
customerEnterPin → verifyingPin → activationSuccess → eligibilityQuestion
  ├─ Yes (Eligible) → recordingEligible → submittingClaim → sendingConfirmation → complete
  └─ No (Not Eligible) → recordingNotEligible → complete
```

## States

### Lead Generator States

- **verifyCustomer**: Lead Generator enters customer ID
- **enterPhone**: Lead Generator enters customer's phone number
- **sendingActivationSMS**: System generates temp PIN and sends SMS to customer
- **waitingForCustomer**: Display confirmation to Lead Generator

### Customer States

- **customerEnterPin**: Customer enters temporary PIN from SMS
- **verifyingPin**: System verifies the temporary PIN
- **activationSuccess**: Display activation success message
- **eligibilityQuestion**: Ask if customer is part of 1,000-day household
- **recordingNotEligible**: Record "No" response (audit trail)
- **recordingEligible**: Record "Yes" response
- **submittingClaim**: Submit claim to IXO blockchain (stubbed)
- **sendingConfirmation**: Send SMS confirmation and transfer tokens (stubbed)

## Database Tables

The machine uses three database tables:

1. **temp_pins**: Stores temporary PINs for activation (expires in 30 minutes)
2. **eligibility_verifications**: Audit trail of all eligibility responses
3. **distribution_otps**: OTPs for bean distribution confirmation (expires in 10 minutes)

## SMS Integration

The machine sends SMS messages via Africa's Talking:

- **Activation SMS**: Contains temporary PIN for customer activation
- **Confirmation SMS**: Sent when customer is eligible for beans

SMS can be stubbed for development by setting `SMS_ENABLED=false` in `.env`.

## Stubbed Integrations

The following integrations are stubbed for now:

1. **Claim Submission**: Would submit to `ixo-matrix-supamoto-claims-bot`
   - Requires customer's IXO DID and mnemonic
   - Requires collection ID for 1,000-day household claims
   - Currently logs a warning and creates a stub claim ID

2. **Token Transfer**: Would transfer BEAN tokens via `subscriptions-service-supamoto`
   - Requires API integration with subscriptions service
   - Currently logs a warning

## Usage

### Running the Demo

```bash
pnpm tsx src/machines/supamoto/activation/customerActivationMachine-demo.ts
```

### Running Tests

```bash
pnpm test src/machines/supamoto/activation/customerActivationMachine.test.ts
```

### Integration with Parent Machine

To integrate this machine into the user services menu:

```typescript
import { customerActivationMachine } from "./activation/customerActivationMachine.js";

// In user services machine, add to agent tools menu:
{
  target: "customerActivation",
  guard: "isInput1", // Or appropriate input
}

// Add as child machine:
customerActivation: {
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
      target: "menu",
    },
  },
}
```

## Environment Variables

Required in `.env`:

```bash
# SMS Configuration
SMS_ENABLED=false  # Set to true when you have AT credentials
AFRICASTALKING_API_KEY=your_api_key
AFRICASTALKING_USERNAME=sandbox
AFRICASTALKING_SENDER_ID=SUPAMOTO
```

## Future Enhancements

1. **Implement Claim Submission**
   - Retrieve customer's IXO DID and mnemonic from database
   - Decrypt mnemonic using customer's PIN
   - Submit actual claim to IXO blockchain
   - Update eligibility record with real claim ID

2. **Implement Token Transfer**
   - Integrate with `subscriptions-service-supamoto` API
   - Transfer BEAN tokens to customer's subscription
   - Handle transfer errors and retries

3. **Add OTP Verification**
   - Implement distribution OTP flow (lines 54-60 in sequence diagram)
   - Lead Generator verifies customer with OTP before bean delivery

4. **Add Retry Logic**
   - Handle SMS send failures with retries
   - Handle claim submission failures
   - Add exponential backoff for external service calls

## Testing Scenarios

### Scenario 1: Successful Activation (Eligible)

1. LG enters: `C12345678`
2. LG enters: `+260971234567`
3. System sends SMS (stubbed)
4. Customer enters: `123456` (any 6 digits in demo)
5. Customer selects: `1` (Yes, eligible)
6. System submits claim (stubbed)
7. System sends confirmation SMS (stubbed)

### Scenario 2: Successful Activation (Not Eligible)

1. LG enters: `C12345678`
2. LG enters: `+260971234567`
3. System sends SMS (stubbed)
4. Customer enters: `123456`
5. Customer selects: `2` (No, not eligible)
6. System records response for audit

### Scenario 3: Invalid PIN

1. LG enters: `C12345678`
2. LG enters: `+260971234567`
3. Customer enters: `12345` (5 digits - invalid)
4. System shows error, prompts again

## Architecture Notes

- Follows XState v5 patterns
- Uses navigation mixin for consistent back/exit handling
- Uses fromPromise actors for async operations
- Implements proper error handling and validation
- Maintains audit trail for compliance
