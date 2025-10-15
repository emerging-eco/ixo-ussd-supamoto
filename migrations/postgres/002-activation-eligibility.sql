-- Customer Activation and Eligibility Verification Schema
-- Supports the bean distribution flow with temporary PINs, eligibility tracking, and OTP verification

-- 1. Temporary PINs for customer activation
-- Used when Lead Generator verifies a customer at distribution point
CREATE TABLE IF NOT EXISTS temp_pins (
  id SERIAL PRIMARY KEY,
  customer_id VARCHAR(10) NOT NULL,
  phone_number VARCHAR(32) NOT NULL,
  temp_pin VARCHAR(6) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP,
  UNIQUE(customer_id, phone_number)
);

-- 2. Eligibility verifications (audit trail)
-- Records all eligibility responses (both Yes and No) for compliance
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

-- 3. Distribution OTPs for bean collection confirmation
-- Used to verify customer at point of bean distribution
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_temp_pins_customer_phone ON temp_pins(customer_id, phone_number);
CREATE INDEX IF NOT EXISTS idx_temp_pins_expires ON temp_pins(expires_at) WHERE used = FALSE;
CREATE INDEX IF NOT EXISTS idx_eligibility_customer ON eligibility_verifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_eligibility_date ON eligibility_verifications(verification_date);
CREATE INDEX IF NOT EXISTS idx_distribution_otps_customer ON distribution_otps(customer_id);
CREATE INDEX IF NOT EXISTS idx_distribution_otps_expires ON distribution_otps(expires_at) WHERE used = FALSE;

-- Display schema information for verification
SELECT 'temp_pins' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'temp_pins' AND table_schema = 'public'
UNION ALL
SELECT 'eligibility_verifications' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'eligibility_verifications' AND table_schema = 'public'
UNION ALL
SELECT 'distribution_otps' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'distribution_otps' AND table_schema = 'public'
ORDER BY table_name, column_name;

