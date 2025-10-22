# Chore: Reorganize Test Structure and Consolidate Test Suite

## Chore Description

The current test structure is scattered throughout the `src/` directory with excessive test files. This chore aims to:

1. **Consolidate tests** into a top-level `tests/` directory with clear organization
2. **Move scripts** from `src/test/scripts/` to a top-level `scripts/` directory
3. **Remove redundant tests** while keeping only essential ones:
   - End-to-end tests that traverse the whole menu structure across all machines
   - State machine tests that exercise each machine in isolation
   - Unit tests for services and utilities
4. **Update all configuration files** to reference the new test locations
5. **Maintain zero regressions** in test coverage and functionality

## Relevant Files

### Configuration Files

- `vitest.config.ts` - Vitest configuration with test patterns and setup files
- `tsconfig.json` - TypeScript configuration with path aliases and includes
- `package.json` - NPM scripts that reference test locations
- `.github/workflows/test-coverage.yml` - CI/CD workflow that runs tests

### Current Test Files (to be reorganized)

- `src/test/` - Main test directory with setup, helpers, and test files
- `src/test/scripts/` - Test scripts to be moved to top-level
- `src/test/helpers/` - Test helpers and utilities
- `src/test/e2e/` - End-to-end tests
- `src/test/interactive/` - Interactive testing tools
- `src/**/*.test.ts` - Scattered test files throughout src/

### Test Files to Keep

- `src/machines/supamoto/**/*.test.ts` - State machine tests (move to `tests/machines/`)
- `src/services/**/*.test.ts` - Service unit tests (move to `tests/services/`)
- `src/utils/**/*.test.ts` - Utility unit tests (move to `tests/utils/`)
- `src/schemas/**/*.test.ts` - Schema validation tests (move to `tests/schemas/`)
- `src/test/stream-error-fixes.test.ts` - E2E test (move to `tests/e2e/`)
- `src/test/e2e/recorded-flows.test.ts` - E2E test (move to `tests/e2e/`)

### New Files to Create

- `tests/` - Top-level test directory
- `tests/e2e/` - End-to-end tests
- `tests/machines/` - State machine tests
- `tests/services/` - Service unit tests
- `tests/utils/` - Utility unit tests
- `tests/schemas/` - Schema validation tests
- `tests/helpers/` - Test helpers and utilities
- `tests/setup.ts` - Test setup file
- `scripts/` - Top-level scripts directory
- `scripts/test-all-menu-flows.ts` - Test all menu flows script
- `scripts/test-database-integration.ts` - Database integration test script
- `scripts/test-interactive.ts` - Interactive testing script
- `scripts/validate-machines.js` - Machine validation script

## Step by Step Tasks

### 1. Create New Directory Structure

- Create `tests/` directory at project root
- Create `tests/e2e/`, `tests/machines/`, `tests/services/`, `tests/utils/`, `tests/schemas/`, `tests/helpers/` subdirectories
- Create `scripts/` directory at project root
- Verify directory structure is in place

### 2. Move Test Helper Files

- Copy `src/test/helpers/` files to `tests/helpers/`
- Copy `src/test/setup.ts` to `tests/setup.ts`
- Update import paths in moved helper files to reference new locations
- Verify all helper imports are correct

### 3. Move and Consolidate State Machine Tests

- Move `src/machines/supamoto/**/*.test.ts` to `tests/machines/supamoto/`
- Update import paths in machine tests to reference new locations
- Verify all machine test imports work correctly

### 4. Move and Consolidate Service Unit Tests

- Move `src/services/**/*.test.ts` to `tests/services/`
- Move `src/services/ixo/**/*.test.ts` to `tests/services/ixo/`
- Update import paths in service tests
- Verify all service test imports work correctly

### 5. Move and Consolidate Utility Unit Tests

- Move `src/utils/__tests__/validation.unit.test.ts` to `tests/utils/validation.unit.test.ts`
- Update import paths in utility tests
- Verify all utility test imports work correctly

### 6. Move and Consolidate Schema Tests

- Move `src/schemas/**/*.test.ts` to `tests/schemas/`
- Update import paths in schema tests
- Verify all schema test imports work correctly

### 7. Move End-to-End Tests

- Move `src/test/stream-error-fixes.test.ts` to `tests/e2e/stream-error-fixes.test.ts`
- Move `src/test/e2e/recorded-flows.test.ts` to `tests/e2e/recorded-flows.test.ts`
- Update import paths in E2E tests
- Verify all E2E test imports work correctly

### 8. Move Test Scripts to Top-Level

- Copy `src/test/scripts/test-all-menu-flows.ts` to `scripts/test-all-menu-flows.ts`
- Copy `src/test/scripts/test-database-integration.ts` to `scripts/test-database-integration.ts`
- Copy `src/test/interactive/interactive.ts` to `scripts/test-interactive.ts`
- Copy `src/test/scripts/validate-machines.js` to `scripts/validate-machines.js`
- Update import paths in all moved scripts
- Verify all script imports work correctly

### 9. Update Configuration Files

- Update `vitest.config.ts`:
  - Change `setupFiles` from `./test/setup.ts` to `./tests/setup.ts`
  - Update `include` pattern to include `tests/**/*.{test,spec}.{ts,tsx}`
  - Update `exclude` patterns to reference `tests/` instead of `src/test/`
- Update `tsconfig.json`:
  - Add `tests/**/*` to `include` array
  - Verify path aliases work with new structure
- Update `package.json` scripts:
  - Update `test:interactive` to reference `scripts/test-interactive.ts`
  - Update `test:all-flows` to reference `scripts/test-all-menu-flows.ts`
  - Update `test:database-integration` to reference `scripts/test-database-integration.ts`
  - Update `validate:machines` to reference `scripts/validate-machines.js`

### 10. Update CI/CD Workflow

- Update `.github/workflows/test-coverage.yml` to reference new test locations if needed
- Verify workflow still runs tests correctly

### 11. Clean Up Old Test Directories

- Remove `src/test/` directory entirely
- Remove `src/**/*.test.ts` files (they've been moved)
- Remove `src/**/__tests__/` directories (they've been moved)
- Verify no test files remain in `src/` directory

### 12. Validate Test Configuration

- Run `pnpm test` to ensure all tests are discovered and run
- Verify test output shows correct number of tests
- Verify all test files are being executed
- Check for any import errors or missing dependencies

## Validation Commands

Execute every command to validate the chore is complete with zero regressions.

- `pnpm test` - Run full test suite to verify all tests execute without errors
- `pnpm test:coverage` - Generate coverage report to verify coverage thresholds are met
- `pnpm test:watch` - Run tests in watch mode to verify file watching works
- `pnpm test:interactive` - Run interactive test script to verify it works from new location
- `pnpm test:all-flows` - Run all menu flows test to verify it works from new location
- `pnpm test:database-integration` - Run database integration test to verify it works
- `pnpm validate:machines` - Run machine validation script to verify it works
- `find src -name "*.test.ts" -o -name "*.test.js"` - Verify no test files remain in src/
- `find src -type d -name "__tests__"` - Verify no **tests** directories remain in src/
- `find src -type d -name "test"` - Verify no test directories remain in src/

## Notes

- The reorganization maintains all existing test functionality while improving structure
- Test helpers are consolidated in `tests/helpers/` for easier maintenance
- Scripts are moved to top-level for better discoverability
- All import paths must be updated to reference new locations
- The vitest configuration must be updated to discover tests in the new location
- CI/CD workflows should continue to work without modification if paths are updated correctly
- Consider updating documentation to reflect new test structure after completion
