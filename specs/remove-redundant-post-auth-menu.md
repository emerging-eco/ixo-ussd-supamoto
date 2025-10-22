# Chore: Remove Redundant Post-Authentication Menu Selection

## Chore Description

The current post-authentication flow contains a redundant intermediate menu step. After a user (customer or agent) completes authentication, they are returned to the 'Pre-Menu' where they must select '3. Services'. They are then presented with an intermediate menu showing either '1. Customer Tools' or '1. Agent Tools' based on their role, before accessing their actual menu items.

**Current problematic flow:**

- User authenticates → Pre-Menu → Select "3. Services" → Intermediate menu (select "1. Customer Tools" or "1. Agent Tools") → Actual menu items

**Required flow:**

- User authenticates → Pre-Menu → Select "3. Services" → Directly to role-specific menu (Customer Tools or Agent Tools)

This chore removes the intermediate menu selection step in the `userServicesMachine` so users are directed directly to their role-specific menu after authentication.

## Relevant Files

### Core Implementation Files

- `src/machines/supamoto/parentMachine.ts` - Parent machine that invokes userServicesMachine; passes customerRole context
- `src/machines/supamoto/user-services/userServicesMachine.ts` - Contains the redundant "menu" state that needs to be removed; currently routes to customerTools or agent based on role
- `src/machines/supamoto/customer-tools/customerToolsMachine.ts` - Customer Tools submachine (referenced, not modified)
- `src/machines/supamoto/activation/customerActivationMachine.ts` - Agent activation submachine (referenced, not modified)

### Test Files

- `tests/machines/supamoto/parentMachine.test.ts` - Tests parent machine flow including post-auth navigation
- `tests/machines/supamoto/user-services/userServicesMachine.test.ts` - Tests userServicesMachine behavior; needs updates for direct routing
- `tests/machines/supamoto/account-login/loginMachine.test.ts` - Tests login flow; verifies role is passed correctly

### Documentation

- `docs/supamoto/MENU_STRUCTURE.md` - Specification showing intended flow without intermediate menu

## Step by Step Tasks

### Step 1: Understand Current Implementation

- Review the current `userServicesMachine` structure
- Identify the "menu" state that shows intermediate selection
- Understand how `buildMenuMessage()` currently works
- Verify how the machine is invoked from `parentMachine`

### Step 2: Modify userServicesMachine to Remove Intermediate Menu

- Change the initial state from "menu" to a computed state based on customerRole
- Remove the "menu" state entirely
- Update the machine to start directly in either "customerTools" or "agent" state based on role
- Modify the context initialization to determine the initial state
- Update guards and transitions to handle back/exit from the top-level submachines

### Step 3: Update Navigation Patterns

- Ensure "agent" and "customerTools" states properly handle back navigation to "routeToMain"
- Verify exit navigation (\*) goes to "routeToMain"
- Confirm error handling still works correctly

### Step 4: Update Tests

- Update `userServicesMachine.test.ts` to reflect direct routing to role-specific menus
- Remove tests that verify the intermediate "menu" state
- Add tests verifying customers go directly to customerTools
- Add tests verifying agents go directly to agent menu
- Update parent machine tests if needed to verify the flow

### Step 5: Validate Implementation

- Run all tests to ensure no regressions
- Verify the machine structure with `pnpm validate:machines`
- Test both customer and agent flows manually
- Ensure back/exit navigation works from top-level menus

## Validation Commands

Execute every command to validate the chore is complete with zero regressions.

- `pnpm format && pnpm lint && pnpm tsc --noEmit && pnpm install && pnpm build && pnpm validate:machines && pnpm test` - Run tests to validate the chore is complete with zero regressions.

## Notes

- The `buildMenuMessage()` function can be removed or repurposed since it's only used for the intermediate menu
- The "menu" state currently has transitions to "customerTools" and "agent" based on role - these will become the initial states
- The parent machine passes `customerRole` to userServicesMachine, which is already available for determining initial state
- Back navigation from customerTools or agent should go to "routeToMain" (which returns to Pre-Menu in parent)
- This change aligns the implementation with the specification in `docs/supamoto/MENU_STRUCTURE.md` section 4 (Services Menu)
