# Docker Build Fix - Summary

## Problem

The Docker build was failing with the following error:

```
Error: Cannot find module '/app/dist/migrations/run-migrations.js'
    at Module._resolveFilename (node:internal/modules/cjs/loader:1207:15)
    ...
```

## Root Cause

The build was failing during the Docker build stage due to TypeScript compilation errors:

1. **`.dockerignore` excludes `tests/` and `scripts/` directories** (correctly, for production)
2. **Two utility files import from the excluded `tests/` directory:**
   - `src/utils/session-log-parser.ts` imports from `tests/helpers/session-recorder.js`
   - `src/utils/vitest-generator.ts` imports from `tests/helpers/session-recorder.js`
3. **TypeScript compilation fails** because it can't resolve these imports
4. **The build command exits with error code 2**, preventing the Docker build from completing

## Solution

Created `tsconfig.build.json` to exclude the problematic development-only utility files:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": [
    "node_modules",
    "dist",
    "tests",
    "scripts",
    "src/utils/session-log-parser.ts",
    "src/utils/vitest-generator.ts"
  ]
}
```

These files are development utilities used for:
- Parsing session logs for debugging
- Generating test files from recorded sessions

They are **not needed in production** and should not be included in the Docker build.

## Additional Fixes

1. **Updated `README.md`** to correct the migration script path:
   - **Before:** `node dist/src/migrations/run-migrations.js`
   - **After:** `node dist/migrations/run-migrations.js`

2. **Updated `package.json`** build script to use `tsconfig.build.json`:
   - **Before:** `tsc --project tsconfig.json`
   - **After:** `tsc --project tsconfig.build.json`

This ensures the correct output structure where `rootDir: "src"` produces `dist/migrations/` instead of `dist/src/migrations/`.

## Verification

Run the verification script to confirm the fix works:

```bash
./verify-docker-build.sh
```

This script simulates the Docker build environment (excluding `tests/` and `scripts/`) and verifies:
- ✅ Build completes without TypeScript errors
- ✅ `dist/migrations/run-migrations.js` exists at the correct location
- ✅ `dist/index.js` exists
- ✅ File structure matches `package.json` expectations

## Impact

- **Docker builds will now succeed** without TypeScript compilation errors
- **Production deployments will work** as expected
- **No functionality is lost** - the excluded files are development-only utilities
- **Build output structure is correct** with files at expected locations

## Files Changed

1. `tsconfig.build.json` - Created with exclusions for dev-only utilities
2. `README.md` - Fixed migration script path
3. `verify-docker-build.sh` - Added verification script (new)
4. `DOCKER_BUILD_FIX.md` - This documentation file (new)

