-- ============================================================================
-- Migration 001: Drop GIN Index on survey_form Column
-- ============================================================================
-- 
-- Purpose: Remove the GIN index on survey_form::jsonb that is incompatible
--          with encrypted TEXT storage
--
-- Issue: The survey_form column stores encrypted TEXT data, but the GIN index
--        attempts to cast it to JSONB, causing "invalid input syntax for type json"
--        errors when inserting encrypted data.
--
-- Solution: Drop the GIN index since we cannot query encrypted data directly.
--           If querying is needed, decrypt in the application layer first.
--
-- Date: 2025-10-28
-- Related Bug: bug-thousand-day-survey-beneficiary-category-save-error.md
-- ============================================================================

-- Drop the problematic GIN index
DROP INDEX IF EXISTS idx_household_claims_survey_form;

-- Add comment explaining why the index was removed
COMMENT ON COLUMN household_claims.survey_form IS 'Encrypted TEXT field storing complete survey form definition and responses. Structure: {formDefinition: {...}, answers: {...}, metadata: {startedAt, lastUpdatedAt, completedAt, allFieldsCompleted, version}}. Note: Cannot be indexed as JSONB because data is encrypted. Query by decrypting in application layer.';

