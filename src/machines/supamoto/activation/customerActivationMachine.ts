/**
 * Customer Activation Machine
 *
 * Handles the customer activation and eligibility verification flow for bean distribution.
 * This implements the sequence from lines 25-37 of the bean distribution diagram.
 *
 * Flow:
 * 1. Lead Generator verifies customer (enters customer ID and phone)
 * 2. System generates temp PIN and sends SMS to customer
 * 3. Customer activates account using temp PIN
 * 4. Customer answers eligibility question (1,000-day household)
 * 5. System submits claim if eligible and notifies customer
 *
 * Entry: verifyCustomer
 * Exit: complete (returns to main menu)
 */

import { assign, fromPromise, setup } from "xstate";
import { createModuleLogger } from "../../../services/logger.js";
import { dataService } from "../../../services/database-storage.js";
import {
  generatePin,
  sendActivationSMS,
  sendEligibilityConfirmationSMS,
} from "../../../services/sms.js";
import { submitClaim } from "../../../services/ixo/ixo-claims.js";
import { navigationGuards } from "../guards/navigation.guards.js";
import { withNavigation } from "../utils/navigation-mixin.js";
import { NavigationPatterns } from "../utils/navigation-patterns.js";

const logger = createModuleLogger("customerActivation");

// Types and Interfaces
export interface CustomerActivationContext {
  sessionId: string;
  phoneNumber: string;
  serviceCode: string;
  message: string;
  error?: string;
  // Flow type
  isLeadGenerator: boolean; // true if initiated by LG, false if by customer
  // Lead Generator flow
  customerId?: string;
  customerPhone?: string;
  tempPin?: string;
  // Customer activation flow
  isActivated: boolean;
  isEligible?: boolean;
  eligibilityRecordId?: number;
  claimId?: string;
  // Output
  nextParentState: CustomerActivationOutput;
}

export interface CustomerActivationInput {
  sessionId: string;
  phoneNumber: string;
  serviceCode: string;
  isLeadGenerator?: boolean; // true if initiated by LG, false if by customer
}

export type CustomerActivationEvent =
  | { type: "INPUT"; input: string }
  | { type: "ERROR"; error: string };

export enum CustomerActivationOutput {
  COMPLETE = "COMPLETE",
  CANCELLED = "CANCELLED",
  ERROR = "ERROR",
  UNDEFINED = "UNDEFINED",
}

// Messages
const VERIFY_CUSTOMER_PROMPT = "Verify Customer\nEnter Customer ID:";

const ENTER_PHONE_PROMPT =
  "Enter customer's phone number (with country code, e.g., +260971234567):";

const SENDING_ACTIVATION_SMS_MSG = "Sending activation SMS...\n1. Continue";

const ACTIVATION_SMS_SENT = (customerId: string) =>
  `Activation SMS sent to customer ${customerId}.\nCustomer will receive a temporary PIN to activate their account.\n1. Continue`;

const ENTER_TEMP_PIN_PROMPT =
  "Welcome! Enter the temporary PIN sent to your phone:";

const INVALID_PIN_MSG = "Invalid PIN. Please check your SMS and try again.";

const ACTIVATION_SUCCESS = "Account activated successfully!\n1. Continue";

const ELIGIBILITY_QUESTION =
  "Are you part of a 1,000-day household?\n(Pregnant or with child under 2 years)\n1. Yes\n2. No";

const NOT_ELIGIBLE_MSG =
  "Thank you for your response. Your information has been recorded.\n1. Continue";

const SUBMITTING_CLAIM_MSG =
  "Submitting your eligibility claim...\n1. Continue";

const ELIGIBILITY_CONFIRMED =
  "Congratulations! You are eligible for the bean distribution program. You will receive an SMS confirmation.\n1. Continue";

// Validation guards
const isValidCustomerId = ({ event }: { event: CustomerActivationEvent }) => {
  if (event.type !== "INPUT") return false;
  const customerId = event.input.trim();
  return /^C[A-Za-z0-9]{8,}$/.test(customerId);
};

const isValidPhoneNumber = ({ event }: { event: CustomerActivationEvent }) => {
  if (event.type !== "INPUT") return false;
  const phone = event.input.trim();
  // Basic validation: starts with + and has 10-15 digits
  return /^\+\d{10,15}$/.test(phone);
};

const isValidPin = ({ event }: { event: CustomerActivationEvent }) => {
  if (event.type !== "INPUT") return false;
  const pin = event.input.trim();
  return /^\d{6}$/.test(pin);
};

// Actors
const generateAndSendPinService = fromPromise(
  async ({ input }: { input: { customerId: string; phoneNumber: string } }) => {
    logger.info(
      {
        customerId: input.customerId.slice(-4),
        phoneNumber: input.phoneNumber.slice(-4),
      },
      "🔐 Generating and sending activation PIN"
    );

    try {
      const tempPin = generatePin();
      logger.info(
        {
          customerId: input.customerId.slice(-4),
          tempPin: "***",
        },
        "📝 Generated temporary PIN"
      );

      // Store temp PIN in database
      logger.info(
        {
          customerId: input.customerId.slice(-4),
          phoneNumber: input.phoneNumber.slice(-4),
        },
        "💾 Storing temporary PIN in database"
      );
      await dataService.setTempPin(
        input.customerId,
        input.phoneNumber,
        tempPin
      );
      logger.info(
        { customerId: input.customerId.slice(-4) },
        "✅ Temporary PIN stored successfully"
      );

      // Send SMS
      logger.info(
        {
          customerId: input.customerId.slice(-4),
          phoneNumber: input.phoneNumber.slice(-4),
        },
        "📱 Sending activation SMS"
      );
      const smsResult = await sendActivationSMS(
        input.phoneNumber,
        input.customerId,
        tempPin
      );

      // Check if SMS was actually sent successfully
      if (!smsResult.success) {
        logger.error(
          {
            customerId: input.customerId.slice(-4),
            phoneNumber: input.phoneNumber.slice(-4),
            error: smsResult.error,
          },
          "❌ SMS delivery failed - throwing error to trigger onError handler"
        );
        throw new Error(
          `SMS delivery failed: ${smsResult.error || "Unknown error"}`
        );
      }

      logger.info(
        {
          customerId: input.customerId.slice(-4),
          phoneNumber: input.phoneNumber.slice(-4),
          messageId: smsResult.messageId,
        },
        "✅ Activation SMS sent successfully"
      );

      return { tempPin };
    } catch (error) {
      logger.error(
        {
          customerId: input.customerId.slice(-4),
          phoneNumber: input.phoneNumber.slice(-4),
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        "❌ Error in generateAndSendPinService"
      );
      throw error;
    }
  }
);

const verifyPinService = fromPromise(
  async ({
    input,
  }: {
    input: { customerId: string; phoneNumber: string; pin: string };
  }) => {
    logger.info(
      { customerId: input.customerId.slice(-4) },
      "Verifying temporary PIN"
    );

    const isValid = await dataService.verifyTempPin(
      input.customerId,
      input.phoneNumber,
      input.pin
    );

    if (!isValid) {
      throw new Error("INVALID_PIN");
    }

    return { verified: true };
  }
);

const recordEligibilityService = fromPromise(
  async ({
    input,
  }: {
    input: { customerId: string; phoneNumber: string; isEligible: boolean };
  }) => {
    logger.info(
      { customerId: input.customerId.slice(-4), isEligible: input.isEligible },
      "Recording eligibility verification"
    );

    const record = await dataService.recordEligibility(
      input.customerId,
      input.phoneNumber,
      input.isEligible
    );

    return record;
  }
);

const submitClaimService = fromPromise(
  async ({
    input,
  }: {
    input: {
      customerId: string;
      phoneNumber: string;
      eligibilityRecordId: number;
    };
  }) => {
    logger.info(
      { customerId: input.customerId.slice(-4) },
      "Submitting 1,000-day household claim"
    );

    // TODO: Implement actual claim submission
    // This requires:
    // 1. Customer's IXO DID and address from database
    // 2. Customer's mnemonic (encrypted, needs PIN to decrypt)
    // 3. Collection ID for 1,000-day household claims

    // For now, stub this out
    logger.warn(
      { customerId: input.customerId.slice(-4) },
      "STUB: Would submit claim to ixo-matrix-supamoto-claims-bot"
    );

    // Simulate claim submission
    const stubClaimId = `claim-${Date.now()}`;

    // Update eligibility record with claim info
    await dataService.updateEligibilityWithClaim(
      input.eligibilityRecordId,
      stubClaimId,
      "pending"
    );

    return { claimId: stubClaimId };
  }
);

const sendConfirmationService = fromPromise(
  async ({ input }: { input: { phoneNumber: string } }) => {
    logger.info(
      { phoneNumber: input.phoneNumber.slice(-4) },
      "🎉 Sending eligibility confirmation SMS"
    );

    try {
      const smsResult = await sendEligibilityConfirmationSMS(input.phoneNumber);

      // Check if SMS was actually sent successfully
      if (!smsResult.success) {
        logger.error(
          {
            phoneNumber: input.phoneNumber.slice(-4),
            error: smsResult.error,
          },
          "❌ Eligibility confirmation SMS delivery failed - throwing error to trigger onError handler"
        );
        throw new Error(
          `SMS delivery failed: ${smsResult.error || "Unknown error"}`
        );
      }

      logger.info(
        {
          phoneNumber: input.phoneNumber.slice(-4),
          messageId: smsResult.messageId,
        },
        "✅ Eligibility confirmation SMS sent successfully"
      );

      // TODO: Implement token transfer
      // This requires integration with subscriptions-service-supamoto
      logger.warn(
        { phoneNumber: input.phoneNumber.slice(-4) },
        "⏳ STUB: Would transfer BEAN token via subscriptions-service-supamoto"
      );

      return { sent: true };
    } catch (error) {
      logger.error(
        {
          phoneNumber: input.phoneNumber.slice(-4),
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        "❌ Error in sendConfirmationService"
      );
      throw error;
    }
  }
);

export const customerActivationMachine = setup({
  types: {
    context: {} as CustomerActivationContext,
    events: {} as CustomerActivationEvent,
    input: {} as CustomerActivationInput,
  },
  guards: {
    isValidCustomerId,
    isValidPhoneNumber,
    isValidPin,
    isInput1: ({ event }) => event.type === "INPUT" && event.input === "1",
    isInput2: ({ event }) => event.type === "INPUT" && event.input === "2",
    isBack: ({ event }) => event.type === "INPUT" && event.input === "0",
    isExit: ({ event }) =>
      event.type === "INPUT" && event.input.toLowerCase() === "exit",
  },
  actors: {
    generateAndSendPinService,
    verifyPinService,
    recordEligibilityService,
    submitClaimService,
    sendConfirmationService,
  },
  actions: {
    clearErrors: assign({
      error: undefined,
    }),
  },
}).createMachine({
  id: "customerActivation",
  initial: "determineInitialState",
  context: ({ input }): CustomerActivationContext => ({
    sessionId: input?.sessionId || "",
    phoneNumber: input?.phoneNumber || "",
    serviceCode: input?.serviceCode || "",
    isLeadGenerator: input?.isLeadGenerator ?? true, // Default to LG flow for backward compatibility
    message:
      input?.isLeadGenerator === false
        ? ENTER_TEMP_PIN_PROMPT
        : VERIFY_CUSTOMER_PROMPT,
    isActivated: false,
    nextParentState: CustomerActivationOutput.UNDEFINED,
  }),
  output: ({ context }) => ({ result: context.nextParentState }),
  states: {
    // Determine initial state based on isLeadGenerator flag
    determineInitialState: {
      always: [
        {
          target: "verifyCustomer",
          guard: ({ context }) => context.isLeadGenerator === true,
        },
        {
          target: "customerEnterPin",
          guard: ({ context }) => context.isLeadGenerator === false,
        },
      ],
    },

    // Lead Generator enters customer ID
    verifyCustomer: {
      entry: assign({
        message: VERIFY_CUSTOMER_PROMPT,
      }),
      on: {
        INPUT: [
          {
            target: "enterPhone",
            guard: "isValidCustomerId",
            actions: assign({
              customerId: ({ event }) =>
                event.type === "INPUT" ? event.input.trim() : undefined,
            }),
          },
          {
            target: "verifyCustomer",
            actions: assign({
              message:
                "Invalid Customer ID format. Please enter a valid Customer ID (e.g., C12345678):",
            }),
          },
        ],
        ERROR: {
          target: "error",
          actions: assign({
            error: ({ event }) =>
              event.type === "ERROR" ? event.error : "Unknown error",
            message: ({ event }) =>
              event.type === "ERROR"
                ? `Error: ${event.error}\n0. Back`
                : "An error occurred\n0. Back",
          }),
        },
      },
    },

    // Lead Generator enters customer phone number
    enterPhone: {
      entry: assign({
        message: ENTER_PHONE_PROMPT,
      }),
      on: {
        INPUT: [
          {
            target: "sendingActivationSMS",
            guard: "isValidPhoneNumber",
            actions: assign({
              customerPhone: ({ event }) =>
                event.type === "INPUT" ? event.input.trim() : undefined,
            }),
          },
          {
            target: "enterPhone",
            actions: assign({
              message:
                "Invalid phone number. Please enter with country code (e.g., +260971234567):",
            }),
          },
        ],
        ERROR: {
          target: "error",
          actions: assign({
            error: ({ event }) =>
              event.type === "ERROR" ? event.error : "Unknown error",
            message: ({ event }) =>
              event.type === "ERROR"
                ? `Error: ${event.error}\n0. Back`
                : "An error occurred\n0. Back",
          }),
        },
      },
    },

    // System generates and sends activation PIN
    sendingActivationSMS: {
      entry: assign({
        message: SENDING_ACTIVATION_SMS_MSG,
      }),
      invoke: {
        id: "generateAndSendPin",
        src: "generateAndSendPinService",
        input: ({ context }) => ({
          customerId: context.customerId!,
          phoneNumber: context.customerPhone!,
        }),
        onDone: {
          target: "waitingForCustomer",
          actions: assign(({ event }) => ({
            tempPin: event.output.tempPin,
          })),
        },
        onError: {
          target: "error",
          actions: assign({
            message:
              "Failed to send activation SMS. Please try again.\n0. Back",
            error: "SMS_SEND_FAILED",
          }),
        },
      },
    },

    // Display confirmation to Lead Generator
    waitingForCustomer: {
      entry: assign({
        message: ({ context }) => ACTIVATION_SMS_SENT(context.customerId || ""),
      }),
      on: {
        INPUT: [
          {
            target: "complete",
            guard: "isInput1",
            actions: assign({
              nextParentState: CustomerActivationOutput.COMPLETE,
            }),
          },
          {
            target: "complete",
            guard: "isExit",
            actions: assign({
              nextParentState: CustomerActivationOutput.COMPLETE,
            }),
          },
        ],
        ERROR: {
          target: "error",
          actions: assign({
            error: ({ event }) =>
              event.type === "ERROR" ? event.error : "Unknown error",
            message: ({ event }) =>
              event.type === "ERROR"
                ? `Error: ${event.error}\n0. Back`
                : "An error occurred\n0. Back",
          }),
        },
      },
    },

    // Customer enters temporary PIN (separate USSD session)
    customerEnterPin: {
      entry: assign({
        message: ENTER_TEMP_PIN_PROMPT,
      }),
      on: {
        INPUT: [
          {
            target: "verifyingPin",
            guard: "isValidPin",
          },
          {
            target: "customerEnterPin",
            actions: assign({
              message:
                "Invalid PIN format. Please enter the 6-digit PIN from your SMS:",
            }),
          },
        ],
        ERROR: {
          target: "error",
          actions: assign({
            error: ({ event }) =>
              event.type === "ERROR" ? event.error : "Unknown error",
            message: ({ event }) =>
              event.type === "ERROR"
                ? `Error: ${event.error}\n0. Back`
                : "An error occurred\n0. Back",
          }),
        },
      },
    },

    // Verify temporary PIN
    verifyingPin: {
      invoke: {
        id: "verifyPin",
        src: "verifyPinService",
        input: ({ context, event }) => ({
          customerId: context.customerId!,
          phoneNumber: context.customerPhone!,
          pin: event.type === "INPUT" ? event.input.trim() : "",
        }),
        onDone: {
          target: "activationSuccess",
        },
        onError: {
          target: "customerEnterPin",
          actions: assign({
            message: INVALID_PIN_MSG,
          }),
        },
      },
    },

    // Activation successful
    activationSuccess: {
      entry: assign({
        message: ACTIVATION_SUCCESS,
        isActivated: true,
      }),
      on: {
        INPUT: [
          {
            target: "eligibilityQuestion",
            guard: "isInput1",
          },
          {
            target: "complete",
            guard: "isExit",
            actions: assign({
              nextParentState: CustomerActivationOutput.COMPLETE,
            }),
          },
        ],
        ERROR: {
          target: "error",
          actions: assign({
            error: ({ event }) =>
              event.type === "ERROR" ? event.error : "Unknown error",
            message: ({ event }) =>
              event.type === "ERROR"
                ? `Error: ${event.error}\n0. Back`
                : "An error occurred\n0. Back",
          }),
        },
      },
    },

    // Ask eligibility question
    eligibilityQuestion: {
      entry: assign({
        message: ELIGIBILITY_QUESTION,
      }),
      on: {
        INPUT: [
          {
            target: "recordingEligible",
            guard: "isInput1",
            actions: assign({
              message: SUBMITTING_CLAIM_MSG,
              isEligible: true,
            }),
          },
          {
            target: "recordingNotEligible",
            guard: "isInput2",
            actions: assign({
              message: NOT_ELIGIBLE_MSG,
              isEligible: false,
            }),
          },
          {
            target: "complete",
            guard: "isExit",
            actions: assign({
              nextParentState: CustomerActivationOutput.COMPLETE,
            }),
          },
        ],
        ERROR: {
          target: "error",
          actions: assign({
            error: ({ event }) =>
              event.type === "ERROR" ? event.error : "Unknown error",
            message: ({ event }) =>
              event.type === "ERROR"
                ? `Error: ${event.error}\n0. Back`
                : "An error occurred\n0. Back",
          }),
        },
      },
    },

    // Record not eligible (audit trail)
    recordingNotEligible: {
      invoke: {
        id: "recordNotEligible",
        src: "recordEligibilityService",
        input: ({ context }) => ({
          customerId: context.customerId!,
          phoneNumber: context.customerPhone!,
          isEligible: false,
        }),
        onDone: {
          target: "complete",
          actions: assign({
            nextParentState: CustomerActivationOutput.COMPLETE,
          }),
        },
        onError: {
          target: "error",
          actions: assign({
            error: "Failed to record eligibility",
            message: "Failed to record eligibility. Please try again.\n0. Back",
          }),
        },
      },
    },

    // Record eligible and submit claim
    recordingEligible: {
      invoke: {
        id: "recordEligible",
        src: "recordEligibilityService",
        input: ({ context }) => ({
          customerId: context.customerId!,
          phoneNumber: context.customerPhone!,
          isEligible: true,
        }),
        onDone: {
          target: "submittingClaim",
          actions: assign(({ event }) => ({
            eligibilityRecordId: event.output.id,
          })),
        },
        onError: {
          target: "error",
          actions: assign({
            error: "Failed to record eligibility",
            message: "Failed to record eligibility. Please try again.\n0. Back",
          }),
        },
      },
    },

    // Submit claim to IXO
    submittingClaim: {
      invoke: {
        id: "submitClaim",
        src: "submitClaimService",
        input: ({ context }) => ({
          customerId: context.customerId!,
          phoneNumber: context.customerPhone!,
          eligibilityRecordId: context.eligibilityRecordId!,
        }),
        onDone: {
          target: "sendingConfirmation",
          actions: assign(({ event }) => ({
            claimId: event.output.claimId,
          })),
        },
        onError: {
          target: "error",
          actions: assign({
            error: "Failed to submit claim",
            message: "Failed to submit claim. Please try again.\n0. Back",
          }),
        },
      },
    },

    // Send confirmation SMS and transfer tokens
    sendingConfirmation: {
      entry: assign({
        message: ELIGIBILITY_CONFIRMED,
      }),
      invoke: {
        id: "sendConfirmation",
        src: "sendConfirmationService",
        input: ({ context }) => ({
          phoneNumber: context.customerPhone!,
        }),
        onDone: {
          target: "complete",
          actions: assign({
            nextParentState: CustomerActivationOutput.COMPLETE,
          }),
        },
        onError: {
          target: "complete",
          actions: assign({
            nextParentState: CustomerActivationOutput.COMPLETE,
            error: "Failed to send confirmation SMS",
          }),
        },
      },
    },

    // Error state
    error: {
      on: {
        INPUT: [
          {
            target: "verifyCustomer",
            guard: "isBack",
          },
          {
            target: "complete",
            guard: "isExit",
            actions: assign({
              nextParentState: CustomerActivationOutput.COMPLETE,
            }),
          },
        ],
      },
    },

    // Final state
    complete: {
      type: "final",
      entry: assign({
        nextParentState: CustomerActivationOutput.COMPLETE,
      }),
    },
  },
});
