# Survey Conditional Question Flow Fix

**Date**: 2025-11-19  
**Issue**: Bean intake frequency question shown when no child in household  
**Root Cause**: Incorrect state transition logic in beneficiary category question

---

## Problem Description

### Observed Behavior

When a Lead Generator selected a beneficiary category that did NOT include "C: Child under 2 years" (e.g., option 1: "A - Pregnant Woman"), the system incorrectly displayed the bean intake frequency question: "How many times a week does the child eat beans?"

### Expected Behavior

The bean intake frequency question should ONLY be shown if the beneficiary category includes a child under 2 years. According to the survey specification:

**Options that include a child (should show bean frequency):**
- 3. C (Child under 2 years)
- 5. A + C (Pregnant Woman + Child)
- 6. B + C (Breastfeeding Mother + Child)
- 7. All (A + B + C)

**Options that do NOT include a child (should skip to price question):**
- 1. A (Pregnant Woman only)
- 2. B (Breastfeeding Mother only)
- 4. A + B (Pregnant Woman + Breastfeeding Mother)
- 8. None

---

## Root Cause Analysis

### Survey Flow Logic

The correct flow should be:

**Path 1: WITH child**
```
askBeneficiaryCategory → askChildAge → askBeanIntakeFrequency → askPriceSpecification
```

**Path 2: WITHOUT child**
```
askBeneficiaryCategory → askPriceSpecification
```

### The Bug

In `thousandDaySurveyMachine.ts`, the `askBeneficiaryCategory` state had two transitions:

1. **First transition (lines 856-902)**: If valid AND has child → go to `askChildAge` ✅
2. **Second transition (lines 903-939)**: If valid → go to `askBeanIntakeFrequency` ❌

The second transition was incorrect - it went to `askBeanIntakeFrequency` for ANY valid input, regardless of whether a child was present. It should have gone to `askPriceSpecification` when NO child was present.

---

## Solution

### Changes Made

Modified `src/machines/supamoto/thousand-day-survey/thousandDaySurveyMachine.ts`:

#### Fix 1: Corrected Second Transition (lines 903-949)

Changed the target from `askBeanIntakeFrequency` to `askPriceSpecification` and added a guard to check that NO child is present:

```typescript
{
  target: "askPriceSpecification",
  guard: ({ event, context }) => {
    if (event.type !== "INPUT") return false;
    if (!validateBeneficiaryCategory(event.input).valid) return false;
    // Check if child age should NOT be shown (no child in household)
    const category = mapBeneficiaryCategory(event.input);
    return !shouldShowChildAgeQuestion(category);
  },
  // ... actions to save answer
}
```

#### Fix 2: Updated Back Navigation (lines 1085-1091)

Changed `askBeanIntakeFrequency` back button from `askBeneficiaryCategory` to `askChildAge` since that's the only way to reach it:

```typescript
{
  backTarget: "askChildAge",  // Was: "askBeneficiaryCategory"
  exitTarget: "routeToMain",
  enableBack: true,
  enableExit: true,
}
```

#### Fix 3: Conditional Back Navigation for Price Question (lines 1096-1179)

Replaced `withNavigation` with custom transition logic to handle conditional back navigation:

- If `beanIntakeFrequency` is set (child path), back goes to `askBeanIntakeFrequency`
- Otherwise (no child path), back goes to `askBeneficiaryCategory`

---

## Verification

### How to Test

1. **Build**: `pnpm build`
2. **Start server**: `pnpm dev`
3. **Run interactive test**: `pnpm test:interactive`
4. **Test flow**:
   - Login as Lead Generator (C0106BDBB, PIN: 10101)
   - Select Services → Agent Tools → "2. 1,000 Day Survey"
   - Enter customer ID (e.g., C57EBF690)
   - Select beneficiary category option 1 (A - Pregnant Woman only)
   - **Expected**: System should skip child age and bean frequency, go directly to price question
   - **Before fix**: System would incorrectly show bean frequency question

### Test Cases

✅ **Option 1 (A only)**: Should skip to price question  
✅ **Option 2 (B only)**: Should skip to price question  
✅ **Option 3 (C only)**: Should ask child age → bean frequency → price  
✅ **Option 4 (A+B)**: Should skip to price question  
✅ **Option 5 (A+C)**: Should ask child age → bean frequency → price  
✅ **Option 6 (B+C)**: Should ask child age → bean frequency → price  
✅ **Option 7 (All)**: Should ask child age → bean frequency → price  
✅ **Option 8 (None)**: Should skip to price question

---

## Impact

### Files Modified

- `src/machines/supamoto/thousand-day-survey/thousandDaySurveyMachine.ts` (3 changes)

### Affected Flows

- ✅ 1,000 Day Survey flow (all beneficiary category options)
- ✅ Survey session recovery (routing logic)

---

## Related Issues

- Nested child message retrieval fix (prerequisite for this fix to work)

---

## Lessons Learned

1. **Conditional question logic**: When survey questions have `visibleIf` conditions, state machine transitions must respect those conditions
2. **Guard ordering**: XState evaluates guards in order - more specific guards should come before general ones
3. **Back navigation**: Back buttons should consider the actual path taken, not just the logical parent state

