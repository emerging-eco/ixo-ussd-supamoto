# DevOps Deployment Instructions

## Issue

The error `Cannot find module '/app/dist/migrations/run-migrations.js'` is occurring because the deployment is using a **cached Docker build** from before the fix was applied.

## Root Cause

The previous Docker builds failed during the TypeScript compilation stage (silently or with errors), which meant the `dist/` directory was either empty or incomplete. The Docker layer cache is reusing this failed build.

## Solution: Force a Clean Rebuild

Your DevOps colleague needs to rebuild the Docker image **without using the cache** to ensure the latest code and fixes are applied.

### Option 1: Docker Build with --no-cache (Recommended)

```bash
# Pull the latest code
git pull origin dev

# Build without cache
docker build --no-cache -t ixo-ussd-supamoto:latest .

# Or if using a specific tag
docker build --no-cache -t ixo-ussd-supamoto:dev .
```

### Option 2: Railway/Cloud Platform Specific

If deploying via Railway, Render, or similar platforms:

1. **Railway:**
   - Go to the deployment settings
   - Click "Redeploy" or "Deploy"
   - Make sure to select "Clear build cache" or similar option
   - Or use Railway CLI: `railway up --no-cache`

2. **Render:**
   - Go to the service dashboard
   - Click "Manual Deploy" → "Clear build cache & deploy"

3. **Docker Compose:**
   ```bash
   docker-compose build --no-cache
   docker-compose up -d
   ```

### Option 3: Remove Old Images and Rebuild

```bash
# Remove old images
docker rmi ixo-ussd-supamoto:latest
docker rmi $(docker images -f "dangling=true" -q)

# Rebuild
docker build -t ixo-ussd-supamoto:latest .
```

## Verification

After rebuilding, verify the image contains the correct files:

```bash
# Check if the migration file exists
docker run --rm ixo-ussd-supamoto:latest ls -la /app/dist/migrations/run-migrations.js

# Expected output:
# -rw-r--r--    1 nodejs   nodejs        3785 Nov 27 11:29 run-migrations.js
```

## What Was Fixed

The fix (commit `db315b4`) addressed the following:

1. **Created `tsconfig.build.json`** - Excludes dev-only files that depend on the `tests/` directory
2. **Excluded problematic files:**
   - `src/utils/session-log-parser.ts`
   - `src/utils/vitest-generator.ts`
3. **Fixed build configuration** - Ensures TypeScript compilation succeeds in Docker environment

## Expected Behavior After Fix

1. ✅ Docker build completes successfully
2. ✅ `dist/migrations/run-migrations.js` exists at correct location
3. ✅ Container starts without "Cannot find module" error
4. ✅ Migrations run successfully
5. ✅ Server starts on specified port

## Troubleshooting

If the error persists after clearing cache:

1. **Verify the latest code is pulled:**
   ```bash
   git log --oneline -1
   # Should show: db315b4 fix: Docker build error - exclude dev-only utilities from production build
   ```

2. **Check if tsconfig.build.json exists:**
   ```bash
   ls -la tsconfig.build.json
   # Should exist in the repository root
   ```

3. **Manually test the build stage:**
   ```bash
   docker build --target build -t test-build .
   docker run --rm test-build ls -la /app/dist/migrations/
   # Should show run-migrations.js
   ```

4. **Check build logs for TypeScript errors:**
   - Look for any TypeScript compilation errors in the build output
   - The build should complete without errors

## Contact

If issues persist after following these steps, please provide:
- Full build logs
- Output of `git log --oneline -5`
- Output of `docker build --no-cache .` (full output)

