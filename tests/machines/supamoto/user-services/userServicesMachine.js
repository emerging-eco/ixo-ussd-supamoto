import { setup, assign, fromPromise, sendTo } from "xstate";
import { withNavigation } from "../utils/navigation-mixin.js";
import { navigationGuards } from "../guards/navigation.guards.js";
import { dataService } from "../../../../src/services/database-storage.js";
import { customerActivationMachine, CustomerActivationOutput, } from "../activation/customerActivationMachine.js";
import { customerToolsMachine } from "../customer-tools/customerToolsMachine.js";
export const userServicesMachine = setup({
    types: {
        context: {},
        events: {},
        input: {},
    },
    actors: {
        fetchCustomerService: fromPromise(async ({ input }) => {
            const record = await dataService.getCustomerByPhone(input.phoneNumber);
            return record;
        }),
        fetchAccountDetailsService: fromPromise(async ({ input }) => {
            const record = await dataService.getCustomerByPhone(input.phoneNumber);
            return { source: "db", profile: record };
        }),
        fetchContractDetailsService: fromPromise(async () => {
            return null;
        }),
        fetchOrdersService: fromPromise(async () => {
            return [];
        }),
        fetchVouchersService: fromPromise(async () => {
            return [];
        }),
        customerActivationMachine,
        customerToolsMachine,
    },
    actions: {
        setError: assign({
            error: ({ event }) => event.type === "ERROR" ? event.error : "An error occurred",
            message: "System error. Please try again.",
        }),
        clearErrors: assign(() => ({ error: undefined })),
    },
    guards: {
        isInput1: ({ event }) => navigationGuards.isInput("1")(null, event),
        isInput2: ({ event }) => navigationGuards.isInput("2")(null, event),
        isInput3: ({ event }) => navigationGuards.isInput("3")(null, event),
        isInput4: ({ event }) => navigationGuards.isInput("4")(null, event),
        isAgent: ({ context }) => {
            const role = context.customerRole;
            return (role === "lead_generator" || role === "call_center" || role === "admin");
        },
        isCustomer: ({ context }) => {
            return context.customerRole === "customer";
        },
        isBack: ({ event }) => navigationGuards.isBackCommand(null, event),
        isExit: ({ event }) => navigationGuards.isExitCommand(null, event),
    },
}).createMachine({
    id: "userServices",
    initial: "determineInitialState",
    context: ({ input }) => ({
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
                message: "Agent Tools\n" +
                    "1. Activate a Customer\n" +
                    "2. Register Intent to Deliver Beans\n" +
                    "3. Submit Customer OTP\n" +
                    "4. Confirm Bean Delivery\n" +
                    "0. Back",
            })),
            on: {
                INPUT: withNavigation([
                    { target: "agentActivateCustomer", guard: "isInput1" },
                    { target: "agentRegisterIntent", guard: "isInput2" },
                    { target: "agentSubmitOTP", guard: "isInput3" },
                    { target: "agentConfirmDelivery", guard: "isInput4" },
                ], {
                    backTarget: "routeToMain",
                    exitTarget: "routeToMain",
                    enableBack: true,
                    enableExit: true,
                }),
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
                        guard: ({ event }) => event.output?.result ===
                            CustomerActivationOutput.COMPLETE,
                    },
                    {
                        target: "agent",
                        guard: ({ event }) => event.output?.result ===
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
        // Agent: Register Intent to Deliver Beans
        agentRegisterIntent: {
            entry: assign(() => ({
                message: "[Stub] Register Intent to Deliver Beans not yet implemented.\n\n1. Back",
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
//# sourceMappingURL=userServicesMachine.js.map
