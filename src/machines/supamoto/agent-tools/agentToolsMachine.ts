/**
 * Agent Tools Machine - Bean Distribution Workflow
 *
 * Handles three bean distribution menu items for Lead Generators:
 * 1. Register Intent to Deliver Beans (Menu Item 3)
 * 2. Submit Customer OTP (Menu Item 4)
 * 3. Confirm Bean Delivery (Menu Item 5)
 *
 * Flow:
 * 1. LG registers intent → blockchain MsgClaimIntent → OTP sent to customer
 * 2. LG submits customer's OTP → blockchain MsgSubmitClaim (useIntent=true)
 * 3. Customer confirms receipt → blockchain MsgEvaluateClaim (APPROVED)
 * 4. LG confirms delivery → record logged
 */

import { setup, assign, fromPromise } from "xstate";
import { dataService } from "../../../services/database-storage.js";
import { databaseManager } from "../../../services/database-manager.js";
import { createModuleLogger } from "../../../services/logger.js";
import { config } from "../../../config.js";
import { CHAIN_RPC_URL } from "../../../constants/ixo-blockchain.js";
import {
  submitClaimIntent,
  submitClaim,
} from "../../../services/ixo/ixo-claims.js";
import { logBeanDeliveryConfirmation } from "../../../services/claims-bot.js";
import { sendSMS, generatePin } from "../../../services/sms.js";
import {
  customerOTPSMS,
  lgNoVoucherSMS,
  lgHasVoucherSMS,
  lgInvalidOTPSMS,
  lgValidOTPSMS,
} from "../../../templates/sms/otp.js";
import { getSecpClient } from "../../../utils/secp.js";

const logger = createModuleLogger("agentTools");

// Types and Interfaces
export interface AgentToolsContext {
  sessionId: string;
  phoneNumber: string; // LG's phone number
  serviceCode: string;
  lgCustomerId: string; // Lead Generator's customer ID
  menuItem: "registerIntent" | "submitOTP" | "confirmDelivery";
  message: string;
  error?: string;
  // Workflow data
  customerId?: string; // Customer being served
  customerPhone?: string;
  intentId?: number;
  claimIntentId?: string;
  claimIntentTxHash?: string;
  otp?: string;
  otpId?: number;
  claimId?: string;
  claimTxHash?: string;
  confirmationId?: number;
  hasBeanVoucher?: boolean;
  // Output
  nextParentState: AgentToolsOutput;
}

export interface AgentToolsInput {
  sessionId: string;
  phoneNumber: string;
  serviceCode: string;
  lgCustomerId: string;
  menuItem: "registerIntent" | "submitOTP" | "confirmDelivery";
}

export type AgentToolsEvent =
  | { type: "INPUT"; input: string }
  | { type: "ERROR"; error: string };

export enum AgentToolsOutput {
  SUCCESS = "SUCCESS",
  BACK = "BACK",
  EXIT = "EXIT",
}

// Messages
const ENTER_CUSTOMER_ID_PROMPT = "Enter Customer ID:\n\n0. Back";
const ENTER_OTP_PROMPT = "Enter the 5-digit OTP from the customer:\n\n0. Back";
const PROCESSING_MSG = "Processing...";
const REGISTERING_INTENT_MSG = "Registering intent to deliver beans...";
const VALIDATING_OTP_MSG = "Validating OTP...";
const SUBMITTING_CLAIM_MSG = "Submitting claim to blockchain...";
const CONFIRMING_DELIVERY_MSG = "Confirming delivery...";

// Validation guards
const isValidCustomerId = ({ event }: { event: AgentToolsEvent }) => {
  if (event.type !== "INPUT") return false;
  const customerId = event.input.trim();
  return /^C[A-Za-z0-9]{8,}$/.test(customerId);
};

const isValidOTP = ({ event }: { event: AgentToolsEvent }) => {
  if (event.type !== "INPUT") return false;
  const otp = event.input.trim();
  return /^\d{5}$/.test(otp);
};

// Actor Services
const fetchCustomerDataService = fromPromise(
  async ({ input }: { input: { customerId: string } }) => {
    logger.info(
      { customerId: input.customerId.slice(-4) },
      "Fetching customer data"
    );

    const customer = await dataService.getCustomerByCustomerId(
      input.customerId
    );
    if (!customer) {
      throw new Error(`Customer ${input.customerId} not found`);
    }

    // Get customer's phone number by querying customer_phones and phones tables
    const db = databaseManager.getKysely();
    const phoneResult = await db
      .selectFrom("customer_phones")
      .innerJoin("phones", "customer_phones.phone_id", "phones.id")
      .innerJoin("customers", "customer_phones.customer_id", "customers.id")
      .select("phones.phone_number")
      .where("customers.customer_id", "=", input.customerId)
      .where("customer_phones.is_primary", "=", true)
      .executeTakeFirst();

    if (!phoneResult) {
      throw new Error(`No phone number found for customer ${input.customerId}`);
    }

    return {
      customerId: customer.customerId,
      customerPhone: phoneResult.phone_number,
    };
  }
);

const checkVoucherService = fromPromise(
  async ({ input }: { input: { customerId: string } }) => {
    logger.info(
      { customerId: input.customerId.slice(-4) },
      "Checking bean voucher eligibility"
    );

    // TODO: Implement actual voucher check via Matrix or blockchain
    // For now, stub with a simple check
    // In production, this would call getVouchersFromRoom() or similar

    // Placeholder: Check if customer has completed 1000-day survey
    // This is a simplified check - real implementation would verify blockchain vouchers
    const hasBeanVoucher = true; // Stub: assume customer has voucher

    return {
      hasBeanVoucher,
      voucherStatus: hasBeanVoucher ? "HAS_VOUCHER" : "NO_VOUCHER",
      voucherCheckResponse: {
        checked: true,
        timestamp: new Date().toISOString(),
      },
    };
  }
);

const submitBeanClaimIntentService = fromPromise(
  async ({
    input,
  }: {
    input: {
      customerId: string;
      lgCustomerId: string;
      customerPhone: string;
    };
  }) => {
    logger.info(
      {
        customerId: input.customerId.slice(-4),
        lgCustomerId: input.lgCustomerId.slice(-4),
      },
      "Submitting bean claim intent to blockchain"
    );

    // Get LG wallet details
    const lgWallet = await getSecpClient(
      config.BEAN_DISTRIBUTION.LG_WALLET_MNEMONIC
    );
    const lgAddress = lgWallet.baseAccount.address;
    const lgDid = `did:ixo:${lgAddress}`;

    // Get customer's claim collection ID (default to 120 for bean distribution)
    const collectionId = config.BEAN_DISTRIBUTION.COLLECTION_ID;

    // Submit claim intent to blockchain
    const result = await submitClaimIntent({
      mnemonic: config.BEAN_DISTRIBUTION.LG_WALLET_MNEMONIC,
      chainRpcUrl: CHAIN_RPC_URL,
      intent: {
        collectionId,
        agentDid: lgDid,
        agentAddress: lgAddress,
      },
      memo: `Bean delivery intent for customer ${input.customerId}`,
    });

    // Extract claim intent ID from transaction events
    const claimIntentId = result.events
      .find(e => e.type === "ixo.claims.v1beta1.ClaimIntentCreated")
      ?.attributes.find(a => a.key === "claim_intent_id")?.value;

    if (!claimIntentId) {
      throw new Error("Failed to extract claim intent ID from transaction");
    }

    logger.info(
      {
        claimIntentId,
        txHash: result.transactionHash,
        customerId: input.customerId.slice(-4),
      },
      "Claim intent submitted successfully"
    );

    return {
      claimIntentId,
      claimIntentTxHash: result.transactionHash,
      claimIntentResponse: result,
    };
  }
);

const generateAndSendOTPService = fromPromise(
  async ({
    input,
  }: {
    input: {
      customerId: string;
      lgCustomerId: string;
      customerPhone: string;
      intentId: number;
      hasBeanVoucher: boolean;
    };
  }) => {
    logger.info(
      {
        customerId: input.customerId.slice(-4),
        hasBeanVoucher: input.hasBeanVoucher,
      },
      "Generating and sending OTP"
    );

    if (!input.hasBeanVoucher) {
      // Send "no voucher" SMS to LG - get LG phone number
      const db = databaseManager.getKysely();
      const lgPhoneResult = await db
        .selectFrom("customer_phones")
        .innerJoin("phones", "customer_phones.phone_id", "phones.id")
        .innerJoin("customers", "customer_phones.customer_id", "customers.id")
        .select("phones.phone_number")
        .where("customers.customer_id", "=", input.lgCustomerId)
        .where("customer_phones.is_primary", "=", true)
        .executeTakeFirst();

      if (lgPhoneResult) {
        await sendSMS({
          to: lgPhoneResult.phone_number,
          message: lgNoVoucherSMS(input.customerId),
        });
      }
      throw new Error("Customer does not have a bean voucher");
    }

    // Generate 5-digit OTP
    const otp = generatePin();

    // Save OTP to database
    const otpRecord = await dataService.createOTP(
      input.customerId,
      input.lgCustomerId,
      input.intentId,
      otp,
      config.USSD.OTP_VALIDITY_MINUTES
    );

    // Send OTP to customer
    await sendSMS({
      to: input.customerPhone,
      message: customerOTPSMS(otp),
    });

    // Send "has voucher" SMS to LG
    const db = databaseManager.getKysely();
    const lgPhoneResult = await db
      .selectFrom("customer_phones")
      .innerJoin("phones", "customer_phones.phone_id", "phones.id")
      .innerJoin("customers", "customer_phones.customer_id", "customers.id")
      .select("phones.phone_number")
      .where("customers.customer_id", "=", input.lgCustomerId)
      .where("customer_phones.is_primary", "=", true)
      .executeTakeFirst();

    if (lgPhoneResult) {
      await sendSMS({
        to: lgPhoneResult.phone_number,
        message: lgHasVoucherSMS(input.customerId),
      });
    }

    logger.info(
      {
        customerId: input.customerId.slice(-4),
        otpId: otpRecord.id,
      },
      "OTP generated and sent successfully"
    );

    return {
      otp,
      otpId: otpRecord.id,
    };
  }
);

const validateOTPService = fromPromise(
  async ({
    input,
  }: {
    input: {
      customerId: string;
      lgCustomerId: string;
      otp: string;
    };
  }) => {
    logger.info({ customerId: input.customerId.slice(-4) }, "Validating OTP");

    const otpRecord = await dataService.validateOTP(
      input.customerId,
      input.otp
    );

    if (!otpRecord) {
      // Send invalid OTP SMS to LG - get LG phone number
      const db = databaseManager.getKysely();
      const lgPhoneResult = await db
        .selectFrom("customer_phones")
        .innerJoin("phones", "customer_phones.phone_id", "phones.id")
        .innerJoin("customers", "customer_phones.customer_id", "customers.id")
        .select("phones.phone_number")
        .where("customers.customer_id", "=", input.lgCustomerId)
        .where("customer_phones.is_primary", "=", true)
        .executeTakeFirst();

      if (lgPhoneResult) {
        await sendSMS({
          to: lgPhoneResult.phone_number,
          message: lgInvalidOTPSMS(input.customerId, "INVALID"),
        });
      }
      throw new Error("Invalid or expired OTP");
    }

    logger.info(
      {
        customerId: input.customerId.slice(-4),
        otpId: otpRecord.id,
      },
      "OTP validated successfully"
    );

    return {
      otpId: otpRecord.id,
      intentId: otpRecord.intentId,
    };
  }
);

const submitBeanClaimService = fromPromise(
  async ({
    input,
  }: {
    input: {
      customerId: string;
      lgCustomerId: string;
      claimIntentId: string;
    };
  }) => {
    logger.info(
      {
        customerId: input.customerId.slice(-4),
        claimIntentId: input.claimIntentId,
      },
      "Submitting bean claim to blockchain"
    );

    // Get LG wallet details
    const lgWallet = await getSecpClient(
      config.BEAN_DISTRIBUTION.LG_WALLET_MNEMONIC
    );
    const lgAddress = lgWallet.baseAccount.address;
    const lgDid = `did:ixo:${lgAddress}`;

    // Get customer's claim collection ID
    const collectionId = config.BEAN_DISTRIBUTION.COLLECTION_ID;

    // Submit claim with useIntent=true to link to the claim intent
    const result = await submitClaim({
      mnemonic: config.BEAN_DISTRIBUTION.LG_WALLET_MNEMONIC,
      chainRpcUrl: CHAIN_RPC_URL,
      claim: {
        collectionId,
        agentDid: lgDid,
        agentAddress: lgAddress,
        useIntent: true, // Link to existing claim intent
      },
      memo: `Bean delivery claim for customer ${input.customerId}`,
    });

    // Extract claim ID from transaction events
    const claimId = result.events
      .find(e => e.type === "ixo.claims.v1beta1.ClaimSubmitted")
      ?.attributes.find(a => a.key === "claim_id")?.value;

    if (!claimId) {
      throw new Error("Failed to extract claim ID from transaction");
    }

    logger.info(
      {
        claimId,
        txHash: result.transactionHash,
        customerId: input.customerId.slice(-4),
      },
      "Claim submitted successfully"
    );

    return {
      claimId,
      claimTxHash: result.transactionHash,
    };
  }
);

const createDeliveryConfirmationService = fromPromise(
  async ({
    input,
  }: {
    input: {
      customerId: string;
      lgCustomerId: string;
      otpId: number;
    };
  }) => {
    logger.info(
      {
        customerId: input.customerId.slice(-4),
        lgCustomerId: input.lgCustomerId.slice(-4),
      },
      "Creating delivery confirmation record"
    );

    // Mark OTP as used
    await dataService.markOTPAsUsed(input.otpId);

    // Create delivery confirmation record
    const confirmation = await dataService.createDeliveryConfirmation(
      input.customerId,
      input.lgCustomerId,
      input.otpId,
      config.USSD.DELIVERY_CONFIRMATION_DAYS
    );

    // Send "valid OTP" SMS to LG - get LG phone number
    const db = databaseManager.getKysely();
    const lgPhoneResult = await db
      .selectFrom("customer_phones")
      .innerJoin("phones", "customer_phones.phone_id", "phones.id")
      .innerJoin("customers", "customer_phones.customer_id", "customers.id")
      .select("phones.phone_number")
      .where("customers.customer_id", "=", input.lgCustomerId)
      .where("customer_phones.is_primary", "=", true)
      .executeTakeFirst();

    if (lgPhoneResult) {
      await sendSMS({
        to: lgPhoneResult.phone_number,
        message: lgValidOTPSMS(input.customerId),
      });
    }

    logger.info(
      {
        confirmationId: confirmation.id,
        customerId: input.customerId.slice(-4),
      },
      "Delivery confirmation created successfully"
    );

    return {
      confirmationId: confirmation.id,
    };
  }
);

const updateLGConfirmationService = fromPromise(
  async ({
    input,
  }: {
    input: {
      customerId: string;
      lgCustomerId: string;
    };
  }) => {
    logger.info(
      {
        customerId: input.customerId.slice(-4),
        lgCustomerId: input.lgCustomerId.slice(-4),
      },
      "Updating LG confirmation"
    );

    // Get delivery confirmation
    const confirmation = await dataService.getDeliveryConfirmation(
      input.customerId,
      input.lgCustomerId
    );

    if (!confirmation) {
      throw new Error(
        `No delivery confirmation found for customer ${input.customerId}`
      );
    }

    // Update LG confirmation timestamp
    await dataService.updateDeliveryConfirmation(confirmation.id, {
      lgConfirmedAt: new Date(),
    });

    // Log bean delivery to Claims Bot (for record-keeping)
    await logBeanDeliveryConfirmation({
      leadGeneratorId: input.lgCustomerId,
      customerId: input.customerId,
      deliveryDate: new Date().toISOString(),
      beanQuantity: 1,
    });

    logger.info(
      {
        confirmationId: confirmation.id,
        customerId: input.customerId.slice(-4),
      },
      "LG confirmation updated successfully"
    );

    return {
      confirmationId: confirmation.id,
    };
  }
);

const storeIntentInDatabaseService = fromPromise(
  async ({
    input,
  }: {
    input: {
      customerId: string;
      lgCustomerId: string;
      hasBeanVoucher: boolean;
      voucherStatus: string;
      voucherCheckResponse: any;
      claimIntentId: string;
      claimIntentTxHash: string;
    };
  }) => {
    logger.info(
      {
        customerId: input.customerId.slice(-4),
        claimIntentId: input.claimIntentId,
      },
      "Storing intent in database"
    );

    const intent = await dataService.createLGIntent(
      input.customerId,
      input.lgCustomerId,
      input.hasBeanVoucher,
      input.voucherStatus,
      input.voucherCheckResponse
    );

    // Update intent with blockchain claim tracking
    const db = databaseManager.getKysely();
    await db
      .updateTable("lg_delivery_intents")
      .set({
        claim_intent_id: input.claimIntentId,
        claim_intent_tx_hash: input.claimIntentTxHash,
        customer_claim_collection_id: config.BEAN_DISTRIBUTION.COLLECTION_ID,
      })
      .where("id", "=", intent.id)
      .execute();

    logger.info(
      {
        intentId: intent.id,
        customerId: input.customerId.slice(-4),
      },
      "Intent stored in database successfully"
    );

    return {
      intentId: intent.id,
    };
  }
);

// Machine Setup
export const agentToolsMachine = setup({
  types: {
    context: {} as AgentToolsContext,
    events: {} as AgentToolsEvent,
    input: {} as AgentToolsInput,
  },
  guards: {
    isValidCustomerId,
    isValidOTP,
    isInput1: ({ event }) => event.type === "INPUT" && event.input === "1",
    isBack: ({ event }) => event.type === "INPUT" && event.input === "0",
    isExit: ({ event }) =>
      event.type === "INPUT" && event.input.toLowerCase() === "exit",
    hasVoucher: ({ context }) => context.hasBeanVoucher === true,
  },
  actors: {
    fetchCustomerDataService,
    checkVoucherService,
    submitBeanClaimIntentService,
    storeIntentInDatabaseService,
    generateAndSendOTPService,
    validateOTPService,
    submitBeanClaimService,
    createDeliveryConfirmationService,
    updateLGConfirmationService,
  },
  actions: {
    clearErrors: assign({
      error: undefined,
    }),
    setCustomerId: assign({
      customerId: ({ event }) =>
        event.type === "INPUT" ? event.input.trim() : undefined,
    }),
    setOTP: assign({
      otp: ({ event }) =>
        event.type === "INPUT" ? event.input.trim() : undefined,
    }),
    setCustomerData: assign({
      customerPhone: ({ event }) => (event as any).output.customerPhone,
    }),
    setVoucherData: assign({
      hasBeanVoucher: ({ event }) => (event as any).output.hasBeanVoucher,
    }),
    setClaimIntentData: assign({
      claimIntentId: ({ event }) => (event as any).output.claimIntentId,
      claimIntentTxHash: ({ event }) => (event as any).output.claimIntentTxHash,
    }),
    setIntentId: assign({
      intentId: ({ event }) => (event as any).output.intentId,
    }),
    setOTPData: assign({
      otp: ({ event }) => (event as any).output.otp,
      otpId: ({ event }) => (event as any).output.otpId,
    }),
    setValidatedOTPData: assign({
      otpId: ({ event }) => (event as any).output.otpId,
      intentId: ({ event }) => (event as any).output.intentId,
    }),
    setClaimData: assign({
      claimId: ({ event }) => (event as any).output.claimId,
      claimTxHash: ({ event }) => (event as any).output.claimTxHash,
    }),
    setConfirmationId: assign({
      confirmationId: ({ event }) => (event as any).output.confirmationId,
    }),
    setError: assign({
      error: ({ event }) =>
        event.type === "ERROR" ? event.error : "An error occurred",
    }),
  },
}).createMachine({
  id: "agentTools",
  initial: "determineInitialState",
  context: ({ input }): AgentToolsContext => ({
    sessionId: input?.sessionId || "",
    phoneNumber: input?.phoneNumber || "",
    serviceCode: input?.serviceCode || "",
    lgCustomerId: input?.lgCustomerId || "",
    menuItem: input?.menuItem || "registerIntent",
    message: "",
    nextParentState: AgentToolsOutput.BACK,
  }),
  output: ({ context }) => ({ result: context.nextParentState }),
  states: {
    // Determine which workflow to start based on menuItem input
    determineInitialState: {
      always: [
        {
          target: "registerIntent",
          guard: ({ context }) => context.menuItem === "registerIntent",
        },
        {
          target: "submitOTP",
          guard: ({ context }) => context.menuItem === "submitOTP",
        },
        {
          target: "confirmDelivery",
          guard: ({ context }) => context.menuItem === "confirmDelivery",
        },
        {
          target: "complete", // Fallback
        },
      ],
    },

    // ========================================================================
    // MENU ITEM 3: Register Intent to Deliver Beans
    // ========================================================================
    registerIntent: {
      initial: "enterCustomerId",
      states: {
        enterCustomerId: {
          entry: assign({
            message: ENTER_CUSTOMER_ID_PROMPT,
          }),
          on: {
            INPUT: [
              {
                target: "fetchingCustomerData",
                guard: "isValidCustomerId",
                actions: "setCustomerId",
              },
              {
                target: "#agentTools.complete",
                guard: "isBack",
                actions: assign({
                  nextParentState: AgentToolsOutput.BACK,
                }),
              },
            ],
          },
        },

        fetchingCustomerData: {
          entry: assign({
            message: PROCESSING_MSG,
          }),
          invoke: {
            src: "fetchCustomerDataService",
            input: ({ context }) => ({
              customerId: context.customerId!,
            }),
            onDone: {
              target: "checkingVoucher",
              actions: "setCustomerData",
            },
            onError: {
              target: "error",
              actions: "setError",
            },
          },
        },

        checkingVoucher: {
          entry: assign({
            message: "Checking bean voucher eligibility...",
          }),
          invoke: {
            src: "checkVoucherService",
            input: ({ context }) => ({
              customerId: context.customerId!,
            }),
            onDone: {
              target: "submittingIntent",
              actions: "setVoucherData",
            },
            onError: {
              target: "error",
              actions: "setError",
            },
          },
        },

        submittingIntent: {
          entry: assign({
            message: REGISTERING_INTENT_MSG,
          }),
          invoke: {
            src: "submitBeanClaimIntentService",
            input: ({ context }) => ({
              customerId: context.customerId!,
              lgCustomerId: context.lgCustomerId,
              customerPhone: context.customerPhone!,
            }),
            onDone: {
              target: "storingIntent",
              actions: "setClaimIntentData",
            },
            onError: {
              target: "error",
              actions: "setError",
            },
          },
        },

        storingIntent: {
          entry: assign({
            message: "Storing intent...",
          }),
          invoke: {
            src: "storeIntentInDatabaseService",
            input: ({ context }) => ({
              customerId: context.customerId!,
              lgCustomerId: context.lgCustomerId,
              hasBeanVoucher: context.hasBeanVoucher!,
              voucherStatus: context.hasBeanVoucher
                ? "HAS_VOUCHER"
                : "NO_VOUCHER",
              voucherCheckResponse: {},
              claimIntentId: context.claimIntentId!,
              claimIntentTxHash: context.claimIntentTxHash!,
            }),
            onDone: {
              target: "generatingOTP",
              actions: "setIntentId",
            },
            onError: {
              target: "error",
              actions: "setError",
            },
          },
        },
        generatingOTP: {
          entry: assign({
            message: "Generating OTP and sending SMS...",
          }),
          invoke: {
            src: "generateAndSendOTPService",
            input: ({ context }) => ({
              customerId: context.customerId!,
              lgCustomerId: context.lgCustomerId,
              customerPhone: context.customerPhone!,
              intentId: context.intentId!,
              hasBeanVoucher: context.hasBeanVoucher!,
            }),
            onDone: {
              target: "complete",
              actions: "setOTPData",
            },
            onError: {
              target: "error",
              actions: "setError",
            },
          },
        },

        complete: {
          entry: assign({
            message: ({ context }) =>
              `Intent registered successfully!\n\nCustomer ${context.customerId} has been sent an OTP.\n\nNext steps:\n1. Ask customer for OTP\n2. Submit OTP via Agent Tools\n\n1. Back to Agent Tools`,
          }),
          on: {
            INPUT: [
              {
                target: "#agentTools.complete",
                guard: "isInput1",
                actions: assign({
                  nextParentState: AgentToolsOutput.SUCCESS,
                }),
              },
            ],
          },
        },

        error: {
          entry: assign({
            message: ({ context }) =>
              `Error: ${context.error}\n\n0. Back to Agent Tools`,
          }),
          on: {
            INPUT: [
              {
                target: "#agentTools.complete",
                guard: "isBack",
                actions: assign({
                  nextParentState: AgentToolsOutput.BACK,
                }),
              },
            ],
          },
        },
      },
    },

    // ========================================================================
    // MENU ITEM 4: Submit Customer OTP
    // ========================================================================
    submitOTP: {
      initial: "enterCustomerId",
      states: {
        enterCustomerId: {
          entry: assign({
            message: ENTER_CUSTOMER_ID_PROMPT,
          }),
          on: {
            INPUT: [
              {
                target: "enterOTP",
                guard: "isValidCustomerId",
                actions: "setCustomerId",
              },
              {
                target: "#agentTools.complete",
                guard: "isBack",
                actions: assign({
                  nextParentState: AgentToolsOutput.BACK,
                }),
              },
            ],
          },
        },

        enterOTP: {
          entry: assign({
            message: ENTER_OTP_PROMPT,
          }),
          on: {
            INPUT: [
              {
                target: "validatingOTP",
                guard: "isValidOTP",
                actions: "setOTP",
              },
              {
                target: "#agentTools.complete",
                guard: "isBack",
                actions: assign({
                  nextParentState: AgentToolsOutput.BACK,
                }),
              },
            ],
          },
        },

        validatingOTP: {
          entry: assign({
            message: VALIDATING_OTP_MSG,
          }),
          invoke: {
            src: "validateOTPService",
            input: ({ context }) => ({
              customerId: context.customerId!,
              lgCustomerId: context.lgCustomerId,
              otp: context.otp!,
            }),
            onDone: {
              target: "submittingClaim",
              actions: "setValidatedOTPData",
            },
            onError: {
              target: "error",
              actions: "setError",
            },
          },
        },

        submittingClaim: {
          entry: assign({
            message: SUBMITTING_CLAIM_MSG,
          }),
          invoke: {
            src: "submitBeanClaimService",
            input: ({ context }) => ({
              customerId: context.customerId!,
              lgCustomerId: context.lgCustomerId,
              claimIntentId: context.claimIntentId!,
            }),
            onDone: {
              target: "creatingConfirmation",
              actions: "setClaimData",
            },
            onError: {
              target: "error",
              actions: "setError",
            },
          },
        },

        creatingConfirmation: {
          entry: assign({
            message: "Creating delivery confirmation...",
          }),
          invoke: {
            src: "createDeliveryConfirmationService",
            input: ({ context }) => ({
              customerId: context.customerId!,
              lgCustomerId: context.lgCustomerId,
              otpId: context.otpId!,
            }),
            onDone: {
              target: "complete",
              actions: "setConfirmationId",
            },
            onError: {
              target: "error",
              actions: "setError",
            },
          },
        },

        complete: {
          entry: assign({
            message: ({ context }) =>
              `OTP validated successfully!\n\nYou are authorized to deliver beans to Customer ${context.customerId}.\n\nAfter delivery:\n1. Confirm via Agent Tools\n2. Ask customer to confirm receipt\n\n1. Back to Agent Tools`,
          }),
          on: {
            INPUT: [
              {
                target: "#agentTools.complete",
                guard: "isInput1",
                actions: assign({
                  nextParentState: AgentToolsOutput.SUCCESS,
                }),
              },
            ],
          },
        },

        error: {
          entry: assign({
            message: ({ context }) =>
              `Error: ${context.error}\n\n0. Back to Agent Tools`,
          }),
          on: {
            INPUT: [
              {
                target: "#agentTools.complete",
                guard: "isBack",
                actions: assign({
                  nextParentState: AgentToolsOutput.BACK,
                }),
              },
            ],
          },
        },
      },
    },

    // ========================================================================
    // MENU ITEM 5: Confirm Bean Delivery
    // ========================================================================
    confirmDelivery: {
      initial: "enterCustomerId",
      states: {
        enterCustomerId: {
          entry: assign({
            message: ENTER_CUSTOMER_ID_PROMPT,
          }),
          on: {
            INPUT: [
              {
                target: "updatingConfirmation",
                guard: "isValidCustomerId",
                actions: "setCustomerId",
              },
              {
                target: "#agentTools.complete",
                guard: "isBack",
                actions: assign({
                  nextParentState: AgentToolsOutput.BACK,
                }),
              },
            ],
          },
        },

        updatingConfirmation: {
          entry: assign({
            message: CONFIRMING_DELIVERY_MSG,
          }),
          invoke: {
            src: "updateLGConfirmationService",
            input: ({ context }) => ({
              customerId: context.customerId!,
              lgCustomerId: context.lgCustomerId,
            }),
            onDone: {
              target: "complete",
              actions: "setConfirmationId",
            },
            onError: {
              target: "error",
              actions: "setError",
            },
          },
        },

        complete: {
          entry: assign({
            message: ({ context }) =>
              `Delivery confirmed!\n\nYou have confirmed delivery of beans to Customer ${context.customerId}.\n\nThe customer must also confirm receipt within ${config.USSD.DELIVERY_CONFIRMATION_DAYS} days for you to receive your bean voucher.\n\n1. Back to Agent Tools`,
          }),
          on: {
            INPUT: [
              {
                target: "#agentTools.complete",
                guard: "isInput1",
                actions: assign({
                  nextParentState: AgentToolsOutput.SUCCESS,
                }),
              },
            ],
          },
        },

        error: {
          entry: assign({
            message: ({ context }) =>
              `Error: ${context.error}\n\n0. Back to Agent Tools`,
          }),
          on: {
            INPUT: [
              {
                target: "#agentTools.complete",
                guard: "isBack",
                actions: assign({
                  nextParentState: AgentToolsOutput.BACK,
                }),
              },
            ],
          },
        },
      },
    },

    // Final state
    complete: {
      type: "final",
    },
  },
});
