import { setup, assign, fromPromise } from "xstate";
import { withNavigation } from "../utils/navigation-mixin.js";
import { navigationGuards } from "../guards/navigation.guards.js";
import { dataService, type CustomerRecord } from "../../../services/database-storage.js";

/**
 * User Services Machine - Post-login user menu and simple stubs
 *
 * Entry: menu
 * Exit: routeToMain (signals parent to return to main menu)
 * Events: INPUT, ERROR
 */

export interface UserServicesContext {
  sessionId: string;
  phoneNumber: string;
  serviceCode: string;
  message: string;
  error?: string;
}

export type UserServicesEvent =
  | { type: "INPUT"; input: string }
  | { type: "ERROR"; error: string };

const menuMessage = (
  "User Services\n" +
    "1. Account\n" +
    "2. Balances\n" +
    "3. Orders\n" +
    "4. Vouchers\n" +
    "5. Agent Tools\n" +
    "0. Back"
);

export const userServicesMachine = setup({
  types: {
    context: {} as UserServicesContext,
    events: {} as UserServicesEvent,
    input: {} as { sessionId: string; phoneNumber: string; serviceCode: string },
  },
  actors: {
    fetchCustomerService: fromPromise(async ({ input }: { input: { phoneNumber: string } }) => {
      const record = await dataService.getCustomerByPhone(input.phoneNumber);
      return record;
    }),
  },
  actions: {
    setMenuMessage: assign(() => ({ message: menuMessage })),
    setError: assign({
      error: ({ event }) => (event.type === "ERROR" ? event.error : "An error occurred"),
      message: "System error. Please try again.",
    }),
    clearErrors: assign(() => ({ error: undefined })),
  },
  guards: {
    isInput1: ({ event }) => navigationGuards.isInput("1")(null as any, event as any),
    isInput2: ({ event }) => navigationGuards.isInput("2")(null as any, event as any),
    isInput3: ({ event }) => navigationGuards.isInput("3")(null as any, event as any),
    isInput4: ({ event }) => navigationGuards.isInput("4")(null as any, event as any),
    isInput5: ({ event }) => navigationGuards.isInput("5")(null as any, event as any),
    isBack: ({ event }) => navigationGuards.isBackCommand(null as any, event as any),
    isExit: ({ event }) => navigationGuards.isExitCommand(null as any, event as any),
  },
}).createMachine({
  id: "userServices",
  initial: "menu",
  context: ({ input }): UserServicesContext => ({
    sessionId: input?.sessionId || "",
    phoneNumber: input?.phoneNumber || "",
    serviceCode: input?.serviceCode || "",
    message: menuMessage,
    error: undefined,
  }),
  states: {
    // Top-level user services menu
    menu: {
      entry: ["setMenuMessage", "clearErrors"],
      on: {
        INPUT: withNavigation(
          [
            { target: "account", guard: "isInput1" },
            { target: "balances", guard: "isInput2" },
            { target: "orders", guard: "isInput3" },
            { target: "vouchers", guard: "isInput4" },
            { target: "agent", guard: "isInput5" },
          ],
          { backTarget: "routeToMain", exitTarget: "routeToMain", enableBack: true, enableExit: true }
        ),
        ERROR: { target: "error", actions: "setError" },
      },
    },

    // Account submenu
    account: {
      entry: assign(() => ({
        message: "Account\n1. Show my Account Details\n2. Edit my Account Details\n3. Show my Contract Details\n0. Back",
      })),
      on: {
        INPUT: withNavigation(
          [
            { target: "accountDetails", guard: "isInput1" },
            { target: "accountEdit", guard: "isInput2" },
            { target: "accountContract", guard: "isInput3" },
          ],
          { backTarget: "menu", exitTarget: "routeToMain", enableBack: true, enableExit: true }
        ),
      },
    },
    accountDetails: {
      entry: assign(() => ({ message: "Loading account details..." })),
      invoke: {
        id: "fetchCustomer",
        src: "fetchCustomerService",
        input: ({ context }) => ({ phoneNumber: context.phoneNumber }),
        onDone: {
          actions: assign(({ event }) => {
            const customer = event.output as CustomerRecord | null;
            const name = customer?.fullName ?? "-";
            const customerId = customer?.customerId ?? "-";
            const email = customer?.email ?? "-";
            return {
              message: `Account Details\nName: ${name}\nCustomer ID: ${customerId}\nEmail: ${email}\n\n1. Back`,
            };
          }),
        },
        onError: {
          actions: assign(() => ({
            message: "Failed to load account details. Please try again.\n\n1. Back",
          })),
        },
      },
      on: {
        INPUT: withNavigation([{ target: "account", guard: "isInput1" }], {
          backTarget: "account",
          exitTarget: "routeToMain",
          enableBack: true,
          enableExit: true,
        }),
      },
    },
    accountEdit: {
      entry: assign(() => ({ message: "[Stub] Edit Account Details not yet implemented.\n1. Back" })),
      on: {
        INPUT: withNavigation([{ target: "account", guard: "isInput1" }], {
          backTarget: "account",
          exitTarget: "routeToMain",
          enableBack: true,
          enableExit: true,
        }),
      },
    },
    accountContract: {
      entry: assign(() => ({ message: "[Stub] Showing Contract Details (from Matrix room state).\n1. Back" })),
      on: {
        INPUT: withNavigation([{ target: "account", guard: "isInput1" }], {
          backTarget: "account",
          exitTarget: "routeToMain",
          enableBack: true,
          enableExit: true,
        }),
      },
    },

    // Balances
    balances: {
      entry: assign(() => ({ message: "Balances\nSUPA: 0.0\nBEAN: 0\n\n1. Back" })),
      on: {
        INPUT: withNavigation([{ target: "menu", guard: "isInput1" }], {
          backTarget: "menu",
          exitTarget: "routeToMain",
          enableBack: true,
          enableExit: true,
        }),
      },
    },

    // Orders submenu
    orders: {
      entry: assign(() => ({ message: "Orders\n1. Place order (pellets/accessories)\n2. Confirm receipt\n0. Back" })),
      on: {
        INPUT: withNavigation(
          [
            { target: "placeOrder", guard: "isInput1" },
            { target: "confirmOrderReceipt", guard: "isInput2" },
          ],
          { backTarget: "menu", exitTarget: "routeToMain", enableBack: true, enableExit: true }
        ),
      },
    },
    placeOrder: {
      entry: assign(() => ({ message: "[Stub] Place Order flow not yet implemented.\n1. Back" })),
      on: {
        INPUT: withNavigation([{ target: "orders", guard: "isInput1" }], {
          backTarget: "orders",
          exitTarget: "routeToMain",
          enableBack: true,
          enableExit: true,
        }),
      },
    },
    confirmOrderReceipt: {
      entry: assign(() => ({ message: "[Stub] Confirm Order Receipt not yet implemented.\n1. Back" })),
      on: {
        INPUT: withNavigation([{ target: "orders", guard: "isInput1" }], {
          backTarget: "orders",
          exitTarget: "routeToMain",
          enableBack: true,
          enableExit: true,
        }),
      },
    },

    // Vouchers submenu
    vouchers: {
      entry: assign(() => ({ message: "Vouchers\n1. Redeem BEAN vouchers\n2. Confirm receipt of beans\n0. Back" })),
      on: {
        INPUT: withNavigation(
          [
            { target: "redeemVouchers", guard: "isInput1" },
            { target: "confirmBeansReceipt", guard: "isInput2" },
          ],
          { backTarget: "menu", exitTarget: "routeToMain", enableBack: true, enableExit: true }
        ),
      },
    },
    redeemVouchers: {
      entry: assign(() => ({ message: "[Stub] Redeem BEAN vouchers not yet implemented.\n1. Back" })),
      on: {
        INPUT: withNavigation([{ target: "vouchers", guard: "isInput1" }], {
          backTarget: "vouchers",
          exitTarget: "routeToMain",
          enableBack: true,
          enableExit: true,
        }),
      },
    },
    confirmBeansReceipt: {
      entry: assign(() => ({ message: "[Stub] Confirm Beans Receipt not yet implemented.\n1. Back" })),
      on: {
        INPUT: withNavigation([{ target: "vouchers", guard: "isInput1" }], {
          backTarget: "vouchers",
          exitTarget: "routeToMain",
          enableBack: true,
          enableExit: true,
        }),
      },
    },

    // Agent submenu (Lead Generator)
    agent: {
      entry: assign(() => ({ message: "Agent Tools\n1. Check funds in escrow\n2. Check BEAN vouchers\n0. Back" })),
      on: {
        INPUT: withNavigation(
          [
            { target: "agentEscrow", guard: "isInput1" },
            { target: "agentBean", guard: "isInput2" },
          ],
          { backTarget: "menu", exitTarget: "routeToMain", enableBack: true, enableExit: true }
        ),
      },
    },
    agentEscrow: {
      entry: assign(() => ({ message: "[Stub] Escrow funds check not yet implemented.\n1. Back" })),
      on: {
        INPUT: withNavigation([{ target: "agent", guard: "isInput1" }], {
          backTarget: "agent",
          exitTarget: "routeToMain",
          enableBack: true,
          enableExit: true,
        }),
      },
    },
    agentBean: {
      entry: assign(() => ({ message: "[Stub] BEAN vouchers check not yet implemented.\n1. Back" })),
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
        INPUT: withNavigation([], { backTarget: "menu", exitTarget: "routeToMain" }),
      },
    },

    routeToMain: {
      type: "final",
      entry: "clearErrors",
    },
  },
});

export type UserServicesMachine = typeof userServicesMachine;

