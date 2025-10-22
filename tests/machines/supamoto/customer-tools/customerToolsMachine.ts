import { setup, assign, fromPromise } from "xstate";
import { withNavigation } from "../utils/navigation-mixin.js";
import { navigationGuards } from "../guards/navigation.guards.js";
import { dataService } from "../../../../src/services/database-storage.js";
import { createModuleLogger } from "../../../../src/services/logger.js";

const logger = createModuleLogger("customerToolsMachine");

/**
 * Customer Tools Machine
 * Handles customer-specific operations:
 * 1. Confirm Receival of Beans
 *
 * NOTE: 1,000 Day Household claim submission has been moved to Agent Tools
 * and is now submitted by Lead Generators, not customers.
 */

export interface CustomerToolsContext {
  sessionId: string;
  phoneNumber: string;
  serviceCode: string;
  customerId: string;
  message: string;
  error?: string;
}

export type CustomerToolsEvent =
  | { type: "INPUT"; input: string }
  | { type: "ERROR"; error: string };

const MENU_MESSAGE = "Customer Tools\n1. Confirm Receival of Beans\n0. Back";

const RECEIPT_QUESTION =
  "Did you receive a bag of beans from your Lead Generator?\n1. Yes\n2. No\n0. Back";

export const customerToolsMachine = setup({
  types: {
    context: {} as CustomerToolsContext,
    events: {} as CustomerToolsEvent,
    input: {} as {
      sessionId: string;
      phoneNumber: string;
      serviceCode: string;
      customerId: string;
    },
  },
  guards: {
    isInput1: ({ event }) =>
      navigationGuards.isInput("1")(null as any, event as any),
    isInput2: ({ event }) =>
      navigationGuards.isInput("2")(null as any, event as any),
    isYes: ({ event }) =>
      navigationGuards.isInput("1")(null as any, event as any),
    isNo: ({ event }) =>
      navigationGuards.isInput("2")(null as any, event as any),
    isBack: ({ event }) =>
      navigationGuards.isBackCommand(null as any, event as any),
    isExit: ({ event }) =>
      navigationGuards.isExitCommand(null as any, event as any),
  },
  actors: {
    submitReceiptConfirmationService: fromPromise(
      async ({
        input,
      }: {
        input: {
          customerId: string;
          lgCustomerId: string;
          receivedBeans: boolean;
        };
      }) => {
        logger.info(
          {
            customerId: input.customerId.slice(-4),
            receivedBeans: input.receivedBeans,
          },
          "Submitting receipt confirmation"
        );

        // Get or create delivery confirmation
        let confirmation = await dataService.getDeliveryConfirmation(
          input.customerId,
          input.lgCustomerId
        );

        if (confirmation) {
          // Update existing confirmation
          await dataService.updateDeliveryConfirmation(confirmation.id, {
            customerConfirmedAt: new Date(),
            customerConfirmedReceipt: input.receivedBeans,
          });
        }

        // If customer denied receipt, create audit log
        if (!input.receivedBeans) {
          await dataService.createAuditLog({
            eventType: "BEAN_RECEIPT_DENIED",
            customerId: input.customerId,
            lgCustomerId: input.lgCustomerId,
            details: {
              deniedAt: new Date().toISOString(),
              confirmationId: confirmation?.id,
            },
          });
        }

        // TODO: Check if both confirmations received and within deadline
        // If yes, transfer token and send SMS to LG
        // This would be implemented when token transfer integration is ready

        logger.info(
          { customerId: input.customerId.slice(-4) },
          "Receipt confirmation submitted successfully"
        );

        return { success: true, receivedBeans: input.receivedBeans };
      }
    ),
  },
}).createMachine({
  id: "customerTools",
  initial: "menu",
  context: ({ input }): CustomerToolsContext => ({
    sessionId: input?.sessionId || "",
    phoneNumber: input?.phoneNumber || "",
    serviceCode: input?.serviceCode || "",
    customerId: input?.customerId || "",
    message: MENU_MESSAGE,
    error: undefined,
  }),
  states: {
    menu: {
      entry: assign(() => ({
        message: MENU_MESSAGE,
        error: undefined,
      })),
      on: {
        INPUT: withNavigation(
          [{ target: "confirmReceiptQuestion", guard: "isInput1" }],
          {
            backTarget: "routeToMain",
            exitTarget: "routeToMain",
            enableBack: true,
            enableExit: true,
          }
        ),
        ERROR: {
          target: "error",
          actions: assign({
            error: ({ event }) => event.error || "An error occurred",
          }),
        },
      },
    },

    confirmReceiptQuestion: {
      entry: assign(() => ({
        message: RECEIPT_QUESTION,
      })),
      on: {
        INPUT: withNavigation(
          [
            {
              target: "submittingReceipt",
              guard: "isYes",
            },
            {
              target: "submittingReceipt",
              guard: "isNo",
            },
          ],
          {
            backTarget: "menu",
            exitTarget: "routeToMain",
            enableBack: true,
            enableExit: true,
          }
        ),
      },
    },

    submittingReceipt: {
      entry: assign(() => ({
        message: "Submitting your confirmation...",
      })),
      invoke: {
        src: "submitReceiptConfirmationService",
        input: ({ context, event }) => ({
          customerId: context.customerId,
          lgCustomerId: "UNKNOWN", // TODO: Get from delivery confirmation lookup
          receivedBeans: event.type === "INPUT" && event.input.trim() === "1",
        }),
        onDone: {
          target: "receiptSubmitted",
        },
        onError: {
          target: "error",
          actions: assign({
            error: "Failed to submit confirmation. Please try again.",
          }),
        },
      },
    },

    receiptSubmitted: {
      entry: assign(() => ({
        message: "Thank you for your confirmation.\n\n1. Continue",
      })),
      on: {
        INPUT: withNavigation([{ target: "menu", guard: "isInput1" }], {
          backTarget: "menu",
          exitTarget: "routeToMain",
          enableBack: false,
          enableExit: true,
        }),
      },
    },

    routeToMain: {
      type: "final",
    },

    error: {
      entry: assign(({ context }) => ({
        message:
          context.error || "An error occurred. Please try again.\n\n1. Back",
      })),
      on: {
        INPUT: withNavigation([{ target: "menu", guard: "isInput1" }], {
          backTarget: "menu",
          exitTarget: "routeToMain",
          enableBack: true,
          enableExit: true,
        }),
      },
    },
  },
});
