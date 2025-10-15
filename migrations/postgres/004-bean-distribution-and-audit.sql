-- Migration 004: Bean Distribution and Audit System
-- Adds tables for bean distribution workflow, OTP tracking, delivery confirmations,
-- 1,000 Day Household claims, and comprehensive audit logging

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
-- Tracks OTPs generated for bean distribution (valid 10 minutes by default, configurable)
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

