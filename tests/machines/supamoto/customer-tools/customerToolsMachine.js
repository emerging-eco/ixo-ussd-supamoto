import { setup, assign, fromPromise } from "xstate";
import { withNavigation } from "../utils/navigation-mixin.js";
import { navigationGuards } from "../guards/navigation.guards.js";
import { dataService } from "../../../../src/services/database-storage.js";
import { createModuleLogger } from "../../../../src/services/logger.js";
const logger = createModuleLogger("customerToolsMachine");
const MENU_MESSAGE = "Customer Tools\n1. Confirm Receival of Beans\n0. Back";
const RECEIPT_QUESTION = "Did you receive a bag of beans from your Lead Generator?\n1. Yes\n2. No\n0. Back";
export const customerToolsMachine = setup({
    types: {
        context: {},
        events: {},
        input: {},
    },
    guards: {
        isInput1: ({ event }) => navigationGuards.isInput("1")(null, event),
        isInput2: ({ event }) => navigationGuards.isInput("2")(null, event),
        isYes: ({ event }) => navigationGuards.isInput("1")(null, event),
        isNo: ({ event }) => navigationGuards.isInput("2")(null, event),
        isBack: ({ event }) => navigationGuards.isBackCommand(null, event),
        isExit: ({ event }) => navigationGuards.isExitCommand(null, event),
    },
    actors: {
        submitReceiptConfirmationService: fromPromise(async ({ input, }) => {
            logger.info({
                customerId: input.customerId.slice(-4),
                receivedBeans: input.receivedBeans,
            }, "Submitting receipt confirmation");
            // Get or create delivery confirmation
            const confirmation = await dataService.getDeliveryConfirmation(input.customerId, input.lgCustomerId);
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
            logger.info({ customerId: input.customerId.slice(-4) }, "Receipt confirmation submitted successfully");
            return { success: true, receivedBeans: input.receivedBeans };
        }),
    },
}).createMachine({
    id: "customerTools",
    initial: "menu",
    context: ({ input }) => ({
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
                INPUT: withNavigation([{ target: "confirmReceiptQuestion", guard: "isInput1" }], {
                    backTarget: "routeToMain",
                    exitTarget: "routeToMain",
                    enableBack: true,
                    enableExit: true,
                }),
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
                INPUT: withNavigation([
                    {
                        target: "submittingReceipt",
                        guard: "isYes",
                    },
                    {
                        target: "submittingReceipt",
                        guard: "isNo",
                    },
                ], {
                    backTarget: "menu",
                    exitTarget: "routeToMain",
                    enableBack: true,
                    enableExit: true,
                }),
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
                message: context.error || "An error occurred. Please try again.\n\n1. Back",
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
//# sourceMappingURL=customerToolsMachine.js.map
