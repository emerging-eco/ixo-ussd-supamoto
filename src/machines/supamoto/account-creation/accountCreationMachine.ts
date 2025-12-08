import { setup, assign, fromPromise } from "xstate";
import { withNavigation } from "../utils/navigation-mixin.js";
import { navigationGuards } from "../guards/navigation.guards.js";
import { validationGuards } from "../guards/validation.guards.js";
import { NavigationPatterns } from "../utils/navigation-patterns.js";
import { dataService } from "../../../services/database-storage.js";
import { submitLeadCreationClaim } from "../../../services/ixo/lead-claim-submission.js";
import { messages } from "../../../constants/branding.js";
import { validateUserInput } from "../../../utils/input-validation.js";

// Constants
export const SKIP_EMAIL_INPUT = "00"; // Use "00" to avoid conflict with navigation "0" (back)
export const SKIP_NATIONAL_ID_INPUT = "00"; // Use "00" to skip national ID entry

/**
 * Account Creation Machine - New User Registration
 *
 * Handles the complete account creation flow for brand new users:
 * - Personal information collection (name, email)
 * - PIN setup and confirmation
 * - Customer record creation
 * - Account activation and success confirmation
 *
 * Entry Points: nameEntry
 * Exit Points: SUCCESS (account created), CANCELLED (back to menu)
 */

export enum AccountCreationOutput {
  UNDEFINED = "UNDEFINED",
  ACCOUNT_CREATED = "ACCOUNT_CREATED",
  CANCELLED = "CANCELLED",
  ERROR = "ERROR",
}

export interface AccountCreationContext {
  sessionId: string;
  phoneNumber: string;
  serviceCode: string;

  // Customer account creation data
  fullName: string;
  email: string;
  isEmailSkipped: boolean;
  nationalId: string;
  isNationalIdSkipped: boolean;
  pin: string;
  confirmPin: string;
  generatedCustomerId?: string;
  phoneRecordId?: number;
  customerRecordId?: number;

  // Router pattern: tracks parent routing decision
  nextParentState: AccountCreationOutput;

  // Flow control
  currentStep:
    | "nameEntry"
    | "emailEntry"
    | "nationalIdEntry"
    | "pinEntry"
    | "confirmPin"
    | "creatingAccount"
    | "accountCreationSuccess"
    | "cancelled"
    | "error"
    | "routeToMain";
  error?: string;
  validationError?: string;

  // USSD Response
  message: string;
}

export type AccountCreationEvent =
  | { type: "INPUT"; input: string }
  | { type: "ERROR"; error: string };

const fullNameMessage = `${messages.welcome()}\nEnter your full name:`;
const tryAgainMessage = "\n1. Try Again";
const returnToMainMenuMessage = "\n0. Back to Main Menu";
const successMessage = (customerId: string) =>
  `Account created successfully!\nYour Customer ID: ${customerId}\nSave your Customer ID to access services.\n1. Back to Account Menu`;

export const accountCreationMachine = setup({
  types: {
    context: {} as AccountCreationContext,
    events: {} as AccountCreationEvent,
    input: {} as {
      sessionId: string;
      phoneNumber: string;
      serviceCode: string;
    },
  },

  actors: {
    createCustomerService: fromPromise(
      async ({
        input,
      }: {
        input: {
          phoneNumber: string;
          fullName: string;
          email: string;
          nationalId: string;
          pin: string;
        };
      }) => {
        // Step 1: Create or update phone record
        const phoneRecord = await dataService.createOrUpdatePhoneRecord(
          input.phoneNumber
        );

        // Step 2: Create customer record
        const customerRecord = await dataService.createCustomerRecord(
          phoneRecord.id,
          {
            fullName: input.fullName,
            email: input.email || undefined,
            nationalId: input.nationalId || undefined,
            pin: input.pin,
            preferredLanguage: "eng",
            lastCompletedAction: "account_creation",
          }
        );

        // Step 3: Fire-and-forget IXO account creation (non-blocking)
        // This is a safety net for background process - errors should not crash the server
        submitLeadCreationClaim({
          customerId: customerRecord.customerId,
          phoneNumber: input.phoneNumber,
          fullName: input.fullName,
          nationalId: input.nationalId || undefined,
        }).catch((error: any) => {
          // Robust error handling - ensure this catch handler never throws
          try {
            // Error is already logged in the background service
            /* eslint-disable no-console */
            console.error(
              `Background IXO creation failed for customer ${customerRecord.customerId}:`,
              error instanceof Error ? error.message : String(error),
              error instanceof Error && error.stack ? error.stack : ""
            );
          } catch (loggingError) {
            // Final safety net - even logging errors shouldn't crash
            console.error(
              "Error while logging background IXO creation failure:",
              loggingError
            );
          }
        });

        return {
          customerId: customerRecord.customerId,
          phoneRecordId: phoneRecord.id,
          customerRecordId: customerRecord.id,
        };
      }
    ),
  },

  actions: {
    // Navigation actions
    setNameMessage: assign(() => ({
      message: fullNameMessage,
      currentStep: "nameEntry" as const,
    })),

    setEmailMessage: assign(() => ({
      message: `Enter your email address (optional):\n${SKIP_EMAIL_INPUT}. Skip`,
      currentStep: "emailEntry" as const,
    })),

    setNationalIdMessage: assign(() => ({
      message: `Enter your National ID (format: 123456/12/1):\n${SKIP_NATIONAL_ID_INPUT}. Skip`,
      currentStep: "nationalIdEntry" as const,
    })),

    setPinMessage: assign(() => ({
      message: `Create a 5-digit PIN for your account:\n`,
      currentStep: "pinEntry" as const,
    })),

    setConfirmPinMessage: assign(() => ({
      message: "Confirm your 5-digit PIN:",
      currentStep: "confirmPin" as const,
    })),

    setCreatingAccountMessage: assign(() => ({
      message: `Creating your account...\n1. View your Customer ID`,
      currentStep: "creatingAccount" as const,
    })),

    setSuccessMessage: assign(({ context }) => ({
      message: successMessage(context.generatedCustomerId ?? ""),
      currentStep: "accountCreationSuccess" as const,
    })),

    setCancelMessage: assign(() => ({
      message: `Account creation cancelled.${returnToMainMenuMessage}`,
      currentStep: "cancelled" as const,
    })),

    // Data collection actions
    setFullName: assign(({ event }) => ({
      fullName: event.type === "INPUT" ? event.input : "",
    })),

    setEmail: assign(({ event }) => ({
      email: event.type === "INPUT" ? event.input : "",
      isEmailSkipped: false, // Clear boolean flag when email is provided
    })),

    setSkipEmail: assign(() => ({
      email: "", // Empty string for skipped email
      isEmailSkipped: true, // Clear boolean flag
    })),

    setNationalId: assign(({ event }) => {
      if (event.type !== "INPUT")
        return { nationalId: "", isNationalIdSkipped: false };
      const validation = validateUserInput(event.input, "nationalId");
      return {
        nationalId: validation.isValid ? validation.value : event.input,
        isNationalIdSkipped: false,
      };
    }),

    setSkipNationalId: assign(() => ({
      nationalId: "", // Empty string for skipped national ID
      isNationalIdSkipped: true, // Set boolean flag
    })),

    setPin: assign(({ event }) => ({
      pin: event.type === "INPUT" ? event.input : "",
    })),

    setConfirmPin: assign(({ event }) => ({
      confirmPin: event.type === "INPUT" ? event.input : "",
    })),

    // Error handling
    setError: assign(({ event }) => ({
      error: event.type === "ERROR" ? event.error : "An error occurred",
      message: `Error: ${event.type === "ERROR" ? event.error : "An error occurred"}\n${returnToMainMenuMessage}`,
      currentStep: "error" as const,
    })),

    clearErrors: assign(() => ({
      error: undefined,
      validationError: undefined,
    })),

    setPinMismatchError: assign(() => ({
      validationError: "PINs do not match",
      message:
        "PINs do not match. Please try again.\n\nCreate a 5-digit PIN for your account:",
      currentStep: "pinEntry" as const,
    })),

    setInvalidPinError: assign(() => ({
      validationError: "Invalid PIN format",
      message:
        "PIN must be 5 digits. Please try again.\n\nCreate a 5-digit PIN for your account:",
      currentStep: "pinEntry" as const,
    })),

    setInvalidNationalIdError: assign(() => ({
      validationError: "Invalid National ID format",
      message:
        "Invalid format. Use: 123456/12/1\n\nEnter your National ID (format: 123456/12/1):\n00. Skip",
      currentStep: "nationalIdEntry" as const,
    })),
  },

  guards: {
    // Input validation guards
    isInput1: ({ event }) =>
      navigationGuards.isInput("1")(null as any, event as any),
    isInput2: ({ event }) =>
      navigationGuards.isInput("2")(null as any, event as any),

    // Validation guards
    isValidPin: ({ event }) =>
      validationGuards.isValidPin(null as any, event as any),

    isInvalidPin: ({ event }) =>
      !validationGuards.isValidPin(null as any, event as any),

    isPinMatch: ({ context, event }) =>
      event.type === "INPUT" && context.pin === event.input,

    isPinMismatch: ({ context, event }) =>
      event.type === "INPUT" && context.pin !== event.input,

    isValidEmail: ({ event }) =>
      event.type === "INPUT" &&
      (event.input === SKIP_EMAIL_INPUT ||
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(event.input)),

    isSkipEmail: ({ event }) =>
      event.type === "INPUT" && event.input === SKIP_EMAIL_INPUT,

    isValidEmailAddress: ({ event }) =>
      event.type === "INPUT" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(event.input),

    isSkipNationalId: ({ event }) =>
      event.type === "INPUT" && event.input === SKIP_NATIONAL_ID_INPUT,

    isValidNationalIdValue: ({ event }) => {
      if (event.type !== "INPUT") return false;
      const validation = validateUserInput(event.input, "nationalId");
      return validation.isValid;
    },

    isInvalidNationalIdValue: ({ event }) => {
      if (event.type !== "INPUT") return false;
      const validation = validateUserInput(event.input, "nationalId");
      return !validation.isValid;
    },

    isValidName: ({ event }) =>
      validationGuards.isValidTextInput(null as any, event as any),

    isAccountCreated: ({ context }: { context: AccountCreationContext }) =>
      AccountCreationOutput.ACCOUNT_CREATED === context.nextParentState,

    // Navigation guards
    isBack: ({ event }) =>
      navigationGuards.isBackCommand(null as any, event as any),
    isExit: ({ event }) =>
      navigationGuards.isExitCommand(null as any, event as any),
  },
}).createMachine({
  id: "accountCreation",
  initial: "nameEntry",

  context: ({ input }): AccountCreationContext => ({
    sessionId: input?.sessionId || "",
    phoneNumber: input?.phoneNumber || "",
    serviceCode: input?.serviceCode || "",
    fullName: "",
    email: "",
    isEmailSkipped: false,
    nationalId: "",
    isNationalIdSkipped: false,
    pin: "",
    confirmPin: "",
    nextParentState: AccountCreationOutput.UNDEFINED,
    currentStep: "nameEntry" as const,
    message: fullNameMessage,
  }),

  output: ({ context }) => ({ result: context.nextParentState }),

  states: {
    nameEntry: {
      entry: "setNameMessage",
      on: {
        INPUT: withNavigation(
          [
            {
              target: "emailEntry",
              guard: "isValidName",
              actions: ["setFullName", "clearErrors"],
            },
          ],
          NavigationPatterns.accountCreationChild
        ),
        ERROR: {
          target: "error",
          actions: "setError",
        },
      },
    },

    emailEntry: {
      entry: "setEmailMessage",
      on: {
        INPUT: withNavigation(
          [
            // Handle skip email first (before navigation)
            {
              target: "nationalIdEntry",
              guard: "isSkipEmail",
              actions: ["setSkipEmail", "clearErrors"],
            },
            // Handle valid email
            {
              target: "nationalIdEntry",
              guard: "isValidEmailAddress",
              actions: ["setEmail", "clearErrors"],
            },
          ],
          {
            backTarget: "nameEntry",
            exitTarget: "routeToMain",
            enableBack: true,
            enableExit: true,
          }
        ),
        ERROR: {
          target: "error",
          actions: "setError",
        },
      },
    },

    nationalIdEntry: {
      entry: "setNationalIdMessage",
      on: {
        INPUT: withNavigation(
          [
            // Handle skip national ID first (before navigation)
            {
              target: "pinEntry",
              guard: "isSkipNationalId",
              actions: ["setSkipNationalId", "clearErrors"],
            },
            // Handle valid national ID
            {
              target: "pinEntry",
              guard: "isValidNationalIdValue",
              actions: ["setNationalId", "clearErrors"],
            },
            // Handle invalid national ID - stay in same state with error
            {
              target: "nationalIdEntry",
              guard: "isInvalidNationalIdValue",
              actions: "setInvalidNationalIdError",
            },
          ],
          {
            backTarget: "emailEntry",
            exitTarget: "routeToMain",
            enableBack: true,
            enableExit: true,
          }
        ),
        ERROR: {
          target: "error",
          actions: "setError",
        },
      },
    },

    pinEntry: {
      entry: "setPinMessage",
      on: {
        INPUT: withNavigation(
          [
            {
              target: "confirmPin",
              guard: "isValidPin",
              actions: ["setPin", "clearErrors"],
            },
            {
              target: "pinEntry",
              guard: "isInvalidPin",
              actions: "setInvalidPinError",
            },
          ],
          {
            backTarget: "nationalIdEntry",
            exitTarget: "routeToMain",
            enableBack: true,
            enableExit: true,
          }
        ),
        ERROR: {
          target: "error",
          actions: "setError",
        },
      },
    },

    confirmPin: {
      entry: "setConfirmPinMessage",
      on: {
        INPUT: withNavigation(
          [
            {
              target: "creatingAccount",
              guard: "isPinMatch",
              actions: ["setConfirmPin", "clearErrors"],
            },
            {
              target: "pinEntry",
              guard: "isPinMismatch",
              actions: "setPinMismatchError",
            },
          ],
          {
            backTarget: "pinEntry",
            exitTarget: "routeToMain",
            enableBack: true,
            enableExit: true,
          }
        ),
        ERROR: {
          target: "error",
          actions: "setError",
        },
      },
    },

    creatingAccount: {
      entry: "setCreatingAccountMessage",
      invoke: {
        id: "createCustomer",
        src: "createCustomerService",
        input: ({ context }) => ({
          phoneNumber: context.phoneNumber,
          fullName: context.fullName,
          email: context.isEmailSkipped ? "" : context.email,
          nationalId: context.isNationalIdSkipped ? "" : context.nationalId,
          pin: context.pin,
        }),
        onDone: {
          actions: assign(({ event }) => ({
            generatedCustomerId: event.output.customerId,
            phoneRecordId: event.output.phoneRecordId,
            customerRecordId: event.output.customerRecordId,
            nextParentState: AccountCreationOutput.ACCOUNT_CREATED,
          })),
        },
        onError: {
          target: "error",
          actions: assign(({ event }) => ({
            message: `Failed to create account: ${String(event.error)}${tryAgainMessage}`,
            error: String(event.error),
            nextParentState: AccountCreationOutput.ERROR,
          })),
        },
      },
      on: {
        INPUT: {
          target: "accountCreationSuccess",
          guard: "isAccountCreated",
        },
      },
    },

    accountCreationSuccess: {
      entry: "setSuccessMessage",
      on: {
        INPUT: {
          target: "routeToMain",
        },
      },
    },

    cancelled: {
      entry: [
        "setCancelMessage",
        assign(() => ({
          nextParentState: AccountCreationOutput.CANCELLED,
        })),
      ],
      on: {
        INPUT: {
          target: "routeToMain",
        },
      },
    },

    error: {
      entry: [
        "setError",
        assign(() => ({
          nextParentState: AccountCreationOutput.ERROR,
        })),
      ],
      on: {
        INPUT: {
          target: "routeToMain",
        },
      },
    },

    routeToMain: {
      type: "final",
    },
  },
});

export type AccountCreationMachine = typeof accountCreationMachine;
