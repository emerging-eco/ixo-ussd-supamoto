-- ============================================================================
-- CONSOLIDATED DATABASE INITIALIZATION SCRIPT
-- ============================================================================
-- This script initializes the complete database schema for the IXO USSD Server
-- in a single pass. It consolidates all migrations (001-007) into one
-- comprehensive initialization script for fresh database deployments.
--
-- Schema Organization:
-- 1. Core Tables (Phones, Households, Customers, Wallets)
-- 2. Customer Activation & Eligibility
-- 3. Bean Distribution & Delivery
-- 4. Household Survey & Claims
-- 5. Audit & Logging
-- ============================================================================

-- ============================================================================
-- SECTION 1: CORE TABLES
-- ============================================================================
-- Data Storage: Phone → Customer → Wallet (IXO Profile + Account) → Matrix Vault

-- 1.1 Phone details (independent - can exist without any other data)
CREATE TABLE IF NOT EXISTS phones (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(32) NOT NULL UNIQUE,
  first_seen TIMESTAMP NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMP NOT NULL DEFAULT NOW(),
  number_of_visits INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 1.2 Households (created only when needed for IXO Profile/Wallet)
CREATE TABLE IF NOT EXISTS households (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 1.3 Customer details (needs phone, may have household)
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  customer_id VARCHAR(10) NOT NULL UNIQUE,
  full_name VARCHAR(255),
  email VARCHAR(255),
  encrypted_pin TEXT,
  preferred_language VARCHAR(10) DEFAULT 'eng',
  date_added TIMESTAMP NOT NULL DEFAULT NOW(),
  last_completed_action TEXT,
  household_id INTEGER REFERENCES households(id),
  role VARCHAR(20) DEFAULT 'customer' CHECK (role IN ('customer', 'lead_generator', 'call_center', 'admin')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 1.4 Junction table for phone-customer relationships (many-to-many)
CREATE TABLE IF NOT EXISTS customer_phones (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  phone_id INTEGER NOT NULL REFERENCES phones(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id, phone_id)
);

-- 1.5 IXO Profiles (Wallet part 1 - can be individual or household-based)
CREATE TABLE IF NOT EXISTS ixo_profiles (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  household_id INTEGER REFERENCES households(id) ON DELETE CASCADE,
  did TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT ixo_profiles_owner_check CHECK (
    (customer_id IS NOT NULL AND household_id IS NULL) OR
    (customer_id IS NULL AND household_id IS NOT NULL)
  )
);

-- 1.6 IXO Accounts (Wallet part 2 - many per IXO profile)
CREATE TABLE IF NOT EXISTS ixo_accounts (
  id SERIAL PRIMARY KEY,
  ixo_profile_id INTEGER NOT NULL REFERENCES ixo_profiles(id) ON DELETE CASCADE,
  address TEXT NOT NULL UNIQUE,
  encrypted_mnemonic TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 1.7 Matrix Vaults (secure storage - one per IXO profile)
CREATE TABLE IF NOT EXISTS matrix_vaults (
  id SERIAL PRIMARY KEY,
  ixo_profile_id INTEGER NOT NULL REFERENCES ixo_profiles(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  encrypted_password TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(ixo_profile_id)
);

-- ============================================================================
-- SECTION 2: CUSTOMER ACTIVATION & ELIGIBILITY
-- ============================================================================

-- 2.1 Eligibility verifications (audit trail)
CREATE TABLE IF NOT EXISTS eligibility_verifications (
  id SERIAL PRIMARY KEY,
  customer_id VARCHAR(10) NOT NULL,
  phone_number VARCHAR(32) NOT NULL,
  is_eligible BOOLEAN NOT NULL,
  verification_date TIMESTAMP NOT NULL DEFAULT NOW(),
  claim_id TEXT,
  claim_status VARCHAR(50),
  claim_submitted_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2.2 Distribution OTPs for bean collection confirmation
CREATE TABLE IF NOT EXISTS distribution_otps (
  id SERIAL PRIMARY KEY,
  customer_id VARCHAR(10) NOT NULL,
  otp_code VARCHAR(6) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP,
  verified_by VARCHAR(10)
);

-- ============================================================================
-- SECTION 3: BEAN DISTRIBUTION & DELIVERY
-- ============================================================================

-- 3.1 LG Intent Registration Table
CREATE TABLE IF NOT EXISTS lg_delivery_intents (
  id SERIAL PRIMARY KEY,
  customer_id VARCHAR(10) NOT NULL REFERENCES customers(customer_id),
  lg_customer_id VARCHAR(10) NOT NULL REFERENCES customers(customer_id),
  intent_registered_at TIMESTAMP NOT NULL DEFAULT NOW(),
  has_bean_voucher BOOLEAN NOT NULL,
  voucher_status VARCHAR(50),
  voucher_check_response JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3.2 OTP tracking table for bean distribution
CREATE TABLE IF NOT EXISTS bean_distribution_otps (
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

-- 3.3 Delivery confirmations table
CREATE TABLE IF NOT EXISTS bean_delivery_confirmations (
  id SERIAL PRIMARY KEY,
  customer_id VARCHAR(10) NOT NULL REFERENCES customers(customer_id),
  lg_customer_id VARCHAR(10) NOT NULL REFERENCES customers(customer_id),
  otp_id INTEGER REFERENCES bean_distribution_otps(id),
  lg_confirmed_at TIMESTAMP NULL,
  customer_confirmed_at TIMESTAMP NULL,
  customer_confirmed_receipt BOOLEAN NULL,
  token_transferred_at TIMESTAMP NULL,
  confirmation_deadline TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SECTION 4: HOUSEHOLD SURVEY & CLAIMS
-- ============================================================================

-- 4.1 Household Survey Responses (encrypted, collected by LG)
CREATE TABLE IF NOT EXISTS household_survey_responses (
  id SERIAL PRIMARY KEY,
  lg_customer_id VARCHAR(10) NOT NULL,
  customer_id VARCHAR(10) NOT NULL,
  beneficiary_category TEXT,
  child_max_age TEXT,
  bean_intake_frequency TEXT,
  price_specification TEXT,
  awareness_iron_beans TEXT,
  knows_nutritional_benefits TEXT,
  nutritional_benefit_details TEXT,
  confirm_action_antenatal_card_verified TEXT,
  all_fields_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 4.2 Household Claims (submitted by LG on behalf of customer)
CREATE TABLE IF NOT EXISTS household_claims (
  id SERIAL PRIMARY KEY,
  lg_customer_id VARCHAR(10),
  customer_id VARCHAR(10) NOT NULL REFERENCES customers(customer_id),
  is_1000_day_household BOOLEAN NOT NULL,
  claim_submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  claim_processed_at TIMESTAMP NULL,
  claim_status VARCHAR(50),
  bean_voucher_allocated BOOLEAN DEFAULT FALSE,
  claims_bot_response JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SECTION 5: AUDIT & LOGGING
-- ============================================================================

-- 5.1 Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  customer_id VARCHAR(10),
  lg_customer_id VARCHAR(10),
  details JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SECTION 6: INDEXES FOR PERFORMANCE
-- ============================================================================

-- Core table indexes
CREATE INDEX IF NOT EXISTS idx_phones_phone_number ON phones(phone_number);
CREATE INDEX IF NOT EXISTS idx_customers_customer_id ON customers(customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_role ON customers(role);
CREATE INDEX IF NOT EXISTS idx_customer_phones_customer_id ON customer_phones(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_phones_phone_id ON customer_phones(phone_id);
CREATE INDEX IF NOT EXISTS idx_ixo_profiles_customer_id ON ixo_profiles(customer_id);
CREATE INDEX IF NOT EXISTS idx_ixo_profiles_household_id ON ixo_profiles(household_id);
CREATE INDEX IF NOT EXISTS idx_ixo_profiles_did ON ixo_profiles(did);
CREATE INDEX IF NOT EXISTS idx_ixo_accounts_profile_id ON ixo_accounts(ixo_profile_id);
CREATE INDEX IF NOT EXISTS idx_ixo_accounts_address ON ixo_accounts(address);
CREATE INDEX IF NOT EXISTS idx_matrix_vaults_profile_id ON matrix_vaults(ixo_profile_id);

-- Activation & eligibility indexes
CREATE INDEX IF NOT EXISTS idx_eligibility_customer ON eligibility_verifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_eligibility_date ON eligibility_verifications(verification_date);
CREATE INDEX IF NOT EXISTS idx_distribution_otps_customer ON distribution_otps(customer_id);
CREATE INDEX IF NOT EXISTS idx_distribution_otps_expires ON distribution_otps(expires_at) WHERE used = FALSE;

-- Bean distribution indexes
CREATE INDEX IF NOT EXISTS idx_lg_intents_customer ON lg_delivery_intents(customer_id);
CREATE INDEX IF NOT EXISTS idx_lg_intents_lg ON lg_delivery_intents(lg_customer_id);
CREATE INDEX IF NOT EXISTS idx_lg_intents_status ON lg_delivery_intents(voucher_status);
CREATE INDEX IF NOT EXISTS idx_bean_otps_customer ON bean_distribution_otps(customer_id);
CREATE INDEX IF NOT EXISTS idx_bean_otps_lg ON bean_distribution_otps(lg_customer_id);
CREATE INDEX IF NOT EXISTS idx_bean_otps_intent ON bean_distribution_otps(intent_id);
CREATE INDEX IF NOT EXISTS idx_bean_otps_valid ON bean_distribution_otps(is_valid);
CREATE INDEX IF NOT EXISTS idx_bean_confirmations_customer ON bean_delivery_confirmations(customer_id);
CREATE INDEX IF NOT EXISTS idx_bean_confirmations_lg ON bean_delivery_confirmations(lg_customer_id);
CREATE INDEX IF NOT EXISTS idx_bean_confirmations_deadline ON bean_delivery_confirmations(confirmation_deadline);

-- Household survey & claims indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_household_survey_lg_customer_unique ON household_survey_responses(lg_customer_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_household_survey_customer ON household_survey_responses(customer_id);
CREATE INDEX IF NOT EXISTS idx_household_survey_lg ON household_survey_responses(lg_customer_id);
CREATE INDEX IF NOT EXISTS idx_household_survey_completion ON household_survey_responses(all_fields_completed);
CREATE INDEX IF NOT EXISTS idx_household_survey_created ON household_survey_responses(created_at);
CREATE INDEX IF NOT EXISTS idx_household_claims_customer ON household_claims(customer_id);
CREATE INDEX IF NOT EXISTS idx_household_claims_lg ON household_claims(lg_customer_id);
CREATE INDEX IF NOT EXISTS idx_household_claims_lg_customer ON household_claims(lg_customer_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_household_claims_status ON household_claims(claim_status);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_customer ON audit_log(customer_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_pin_reset ON audit_log(event_type) WHERE event_type = 'PIN_RESET';

-- ============================================================================
-- SECTION 7: TABLE & COLUMN COMMENTS
-- ============================================================================

COMMENT ON TABLE customers IS 'Customer records with role-based access control';
COMMENT ON COLUMN customers.role IS 'User role: customer (default), lead_generator (can use Agent Tools), call_center (can use Agent Tools + support functions), admin (full access)';

COMMENT ON TABLE lg_delivery_intents IS 'Stores LG intent to deliver beans before sending to subscriptions-service-supamoto';
COMMENT ON COLUMN lg_delivery_intents.voucher_status IS 'Status: HAS_VOUCHER, NO_VOUCHER, ERROR';
COMMENT ON COLUMN lg_delivery_intents.voucher_check_response IS 'Full JSON response from subscriptions-service-supamoto';

COMMENT ON TABLE bean_distribution_otps IS 'Tracks OTPs generated for bean distribution (valid 10 minutes by default, configurable)';
COMMENT ON TABLE bean_delivery_confirmations IS 'Tracks dual confirmations (LG + Customer) for bean delivery within 7-day window';
COMMENT ON COLUMN bean_delivery_confirmations.customer_confirmed_receipt IS 'TRUE = received beans, FALSE = did not receive, NULL = not yet confirmed';

COMMENT ON TABLE household_survey_responses IS 'Stores encrypted household eligibility survey responses collected by Lead Generators for customers';
COMMENT ON COLUMN household_survey_responses.lg_customer_id IS 'Lead Generator customer ID - who collected the survey';
COMMENT ON COLUMN household_survey_responses.customer_id IS 'Customer being surveyed - who the survey is about';
COMMENT ON COLUMN household_survey_responses.all_fields_completed IS 'Flag to gate LG claim submission - must be true before LG can submit 1000DayCustomerClaim';

COMMENT ON TABLE household_claims IS '1,000 Day Household claims submitted by Lead Generators on behalf of customers';
COMMENT ON COLUMN household_claims.lg_customer_id IS 'Lead Generator customer ID - who submitted the claim on behalf of the customer';
COMMENT ON COLUMN household_claims.claim_status IS 'Status: PENDING, PROCESSED, FAILED, VOUCHER_ALLOCATED';
COMMENT ON COLUMN household_claims.claims_bot_response IS 'Full JSON response from ixo-matrix-supamoto-claims-bot';

COMMENT ON TABLE audit_log IS 'Audit trail for security events. Event types include: PIN_RESET, CUSTOMER_ACTIVATED, SMS_FAILED, BEAN_RECEIPT_DENIED, ACCOUNT_LOCKED, etc.';

