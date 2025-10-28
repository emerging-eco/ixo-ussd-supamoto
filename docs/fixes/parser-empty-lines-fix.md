# Session Log Parser Fix: Empty Lines in Multi-line Responses

## Issue Summary

**Date**: 2025-10-27  
**Component**: `src/utils/session-log-parser.ts`  
**Issue**: Parser was truncating multi-line USSD responses at the first empty line

## Problem Description

The `SessionLogParser` was incorrectly stopping collection of multi-line server responses when it encountered empty lines within the message. This caused USSD messages with blank lines for formatting to be truncated.

### Example

**Session Log** (`logs/sessions/session-2025-10-27-14-42-51.log`):

```
[2025-10-27T14:45:37.782Z]
CON Account Menu
                    <- Empty line for formatting
Do you have an existing account?
1. Yes, log me in
2. No, create my account
0. Back
```

**Before Fix** - Parser captured only:

```
"CON Account Menu"
```

**After Fix** - Parser correctly captures:

```
"CON Account Menu\n\nDo you have an existing account?\n1. Yes, log me in\n2. No, create my account\n0. Back"
```

## Root Cause

In `src/utils/session-log-parser.ts`, the parser had a condition that stopped collecting lines when it encountered an empty line:

```typescript
while (i < lines.length) {
  const followingLine = lines[i];
  if (
    followingLine.match(timestampRegex) ||
    followingLine.startsWith("=") ||
    followingLine.trim() === "" // ❌ PROBLEM: Stops on empty lines
  ) {
    break;
  }
  serverResponse += "\n" + followingLine;
  i++;
}
```

This logic was present in **two locations**:

1. Lines 172-184: When server response starts on same line as timestamp
2. Lines 204-216: When server response follows on next line after timestamp

## Solution

**Removed** the empty line check and added logic to trim trailing empty lines:

```typescript
while (i < lines.length) {
  const followingLine = lines[i];
  if (
    followingLine.match(timestampRegex) ||
    followingLine.startsWith("=")
    // ✅ REMOVED: followingLine.trim() === ""
    // Empty lines are valid within USSD responses for formatting
  ) {
    break;
  }
  serverResponse += "\n" + followingLine;
  i++;
}

// Trim trailing empty lines from the response (log formatting)
serverResponse = serverResponse.replace(/\n+$/, "");
```

### Why This Works

1. **Empty lines within messages** are preserved for proper formatting
2. **Trailing empty lines** (from log formatting) are removed
3. **Response collection stops** only at timestamps or separators (which always appear between turns)

## Changes Made

### File: `src/utils/session-log-parser.ts`

**Location 1** (Lines 166-195):

- Removed `followingLine.trim() === ""` condition from line 178
- Added `serverResponse.replace(/\n+$/, "")` at line 187
- Added comment explaining empty line preservation

**Location 2** (Lines 196-232):

- Removed `followingLine.trim() === ""` condition from line 210
- Added `serverResponse.replace(/\n+$/, "")` at line 222
- Added comment explaining empty line preservation

## Testing

### Unit Tests

All existing parser tests pass:

```bash
pnpm test tests/utils/session-log-parser.test.ts
# ✓ 12 tests passed
```

### Integration Tests

All log-to-test generation tests pass:

```bash
pnpm test tests/integration/log-to-test-generation.test.ts
# ✓ 5 tests passed
```

### Manual Verification

Created test log with empty lines and verified parsing:

```bash
# Test log with empty lines in Account Menu
# Parser correctly captured all lines including empty line formatting
✅ Turn 1 has empty line (formatting): true
✅ Turn 1 has all menu options: true
```

### Real Session Log

Re-parsed the original session log:

```bash
# logs/sessions/session-2025-10-27-14-42-51.log
✅ Has complete Account Menu: true
✅ Has empty line for formatting: true
```

## Impact

### Test Generation

After regenerating the test from the session log:

**Before Fix** (`tests/flows/create-customer-flow.test.ts` Turn 2):

```typescript
const expected = "CON Account Menu";
```

**After Fix**:

```typescript
const expected =
  "CON Account Menu\n\nDo you have an existing account?\n1. Yes, log me in\n2. No, create my account\n0. Back";
```

### Test Results

The regenerated test now correctly expects the full multi-line response, which will match the actual server output.

## Verification Steps

To verify the fix works:

1. **Parse a session log with multi-line responses**:

   ```bash
   pnpm generate:test logs/sessions/session-2025-10-27-14-42-51.log create-customer-flow
   ```

2. **Check the generated test** includes full multi-line responses:

   ```bash
   cat tests/flows/create-customer-flow.test.ts | grep -A 2 "Turn 2"
   ```

3. **Run the test** (requires USSD server running):
   ```bash
   pnpm dev  # In one terminal
   pnpm test:flows:createcustomer  # In another terminal
   ```

## Related Issues

- Turn 2 test failure in `specs/console-log.txt` (lines 60-72)
- Any other multi-line USSD responses with empty lines for formatting

## Conclusion

The parser now correctly handles USSD messages with empty lines for formatting, ensuring that generated tests capture the complete server responses. This fix makes the test generation more robust and accurate.
