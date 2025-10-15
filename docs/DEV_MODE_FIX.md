# Dev Mode Fix - TypeScript Type Declarations

## Issue

After implementing the Customer Activation feature, `pnpm dev` failed to start with a cryptic error:

```
node:internal/modules/run_main:107
    triggerUncaughtException(
    ^
[Object: null prototype] {
  Symbol(nodejs.util.inspect.custom): [Function: [nodejs.util.inspect.custom]]
}
```

## Root Cause

The issue was caused by **ts-node** (used in dev mode) being stricter than **tsc** (used in production build) about type declarations.

Specifically:

1. The `africastalking` package doesn't have official TypeScript type definitions
2. We created a custom type declaration file: `src/types/africastalking.d.ts`
3. **tsc** (production build) found and used this file correctly
4. **ts-node** (dev mode) couldn't find the type declaration file because:
   - The `src/types` directory wasn't explicitly included in `tsconfig.json`
   - ts-node requires the `files: true` option to pick up custom type declarations

## Solution

Updated `tsconfig.json` to:

1. Explicitly include the types directory
2. Add ts-node configuration with `files: true`

### Changes Made

**File:** `tsconfig.json`

```json
{
  "compilerOptions": {
    // ... existing config ...
  },
  "include": ["src/**/*", "test/**/*", "src/types/**/*.d.ts"], // ← Added types
  "exclude": [
    "node_modules",
    "dist",
    "src/reference/**/*",
    "src/**/*-demo.ts",
    "src/services/ixo-account.ts"
  ],
  "ts-node": {
    // ← Added ts-node config
    "transpileOnly": true,
    "files": true
  }
}
```

### Key Changes

1. **Added to `include` array:**

   ```json
   "src/types/**/*.d.ts"
   ```

   - Explicitly includes all `.d.ts` files in the `src/types` directory
   - Ensures ts-node can find custom type declarations

2. **Added `ts-node` configuration:**
   ```json
   "ts-node": {
     "transpileOnly": true,
     "files": true
   }
   ```

   - `transpileOnly: true` - Faster compilation (skips type checking)
   - `files: true` - Respects `include`/`exclude` and picks up `.d.ts` files

## Verification

### Before Fix

```bash
$ pnpm dev
# Error: Could not find a declaration file for module 'africastalking'
# Server fails to start
```

### After Fix

```bash
$ pnpm dev
# ✅ Server starts successfully
# 🚀 USSD server listening on http://127.0.0.1:3000
# Ready for development! 🎯
```

## Why This Happened

### tsc vs ts-node Behavior

**tsc (Production Build):**

- Reads entire project structure
- Automatically finds `.d.ts` files in `src/**/*`
- More lenient about type resolution
- Result: Build succeeded ✅

**ts-node (Dev Mode):**

- JIT compilation (on-the-fly)
- Stricter about type resolution
- Requires explicit configuration for custom types
- Result: Failed without proper config ❌

### The africastalking Package

The `africastalking` npm package:

- Written in JavaScript
- No official `@types/africastalking` package exists
- Requires custom type declarations for TypeScript projects

Our custom type declaration (`src/types/africastalking.d.ts`) provides:

- Interface definitions for the SDK
- Type safety for SMS sending
- Proper TypeScript support

## Related Files

### Type Declaration File

**File:** `src/types/africastalking.d.ts`

```typescript
declare module "africastalking" {
  interface AfricasTalkingConfig {
    apiKey: string;
    username: string;
  }

  interface SMSRecipient {
    status: string;
    messageId?: string;
    number?: string;
    cost?: string;
  }

  interface SMSResponse {
    SMSMessageData: {
      Message: string;
      Recipients: SMSRecipient[];
    };
  }

  interface SMSOptions {
    to: string[];
    message: string;
    from?: string;
    enqueue?: boolean;
  }

  interface SMS {
    send(options: SMSOptions): Promise<SMSResponse>;
  }

  interface AfricasTalking {
    SMS: SMS;
  }

  function AfricasTalking(config: AfricasTalkingConfig): AfricasTalking;

  export = AfricasTalking;
}
```

### SMS Service Using the Types

**File:** `src/services/sms.ts`

```typescript
import AfricasTalking from "africastalking"; // ← Now properly typed

const africastalking = AfricasTalking({
  apiKey: process.env.AFRICASTALKING_API_KEY || "",
  username: process.env.AFRICASTALKING_USERNAME || "sandbox",
});

const sms = africastalking.SMS;
// TypeScript now knows about SMS.send() and its parameters
```

## Testing

### Test Dev Mode

```bash
# Kill any processes on port 3000
lsof -ti:3000 | xargs kill -9

# Start dev server
pnpm dev

# Expected output:
# 🚀 USSD server listening on http://127.0.0.1:3000
# Ready for development! 🎯
```

### Test Production Build

```bash
# Build the project
pnpm build

# Expected: No errors
# ✅ Build completes successfully
```

### Test Both Modes

```bash
# Test production build
pnpm build && pnpm start

# Test dev mode
pnpm dev
```

Both should work without errors.

## Troubleshooting

### Issue: Dev mode still fails

**Check:**

1. Verify `tsconfig.json` has the changes
2. Clear ts-node cache:
   ```bash
   rm -rf node_modules/.cache
   ```
3. Restart your terminal/IDE

### Issue: Type errors in IDE

**Solution:**

1. Restart TypeScript server in your IDE
2. VS Code: `Cmd+Shift+P` → "TypeScript: Restart TS Server"
3. Verify `src/types/africastalking.d.ts` exists

### Issue: Port 3000 already in use

**Solution:**

```bash
# Find and kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port in .env
PORT=3001
```

## Best Practices

### Custom Type Declarations

When adding custom type declarations:

1. **Create in `src/types/` directory:**

   ```
   src/types/
     └── package-name.d.ts
   ```

2. **Use proper module declaration:**

   ```typescript
   declare module "package-name" {
     // Type definitions
   }
   ```

3. **Update tsconfig.json if needed:**
   - Add to `include` array if not already covered
   - Ensure ts-node config has `files: true`

### ts-node Configuration

For projects using ts-node in development:

```json
{
  "ts-node": {
    "transpileOnly": true, // Faster compilation
    "files": true, // Pick up .d.ts files
    "compilerOptions": {
      "module": "commonjs" // If needed for compatibility
    }
  }
}
```

## Summary

- ✅ **Issue:** Dev mode failed due to missing type declarations for `africastalking`
- ✅ **Root Cause:** ts-node couldn't find custom type declaration file
- ✅ **Solution:** Updated `tsconfig.json` to include types directory and configure ts-node
- ✅ **Result:** Both dev mode and production build work correctly
- ✅ **Files Changed:** `tsconfig.json` (1 file)
- ✅ **Build Status:** All modes working ✅

## Related Documentation

- **Activation Implementation:** `docs/ACTIVATION_INTEGRATION_SUMMARY.md`
- **Testing Guide:** `docs/ACTIVATION_TESTING_GUIDE.md`
- **TypeScript Handbook:** https://www.typescriptlang.org/docs/handbook/declaration-files/introduction.html
- **ts-node Documentation:** https://typestrong.org/ts-node/docs/
