-- ============================================================================
-- MIGRATION: Add Blockchain Claim Tracking to Bean Distribution Tables
-- ============================================================================
-- This migration adds blockchain claim tracking columns to existing bean
-- distribution tables to support the intent-based escrow workflow using
-- IXO blockchain claims module (collection ID 120).
--
-- Tables Modified:
-- 1. lg_delivery_intents - Add claim intent tracking
-- 2. bean_delivery_confirmations - Add claim submission and evaluation tracking
--
-- Workflow:
-- 1. LG registers intent → MsgClaimIntent → claim_intent_id stored
-- 2. LG submits OTP → MsgSubmitClaim → claim_id stored
-- 3. Customer confirms → MsgEvaluateClaim → claim_evaluation_tx_hash stored
-- 4. LG confirms → FuelDeliveryClaim → fuel_delivery_claim_id stored
-- ============================================================================

-- Add blockchain claim tracking to lg_delivery_intents table
ALTER TABLE lg_delivery_intents
  ADD COLUMN IF NOT EXISTS claim_intent_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS claim_intent_tx_hash VARCHAR(100),
  ADD COLUMN IF NOT EXISTS claim_intent_response JSONB,
  ADD COLUMN IF NOT EXISTS customer_claim_collection_id VARCHAR(100);

-- Add blockchain claim tracking to bean_delivery_confirmations table
ALTER TABLE bean_delivery_confirmations
  ADD COLUMN IF NOT EXISTS claim_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS claim_tx_hash VARCHAR(100),
  ADD COLUMN IF NOT EXISTS claim_evaluation_tx_hash VARCHAR(100),
  ADD COLUMN IF NOT EXISTS fuel_delivery_claim_id VARCHAR(100);

-- Create indexes for new claim tracking columns
CREATE INDEX IF NOT EXISTS idx_lg_intents_claim_intent_id ON lg_delivery_intents(claim_intent_id);
CREATE INDEX IF NOT EXISTS idx_lg_intents_claim_collection ON lg_delivery_intents(customer_claim_collection_id);
CREATE INDEX IF NOT EXISTS idx_bean_confirmations_claim_id ON bean_delivery_confirmations(claim_id);

-- Add comments for documentation
COMMENT ON COLUMN lg_delivery_intents.claim_intent_id IS 'Blockchain claim intent ID from MsgClaimIntent transaction';
COMMENT ON COLUMN lg_delivery_intents.claim_intent_tx_hash IS 'Transaction hash of MsgClaimIntent submission';
COMMENT ON COLUMN lg_delivery_intents.claim_intent_response IS 'Full JSON response from MsgClaimIntent transaction';
COMMENT ON COLUMN lg_delivery_intents.customer_claim_collection_id IS 'Customer''s claim collection ID (e.g., "120" for bean distribution)';

COMMENT ON COLUMN bean_delivery_confirmations.claim_id IS 'Blockchain claim ID from MsgSubmitClaim transaction (with useIntent=true)';
COMMENT ON COLUMN bean_delivery_confirmations.claim_tx_hash IS 'Transaction hash of MsgSubmitClaim submission';
COMMENT ON COLUMN bean_delivery_confirmations.claim_evaluation_tx_hash IS 'Transaction hash of MsgEvaluateClaim (APPROVED/REJECTED)';
COMMENT ON COLUMN bean_delivery_confirmations.fuel_delivery_claim_id IS 'Claims Bot fuel delivery claim ID for record-keeping';

