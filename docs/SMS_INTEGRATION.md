# Africa's Talking SMS Integration

## Overview

The SupaMoto USSD system integrates with Africa's Talking Bulk SMS API for sending activation PINs, OTPs, and notifications to customers and Lead Generators.

**Date:** 2025-10-15  
**Status:** ✅ Implemented and Verified  
**SDK Version:** africastalking@0.7.3

---

## Implementation Details

### Architecture

The SMS service uses the **official Africa's Talking Node.js SDK** which provides a clean abstraction over the HTTP API. This approach offers:

- ✅ Automatic request formatting and encoding
- ✅ Built-in error handling
- ✅ Type safety with TypeScript
- ✅ Simplified authentication
- ✅ Automatic retry logic (SDK-level)

### File Structure

```
src/services/sms.ts          - Main SMS service implementation
src/config.ts                - SMS configuration
.env.example                 - Environment variable documentation
src/templates/sms/           - SMS message templates
```

---

## Configuration

### Environment Variables

```bash
# SMS Configuration (Africa's Talking)
SMS_ENABLED=true                              # Enable/disable SMS sending
AFRICASTALKING_API_KEY=your-api-key-here     # API key from Africa's Talking
AFRICASTALKING_USERNAME=your-username-here   # Username (or "sandbox" for testing)
AFRICASTALKING_SENDER_ID=SupaMoto            # Sender ID (alphanumeric or shortcode)

# USSD Configuration
SMS_RETRY_ATTEMPTS=3                         # Number of retry attempts
```

### Configuration Object

```typescript
// src/config.ts
SMS: {
  ENABLED: process.env.SMS_ENABLED === "true",
  API_KEY: process.env.AFRICASTALKING_API_KEY,
  USERNAME: process.env.AFRICASTALKING_USERNAME || "sandbox",
  SENDER_ID: process.env.AFRICASTALKING_SENDER_ID,
}

USSD: {
  SMS_RETRY_ATTEMPTS: parseInt(process.env.SMS_RETRY_ATTEMPTS || "3", 10),
  SMS_RETRY_DELAYS_SECONDS: [0, 10, 30], // Immediate, 10s, 30s
}
```

---

## API Integration

### SDK Initialization

```typescript
import AfricasTalking from "africastalking";

const africastalking = AfricasTalking({
  apiKey: config.SMS.API_KEY,
  username: config.SMS.USERNAME,
});

const smsClient = africastalking.SMS;
```

### Sending SMS

```typescript
const result = await smsClient.send({
  to: ["+260971234567"], // Array of phone numbers
  message: "Your PIN is 12345", // Message text
  from: config.SMS.SENDER_ID, // Sender ID (optional)
  enqueue: true, // Queue for delivery (recommended)
});
```

### Response Format

The SDK returns a structured response:

```typescript
{
  SMSMessageData: {
    Message: "Sent to 1/1 Total Cost: ZMW 0.15",
    Recipients: [
      {
        number: "+260971234567",
        cost: "ZMW 0.15",
        status: "Success",           // or "Queued", "Failed", etc.
        statusCode: 101,              // Numeric status code
        messageId: "ATXid_abc123"     // Unique message ID
      }
    ]
  }
}
```

---

## Status Codes

### Success Codes (Accepted)

| Code | Status  | Description                 | Action         |
| ---- | ------- | --------------------------- | -------------- |
| 101  | Success | Message sent successfully   | Return success |
| 102  | Queued  | Message queued for delivery | Return success |

### Error Codes (Rejected)

| Code | Status                  | Description                    | Action       |
| ---- | ----------------------- | ------------------------------ | ------------ |
| 401  | Risk hold               | Message flagged as spam        | Return error |
| 402  | Invalid sender ID       | Sender ID not registered       | Return error |
| 403  | Invalid phone number    | Phone number format invalid    | Return error |
| 404  | Unsupported number type | Number type not supported      | Return error |
| 405  | Insufficient balance    | Account has insufficient funds | Return error |
| 406  | User in blacklist       | Recipient has blocked sender   | Return error |
| 407  | Could not route message | Network routing failed         | Return error |
| 500  | Internal server error   | Africa's Talking server error  | Return error |

---

## Implementation Features

### 1. Status Code Handling

The service correctly handles both success codes (101 and 102):

```typescript
const statusCode = recipient.statusCode;
const isSuccess =
  statusCode === 101 || // Success
  statusCode === 102 || // Queued
  recipient.status === "Success" || // Fallback to string status
  recipient.status === "Queued";
```

### 2. Error Message Mapping

Human-readable error messages for all status codes:

```typescript
function getErrorMessage(statusCode: number, status: string): string {
  const errorMessages: Record<number, string> = {
    401: "Risk hold - Message flagged as spam",
    402: "Invalid sender ID",
    403: "Invalid phone number",
    404: "Unsupported number type",
    405: "Insufficient balance",
    406: "User in blacklist",
    407: "Could not route message",
    500: "Internal server error",
  };

  return (
    errorMessages[statusCode] ||
    status ||
    `Unknown error (status code: ${statusCode})`
  );
}
```

### 3. Retry Logic with Exponential Backoff

```typescript
export async function sendSMSWithRetry(
  params: SendSMSParams,
  auditContext?: {
    eventType: string;
    customerId?: string;
    lgCustomerId?: string;
  }
): Promise<SendSMSResult> {
  const maxAttempts = config.USSD.SMS_RETRY_ATTEMPTS; // 3
  const delays = config.USSD.SMS_RETRY_DELAYS_SECONDS; // [0, 10, 30]

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Wait before retry (except first attempt)
    if (attempt > 0 && delays[attempt]) {
      await new Promise(resolve => setTimeout(resolve, delays[attempt] * 1000));
    }

    const result = await sendSMS(params);

    if (result.success) {
      return result; // Success - stop retrying
    }

    // Log failed attempt and create audit record
    // ... (see implementation for details)
  }

  return { success: false, error: `Failed after ${maxAttempts} attempts` };
}
```

**Retry Schedule:**

- Attempt 1: Immediate
- Attempt 2: After 10 seconds
- Attempt 3: After 30 seconds

### 4. Audit Logging

Failed SMS attempts are logged to the `audit_log` table:

```typescript
await dataService.createAuditLog({
  eventType: "SMS_FAILED",
  customerId: auditContext.customerId,
  lgCustomerId: auditContext.lgCustomerId,
  details: {
    originalEventType: auditContext.eventType,
    attempt: attempt + 1,
    maxAttempts,
    error: result.error,
    phoneNumber: params.to.slice(-4),
    messageLength: params.message.length,
  },
});
```

### 5. Stub Mode for Development

When SMS is disabled or credentials are missing, the service operates in stub mode:

```typescript
if (!config.SMS.ENABLED) {
  logger.info({ to: to.slice(-4), message }, "STUB: SMS sending disabled");
  return { success: true, messageId: `stub-${Date.now()}` };
}
```

This allows development and testing without actual SMS sending.

---

## Usage Examples

### Basic SMS Sending

```typescript
import { sendSMS } from "./services/sms.js";

const result = await sendSMS({
  to: "+260971234567",
  message: "Your activation PIN is 12345",
});

if (result.success) {
  console.log("SMS sent:", result.messageId);
} else {
  console.error("SMS failed:", result.error);
}
```

### SMS with Retry Logic

```typescript
import { sendSMSWithRetry } from "./services/sms.js";

const result = await sendSMSWithRetry(
  {
    to: "+260971234567",
    message: "Your activation PIN is 12345",
  },
  {
    eventType: "ACCOUNT_LOCKED",
    customerId: "C12345678",
  }
);
```

### Using SMS Templates

```typescript
import { accountLockedSMS } from "./templates/sms/index.js";
import { sendSMSWithRetry } from "./services/sms.js";

const message = accountLockedSMS("C12345678");

await sendSMSWithRetry(
  { to: phoneNumber, message },
  { eventType: "ACCOUNT_LOCKED", customerId: "C12345678" }
);
```

---

## Testing

### Sandbox Mode

Africa's Talking provides a sandbox environment for testing:

```bash
# .env
AFRICASTALKING_USERNAME=sandbox
AFRICASTALKING_API_KEY=your-sandbox-api-key
```

**Sandbox Limitations:**

- Messages are not actually sent to recipients
- Responses simulate successful delivery
- Useful for integration testing without SMS costs

### Production Mode

```bash
# .env
AFRICASTALKING_USERNAME=your-production-username
AFRICASTALKING_API_KEY=your-production-api-key
```

### Testing Checklist

- [x] SMS client initializes correctly with credentials
- [x] Messages are sent successfully (status code 101 or 102)
- [x] Error status codes are handled correctly
- [x] Retry logic works with exponential backoff
- [x] Audit logs are created for failed attempts
- [x] Stub mode works when SMS is disabled
- [x] Phone number format is validated
- [x] Message length is within limits (160 chars for single SMS)

---

## Monitoring

### Logging

All SMS operations are logged with appropriate levels:

```typescript
logger.info({ to: to.slice(-4), messageId }, "SMS sent successfully");
logger.warn({ to: to.slice(-4), statusCode, error }, "SMS send failed");
logger.error({ to: to.slice(-4), attempts }, "SMS failed after all retries");
```

### Audit Queries

Query failed SMS attempts:

```sql
SELECT * FROM audit_log
WHERE event_type = 'SMS_FAILED'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

Query by customer:

```sql
SELECT * FROM audit_log
WHERE event_type = 'SMS_FAILED'
  AND customer_id = 'C12345678'
ORDER BY created_at DESC;
```

---

## Troubleshooting

### Common Issues

**Issue: "SMS client not initialized"**

- **Cause:** Missing API key or username
- **Solution:** Check `.env` file has correct credentials

**Issue: "Invalid sender ID" (402)**

- **Cause:** Sender ID not registered with Africa's Talking
- **Solution:** Register sender ID in Africa's Talking dashboard

**Issue: "Insufficient balance" (405)**

- **Cause:** Account has no credit
- **Solution:** Top up account balance

**Issue: "Invalid phone number" (403)**

- **Cause:** Phone number format is incorrect
- **Solution:** Ensure format is `+260971234567` (country code + number)

---

## Best Practices

1. **Always use retry logic** - Use `sendSMSWithRetry()` instead of `sendSMS()` for important messages
2. **Include audit context** - Pass audit context to track failures
3. **Use templates** - Use SMS templates from `src/templates/sms/` for consistency
4. **Monitor costs** - Check message costs in logs and Africa's Talking dashboard
5. **Test in sandbox** - Always test in sandbox before production
6. **Handle errors gracefully** - Don't block user flows on SMS failures
7. **Keep messages concise** - Aim for <160 characters to avoid multi-part SMS

---

## References

- **Africa's Talking API Docs:** https://developers.africastalking.com/docs/sms/overview
- **Node.js SDK:** https://github.com/AfricasTalkingLtd/africastalking-node
- **SMS Service:** `src/services/sms.ts`
- **SMS Templates:** `src/templates/sms/`
- **Configuration:** `src/config.ts`

---

**Status:** ✅ Complete and Production-Ready
