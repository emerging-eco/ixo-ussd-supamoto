# Chore: Consolidate customer and agent menus

## Linear Issue

- **Issue ID**: IXO-539
- **Issue URL**: https://linear.app/ixo-world/issue/IXO-539/consolidate-customer-and-agent-menus

## Chore Description

Currently, the USSD client shows different Service Menus for SupaMoto Customers and Agents. This chore consolidates these menus so that:

1. **Customers** see a simplified menu:
   ```
   CON Customer Tools
   1. Confirm Receival of Beans
   0. Back
   ```

2. **Agents** (lead_generator, call_center, admin) see all customer functions PLUS agent-specific functions:
   ```
   CON Agent Tools
   1. Confirm Receival of Beans
   2. Activate a Customer
   3. 1,000 Day Survey
   4. Register Intent to Deliver Beans
   5. Submit Customer OTP
   6. Confirm Bean Delivery
   0. Back
   ```

This enables agents to perform both customer and agent functions using the same login, since agents are also SupaMoto customers.

## Relevant Files

Use these files to resolve the chore:

- `src/machines/supamoto/user-services/userServicesMachine.ts` - Main routing machine that determines initial state based on role and displays the Agent Tools menu. **This is the primary file to modify** - the agent menu message needs to include "Confirm Receival of Beans" as option 1, and routing needs to invoke customerToolsMachine for that option.

- `src/machines/supamoto/customer-tools/customerToolsMachine.ts` - Handles customer operations including "Confirm Receival of Beans". No changes needed - will be invoked by agents for option 1.

- `docs/supamoto/MENU_STRUCTURE.md` - Documentation of menu structure. Needs to be updated to reflect the consolidated menu structure.

- `tests/machines/supamoto/user-services/userServicesMachine.test.ts` - Tests for userServicesMachine. Needs to be updated to test the new agent menu options.

## Step by Step Tasks

IMPORTANT: Execute every step in order, top to bottom.

### 1. Update the Agent Tools menu in userServicesMachine.ts

- Modify the `agent` state's entry action to display the consolidated menu with 6 options:
  ```
  Agent Tools
  1. Confirm Receival of Beans
  2. Activate a Customer
  3. 1,000 Day Survey
  4. Register Intent to Deliver Beans
  5. Submit Customer OTP
  6. Confirm Bean Delivery
  0. Back
  ```
- Update the INPUT transitions to map to correct targets:
  - Input `1` → new state `agentConfirmBeans` (invokes customerToolsMachine)
  - Input `2` → `agentActivateCustomer` (was option 1)
  - Input `3` → `agentSurvey` (was option 2)
  - Input `4` → `agentRegisterIntent` (was option 3)
  - Input `5` → `agentSubmitOTP` (was option 4)
  - Input `6` → `agentConfirmDelivery` (was option 5)
- Add new `agentConfirmBeans` state that invokes `customerToolsMachine` (similar to how `customerTools` state works)

### 2. Update guards in userServicesMachine.ts

- Ensure `isInput6` guard exists (it already does based on code review)
- All guards are already present: isInput1 through isInput6

### 3. Update the MENU_STRUCTURE.md documentation

- Update section "4.2 Agent Tools (Lead Generator)" to show the new consolidated menu structure
- Update menu item numbering to reflect new order
- Add note that agents can access customer functions via option 1

### 4. Update the userServicesMachine tests

- Update the test that checks agent menu message to verify it contains "Confirm Receival of Beans"
- Add test for input 1 transitioning to agentConfirmBeans state
- Verify existing tests for inputs 2-6 still work (they should since we're just renumbering)

### 5. Run validation commands

- Run all validation commands to ensure zero regressions

## Validation Commands

Execute every command to validate the chore is complete with zero regressions.

- `pnpm install && pnpm format && pnpm lint && pnpm tsc --noEmit && pnpm build && pnpm validate:machines` - Run tests to validate the chore is complete with zero regressions.
- `pnpm test:flows:run` - Run all flow tests against a running server (start `pnpm dev` first in another terminal).
- `pnpm test:integration:flows` - Run the new integration test runner that starts/stops the server automatically.

## Notes

- The `customerToolsMachine` is already designed to be invoked as a child machine and handles its own menu display and navigation. When invoked from the agent context, it will show "Customer Tools" as a submenu and return to the agent menu on back/exit.
- The agent's `customerId` context property will be passed to the customerToolsMachine, allowing the agent to confirm their own bean receipts if needed.
- No database changes are required for this chore.
- No new libraries are required.
