# SupaMoto USSD Menu Structure

This document describes the complete USSD menu navigation structure for SupaMoto, including all menu options, submenus, and navigation flows.

## Menu Hierarchy Overview

```
USSD Session Start (*2233#)
│
├─ Pre-Menu (Main Entry Point)
│  ├─ 1. Know More
│  ├─ 2. Account Menu
│  ├─ 3. Services (if authenticated)
│  └─ *. Exit
│
├─ Know More (Information Services)
│  └─ SMS-based information flows
│
├─ Account Menu
│  ├─ 1. Login
│  ├─ 2. Create Account
│  └─ 0. Back
│
├─ Services (Role-Based)
│  ├─ Customer Tools (role = "customer")
│  │  ├─ 1. 1,000 Day Household
│  │  ├─ 2. Confirm Receival of Beans
│  │  └─ 0. Back
│  │
│  └─ Agent Tools (role = "lead_generator", "call_center", "admin")
│     ├─ 1. Activate a Customer
│     ├─ 2. Register Intent to Deliver Beans
│     ├─ 3. Submit Customer OTP
│     ├─ 4. Confirm Bean Delivery
│     └─ 0. Back
│
└─ Exit / Close Session
```

## Detailed Menu Flows

### 1. Pre-Menu (Main Entry Point)

**State**: `preMenu`  
**Message**:

```
Welcome to SupaMoto!
1. Know More
2. Account Menu
3. Services
*. Exit
```

**Navigation**:

- Input `1` → Know More Machine
- Input `2` → Account Menu Machine
- Input `3` → User Services Machine (if authenticated)
- Input `*` → Close Session

**Context**:

- `isAuthenticated`: Determines if option 3 is shown
- `phoneNumber`: Captured from USSD dial
- `serviceCode`: USSD service code (e.g., `*2233#`)

---

### 2. Know More (Information Services)

**State**: `knowMore`  
**Purpose**: Provide information via SMS responses  
**Implementation**: Delegates to `knowMoreMachine`

**Features**:

- SMS-based information delivery
- No authentication required
- Returns to Pre-Menu after completion

---

### 3. Account Menu

**State**: `accountMenu`  
**Message**:

```
Account Menu
1. Login
2. Create Account
0. Back
```

**Navigation**:

- Input `1` → Login Machine
- Input `2` → Account Creation Machine
- Input `0` → Back to Pre-Menu
- Input `*` → Exit

#### 3.1 Login Flow

**State**: `login`  
**Process**:

1. Prompt for Customer ID
2. Prompt for PIN
3. Validate credentials against database
4. On success: Set `isAuthenticated = true`, `customerId`, `customerRole`
5. On failure: Show error, retry or back to Account Menu

**Database Query**: `customers` table lookup by `customer_id` and `encrypted_pin`

**Output**: Returns to Pre-Menu with authenticated session

#### 3.2 Account Creation Flow

**State**: `accountCreation`  
**Process**:

1. Prompt for phone number
2. Generate Customer ID (format: C + 8 digits)
3. Prompt for PIN (6 digits)
4. Confirm PIN
5. Create customer record in database
6. Set `isAuthenticated = true`

**Database Insert**: New row in `customers` table with:

- `customer_id`: Generated ID
- `phone_number`: From input
- `encrypted_pin`: Bcrypt-encrypted PIN
- `role`: "customer" (default)
- `date_added`: Current timestamp

**Output**: Returns to Pre-Menu with authenticated session

---

### 4. Services Menu (Role-Based)

**State**: `userMainMenu` → `userServicesMachine`  
**Prerequisite**: User must be authenticated

**Role-Based Routing**:

- **Customer** (`role = "customer"`): Shows Customer Tools
- **Lead Generator** (`role = "lead_generator"`): Shows Agent Tools
- **Call Center** (`role = "call_center"`): Shows Agent Tools
- **Admin** (`role = "admin"`): Shows Agent Tools

#### 4.1 Customer Tools

**State**: `customerTools`  
**Message**:

```
Customer Tools
1. 1,000 Day Household
2. Confirm Receival of Beans
0. Back
```

**Navigation**:

- Input `1` → 1,000 Day Household Claim
- Input `2` → Confirm Bean Receipt
- Input `0` → Back to Services Menu
- Input `*` → Exit

##### 4.1.1 1,000 Day Household Claim

**State**: `householdClaimQuestion`  
**Message**:

```
A 1,000 Day Household is a family with a pregnant or breastfeeding mother,
or a child younger than two years old.

Do you have an eligible 1,000 Day Household?
1. Yes
2. No
0. Back
```

**Process**:

1. Display eligibility criteria
2. Capture customer response (Yes/No)
3. Submit claim to IXO blockchain
4. Store in `household_claims` table
5. Show confirmation message
6. Return to Customer Tools menu

**Database Insert**: `household_claims` table with:

- `customer_id`: From session
- `is_1000_day_household`: Boolean from input
- `claim_submitted_at`: Current timestamp
- `claim_status`: "PENDING" initially

**Output**: Confirmation message, return to Customer Tools

##### 4.1.2 Confirm Receival of Beans

**State**: `confirmReceiptQuestion`  
**Message**:

```
Did you receive a bag of beans from your Lead Generator?
1. Yes
2. No
0. Back
```

**Process**:

1. Prompt customer for bean receipt confirmation
2. If Yes: Update `bean_delivery_confirmations` table
3. If No: Log denial in `audit_log` table
4. Show confirmation message
5. Return to Customer Tools menu

**Database Updates**:

- `bean_delivery_confirmations`: Set `customer_confirmed_at` and `customer_confirmed_receipt`
- `audit_log`: Log event with type "BEAN_RECEIPT_DENIED" if No

**Output**: Confirmation message, return to Customer Tools

#### 4.2 Agent Tools (Lead Generator)

**State**: `agent`  
**Message**:

```
Agent Tools
1. Activate a Customer
2. Register Intent to Deliver Beans
3. Submit Customer OTP
4. Confirm Bean Delivery
0. Back
```

**Navigation**:

- Input `1` → Activate Customer
- Input `2` → Register Intent (Stub)
- Input `3` → Submit OTP (Stub)
- Input `4` → Confirm Delivery (Stub)
- Input `0` → Back to Services Menu
- Input `*` → Exit

##### 4.2.1 Activate a Customer

**State**: `agentActivateCustomer`  
**Process**:

1. LG enters customer phone number
2. System generates temporary PIN (6 digits)
3. Send activation SMS to customer with temp PIN
4. Wait for customer to activate in separate session
5. Return to Agent Tools menu

**Database Operations**:

- Insert into `customers` table (if new customer)
- Update `customers.encrypted_pin` with temporary PIN
- Log event in `audit_log` table

**SMS Sent**: Activation SMS with Customer ID and temporary PIN

**Output**: Confirmation message, return to Agent Tools

##### 4.2.2 Register Intent to Deliver Beans

**State**: `agentRegisterIntent`  
**Status**: Stub (not yet implemented)  
**Message**: "[Stub] Register Intent to Deliver Beans not yet implemented."

**Planned Process**:

1. LG enters customer ID
2. System checks bean voucher eligibility
3. Send SMS to customer with OTP
4. Store intent in `lg_delivery_intents` table
5. Return to Agent Tools menu

##### 4.2.3 Submit Customer OTP

**State**: `agentSubmitOTP`  
**Status**: Stub (not yet implemented)  
**Message**: "[Stub] Submit Customer OTP not yet implemented."

**Planned Process**:

1. LG enters customer ID
2. LG enters OTP from customer
3. Validate OTP against `bean_distribution_otps` table
4. If valid: Update delivery confirmation
5. If invalid/expired: Send error SMS to LG
6. Return to Agent Tools menu

##### 4.2.4 Confirm Bean Delivery

**State**: `agentConfirmDelivery`  
**Status**: Stub (not yet implemented)  
**Message**: "[Stub] Confirm Bean Delivery not yet implemented."

**Planned Process**:

1. LG confirms beans delivered to customer
2. Update `bean_delivery_confirmations` table
3. Log event in `audit_log` table
4. Return to Agent Tools menu

---

## Navigation Patterns

### Back Navigation

- Input `0` → Back to previous menu
- Input `*` → Exit to close session
- Automatic back on error (with error message)

### Exit Navigation

- Input `*` → Close session immediately
- Displays goodbye message
- Session ends

### Error Handling

- Invalid input → Show error message, repeat menu
- Database error → Show error state, allow back/exit
- SMS failure → Log in audit_log, continue flow

---

## Session Management

### Session Context

- `sessionId`: Unique identifier for USSD session
- `phoneNumber`: Customer's phone number
- `serviceCode`: USSD service code
- `customerId`: Customer ID (if authenticated)
- `customerRole`: User role (customer, lead_generator, call_center, admin)
- `isAuthenticated`: Boolean flag for authentication status
- `sessionPin`: Ephemeral PIN for Matrix vault decryption

### Session Lifecycle

1. **Start**: DIAL_USSD event triggers session initialization
2. **Active**: User navigates menus, provides input
3. **End**: User selects exit or session timeout
4. **Close**: Session data cleared, goodbye message sent

---

## State Machine Implementation

### Parent Machine (`supamotoMachine`)

- **File**: `src/machines/supamoto/parentMachine.ts`
- **States**: idle, preMenu, knowMore, accountMenu, login, accountCreation, userMainMenu, error, closeSession
- **Child Machines**: knowMoreMachine, accountMenuMachine, loginMachine, accountCreationMachine, userServicesMachine

### User Services Machine (`userServicesMachine`)

- **File**: `src/machines/supamoto/user-services/userServicesMachine.ts`
- **States**: menu, customerTools, agent, agentActivateCustomer, agentRegisterIntent, agentSubmitOTP, agentConfirmDelivery, error, routeToMain
- **Role-Based Guards**: Determines which submenu to show based on `customerRole`

### Customer Tools Machine (`customerToolsMachine`)

- **File**: `src/machines/supamoto/customer-tools/customerToolsMachine.ts`
- **States**: menu, householdClaimQuestion, confirmReceiptQuestion, submittingClaim, confirmingReceipt, error, routeToMain

### Customer Activation Machine (`customerActivationMachine`)

- **File**: `src/machines/supamoto/activation/customerActivationMachine.ts`
- **States**: verifyCustomer, enterPhone, sendingActivationSMS, waitingForCustomer, complete

---

## Configuration

### Service Codes

- Default: `*2233#`
- Configurable via `config.ZM.SERVICE_CODES`

### OTP Settings

- Validity: 10 minutes (configurable via `config.USSD.OTP_VALIDITY_MINUTES`)
- Format: 6 digits
- Generation: Random alphanumeric

### Branding

- Welcome message: Customizable in `src/constants/branding.ts`
- Goodbye message: Customizable in `src/constants/branding.ts`
- Menu messages: Defined in respective state machines
