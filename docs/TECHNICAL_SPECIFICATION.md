# USSD Menu Restructure - Complete Implementation Specification

## Overview

This specification covers the complete restructure of the SupaMoto USSD menu system to align with the updated sequence diagram and implement the bean distribution workflow.

**Key Changes:**

- Remove "Activate my account" from Account Menu (use login with temp PIN instead)
- Rename "User Services" to "Services"
- Implement role-based menu display (Customer Tools vs Agent Tools)
- Add forced PIN change flow after first login
- Implement 3-attempt login lockout with PIN deletion
- Add 1,000 Day Household claim workflow
- Add complete bean distribution workflow (intent, OTP, dual confirmations)
- Add SMS retry logic with exponential delays
- Add comprehensive audit logging

**Related Documents:**

- Sequence Diagram: `docs/Sequence-Diagram-Bean-Distribution-with-systems.md`
- Revised Menu Structure: `revised-ussd-menu-structure.md`
- RBAC Documentation: `docs/ROLE_BASED_ACCESS_CONTROL.md`

---

## 1. Database Schema Updates

### Migration: `migrations/postgres/004-bean-distribution-and-audit.sql`

```sql
-- LG Intent Registration Table
-- Stores LG intent to deliver beans before sending to subscriptions-service-supamoto
CREATE TABLE lg_delivery_intents (
  id SERIAL PRIMARY KEY,
  customer_id VARCHAR(10) NOT NULL REFERENCES customers(customer_id),
  lg_customer_id VARCHAR(10) NOT NULL REFERENCES customers(customer_id),
  intent_registered_at TIMESTAMP NOT NULL DEFAULT NOW(),
  has_bean_voucher BOOLEAN NOT NULL,
  voucher_status VARCHAR(50), -- e.g., "HAS_VOUCHER", "NO_VOUCHER", "ERROR"
  voucher_check_response JSONB, -- Full JSON response from subscriptions-service-supamoto
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- OTP tracking table
-- Tracks OTPs generated for bean distribution (valid 10 minutes, configurable)
CREATE TABLE bean_distribution_otps (
  id SERIAL PRIMARY KEY,
  customer_id VARCHAR(10) NOT NULL REFERENCES customers(customer_id),
  lg_customer_id VARCHAR(10) NOT NULL REFERENCES customers(customer_id),
  intent_id INTEGER REFERENCES lg_delivery_intents(id),
  otp VARCHAR(6) NOT NULL,
  generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  is_valid BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Delivery confirmations table
-- Tracks dual confirmations (LG + Customer) for bean delivery
-- Both confirmations required within 7 days (configurable) from OTP submission
CREATE TABLE bean_delivery_confirmations (
  id SERIAL PRIMARY KEY,
  customer_id VARCHAR(10) NOT NULL REFERENCES customers(customer_id),
  lg_customer_id VARCHAR(10) NOT NULL REFERENCES customers(customer_id),
  otp_id INTEGER REFERENCES bean_distribution_otps(id),
  lg_confirmed_at TIMESTAMP NULL,
  customer_confirmed_at TIMESTAMP NULL,
  customer_confirmed_receipt BOOLEAN NULL, -- TRUE = Yes, FALSE = No, NULL = not yet confirmed
  token_transferred_at TIMESTAMP NULL,
  confirmation_deadline TIMESTAMP NOT NULL, -- 7 days from OTP submission
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 1,000 Day Household Claims table
-- Stores customer self-proclamation claims for audit and retry
CREATE TABLE household_claims (
  id SERIAL PRIMARY KEY,
  customer_id VARCHAR(10) NOT NULL REFERENCES customers(customer_id),
  is_1000_day_household BOOLEAN NOT NULL,
  claim_submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  claim_processed_at TIMESTAMP NULL,
  claim_status VARCHAR(50), -- e.g., "PENDING", "PROCESSED", "FAILED", "VOUCHER_ALLOCATED"
  bean_voucher_allocated BOOLEAN DEFAULT FALSE,
  claims_bot_response JSONB, -- Full response from ixo-matrix-supamoto-claims-bot
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Audit log table
-- Tracks security events, failed SMS, denied receipts, etc.
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL, -- e.g., 'BEAN_RECEIPT_DENIED', 'SMS_FAILED', 'ACCOUNT_LOCKED'
  customer_id VARCHAR(10),
  lg_customer_id VARCHAR(10),
  details JSONB, -- Flexible field for event-specific data
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_lg_intents_customer ON lg_delivery_intents(customer_id);
CREATE INDEX idx_lg_intents_lg ON lg_delivery_intents(lg_customer_id);
CREATE INDEX idx_lg_intents_status ON lg_delivery_intents(voucher_status);
CREATE INDEX idx_bean_otps_customer ON bean_distribution_otps(customer_id);
CREATE INDEX idx_bean_otps_lg ON bean_distribution_otps(lg_customer_id);
CREATE INDEX idx_bean_otps_intent ON bean_distribution_otps(intent_id);
CREATE INDEX idx_bean_otps_valid ON bean_distribution_otps(is_valid);
CREATE INDEX idx_bean_confirmations_customer ON bean_delivery_confirmations(customer_id);
CREATE INDEX idx_bean_confirmations_lg ON bean_delivery_confirmations(lg_customer_id);
CREATE INDEX idx_bean_confirmations_deadline ON bean_delivery_confirmations(confirmation_deadline);
CREATE INDEX idx_household_claims_customer ON household_claims(customer_id);
CREATE INDEX idx_household_claims_status ON household_claims(claim_status);
CREATE INDEX idx_audit_log_event_type ON audit_log(event_type);
CREATE INDEX idx_audit_log_customer ON audit_log(customer_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);

-- Comments for documentation
COMMENT ON TABLE lg_delivery_intents IS 'Stores LG intent to deliver beans before sending to subscriptions-service-supamoto';
COMMENT ON TABLE bean_distribution_otps IS 'Tracks OTPs generated for bean distribution (valid 10 minutes by default, configurable)';
COMMENT ON TABLE bean_delivery_confirmations IS 'Tracks dual confirmations (LG + Customer) for bean delivery within 7-day window';
COMMENT ON TABLE household_claims IS '1,000 Day Household self-proclamation claims with retry capability';
COMMENT ON TABLE audit_log IS 'Audit trail for security events, failed SMS, denied receipts, etc.';

COMMENT ON COLUMN lg_delivery_intents.voucher_status IS 'Status: HAS_VOUCHER, NO_VOUCHER, ERROR';
COMMENT ON COLUMN lg_delivery_intents.voucher_check_response IS 'Full JSON response from subscriptions-service-supamoto';
COMMENT ON COLUMN household_claims.claim_status IS 'Status: PENDING, PROCESSED, FAILED, VOUCHER_ALLOCATED';
COMMENT ON COLUMN household_claims.claims_bot_response IS 'Full JSON response from ixo-matrix-supamoto-claims-bot';
COMMENT ON COLUMN bean_delivery_confirmations.customer_confirmed_receipt IS 'TRUE = received beans, FALSE = did not receive, NULL = not yet confirmed';
```

---

## 2. Configuration Updates

### File: `src/config.ts`

Add new USSD configuration section:

```typescript
USSD: {
  // Service code is accessed via: config.ZM.SERVICE_CODES[0]
  OTP_VALIDITY_MINUTES: parseInt(process.env.OTP_VALIDITY_MINUTES || "10", 10),
  MAX_PIN_ATTEMPTS: parseInt(process.env.MAX_PIN_ATTEMPTS || "3", 10),
  DELIVERY_CONFIRMATION_DAYS: parseInt(process.env.DELIVERY_CONFIRMATION_DAYS || "7", 10),
  SMS_RETRY_ATTEMPTS: parseInt(process.env.SMS_RETRY_ATTEMPTS || "3", 10),
  SMS_RETRY_DELAYS_SECONDS: [0, 10, 30], // Immediate, 10s, 30s for 3 attempts
}
```

### File: `.env.example`

Add new environment variables:

```bash
# USSD Configuration
OTP_VALIDITY_MINUTES=10
MAX_PIN_ATTEMPTS=3
DELIVERY_CONFIRMATION_DAYS=7
SMS_RETRY_ATTEMPTS=3
```

---

## 3. SMS Templates Structure

### Directory: `src/templates/sms/`

Create the following files with SMS message templates:

#### Files to Create:

1. **`activation.ts`** - Customer activation and account lockout messages
2. **`household.ts`** - Bean voucher allocation messages
3. **`otp.ts`** - OTP-related messages (customer OTP, LG confirmations, invalid/expired)
4. **`delivery.ts`** - Bean delivery confirmation messages
5. **`index.ts`** - Central export for all templates

#### Key Template Functions:

**Activation Templates:**

- `activationSMS(customerId, tempPin)` - Welcome message with login instructions
- `accountLockedSMS(customerId)` - Account lockout notification

**Household Templates:**

- `beanVoucherAllocatedSMS(customerId)` - Voucher allocation confirmation

**OTP Templates:**

- `customerOTPSMS(otp, lgName?)` - OTP sent to customer
- `lgNoVoucherSMS(customerId)` - LG notification when customer has no voucher
- `lgHasVoucherSMS(customerId)` - LG notification when customer has voucher
- `lgInvalidOTPSMS(customerId, reason)` - Invalid or expired OTP notification
- `lgValidOTPSMS(customerId)` - Valid OTP confirmation

**Delivery Templates:**

- `lgTokenTransferredSMS(customerId)` - Token transfer confirmation

**Template Design Principles:**

- Use `config.ZM.SERVICE_CODES[0]` for service code (not hardcoded)
- Provide step-by-step menu navigation instructions (no shortcuts)
- Include context-specific information (Customer ID, validity periods)
- Keep messages clear, concise, and actionable

---

## 4. SMS Service Updates

### File: `src/services/sms.ts`

Add retry logic with exponential delays:

```typescript
/**
 * Send SMS with retry logic
 * Attempts: Immediate, 10s delay, 30s delay (configurable)
 * Creates audit log entries for failed attempts
 */
export async function sendSMSWithRetry(
  params: SendSMSParams,
  auditContext?: {
    eventType: string;
    customerId?: string;
    lgCustomerId?: string;
  }
): Promise<SendSMSResult>;
```

**Retry Logic:**

- Attempt 1: Immediate (0 seconds)
- Attempt 2: 10 seconds delay
- Attempt 3: 30 seconds delay
- Configurable via `config.USSD.SMS_RETRY_DELAYS_SECONDS`

**Audit Logging:**

- Each failed attempt creates an `audit_log` entry
- Event type: `SMS_FAILED`
- Details include: attempt number, error message, phone number (last 4 digits)

---

## 5. Menu Structure Changes

### Current Menu (to be replaced):

```
Pre-Menu
├── 1. Know More
├── 2. Account Menu
│   ├── 1. Yes, log me in
│   ├── 2. No, create my account
│   └── 3. Activate my account ← REMOVE
└── 3. User Services (only if authenticated)
    ├── 1. Account ← HIDE
    ├── 2. Balances ← HIDE
    ├── 3. Orders ← HIDE
    ├── 4. Vouchers ← HIDE
    └── 5. Agent Tools (role-based)
```

### New Menu Structure:

```
Pre-Menu
├── 1. Know More
├── 2. Account Menu
│   ├── 1. Yes, log me in
│   └── 2. No, create my account
└── 3. Services (only if authenticated) ← RENAMED
    ├── [For role='customer']
    │   └── Customer Tools
    │       ├── 1. 1,000 Day Household
    │       └── 2. Confirm Receival of Beans
    └── [For role='lead_generator'|'call_center'|'admin']
        └── Agent Tools
            ├── 1. Activate a Customer
            ├── 2. Register Intent to Deliver Beans
            ├── 3. Submit Customer OTP
            └── 4. Confirm Bean Delivery
```

**Key Changes:**

- Removed "3. Activate my account" from Account Menu
- Renamed "User Services" to "Services"
- Removed Account/Balances/Orders/Vouchers submenus
- Added role-based routing: Customer Tools OR Agent Tools (not both)
- Customers with 'customer' role see only Customer Tools
- Users with agent roles see only Agent Tools

---

## 6. Key Workflows

### Workflow 1: Customer Activation & First Login

**Sequence Diagram Reference:** Lines 27-30

```
1. LG: Agent Tools → Activate a Customer
2. LG: Enter Customer ID
3. System: Generate temp PIN (5 digits)
4. System: Store in customers.encrypted_pin
5. System: Set customers.force_pin_change = TRUE (if field exists)
6. System: Send activation SMS to customer (using activationSMS template)
7. Customer: Dial USSD → Account Menu → Yes, log me in
8. Customer: Enter Customer ID
9. Customer: Enter temp PIN
10. System: Validate credentials
11. System: Check if PIN change required (temp PIN or force_pin_change flag)
12. System: Redirect to forced PIN change flow
13. Customer: Enter new PIN (5 digits)
14. Customer: Confirm new PIN
15. System: Validate PINs match and format is correct
16. System: Update customers.encrypted_pin with new PIN
17. System: Clear force_pin_change flag (if exists)
18. System: Show "PIN changed successfully!"
19. System: Redirect to Services menu
```

**Error Handling:**

- PINs don't match: Show error, retry from step 13
- Invalid format (not 5 digits): Show error, retry from step 13
- Infinite retries allowed (until USSD session timeout ~120 seconds)

---

### Workflow 2: 1,000 Day Household Claim

**Sequence Diagram Reference:** Lines 31-40

```
1. Customer: Services → Customer Tools → 1,000 Day Household
2. System: Show question "A 1,000 Day Household is a family with a pregnant or
   breastfeeding mother, or a child younger than two years old. Do you have an
   eligible 1,000 Day Household?"
   - 1. Yes
   - 2. No
   - 0. Back
3. Customer: Select 1 (Yes) or 2 (No)
4. System: Insert record into household_claims table
   - customer_id
   - is_1000_day_household (TRUE/FALSE)
   - claim_status = 'PENDING'
   - claim_submitted_at = NOW()
5. System: Send claim to ixo-matrix-supamoto-claims-bot (async, non-blocking)
6. System: Show immediate USSD response:
   - If Yes: "Your self-proclamation has been recorded. You should receive an SMS shortly..."
   - If No: "Thank you. Your response has been recorded."
7. System: Return to Customer Tools menu
8. [Async] Claims bot processes claim (lines 33-37)
9. [Async] If approved:
   - Transfer BEAN token to customer subscription (lines 38-39)
   - Send SMS to customer: beanVoucherAllocatedSMS() (line 40)
   - Update household_claims:
     - claim_status = 'VOUCHER_ALLOCATED'
     - bean_voucher_allocated = TRUE
     - claim_processed_at = NOW()
     - claims_bot_response = {bot response JSON}
10. [Async] If rejected or error:
    - Update household_claims:
      - claim_status = 'FAILED' or 'PROCESSED'
      - claims_bot_response = {error details}
```

**Error Handling:**

- Claims bot offline: Store claim, set status='FAILED', create audit_log entry
- Customer can make multiple claims (no special logic, backend handles duplicates)
- Failed claims can be retried manually by SupaMoto staff

---

### Workflow 3: Bean Distribution (Full Flow)

**Sequence Diagram Reference:** Lines 41-61

#### Part A: LG Registers Intent (Lines 41-49)

```
1. LG: Agent Tools → Register Intent to Deliver Beans
2. LG: Enter Customer ID
3. System: Insert record into lg_delivery_intents table
   - customer_id
   - lg_customer_id (from session)
   - intent_registered_at = NOW()
4. System: Call subscriptions-service-supamoto to check for bean voucher (line 42)
5. System: Update lg_delivery_intents with response
   - voucher_status = 'HAS_VOUCHER' | 'NO_VOUCHER' | 'ERROR'
   - voucher_check_response = {full JSON response}
6. IF NO VOUCHER (lines 43-46):
   - System: Send SMS to LG: lgNoVoucherSMS(customerId)
   - System: Show USSD message: "Customer does not have a bean voucher..."
   - System: Return to Agent Tools menu
   - END
7. IF HAS VOUCHER (lines 47-49):
   - System: Generate 6-digit OTP
   - System: Insert into bean_distribution_otps:
     - customer_id
     - lg_customer_id
     - intent_id (reference to lg_delivery_intents)
     - otp (6 digits)
     - generated_at = NOW()
     - expires_at = NOW() + OTP_VALIDITY_MINUTES
     - is_valid = TRUE
   - System: Send OTP SMS to customer: customerOTPSMS(otp, lgName)
   - System: Send confirmation SMS to LG: lgHasVoucherSMS(customerId)
   - System: Show USSD message: "Thank you. The customer will receive an SMS
     with an OTP. The OTP is valid for 10 minutes."
   - System: Return to Agent Tools menu
```

#### Part B: LG Submits OTP (Lines 50-55)

```
8. Customer: Shows OTP to LG (physical interaction, line 50)
9. LG: Agent Tools → Submit Customer OTP
10. LG: Enter Customer ID
11. LG: Enter OTP (6 digits)
12. System: Validate OTP (line 51)
    - Query bean_distribution_otps WHERE:
      - customer_id = {entered customer ID}
      - otp = {entered OTP}
      - is_valid = TRUE
      - used_at IS NULL
13. System: Check OTP validity
14. IF INVALID OR EXPIRED (lines 52-54):
    - System: Send SMS to LG: lgInvalidOTPSMS(customerId, 'INVALID' | 'EXPIRED')
    - System: Show USSD error message with retry instructions
    - System: Return to Agent Tools menu
    - END
15. IF VALID (line 55):
    - System: Mark OTP as used:
      - bean_distribution_otps.used_at = NOW()
      - bean_distribution_otps.is_valid = FALSE
    - System: Insert/update bean_delivery_confirmations:
      - customer_id
      - lg_customer_id
      - otp_id (reference to bean_distribution_otps)
      - confirmation_deadline = NOW() + DELIVERY_CONFIRMATION_DAYS
    - System: Send SMS to LG: lgValidOTPSMS(customerId)
    - System: Show USSD message: "Thank you. You can go ahead with the delivery.
      You will soon receive an additional SMS confirmation."
    - System: Return to Agent Tools menu
```

#### Part C: Delivery Confirmations (Lines 56-61)

```
16. LG: Physically delivers beans to customer (line 56)
17. LG: Agent Tools → Confirm Bean Delivery (line 57)
18. LG: Enter Customer ID
19. System: Update bean_delivery_confirmations:
    - lg_confirmed_at = NOW()
20. System: Show USSD message: "Thank you for confirming delivery."
21. System: Return to Agent Tools menu

22. Customer: Customer Tools → Confirm Receival of Beans (line 58)
23. Customer: See question "Did you receive a bag of beans from your Lead Generator?"
    - 1. Yes
    - 2. No
    - 0. Back
24. Customer: Select 1 (Yes) or 2 (No)
25. System: Update bean_delivery_confirmations:
    - customer_confirmed_at = NOW()
    - customer_confirmed_receipt = TRUE | FALSE

26. IF customer_confirmed_receipt = FALSE:
    - System: Create audit_log entry (event_type: 'BEAN_RECEIPT_DENIED')
    - System: Show message: "Thank you. Your response has been recorded. If you
      are still awaiting delivery then return to the LG and request it."
    - System: Do NOT transfer token
    - System: Return to Customer Tools menu
    - END

27. IF customer_confirmed_receipt = TRUE:
    - System: Check if BOTH confirmations received:
      - lg_confirmed_at IS NOT NULL
      - customer_confirmed_at IS NOT NULL
      - customer_confirmed_receipt = TRUE
    - System: Check if within deadline:
      - NOW() <= confirmation_deadline

28. IF BOTH confirmations AND within deadline (lines 59-61):
    - System: Transfer BEAN token from customer subscription to LG subscription
    - System: Update bean_delivery_confirmations:
      - token_transferred_at = NOW()
    - System: Send SMS to LG: lgTokenTransferredSMS(customerId)
    - System: Show USSD message: "Thank you for your confirmation."
    - System: Return to Customer Tools menu

29. IF deadline expired:
    - System: Create audit_log entry (event_type: 'CONFIRMATION_DEADLINE_EXPIRED')
    - System: Do NOT transfer token
    - System: Show USSD message: "Thank you for your confirmation."
```

**Important Notes:**

- Confirmations can happen in ANY order (LG first or Customer first)
- Customer can change answer by confirming again (use LAST submission)
- LG can confirm even if customer denied receipt (allows correction)
- Token transfer only happens when BOTH confirmations are TRUE and within deadline

---

## 7. Error Handling & Edge Cases

### 7.1 Failed PIN Attempts (3 Strikes)

**Context Storage:** In-memory only (loginMachine context)
**Counter Reset:** On successful login or new session

```
Attempt 1:
  Message: "Incorrect PIN. Please try again. (Attempt 1 of 3)"
  Action: Increment failedAttempts counter

Attempt 2:
  Message: "Incorrect PIN. Please try again. (Attempt 2 of 3)
           WARNING: Your account will be locked after one more failed attempt."
  Action: Increment failedAttempts counter

Attempt 3:
  Actions:
    1. Delete customers.encrypted_pin (set to NULL)
    2. Send SMS: accountLockedSMS(customerId)
    3. Show USSD: "Your USSD account has been locked due to 3 failed PIN
       attempts. Contact your LG or the SupaMoto call centre to reset your PIN."
    4. Create audit_log entry:
       - event_type: 'ACCOUNT_LOCKED'
       - customer_id: {customer ID}
       - details: { reason: 'FAILED_PIN_ATTEMPTS', attempts: 3 }
```

**Recovery:**

- LG uses "Activate a Customer" to reset PIN (generates new temp PIN)
- No distinction between first activation and PIN reset

---

### 7.2 OTP Expiration

**Validity Period:** 10 minutes (configurable via `OTP_VALIDITY_MINUTES`)

```
When OTP expires:
  1. System: Mark bean_distribution_otps.is_valid = FALSE
  2. LG submits expired OTP:
     - Send SMS: lgInvalidOTPSMS(customerId, 'EXPIRED')
     - Show USSD: "The OTP has expired (valid for 10 minutes only).
       Please register your intent again to generate a new OTP.
       1. Register Intent Again
       0. Back to Agent Tools"
  3. LG can register intent again to generate new OTP
```

**Implementation:**

```typescript
const isExpired = new Date() > otp.expires_at;
if (isExpired) {
  // Mark as invalid
  await updateOTP(otp.id, { is_valid: false });
  // Send expired notification
  await sendSMSWithRetry({
    to: lgPhoneNumber,
    message: lgInvalidOTPSMS(customerId, "EXPIRED"),
  });
}
```

---

### 7.3 Confirmation Deadline (7 Days)

**Deadline Start:** From successful OTP submission (when `used_at` is set)
**Configurable:** Via `DELIVERY_CONFIRMATION_DAYS` env var

```
When deadline passes without both confirmations:
  1. System: Create audit_log entry:
     - event_type: 'CONFIRMATION_DEADLINE_EXPIRED'
     - customer_id: {customer ID}
     - lg_customer_id: {LG customer ID}
     - details: {
         otp_id: {OTP ID},
         lg_confirmed: {true/false},
         customer_confirmed: {true/false},
         deadline: {deadline timestamp}
       }
  2. System: Do NOT transfer token
  3. LG can register intent again to restart process
```

**Checking Deadline:**

```typescript
const isWithinDeadline = new Date() <= confirmation.confirmation_deadline;
const bothConfirmed =
  confirmation.lg_confirmed_at !== null &&
  confirmation.customer_confirmed_at !== null &&
  confirmation.customer_confirmed_receipt === true;

if (bothConfirmed && isWithinDeadline) {
  // Transfer token
} else if (bothConfirmed && !isWithinDeadline) {
  // Create audit log, don't transfer
}
```

---

### 7.4 Customer Denies Receipt

**Scenario:** Customer selects "2. No" when asked if they received beans

```
System Actions:
  1. Set bean_delivery_confirmations.customer_confirmed_receipt = FALSE
  2. Set bean_delivery_confirmations.customer_confirmed_at = NOW()
  3. Create audit_log entry:
     - event_type: 'BEAN_RECEIPT_DENIED'
     - customer_id: {customer ID}
     - lg_customer_id: {LG customer ID}
     - details: {
         otp_id: {OTP ID},
         denied_at: {timestamp},
         lg_confirmed: {true/false}
       }
  4. Do NOT transfer token
  5. Show message: "Thank you. Your response has been recorded. If you are
     still awaiting delivery then return to the LG and request it."

Customer Can Change Answer:
  - Customer can confirm again (select "1. Yes")
  - System uses LAST submission as final answer
  - If last submission is "Yes" and LG confirmed, transfer token

LG Can Still Confirm:
  - LG can confirm delivery even if customer denied receipt
  - Allows correction of accidental "No" selection
  - Token only transfers if BOTH final confirmations are positive
```

---

### 7.5 SMS Send Failures

**Retry Logic:** Immediate, 10s delay, 30s delay (configurable)

```
For each SMS send attempt:
  Attempt 1 (immediate):
    - Try to send SMS
    - If success: Return
    - If failure: Log and continue to attempt 2

  Attempt 2 (10 seconds later):
    - Wait 10 seconds
    - Try to send SMS
    - If success: Log retry success and return
    - If failure: Log and continue to attempt 3

  Attempt 3 (30 seconds later):
    - Wait 30 seconds
    - Try to send SMS
    - If success: Log retry success and return
    - If failure: Log final failure

  After each failed attempt:
    - Create audit_log entry:
      - event_type: 'SMS_FAILED'
      - customer_id: {customer ID}
      - lg_customer_id: {LG customer ID if applicable}
      - details: {
          attempt: {1, 2, or 3},
          maxAttempts: 3,
          error: {error message},
          phoneNumber: {last 4 digits},
          messageLength: {length},
          originalEventType: {e.g., 'ACTIVATION', 'OTP_SENT'}
        }

  After all retries fail:
    - Log final failure
    - Continue with USSD flow (don't block user)
    - SMS can be retried manually if needed
```

---

### 7.6 Claims Bot Offline

**Scenario:** ixo-matrix-supamoto-claims-bot is unavailable when customer makes claim

```
When household_claims is submitted:
  1. Insert record into household_claims table:
     - customer_id
     - is_1000_day_household
     - claim_status = 'PENDING'
     - claim_submitted_at = NOW()

  2. Attempt to send to claims bot

  3. If bot is offline/fails:
     - Update household_claims:
       - claim_status = 'FAILED'
       - claims_bot_response = { error: {error details} }
     - Create audit_log entry:
       - event_type: 'CLAIMS_BOT_FAILED'
       - customer_id: {customer ID}
       - details: {
           claim_id: {claim ID},
           error: {error message},
           is_1000_day_household: {true/false}
         }
     - Show immediate USSD response (don't block user):
       "Your self-proclamation has been recorded. You should receive an SMS shortly..."

  4. Manual retry process:
     - SupaMoto staff query failed claims:
       SELECT * FROM household_claims WHERE claim_status = 'FAILED'
     - Re-invoke claims bot when available
     - Update claim_status to 'PROCESSED' or 'VOUCHER_ALLOCATED'
     - Send SMS to customer if voucher allocated
```

---

### 7.7 Duplicate Operations

**LG Registers Intent Twice:**

- System allows multiple intent registrations
- Each generates a new OTP (previous OTPs remain in database)
- Only the most recent valid OTP should be used

**Customer Claims 1,000 Day Household Multiple Times:**

- System allows multiple claims (no special logic in USSD)
- Backend (claims bot) handles duplicate detection
- Each claim creates a new record in household_claims table

**Customer Confirms Receipt Multiple Times:**

- System allows multiple confirmations
- Use LAST submission as final answer
- Update bean_delivery_confirmations.customer_confirmed_at each time
- Token transfer logic checks current state, not history

---

## 8. Implementation Phases

### Phase 1: Database & Configuration ✅

**Tasks:**

1. Create migration `migrations/postgres/004-bean-distribution-and-audit.sql`
2. Update `src/config.ts` with USSD configuration section
3. Update `.env.example` with new environment variables
4. Run migration on development database
5. Verify all tables, indexes, and comments created correctly

**Verification:**

```sql
-- Check tables exist
\dt lg_delivery_intents
\dt bean_distribution_otps
\dt bean_delivery_confirmations
\dt household_claims
\dt audit_log

-- Check indexes
\di idx_lg_intents_*
\di idx_bean_otps_*
\di idx_bean_confirmations_*
\di idx_household_claims_*
\di idx_audit_log_*
```

---

### Phase 2: SMS Templates & Service

**Tasks:**

1. Create `src/templates/sms/` directory structure
2. Implement `activation.ts` with activation and lockout templates
3. Implement `household.ts` with voucher allocation template
4. Implement `otp.ts` with all OTP-related templates
5. Implement `delivery.ts` with token transfer template
6. Implement `index.ts` to export all templates
7. Update `src/services/sms.ts` with retry logic
8. Add `sendSMSWithRetry()` function
9. Add audit logging to SMS service
10. Test SMS sending with retry logic in development

**Verification:**

- All templates use `config.ZM.SERVICE_CODES[0]` for service code
- All templates provide step-by-step menu navigation
- Retry logic follows exponential delay pattern (0s, 10s, 30s)
- Failed SMS attempts create audit_log entries
- SMS stub mode works correctly in development

---

### Phase 3: Database Service Methods

**Tasks:**

1. Add methods to `src/services/database-storage.ts`:
   - `createLGIntent(customerId, lgCustomerId, voucherStatus, voucherResponse)`
   - `createOTP(customerId, lgCustomerId, intentId, validityMinutes)`
   - `validateOTP(customerId, otp)` - Returns OTP record or null
   - `markOTPAsUsed(otpId)`
   - `createDeliveryConfirmation(customerId, lgCustomerId, otpId, deadlineDays)`
   - `updateDeliveryConfirmation(confirmationId, updates)`
   - `getDeliveryConfirmation(customerId, lgCustomerId)`
   - `createHouseholdClaim(customerId, is1000DayHousehold)`
   - `updateHouseholdClaim(claimId, updates)`
   - `createAuditLog(eventType, customerId, lgCustomerId, details)`
   - `checkConfirmationDeadline(confirmationId)` - Returns boolean
2. Add TypeScript interfaces for all new database records
3. Write unit tests for all new methods
4. Test database operations in development

**Verification:**

- All methods handle errors gracefully
- All methods log appropriate information
- TypeScript types are correct and complete
- Unit tests pass

---

### Phase 4: Forced PIN Change Flow

**Tasks:**

1. Create `src/machines/supamoto/pin-change/pinChangeMachine.ts`
2. Implement states:
   - `enterNewPin` - Prompt for new 5-digit PIN
   - `confirmNewPin` - Prompt to confirm PIN
   - `updatingPin` - Update database
   - `success` - Show success message
   - `error` - Handle errors
3. Add validation guards:
   - `isValidPin` - Check 5 digits format
   - `pinsMatch` - Check new PIN matches confirmation
4. Add actions:
   - `setNewPin` - Store new PIN in context
   - `setConfirmPin` - Store confirmation PIN in context
   - `showPinMismatchError` - Show error when PINs don't match
   - `showInvalidFormatError` - Show error for invalid format
5. Implement `updatePinService` actor
6. Integrate with `parentMachine.ts`:
   - Add `forcePinChange` state after successful login
   - Check if PIN change required (temp PIN or force_pin_change flag)
   - Redirect to Services menu after successful PIN change
7. Write tests for PIN change flow

**Verification:**

- PIN validation works correctly (5 digits only)
- PIN mismatch shows appropriate error
- Invalid format shows appropriate error
- Infinite retries allowed (until session timeout)
- PIN successfully updated in database
- Redirects to Services menu after success

---

### Phase 5: Login Flow Updates

**Tasks:**

1. Update `src/machines/supamoto/account-login/loginMachine.ts`:
   - Add `failedAttempts: number` to context (default: 0)
   - Increment counter on failed PIN validation
   - Show attempt counter in error messages
   - On 3rd failure:
     - Delete customers.encrypted_pin (set to NULL)
     - Send SMS: `accountLockedSMS(customerId)`
     - Show lockout message
     - Create audit_log entry
   - Reset counter on successful login
2. Update error messages:
   - Attempt 1: "Incorrect PIN. Please try again. (Attempt 1 of 3)"
   - Attempt 2: "Incorrect PIN. Please try again. (Attempt 2 of 3)\nWARNING: Your account will be locked after one more failed attempt."
   - Attempt 3: "Your USSD account has been locked..."
3. Add `lockAccountService` actor
4. Update tests for new login behavior

**Verification:**

- Failed attempt counter increments correctly
- Counter resets on successful login
- Counter does NOT persist across sessions
- Account locks after 3rd failed attempt
- PIN is deleted from database
- SMS sent to customer
- Audit log entry created
- Appropriate error messages shown

---

### Phase 6: Services Menu Restructure

**Tasks:**

1. Rename "User Services" to "Services" in:
   - `src/machines/supamoto/parentMachine.ts`
   - Pre-menu message builder
2. Update `src/machines/supamoto/user-services/userServicesMachine.ts`:
   - Remove states: `account`, `balances`, `orders`, `vouchers`
   - Remove all related substates
   - Update `buildMenuMessage()` for role-based routing:
     - For 'customer' role: Show "Customer Tools"
     - For agent roles: Show "Agent Tools"
     - Do NOT show both
3. Update navigation:
   - Remove routes to deleted states
   - Add route to Customer Tools (for customers)
   - Keep route to Agent Tools (for agents)
4. Update tests for new menu structure

**Verification:**

- Menu renamed to "Services"
- Customers see only "Customer Tools"
- Agents see only "Agent Tools"
- No access to Account/Balances/Orders/Vouchers
- Navigation works correctly
- Tests pass

---

### Phase 7: Customer Tools Implementation

**Tasks:**

1. Create `src/machines/supamoto/customer-tools/customerToolsMachine.ts`
2. Implement states:
   - `menu` - Show Customer Tools menu
   - `householdClaimQuestion` - Ask 1,000 Day Household question
   - `submittingClaim` - Submit claim to database and claims bot
   - `claimSubmitted` - Show confirmation message
   - `confirmReceiptQuestion` - Ask if beans received
   - `submittingReceipt` - Update delivery confirmation
   - `receiptSubmitted` - Show confirmation message
   - `routeToMain` - Final state to return to parent
3. Implement actors:
   - `submitHouseholdClaimService` - Insert claim, call claims bot
   - `submitReceiptConfirmationService` - Update delivery confirmation
4. Add guards:
   - `isInput1` - Select 1,000 Day Household
   - `isInput2` - Select Confirm Receival
   - `isYes` - Customer selected Yes
   - `isNo` - Customer selected No
5. Integrate with `userServicesMachine.ts`:
   - Add `customerTools` state
   - Invoke `customerToolsMachine`
   - Handle onDone/onError
6. Write tests for Customer Tools

**Verification:**

- Menu displays correctly
- 1,000 Day Household claim flow works
- Claim submitted to database
- Claims bot called (async, non-blocking)
- Immediate USSD response shown
- Confirm Receival flow works
- Delivery confirmation updated
- Audit log created for denied receipts
- Navigation works correctly

---

### Phase 8: Agent Tools Restructure

**Tasks:**

1. Update `src/machines/supamoto/user-services/userServicesMachine.ts`:
   - Update Agent Tools menu message:
     ```
     Agent Tools
     1. Activate a Customer
     2. Register Intent to Deliver Beans
     3. Submit Customer OTP
     4. Confirm Bean Delivery
     0. Back
     ```
2. Rename existing "Activate Customer" to "Activate a Customer"
3. Implement new states:
   - `agentRegisterIntent` - Register intent flow
   - `agentSubmitOTP` - Submit OTP flow
   - `agentConfirmDelivery` - Confirm delivery flow
4. Implement actors:
   - `registerIntentService` - Create intent, check voucher, generate OTP
   - `submitOTPService` - Validate OTP, create confirmation
   - `confirmDeliveryService` - Update delivery confirmation
5. Add navigation routes for new states
6. Update tests for Agent Tools

**Verification:**

- Menu displays correctly with 4 options
- "Activate a Customer" works (existing functionality)
- "Register Intent to Deliver Beans" flow works
- "Submit Customer OTP" flow works
- "Confirm Bean Delivery" flow works
- All SMS messages sent correctly
- All database records created/updated
- Navigation works correctly

---

### Phase 9: Integration Testing

**Test Scenarios:**

1. **Complete Customer Activation Flow:**
   - LG activates customer
   - Customer receives SMS
   - Customer logs in with temp PIN
   - Customer forced to change PIN
   - Customer redirects to Services menu

2. **1,000 Day Household Claim Flow:**
   - Customer logs in
   - Customer accesses Customer Tools
   - Customer makes claim (Yes)
   - Claim submitted to database
   - Claims bot called
   - Customer receives immediate response
   - Customer receives SMS after approval

3. **Bean Distribution Flow (End-to-End):**
   - Customer makes 1,000 Day Household claim
   - Customer receives voucher allocation SMS
   - LG registers intent to deliver beans
   - System checks voucher (has voucher)
   - OTP generated and sent to customer
   - LG receives confirmation SMS
   - Customer shows OTP to LG
   - LG submits OTP
   - OTP validated successfully
   - LG receives delivery confirmation SMS
   - LG delivers beans
   - LG confirms delivery
   - Customer confirms receipt (Yes)
   - Token transferred
   - LG receives token transfer SMS

4. **Error Scenarios:**
   - Failed PIN attempts (3 strikes)
   - Expired OTP
   - Invalid OTP
   - Customer denies receipt
   - Confirmation deadline expired
   - SMS send failures
   - Claims bot offline

5. **Edge Cases:**
   - Customer changes receipt answer (No → Yes)
   - LG registers intent multiple times
   - Customer makes multiple claims
   - Confirmations in different orders (LG first vs Customer first)

**Verification:**

- All flows work end-to-end
- All SMS messages sent correctly
- All database records created/updated
- All audit logs created
- Error handling works correctly
- Edge cases handled properly

---

### Phase 10: Documentation & Deployment

**Tasks:**

1. **Update Documentation:**
   - Update `README.md` with new menu structure
   - Update API documentation
   - Create user guide for customers
   - Create user guide for Lead Generators
   - Document all new environment variables
   - Document database schema changes
   - Document SMS templates

2. **Create Deployment Guide:**
   - Database migration steps
   - Environment variable configuration
   - SMS service configuration
   - Testing checklist
   - Rollback procedures

3. **Staging Deployment:**
   - Deploy to staging environment
   - Run database migration
   - Configure environment variables
   - Test all flows in staging
   - Verify SMS sending works
   - Verify external service integrations (claims bot, subscriptions service)

4. **User Acceptance Testing:**
   - Test with real users (customers and LGs)
   - Gather feedback
   - Fix any issues found
   - Re-test

5. **Production Deployment:**
   - Schedule deployment window
   - Backup production database
   - Run database migration
   - Deploy application
   - Verify all services running
   - Monitor logs for errors
   - Test critical flows
   - Monitor SMS sending
   - Monitor audit logs

6. **Post-Deployment:**
   - Monitor system for 24-48 hours
   - Check audit logs for issues
   - Verify SMS delivery rates
   - Check database performance
   - Gather user feedback
   - Address any issues

**Verification:**

- All documentation updated
- Deployment guide complete
- Staging deployment successful
- UAT completed
- Production deployment successful
- No critical issues in production
- Users able to complete all flows
- SMS delivery working
- Audit logs capturing events

---

## 9. Testing Checklist

### Unit Tests

- [ ] SMS template functions return correct messages
- [ ] SMS retry logic works with exponential delays
- [ ] Database service methods work correctly
- [ ] PIN validation guards work
- [ ] OTP validation logic works
- [ ] Confirmation deadline checking works
- [ ] Audit log creation works

### Integration Tests

- [ ] Customer activation flow (LG → Customer)
- [ ] Forced PIN change flow
- [ ] Login with 3-attempt lockout
- [ ] 1,000 Day Household claim submission
- [ ] Bean distribution intent registration
- [ ] OTP generation and validation
- [ ] Delivery confirmations (both LG and Customer)
- [ ] Token transfer logic
- [ ] SMS sending with retries
- [ ] Audit log entries created

### End-to-End Tests

- [ ] Complete customer journey (activation → claim → beans)
- [ ] Complete LG journey (activate → register → OTP → deliver → confirm)
- [ ] Error scenarios (expired OTP, denied receipt, etc.)
- [ ] Edge cases (multiple claims, changed answers, etc.)

### Manual Testing

- [ ] USSD menu navigation works
- [ ] All messages display correctly
- [ ] SMS messages received
- [ ] Database records created correctly
- [ ] External service integrations work
- [ ] Error messages are clear and helpful

---

## 10. Rollback Plan

### If Issues Found After Deployment

**Immediate Actions:**

1. Assess severity of issue
2. Check if rollback is necessary
3. Notify stakeholders

**Database Rollback:**

```sql
-- Rollback migration 004
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS household_claims;
DROP TABLE IF EXISTS bean_delivery_confirmations;
DROP TABLE IF EXISTS bean_distribution_otps;
DROP TABLE IF EXISTS lg_delivery_intents;
```

**Application Rollback:**

1. Deploy previous version of application
2. Restart services
3. Verify old functionality works
4. Monitor for stability

**Data Preservation:**
If rollback needed but data should be preserved:

```sql
-- Rename tables instead of dropping
ALTER TABLE lg_delivery_intents RENAME TO lg_delivery_intents_backup;
ALTER TABLE bean_distribution_otps RENAME TO bean_distribution_otps_backup;
ALTER TABLE bean_delivery_confirmations RENAME TO bean_delivery_confirmations_backup;
ALTER TABLE household_claims RENAME TO household_claims_backup;
ALTER TABLE audit_log RENAME TO audit_log_backup;
```

**Post-Rollback:**

1. Investigate root cause
2. Fix issues in development
3. Re-test thoroughly
4. Plan new deployment

---

## 11. Monitoring & Maintenance

### Key Metrics to Monitor

**USSD Usage:**

- Number of customer activations per day
- Number of 1,000 Day Household claims per day
- Number of bean distributions per day
- Average time to complete flows

**Error Rates:**

- Failed PIN attempts
- Account lockouts
- Expired OTPs
- Denied bean receipts
- Confirmation deadline expirations

**SMS Performance:**

- SMS delivery success rate
- SMS retry attempts
- Failed SMS sends
- Average SMS delivery time

**Database Performance:**

- Query performance on new tables
- Index usage
- Table sizes
- Slow queries

### Audit Log Queries

**Failed SMS Sends:**

```sql
SELECT * FROM audit_log
WHERE event_type = 'SMS_FAILED'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

**Account Lockouts:**

```sql
SELECT * FROM audit_log
WHERE event_type = 'ACCOUNT_LOCKED'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

**Denied Bean Receipts:**

```sql
SELECT * FROM audit_log
WHERE event_type = 'BEAN_RECEIPT_DENIED'
  AND created_at > NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;
```

**Expired Confirmations:**

```sql
SELECT * FROM bean_delivery_confirmations
WHERE confirmation_deadline < NOW()
  AND token_transferred_at IS NULL
ORDER BY confirmation_deadline DESC;
```

### Maintenance Tasks

**Daily:**

- Check audit logs for critical errors
- Monitor SMS delivery rates
- Check for failed claims bot submissions

**Weekly:**

- Review expired confirmations
- Check database performance
- Review user feedback

**Monthly:**

- Analyze usage patterns
- Review and optimize slow queries
- Clean up old audit logs (if needed)
- Generate reports for stakeholders

---

## 12. Success Criteria

### Technical Success

- [ ] All database migrations run successfully
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] No critical bugs in production
- [ ] SMS delivery rate > 95%
- [ ] Average USSD response time < 2 seconds
- [ ] Zero data loss incidents

### Business Success

- [ ] Customers can activate accounts successfully
- [ ] Customers can make 1,000 Day Household claims
- [ ] Bean distribution workflow completes end-to-end
- [ ] Lead Generators can perform all agent functions
- [ ] User satisfaction with new menu structure
- [ ] Reduction in call center support requests

### User Experience Success

- [ ] Clear and understandable menu structure
- [ ] Helpful error messages
- [ ] Smooth navigation flow
- [ ] Minimal user confusion
- [ ] Positive feedback from users

---

## Appendix A: Environment Variables Reference

```bash
# Database
DATABASE_URL=postgres://user:password@host:port/database

# Logging
LOG_LEVEL=info
LOG_NAME=ixo-ussd

# Security
PIN_ENCRYPTION_KEY=your-encryption-key-here
SYSTEM_SECRET=your-system-secret-here

# SMS (Africa's Talking)
SMS_ENABLED=true
AFRICASTALKING_API_KEY=your-api-key-here
AFRICASTALKING_USERNAME=your-username-here
AFRICASTALKING_SENDER_ID=SupaMoto

# USSD Configuration
OTP_VALIDITY_MINUTES=10
MAX_PIN_ATTEMPTS=3
DELIVERY_CONFIRMATION_DAYS=7
SMS_RETRY_ATTEMPTS=3

# Service Codes
ZM_SERVICE_CODES=*2233#
ZM_SUPPORT_PHONE=0700000000

# External Services
MATRIX_HOME_SERVER=https://matrix.example.com
MATRIX_BOT_URL=https://claims-bot.example.com
MATRIX_STATE_BOT_URL=https://state-bot.example.com
```

---

## Appendix B: Database Schema Diagram

```
customers
├── id (PK)
├── customer_id (UNIQUE)
├── encrypted_pin
├── role (customer | lead_generator | call_center | admin)
└── ...

lg_delivery_intents
├── id (PK)
├── customer_id (FK → customers.customer_id)
├── lg_customer_id (FK → customers.customer_id)
├── voucher_status
└── voucher_check_response (JSONB)

bean_distribution_otps
├── id (PK)
├── customer_id (FK → customers.customer_id)
├── lg_customer_id (FK → customers.customer_id)
├── intent_id (FK → lg_delivery_intents.id)
├── otp
├── expires_at
└── is_valid

bean_delivery_confirmations
├── id (PK)
├── customer_id (FK → customers.customer_id)
├── lg_customer_id (FK → customers.customer_id)
├── otp_id (FK → bean_distribution_otps.id)
├── lg_confirmed_at
├── customer_confirmed_at
├── customer_confirmed_receipt
├── token_transferred_at
└── confirmation_deadline

household_claims
├── id (PK)
├── customer_id (FK → customers.customer_id)
├── is_1000_day_household
├── claim_status
├── bean_voucher_allocated
└── claims_bot_response (JSONB)

audit_log
├── id (PK)
├── event_type
├── customer_id
├── lg_customer_id
└── details (JSONB)
```

---

**Document Version:** 1.0
**Last Updated:** 2025-10-15
**Author:** Augment Agent
**Status:** Ready for Implementation
