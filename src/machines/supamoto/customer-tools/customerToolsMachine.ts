import { setup, assign, fromPromise } from "xstate";
import { withNavigation } from "../utils/navigation-mixin.js";
import { navigationGuards } from "../guards/navigation.guards.js";
import { dataService } from "../../../services/database-storage.js";
import { databaseManager } from "../../../services/database-manager.js";
import { createModuleLogger } from "../../../services/logger.js";
import { config } from "../../../config.js";
import { CHAIN_RPC_URL } from "../../../constants/ixo-blockchain.js";
import { evaluateClaim } from "../../../services/ixo/ixo-claims.js";
import { sendSMS } from "../../../services/sms.js";
import { lgTokenTransferredSMS } from "../../../templates/sms/delivery.js";

const logger = createModuleLogger("customerTools");

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
  lgCustomerId?: string;
  message: string;
  error?: string;
  pin?: string;
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
      pin?: string;
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
    fetchDeliveryConfirmationService: fromPromise(
      async ({ input }: { input: { customerId: string } }) => {
        logger.info(
          { customerId: input.customerId.slice(-4) },
          "Fetching delivery confirmation for customer"
        );

        // Query for the most recent delivery confirmation for this customer
        const db = databaseManager.getKysely();
        const confirmation = await db
          .selectFrom("bean_delivery_confirmations")
          .selectAll()
          .where("customer_id", "=", input.customerId)
          .where("customer_confirmed_at", "is", null) // Not yet confirmed by customer
          .orderBy("created_at", "desc")
          .executeTakeFirst();

        if (!confirmation) {
          throw new Error(
            "No pending delivery confirmation found. Please contact your Lead Generator."
          );
        }

        logger.info(
          {
            confirmationId: confirmation.id,
            lgCustomerId: confirmation.lg_customer_id.slice(-4),
          },
          "Found pending delivery confirmation"
        );

        return {
          lgCustomerId: confirmation.lg_customer_id,
          confirmationId: confirmation.id,
        };
      }
    ),
    submitReceiptAndEvaluateClaimService: fromPromise(
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
            lgCustomerId: input.lgCustomerId.slice(-4),
            receivedBeans: input.receivedBeans,
          },
          "Submitting receipt confirmation and evaluating claim"
        );

        // 1. Retrieve delivery confirmation record
        const confirmation = await dataService.getDeliveryConfirmation(
          input.customerId,
          input.lgCustomerId
        );

        if (!confirmation) {
          throw new Error(
            `No delivery confirmation found for customer ${input.customerId}`
          );
        }

        logger.info(
          {
            confirmationId: confirmation.id,
            claimId: confirmation.claimId,
          },
          "Found delivery confirmation record"
        );

        // 2. Update confirmation with customer timestamp and receipt status
        await dataService.updateDeliveryConfirmation(confirmation.id, {
          customerConfirmedAt: new Date(),
          customerConfirmedReceipt: input.receivedBeans,
        });

        logger.info(
          { confirmationId: confirmation.id },
          "Updated confirmation with customer timestamp"
        );

        // 3. If customer denied receipt, log denial and return
        if (!input.receivedBeans) {
          await dataService.createAuditLog({
            eventType: "BEAN_RECEIPT_DENIED",
            customerId: input.customerId,
            lgCustomerId: input.lgCustomerId,
            details: {
              deniedAt: new Date().toISOString(),
              confirmationId: confirmation.id,
              claimId: confirmation.claimId,
            },
          });

          logger.warn(
            {
              customerId: input.customerId.slice(-4),
              confirmationId: confirmation.id,
            },
            "Customer denied receipt - claim will not be evaluated"
          );

          return {
            success: true,
            receivedBeans: false,
            claimEvaluated: false,
          };
        }

        // 4. Customer confirmed receipt - evaluate claim with APPROVED status
        const collectionId =
          confirmation.claimId?.split("-")[0] ||
          config.BEAN_DISTRIBUTION.COLLECTION_ID;
        const claimId = confirmation.claimId;

        if (!claimId) {
          throw new Error(
            `No claim ID found in confirmation record for customer ${input.customerId}`
          );
        }

        logger.info(
          {
            claimId,
            collectionId,
            customerId: input.customerId.slice(-4),
          },
          "Evaluating claim with APPROVED status"
        );

        // 5. Submit MsgEvaluateClaim to blockchain
        const evaluationResult = await evaluateClaim({
          mnemonic: config.BEAN_DISTRIBUTION.EVALUATOR_WALLET_MNEMONIC,
          chainRpcUrl: CHAIN_RPC_URL,
          evaluation: {
            claimId,
            collectionId,
            status: 1, // APPROVED
            reason: "Customer confirmed receipt of beans",
          },
        });

        logger.info(
          {
            claimId,
            transactionHash: evaluationResult.transactionHash,
            height: evaluationResult.height,
          },
          "Claim evaluated successfully - payment released"
        );

        // 6. Store evaluation transaction hash in database
        const db = databaseManager.getKysely();
        await db
          .updateTable("bean_delivery_confirmations")
          .set({
            claim_evaluation_tx_hash: evaluationResult.transactionHash,
            token_transferred_at: new Date(),
            updated_at: new Date(),
          })
          .where("id", "=", confirmation.id)
          .execute();

        logger.info(
          {
            confirmationId: confirmation.id,
            evaluationTxHash: evaluationResult.transactionHash,
          },
          "Stored evaluation transaction hash in database"
        );

        // 7. Send SMS to LG notifying payment release
        try {
          // Get LG phone number using Kysely join
          const lgPhoneResult = await db
            .selectFrom("customer_phones")
            .innerJoin("phones", "customer_phones.phone_id", "phones.id")
            .innerJoin(
              "customers",
              "customer_phones.customer_id",
              "customers.id"
            )
            .select("phones.phone_number")
            .where("customers.customer_id", "=", input.lgCustomerId)
            .where("customer_phones.is_primary", "=", true)
            .executeTakeFirst();

          if (lgPhoneResult) {
            await sendSMS({
              to: lgPhoneResult.phone_number,
              message: lgTokenTransferredSMS(input.customerId),
            });

            logger.info(
              {
                lgCustomerId: input.lgCustomerId.slice(-4),
                customerId: input.customerId.slice(-4),
              },
              "Sent token transfer SMS to LG"
            );
          } else {
            logger.warn(
              { lgCustomerId: input.lgCustomerId.slice(-4) },
              "No phone number found for LG - SMS not sent"
            );
          }
        } catch (smsError) {
          // Log SMS error but don't fail the transaction
          logger.error(
            {
              error:
                smsError instanceof Error ? smsError.message : String(smsError),
              lgCustomerId: input.lgCustomerId.slice(-4),
            },
            "Failed to send SMS to LG - transaction still successful"
          );
        }

        logger.info(
          {
            customerId: input.customerId.slice(-4),
            claimId,
            transactionHash: evaluationResult.transactionHash,
          },
          "Receipt confirmation and claim evaluation completed successfully"
        );

        return {
          success: true,
          receivedBeans: true,
          claimEvaluated: true,
          transactionHash: evaluationResult.transactionHash,
        };
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
    pin: input?.pin || "",
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
          [{ target: "fetchingDeliveryConfirmation", guard: "isInput1" }],
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

    fetchingDeliveryConfirmation: {
      entry: assign(() => ({
        message: "Checking your delivery status...",
      })),
      invoke: {
        src: "fetchDeliveryConfirmationService",
        input: ({ context }) => ({
          customerId: context.customerId,
        }),
        onDone: {
          target: "confirmReceiptQuestion",
          actions: assign({
            lgCustomerId: ({ event }) => event.output.lgCustomerId,
          }),
        },
        onError: {
          target: "error",
          actions: assign({
            error: ({ event }) => {
              const errorMessage =
                event.error instanceof Error
                  ? event.error.message
                  : "Failed to fetch delivery confirmation";
              logger.error(
                { error: errorMessage },
                "Error in fetchDeliveryConfirmationService"
              );
              return `${errorMessage}\n\n1. Back`;
            },
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
        src: "submitReceiptAndEvaluateClaimService",
        input: ({ context, event }) => {
          if (!context.lgCustomerId) {
            throw new Error("LG Customer ID not found in context");
          }

          return {
            customerId: context.customerId,
            lgCustomerId: context.lgCustomerId,
            receivedBeans: event.type === "INPUT" && event.input.trim() === "1",
          };
        },
        onDone: {
          target: "receiptSubmitted",
          actions: assign({
            message: ({ event }) => {
              const result = event.output;
              if (result.receivedBeans && result.claimEvaluated) {
                return "Thank you for confirming receipt!\n\nPayment has been released to your Lead Generator.\n\n1. Continue";
              } else if (!result.receivedBeans) {
                return "Your response has been recorded.\n\nPlease contact your Lead Generator if there are any issues.\n\n1. Continue";
              } else {
                return "Thank you for your confirmation.\n\n1. Continue";
              }
            },
          }),
        },
        onError: {
          target: "error",
          actions: assign({
            error: ({ event }) => {
              const errorMessage =
                event.error instanceof Error
                  ? event.error.message
                  : "Failed to submit confirmation";
              logger.error(
                { error: errorMessage },
                "Error in submitReceiptAndEvaluateClaimService"
              );
              return `${errorMessage}\n\nPlease try again or contact support.\n\n1. Back`;
            },
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
