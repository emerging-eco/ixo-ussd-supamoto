# SMS Logging Reference Guide

## Quick Log Pattern Lookup

### ✅ Success Patterns

#### SMS Enabled and Configured

```
Initializing Africa's Talking SMS client
{
  hasApiKey: true,
  hasUsername: true,
  username: "sandbox"
}

✅ Africa's Talking SMS client initialized successfully
```

#### SMS Sent Successfully

```
📱 SMS sending initiated
{
  to: "7567",
  messageLength: 120,
  smsEnabled: true
}

📤 Sending SMS via Africa's Talking API
{
  to: "7567",
  senderId: "SupaMoto",
  messageLength: 120
}

📨 SMS API response received from Africa's Talking
{
  responseStructure: {
    hasMessageData: true,
    hasRecipients: true,
    recipientCount: 1
  }
}

📊 SMS status evaluation
{
  statusCode: 101,
  statusString: "Success",
  isSuccess: true
}

✅ SMS sent successfully
{
  to: "7567",
  messageId: "ATXid_abc123",
  statusCode: 101,
  cost: "ZMW 0.15",
  durationMs: 1234
}
```

#### Activation SMS Success

```
🔐 Sending activation SMS with temporary PIN
{
  phoneNumber: "7567",
  customerId: "5678"
}

✅ Activation SMS sent successfully
{
  phoneNumber: "7567",
  customerId: "5678",
  success: true,
  messageId: "ATXid_abc123"
}
```

---

### ❌ Failure Patterns

#### SMS Disabled

```
📱 SMS sending initiated
{
  smsEnabled: false  // ⚠️ SMS is disabled
}

⚠️ STUB MODE: SMS sending disabled, would send SMS
{
  to: "7567",
  reason: "SMS_ENABLED is false"
}
```

#### Missing Credentials

```
Initializing Africa's Talking SMS client
{
  hasApiKey: false,  // ⚠️ Missing API key
  hasUsername: true,
  username: "sandbox"
}

Africa's Talking credentials not configured, SMS will be stubbed
{
  missingApiKey: true,
  missingUsername: false
}
```

#### Client Initialization Failed

```
❌ Failed to initialize Africa's Talking client
{
  error: "Invalid API key",
  stack: "...",
  username: "sandbox"
}

⚠️ STUB MODE: SMS client not initialized, would send SMS
```

#### Invalid Sender ID

```
❌ SMS send failed with error status
{
  to: "7567",
  statusCode: 402,
  statusString: "Failed",
  errorMessage: "Invalid sender ID"
}
```

#### Invalid Phone Number

```
❌ SMS send failed with error status
{
  to: "7567",
  statusCode: 403,
  statusString: "Failed",
  errorMessage: "Invalid phone number"
}
```

#### Insufficient Balance

```
❌ SMS send failed with error status
{
  to: "7567",
  statusCode: 405,
  statusString: "Failed",
  errorMessage: "Insufficient balance"
}
```

#### API Exception

```
❌ Exception occurred while sending SMS via Africa's Talking
{
  to: "7567",
  error: "Network timeout",
  stack: "...",
  durationMs: 30000
}
```

#### Activation SMS Failed

```
🔐 Sending activation SMS with temporary PIN
{
  phoneNumber: "7567",
  customerId: "5678"
}

❌ Activation SMS failed
{
  phoneNumber: "7567",
  customerId: "5678",
  success: false,
  error: "Invalid sender ID"
}

❌ SMS delivery failed - throwing error to trigger onError handler
{
  customerId: "5678",
  phoneNumber: "7567",
  error: "SMS delivery failed: Invalid sender ID"
}
```

---

### 🔄 Retry Patterns

#### Retry Initiated

```
🔄 SMS retry logic initiated
{
  to: "7567",
  maxAttempts: 3,
  delays: [0, 10, 30],
  eventType: "ACTIVATION"
}
```

#### Retry Attempt

```
📤 SMS send attempt 1/3

❌ SMS send attempt 1/3 failed
{
  to: "7567",
  attempt: 1,
  error: "Invalid sender ID"
}

⏳ Waiting 10s before retry attempt 2

📤 SMS send attempt 2/3

✅ SMS sent successfully after 2 attempt(s)
{
  to: "7567",
  attempt: 2,
  messageId: "ATXid_abc123",
  totalDurationMs: 10234
}
```

#### All Retries Failed

```
❌ SMS send failed after all 3 retry attempts
{
  to: "7567",
  attempts: 3,
  totalDurationMs: 40234
}
```

---

## Common Issues and Solutions

### Issue: SMS Disabled

**Log Pattern**: `⚠️ STUB MODE: SMS sending disabled, would send SMS`

**Solution**:

1. Check Railway env var: `SMS_ENABLED=true`
2. Ensure it's exactly the string `"true"`, not boolean

### Issue: Missing API Key

**Log Pattern**: `Africa's Talking credentials not configured`

**Solution**:

1. Check Railway env var: `AFRICASTALKING_API_KEY=atsk_...`
2. Verify it's not empty or malformed

### Issue: Invalid Sender ID

**Log Pattern**: `Invalid sender ID (402)`

**Solution**:

1. Check Railway env var: `AFRICASTALKING_SENDER_ID=SupaMoto`
2. Verify sender ID is registered with Africa's Talking

### Issue: Invalid Phone Number

**Log Pattern**: `Invalid phone number (403)`

**Solution**:

1. Verify phone number format: `+260971234567`
2. Check country code is correct
3. Verify number is not blacklisted

### Issue: Insufficient Balance

**Log Pattern**: `Insufficient balance (405)`

**Solution**:

1. Check Africa's Talking account balance
2. Add credit to account
3. Verify account is not suspended

### Issue: Network Timeout

**Log Pattern**: `Exception occurred while sending SMS`

**Solution**:

1. Check network connectivity
2. Verify Africa's Talking API is accessible
3. Check firewall/security group rules

---

## Log Levels

| Level | Pattern | Meaning                              |
| ----- | ------- | ------------------------------------ |
| info  | ✅      | Normal operation, success            |
| warn  | ⚠️      | Non-critical issue, fallback to stub |
| error | ❌      | Critical failure, needs attention    |

---

## Monitoring Checklist

- [ ] SMS_ENABLED is `"true"` on Railway
- [ ] AFRICASTALKING_API_KEY is set
- [ ] AFRICASTALKING_USERNAME is set
- [ ] AFRICASTALKING_SENDER_ID is set
- [ ] Logs show "✅ Africa's Talking SMS client initialized successfully"
- [ ] Logs show "✅ SMS sent successfully" for each SMS
- [ ] No "❌ SMS send failed" errors
- [ ] No "⚠️ STUB MODE" messages in production

---

**Last Updated**: 2025-10-16
