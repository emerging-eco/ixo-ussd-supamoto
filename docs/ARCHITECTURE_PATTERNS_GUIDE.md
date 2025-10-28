# Architecture Patterns Guide - USSD Example App

This document defines the established architectural patterns for the generic USSD Example App.

## 🎯 Core Architectural Principles

### 1. Two-Event Simplicity

Each organisational state machines consists of a single parent machine and multiple child machines.
The organisational state machines are located in the `src/machines/<your-organisation>` directory.
For example, see `src/machines/example` as a reference implementation that can be adapted.

All child machines use only two event types for maximum simplicity and consistency.
**Required Events:**

- ✅ `INPUT`: User input from USSD interface
- ✅ `ERROR`: Error handling and recovery
  **Reference Pattern:**

```typescript
export type MachineEvent =
  | { type: "INPUT"; input: string }
  | { type: "ERROR"; error: string };
```

### 2. Autonomous Child Machines

Child machines are completely self-sufficient and require no parent dependency.

**Key Characteristics:**

- ✅ Start directly in operational state (no START event required)
- ✅ Generate own USSD messages via actions
- ✅ Handle complete business logic internally
- ✅ Use final states for clean parent coordination

**Reference:** `knowMoreMachine.ts`

```typescript
initial: "infoMenu", // Direct startup
context: ({ input }) => ({
  sessionId: input?.sessionId || "",
  message: infoMenuMessage, // Own message content
})
```

### 3. Navigation Mixin Pattern

The `withNavigation()` function is the cornerstone of the architecture, providing universal navigation.

**Core Function:** `withNavigation(existingHandlers, navigationOptions)`

**Usage Pattern:**

```typescript
INPUT: withNavigation(
  [
    // Business logic handlers first
    { target: "nextState", guard: "isValidInput", actions: ["processInput"] },
  ],
  NavigationPatterns.informationChild // Predefined behavior
);
```

**Key Benefits:**

- **Priority Ordering**: Navigation handlers checked FIRST, then business logic
- **Composable Design**: Adds navigation without replacing existing handlers
- **Pattern-Based Configuration**: Uses predefined patterns for consistency
- **Universal Commands**: Consistent "0. Back" and "\*. Exit" across all machines

**Implementation:**

```typescript
export function withNavigation(
  existingInputHandlers: any[],
  options: NavigationOptions = {}
): any[] {
  // Navigation handlers first, then existing handlers
  return [...navigationHandlers, ...existingInputHandlers];
}
```

### 4. Perfect Parent-Child Separation

Parents orchestrate, children execute. Zero overlap in responsibilities.

**Parent Responsibilities:**

- Event forwarding to child machines
- Routing based on child outputs
- Session and context management

**Child Responsibilities:**

- Business logic execution
- USSD message generation
- State management
- Error handling

**Implementation:**

```typescript
// Parent: Pure orchestration
knowMoreService: {
  on: { INPUT: { actions: sendTo("knowMoreChild", ({ event }) => event) } },
  invoke: { id: "knowMoreChild", src: "knowMoreMachine" }
}

// Child: Complete autonomy
context: ({ input }) => ({
  message: "Welcome to USSD Example App Information Center...",
})
```

### 5. Modular Guard System

Centralized, reusable guard functions with proper TypeScript typing.

**Guard Organization:**

- **Navigation Guards**: `guards/navigation.guards.ts`
- **Validation Guards**: `guards/validation.guards.ts`
- **Business Logic Guards**: `guards/[domain].guards.ts`

**Navigation Guard Usage:**

```typescript
guards: {
  isInput1: ({ event }) => navigationGuards.isInput("1")(null as any, event as any),
  isBack: ({ event }) => navigationGuards.isBackCommand(null as any, event as any),
}
```

### 6. Centralized Validation Pattern

All input validation is handled through centralized validation functions that provide consistent business rules across the entire application.

**Architecture Flow:**

```
Machine Guard → validationGuards → validateUserInput() → Specific Validator → Business Rules
```

**Validation Guard Usage:**

```typescript
guards: {
  // PIN validation with centralized business rules
  isValidPin: ({ event }) => validationGuards.isValidPin(null as any, event as any),

  // Text input validation with length/format rules
  isValidName: ({ event }) => validationGuards.isValidTextInput(null as any, event as any),

  // Email validation with format checking
  isValidEmail: ({ event }) => validationGuards.isValidTextInput(null as any, event as any),

  // Amount validation with business limits
  isValidAmount: ({ event }) => validationGuards.isValidAmount(null as any, event as any),
}
```

**Available Validation Functions:**

- `validationGuards.isValidPin()` - PIN format, length, and security rules
- `validationGuards.isValidTextInput()` - General text validation with options
- `validationGuards.isValidAmount()` - Transaction amount validation
- `validationGuards.isValidMenuInput()` - Menu selection validation
- `validationGuards.isValidPhoneInput()` - Phone number format validation
- `validationGuards.isValidIxoAddress()` - Blockchain address validation

**Type Safety Pattern:**
The `null as any, event as any` pattern is used because:

- Centralized validators expect different type signatures than XState guards
- `null as any` bypasses context parameter (validation only needs event data)
- `event as any` ensures compatibility with centralized validation interface
- Business logic remains type-safe within the validation functions

**Business Rules Centralization:**

```typescript
// All validation rules are centralized in utils/input-validation.ts
VALIDATION_RULES = {
  PIN: {
    MIN_LENGTH: 4,
    MAX_LENGTH: 6,
    WEAK_PINS: ["0000", "1111", "1234", ...] // Blocked patterns
  },
  AMOUNT: {
    MIN: 0.01,
    MAX: 1000000,
    DECIMALS: 2
  }
}
```

**Custom Domain Validation:**
For domain-specific validation, create guards in appropriate domain files:

```typescript
// guards/account-creation.guards.ts
export const isValidCustomerName = ({ event }) =>
  validationGuards.isValidTextInput(null as any, event as any) &&
  event.input.trim().length >= 2; // Additional business rule
```

### 8. XState v5 Setup Pattern

Strict adherence to XState v5 best practices with full TypeScript integration.

**Required Structure:**

```typescript
export const machineName = setup({
  types: {
    context: {} as MachineContext,
    events: {} as MachineEvent,
    input: {} as MachineInput,
  },
  actions: {
    /* all actions */
  },
  guards: {
    /* all guards */
  },
}).createMachine({
  context: ({ input }) => ({
    /* handle input here */
  }),
  states: {
    /* state definitions */
  },
});
```

### 7. Router Pattern for Parent Communication

Enhanced child machines that communicate routing decisions back to parent machines.

> Take note that the `routeToMain` state is an important part of the router pattern. It is a `final` state that triggers the `xstate.done.actor` event for the parent machine to handle.
> All child machines must have a `routeToMain` state that is a `final` state.

**Context-Based Routing:**

```typescript
export interface RouterContext {
  // Standard child context
  sessionId: string;
  phoneNumber: string;
  serviceCode: string;
  message: string;
  error?: string;
  // Router-specific: tracks parent routing decision
  nextParentState?: RouterOutput;
}
```

**Machine-Level Output:**

```typescript
}).createMachine({
  // Output function at machine level (not final state level)
  output: ({ context }) => ({ result: context.nextParentState }),

  states: {
    routeToMain: {
      type: "final", // No output here - handled at machine level
    }
  }
})
```

**Parent Communication Flow:**

```typescript
// 1. Child sets routing decision
assign({ nextParentState: AccountMenuOutput.LOGIN_SELECTED });

// 2. Child completes with machine-level output
output: ({ context }) => ({ result: context.nextParentState });

// 3. Parent routes based on child decision
guard: ({ event }) => event.output?.result === AccountMenuOutput.LOGIN_SELECTED;
```

## 🧭 Navigation Architecture

### Navigation Patterns System

Predefined navigation behaviors for different machine types, organized hierarchically.

**Child Machine Patterns:**

```typescript
// Simple information display machines
NavigationPatterns.informationChild: {
  enableBack: true,
  enableExit: false, // Parent handles exit
  backTarget: "routeToMain",
  exitTarget: "routeToMain"
}

// Router machines that dispatch to other services
NavigationPatterns.accountMenuChild: {
  enableBack: true,
  enableExit: false,
  backTarget: "showMenu", // Back to own menu
  exitTarget: "routeToMain"
}

// Authentication flow machines
NavigationPatterns.loginChild: {
  enableBack: true,
  enableExit: true,
  backTarget: "cancelled",
  exitTarget: "cancelled"
}
```

**Parent Machine Patterns:**

```typescript
// Main application menu
NavigationPatterns.mainMenu: {
  enableBack: false, // No back from main
  enableExit: true,
  exitTarget: "closeSession"
}

// Service flows
NavigationPatterns.service: {
  enableBack: true,
  enableExit: true,
  backTarget: "preMenu",
  exitTarget: "closeSession"
}
```

### Navigation Mixin Implementation

```typescript
export function withNavigation(
  existingInputHandlers: any[],
  options: NavigationOptions = {}
): any[] {
  // Navigation handlers first, then existing handlers
  return [...navigationHandlers, ...existingInputHandlers];
}
```

## 🏗️ Machine Types

### Simple Child Machines.

Self-contained machines that display information and return to parent.

**Characteristics:**

- ✅ Two events only: `INPUT` and `ERROR`
- ✅ Own message content via actions
- ✅ Simple final state: `routeToMain: { type: "final" }`
- ✅ No parent communication needed

**Reference Implementation:** `knowMoreMachine.ts`

### Router Child Machines

Enhanced machines that make routing decisions for parent machines.

**Characteristics:**

- ✅ Two events only: `INPUT` and `ERROR`
- ✅ Context tracks routing decision: `nextParentState`
- ✅ Machine-level output: `output: ({ context }) => ({ result: context.nextParentState })`
- ✅ Parent communication via output

**Reference Implementation:** `accountMenuMachine.ts`

## 📝 Message Management Strategy

### Child-Owned Messages

Each child machine owns and manages its USSD display content.

```typescript
actions: {
  setInfoMenuMessage: assign(() => ({ message: infoMenuMessage })),
  loadProductInfo: assign({ message: "Products:\n[content]\n0. Back" }),
}
```

## 🏗️ State Organization

### Clear State Hierarchy

Each state has a specific, well-defined purpose.

**KnowMore Machine States:**

- `infoMenu`: Main menu with navigation options
- `displayingInfo`: Content display with back navigation
- `error`: Error handling with recovery options
- `routeToMain`: Clean exit point for parent coordination

## 🧪 Testing Architecture

### Required Test Coverage

Every machine must include comprehensive tests covering:

1. **Initial State Tests**: Verify autonomous startup
2. **Navigation Tests**: Test all menu options and back navigation
3. **Business Logic Tests**: Verify core functionality
4. **Error Handling Tests**: Test error states and recovery
5. **Integration Tests**: Ensure parent-child communication

### Demo File Pattern

Interactive demonstration files for visual development feedback.

```typescript
actor.subscribe(snapshot => {
  console.log(`📍 State: ${snapshot.value}`);
  console.log(`💬 Message: ${snapshot.context.message}`);
});
```

### Flow Test Timing Pattern

Flow tests simulate real-world USSD interactions by including a mandatory 2-second delay between each turn (except Turn 1, the initial dial).

#### Why the Delay is Needed

1. **Realistic User Interaction**: Real users don't respond instantly to USSD prompts. A 2-second delay simulates realistic thinking and input time.

2. **Async Operation Completion**: Prevents race conditions with asynchronous database operations, IXO blockchain calls, and SMS sending. These operations need time to complete before the next interaction.

3. **Server-Side State Transitions**: Allows XState machines to complete state transitions and context updates before processing the next input.

#### Why XState's Built-in Delays Don't Apply

USSD follows a **request-response protocol** where the client must initiate each interaction:

- The server **cannot push** state changes to the client (unlike WebSocket or Server-Sent Events)
- When async operations occur (database queries, blockchain calls), the server shows "Verifying..." messages with "1. Continue" option
- The client must **explicitly send "1"** to proceed, creating a synchronous interaction pattern
- XState's `after` delays and automatic transitions don't work because the server is **waiting for client input**, not transitioning automatically

This is fundamentally different from web applications where XState can automatically transition after delays. In USSD, every transition requires explicit user input.

#### Implementation

The delay is automatically generated by the `VitestGenerator` class in `src/utils/vitest-generator.ts`:

```typescript
// Added to all test cases except Turn 1
it('Turn 2: Input: "1"', async () => {
  // Simulate realistic user interaction timing (2-second delay)
  await new Promise(resolve => setTimeout(resolve, 2000));

  const response = await sendUssdRequest("1");
  // ... assertions
});
```

#### Testing Implications

- **Reliability**: Flow tests are more reliable and less prone to timing-related failures
- **Accuracy**: Tests accurately simulate real-world USSD interaction timing
- **Async Safety**: Async operations have time to complete before assertions run
- **Consistency**: All flow tests use the same delay mechanism

#### Regenerating Tests

When regenerating flow tests, the 2-second delay is automatically included:

```bash
# Record a new session
pnpm test:interactive

# Generate test with automatic delays
pnpm generate:test logs/sessions/session-YYYY-MM-DD-HH-mm-ss.log flow-name
```

## 🎯 Implementation Checklist

### For All Child Machines:

- [ ] **Two-Event System**: Use only `INPUT` and `ERROR` events
- [ ] **XState v5 Setup**: Use `setup()` pattern with proper TypeScript types
- [ ] **Autonomous Startup**: Start directly in operational state (no START event)
- [ ] **Own Messages**: Generate USSD messages via actions (child owns content)
- [ ] **Navigation Mixin**: Use `withNavigation()` for consistent navigation
- [ ] **Navigation Patterns**: Apply appropriate `NavigationPatterns` configuration
- [ ] **Modular Guards**: Use `navigationGuards` and `validationGuards` functions
- [ ] **Test Coverage**: Implement comprehensive test coverage
- [ ] **Demo File**: Create interactive demo file
- [ ] **No Magic Strings**: Use centralized constants

### For Simple Child Machines (KnowMore Pattern):

- [ ] **Simple Final State**: Use `routeToMain: { type: "final" }`
- [ ] **Information Display**: Focus on content display and navigation
- [ ] **No Parent Communication**: Just complete and return to parent

### For Router Child Machines (AccountMenu Pattern):

- [ ] **Context Routing**: Add `nextParentState` to context
- [ ] **Machine-Level Output**: Use `output: ({ context }) => ({ result: context.nextParentState })`
- [ ] **Routing Actions**: Set `nextParentState` in transition actions
- [ ] **Parent Guards**: Ensure parent has guards for all possible outputs

## 📚 Reference Files

**Primary Reference Implementations:**

- **Simple Child Pattern**: `src/machines/example/information/knowMoreMachine.ts`
- **Router Child Pattern**: `src/machines/example/account-menu/accountMenuMachine.ts`

**Core Architecture:**

- **Navigation Mixin**: `src/machines/example/utils/navigation-mixin.ts`
- **Navigation Patterns**: `src/machines/example/utils/navigation-patterns.ts`
- **Navigation Guards**: `src/machines/example/guards/navigation.guards.ts`
- **Validation Guards**: `src/machines/example/guards/validation.guards.ts`
- **Input Validation**: `src/utils/input-validation.ts`
- **Constants**: `src/constants/navigation.ts`, `src/constants/branding.ts`

**Test Examples:**

- `src/machines/example/information/knowMoreMachine.test.ts`
- `src/machines/example/account-menu/accountMenuMachine.test.ts`

**Demo Examples:**

- `src/machines/example/information/knowMoreMachine-demo.ts`
- `src/machines/example/account-menu/accountMenuMachine-demo.ts`

**Documentation:**

- `docs/development/XState-Implementation-Guide.md`
- `docs/development/STATE_MACHINE_PATTERNS.md`
