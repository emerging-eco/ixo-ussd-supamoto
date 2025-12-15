-- ============================================================================
-- CONSOLIDATED DATABASE INITIALIZATION SCRIPT
-- ============================================================================
-- This script initializes the complete database schema for the IXO USSD Server
-- for fresh database deployments. All tables, indexes, and constraints are
-- created in a single idempotent script.
--
-- CONSOLIDATION HISTORY:
-- - Merged migrations/postgres/000-init-all.sql (base schema)
-- - Merged migrations/postgres/001-add-bean-distribution-claim-tracking.sql
-- - Merged migrations/postgres/002-remove-obsolete-ixo-tables.sql
--
-- REMOVED TABLES (delegated to Claims Bot service):
-- - ixo_profiles: IXO blockchain profiles (now managed by Claims Bot)
-- - ixo_accounts: IXO blockchain accounts (now managed by Claims Bot)
-- - matrix_vaults: Matrix secure storage (no longer used)
--
-- Schema Organization:
-- 1. Core Tables (Phones, Households, Customers)
-- 2. Bean Distribution & Delivery (with blockchain claim tracking)
-- 3. Household Survey & Claims (with JSON storage)
-- 4. Failed Claims Retry Queue
-- 5. Audit & Logging
--
-- Note: This script includes the survey JSON storage refactor, consolidating
-- survey responses directly into the household_claims table as TEXT (encrypted).
-- Note: households table is kept for future shared household wallet feature.
-- ============================================================================

-- -- ============================================================================
-- -- SECTION 0: DROP EXISTING TABLES (Idempotent)
-- -- ============================================================================
-- -- Drop tables in reverse dependency order to avoid foreign key constraint errors

-- -- Drop indexes first (if they exist)
-- DROP INDEX IF EXISTS idx_household_claims_survey_form;
-- DROP INDEX IF EXISTS idx_household_claims_survey_updated;
-- DROP INDEX IF EXISTS idx_household_claims_lg_customer_composite;
-- DROP INDEX IF EXISTS idx_household_survey_lg_customer_unique;
-- DROP INDEX IF EXISTS idx_household_survey_customer;
-- DROP INDEX IF EXISTS idx_household_survey_lg;
-- DROP INDEX IF EXISTS idx_household_survey_completion;
-- DROP INDEX IF EXISTS idx_household_survey_created;
-- DROP INDEX IF EXISTS idx_audit_log_pin_reset;
-- DROP INDEX IF EXISTS idx_audit_log_created;
-- DROP INDEX IF EXISTS idx_audit_log_customer;
-- DROP INDEX IF EXISTS idx_audit_log_event_type;
-- DROP INDEX IF EXISTS idx_household_claims_status;
-- DROP INDEX IF EXISTS idx_household_claims_lg_customer;
-- DROP INDEX IF EXISTS idx_household_claims_lg;
-- DROP INDEX IF EXISTS idx_household_claims_customer;
-- DROP INDEX IF EXISTS idx_bean_confirmations_claim_id;
-- DROP INDEX IF EXISTS idx_bean_confirmations_deadline;
-- DROP INDEX IF EXISTS idx_bean_confirmations_lg;
-- DROP INDEX IF EXISTS idx_bean_confirmations_customer;
-- DROP INDEX IF EXISTS idx_bean_otps_valid;
-- DROP INDEX IF EXISTS idx_bean_otps_intent;
-- DROP INDEX IF EXISTS idx_bean_otps_lg;
-- DROP INDEX IF EXISTS idx_bean_otps_customer;
-- DROP INDEX IF EXISTS idx_lg_intents_claim_collection;
-- DROP INDEX IF EXISTS idx_lg_intents_claim_intent_id;
-- DROP INDEX IF EXISTS idx_lg_intents_status;
-- DROP INDEX IF EXISTS idx_lg_intents_lg;
-- DROP INDEX IF EXISTS idx_lg_intents_customer;
-- DROP INDEX IF EXISTS idx_failed_claims_customer;
-- DROP INDEX IF EXISTS idx_failed_claims_next_retry;
-- DROP INDEX IF EXISTS idx_failed_claims_status;
-- DROP INDEX IF EXISTS idx_customers_national_id;
-- DROP INDEX IF EXISTS idx_customer_phones_phone_id;
-- DROP INDEX IF EXISTS idx_customer_phones_customer_id;
-- DROP INDEX IF EXISTS idx_customers_role;
-- DROP INDEX IF EXISTS idx_customers_customer_id;
-- DROP INDEX IF EXISTS idx_phones_phone_number;
-- -- Obsolete indexes (tables removed - delegated to Claims Bot)
-- DROP INDEX IF EXISTS idx_matrix_vaults_profile_id;
-- DROP INDEX IF EXISTS idx_ixo_accounts_address;
-- DROP INDEX IF EXISTS idx_ixo_accounts_profile_id;
-- DROP INDEX IF EXISTS idx_ixo_profiles_did;
-- DROP INDEX IF EXISTS idx_ixo_profiles_household_id;
-- DROP INDEX IF EXISTS idx_ixo_profiles_customer_id;

-- -- Drop tables in reverse dependency order
-- DROP TABLE IF EXISTS audit_log;
-- DROP TABLE IF EXISTS failed_claims_queue;
-- DROP TABLE IF EXISTS household_claims;
-- DROP TABLE IF EXISTS household_survey_responses;  -- Legacy table from before JSON refactor
-- DROP TABLE IF EXISTS bean_delivery_confirmations;
-- DROP TABLE IF EXISTS bean_distribution_otps;
-- DROP TABLE IF EXISTS lg_delivery_intents;
-- -- Obsolete tables (removed - delegated to Claims Bot)
-- DROP TABLE IF EXISTS matrix_vaults;
-- DROP TABLE IF EXISTS ixo_accounts;
-- DROP TABLE IF EXISTS ixo_profiles;
-- DROP TABLE IF EXISTS customer_phones;
-- DROP TABLE IF EXISTS customers;
-- DROP TABLE IF EXISTS households;
-- DROP TABLE IF EXISTS phones;

-- ============================================================================
-- SECTION 1: CORE TABLES
-- ============================================================================
-- Data Storage: Phone → Customer (with optional household reference)
-- Note: IXO blockchain integration (ixo_profiles, ixo_accounts, matrix_vaults)
--       has been removed. IXO account creation is now delegated to the Claims Bot service.

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

-- 1.2 Households (kept for future shared household wallet feature)
CREATE TABLE IF NOT EXISTS households (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 1.3 Customer details (needs phone, may have household)
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  customer_id VARCHAR(20) NOT NULL UNIQUE,
  full_name VARCHAR(255),
  email VARCHAR(255),
  national_id VARCHAR(20),
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

-- ============================================================================
-- SECTION 2: BEAN DISTRIBUTION & DELIVERY (with blockchain claim tracking)
-- ============================================================================
-- Note: eligibility_verifications table not included - replaced by
--       household_claims + survey_form JSONB system
-- Note: distribution_otps table not included - superseded by bean_distribution_otps
--       which provides comprehensive tracking with foreign keys and LG tracking
-- Note: household_survey_responses table not included - replaced by survey_form
--       JSONB column in household_claims table for flexible schema

-- 2.1 LG Intent Registration Table (with blockchain claim tracking)
CREATE TABLE IF NOT EXISTS lg_delivery_intents (
  id SERIAL PRIMARY KEY,
  customer_id VARCHAR(20) NOT NULL REFERENCES customers(customer_id),
  lg_customer_id VARCHAR(20) NOT NULL REFERENCES customers(customer_id),
  intent_registered_at TIMESTAMP NOT NULL DEFAULT NOW(),
  has_bean_voucher BOOLEAN NOT NULL,
  voucher_status VARCHAR(50),
  voucher_check_response JSONB,
  -- Blockchain claim tracking columns (added in migration 001)
  claim_intent_id VARCHAR(255),
  claim_collection_id VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2.2 OTP tracking table for bean distribution
CREATE TABLE IF NOT EXISTS bean_distribution_otps (
  id SERIAL PRIMARY KEY,
  customer_id VARCHAR(20) NOT NULL REFERENCES customers(customer_id),
  lg_customer_id VARCHAR(20) NOT NULL REFERENCES customers(customer_id),
  intent_id INTEGER REFERENCES lg_delivery_intents(id),
  otp VARCHAR(6) NOT NULL,
  generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  is_valid BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2.3 Delivery confirmations table (with blockchain claim tracking)
CREATE TABLE IF NOT EXISTS bean_delivery_confirmations (
  id SERIAL PRIMARY KEY,
  customer_id VARCHAR(20) NOT NULL REFERENCES customers(customer_id),
  lg_customer_id VARCHAR(20) NOT NULL REFERENCES customers(customer_id),
  otp_id INTEGER REFERENCES bean_distribution_otps(id),
  lg_confirmed_at TIMESTAMP NULL,
  customer_confirmed_at TIMESTAMP NULL,
  customer_confirmed_receipt BOOLEAN NULL,
  token_transferred_at TIMESTAMP NULL,
  confirmation_deadline TIMESTAMP NOT NULL,
  -- Blockchain claim tracking column (added in migration 001)
  claim_id VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SECTION 3: HOUSEHOLD SURVEY & CLAIMS (with JSON Storage)
-- ============================================================================

-- 3.1 Household Claims (submitted by LG on behalf of customer)
-- Includes embedded survey responses in survey_form TEXT field (encrypted)
CREATE TABLE IF NOT EXISTS household_claims (
  id SERIAL PRIMARY KEY,
  lg_customer_id VARCHAR(20) NOT NULL REFERENCES customers(customer_id),
  customer_id VARCHAR(20) NOT NULL REFERENCES customers(customer_id),
  is_1000_day_household BOOLEAN NOT NULL,
  claim_submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  claim_processed_at TIMESTAMP NULL,
  claim_status VARCHAR(50),
  bean_voucher_allocated BOOLEAN DEFAULT FALSE,
  claims_bot_response JSONB,
  survey_form TEXT,
  survey_form_updated_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(lg_customer_id, customer_id)
);

-- ============================================================================
-- SECTION 4: FAILED CLAIMS RETRY QUEUE
-- ============================================================================

-- 4.1 Failed Claims Queue (for automatic retry of failed claims submissions)
CREATE TABLE IF NOT EXISTS failed_claims_queue (
  id SERIAL PRIMARY KEY,
  claim_type VARCHAR(50) NOT NULL CHECK (claim_type IN ('lead_creation', '1000_day_household')),
  customer_id VARCHAR(20) NOT NULL,
  claim_data JSONB NOT NULL,
  error_message TEXT,
  http_status_code INTEGER,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMP,
  last_attempted_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'retrying', 'failed', 'resolved'))
);

-- ============================================================================
-- SECTION 5: AUDIT & LOGGING
-- ============================================================================

-- 5.1 Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  customer_id VARCHAR(20),
  lg_customer_id VARCHAR(20),
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
CREATE INDEX IF NOT EXISTS idx_customers_national_id ON customers(national_id) WHERE national_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_phones_customer_id ON customer_phones(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_phones_phone_id ON customer_phones(phone_id);

-- Note: Obsolete indexes removed (ixo_profiles, ixo_accounts, matrix_vaults tables removed)

-- Failed claims queue indexes
CREATE INDEX IF NOT EXISTS idx_failed_claims_status ON failed_claims_queue(status);
CREATE INDEX IF NOT EXISTS idx_failed_claims_next_retry ON failed_claims_queue(next_retry_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_failed_claims_customer ON failed_claims_queue(customer_id);

-- Bean distribution indexes (with blockchain claim tracking)
CREATE INDEX IF NOT EXISTS idx_lg_intents_customer ON lg_delivery_intents(customer_id);
CREATE INDEX IF NOT EXISTS idx_lg_intents_lg ON lg_delivery_intents(lg_customer_id);
CREATE INDEX IF NOT EXISTS idx_lg_intents_status ON lg_delivery_intents(voucher_status);
CREATE INDEX IF NOT EXISTS idx_lg_intents_claim_intent_id ON lg_delivery_intents(claim_intent_id);
CREATE INDEX IF NOT EXISTS idx_lg_intents_claim_collection ON lg_delivery_intents(claim_collection_id);
CREATE INDEX IF NOT EXISTS idx_bean_otps_customer ON bean_distribution_otps(customer_id);
CREATE INDEX IF NOT EXISTS idx_bean_otps_lg ON bean_distribution_otps(lg_customer_id);
CREATE INDEX IF NOT EXISTS idx_bean_otps_intent ON bean_distribution_otps(intent_id);
CREATE INDEX IF NOT EXISTS idx_bean_otps_valid ON bean_distribution_otps(is_valid);
CREATE INDEX IF NOT EXISTS idx_bean_confirmations_customer ON bean_delivery_confirmations(customer_id);
CREATE INDEX IF NOT EXISTS idx_bean_confirmations_lg ON bean_delivery_confirmations(lg_customer_id);
CREATE INDEX IF NOT EXISTS idx_bean_confirmations_deadline ON bean_delivery_confirmations(confirmation_deadline);
CREATE INDEX IF NOT EXISTS idx_bean_confirmations_claim_id ON bean_delivery_confirmations(claim_id);

-- Household claims indexes (with TEXT storage for encrypted survey data)
CREATE INDEX IF NOT EXISTS idx_household_claims_customer ON household_claims(customer_id);
CREATE INDEX IF NOT EXISTS idx_household_claims_lg ON household_claims(lg_customer_id);
CREATE INDEX IF NOT EXISTS idx_household_claims_lg_customer_composite ON household_claims(lg_customer_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_household_claims_status ON household_claims(claim_status);
CREATE INDEX IF NOT EXISTS idx_household_claims_survey_updated ON household_claims(survey_form_updated_at) WHERE survey_form IS NOT NULL;

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
COMMENT ON COLUMN customers.national_id IS 'Optional Zambian National Registration Card number (format: XXXXXX/XX/X)';

COMMENT ON TABLE households IS 'Household grouping table. Kept for future shared household wallet feature. Currently minimal usage.';

COMMENT ON TABLE lg_delivery_intents IS 'Stores LG intent to deliver beans with blockchain claim tracking (claim_intent_id, claim_collection_id)';
COMMENT ON COLUMN lg_delivery_intents.voucher_status IS 'Status: HAS_VOUCHER, NO_VOUCHER, ERROR';
COMMENT ON COLUMN lg_delivery_intents.voucher_check_response IS 'Full JSON response from subscriptions-service-supamoto';
COMMENT ON COLUMN lg_delivery_intents.claim_intent_id IS 'Blockchain claim intent ID from Claims Bot (added in migration 001)';
COMMENT ON COLUMN lg_delivery_intents.claim_collection_id IS 'Blockchain claim collection ID from Claims Bot (added in migration 001)';

COMMENT ON TABLE bean_distribution_otps IS 'Primary OTP tracking table for bean distribution. Replaced the simpler distribution_otps table which lacked foreign key relationships and LG tracking. Valid 10 minutes by default (configurable via OTP_VALIDITY_MINUTES). Tracks the complete OTP lifecycle from generation through validation and usage.';
COMMENT ON TABLE bean_delivery_confirmations IS 'Tracks dual confirmations (LG + Customer) for bean delivery within 7-day window with blockchain claim tracking';
COMMENT ON COLUMN bean_delivery_confirmations.customer_confirmed_receipt IS 'TRUE = received beans, FALSE = did not receive, NULL = not yet confirmed';
COMMENT ON COLUMN bean_delivery_confirmations.claim_id IS 'Blockchain claim ID from Claims Bot (added in migration 001)';

COMMENT ON TABLE household_claims IS '1,000 Day Household claims submitted by Lead Generators on behalf of customers. Includes embedded survey responses in survey_form TEXT field (encrypted).';
COMMENT ON COLUMN household_claims.lg_customer_id IS 'Lead Generator customer ID - who submitted the claim on behalf of the customer';
COMMENT ON COLUMN household_claims.claim_status IS 'Status: PENDING, PROCESSED, FAILED, VOUCHER_ALLOCATED';
COMMENT ON COLUMN household_claims.claims_bot_response IS 'Full JSON response from ixo-matrix-supamoto-claims-bot';
COMMENT ON COLUMN household_claims.survey_form IS 'Encrypted TEXT field storing complete survey form definition and responses. Structure: {formDefinition: {...}, answers: {...}, metadata: {startedAt, lastUpdatedAt, completedAt, allFieldsCompleted, version}}';
COMMENT ON COLUMN household_claims.survey_form_updated_at IS 'Timestamp of last survey form update. Used for tracking survey progress and session recovery.';

COMMENT ON TABLE failed_claims_queue IS 'Retry queue for failed claims bot API submissions. Stores failed lead creation and 1000-day household claims for automatic retry with exponential backoff.';
COMMENT ON COLUMN failed_claims_queue.claim_type IS 'Type of claim: lead_creation or 1000_day_household';
COMMENT ON COLUMN failed_claims_queue.claim_data IS 'Full claim payload as JSONB for retry submission';
COMMENT ON COLUMN failed_claims_queue.status IS 'Status: pending (awaiting retry), retrying (currently being retried), failed (max retries exceeded), resolved (successfully submitted)';
COMMENT ON COLUMN failed_claims_queue.next_retry_at IS 'Timestamp for next retry attempt. Uses exponential backoff: 5min, 30min, 2hr';

COMMENT ON TABLE audit_log IS 'Audit trail for security events. Event types include: PIN_RESET, CUSTOMER_ACTIVATED, SMS_FAILED, BEAN_RECEIPT_DENIED, ACCOUNT_LOCKED, CLAIMS_SUBMISSION_FAILED, etc.';

-- ============================================================================
-- CONSOLIDATED INITIALIZATION COMPLETE
-- ============================================================================
-- This script consolidates:
-- - migrations/postgres/000-init-all.sql (base schema)
-- - migrations/postgres/001-add-bean-distribution-claim-tracking.sql
-- - migrations/postgres/002-remove-obsolete-ixo-tables.sql
--
-- Obsolete tables removed (delegated to Claims Bot):
-- - ixo_profiles, ixo_accounts, matrix_vaults
--
-- Result: Clean, idempotent initialization script for fresh database deployments.
-- ============================================================================

