-- Migration 006: Household Survey Responses
-- Adds table for collecting encrypted household eligibility survey responses
-- Supports session interruption recovery and gating claim submission

CREATE TABLE IF NOT EXISTS household_survey_responses (
  id SERIAL PRIMARY KEY,
  customer_id VARCHAR(10) NOT NULL,
  lead_generator_id VARCHAR(10) NOT NULL,
  
  -- Survey response fields (all encrypted)
  beneficiary_category TEXT,
  child_max_age TEXT,
  bean_intake_frequency TEXT,
  price_specification TEXT,
  awareness_iron_beans TEXT,
  knows_nutritional_benefits TEXT,
  nutritional_benefit_details TEXT,
  confirm_action_antenatal_card_verified TEXT,
  
  -- Completion tracking
  all_fields_completed BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Composite unique constraint to prevent duplicate survey attempts
  UNIQUE(customer_id, lead_generator_id, created_at)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_household_survey_customer ON household_survey_responses(customer_id);
CREATE INDEX IF NOT EXISTS idx_household_survey_lg ON household_survey_responses(lead_generator_id);
CREATE INDEX IF NOT EXISTS idx_household_survey_completion ON household_survey_responses(all_fields_completed);
CREATE INDEX IF NOT EXISTS idx_household_survey_created ON household_survey_responses(created_at);

-- Comments for documentation
COMMENT ON TABLE household_survey_responses IS 'Stores encrypted household eligibility survey responses collected from Lead Generators during customer activation';
COMMENT ON COLUMN household_survey_responses.all_fields_completed IS 'Flag to gate claim submission - must be true before submit1000DayCustomerClaim is allowed';

