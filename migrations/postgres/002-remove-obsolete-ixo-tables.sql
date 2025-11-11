-- Migration: Remove Obsolete IXO Tables
-- Created: 2025-11-11
-- Purpose: Remove obsolete database tables (ixo_profiles, ixo_accounts, matrix_vaults)
--          and their associated indexes after delegating IXO account creation to Claims Bot service.
--
-- Context: Following the delegation of IXO account creation to the Claims Bot service,
--          the USSD gateway no longer creates or manages IXO blockchain accounts, profiles,
--          or Matrix vaults locally. The local storage of this data is now obsolete.
--
-- Impact:
--   - Removes 3 of 10 database tables (~40% reduction)
--   - Removes 6 indexes
--   - households table is intentionally kept for future use (shared household wallets)
--   - No impact on active features (all Matrix read operations have graceful fallbacks)
--
-- Safety:
--   - All Matrix read operations have try-catch blocks with fallbacks
--   - No active writes to these tables (account creation delegated to Claims Bot)
--   - Production likely has empty tables (no Matrix vaults created)
--   - Application won't crash if tables don't exist (errors are caught)

-- Drop indexes first (in any order, as they don't have dependencies)
DROP INDEX IF EXISTS idx_matrix_vaults_profile_id;
DROP INDEX IF EXISTS idx_ixo_accounts_address;
DROP INDEX IF EXISTS idx_ixo_accounts_profile_id;
DROP INDEX IF EXISTS idx_ixo_profiles_did;
DROP INDEX IF EXISTS idx_ixo_profiles_household_id;
DROP INDEX IF EXISTS idx_ixo_profiles_customer_id;

-- Drop tables in reverse dependency order
-- matrix_vaults depends on ixo_profiles (via profile_id foreign key)
DROP TABLE IF EXISTS matrix_vaults;

-- ixo_accounts depends on ixo_profiles (via profile_id foreign key)
DROP TABLE IF EXISTS ixo_accounts;

-- ixo_profiles depends on households and customers (via foreign keys)
DROP TABLE IF EXISTS ixo_profiles;

-- Note: households table is intentionally kept for future use
-- Reason: Minimal storage overhead, supports valid future feature (shared household wallets)

