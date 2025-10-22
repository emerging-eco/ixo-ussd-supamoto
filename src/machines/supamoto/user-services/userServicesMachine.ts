import { setup, assign, fromPromise, sendTo } from "xstate";
import { withNavigation } from "../utils/navigation-mixin.js";
import { navigationGuards } from "../guards/navigation.guards.js";
import { dataService } from "../../../services/database-storage.js";
import { surveyResponseStorageService } from "../../../services/survey-response-storage.js";
import { createModuleLogger } from "../../../services/logger.js";
import { config } from "../../../config.js";

const logger = createModuleLogger("userServicesMachine");
import {
  loginWithVault,
  findUserRoom,
  getProfileAccountFromRoom,
  getContractDetailsFromRoom,
  getOrdersFromRoom,
  getVouchersFromRoom,
} from "../../../services/ixo/matrix-reader.js";
import {
  customerActivationMachine,
  CustomerActivationOutput,
} from "../activation/customerActivationMachine.js";
import { householdSurveyMachine } from "../activation/householdSurveyMachine.js";
import { customerToolsMachine } from "../customer-tools/customerToolsMachine.js";

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
  customerIdInput?: string; // Customer ID entered by LG for claim submission
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
        if (config.FEATURES.MATRIX_READ_ENABLED && input.pin) {
          try {
            const login = await loginWithVault({
              phoneNumber: input.phoneNumber,
              pin: input.pin,
            });
            const room = await findUserRoom({
              mxClient: login.mxClient,
              userAddress: undefined,
              did: undefined,
            });
            if (room.roomId) {
              const profile = await getProfileAccountFromRoom({
                mxClient: login.mxClient,
                roomId: room.roomId,
              });
              if (profile) {
                return { source: "matrix" as const, profile };
              }
            }
          } catch {
            // Silently fail if Matrix read is not available
          }
        }
        const record = await dataService.getCustomerByPhone(input.phoneNumber);
        return { source: "db" as const, profile: record };
      }
    ),
    fetchContractDetailsService: fromPromise(
      async ({ input }: { input: { phoneNumber: string; pin?: string } }) => {
        if (config.FEATURES.MATRIX_READ_ENABLED && input.pin) {
          try {
            const login = await loginWithVault({
              phoneNumber: input.phoneNumber,
              pin: input.pin,
            });
            const room = await findUserRoom({
              mxClient: login.mxClient,
              userAddress: login.address,
              did: login.did,
            });
            if (room.roomId) {
              return await getContractDetailsFromRoom({
                mxClient: login.mxClient,
                roomId: room.roomId,
              });
            }
          } catch {
            // Silently fail if Matrix read is not available
          }
        }
        return null;
      }
    ),
    fetchOrdersService: fromPromise(
      async ({ input }: { input: { phoneNumber: string; pin?: string } }) => {
        if (config.FEATURES.MATRIX_READ_ENABLED && input.pin) {
          try {
            const login = await loginWithVault({
              phoneNumber: input.phoneNumber,
              pin: input.pin,
            });
            const room = await findUserRoom({
              mxClient: login.mxClient,
              userAddress: login.address,
              did: login.did,
            });
            if (room.roomId) {
              return await getOrdersFromRoom({
                mxClient: login.mxClient,
                roomId: room.roomId,
              });
            }
          } catch {
            // Silently fail if Matrix read is not available
          }
        }
        return [] as any[];
      }
    ),
    fetchVouchersService: fromPromise(
      async ({ input }: { input: { phoneNumber: string; pin?: string } }) => {
        if (config.FEATURES.MATRIX_READ_ENABLED && input.pin) {
          try {
            const login = await loginWithVault({
              phoneNumber: input.phoneNumber,
              pin: input.pin,
            });
            const room = await findUserRoom({
              mxClient: login.mxClient,
              userAddress: login.address,
              did: login.did,
            });
            if (room.roomId) {
              return await getVouchersFromRoom({
                mxClient: login.mxClient,
                roomId: room.roomId,
              });
            }
          } catch {
            // Silently fail if Matrix read is not available
          }
        }
        return [] as any[];
      }
    ),
    checkSurveyCompletionService: fromPromise(
      async ({
        input,
      }: {
        input: { lgCustomerId: string; customerId: string };
      }) => {
        logger.info(
          {
            lgCustomerId: input.lgCustomerId.slice(-4),
            customerId: input.customerId.slice(-4),
          },
          "Checking survey completion for claim submission"
        );

        const surveyState =
          await surveyResponseStorageService.getSurveyResponseState(
            input.lgCustomerId,
            input.customerId
          );

        const isComplete = surveyState?.allFieldsCompleted ?? false;

        logger.info(
          {
            lgCustomerId: input.lgCustomerId.slice(-4),
            customerId: input.customerId.slice(-4),
            isComplete,
          },
          "Survey completion status checked"
        );

        return { isComplete };
      }
    ),
    submitHouseholdClaimService: fromPromise(
      async ({
        input,
      }: {
        input: {
          lgCustomerId: string;
          customerId: string;
          is1000DayHousehold: boolean;
        };
      }) => {
        logger.info(
          {
            lgCustomerId: input.lgCustomerId.slice(-4),
            customerId: input.customerId.slice(-4),
            is1000DayHousehold: input.is1000DayHousehold,
          },
          "Submitting household claim (LG submission)"
        );

        // Create household claim record with LG tracking
        const claim = await dataService.createHouseholdClaim(
          input.lgCustomerId,
          input.customerId,
          input.is1000DayHousehold
        );

        // TODO: Send to claims bot (async, non-blocking)
        // This would be implemented when the claims bot integration is ready
        // For now, we just create the record with status='PENDING'

        logger.info(
          {
            lgCustomerId: input.lgCustomerId.slice(-4),
            customerId: input.customerId.slice(-4),
            claimId: claim.id,
          },
          "Household claim submitted successfully by LG"
        );

        return { success: true, claimId: claim.id };
      }
    ),
    customerActivationMachine,
    householdSurveyMachine,
    customerToolsMachine,
  },
  /*
    fetchContractDetailsService: fromPromise(async ({ input }: { input: { phoneNumber: string; pin?: string } }) => {
      if (config.FEATURES.MATRIX_READ_ENABLED && input.pin) {
        try {
          const login = await loginWithVault({ phoneNumber: input.phoneNumber, pin: input.pin });
          const room = await findUserRoom({ mxClient: login.mxClient, userAddress: login.address, did: login.did });
          if (room.roomId) {
            return await getContractDetailsFromRoom({ mxClient: login.mxClient, roomId: room.roomId });
          }
        } catch {}
      }
      return null;
    }),
    fetchOrdersService: fromPromise(async ({ input }: { input: { phoneNumber: string; pin?: string } }) => {
      if (config.FEATURES.MATRIX_READ_ENABLED && input.pin) {
        try {
          const login = await loginWithVault({ phoneNumber: input.phoneNumber, pin: input.pin });
          const room = await findUserRoom({ mxClient: login.mxClient, userAddress: login.address, did: login.did });
          if (room.roomId) {
            return await getOrdersFromRoom({ mxClient: login.mxClient, roomId: room.roomId });
          }
        } catch {}
      }
      return [] as any[];
    }),
    fetchVouchersService: fromPromise(async ({ input }: { input: { phoneNumber: string; pin?: string } }) => {
      if (config.FEATURES.MATRIX_READ_ENABLED && input.pin) {
        try {
          const login = await loginWithVault({ phoneNumber: input.phoneNumber, pin: input.pin });
          const room = await findUserRoom({ mxClient: login.mxClient, userAddress: login.address, did: login.did });
          if (room.roomId) {
            return await getVouchersFromRoom({ mxClient: login.mxClient, roomId: room.roomId });
          }
        } catch {}
      }
      return [] as any[];
    }),
*/
  actions: {
    setError: assign({
      error: ({ event }) =>
        event.type === "ERROR" ? event.error : "An error occurred",
      message: "System error. Please try again.",
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
    customerIdInput: undefined,
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
          "1. Activate a Customer\n" +
          "2. 1,000 Day Survey\n" +
          "3. Submit 1,000 Day Household Claim\n" +
          "4. Register Intent to Deliver Beans\n" +
          "5. Submit Customer OTP\n" +
          "6. Confirm Bean Delivery\n" +
          "0. Back",
      })),
      on: {
        INPUT: withNavigation(
          [
            { target: "agentActivateCustomer", guard: "isInput1" },
            { target: "agentSurvey", guard: "isInput2" },
            { target: "agentSubmitHouseholdClaim", guard: "isInput3" },
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
        src: "householdSurveyMachine",
        input: ({ context }) => ({
          sessionId: context.sessionId,
          phoneNumber: context.phoneNumber,
          serviceCode: context.serviceCode,
          lgCustomerId: context.customerId || "", // LG's customer ID
          customerId: "", // Will be entered by LG during survey
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

    // Agent: Submit 1,000 Day Household Claim
    agentSubmitHouseholdClaim: {
      entry: assign(() => ({
        message:
          "Enter the customer ID for whom you want to submit the 1,000 Day Household claim:\n\n0. Back",
      })),
      on: {
        INPUT: [
          {
            target: "agentCheckSurveyCompletion",
            guard: ({ event }) => event.type === "INPUT" && event.input !== "0",
            actions: assign({
              customerIdInput: ({ event }) =>
                event.type === "INPUT" ? event.input : "",
            }),
          },
          {
            target: "agent",
            guard: ({ event }) => event.type === "INPUT" && event.input === "0",
          },
        ],
      },
    },

    // Agent: Check Survey Completion
    agentCheckSurveyCompletion: {
      entry: assign(() => ({
        message: "Checking survey completion status...",
      })),
      invoke: {
        id: "checkSurveyCompletion",
        src: "checkSurveyCompletionService",
        input: ({ context }) => ({
          lgCustomerId: context.customerId || "",
          customerId: (context as any).customerIdInput || "",
        }),
        onDone: [
          {
            target: "agentConfirmClaimSubmission",
            guard: ({ event }) => event.output.isComplete,
            actions: assign({
              message:
                "Survey is complete. Proceed with claim submission?\n1. Yes\n2. No\n0. Back",
            }),
          },
          {
            target: "agentSurveyIncomplete",
            guard: ({ event }) => !event.output.isComplete,
          },
        ],
        onError: {
          target: "agentSurveyCheckError",
          actions: assign({
            error: ({ event }) =>
              event.error instanceof Error
                ? event.error.message
                : "Failed to check survey status",
          }),
        },
      },
    },

    // Agent: Survey Incomplete
    agentSurveyIncomplete: {
      entry: assign(() => ({
        message:
          "The household survey for this customer is not complete. Please complete the survey first before submitting the claim.\n\n1. Back",
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

    // Agent: Survey Check Error
    agentSurveyCheckError: {
      entry: assign(() => ({
        message: "Error checking survey status. Please try again.\n\n1. Back",
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

    // Agent: Confirm Claim Submission
    agentConfirmClaimSubmission: {
      on: {
        INPUT: [
          {
            target: "agentSubmittingClaim",
            guard: ({ event }) => event.type === "INPUT" && event.input === "1",
          },
          {
            target: "agent",
            guard: ({ event }) => event.type === "INPUT" && event.input === "2",
          },
          {
            target: "agent",
            guard: ({ event }) => event.type === "INPUT" && event.input === "0",
          },
        ],
      },
    },

    // Agent: Submitting Claim
    agentSubmittingClaim: {
      entry: assign(() => ({
        message: "Submitting household claim...",
      })),
      invoke: {
        id: "submitClaim",
        src: "submitHouseholdClaimService",
        input: ({ context }) => ({
          lgCustomerId: context.customerId || "",
          customerId: (context as any).customerIdInput || "",
          is1000DayHousehold: true,
        }),
        onDone: {
          target: "agentClaimSubmitted",
        },
        onError: {
          target: "error",
          actions: assign({
            error: ({ event }) =>
              event.error instanceof Error
                ? event.error.message
                : "Failed to submit claim",
            message: "Error submitting claim. Please try again.\n\n0. Back",
          }),
        },
      },
    },

    // Agent: Claim Submitted
    agentClaimSubmitted: {
      entry: assign(() => ({
        message: "1,000 Day Household claim submitted successfully!\n\n1. Back",
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

    // Agent: Register Intent to Deliver Beans
    agentRegisterIntent: {
      entry: assign(() => ({
        message:
          "[Stub] Register Intent to Deliver Beans not yet implemented.\n\n1. Back",
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

    // Agent: Submit Customer OTP
    agentSubmitOTP: {
      entry: assign(() => ({
        message: "[Stub] Submit Customer OTP not yet implemented.\n\n1. Back",
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

    // Agent: Confirm Bean Delivery
    agentConfirmDelivery: {
      entry: assign(() => ({
        message: "[Stub] Confirm Bean Delivery not yet implemented.\n\n1. Back",
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
