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
import { createModuleLogger } from "../../../../src/services/logger.js";
import { dataService } from "../../../../src/services/database-storage.js";
import {
  generatePin,
  sendActivationSMS,
  sendEligibilityConfirmationSMS,
} from "../../../../src/services/sms.js";

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

      // Reset customer PIN with temporary PIN
      logger.info(
        {
          customerId: input.customerId.slice(-4),
          phoneNumber: input.phoneNumber.slice(-4),
        },
        "💾 Resetting customer PIN with temporary PIN"
      );
      await dataService.resetCustomerPin(
        input.customerId,
        tempPin,
        undefined // lgCustomerId not available in this context
      );
      logger.info(
        { customerId: input.customerId.slice(-4) },
        "✅ Temporary PIN set successfully"
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
      "🔐 Verifying temporary PIN"
    );

    try {
      // Get customer record
      const customer = await dataService.getCustomerByCustomerId(
        input.customerId
      );

      if (!customer) {
        throw new Error("Customer not found");
      }

      // Verify PIN by encrypting input and comparing with stored encrypted PIN
      // This reuses the same logic as the login machine
      const { encryptPin } = await import(
        "../../../../src/utils/encryption.js"
      );
      const encryptedInputPin = encryptPin(input.pin);
      const isValid = encryptedInputPin === customer.encryptedPin;

      if (!isValid) {
        logger.warn(
          { customerId: input.customerId.slice(-4) },
          "❌ Temporary PIN verification failed - invalid PIN"
        );
        throw new Error("INVALID_PIN");
      }

      logger.info(
        { customerId: input.customerId.slice(-4) },
        "✅ Temporary PIN verified successfully"
      );

      return { verified: true };
    } catch (error) {
      logger.error(
        {
          customerId: input.customerId.slice(-4),
          error: error instanceof Error ? error.message : String(error),
        },
        "❌ PIN verification failed"
      );
      throw error;
    }
  }
);

const submitClaimService = fromPromise(
  async ({
    input,
  }: {
    input: {
      customerId: string;
      phoneNumber: string;
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

    return { claimId: stubClaimId };
  }
);

const sendConfirmationService = fromPromise(
  async ({ input }: { input: { phoneNumber: string; customerId: string } }) => {
    logger.info(
      { phoneNumber: input.phoneNumber.slice(-4), customerId: input.customerId.slice(-4) },
      "🎉 Sending eligibility confirmation SMS"
    );

    try {
      const smsResult = await sendEligibilityConfirmationSMS(input.phoneNumber, input.customerId);

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
          customerId: input.customerId.slice(-4),
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
            target: "waitingForCustomer",
            guard: "isValidPhoneNumber",
            actions: [
              assign({
                customerPhone: ({ event }) =>
                  event.type === "INPUT" ? event.input.trim() : undefined,
              }),
              ({ context, event }: { context: CustomerActivationContext; event: CustomerActivationEvent }) => {
                // Fire-and-forget: Generate PIN and send activation SMS in background
                if (event.type === "INPUT" && context.customerId) {
                  const phoneNumber = event.input.trim();

                  // Execute PIN generation and SMS sending asynchronously
                  (async () => {
                    try {
                      logger.info(
                        {
                          customerId: context.customerId!.slice(-4),
                          phoneNumber: phoneNumber.slice(-4),
                        },
                        "🔐 Generating and sending activation PIN (fire-and-forget)"
                      );

                      // Generate temporary PIN
                      const tempPin = generatePin();

                      // Reset customer PIN with temporary PIN
                      await dataService.resetCustomerPin(
                        context.customerId!,
                        tempPin,
                        undefined // lgCustomerId not available in this context
                      );

                      logger.info(
                        { customerId: context.customerId!.slice(-4) },
                        "✅ Temporary PIN set successfully"
                      );

                      // Send activation SMS
                      const smsResult = await sendActivationSMS(
                        phoneNumber,
                        context.customerId!,
                        tempPin
                      );

                      if (!smsResult.success) {
                        throw new Error(
                          `SMS delivery failed: ${smsResult.error || "Unknown error"}`
                        );
                      }

                      logger.info(
                        {
                          customerId: context.customerId!.slice(-4),
                          phoneNumber: phoneNumber.slice(-4),
                          messageId: smsResult.messageId,
                        },
                        "✅ Activation SMS sent successfully (fire-and-forget)"
                      );
                    } catch (error) {
                      logger.error(
                        {
                          customerId: context.customerId!.slice(-4),
                          phoneNumber: phoneNumber.slice(-4),
                          error: error instanceof Error ? error.message : String(error),
                        },
                        "❌ Failed to send activation SMS (non-fatal, fire-and-forget)"
                      );

                      // Log to audit for monitoring (fire-and-forget)
                      dataService
                        .logAuditEvent({
                          eventType: "ACTIVATION_SMS_FAILED",
                          customerId: context.customerId!,
                          details: {
                            phoneNumber: phoneNumber.slice(-4),
                            error: error instanceof Error ? error.message : String(error),
                            timestamp: new Date().toISOString(),
                          },
                        })
                        .catch(auditError => {
                          logger.error(
                            {
                              error:
                                auditError instanceof Error
                                  ? auditError.message
                                  : String(auditError),
                            },
                            "Failed to log activation SMS failure to audit (non-fatal)"
                          );
                        });
                    }
                  })();
                }
              },
            ],
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

    // Not eligible - complete activation without claim
    recordingNotEligible: {
      entry: assign({
        message: "Thank you for your response.\n\n1. Continue",
        nextParentState: CustomerActivationOutput.COMPLETE,
      }),
      on: {
        INPUT: [
          {
            target: "complete",
            guard: "isInput1",
          },
          {
            target: "complete",
            guard: "isExit",
          },
        ],
      },
    },

    // Eligible - proceed to submit claim
    recordingEligible: {
      entry: assign({
        message: SUBMITTING_CLAIM_MSG,
      }),
      always: {
        target: "submittingClaim",
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
          customerId: context.customerId!,
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
