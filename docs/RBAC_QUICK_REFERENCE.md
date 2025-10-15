# RBAC Quick Reference Guide

## Quick Start

### Check a User's Role

```sql
SELECT customer_id, full_name, role
FROM customers
WHERE customer_id = 'C12345678';
```

### Assign Agent Role

```typescript
// Using the database service (recommended)
import { dataService } from "./services/database-storage.js";

await dataService.assignAgentRole(
  "C12345678", // Customer ID to promote
  "lead_generator", // New role
  "ADMIN001" // Admin performing the action
);
```

```sql
-- Using SQL directly
UPDATE customers
SET role = 'lead_generator', updated_at = NOW()
WHERE customer_id = 'C12345678';
```

### Remove Agent Role (Demote to Customer)

```sql
UPDATE customers
SET role = 'customer', updated_at = NOW()
WHERE customer_id = 'C12345678';
```

## Role Comparison Table

| Feature             | customer | lead_generator | call_center | admin |
| ------------------- | -------- | -------------- | ----------- | ----- |
| Account Info        | ✅       | ✅             | ✅          | ✅    |
| Balances            | ✅       | ✅             | ✅          | ✅    |
| Orders              | ✅       | ✅             | ✅          | ✅    |
| Vouchers            | ✅       | ✅             | ✅          | ✅    |
| Agent Tools         | ❌       | ✅             | ✅          | ✅    |
| Customer Activation | ❌       | ✅             | ✅          | ✅    |
| PIN Reset           | ❌       | ✅             | ✅          | ✅    |

## Common SQL Queries

### List All Agents

```sql
SELECT customer_id, full_name, role, created_at
FROM customers
WHERE role IN ('lead_generator', 'call_center', 'admin')
ORDER BY role, full_name;
```

### Count Users by Role

```sql
SELECT role, COUNT(*) as count
FROM customers
GROUP BY role
ORDER BY count DESC;
```

### Find Recently Promoted Agents

```sql
SELECT customer_id, full_name, role, updated_at
FROM customers
WHERE role != 'customer'
  AND updated_at > NOW() - INTERVAL '7 days'
ORDER BY updated_at DESC;
```

### Bulk Assign Lead Generator Role

```sql
UPDATE customers
SET role = 'lead_generator', updated_at = NOW()
WHERE customer_id IN (
  'C12345678',
  'C87654321',
  'C11111111'
);
```

## User Experience by Role

### Regular Customer Login

```
1. Dial *2233#
2. Select "2. Account Menu"
3. Select "1. Yes, log me in"
4. Enter Customer ID: C12345678
5. Enter PIN: 12345
6. See User Services menu:
   ┌─────────────────────┐
   │ User Services       │
   │ 1. Account          │
   │ 2. Balances         │
   │ 3. Orders           │
   │ 4. Vouchers         │
   │ 0. Back             │
   └─────────────────────┘
```

### Lead Generator Login

```
1. Dial *2233#
2. Select "2. Account Menu"
3. Select "1. Yes, log me in"
4. Enter Customer ID: L12345678
5. Enter PIN: 12345
6. See User Services menu:
   ┌─────────────────────┐
   │ User Services       │
   │ 1. Account          │
   │ 2. Balances         │
   │ 3. Orders           │
   │ 4. Vouchers         │
   │ 5. Agent Tools      │ ← Extra option
   │ 0. Back             │
   └─────────────────────┘
```

## Security Checks

### Verify Access Control is Working

```bash
# 1. Login as regular customer
# 2. Try to access Agent Tools (enter "5")
# 3. Should see: "Access denied. Agent Tools are only available to authorized personnel."
# 4. Check logs for security warning:

grep "SECURITY.*Unauthorized Agent Tools access" /path/to/logs
```

### Monitor Unauthorized Access Attempts

```bash
# Real-time monitoring
tail -f /path/to/logs | grep "SECURITY"

# Count attempts in last hour
grep "SECURITY.*Unauthorized" /path/to/logs | grep "$(date +%Y-%m-%d\ %H)" | wc -l
```

## Troubleshooting

### Problem: Agent can't see Agent Tools

**Solution:**

```sql
-- 1. Check their role
SELECT customer_id, role FROM customers WHERE customer_id = 'L12345678';

-- 2. If role is 'customer', update it
UPDATE customers
SET role = 'lead_generator', updated_at = NOW()
WHERE customer_id = 'L12345678';

-- 3. Ask them to log out and log back in
```

### Problem: Customer can access Agent Tools

**Solution:**

```sql
-- 1. Check their role (should be 'customer')
SELECT customer_id, role FROM customers WHERE customer_id = 'C12345678';

-- 2. If role is not 'customer', fix it
UPDATE customers
SET role = 'customer', updated_at = NOW()
WHERE customer_id = 'C12345678';

-- 3. Check application logs for security issues
-- 4. Verify guard logic in userServicesMachine.ts
```

### Problem: New customers have wrong role

**Solution:**

```sql
-- Check default value
SELECT column_default
FROM information_schema.columns
WHERE table_name = 'customers'
  AND column_name = 'role';

-- Should return: 'customer'::character varying

-- If not, fix the default
ALTER TABLE customers
ALTER COLUMN role SET DEFAULT 'customer';
```

## Code Snippets

### Check Role in TypeScript

```typescript
// In a machine or service
const isAgent = (role?: string): boolean => {
  return (
    role === "lead_generator" || role === "call_center" || role === "admin"
  );
};

// Usage
if (isAgent(context.customerRole)) {
  // Allow agent action
} else {
  // Deny access
}
```

### Get Customer with Role

```typescript
import { dataService } from "./services/database-storage.js";

const customer = await dataService.getCustomerByCustomerId("C12345678");
console.log(customer.role); // 'customer' | 'lead_generator' | 'call_center' | 'admin'
```

### Log Security Event

```typescript
import { createModuleLogger } from "./services/logger.js";

const logger = createModuleLogger("security");

logger.warn(
  {
    customerId: customerId.slice(-4),
    phoneNumber: phoneNumber.slice(-4),
    attemptedAction: "ACCESS_AGENT_TOOLS",
    role: customerRole,
    timestamp: new Date().toISOString(),
  },
  "Unauthorized access attempt"
);
```

## Migration Commands

### Apply Migration

```bash
# PostgreSQL
psql -d your_database -f migrations/postgres/003-add-customer-roles.sql

# Or using a migration tool
pnpm migrate:up
```

### Verify Migration

```sql
-- Check column exists
\d customers

-- Check constraint
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'customers'::regclass
  AND conname LIKE '%role%';

-- Check index
\di idx_customers_role
```

### Rollback Migration

```sql
-- Remove column
ALTER TABLE customers DROP COLUMN role;

-- Drop index
DROP INDEX IF EXISTS idx_customers_role;
```

## Best Practices

### ✅ DO

- Always use `assignAgentRole()` method for role changes (includes logging)
- Verify role before granting agent access
- Monitor security logs regularly
- Use least privilege principle (default to 'customer')
- Document why someone was given agent role

### ❌ DON'T

- Don't allow users to self-assign roles
- Don't store role in client-side code
- Don't skip role validation checks
- Don't forget to log role changes
- Don't give admin role unnecessarily

## Testing Checklist

- [ ] Regular customer cannot see Agent Tools option
- [ ] Regular customer cannot access Agent Tools by entering "5"
- [ ] Lead Generator can see and access Agent Tools
- [ ] Call Center agent can see and access Agent Tools
- [ ] Admin can see and access Agent Tools
- [ ] Unauthorized access attempts are logged
- [ ] Role persists across login sessions
- [ ] New customers default to 'customer' role
- [ ] `assignAgentRole()` method works correctly
- [ ] Role changes are logged

## Quick Links

- **Full Documentation**: [ROLE_BASED_ACCESS_CONTROL.md](./ROLE_BASED_ACCESS_CONTROL.md)
- **Implementation Summary**: [RBAC_IMPLEMENTATION_SUMMARY.md](./RBAC_IMPLEMENTATION_SUMMARY.md)
- **Database Migration**: `migrations/postgres/003-add-customer-roles.sql`
- **User Services Machine**: `src/machines/supamoto/user-services/userServicesMachine.ts`
- **Database Service**: `src/services/database-storage.ts`

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review full documentation
3. Check application logs
4. Verify database schema and data
