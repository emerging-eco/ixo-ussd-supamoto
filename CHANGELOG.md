# Changelog

All notable changes to the IXO USSD Supamoto project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - 2025-11-04

- **[IXO-284]** Complete 1000 Day Household Survey implementation
  - Comprehensive USSD survey flow with 9 questions for Lead Generators
  - State machine architecture using XState for survey flow management
  - Session recovery support to resume surveys after interruptions
  - Conditional question visibility (child age only shown when relevant)
  - Multi-part questions (5 nutritional benefit questions)
  - Full navigation support (Back/Exit on all questions)
  - Encrypted survey response storage in PostgreSQL JSONB
  - Customer ID validation with pattern `/^C[A-Za-z0-9]{8,}$/`
  - Input validation for all question types
  - USSD-to-SurveyJS value mapping
  - Integration into Agent Tools menu (option 2)
  - Claims Bot SDK integration (`@ixo/supamoto-bot-sdk@0.0.11`)
  - Automatic claim submission to IXO blockchain upon completion
  - Comprehensive test suite (unit, integration, and flow tests)

### Changed - 2025-11-04

- **[IXO-284]** Upgraded `@ixo/supamoto-bot-sdk` from v0.0.10 to v0.0.11
  - Includes SSL certificate fix from SDK developer
  - Improved error handling for API rejections

### Fixed - 2025-11-04

- **[IXO-284]** Fixed `childMaxAge` validation in 1000 Day Survey
  - Now defaults to 1 instead of 0 when no child is present in household
  - Prevents SDK validation errors for households with only pregnant/breastfeeding members
- **[IXO-284]** Fixed duplicate household claims prevention
- **[IXO-284]** Fixed customer existence validation before claim creation
- **[IXO-284]** Fixed survey recovery race conditions
- **[IXO-284]** Added missing navigation guards to survey state machine
- **[IXO-284]** Fixed array type support in survey answer storage
- **[IXO-284]** Fixed claims bot API rejection errors to prevent server crashes

## Previous Changes

For changes prior to 2025-11-04, please refer to the git commit history.

---

**Legend:**
- `Added` for new features
- `Changed` for changes in existing functionality
- `Deprecated` for soon-to-be removed features
- `Removed` for now removed features
- `Fixed` for any bug fixes
- `Security` for vulnerability fixes

**Issue References:**
- `[IXO-XXX]` - Linear issue identifier
- Links to Linear: https://linear.app/ixo-world/issue/IXO-XXX

