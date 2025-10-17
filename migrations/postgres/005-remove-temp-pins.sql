-- Migration 005: Remove temp_pins table and consolidate PIN storage
-- Simplifies PIN management by storing all PINs (temporary and permanent) in customers.encrypted_pin
-- Adds audit trail for PIN resets via audit_log table

-- Drop temp_pins table (no longer needed)
DROP TABLE IF EXISTS temp_pins CASCADE;

-- Update audit_log table comment to document new event types
COMMENT ON TABLE audit_log IS 'Audit trail for security events. Event types include: PIN_RESET (LG resets customer PIN during activation), CUSTOMER_ACTIVATED (customer activates account with temp PIN), SMS_FAILED, BEAN_RECEIPT_DENIED, ACCOUNT_LOCKED, etc.';

-- Add index for faster PIN_RESET lookups
CREATE INDEX IF NOT EXISTS idx_audit_log_pin_reset ON audit_log(event_type) WHERE event_type = 'PIN_RESET';

