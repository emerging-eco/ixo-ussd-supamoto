import { setup, assign, fromPromise } from "xstate";
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
  message: string;
  error?: string;
}

export type UserServicesEvent =
  | { type: "INPUT"; input: string }
  | { type: "ERROR"; error: string };

const menuMessage =
  "User Services\n" +
  "1. Account\n" +
  "2. Balances\n" +
  "3. Orders\n" +
  "4. Vouchers\n" +
  "5. Agent Tools\n" +
  "0. Back";

export const userServicesMachine = setup({
  types: {
    context: {} as UserServicesContext,
    events: {} as UserServicesEvent,
    input: {} as {
      sessionId: string;
      phoneNumber: string;
      serviceCode: string;
      pin?: string;
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
    setMenuMessage: assign(() => ({ message: menuMessage })),
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
          "Agent Tools\n1. Check funds in escrow\n2. Check BEAN vouchers\n0. Back",
      })),
      on: {
        INPUT: withNavigation(
          [
            { target: "agentEscrow", guard: "isInput1" },
            { target: "agentBean", guard: "isInput2" },
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

    // Error and exit
    error: {
      entry: "setError",
      on: {
        INPUT: withNavigation([], {
          backTarget: "menu",
          exitTarget: "routeToMain",
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
