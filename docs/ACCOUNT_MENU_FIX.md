# Account Menu Fix - Remove "Activate my account" Option

## Issue

The Account Menu was displaying an incorrect option "3. Activate my account" that should not be visible to users according to the technical specification.

**Date Fixed:** 2025-10-15  
**Status:** ✅ Fixed and Verified

---

## Root Cause

The Account Menu machine (`accountMenuMachine.ts`) included a third option for customer activation that was accessible directly from the Account Menu. This contradicted the technical specification which states that customer activation should only be handled through the Agent Tools flow (Lead Generator flow).

---

## Solution

Removed the "Activate my account" option from the Account Menu and cleaned up all related routing logic.

### Changes Made

#### 1. Account Menu Machine (`src/machines/supamoto/account-menu/accountMenuMachine.ts`)

**Menu Message - Before:**

```
Account Menu

Do you have an existing account?
1. Yes, log me in
2. No, create my account
3. Activate my account  ← REMOVED
0. Back
```

**Menu Message - After:**

```
Account Menu

Do you have an existing account?
1. Yes, log me in
2. No, create my account
0. Back
```

**Enum Changes:**

- Removed `ACTIVATE_SELECTED` from `AccountMenuOutput` enum
- Updated documentation to reflect that activation is handled via Agent Tools

**Guard Changes:**

- Removed `isInput3` guard (no longer needed)

**Routing Changes:**

- Removed route to `customerActivation` state for option 3

#### 2. Parent Machine (`src/machines/supamoto/parentMachine.ts`)

**Removed:**

- Import of `customerActivationMachine` and `CustomerActivationOutput`
- `customerActivationMachine` from actors list
- Route from Account Menu to `customerActivation` state
- Entire `customerActivation` state (now orphaned and unreachable)

**Reason:** The `customerActivation` state in the parent machine was only accessible from the Account Menu. Since that route has been removed, the state is no longer reachable and has been cleaned up.

---

## Customer Activation Flow

### ✅ Correct Flow (Agent Tools)

Customer activation is **only** accessible through Agent Tools:

```
Agent Tools (Lead Generator)
├── 1. Activate a Customer
│   ├── Enter Customer ID
│   ├── Enter Customer Phone Number
│   ├── Generate temporary PIN (5 digits)
│   ├── Send activation SMS to customer
│   └── Customer receives SMS with temp PIN
└── Customer can then log in with temp PIN
```

This flow is implemented in:

- `src/machines/supamoto/user-services/userServicesMachine.ts` (state: `agentActivateCustomer`)
- `src/machines/supamoto/activation/customerActivationMachine.ts` (with `isLeadGenerator: true`)

### ❌ Removed Flow (Account Menu)

The following flow has been **removed**:

```
Account Menu
└── 3. Activate my account  ← REMOVED
    └── Customer self-activation flow
```

---

## Verification

### Build Status

✅ **Build Successful** - No compilation errors

### Menu Structure Verification

**Account Menu now shows:**

```
Account Menu

Do you have an existing account?
1. Yes, log me in
2. No, create my account
0. Back
```

**Agent Tools menu shows:**

```
Agent Tools
1. Activate a Customer  ← Customer activation is HERE
2. Register Intent to Deliver Beans
3. Submit Customer OTP
4. Confirm Bean Delivery
0. Back
```

### Code Verification

- [x] Account Menu no longer has option 3
- [x] `ACTIVATE_SELECTED` enum removed
- [x] `isInput3` guard removed
- [x] Route to `customerActivation` removed from Account Menu flow
- [x] Orphaned `customerActivation` state removed from parent machine
- [x] `customerActivationMachine` still used by Agent Tools (correct)
- [x] Build successful with no errors

---

## Impact

### Files Modified

1. `src/machines/supamoto/account-menu/accountMenuMachine.ts`
   - Updated menu message
   - Removed `ACTIVATE_SELECTED` enum
   - Removed `isInput3` guard
   - Removed routing logic for option 3
   - Updated documentation

2. `src/machines/supamoto/parentMachine.ts`
   - Removed `customerActivationMachine` import
   - Removed `CustomerActivationOutput` import
   - Removed `customerActivationMachine` from actors
   - Removed route from Account Menu to `customerActivation`
   - Removed `customerActivation` state

### Files NOT Modified (Verified Correct)

- `src/machines/supamoto/user-services/userServicesMachine.ts`
  - Still uses `customerActivationMachine` in `agentActivateCustomer` state ✅
  - This is the correct and only way to activate customers ✅

- `src/machines/supamoto/activation/customerActivationMachine.ts`
  - Still used by Agent Tools ✅
  - No changes needed ✅

---

## Alignment with Technical Specification

This fix aligns with `docs/TECHNICAL_SPECIFICATION.md` Section 5: Menu Structure Changes:

**From the spec:**

> **Key Changes:**
>
> - Removed "3. Activate my account" from Account Menu
> - Renamed "User Services" to "Services"
> - Removed Account/Balances/Orders/Vouchers submenus
> - Added role-based routing: Customer Tools OR Agent Tools (not both)

**Before (Incorrect):**

```
Main Menu
├── Know More
├── Account Menu
│   ├── 1. Yes, log me in
│   ├── 2. No, create my account
│   └── 3. Activate my account  ← INCORRECT
└── Services (if authenticated)
```

**After (Correct):**

```
Main Menu
├── Know More
├── Account Menu
│   ├── 1. Yes, log me in
│   └── 2. No, create my account
└── Services (if authenticated)
    └── Agent Tools (if agent role)
        └── 1. Activate a Customer  ← CORRECT LOCATION
```

---

## Testing Checklist

- [x] Build successful with no errors
- [x] Account Menu shows only 2 options (login and create)
- [x] No option 3 in Account Menu
- [x] Agent Tools still has "Activate a Customer" option
- [x] Customer activation flow only accessible via Agent Tools
- [x] No broken routes or references
- [x] Navigation works correctly
- [x] Enum values are consistent

---

## Related Documentation

- **Technical Specification:** `docs/TECHNICAL_SPECIFICATION.md` (Section 5)
- **Menu Restructure Summary:** `docs/USSD_MENU_RESTRUCTURE_SUMMARY.md`
- **Account Menu Machine:** `src/machines/supamoto/account-menu/accountMenuMachine.ts`
- **Parent Machine:** `src/machines/supamoto/parentMachine.ts`
- **User Services Machine:** `src/machines/supamoto/user-services/userServicesMachine.ts`

---

## Conclusion

The Account Menu has been corrected to show only 2 options (login and create account). Customer activation is now exclusively handled through the Agent Tools flow, where Lead Generators activate customers on their behalf. This aligns with the technical specification and ensures a consistent user experience.

**Status:** ✅ Complete and Verified
