-- Migration 003: Add Role-Based Access Control
-- Adds role field to customers table to distinguish between regular customers and authorized agents

-- Add role column with default value 'customer'
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'customer' 
CHECK (role IN ('customer', 'lead_generator', 'call_center', 'admin'));

-- Create index for performance (role-based queries will be common)
CREATE INDEX IF NOT EXISTS idx_customers_role ON customers(role);

-- Add comment for documentation
COMMENT ON COLUMN customers.role IS 'User role: customer (default), lead_generator (can use Agent Tools), call_center (can use Agent Tools + support functions), admin (full access)';

-- Optional: Update any existing known agents
-- Example: UPDATE customers SET role = 'lead_generator' WHERE customer_id IN ('L12345678', 'L87654321');
-- Example: UPDATE customers SET role = 'call_center' WHERE customer_id IN ('A12345678', 'A87654321');

