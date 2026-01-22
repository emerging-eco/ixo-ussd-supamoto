import { setup, assign, fromPromise, sendTo } from "xstate";
import { withNavigation } from "../utils/navigation-mixin.js";
import { navigationGuards } from "../guards/navigation.guards.js";
import { dataService } from "../../../services/database-storage.js";
import {
  customerActivationMachine,
  CustomerActivationOutput,
} from "../activation/customerActivationMachine.js";
import { thousandDaySurveyMachine } from "../thousand-day-survey/thousandDaySurveyMachine.js";
import { customerToolsMachine } from "../customer-tools/customerToolsMachine.js";
import {
  agentToolsMachine,
  AgentToolsOutput,
} from "../agent-tools/agentToolsMachine.js";

/**
 * User Services Machine - Post-login user menu and simple stubs
 *
 * Entry: customerTools (for customers) or agent (for agents) - determined by customerRole
 * Exit: routeToMain (signals parent to return to main menu)
 * Events: INPUT, ERROR
 */

export interface UserServicesContext {
  sessionId: string;
  phoneNumber: string;
  serviceCode: string;
  pin?: string;
  customerId?: string; // Customer ID for child machines
  customerRole?: "customer" | "lead_generator" | "call_center" | "admin"; // Role-based access control
  message: string;
  error?: string;
}

export type UserServicesEvent =
  | { type: "INPUT"; input: string }
  | { type: "ERROR"; error: string };

export const userServicesMachine = setup({
  types: {
    context: {} as UserServicesContext,
    events: {} as UserServicesEvent,
    input: {} as {
      sessionId: string;
      phoneNumber: string;
      serviceCode: string;
      pin?: string;
      customerId?: string; // Customer ID for child machines
      customerRole?: "customer" | "lead_generator" | "call_center" | "admin"; // Role for access control
    },
  },
  actors: {
    fetchCustomerService: fromPromise(
      async ({ input }: { input: { phoneNumber: string } }) => {
        const record = await dataService.getCustomerByPhone(input.phoneNumber);
        return record;
      }
    ),
    fetchAccountDetailsService: fromPromise(
      async ({ input }: { input: { phoneNumber: string; pin?: string } }) => {
        const record = await dataService.getCustomerByPhone(input.phoneNumber);
        return { source: "db" as const, profile: record };
      }
    ),
    fetchContractDetailsService: fromPromise(async () => {
      return null;
    }),
    fetchOrdersService: fromPromise(async () => {
      return [] as any[];
    }),
    fetchVouchersService: fromPromise(async () => {
      return [] as any[];
    }),
    customerActivationMachine,
    thousandDaySurveyMachine,
    customerToolsMachine,
    agentToolsMachine,
  },
  actions: {
    setError: assign({
      error: ({ context, event }) =>
        // Preserve existing error if already set, otherwise use event error or default
        context.error ||
        (event.type === "ERROR" ? event.error : "An error occurred"),
      message: ({ context }) =>
        // Use existing error as message if set, otherwise use default
        context.error || "System error. Please try again.",
    }),
    clearErrors: assign(() => ({ error: undefined })),
  },
  guards: {
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
    isAgent: ({ context }) => {
      const role = context.customerRole;
      return (
        role === "lead_generator" || role === "call_center" || role === "admin"
      );
    },
    isCustomer: ({ context }) => {
      return context.customerRole === "customer";
    },
    hasCustomerId: ({ context }) => {
      return Boolean(context.customerId && context.customerId.trim() !== "");
    },
    isInput1WithCustomerId: ({ context, event }) => {
      const isInput1 = navigationGuards.isInput("1")(null as any, event as any);
      const hasId = Boolean(
        context.customerId && context.customerId.trim() !== ""
      );
      return isInput1 && hasId;
    },
    isInput1WithoutCustomerId: ({ context, event }) => {
      const isInput1 = navigationGuards.isInput("1")(null as any, event as any);
      const hasId = Boolean(
        context.customerId && context.customerId.trim() !== ""
      );
      return isInput1 && !hasId;
    },
    isBack: ({ event }) =>
      navigationGuards.isBackCommand(null as any, event as any),
    isExit: ({ event }) =>
      navigationGuards.isExitCommand(null as any, event as any),
  },
}).createMachine({
  id: "userServices",
  initial: "determineInitialState",
  context: ({ input }): UserServicesContext => ({
    sessionId: input?.sessionId || "",
    phoneNumber: input?.phoneNumber || "",
    serviceCode: input?.serviceCode || "",
    pin: input?.pin,
    customerId: input?.customerId,
    customerRole: input?.customerRole || "customer", // Default to customer role
    message: "", // Will be set by entry actions of initial state
    error: undefined,
  }),
  states: {
    // Determine initial state based on customerRole
    determineInitialState: {
      always: [
        {
          target: "agent",
          guard: "isAgent",
        },
        {
          target: "customerTools",
          guard: "isCustomer",
        },
      ],
    },

    // Customer Tools - delegates to customerToolsMachine
    customerTools: {
      on: {
        INPUT: {
          actions: sendTo("customerToolsChild", ({ event }) => event),
        },
      },
      invoke: {
        id: "customerToolsChild",
        src: "customerToolsMachine",
        input: ({ context }) => ({
          sessionId: context.sessionId,
          phoneNumber: context.phoneNumber,
          serviceCode: context.serviceCode,
          customerId: context.customerId || "",
          pin: context.pin || "",
        }),
        onDone: {
          target: "routeToMain",
        },
        onError: {
          target: "error",
          actions: assign({
            error: "Customer Tools error. Please try again.",
          }),
        },
        onSnapshot: {
          actions: assign(({ event }) => ({
            message: event.snapshot.context.message,
          })),
        },
      },
    },

    // Agent submenu (Lead Generator)
    agent: {
      entry: assign(() => ({
        message:
          "Agent Tools\n" +
          "1. Confirm Receival of Beans\n" +
          "2. Activate a Customer\n" +
          "3. 1,000 Day Survey\n" +
          "4. Register Intent to Deliver Beans\n" +
          "5. Submit Customer OTP\n" +
          "6. Confirm Bean Delivery\n" +
          "0. Back",
      })),
      on: {
        INPUT: withNavigation(
          [
            { target: "agentConfirmBeans", guard: "isInput1WithCustomerId" },
            { target: "missingCustomerId", guard: "isInput1WithoutCustomerId" },
            { target: "agentActivateCustomer", guard: "isInput2" },
            { target: "agentSurvey", guard: "isInput3" },
            { target: "agentRegisterIntent", guard: "isInput4" },
            { target: "agentSubmitOTP", guard: "isInput5" },
            { target: "agentConfirmDelivery", guard: "isInput6" },
          ],
          {
            backTarget: "routeToMain",
            exitTarget: "routeToMain",
            enableBack: true,
            enableExit: true,
          }
        ),
      },
    },

    // Error state when agent tries to confirm beans without a valid customerId
    missingCustomerId: {
      entry: assign(() => ({
        message:
          "Unable to access Customer Tools.\n" +
          "Your account is not linked to a customer ID.\n\n" +
          "1. Back",
      })),
      on: {
        INPUT: withNavigation([{ target: "agent", guard: "isInput1" }], {
          backTarget: "agent",
          exitTarget: "routeToMain",
          enableBack: true,
          enableExit: true,
        }),
      },
    },

    // Agent: Confirm Receival of Beans (invokes customerToolsMachine)
    // Note: onDone returns to "agent" menu intentionally - agents access this as a submenu
    // and should return to Agent Tools after completion (including when pressing "*" to exit
    // the submenu). This differs from the customer flow where exit goes to routeToMain.
    agentConfirmBeans: {
      on: {
        INPUT: {
          actions: sendTo("agentCustomerToolsChild", ({ event }) => event),
        },
      },
      invoke: {
        id: "agentCustomerToolsChild",
        src: "customerToolsMachine",
        input: ({ context }) => ({
          sessionId: context.sessionId,
          phoneNumber: context.phoneNumber,
          serviceCode: context.serviceCode,
          customerId: context.customerId || "",
          pin: context.pin || "",
        }),
        onDone: {
          // Returns to agent menu - this is intentional for submenu navigation
          target: "agent",
        },
        onError: {
          target: "error",
          actions: assign({
            error: "Customer Tools error. Please try again.",
          }),
        },
        onSnapshot: {
          actions: assign(({ event }) => ({
            message: event.snapshot.context.message,
          })),
        },
      },
    },

    agentActivateCustomer: {
      on: {
        INPUT: {
          actions: sendTo("activationChild", ({ event }) => event),
        },
      },
      invoke: {
        id: "activationChild",
        src: "customerActivationMachine",
        input: ({ context }) => ({
          sessionId: context.sessionId,
          phoneNumber: context.phoneNumber,
          serviceCode: context.serviceCode,
          isLeadGenerator: true,
        }),
        onDone: [
          {
            target: "agent",
            guard: ({ event }) =>
              (event.output as any)?.result ===
              CustomerActivationOutput.COMPLETE,
          },
          {
            target: "agent",
            guard: ({ event }) =>
              (event.output as any)?.result ===
              CustomerActivationOutput.CANCELLED,
          },
          {
            target: "agent",
          },
        ],
        onError: {
          target: "error",
          actions: "setError",
        },
        onSnapshot: {
          actions: assign(({ event }) => ({
            message: event.snapshot.context.message,
          })),
        },
      },
    },

    // Agent: Collect 1,000 Day Household Survey
    agentSurvey: {
      on: {
        INPUT: {
          actions: sendTo("surveyChild", ({ event }) => event),
        },
      },
      invoke: {
        id: "surveyChild",
        src: "thousandDaySurveyMachine",
        input: ({ context }) => ({
          sessionId: context.sessionId,
          phoneNumber: context.phoneNumber,
          serviceCode: context.serviceCode,
          lgCustomerId: context.customerId || "", // LG's customer ID
        }),
        onDone: {
          target: "agent",
        },
        onError: {
          target: "error",
          actions: "setError",
        },
        onSnapshot: {
          actions: assign(({ event }) => ({
            message: event.snapshot.context.message,
          })),
        },
      },
    },

    // Agent: Register Intent to Deliver Beans
    agentRegisterIntent: {
      on: {
        INPUT: {
          actions: sendTo(
            "agentToolsRegisterIntentChild",
            ({ event }) => event
          ),
        },
      },
      invoke: {
        id: "agentToolsRegisterIntentChild",
        src: "agentToolsMachine",
        input: ({ context }) => ({
          sessionId: context.sessionId,
          phoneNumber: context.phoneNumber,
          serviceCode: context.serviceCode,
          lgCustomerId: context.customerId || "",
          menuItem: "registerIntent" as const,
        }),
        onDone: [
          {
            target: "agent",
            guard: ({ event }) =>
              (event.output as any)?.result === AgentToolsOutput.SUCCESS,
          },
          {
            target: "agent",
            guard: ({ event }) =>
              (event.output as any)?.result === AgentToolsOutput.BACK,
          },
          {
            target: "agent",
          },
        ],
        onError: {
          target: "error",
          actions: "setError",
        },
        onSnapshot: {
          actions: assign(({ event }) => ({
            message: event.snapshot.context.message,
          })),
        },
      },
    },

    // Agent: Submit Customer OTP
    agentSubmitOTP: {
      on: {
        INPUT: {
          actions: sendTo("agentToolsSubmitOTPChild", ({ event }) => event),
        },
      },
      invoke: {
        id: "agentToolsSubmitOTPChild",
        src: "agentToolsMachine",
        input: ({ context }) => ({
          sessionId: context.sessionId,
          phoneNumber: context.phoneNumber,
          serviceCode: context.serviceCode,
          lgCustomerId: context.customerId || "",
          menuItem: "submitOTP" as const,
        }),
        onDone: [
          {
            target: "agent",
            guard: ({ event }) =>
              (event.output as any)?.result === AgentToolsOutput.SUCCESS,
          },
          {
            target: "agent",
            guard: ({ event }) =>
              (event.output as any)?.result === AgentToolsOutput.BACK,
          },
          {
            target: "agent",
          },
        ],
        onError: {
          target: "error",
          actions: "setError",
        },
        onSnapshot: {
          actions: assign(({ event }) => ({
            message: event.snapshot.context.message,
          })),
        },
      },
    },

    // Agent: Confirm Bean Delivery
    agentConfirmDelivery: {
      on: {
        INPUT: {
          actions: sendTo(
            "agentToolsConfirmDeliveryChild",
            ({ event }) => event
          ),
        },
      },
      invoke: {
        id: "agentToolsConfirmDeliveryChild",
        src: "agentToolsMachine",
        input: ({ context }) => ({
          sessionId: context.sessionId,
          phoneNumber: context.phoneNumber,
          serviceCode: context.serviceCode,
          lgCustomerId: context.customerId || "",
          menuItem: "confirmDelivery" as const,
        }),
        onDone: [
          {
            target: "agent",
            guard: ({ event }) =>
              (event.output as any)?.result === AgentToolsOutput.SUCCESS,
          },
          {
            target: "agent",
            guard: ({ event }) =>
              (event.output as any)?.result === AgentToolsOutput.BACK,
          },
          {
            target: "agent",
          },
        ],
        onError: {
          target: "error",
          actions: "setError",
        },
        onSnapshot: {
          actions: assign(({ event }) => ({
            message: event.snapshot.context.message,
          })),
        },
      },
    },

    // Error and exit
    error: {
      entry: "setError",
      on: {
        INPUT: withNavigation([], {
          backTarget: "routeToMain",
          exitTarget: "routeToMain",
          enableBack: true,
          enableExit: true,
        }),
      },
    },

    routeToMain: {
      type: "final",
      entry: "clearErrors",
    },
  },
});

export type UserServicesMachine = typeof userServicesMachine;
