import { setup, assign, fromPromise } from "xstate";
import { withNavigation } from "../utils/navigation-mixin.js";
import { navigationGuards } from "../guards/navigation.guards.js";
import { NavigationPatterns } from "../utils/navigation-patterns.js";
import { sendSMS } from "../../../services/sms.js";
import { getKnowMoreSMS } from "../../../templates/sms/information.js";
import { createModuleLogger } from "../../../services/logger.js";

const logger = createModuleLogger("knowMoreMachine");

/**
 * Know More Machine - Information Request and Product Information
 *
 * Handles:
 * - Product information display
 * - Service information requests
 * - Educational content delivery
 * - Navigation back to main menu
 *
 * Entry Points: Automatic invocation (starts in infoMenu)
 * Exit Points: Outputs routing decision for main orchestrator
 */

export interface KnowMoreContext {
  sessionId: string;
  phoneNumber: string;
  serviceCode: string;
  message: string; // USSD message to display to user
  error?: string;
  selectedOption?: number; // Track which menu option the user selected (1-7)
}

export type KnowMoreEvent =
  | { type: "INPUT"; input: string } // User input from USSD
  | { type: "ERROR"; error: string };

import { messages } from "../../../constants/branding.js";

// SMS Service Actor
const sendInformationSMSService = fromPromise(
  async ({ input }: { input: { phoneNumber: string; option: number } }) => {
    logger.info(
      {
        phoneNumber: input.phoneNumber.slice(-4),
        option: input.option,
      },
      "📱 Sending information SMS"
    );

    try {
      const message = getKnowMoreSMS(input.option);
      logger.info(
        {
          phoneNumber: input.phoneNumber.slice(-4),
          option: input.option,
          messageLength: message.length,
        },
        "📝 Generated SMS message"
      );

      // Send SMS
      const result = await sendSMS({
        to: input.phoneNumber,
        message,
      });

      // Check if SMS was actually sent successfully
      if (!result.success) {
        logger.error(
          {
            phoneNumber: input.phoneNumber.slice(-4),
            option: input.option,
            error: result.error,
          },
          "❌ SMS delivery failed - throwing error to trigger onError handler"
        );
        throw new Error(
          `SMS delivery failed: ${result.error || "Unknown error"}`
        );
      }

      logger.info(
        {
          phoneNumber: input.phoneNumber.slice(-4),
          option: input.option,
          messageId: result.messageId,
        },
        "✅ Information SMS sent successfully"
      );

      return { messageId: result.messageId };
    } catch (error) {
      logger.error(
        {
          phoneNumber: input.phoneNumber.slice(-4),
          option: input.option,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "❌ Failed to send information SMS"
      );
      throw error;
    }
  }
);

const infoMenuMessage = `${messages.infoCenterTitle()}
1. Interested in a stove
2. Pellet Bag Prices & Accessories
3. Can we deliver it to you?
4. Can a stove be fixed?
5. What is Performance?
6. What is a digital voucher?
7. What is a contract?`;

const sendingMessage = "Sending information SMS...\n1. Continue";
const successMessage =
  "SMS sent successfully! Check your phone for details.\n1. Back to Main Menu";
const errorMessage = "Failed to send SMS. Please try again.\n0. Back\n*. Exit";

export const knowMoreMachine = setup({
  types: {
    context: {} as KnowMoreContext,
    events: {} as KnowMoreEvent,
    input: {} as {
      sessionId: string;
      phoneNumber: string;
      serviceCode: string;
    },
  },

  actors: {
    sendInformationSMSService,
  },

  actions: {
    setInfoMenuMessage: assign(() => ({
      message: infoMenuMessage,
    })),

    setSendingMessage: assign(() => ({
      message: sendingMessage,
    })),

    setSuccessMessage: assign(() => ({
      message: successMessage,
    })),

    setErrorMessage: assign(() => ({
      message: errorMessage,
      error: "SMS_SEND_FAILED",
    })),

    setError: assign({
      error: ({ event }) =>
        event.type === "ERROR" ? event.error : "An error occurred",
    }),

    clearErrors: assign({
      error: undefined,
    }),
  },

  guards: {
    // Input guards for USSD navigation
    isInput1: ({ event }) =>
      navigationGuards.isInput("1")(null as any, event as any),
    isInput2: ({ event }) =>
      navigationGuards.isInput("2")(null as any, event as any),
    isInput3: ({ event }) =>
      navigationGuards.isInput("3")(null as any, event as any),
    isInput4: ({ event }) =>
      navigationGuards.isInput("4")(null as any, event as any),
    isInput5: ({ event }) =>
      navigationGuards.isInput("5")(null as any, event as any),
    isInput6: ({ event }) =>
      navigationGuards.isInput("6")(null as any, event as any),
    isInput7: ({ event }) =>
      navigationGuards.isInput("7")(null as any, event as any),

    // Navigation guards
    isBack: ({ event }) =>
      navigationGuards.isBackCommand(null as any, event as any),
    isExit: ({ event }) =>
      navigationGuards.isExitCommand(null as any, event as any),
  },
}).createMachine({
  id: "knowMoreMachine",
  initial: "infoMenu",

  context: ({ input }): KnowMoreContext => ({
    sessionId: input?.sessionId || "",
    phoneNumber: input?.phoneNumber || "",
    serviceCode: input?.serviceCode || "",
    message: infoMenuMessage,
    error: undefined,
    selectedOption: undefined,
  }),

  states: {
    // Main information menu
    infoMenu: {
      entry: "setInfoMenuMessage",
      on: {
        INPUT: withNavigation(
          [
            {
              target: "sendingSMS",
              guard: "isInput1",
              actions: assign({ selectedOption: 1 }),
            },
            {
              target: "sendingSMS",
              guard: "isInput2",
              actions: assign({ selectedOption: 2 }),
            },
            {
              target: "sendingSMS",
              guard: "isInput3",
              actions: assign({ selectedOption: 3 }),
            },
            {
              target: "sendingSMS",
              guard: "isInput4",
              actions: assign({ selectedOption: 4 }),
            },
            {
              target: "sendingSMS",
              guard: "isInput5",
              actions: assign({ selectedOption: 5 }),
            },
            {
              target: "sendingSMS",
              guard: "isInput6",
              actions: assign({ selectedOption: 6 }),
            },
            {
              target: "sendingSMS",
              guard: "isInput7",
              actions: assign({ selectedOption: 7 }),
            },
          ],
          NavigationPatterns.informationChild
        ),
        ERROR: {
          target: "error",
          actions: "setError",
        },
      },
    },

    // Sending SMS state
    sendingSMS: {
      entry: "setSendingMessage",
      invoke: {
        id: "sendInformationSMS",
        src: "sendInformationSMSService",
        input: ({ context }) => ({
          phoneNumber: context.phoneNumber,
          option: context.selectedOption!,
        }),
        onDone: {
          target: "smsSent",
        },
        onError: {
          target: "smsError",
          actions: "setErrorMessage",
        },
      },
    },

    // SMS sent successfully
    smsSent: {
      entry: "setSuccessMessage",
      on: {
        INPUT: withNavigation(
          [
            {
              target: "routeToMain",
              guard: "isInput1",
            },
          ],
          {
            backTarget: "infoMenu",
            exitTarget: "routeToMain",
            enableBack: true,
            enableExit: true,
          }
        ),
      },
    },

    // SMS send error
    smsError: {
      on: {
        INPUT: withNavigation([], {
          backTarget: "infoMenu",
          exitTarget: "routeToMain",
          enableBack: true,
          enableExit: true,
        }),
      },
    },

    // Error state
    error: {
      entry: "setError",
      on: {
        INPUT: withNavigation([], {
          backTarget: "infoMenu",
          exitTarget: "routeToMain",
          enableBack: true,
          enableExit: true,
        }),
      },
    },

    // Route back to main menu
    routeToMain: {
      type: "final",
      action: "clearErrors",
    },
  },
});

export type KnowMoreMachine = typeof knowMoreMachine;
