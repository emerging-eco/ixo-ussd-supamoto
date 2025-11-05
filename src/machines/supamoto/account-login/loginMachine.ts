/**
 * Login Machine - Handles customer authentication flow
 *
 * This machine implements the login flow where users:
 * 1. Enter their customer ID
 * 2. System verifies customer exists and has PIN
 * 3. User enters PIN (up to 3 attempts)
 * 4. System verifies PIN securely
 * 5. Returns appropriate result to parent machine
 *
 * Follows autonomous child machine patterns with two events: INPUT and ERROR
 */

import { assign, fromPromise, setup } from "xstate";
import { DbTypes } from "@ixo/supamoto-bot-sdk";
import { createModuleLogger } from "../../../services/logger.js";

type ICustomerDecrypted = DbTypes.ICustomerDecrypted;
import {
  dataService,
  type CustomerRecord,
} from "../../../services/database-storage.js";
import { encryptPin } from "../../../utils/encryption.js";
import { navigationGuards } from "../guards/navigation.guards.js";
import { withNavigation } from "../utils/navigation-mixin.js";
import { NavigationPatterns } from "../utils/navigation-patterns.js";
import { sendSMSWithRetry } from "../../../services/sms.js";
import { accountLockedSMS } from "../../../templates/sms/index.js";
import { getDecryptedCustomerData } from "../../../services/supamoto-db-client.js";

const logger = createModuleLogger("loginMachine");

// Types and Interfaces
export interface LoginContext {
  sessionId: string;
  phoneNumber: string;
  serviceCode: string;
  message: string;
  error?: string;
  customerId?: string;
  customer?: CustomerRecord;
  customerData?: ICustomerDecrypted; // Decrypted customer data from SDK
  sessionPin?: string; // ephemeral, used for Matrix vault decryption in-session
  pinAttempts: number;
  nextParentState: LoginOutput;
}

export interface LoginInput {
  sessionId: string;
  phoneNumber: string;
  serviceCode: string;
}

export type LoginEvent =
  | { type: "INPUT"; input: string }
  | { type: "ERROR"; error: string };

export enum LoginOutput {
  LOGIN_SUCCESS = "LOGIN_SUCCESS",
  CUSTOMER_FOUND = "CUSTOMER_FOUND",
  CUSTOMER_NOT_FOUND = "CUSTOMER_NOT_FOUND",
  ENCRYPTED_PIN_FIELD_EMPTY = "ENCRYPTED_PIN_FIELD_EMPTY",
  MAX_ATTEMPTS_EXCEEDED = "MAX_ATTEMPTS_EXCEEDED",
  UNDEFINED = "UNDEFINED",
}

// Messages
export const CUSTOMER_ID_PROMPT = `Enter your Customer ID to log in:`;
export const PIN_PROMPT = "Enter your PIN:";
export const INVALID_CUSTOMER_ID =
  "Invalid Customer ID format. Please try again.";
export const CUSTOMER_NOT_FOUND_MSG =
  "Customer ID not found. Please check and try again or contact support.";
export const PIN_FIELD_EMPTY_MSG =
  "Your account needs PIN setup. Please contact support.";
export const INCORRECT_PIN_MSG = (attempt: number) => {
  const attemptsLeft = 3 - attempt;
  return `${attempt} of 3 attempts - ${attemptsLeft} left - account will be locked upon 3 incorrect attempts`;
};
export const MAX_ATTEMPTS_MSG =
  "Your account was locked after 3 incorrect PIN attempts. Please contact your LG to activate your account.";
export const VERIFYING_MSG = "Verifying Customer ID...\n1. Continue";
export const VERIFYING_PIN_MSG = "Verifying PIN...\n1. Continue";
export const LOGIN_SUCCESS_MSG = (
  customerId: string,
  customerFullName: string
) =>
  `Welcome, ${customerFullName}!\nLogin successful for Customer ID: ${customerId}.\n1. Continue`;

/**
 * Validates customer ID format (C followed by 8+ digits)
 */
const isValidCustomerId = ({ event }: { event: LoginEvent }) => {
  if (event.type !== "INPUT") return false;
  const customerId = event.input.trim();
  // Basic validation: should start with 'C' and be followed by digits
  return /^C[A-Za-z0-9]{8,}$/.test(customerId);
};

/**
 * Validates PIN format (4-6 digits)
 */
const isValidPin = ({ event }: { event: LoginEvent }) => {
  if (event.type !== "INPUT") return false;
  const pin = event.input.trim();
  // PIN should be 4-6 digits
  return /^\d{4,6}$/.test(pin);
};

/**
 * Checks if maximum PIN attempts (3) have been exceeded
 */
const hasMaxAttemptsExceeded = ({ context }: { context: LoginContext }) => {
  return context.pinAttempts >= 3;
};

// Actors
/**
 * Service actor that looks up customer by customer ID
 * Handles three scenarios:
 * - Customer not found: throws CUSTOMER_NOT_FOUND
 * - Customer found but no PIN: throws ENCRYPTED_PIN_FIELD_EMPTY
 * - Customer found with PIN: returns customer record
 */
const customerLookupService = fromPromise(
  async ({ input }: { input: { customerId: string } }) => {
    logger.info(
      { customerId: input.customerId.slice(-4) },
      "Looking up customer"
    );

    const customer = await dataService.getCustomerByCustomerId(
      input.customerId
    );

    if (!customer) {
      throw new Error("CUSTOMER_NOT_FOUND");
    }

    if (!customer.encryptedPin) {
      throw new Error("ENCRYPTED_PIN_FIELD_EMPTY");
    }

    return customer;
  }
);

/**
 * Service actor that verifies PIN securely
 * Handles attempt tracking and PIN clearing on max attempts
 * - Correct PIN: returns success
 * - Incorrect PIN (< 3 attempts): throws INCORRECT_PIN
 * - Incorrect PIN (3rd attempt): clears PIN and throws MAX_ATTEMPTS_EXCEEDED
 */
const pinVerificationService = fromPromise(
  async ({
    input,
  }: {
    input: {
      pin: string;
      customer: CustomerRecord;
      attempts: number;
      customerId: string;
      phoneNumber: string;
    };
  }) => {
    logger.info(
      {
        customerId: input.customerId.slice(-4),
        attempts: input.attempts,
      },
      "Verifying PIN"
    );

    // Verify PIN by encrypting the input PIN and comparing with stored encrypted PIN
    let isValid = false;
    try {
      const encryptedPin = encryptPin(input.pin);
      isValid = encryptedPin === input.customer.encryptedPin!;
      logger.info(
        {
          customerId: input.customerId.slice(-4),
          pinMatch: isValid,
        },
        "PIN verification completed"
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          customerId: input.customerId.slice(-4),
        },
        "PIN encryption failed"
      );
      isValid = false;
    }

    if (!isValid) {
      // If this is the 3rd attempt, clear the PIN, send SMS, and create audit log
      if (input.attempts >= 3) {
        logger.warn(
          { customerId: input.customerId.slice(-4) },
          "Max PIN attempts exceeded, clearing PIN"
        );

        // Clear the PIN (set to NULL)
        await dataService.clearCustomerPin(input.customerId);

        // Create audit log entry
        await dataService.createAuditLog({
          eventType: "ACCOUNT_LOCKED",
          customerId: input.customerId,
          details: {
            reason: "FAILED_PIN_ATTEMPTS",
            attempts: 3,
            timestamp: new Date().toISOString(),
          },
        });

        // Send SMS notification with retry logic
        try {
          await sendSMSWithRetry(
            {
              to: input.phoneNumber,
              message: accountLockedSMS(input.customerId),
            },
            {
              eventType: "ACCOUNT_LOCKED",
              customerId: input.customerId,
            }
          );
        } catch (smsError) {
          logger.error(
            {
              error:
                smsError instanceof Error ? smsError.message : String(smsError),
              customerId: input.customerId.slice(-4),
            },
            "Failed to send account locked SMS"
          );
          // Don't throw - we still want to lock the account even if SMS fails
        }

        throw new Error("MAX_ATTEMPTS_EXCEEDED");
      }
      throw new Error("INCORRECT_PIN");
    }

    return { success: true };
  }
);

/**
 * Service actor that loads decrypted customer data from SDK
 * This is called after successful PIN verification to fetch full customer details
 */
const loadCustomerDataService = fromPromise(
  async ({ input }: { input: { customerId: string } }) => {
    logger.info(
      { customerId: input.customerId.slice(-4) },
      "Loading decrypted customer data from SDK"
    );

    try {
      const customerData = await getDecryptedCustomerData(input.customerId);

      if (!customerData) {
        logger.warn(
          { customerId: input.customerId.slice(-4) },
          "Customer data not found in SDK"
        );
        return null;
      }

      logger.info(
        {
          customerId: customerData.customer_id,
          hasFullName: !!customerData.full_name,
          hasEmail: !!customerData.email,
        },
        "Customer data loaded successfully from SDK"
      );

      return customerData;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          customerId: input.customerId.slice(-4),
        },
        "Failed to load customer data from SDK"
      );
      // Don't throw - we can still proceed with login even if SDK data fails
      return null;
    }
  }
);

const isCustomerFound = ({ context }: { context: LoginContext }) => {
  return LoginOutput.CUSTOMER_FOUND === context.nextParentState;
};

const isCustomerNotFound = ({ context }: { context: LoginContext }) => {
  return LoginOutput.CUSTOMER_NOT_FOUND === context.nextParentState;
};

const isEncryptedPinEmpty = ({ context }: { context: LoginContext }) => {
  return LoginOutput.ENCRYPTED_PIN_FIELD_EMPTY === context.nextParentState;
};

const isLoginSuccess = ({ context }: { context: LoginContext }) => {
  return LoginOutput.LOGIN_SUCCESS === context.nextParentState;
};

// Machine type
export type LoginMachine = typeof loginMachine;

export const loginMachine = setup({
  types: {
    context: {} as LoginContext,
    events: {} as LoginEvent,
    input: {} as LoginInput,
  },
  guards: {
    isValidCustomerId,
    isValidPin,
    hasMaxAttemptsExceeded,
    isCustomerFound,
    isCustomerNotFound,
    isEncryptedPinEmpty,
    isLoginSuccess,
    isInput1: ({ event }) =>
      navigationGuards.isInput("1")(null as any, event as any),
    isBack: ({ event }) =>
      navigationGuards.isBackCommand(null as any, event as any),
    isExit: ({ event }) =>
      navigationGuards.isExitCommand(null as any, event as any),
  },
  actions: {
    clearErrors: assign(() => ({ error: undefined })),
  },
  actors: {
    customerLookupService,
    pinVerificationService,
    loadCustomerDataService,
  },
}).createMachine({
  id: "login",
  initial: "customerIdEntry",
  context: ({ input }): LoginContext => ({
    sessionId: input?.sessionId || "",
    phoneNumber: input?.phoneNumber || "",
    serviceCode: input?.serviceCode || "",
    message: CUSTOMER_ID_PROMPT,
    error: undefined,
    customerId: undefined,
    customer: undefined,
    pinAttempts: 0,
    nextParentState: LoginOutput.UNDEFINED,
  }),
  output: ({ context }) => ({
    result: context.nextParentState,
    customerId: context.customerId,
    customer: context.customer,
    customerData: context.customerData,
    sessionPin: context.sessionPin,
    message: context.message,
  }),
  states: {
    customerIdEntry: {
      entry: assign({ message: CUSTOMER_ID_PROMPT }),
      on: {
        INPUT: withNavigation(
          [
            {
              target: "verifyingCustomerId",
              guard: "isValidCustomerId",
              actions: [
                assign(({ event }) => {
                  if (event.type !== "INPUT") return {};
                  return { customerId: event.input.trim() };
                }),
              ],
            },
            {
              actions: assign({ message: INVALID_CUSTOMER_ID }),
            },
          ],
          NavigationPatterns.loginChild
        ),
        ERROR: {
          target: "error",
          actions: [
            assign(({ event }) => ({
              error: event.error || "An error occurred",
              message: "System error. Please try again.",
            })),
          ],
        },
      },
    },

    verifyingCustomerId: {
      entry: assign({ message: VERIFYING_MSG }),
      invoke: {
        src: "customerLookupService",
        input: ({ context }) => ({ customerId: context.customerId! }),
        onDone: {
          // No target state is set in this step. The next state is determined by the guards in the on: block
          actions: [
            assign(({ event }) => ({ customer: event.output })),
            assign({
              nextParentState: LoginOutput.CUSTOMER_FOUND,
            }),
          ],
        },
        onError: [
          {
            target: "routeToMain",
            guard: ({ event }) =>
              (event.error as Error)?.message === "CUSTOMER_NOT_FOUND",
            actions: [
              assign({
                nextParentState: LoginOutput.CUSTOMER_NOT_FOUND,
                message: CUSTOMER_NOT_FOUND_MSG,
              }),
            ],
          },
          {
            target: "routeToMain",
            guard: ({ event }) =>
              (event.error as Error)?.message === "ENCRYPTED_PIN_FIELD_EMPTY",
            actions: [
              assign({
                nextParentState: LoginOutput.ENCRYPTED_PIN_FIELD_EMPTY,
                message: PIN_FIELD_EMPTY_MSG,
              }),
            ],
          },
          {
            target: "error",
            actions: [
              assign(({ event }) => ({
                error: (event.error as Error)?.message || "An error occurred",
                message: "System error. Please try again.",
              })),
            ],
          },
        ],
      },
      on: {
        INPUT: withNavigation(
          [
            {
              target: "pinEntry",
              guard: "isCustomerFound",
            },
            {
              target: "routeToMain",
              guard: "isCustomerNotFound",
            },
            {
              target: "routeToMain",
              guard: "isEncryptedPinEmpty",
            },
            {
              target: "verifyingCustomerId",
            },
          ],
          NavigationPatterns.loginChild
        ),
      },
    },

    pinEntry: {
      entry: assign(({ context }) => {
        // If the message already contains the warning (from onError handler), preserve it
        if (context.message && context.message.includes("of 3 attempts")) {
          return {};
        }
        // If there are previous failed attempts, show the warning message
        if (context.pinAttempts > 0) {
          return {
            message: `${INCORRECT_PIN_MSG(context.pinAttempts)}\n\n${PIN_PROMPT}`,
          };
        }
        return { message: PIN_PROMPT };
      }),
      on: {
        INPUT: withNavigation(
          [
            {
              target: "verifyingPin",
              guard: "isValidPin",
              actions: assign(({ event }) => ({
                sessionPin: event.type === "INPUT" ? event.input.trim() : "",
              })),
            },
            {
              actions: assign(({ context }) => ({
                message: `${INCORRECT_PIN_MSG(context.pinAttempts)}\n\n${PIN_PROMPT}`,
              })),
            },
          ],
          NavigationPatterns.loginChild
        ),
        ERROR: {
          target: "error",
          actions: [
            assign(({ event }) => ({
              error: event.error || "An error occurred",
              message: "System error. Please try again.",
            })),
          ],
        },
      },
    },

    verifyingPin: {
      entry: assign({ message: VERIFYING_PIN_MSG }),
      invoke: {
        src: "pinVerificationService",
        input: ({
          context,
          event,
        }: {
          context: LoginContext;
          event: LoginEvent;
        }) => ({
          pin: event.type === "INPUT" ? event.input.trim() : "",
          customer: context.customer!,
          attempts: context.pinAttempts + 1,
          customerId: context.customerId!,
          phoneNumber: context.phoneNumber,
        }),
        onDone: {
          target: "loadingCustomerData",
        },
        onError: [
          {
            guard: ({ event }) =>
              (event.error as Error)?.message === "MAX_ATTEMPTS_EXCEEDED",
            actions: [
              assign(({ context }) => {
                logger.info(
                  { customerId: context.customerId?.slice(-4) },
                  "Setting MAX_ATTEMPTS_MSG in context"
                );
                return {
                  nextParentState: LoginOutput.MAX_ATTEMPTS_EXCEEDED,
                  message: MAX_ATTEMPTS_MSG,
                };
              }),
            ],
          },
          {
            target: "pinEntry",
            guard: ({ event }) =>
              (event.error as Error)?.message === "INCORRECT_PIN",
            actions: [
              assign(({ context }) => {
                const newAttempts = context.pinAttempts + 1;
                return {
                  pinAttempts: newAttempts,
                  message: `${INCORRECT_PIN_MSG(newAttempts)}\n\n${PIN_PROMPT}`,
                };
              }),
            ],
          },
          {
            target: "error",
            actions: [
              assign(({ event }) => ({
                error: (event.error as Error)?.message || "An error occurred",
                message: "System error. Please try again.",
              })),
            ],
          },
        ],
      },
      on: {
        INPUT: withNavigation(
          [
            {
              target: "loginSuccess",
              guard: "isLoginSuccess",
            },
            {
              target: "routeToMain",
            },
          ],
          NavigationPatterns.loginChild
        ),
      },
    },

    loadingCustomerData: {
      entry: assign({ message: "Loading customer data...\n1. Continue" }),
      invoke: {
        src: "loadCustomerDataService",
        input: ({ context }) => ({ customerId: context.customerId! }),
        onDone: {
          actions: [
            assign(({ event }) => ({
              customerData: event.output || undefined,
              nextParentState: LoginOutput.LOGIN_SUCCESS,
            })),
          ],
        },
        onError: {
          // Even if loading customer data fails, we can still proceed with login
          actions: [
            assign({
              customerData: undefined,
              nextParentState: LoginOutput.LOGIN_SUCCESS,
            }),
          ],
        },
      },
      on: {
        INPUT: withNavigation(
          [
            {
              target: "loginSuccess",
              guard: "isLoginSuccess",
            },
            {
              target: "routeToMain",
            },
          ],
          NavigationPatterns.loginChild
        ),
      },
    },

    loginSuccess: {
      entry: assign(({ context }) => {
        const customerId = context.customerId!;
        const customerFullName = context.customer!.fullName;
        return {
          nextParentState: LoginOutput.LOGIN_SUCCESS,
          message: LOGIN_SUCCESS_MSG(customerId, customerFullName),
        };
      }),
      on: {
        INPUT: withNavigation(
          [
            {
              target: "routeToMain",
              guard: "isLoginSuccess",
            },
            {
              target: "routeToMain",
            },
          ],
          NavigationPatterns.loginChild
        ),
        ERROR: {
          target: "error",
          actions: [
            assign(({ event }) => ({
              error: event.error || "An error occurred",
              message: "System error. Please try again.",
            })),
          ],
        },
      },
    },

    routeToMain: {
      type: "final",
    },

    error: {
      on: {
        INPUT: withNavigation(
          [{ target: "customerIdEntry" }],
          NavigationPatterns.loginChild
        ),
        ERROR: {
          actions: [
            assign(({ event }) => ({
              error: event.error || "An error occurred",
              message: "System error. Please try again.",
            })),
          ],
        },
      },
    },
  },
});
