# Customer Activation - Quick Start Guide

Get the customer activation feature up and running in 5 minutes.

## Prerequisites

- Node.js 20+
- PostgreSQL database
- pnpm installed

## Step 1: Install Dependencies (Already Done)

The `africastalking` package is already installed. No additional dependencies needed.

## Step 2: Run Database Migration

```bash
# Build the project
pnpm build

# Run migrations
node dist/src/migrations/run-migrations.js
```

This creates three new tables:

- `temp_pins` - Temporary activation PINs
- `eligibility_verifications` - Audit trail
- `distribution_otps` - Distribution OTPs

## Step 3: Configure Environment

Add to your `.env` file:

```bash
# SMS Configuration (Africa's Talking)
SMS_ENABLED=false                    # Use stub mode for development
AFRICASTALKING_API_KEY=sandbox
AFRICASTALKING_USERNAME=sandbox
AFRICASTALKING_SENDER_ID=SUPAMOTO
```

**Note**: With `SMS_ENABLED=false`, SMS messages will be logged instead of sent. Perfect for development!

## Step 4: Test the Flow

Run the interactive demo:

```bash
pnpm demo:activation
```

Follow the prompts:

### Lead Generator Flow:

1. **Enter Customer ID**: `C12345678`
2. **Enter Phone**: `+260971234567`
3. **System sends SMS** (stubbed - check console logs)
4. **Press 1** to continue

### Customer Flow:

1. **Enter PIN**: `123456` (any 6 digits work in demo)
2. **Press 1** to continue
3. **Answer eligibility**:
   - `1` for Yes (eligible)
   - `2` for No (not eligible)

## Step 5: Run Unit Tests

```bash
pnpm test src/machines/supamoto/activation/customerActivationMachine.test.ts
```

## What You'll See

### Console Output (Stub Mode)

```
[sms] STUB: SMS sending disabled, would send SMS
  to: ***4567
  message: Welcome to SupaMoto! Your activation PIN is: 123456...

[customerActivation] Generating and sending activation PIN
[customerActivation] Verifying temporary PIN
[customerActivation] Recording eligibility verification
[customerActivation] STUB: Would submit claim to ixo-matrix-supamoto-claims-bot
[customerActivation] STUB: Would transfer BEAN token via subscriptions-service-supamoto
```

### Database Records

Check the database to see records created:

```sql
-- View temporary PINs
SELECT * FROM temp_pins;

-- View eligibility verifications
SELECT * FROM eligibility_verifications;

-- View distribution OTPs
SELECT * FROM distribution_otps;
```

## Common Test Scenarios

### Scenario 1: Eligible Customer

```
Input: C12345678
Input: +260971234567
Input: 1 (continue)
Input: 123456 (PIN)
Input: 1 (continue)
Input: 1 (Yes, eligible)
Result: Claim submitted (stubbed), SMS sent (stubbed)
```

### Scenario 2: Not Eligible Customer

```
Input: C12345678
Input: +260971234567
Input: 1 (continue)
Input: 123456 (PIN)
Input: 1 (continue)
Input: 2 (No, not eligible)
Result: Response recorded for audit
```

### Scenario 3: Invalid PIN

```
Input: C12345678
Input: +260971234567
Input: 1 (continue)
Input: 12345 (5 digits - invalid)
Result: Error message, prompt again
```

## Enabling Real SMS (Production)

When ready to use real SMS:

1. **Sign up** for Africa's Talking account
2. **Get credentials** from your dashboard
3. **Update `.env`**:
   ```bash
   SMS_ENABLED=true
   AFRICASTALKING_API_KEY=your_real_api_key
   AFRICASTALKING_USERNAME=your_username
   AFRICASTALKING_SENDER_ID=SUPAMOTO
   ```
4. **Test** with a real phone number

## Integration with User Services

To make this accessible from the USSD menu, add to `userServicesMachine.ts`:

```typescript
// In agent tools menu
const agentToolsMessage =
  "Agent Tools\n" +
  "1. Verify Customer\n" +
  "0. Back";

// Add state
verifyCustomer: {
  invoke: {
    id: "customerActivation",
    src: customerActivationMachine,
    input: ({ context }) => ({
      sessionId: context.sessionId,
      phoneNumber: context.phoneNumber,
      serviceCode: context.serviceCode,
    }),
    onDone: {
      target: "agentTools",
    },
  },
}
```

## Troubleshooting

### Database Connection Error

```
Error: Missing required environment variable: DATABASE_URL
```

**Solution**: Ensure `DATABASE_URL` is set in `.env`:

```bash
DATABASE_URL="postgres://user:password@localhost:5432/database"
```

### Migration Already Run

```
ERROR: relation "temp_pins" already exists
```

**Solution**: This is normal if you've already run the migration. The tables exist.

### SMS Not Sending

**Check**:

1. Is `SMS_ENABLED=true` in `.env`?
2. Are your Africa's Talking credentials correct?
3. Check console logs for error messages

**For Development**: Use `SMS_ENABLED=false` to stub SMS

## Next Steps

1. ✅ **Test the demo** - Verify the flow works
2. ✅ **Check database** - Confirm records are created
3. ⚠️ **Integrate with menu** - Add to user services
4. ⚠️ **Implement claim submission** - Connect to IXO blockchain
5. ⚠️ **Implement token transfer** - Connect to subscriptions service

## Documentation

- **Implementation Guide**: `docs/CUSTOMER_ACTIVATION_IMPLEMENTATION.md`
- **Module README**: `src/machines/supamoto/activation/README.md`
- **Sequence Diagram**: `docs/Sequence-Diagram-Bean-Distribution-with-systems.md`
- **Implementation Summary**: `IMPLEMENTATION_SUMMARY.md`

## Support

If you encounter issues:

1. Check the logs for detailed error messages
2. Review the sequence diagram to understand the flow
3. Run the demo to test interactively
4. Check the database to verify records are created
5. Ensure environment variables are set correctly

## Quick Reference

### Commands

```bash
# Run demo
pnpm demo:activation

# Run tests
pnpm test src/machines/supamoto/activation/

# Run migrations
pnpm build && node dist/src/migrations/run-migrations.js

# Check database
psql -U user -d database -c "SELECT * FROM temp_pins;"
```

### Environment Variables

```bash
SMS_ENABLED=false                    # Enable/disable SMS
AFRICASTALKING_API_KEY=sandbox       # AT API key
AFRICASTALKING_USERNAME=sandbox      # AT username
AFRICASTALKING_SENDER_ID=SUPAMOTO    # Sender ID
```

### Test Data

```
Customer ID: C12345678 (or any C + 8+ alphanumeric)
Phone: +260971234567 (or any +[country][number])
PIN: 123456 (any 6 digits in demo mode)
```

---

**That's it!** You now have a working customer activation flow. 🎉
