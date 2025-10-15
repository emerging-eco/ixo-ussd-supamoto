import { assign, fromPromise, setup } from "xstate";
import { dataService } from "../../../services/database-storage.js";
import { encryptPin } from "../../../utils/encryption.js";
import { createModuleLogger } from "../../../services/logger.js";

const logger = createModuleLogger("pinChangeMachine");

export interface PinChangeContext {
  sessionId: string;
  phoneNumber: string;
  serviceCode: string;
  customerId: string;
  newPin?: string;
  confirmPin?: string;
  message: string;
  error?: string;
}

export type PinChangeEvent =
  | { type: "INPUT"; input: string }
  | { type: "ERROR"; error: string };

export enum PinChangeOutput {
  PIN_CHANGED = "PIN_CHANGED",
  ERROR = "ERROR",
}

/**
 * PIN Change Machine
 * Handles forced PIN change after first login with temp PIN
 */
export const pinChangeMachine = setup({
  types: {
    context: {} as PinChangeContext,
    events: {} as PinChangeEvent,
    input: {} as {
      sessionId: string;
      phoneNumber: string;
      serviceCode: string;
      customerId: string;
    },
  },
  guards: {
    isValidPin: ({ event }) => {
      if (event.type !== "INPUT") return false;
      const pin = event.input.trim();
      // Must be exactly 5 digits
      return /^\d{5}$/.test(pin);
    },
    pinsMatch: ({ context, event }) => {
      if (event.type !== "INPUT") return false;
      return context.newPin === event.input.trim();
    },
  },
  actors: {
    updatePinService: fromPromise(
      async ({ input }: { input: { customerId: string; newPin: string } }) => {
        logger.info(
          { customerId: input.customerId.slice(-4) },
          "Updating customer PIN"
        );

        const encryptedPin = encryptPin(input.newPin);

        const customer = await dataService.getCustomerByCustomerId(
          input.customerId
        );
        if (!customer) {
          throw new Error("Customer not found");
        }

        // Update PIN in database
        await dataService.updateCustomerPin(input.customerId, encryptedPin);

        logger.info(
          { customerId: input.customerId.slice(-4) },
          "PIN updated successfully"
        );

        return { success: true };
      }
    ),
  },
}).createMachine({
  id: "pinChange",
  initial: "enterNewPin",
  context: ({ input }): PinChangeContext => ({
    sessionId: input?.sessionId || "",
    phoneNumber: input?.phoneNumber || "",
    serviceCode: input?.serviceCode || "",
    customerId: input?.customerId || "",
    message: "For security, please create a new 5-digit PIN:",
    error: undefined,
  }),
  states: {
    enterNewPin: {
      entry: assign({
        message: "For security, please create a new 5-digit PIN:",
        error: undefined,
      }),
      on: {
        INPUT: [
          {
            target: "confirmNewPin",
            guard: "isValidPin",
            actions: assign({
              newPin: ({ event }) => event.input.trim(),
            }),
          },
          {
            target: "enterNewPin",
            actions: assign({
              message:
                "Invalid PIN format. Your PIN must be exactly 5 digits (numbers only).\n\nPlease create a new 5-digit PIN:",
              error: "INVALID_FORMAT",
            }),
          },
        ],
        ERROR: {
          target: "error",
          actions: assign({
            error: ({ event }) => event.error,
          }),
        },
      },
    },
    confirmNewPin: {
      entry: assign({
        message: "Please confirm your new PIN:",
        error: undefined,
      }),
      on: {
        INPUT: [
          {
            target: "updatingPin",
            guard: "pinsMatch",
            actions: assign({
              confirmPin: ({ event }) => event.input.trim(),
            }),
          },
          {
            target: "enterNewPin",
            actions: assign({
              message:
                "PINs do not match. Please try again.\n\nFor security, please create a new 5-digit PIN:",
              error: "PINS_MISMATCH",
              newPin: undefined,
              confirmPin: undefined,
            }),
          },
        ],
        ERROR: {
          target: "error",
          actions: assign({
            error: ({ event }) => event.error,
          }),
        },
      },
    },
    updatingPin: {
      invoke: {
        src: "updatePinService",
        input: ({ context }) => ({
          customerId: context.customerId,
          newPin: context.newPin!,
        }),
        onDone: {
          target: "success",
        },
        onError: {
          target: "error",
          actions: assign({
            error: "Failed to update PIN. Please try again.",
          }),
        },
      },
    },
    success: {
      type: "final",
      entry: assign({
        message: "PIN changed successfully!",
      }),
      output: ({ context }) => ({
        result: PinChangeOutput.PIN_CHANGED,
        customerId: context.customerId,
      }),
    },
    error: {
      type: "final",
      entry: assign(({ context }) => ({
        message: context.error || "An error occurred. Please try again.",
      })),
      output: ({ context }) => ({
        result: PinChangeOutput.ERROR,
        error: context.error,
      }),
    },
  },
});
