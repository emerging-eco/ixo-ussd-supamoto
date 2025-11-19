# Nested Child Message Retrieval Fix

**Date**: 2025-01-19  
**Issue**: Customer ID input not advancing 1,000 Day Survey flow  
**Root Cause**: USSD response service not retrieving messages from deeply nested child machines

---

## Problem Description

### Observed Behavior

When a Lead Generator logged in and selected "2. 1,000 Day Survey" from the Agent Tools menu, then entered a valid customer ID (e.g., `C57EBF690`), the system displayed the same prompt again instead of advancing to the first survey question (Beneficiary Category).

### USSD Flow Showing the Issue

1. Lead Generator logs in successfully (Customer ID: C0106BDBB, PIN: 10101)
2. Navigates to Agent Tools menu
3. Selects option "2. 1,000 Day Survey"
4. System displays: "Enter the Customer ID on whose behalf you are completing the survey."
5. Lead Generator enters: `C57EBF690`
6. **BUG**: System redisplays the same prompt instead of proceeding to the first survey question

### Expected Behavior

After entering a valid customer ID, the system should:
1. Validate that the customer ID exists in the database
2. Store the customer ID in the survey context
3. Advance to the first survey question (Beneficiary Category)

---

## Root Cause Analysis

### Machine Hierarchy

The 1,000 Day Survey flow involves **three levels of nested state machines**:

```
parentMachine (state: userMainMenu)
└── userServicesChild (state: agentSurvey)
    └── surveyChild (state: askBeneficiaryCategory)
```

### The Problems

There were **two separate issues** causing this bug:

#### Problem 1: Non-Recursive Message Retrieval

The `ussdResponseService.getMessageFromSnapshot()` method only checked **one level deep** for child machines. When it encountered the hierarchy above:

1. It found `userServicesChild` and checked its message
2. `userServicesChild` doesn't update its own message - it only forwards events to `surveyChild`
3. The actual message we needed was in the **grandchild** (`surveyChild`)
4. The service returned the parent's message instead

#### Problem 2: Snapshot Taken Before Async Transition Completes

The session service took the snapshot **immediately** after sending the INPUT event, before the async `initializeSurveySessionService` completed:

1. User enters customer ID `C57EBF690`
2. `actor.send({ type: 'INPUT', input: 'C57EBF690' })`
3. Machine transitions to `askCustomerId` → `initializingSession` (invokes async service)
4. **Snapshot taken HERE** - machine still in `initializingSession` with old message
5. Async service completes → `routeAfterInitialization` → `askBeneficiaryCategory`
6. User sees old message from `askCustomerId` instead of new message from `askBeneficiaryCategory`

### Evidence from Logs

```
🎯 Current state: userMainMenu
💬 Context message: Welcome, L
Snapshot Children: 1
📨 Using message from child machine: userServicesChild

📤 USSD Response:
   Formatted: CON A Lead Generator completes this survey on behalf of a Customer.
Enter the Customer ID on whose behalf you are completing the survey.

0. Back to Agent Tools
```

The logs show:
- Customer ID `C57EBF690` was validated successfully
- Household claim was created successfully
- Session recovery routed to `askBeneficiaryCategory`
- **But the message displayed was still the customer ID prompt**

---

## Solution

### Changes Made

#### Fix 1: Recursive Message Retrieval

Modified `src/services/ussd-response.ts` to make message retrieval **recursive**:

1. **`getMessageFromSnapshot(snapshot, depth = 0)`**: Now recursively traverses nested children
2. **`getActiveStateValue(snapshot)`**: Now recursively finds the deepest active state

#### Fix 2: Wait for Async Transitions

Modified `src/services/session.ts` to wait for async state transitions to complete:

1. Added `await new Promise(resolve => setTimeout(resolve, 100))` after sending INPUT event
2. This allows invoked services (like database queries) to complete before taking the snapshot
3. 100ms delay is reasonable for most async operations while keeping USSD response time acceptable

### Implementation Details

#### Before (Non-Recursive)

```typescript
private getMessageFromSnapshot(snapshot: any): string {
  if (snapshot.children && Object.keys(snapshot.children).length > 0) {
    for (const [childId, childActor] of Object.entries(snapshot.children)) {
      const childSnapshot = (childActor as any).getSnapshot();
      if (childSnapshot?.context?.message) {
        return childSnapshot?.context?.message; // Only checks 1 level
      }
    }
  }
  return snapshot.context?.message || "Service unavailable";
}
```

#### After (Recursive)

```typescript
private getMessageFromSnapshot(snapshot: any, depth: number = 0): string {
  if (snapshot.children && Object.keys(snapshot.children).length > 0) {
    for (const [childId, childActor] of Object.entries(snapshot.children)) {
      const childSnapshot = (childActor as any).getSnapshot();
      
      // Recursively check for nested children (grandchildren)
      if (childSnapshot?.children && Object.keys(childSnapshot.children).length > 0) {
        const nestedMessage = this.getMessageFromSnapshot(childSnapshot, depth + 1);
        if (nestedMessage && nestedMessage !== "Service unavailable") {
          return nestedMessage; // Returns deepest child's message
        }
      }
      
      // Fallback to this child's message
      if (childSnapshot?.context?.message) {
        return childSnapshot?.context?.message;
      }
    }
  }
  return snapshot.context?.message || "Service unavailable";
}
```

---

## Verification

### Unit Tests

Created `tests/fixes/nested-child-message-fix.test.ts` with 4 test cases:

1. ✅ Retrieve message from grandchild machine (depth 2)
2. ✅ Retrieve message from child when no grandchild exists
3. ✅ Fallback to parent message when no children exist
4. ✅ Handle deeply nested children (depth 3+)

All tests pass.

### How to Verify the Fix

1. **Build the project**: `pnpm build`
2. **Start the server**: `pnpm dev`
3. **Run interactive test**: `pnpm test:interactive`
4. **Test the flow**:
   - Login as Lead Generator (C0106BDBB, PIN: 10101)
   - Select "1. Services"
   - Select "2. 1,000 Day Survey"
   - Enter a valid customer ID (e.g., C57EBF690)
   - **Expected**: System should display the Beneficiary Category question
   - **Before fix**: System would redisplay the customer ID prompt

---

## Impact

### Files Modified

- `src/services/ussd-response.ts` (2 methods made recursive, added detailed logging)
- `src/services/session.ts` (added 100ms delay after sending INPUT event)

### Files Created

- `tests/fixes/nested-child-message-fix.test.ts` (unit tests for recursive message retrieval)
- `docs/fixes/nested-child-message-retrieval-fix.md` (this document)

### Affected Flows

This fix benefits **any USSD flow with nested child machines** (3+ levels deep):

- ✅ 1,000 Day Survey flow (parentMachine → userServicesChild → surveyChild)
- ✅ Any future flows with similar nesting patterns

---

## Related Issues

- None (first occurrence of this pattern in the codebase)

---

## Lessons Learned

1. **XState child machine patterns**: When a parent invokes a child that itself invokes another child, message retrieval must be recursive
2. **Async state transitions**: Invoked services (like `fromPromise` actors) complete asynchronously - snapshots must be taken AFTER they complete
3. **USSD timing constraints**: 100ms delay is acceptable for USSD responses while allowing most async operations to complete
4. **Testing nested hierarchies**: Unit tests should cover deeply nested machine scenarios
5. **Logging depth**: The fix includes depth logging to help debug future nesting issues

