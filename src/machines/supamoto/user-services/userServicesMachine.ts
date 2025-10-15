import { setup, assign, fromPromise, sendTo } from "xstate";
import { withNavigation } from "../utils/navigation-mixin.js";
import { navigationGuards } from "../guards/navigation.guards.js";
import {
  dataService,
  type CustomerRecord,
} from "../../../services/database-storage.js";
import { config } from "../../../config.js";
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
  pin?: string;
  customerRole?: "customer" | "lead_generator" | "call_center" | "admin"; // Role-based access control
  message: string;
  error?: string;
}

export type UserServicesEvent =
  | { type: "INPUT"; input: string }
  | { type: "ERROR"; error: string };

/**
 * Build menu message based on user role
 * Agent Tools (option 5) is only shown to authorized personnel
 */
const buildMenuMessage = (role?: string): string => {
  const isAgent =
    role === "lead_generator" || role === "call_center" || role === "admin";

  return (
    "User Services\n" +
    "1. Account\n" +
    "2. Balances\n" +
    "3. Orders\n" +
    "4. Vouchers\n" +
    (isAgent ? "5. Agent Tools\n" : "") +
    "0. Back"
  );
};

export const userServicesMachine = setup({
  types: {
    context: {} as UserServicesContext,
    events: {} as UserServicesEvent,
    input: {} as {
      sessionId: string;
      phoneNumber: string;
      serviceCode: string;
      pin?: string;
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
          } catch {}
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
          } catch {}
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
          } catch {}
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
          } catch {}
        }
        return [] as any[];
      }
    ),
    customerActivationMachine,
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
    setMenuMessage: assign(({ context }) => ({
      message: buildMenuMessage(context.customerRole),
    })),
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
    // Combined guard: input is 5 AND user has agent role
    isInput5AndIsAgent: ({ event, context }) => {
      if (!navigationGuards.isInput("5")(null as any, event as any)) {
        return false;
      }
      const role = context.customerRole;
      return (
        role === "lead_generator" || role === "call_center" || role === "admin"
      );
    },
    isBack: ({ event }) =>
      navigationGuards.isBackCommand(null as any, event as any),
    isExit: ({ event }) =>
      navigationGuards.isExitCommand(null as any, event as any),
  },
}).createMachine({
  id: "userServices",
  initial: "menu",
  context: ({ input }): UserServicesContext => ({
    sessionId: input?.sessionId || "",
    phoneNumber: input?.phoneNumber || "",
    serviceCode: input?.serviceCode || "",
    pin: input?.pin,
    customerRole: input?.customerRole || "customer", // Default to customer role
    message: buildMenuMessage(input?.customerRole), // Dynamic menu based on role
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
            { target: "agent", guard: "isInput5AndIsAgent" }, // Role-based access control
            {
              // Handle unauthorized Agent Tools access attempt
              target: "menu",
              guard: "isInput5", // Input is 5 but not an agent
              actions: assign(({ context }) => {
                // Log unauthorized access attempt
                console.warn(
                  `[SECURITY] Unauthorized Agent Tools access attempt - Phone: ${context.phoneNumber.slice(-4)}, Role: ${context.customerRole || "unknown"}`
                );
                return {
                  message:
                    "Access denied. Agent Tools are only available to authorized personnel.\n\n" +
                    buildMenuMessage(context.customerRole),
                };
              }),
            },
          ],
          {
            backTarget: "routeToMain",
            exitTarget: "routeToMain",
            enableBack: true,
            enableExit: true,
          }
        ),
        ERROR: { target: "error", actions: "setError" },
      },
    },

    // Account submenu
    account: {
      entry: assign(() => ({
        message:
          "Account\n1. Show my Account Details\n2. Edit my Account Details\n3. Show my Contract Details\n0. Back",
      })),
      on: {
        INPUT: withNavigation(
          [
            { target: "accountDetails", guard: "isInput1" },
            { target: "accountEdit", guard: "isInput2" },
            { target: "accountContract", guard: "isInput3" },
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
    accountDetails: {
      entry: assign(() => ({ message: "Loading account details..." })),
      invoke: {
        id: "fetchAccountDetails",
        src: "fetchAccountDetailsService",
        input: ({ context }) => ({
          phoneNumber: context.phoneNumber,
          pin: context.pin,
        }),
        onDone: {
          actions: assign(({ event }) => {
            const result = event.output as {
              source: "matrix" | "db";
              profile: any;
            };
            if (result.source === "matrix") {
              const p = result.profile || {};
              const name = p.name ?? "-";
              const customerId = p.customer_id ?? "-";
              const email = p.email ?? "-";
              return {
                message: `Account Details\nName: ${name}\nCustomer ID: ${customerId}\nEmail: ${email}\n\n1. Back`,
              };
            } else {
              const customer = result.profile as CustomerRecord | null;
              const name = customer?.fullName ?? "-";
              const customerId = customer?.customerId ?? "-";
              const email = customer?.email ?? "-";
              return {
                message: `Account Details\nName: ${name}\nCustomer ID: ${customerId}\nEmail: ${email}\n\n1. Back`,
              };
            }
          }),
        },
        onError: {
          actions: assign(() => ({
            message:
              "Failed to load account details. Please try again.\n\n1. Back",
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
      entry: assign(() => ({
        message: "[Stub] Edit Account Details not yet implemented.\n1. Back",
      })),
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
      entry: assign(() => ({ message: "Loading contract details..." })),
      invoke: {
        id: "fetchContractDetails",
        src: "fetchContractDetailsService",
        input: ({ context }) => ({
          phoneNumber: context.phoneNumber,
          pin: context.pin,
        }),
        onDone: {
          actions: assign(({ event }) => {
            const c = (event.output as any) || {};
            const contractId = c?.contractId ?? "-";
            const plan = c?.plan ?? "-";
            const status = c?.status ?? "-";
            return {
              message: `Contract Details\nContract ID: ${contractId}\nPlan: ${plan}\nStatus: ${status}\n\n1. Back`,
            };
          }),
        },
        onError: {
          actions: assign(() => ({
            message: "Failed to load contract details.\n\n1. Back",
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

    // Balances
    balances: {
      entry: assign(() => ({
        message: "Balances\nSUPA: 0.0\nBEAN: 0\n\n1. Back",
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

    // Orders submenu
    orders: {
      entry: assign(() => ({
        message:
          "Orders\n1. Place order (pellets/accessories)\n2. Confirm receipt\n0. Back",
      })),
      on: {
        INPUT: withNavigation(
          [
            { target: "placeOrder", guard: "isInput1" },
            { target: "confirmOrderReceipt", guard: "isInput2" },
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
    placeOrder: {
      entry: assign(() => ({
        message: "[Stub] Place Order flow not yet implemented.\n1. Back",
      })),
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
      entry: assign(() => ({ message: "Loading order confirmations..." })),
      invoke: {
        id: "fetchOrders",
        src: "fetchOrdersService",
        input: ({ context }) => ({
          phoneNumber: context.phoneNumber,
          pin: context.pin,
        }),
        onDone: {
          actions: assign(({ event }) => {
            const orders = (event.output as any[]) || [];
            const latest = orders[0];
            const status = latest?.status ?? "-";
            return { message: `Order Status\nLatest: ${status}\n\n1. Back` };
          }),
        },
        onError: {
          actions: assign(() => ({
            message: "Failed to load order status.\n\n1. Back",
          })),
        },
      },
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
      entry: assign(() => ({
        message:
          "Vouchers\n1. Redeem BEAN vouchers\n2. Confirm receipt of beans\n0. Back",
      })),
      on: {
        INPUT: withNavigation(
          [
            { target: "redeemVouchers", guard: "isInput1" },
            { target: "confirmBeansReceipt", guard: "isInput2" },
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
    redeemVouchers: {
      entry: assign(() => ({
        message: "[Stub] Redeem BEAN vouchers not yet implemented.\n1. Back",
      })),
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
      entry: assign(() => ({ message: "Loading voucher confirmations..." })),
      invoke: {
        id: "fetchVouchers",
        src: "fetchVouchersService",
        input: ({ context }) => ({
          phoneNumber: context.phoneNumber,
          pin: context.pin,
        }),
        onDone: {
          actions: assign(({ event }) => {
            const vouchers = (event.output as any[]) || [];
            const count = vouchers.length;
            return {
              message: `Vouchers\nRecent confirmations: ${count}\n\n1. Back`,
            };
          }),
        },
        onError: {
          actions: assign(() => ({
            message: "Failed to load vouchers.\n\n1. Back",
          })),
        },
      },
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
      entry: assign(() => ({
        message:
          "Agent Tools\n" +
          "1. Check funds in escrow\n" +
          "2. Check BEAN vouchers\n" +
          "3. Activate Customer\n" +
          "0. Back",
      })),
      on: {
        INPUT: withNavigation(
          [
            { target: "agentEscrow", guard: "isInput1" },
            { target: "agentBean", guard: "isInput2" },
            { target: "agentActivateCustomer", guard: "isInput3" },
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
    agentEscrow: {
      entry: assign(() => ({
        message: "[Stub] Escrow funds check not yet implemented.\n1. Back",
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
    agentBean: {
      entry: assign(() => ({
        message: "[Stub] BEAN vouchers check not yet implemented.\n1. Back",
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

    // Error and exit
    error: {
      entry: "setError",
      on: {
        INPUT: withNavigation([], {
          backTarget: "menu",
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
