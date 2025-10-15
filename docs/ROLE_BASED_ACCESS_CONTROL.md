# Role-Based Access Control (RBAC) System

## Overview

The SupaMoto USSD application implements a role-based access control system to restrict access to sensitive features like Agent Tools to authorized personnel only. This document explains the RBAC system, how to use it, and security considerations.

## Role Types

The system supports four distinct roles:

### 1. `customer` (Default)

- **Description**: Regular customers who use the USSD service
- **Access**: Can access all standard customer features:
  - Account information
  - Balance checking
  - Order history
  - Vouchers
- **Restrictions**: Cannot access Agent Tools

### 2. `lead_generator`

- **Description**: Lead Generators who work at distribution points
- **Access**: All customer features PLUS:
  - Agent Tools menu
  - Customer activation (verify customer ID, send temp PIN)
  - PIN reset for customers
- **Use Case**: Field agents who help customers activate their accounts

### 3. `call_center`

- **Description**: Call center agents who provide customer support
- **Access**: All customer features PLUS:
  - Agent Tools menu
  - Customer activation
  - PIN reset for customers
  - (Future: Additional support tools)
- **Use Case**: Remote support staff who assist customers via phone

### 4. `admin`

- **Description**: System administrators
- **Access**: Full access to all features
- **Use Case**: Technical staff and system managers

## Database Schema

### Migration: `003-add-customer-roles.sql`

```sql
-- Add role column to customers table
ALTER TABLE customers
ADD COLUMN role VARCHAR(20) DEFAULT 'customer'
CHECK (role IN ('customer', 'lead_generator', 'call_center', 'admin'));

-- Create index for performance
CREATE INDEX idx_customers_role ON customers(role);
```

### Table Structure

```
customers
├── id (SERIAL PRIMARY KEY)
├── customer_id (VARCHAR(10) UNIQUE)
├── full_name (VARCHAR(255))
├── email (VARCHAR(255))
├── encrypted_pin (TEXT)
├── preferred_language (VARCHAR(10))
├── date_added (TIMESTAMP)
├── last_completed_action (TEXT)
├── household_id (INTEGER)
├── role (VARCHAR(20)) ← NEW
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)
```

## How It Works

### 1. Login Flow

When a user logs in:

1. **Customer enters Customer ID and PIN**
2. **System retrieves customer record** (including role)
3. **Role is stored in session context**
4. **Role is passed to User Services machine**

```typescript
// In parentMachine.ts - After successful login
assign(({ event }) => {
  const output = event.output as any;
  return {
    customerName: output?.customer?.fullName || "Existing User",
    customerRole: output?.customer?.role || "customer", // ← Role stored
    isAuthenticated: true,
    sessionPin: output?.sessionPin,
  };
});
```

### 2. Dynamic Menu Display

The User Services menu is dynamically generated based on the user's role:

```typescript
// In userServicesMachine.ts
const buildMenuMessage = (role?: string): string => {
  const isAgent =
    role === "lead_generator" || role === "call_center" || role === "admin";

  return (
    "User Services\n" +
    "1. Account\n" +
    "2. Balances\n" +
    "3. Orders\n" +
    "4. Vouchers\n" +
    (isAgent ? "5. Agent Tools\n" : "") + // ← Only shown to agents
    "0. Back"
  );
};
```

**Result:**

- **Regular customers** see options 1-4 only
- **Agents** (LG, call center, admin) see options 1-5

### 3. Access Control Guard

A guard prevents unauthorized access even if someone tries to manually enter "5":

```typescript
// In userServicesMachine.ts
guards: {
  isInput5AndIsAgent: ({ event, context }) => {
    if (!navigationGuards.isInput("5")(null as any, event as any)) {
      return false;
    }
    const role = context.customerRole;
    return (
      role === "lead_generator" ||
      role === "call_center" ||
      role === "admin"
    );
  },
}
```

### 4. Security Logging

Unauthorized access attempts are logged for security monitoring:

```typescript
{
  target: "menu",
  guard: "isInput5", // Input is 5 but not an agent
  actions: assign(({ context }) => {
    // Log unauthorized access attempt
    console.warn(
      `[SECURITY] Unauthorized Agent Tools access attempt - ` +
      `Phone: ${context.phoneNumber.slice(-4)}, ` +
      `Role: ${context.customerRole || "unknown"}`
    );
    return {
      message:
        "Access denied. Agent Tools are only available to authorized personnel.\n\n" +
        buildMenuMessage(context.customerRole),
    };
  }),
}
```

## Assigning Agent Roles

### Method 1: Database Service (Recommended)

Use the `assignAgentRole` method for programmatic role assignment:

```typescript
import { dataService } from "./services/database-storage.js";

// Assign Lead Generator role
await dataService.assignAgentRole(
  "C12345678", // Customer ID
  "lead_generator", // New role
  "A99999999" // Admin who assigned the role
);

// Assign Call Center role
await dataService.assignAgentRole("C87654321", "call_center", "A99999999");
```

**Features:**

- ✅ Automatic logging for audit trail
- ✅ Type-safe role values
- ✅ Records who assigned the role

### Method 2: Direct SQL (For Initial Setup)

For bulk assignment or initial setup:

```sql
-- Assign Lead Generator role
UPDATE customers
SET role = 'lead_generator', updated_at = NOW()
WHERE customer_id = 'C12345678';

-- Assign Call Center role
UPDATE customers
SET role = 'call_center', updated_at = NOW()
WHERE customer_id IN ('C11111111', 'C22222222', 'C33333333');

-- Assign Admin role
UPDATE customers
SET role = 'admin', updated_at = NOW()
WHERE customer_id = 'A99999999';
```

### Method 3: During Customer Creation

When creating a new customer programmatically, you can set the role:

```sql
INSERT INTO customers (
  customer_id, full_name, email, encrypted_pin,
  preferred_language, role, created_at, updated_at
) VALUES (
  'L12345678', 'John Doe', 'john@example.com', 'encrypted_pin_here',
  'eng', 'lead_generator', NOW(), NOW()
);
```

## Security Considerations

### 1. Defense in Depth

The system implements multiple layers of security:

1. **UI Layer**: Menu option not displayed to non-agents
2. **Guard Layer**: Access attempt blocked by guard
3. **Logging Layer**: Unauthorized attempts logged
4. **Database Layer**: Role validated at data level

### 2. Audit Trail

All role assignments are logged:

```typescript
logger.info(
  {
    customerId: customerId.slice(-4),
    newRole: role,
    assignedBy: assignedBy.slice(-4),
  },
  "Agent role assigned successfully"
);
```

**Recommended**: Implement a separate `role_assignments` audit table:

```sql
CREATE TABLE role_assignments (
  id SERIAL PRIMARY KEY,
  customer_id VARCHAR(10) NOT NULL,
  old_role VARCHAR(20),
  new_role VARCHAR(20) NOT NULL,
  assigned_by VARCHAR(10) NOT NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
  reason TEXT
);
```

### 3. Principle of Least Privilege

- New customers default to `customer` role
- Role elevation requires explicit action
- Roles cannot be self-assigned (requires admin)

### 4. Session Security

- Role is stored in session context (not persistent across sessions)
- Role is re-validated on each login
- No client-side role manipulation possible

## Testing

### Test Scenarios

1. **Regular Customer Cannot Access Agent Tools**

   ```
   Login as customer → User Services → Option 5 not visible
   ```

2. **Lead Generator Can Access Agent Tools**

   ```
   Login as lead_generator → User Services → Option 5 visible → Access granted
   ```

3. **Unauthorized Access Attempt Blocked**

   ```
   Login as customer → Manually enter "5" → Access denied message shown
   ```

4. **Security Logging Works**
   ```
   Login as customer → Enter "5" → Check logs for security warning
   ```

### Running Tests

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test loginMachine.test.ts

# Build and verify
pnpm build
```

## Future Enhancements

### 1. Granular Permissions

Instead of role-based, implement permission-based access:

```typescript
interface Permissions {
  canActivateCustomers: boolean;
  canResetPins: boolean;
  canViewReports: boolean;
  canManageAgents: boolean;
}
```

### 2. Role Hierarchy

Implement role inheritance:

```
admin > call_center > lead_generator > customer
```

### 3. Time-Limited Roles

Add expiration dates for temporary agent access:

```sql
ALTER TABLE customers
ADD COLUMN role_expires_at TIMESTAMP NULL;
```

### 4. Multi-Role Support

Allow users to have multiple roles:

```sql
CREATE TABLE customer_roles (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  role VARCHAR(20) NOT NULL,
  granted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  granted_by VARCHAR(10) NOT NULL,
  expires_at TIMESTAMP NULL
);
```

## Troubleshooting

### Issue: Agent cannot see Agent Tools option

**Check:**

1. Verify role in database: `SELECT customer_id, role FROM customers WHERE customer_id = 'C12345678';`
2. Check if role is passed to User Services machine
3. Verify guard logic in `userServicesMachine.ts`

### Issue: Customer can access Agent Tools

**Check:**

1. Verify guard is properly configured
2. Check if role is being overridden somewhere
3. Review security logs for unauthorized access

### Issue: Role not persisting after login

**Check:**

1. Verify role is returned from `getCustomerByCustomerId`
2. Check if role is stored in parent context after login
3. Verify role is passed to User Services machine input

## References

- Database Migration: `migrations/postgres/003-add-customer-roles.sql`
- Type Definitions: `src/db/index.ts`, `src/services/database-storage.ts`
- Parent Machine: `src/machines/supamoto/parentMachine.ts`
- User Services Machine: `src/machines/supamoto/user-services/userServicesMachine.ts`
- Login Machine: `src/machines/supamoto/account-login/loginMachine.ts`
