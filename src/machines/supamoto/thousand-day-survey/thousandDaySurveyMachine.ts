/**
 * 1,000 Day Household Survey Machine
 *
 * Handles the USSD survey flow for collecting household eligibility data
 * Collected by Lead Generators (LG) for customers
 * Supports session interruption recovery and conditional question visibility
 *
 * Flow:
 * 1. Create household claim record
 * 2. Recover session if exists
 * 3. Present questions one at a time
 * 4. Save each answer to database (encrypted)
 * 5. Handle conditional visibility (child age)
 * 6. Handle multi-part questions (5 nutritional benefits)
 * 7. Submit claim to blockchain
 * 8. Return to parent machine
 */

import { setup, assign, fromPromise } from "xstate";
import { withNavigation } from "../utils/navigation-mixin.js";
import { navigationGuards } from "../guards/navigation.guards.js";
import { createModuleLogger } from "../../../services/logger.js";
import { dataService } from "../../../services/database-storage.js";
import { surveyResponseStorageService } from "../../../services/survey-response-storage.js";
import { submit1000DayHouseholdClaim } from "../../../services/claims-bot.js";
import {
  validateCustomerId,
  validateBeneficiaryCategory,
  validateChildAge,
  validateBeanIntakeFrequency,
  validatePriceSpecification,
  validateYesNo,
  validateNutritionalBenefit,
} from "./survey-validators.js";
import {
  mapBeneficiaryCategory,
  mapChildAge,
  mapBeanIntakeFrequency,
  mapPriceSpecification,
  mapYesNo,
  mapNutritionalBenefits,
  mapAntenatalCardVerified,
  shouldShowChildAgeQuestion,
} from "./survey-mappers.js";

const logger = createModuleLogger("thousandDaySurvey");

// Types and Interfaces
export interface ThousandDaySurveyContext {
  sessionId: string;
  phoneNumber: string; // LG's phone number
  serviceCode: string;
  lgCustomerId: string; // Lead Generator's customer ID
  customerId: string; // Customer being surveyed (entered during survey)
  message: string;
  error?: string;
  // Survey state
  claimId?: number; // Created at start of survey
  // Survey answers
  beneficiaryCategory?: string[]; // Array of selected categories
  childAge?: number; // Conditional - only if child_below_2_years selected
  beanIntakeFrequency?: string;
  priceSpecification?: string;
  awarenessIronBeans?: string;
  knowsNutritionalBenefits?: string;
  // Multi-part nutritional benefits (5 questions)
  nutritionalBenefit1?: string; // Temporary storage for multi-part question
  nutritionalBenefit2?: string;
  nutritionalBenefit3?: string;
  nutritionalBenefit4?: string;
  nutritionalBenefit5?: string;
  nutritionalBenefitDetails?: string[]; // Final array after all 5 answered
  antenatalCardVerified?: boolean;
}

export interface ThousandDaySurveyInput {
  sessionId: string;
  phoneNumber: string; // LG's phone number
  serviceCode: string;
  lgCustomerId: string; // Lead Generator's customer ID
}

export type ThousandDaySurveyEvent =
  | { type: "INPUT"; input: string }
  | { type: "ERROR"; error: string };

export enum ThousandDaySurveyOutput {
  COMPLETE = "COMPLETE",
  CANCELLED = "CANCELLED",
  ERROR = "ERROR",
}

// Service definitions
const validateCustomerExistsService = fromPromise(
  async ({ input }: { input: { customerId: string } }) => {
    logger.info(
      { customerId: input.customerId.slice(-4) },
      "Validating customer exists in database"
    );

    const customer = await dataService.getCustomerByCustomerId(
      input.customerId
    );

    if (!customer) {
      throw new Error(
        `Customer ID ${input.customerId} not found in the system. Please verify the Customer ID.`
      );
    }

    logger.info(
      {
        customerId: input.customerId.slice(-4),
        customerName: customer.fullName,
      },
      "Customer validated successfully"
    );

    return { customer };
  }
);

const createClaimService = fromPromise(
  async ({
    input,
  }: {
    input: {
      lgCustomerId: string;
      customerId: string;
    };
  }) => {
    logger.info(
      {
        lgCustomerId: input.lgCustomerId.slice(-4),
        customerId: input.customerId.slice(-4),
      },
      "Checking for existing household claim for 1,000 Day Survey"
    );

    try {
      // Check if a claim already exists for this LG/Customer combination
      const existingClaim = await dataService.getClaimByLgAndCustomer(
        input.lgCustomerId,
        input.customerId
      );

      if (existingClaim) {
        logger.info(
          {
            claimId: existingClaim.id,
            lgCustomerId: input.lgCustomerId.slice(-4),
            customerId: input.customerId.slice(-4),
          },
          "Existing household claim found - reusing claim"
        );

        return { claimId: existingClaim.id };
      }

      // No existing claim - create a new one
      logger.info(
        {
          lgCustomerId: input.lgCustomerId.slice(-4),
          customerId: input.customerId.slice(-4),
        },
        "No existing claim found - creating new household claim"
      );

      const claim = await dataService.createHouseholdClaim(
        input.lgCustomerId,
        input.customerId,
        true // is1000DayHousehold
      );

      logger.info(
        {
          claimId: claim.id,
          lgCustomerId: input.lgCustomerId.slice(-4),
          customerId: input.customerId.slice(-4),
        },
        "Household claim created successfully"
      );

      return { claimId: claim.id };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          lgCustomerId: input.lgCustomerId.slice(-4),
          customerId: input.customerId.slice(-4),
        },
        "Failed to create household claim in survey machine"
      );

      // Re-throw with more context
      if (
        error instanceof Error &&
        error.message.includes("violates foreign key constraint")
      ) {
        throw new Error(
          `Customer ID ${input.customerId} not found in the system. Please verify the Customer ID.`
        );
      }

      throw error;
    }
  }
);

const recoverSessionService = fromPromise(
  async ({
    input,
  }: {
    input: {
      lgCustomerId: string;
      customerId: string;
    };
  }) => {
    logger.info(
      {
        lgCustomerId: input.lgCustomerId.slice(-4),
        customerId: input.customerId.slice(-4),
      },
      "Recovering survey session"
    );

    const surveyState =
      await surveyResponseStorageService.getSurveyResponseState(
        input.lgCustomerId,
        input.customerId
      );

    return surveyState;
  }
);

const initializeSurveySessionService = fromPromise(
  async ({
    input,
  }: {
    input: {
      lgCustomerId: string;
      customerId: string;
    };
  }) => {
    const { lgCustomerId, customerId: inputIdentifier } = input;

    // 1. Validate customer exists using either Customer ID or National ID
    // getCustomerByIdentifier handles both formats and normalizes Customer ID to uppercase
    const customer = await dataService.getCustomerByIdentifier(inputIdentifier);
    if (!customer) {
      throw new Error(
        `Customer ID or National ID ${inputIdentifier} not found in the system. Please verify the identifier.`
      );
    }

    // Use the resolved Customer ID from the database (always uppercase)
    const resolvedCustomerId = customer.customerId;

    logger.info(
      {
        inputIdentifier: inputIdentifier.slice(-4),
        resolvedCustomerId: resolvedCustomerId.slice(-4),
      },
      "Customer found - resolved identifier to Customer ID"
    );

    // 2. Get or create household claim (reuse semantics from createClaimService)
    const existingClaim = await dataService.getClaimByLgAndCustomer(
      lgCustomerId,
      resolvedCustomerId
    );

    let claimId: number;
    if (existingClaim) {
      logger.info(
        {
          claimId: existingClaim.id,
          lgCustomerId: lgCustomerId.slice(-4),
          customerId: resolvedCustomerId.slice(-4),
        },
        "Existing household claim found - reusing claim (initializeSession)"
      );
      claimId = existingClaim.id;
    } else {
      logger.info(
        {
          lgCustomerId: lgCustomerId.slice(-4),
          customerId: resolvedCustomerId.slice(-4),
        },
        "No existing claim found - creating new household claim (initializeSession)"
      );

      const claim = await dataService.createHouseholdClaim(
        lgCustomerId,
        resolvedCustomerId,
        true // is1000DayHousehold
      );

      claimId = claim.id;
    }

    // 3. Recover session state (same behavior as recoverSessionService)
    const surveyState =
      await surveyResponseStorageService.getSurveyResponseState(
        lgCustomerId,
        resolvedCustomerId
      );

    // Return the resolved Customer ID so it can be stored in context
    return { claimId, surveyState, resolvedCustomerId };
  }
);

const saveAnswerService = fromPromise(
  async ({
    input,
  }: {
    input: {
      lgCustomerId: string;
      customerId: string;
      questionName: string;
      answer: any;
    };
  }) => {
    logger.info(
      {
        lgCustomerId: input.lgCustomerId.slice(-4),
        customerId: input.customerId.slice(-4),
        questionName: input.questionName,
      },
      "Saving survey answer"
    );

    await surveyResponseStorageService.saveSurveyAnswer(
      input.lgCustomerId,
      input.customerId,
      input.questionName,
      input.answer
    );
  }
);

const saveMultipleAnswersService = fromPromise(
  async ({
    input,
  }: {
    input: {
      lgCustomerId: string;
      customerId: string;
      answers: Record<string, any>;
    };
  }) => {
    logger.info(
      {
        lgCustomerId: input.lgCustomerId.slice(-4),
        customerId: input.customerId.slice(-4),
        answerCount: Object.keys(input.answers).length,
      },
      "Saving multiple survey answers"
    );

    await surveyResponseStorageService.saveSurveyAnswers(
      input.lgCustomerId,
      input.customerId,
      input.answers
    );
  }
);

const markCompleteService = fromPromise(
  async ({
    input,
  }: {
    input: {
      lgCustomerId: string;
      customerId: string;
    };
  }) => {
    logger.info(
      {
        lgCustomerId: input.lgCustomerId.slice(-4),
        customerId: input.customerId.slice(-4),
      },
      "Marking survey as complete"
    );

    await surveyResponseStorageService.markSurveyComplete(
      input.lgCustomerId,
      input.customerId
    );
  }
);

const submitClaimService = fromPromise(
  async ({
    input,
  }: {
    input: {
      claimId: number;
      lgCustomerId: string;
      customerId: string;
      beneficiaryCategory: string[];
      childAge?: number;
      beanIntakeFrequency: string;
      priceSpecification: string;
      awarenessIronBeans: string;
      knowsNutritionalBenefits: string;
      nutritionalBenefitDetails: string[];
      antenatalCardVerified: boolean;
    };
  }) => {
    logger.info(
      {
        claimId: input.claimId,
        lgCustomerId: input.lgCustomerId.slice(-4),
        customerId: input.customerId.slice(-4),
      },
      "Submitting 1,000 Day Household claim to claims bot"
    );

    try {
      // Get customer and LG records to retrieve Claims Bot customer IDs
      const customer = await dataService.getCustomerByCustomerId(
        input.customerId
      );
      const lgCustomer = await dataService.getCustomerByCustomerId(
        input.lgCustomerId
      );

      if (!customer) {
        throw new Error(`Customer ${input.customerId} not found`);
      }
      if (!lgCustomer) {
        throw new Error(`Lead Generator ${input.lgCustomerId} not found`);
      }

      // Use Claims Bot customer IDs if available, otherwise fall back to regular customer IDs
      const claimsBotCustomerId =
        customer.claimsBotCustomerId || customer.customerId;
      const claimsBotLgId =
        lgCustomer.claimsBotCustomerId || lgCustomer.customerId;

      logger.info(
        {
          customerId: input.customerId.slice(-4),
          claimsBotCustomerId: claimsBotCustomerId.slice(-4),
          lgCustomerId: input.lgCustomerId.slice(-4),
          claimsBotLgId: claimsBotLgId.slice(-4),
        },
        "Resolved Claims Bot customer IDs for claim submission"
      );

      // Submit claim to claims bot
      const response = await submit1000DayHouseholdClaim({
        leadGeneratorId: claimsBotLgId,
        customerId: claimsBotCustomerId,
        beneficiaryCategory: input.beneficiaryCategory,
        childMaxAge: input.childAge,
        beanIntakeFrequency: input.beanIntakeFrequency,
        priceSpecification: input.priceSpecification,
        awarenessIronBeans: input.awarenessIronBeans,
        knowsNutritionalBenefits: input.knowsNutritionalBenefits,
        nutritionalBenefitDetails: input.nutritionalBenefitDetails,
        antenatalCardVerified: input.antenatalCardVerified,
      });

      // Update household claim with blockchain response
      await dataService.updateHouseholdClaim(input.claimId, {
        claimStatus: "PROCESSED",
        claimProcessedAt: new Date(),
        claimsBotResponse: response as any, // Store the full response
      });

      logger.info(
        {
          claimId: input.claimId,
          blockchainClaimId: response.data.claimId,
        },
        "Claim submitted successfully to claims bot"
      );

      return {
        success: true,
        blockchainClaimId: response.data.claimId,
      };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          claimId: input.claimId,
        },
        "Failed to submit claim to claims bot"
      );

      // Update claim status to FAILED
      await dataService.updateHouseholdClaim(input.claimId, {
        claimStatus: "FAILED",
        claimsBotResponse: {
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        } as any,
      });

      throw error;
    }
  }
);

export const thousandDaySurveyMachine = setup({
  types: {
    context: {} as ThousandDaySurveyContext,
    events: {} as ThousandDaySurveyEvent,
    input: {} as ThousandDaySurveyInput,
  },
  guards: {
    isValidCustomerId: ({ event }) => {
      if (event.type !== "INPUT") {
        return false;
      }
      const validation = validateCustomerId(event.input);
      return validation.valid;
    },
    isValidBeneficiaryCategory: ({ event }) => {
      if (event.type !== "INPUT") return false;
      return validateBeneficiaryCategory(event.input).valid;
    },
    isValidChildAge: ({ event }) => {
      if (event.type !== "INPUT") return false;
      return validateChildAge(event.input).valid;
    },
    isValidBeanIntakeFrequency: ({ event }) => {
      if (event.type !== "INPUT") return false;
      return validateBeanIntakeFrequency(event.input).valid;
    },
    isValidPriceSpecification: ({ event }) => {
      if (event.type !== "INPUT") return false;
      return validatePriceSpecification(event.input).valid;
    },
    isValidYesNo: ({ event }) => {
      if (event.type !== "INPUT") return false;
      return validateYesNo(event.input).valid;
    },
    shouldShowChildAge: ({ context }) => {
      return (
        context.beneficiaryCategory !== undefined &&
        shouldShowChildAgeQuestion(context.beneficiaryCategory)
      );
    },
    shouldShowBeanFrequency: ({ context }) => {
      return (
        context.beneficiaryCategory !== undefined &&
        shouldShowChildAgeQuestion(context.beneficiaryCategory)
      );
    },
    // Session recovery guards - check if questions have been answered
    hasBeneficiaryCategory: ({ context }) =>
      context.beneficiaryCategory !== undefined &&
      context.beneficiaryCategory !== null &&
      (Array.isArray(context.beneficiaryCategory)
        ? context.beneficiaryCategory.length > 0
        : true),
    hasChildAge: ({ context }) =>
      context.childAge !== undefined && context.childAge !== null,
    hasBeanIntakeFrequency: ({ context }) =>
      context.beanIntakeFrequency !== undefined &&
      context.beanIntakeFrequency !== null &&
      context.beanIntakeFrequency !== "",
    hasPriceSpecification: ({ context }) =>
      context.priceSpecification !== undefined &&
      context.priceSpecification !== null &&
      context.priceSpecification !== "",
    hasAwarenessIronBeans: ({ context }) =>
      context.awarenessIronBeans !== undefined &&
      context.awarenessIronBeans !== null &&
      context.awarenessIronBeans !== "",
    hasKnowsNutritionalBenefits: ({ context }) =>
      context.knowsNutritionalBenefits !== undefined &&
      context.knowsNutritionalBenefits !== null &&
      context.knowsNutritionalBenefits !== "",
    hasNutritionalBenefits: ({ context }) =>
      context.nutritionalBenefitDetails !== undefined &&
      context.nutritionalBenefitDetails !== null &&
      (Array.isArray(context.nutritionalBenefitDetails)
        ? context.nutritionalBenefitDetails.length > 0
        : true),
    hasAntenatalCardVerified: ({ context }) =>
      context.antenatalCardVerified !== undefined &&
      context.antenatalCardVerified !== null,
    // Navigation guards
    isBack: ({ event }) =>
      navigationGuards.isBackCommand(null as any, event as any),
    isExit: ({ event }) =>
      navigationGuards.isExitCommand(null as any, event as any),
  },
  actors: {
    createClaimService,
    validateCustomerExistsService,
    recoverSessionService,
    initializeSurveySessionService,
    saveAnswerService,
    saveMultipleAnswersService,
    markCompleteService,
    submitClaimService,
  },
  actions: {
    clearErrors: assign({
      error: undefined,
    }),
    setError: assign({
      error: ({ event }) =>
        event.type === "ERROR" ? event.error : "An unexpected error occurred",
    }),
    // Fire-and-forget save actions - save in background without blocking user flow
    saveAnswerFireAndForget: (
      { context },
      params: { questionName: string; answer: any }
    ) => {
      // Fire-and-forget: Don't await, let it run in background
      surveyResponseStorageService
        .saveSurveyAnswer(
          context.lgCustomerId,
          context.customerId,
          params.questionName,
          params.answer
        )
        .catch(error => {
          logger.error(
            {
              error: error instanceof Error ? error.message : String(error),
              lgCustomerId: context.lgCustomerId?.slice(-4),
              customerId: context.customerId?.slice(-4),
              questionName: params.questionName,
            },
            "Fire-and-forget save failed (non-fatal)"
          );
        });
    },
    saveMultipleAnswersFireAndForget: (
      { context },
      params: { answers: Record<string, any> }
    ) => {
      // Fire-and-forget: Don't await, let it run in background
      surveyResponseStorageService
        .saveSurveyAnswers(
          context.lgCustomerId,
          context.customerId,
          params.answers
        )
        .catch(error => {
          logger.error(
            {
              error: error instanceof Error ? error.message : String(error),
              lgCustomerId: context.lgCustomerId?.slice(-4),
              customerId: context.customerId?.slice(-4),
              answerCount: Object.keys(params.answers).length,
            },
            "Fire-and-forget save multiple failed (non-fatal)"
          );
        });
    },
    // Note: submitClaimFireAndForget removed - claim submission requires all survey data
    // and should remain as a blocking operation to ensure data integrity
  },
}).createMachine({
  id: "thousandDaySurvey",
  initial: "askCustomerId",
  context: ({ input }): ThousandDaySurveyContext => ({
    sessionId: input?.sessionId || "",
    phoneNumber: input?.phoneNumber || "",
    serviceCode: input?.serviceCode || "",
    lgCustomerId: input?.lgCustomerId || "",
    customerId: "",
    message: "",
  }),
  output: ({ context }) => ({
    result: ThousandDaySurveyOutput.COMPLETE,
    customerId: context.customerId,
  }),
  states: {
    // State definitions will be added in the next part
    askCustomerId: {
      entry: assign(() => ({
        message:
          "A Lead Generator completes this survey on behalf of a Customer.\nEnter the Customer ID or National ID on whose behalf you are completing the survey.\n\n0. Back to Agent Tools",
      })),
      on: {
        INPUT: withNavigation(
          [
            {
              target: "initializingSession",
              guard: "isValidCustomerId",
              actions: assign({
                customerId: ({ event }) => {
                  // Store the raw input - will be resolved to actual Customer ID in initializingSession
                  const id = event.type === "INPUT" ? event.input : "";
                  return id;
                },
              }),
            },
            {
              target: "askCustomerId",
              actions: assign({
                message: ({ event }) => {
                  if (event.type !== "INPUT") return "";
                  const validation = validateCustomerId(event.input);
                  return `${validation.error}\n\nPlease try again.\n\n0. Back to Agent Tools`;
                },
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
      },
    },

    initializingSession: {
      // Internal state: validate customer, create/reuse claim, recover any existing answers
      entry: assign(() => ({
        message: "Processing...",
      })),
      invoke: {
        id: "initializeSurveySession",
        src: "initializeSurveySessionService",
        input: ({ context }) => ({
          lgCustomerId: context.lgCustomerId,
          customerId: context.customerId,
        }),
        onDone: {
          target: "routeAfterInitialization",
          actions: assign({
            // Store the resolved Customer ID (normalized to uppercase)
            customerId: ({ event }) => event.output.resolvedCustomerId,
            claimId: ({ event }) => event.output.claimId,
            // Populate context with recovered answers if they exist
            beneficiaryCategory: ({ event }) =>
              event.output?.surveyState?.answers?.["ecs:beneficiaryCategory"],
            childAge: ({ event }) =>
              event.output?.surveyState?.answers?.["schema:childMaxAge"],
            beanIntakeFrequency: ({ event }) =>
              event.output?.surveyState?.answers?.["ecs:beanIntakeFrequency"],
            priceSpecification: ({ event }) =>
              event.output?.surveyState?.answers?.["schema:priceSpecification"],
            awarenessIronBeans: ({ event }) =>
              event.output?.surveyState?.answers?.["ecs:awarenessIronBeans"],
            knowsNutritionalBenefits: ({ event }) =>
              event.output?.surveyState?.answers?.[
                "ecs:knowsNutritionalBenefits"
              ],
            nutritionalBenefitDetails: ({ event }) =>
              event.output?.surveyState?.answers?.[
                "ecs:nutritionalBenefitDetails"
              ],
            antenatalCardVerified: ({ event }) =>
              event.output?.surveyState?.answers?.[
                "ecs:confirmAction_antenatal_card_verified"
              ],
          }),
        },
        onError: [
          {
            // Customer not found in validation step
            target: "invalidCustomer",
            guard: ({ event }) => {
              const msg =
                event.error instanceof Error
                  ? event.error.message
                  : String(event.error);
              return msg.includes("not found in the system");
            },
            actions: assign({
              error: ({ event }) =>
                event.error instanceof Error
                  ? event.error.message
                  : String(event.error),
            }),
          },
          {
            target: "systemError",
            actions: assign({
              error: ({ event }) =>
                event.error instanceof Error
                  ? event.error.message
                  : String(event.error),
            }),
          },
        ],
      },
    },

    routeAfterInitialization: {
      // Pure routing state after session initialization completes.
      // Uses recovered answers (if any) to resume at the correct question.
      always: [
        // Session recovery routing - evaluated in reverse question order
        // Routes to the first unanswered question in the survey sequence
        {
          target: "askAntenatalCardVerified",
          guard: "hasAntenatalCardVerified",
          actions: () => {
            logger.info(
              "Session recovery: Antenatal card already verified, showing last question"
            );
          },
        },
        {
          target: "askAntenatalCardVerified",
          guard: "hasNutritionalBenefits",
          actions: () => {
            logger.info(
              "Session recovery: Nutritional benefits answered, resuming at antenatal card question"
            );
          },
        },
        {
          target: "askNutritionalBenefit1",
          guard: "hasKnowsNutritionalBenefits",
          actions: () => {
            logger.info(
              "Session recovery: Knows nutritional benefits answered, resuming at multi-part question 1"
            );
          },
        },
        {
          target: "askKnowsNutritionalBenefits",
          guard: "hasAwarenessIronBeans",
          actions: () => {
            logger.info(
              "Session recovery: Awareness iron beans answered, resuming at knows nutritional benefits"
            );
          },
        },
        {
          target: "askAwarenessIronBeans",
          guard: "hasPriceSpecification",
          actions: () => {
            logger.info(
              "Session recovery: Price specification answered, resuming at awareness iron beans"
            );
          },
        },
        {
          target: "askPriceSpecification",
          guard: "hasBeanIntakeFrequency",
          actions: () => {
            logger.info(
              "Session recovery: Bean intake frequency answered, resuming at price specification"
            );
          },
        },
        {
          target: "askBeanIntakeFrequency",
          guard: "hasChildAge",
          actions: () => {
            logger.info(
              "Session recovery: Child age answered, resuming at bean intake frequency"
            );
          },
        },
        {
          target: "askChildAge",
          guard: ({ context }: { context: ThousandDaySurveyContext }) =>
            context.beneficiaryCategory !== undefined &&
            context.beneficiaryCategory !== null &&
            (Array.isArray(context.beneficiaryCategory)
              ? context.beneficiaryCategory.length > 0
              : true) &&
            shouldShowChildAgeQuestion(context.beneficiaryCategory),
          actions: () => {
            logger.info(
              "Session recovery: Beneficiary category answered (child selected), resuming at child age"
            );
          },
        },
        {
          target: "askPriceSpecification",
          guard: "hasBeneficiaryCategory",
          actions: () => {
            logger.info(
              "Session recovery: Beneficiary category answered (no child), resuming at price specification"
            );
          },
        },
        {
          target: "askBeneficiaryCategory",
          actions: () => {
            logger.info(
              "Session recovery: No previous answers found, starting from beginning"
            );
          },
        },
      ],
    },

    askBeneficiaryCategory: {
      entry: assign(() => ({
        message:
          "Select all TRUE options for your household\nA: Pregnant Woman\nB: Breastfeeding Mother\nC: Child under 2 years\n\n1. A\n2. B\n3. C\n4. A + B\n5. A + C\n6. B + C\n7. All\n8. None\n\n0. Back",
      })),
      on: {
        INPUT: withNavigation(
          [
            {
              target: "askChildAge",
              guard: ({ event }: { event: ThousandDaySurveyEvent }) => {
                if (event.type !== "INPUT") return false;
                if (!validateBeneficiaryCategory(event.input).valid)
                  return false;
                // Check if child age should be shown after assigning the answer
                const category = mapBeneficiaryCategory(event.input);
                return shouldShowChildAgeQuestion(category);
              },
              actions: [
                assign({
                  beneficiaryCategory: ({ event }) =>
                    event.type === "INPUT"
                      ? mapBeneficiaryCategory(event.input)
                      : [],
                }),
                ({
                  context,
                  event,
                }: {
                  context: ThousandDaySurveyContext;
                  event: ThousandDaySurveyEvent;
                }) => {
                  // Fire-and-forget save - use event value directly
                  if (event.type === "INPUT") {
                    const answer = mapBeneficiaryCategory(event.input);
                    surveyResponseStorageService
                      .saveSurveyAnswer(
                        context.lgCustomerId,
                        context.customerId,
                        "ecs:beneficiaryCategory",
                        answer
                      )
                      .catch(() => {
                        /* ignore errors */
                      });
                  }
                },
              ],
            },
            {
              target: "askPriceSpecification",
              guard: ({ event }: { event: ThousandDaySurveyEvent }) => {
                if (event.type !== "INPUT") return false;
                if (!validateBeneficiaryCategory(event.input).valid)
                  return false;
                // Check if child age should NOT be shown (no child in household)
                const category = mapBeneficiaryCategory(event.input);
                return !shouldShowChildAgeQuestion(category);
              },
              actions: [
                assign({
                  beneficiaryCategory: ({ event }) =>
                    event.type === "INPUT"
                      ? mapBeneficiaryCategory(event.input)
                      : [],
                }),
                ({
                  context,
                  event,
                }: {
                  context: ThousandDaySurveyContext;
                  event: ThousandDaySurveyEvent;
                }) => {
                  // Fire-and-forget save - use event value directly
                  if (event.type === "INPUT") {
                    const answer = mapBeneficiaryCategory(event.input);
                    surveyResponseStorageService
                      .saveSurveyAnswer(
                        context.lgCustomerId,
                        context.customerId,
                        "ecs:beneficiaryCategory",
                        answer
                      )
                      .catch(() => {
                        /* ignore errors */
                      });
                  }
                },
              ],
            },
            {
              target: "askBeneficiaryCategory",
              actions: assign({
                message: ({ event }) => {
                  if (event.type !== "INPUT") return "";
                  const validation = validateBeneficiaryCategory(event.input);
                  return `${validation.error}\n\nPlease try again.\n\n0. Back`;
                },
              }),
            },
          ],
          {
            backTarget: "askCustomerId",
            exitTarget: "routeToMain",
            enableBack: true,
            enableExit: true,
          }
        ),
      },
    },

    askChildAge: {
      entry: assign(() => ({
        message: "What is the child's age in months?\n\n0. Back",
      })),
      on: {
        INPUT: withNavigation(
          [
            {
              target: "askBeanIntakeFrequency",
              guard: "isValidChildAge",
              actions: [
                assign({
                  childAge: ({ event }) =>
                    event.type === "INPUT"
                      ? mapChildAge(event.input)
                      : undefined,
                }),
                ({
                  context,
                  event,
                }: {
                  context: ThousandDaySurveyContext;
                  event: ThousandDaySurveyEvent;
                }) => {
                  // Fire-and-forget save - use event value directly
                  if (event.type === "INPUT") {
                    const answer = mapChildAge(event.input);
                    surveyResponseStorageService
                      .saveSurveyAnswer(
                        context.lgCustomerId,
                        context.customerId,
                        "schema:childMaxAge",
                        answer
                      )
                      .catch(() => {
                        /* ignore errors */
                      });
                  }
                },
              ],
            },
            {
              target: "askChildAge",
              actions: assign({
                message: ({ event }) => {
                  if (event.type !== "INPUT") return "";
                  const validation = validateChildAge(event.input);
                  return `${validation.error}\n\nPlease try again.\n\n0. Back`;
                },
              }),
            },
          ],
          {
            backTarget: "askBeneficiaryCategory",
            exitTarget: "routeToMain",
            enableBack: true,
            enableExit: true,
          }
        ),
      },
    },

    askBeanIntakeFrequency: {
      entry: assign(() => ({
        message:
          "How many times a week does the child eat beans?\n\n1. None at all\n2. 1–2 times a week\n3. 3–4 times a week\n4. 5–6 times a week\n5. Daily\n\n0. Back",
      })),
      on: {
        INPUT: withNavigation(
          [
            {
              target: "askPriceSpecification",
              guard: "isValidBeanIntakeFrequency",
              actions: [
                assign({
                  beanIntakeFrequency: ({ event }) =>
                    event.type === "INPUT"
                      ? mapBeanIntakeFrequency(event.input)
                      : "",
                }),
                ({
                  context,
                  event,
                }: {
                  context: ThousandDaySurveyContext;
                  event: ThousandDaySurveyEvent;
                }) => {
                  // Fire-and-forget save - use event value directly
                  if (event.type === "INPUT") {
                    const answer = mapBeanIntakeFrequency(event.input);
                    surveyResponseStorageService
                      .saveSurveyAnswer(
                        context.lgCustomerId,
                        context.customerId,
                        "ecs:beanIntakeFrequency",
                        answer
                      )
                      .catch(() => {
                        /* ignore errors */
                      });
                  }
                },
              ],
            },
            {
              target: "askBeanIntakeFrequency",
              actions: assign({
                message: ({ event }) => {
                  if (event.type !== "INPUT") return "";
                  const validation = validateBeanIntakeFrequency(event.input);
                  return `${validation.error}\n\nPlease try again.\n\n0. Back`;
                },
              }),
            },
          ],
          {
            backTarget: "askChildAge",
            exitTarget: "routeToMain",
            enableBack: true,
            enableExit: true,
          }
        ),
      },
    },

    askPriceSpecification: {
      entry: assign(() => ({
        message:
          "How much are you willing to pay for a 1 kg bag of beans? (ZMW)\n\n0. Back",
      })),
      on: {
        INPUT: [
          // Exit navigation (*)
          {
            target: "routeToMain",
            guard: ({ event }: { event: ThousandDaySurveyEvent }) =>
              event.type === "INPUT" && event.input === "*",
          },
          // Conditional back navigation (0)
          // If child exists (beanIntakeFrequency was answered), go back to askBeanIntakeFrequency
          // Otherwise, go back to askBeneficiaryCategory
          {
            target: "askBeanIntakeFrequency",
            guard: ({
              event,
              context,
            }: {
              event: ThousandDaySurveyEvent;
              context: ThousandDaySurveyContext;
            }) =>
              event.type === "INPUT" &&
              event.input === "0" &&
              context.beanIntakeFrequency !== undefined &&
              context.beanIntakeFrequency !== null,
          },
          {
            target: "askBeneficiaryCategory",
            guard: ({ event }: { event: ThousandDaySurveyEvent }) =>
              event.type === "INPUT" && event.input === "0",
          },
          // Valid price input
          {
            target: "askAwarenessIronBeans",
            guard: "isValidPriceSpecification",
            actions: [
              assign({
                priceSpecification: ({ event }) =>
                  event.type === "INPUT"
                    ? mapPriceSpecification(event.input)
                    : "",
              }),
              ({
                context,
                event,
              }: {
                context: ThousandDaySurveyContext;
                event: ThousandDaySurveyEvent;
              }) => {
                // Fire-and-forget save - use event value directly
                if (event.type === "INPUT") {
                  const answer = mapPriceSpecification(event.input);
                  surveyResponseStorageService
                    .saveSurveyAnswer(
                      context.lgCustomerId,
                      context.customerId,
                      "schema:priceSpecification",
                      answer
                    )
                    .catch(() => {
                      /* ignore errors */
                    });
                }
              },
            ],
          },
          // Invalid input - show error
          {
            target: "askPriceSpecification",
            actions: assign({
              message: ({ event }) => {
                if (event.type !== "INPUT") return "";
                const validation = validatePriceSpecification(event.input);
                return `${validation.error}\n\nPlease try again.\n\n0. Back`;
              },
            }),
          },
        ],
      },
    },

    askAwarenessIronBeans: {
      entry: assign(() => ({
        message:
          "Have you ever heard about iron-fortified beans (mbereshi beans)?\n\n1. Yes\n2. No\n\n0. Back",
      })),
      on: {
        INPUT: withNavigation(
          [
            {
              target: "askKnowsNutritionalBenefits",
              guard: "isValidYesNo",
              actions: [
                assign({
                  awarenessIronBeans: ({ event }) =>
                    event.type === "INPUT" ? mapYesNo(event.input) : "",
                }),
                ({
                  context,
                  event,
                }: {
                  context: ThousandDaySurveyContext;
                  event: ThousandDaySurveyEvent;
                }) => {
                  // Fire-and-forget save - use event value directly
                  if (event.type === "INPUT") {
                    const answer = mapYesNo(event.input);
                    surveyResponseStorageService
                      .saveSurveyAnswer(
                        context.lgCustomerId,
                        context.customerId,
                        "ecs:awarenessIronBeans",
                        answer
                      )
                      .catch(() => {
                        /* ignore errors */
                      });
                  }
                },
              ],
            },
            {
              target: "askAwarenessIronBeans",
              actions: assign({
                message: ({ event }) => {
                  if (event.type !== "INPUT") return "";
                  const validation = validateYesNo(event.input);
                  return `${validation.error}\n\nPlease try again.\n\n0. Back`;
                },
              }),
            },
          ],
          {
            backTarget: "askPriceSpecification",
            exitTarget: "routeToMain",
            enableBack: true,
            enableExit: true,
          }
        ),
      },
    },

    askKnowsNutritionalBenefits: {
      entry: assign(() => ({
        message:
          "Do you know any nutritional benefits of iron-fortified beans (mbereshi beans)?\n\n1. Yes\n2. No\n\n0. Back",
      })),
      on: {
        INPUT: withNavigation(
          [
            {
              target: "askNutritionalBenefit1",
              guard: "isValidYesNo",
              actions: [
                assign({
                  knowsNutritionalBenefits: ({ event }) =>
                    event.type === "INPUT" ? mapYesNo(event.input) : "",
                }),
                ({
                  context,
                  event,
                }: {
                  context: ThousandDaySurveyContext;
                  event: ThousandDaySurveyEvent;
                }) => {
                  // Fire-and-forget save - use event value directly
                  if (event.type === "INPUT") {
                    const answer = mapYesNo(event.input);
                    surveyResponseStorageService
                      .saveSurveyAnswer(
                        context.lgCustomerId,
                        context.customerId,
                        "ecs:knowsNutritionalBenefits",
                        answer
                      )
                      .catch(() => {
                        /* ignore errors */
                      });
                  }
                },
              ],
            },
            {
              target: "askKnowsNutritionalBenefits",
              actions: assign({
                message: ({ event }) => {
                  if (event.type !== "INPUT") return "";
                  const validation = validateYesNo(event.input);
                  return `${validation.error}\n\nPlease try again.\n\n0. Back`;
                },
              }),
            },
          ],
          {
            backTarget: "askAwarenessIronBeans",
            exitTarget: "routeToMain",
            enableBack: true,
            enableExit: true,
          }
        ),
      },
    },

    askNutritionalBenefit1: {
      entry: assign(() => ({
        message:
          "Do you think this is a nutritional benefit?\n(1 of 5)\nA: Improve iron status and help reduce iron deficiency/anemia.\n\n1. Yes\n2. No\n\n0. Back",
      })),
      on: {
        INPUT: withNavigation(
          [
            {
              target: "askNutritionalBenefit2",
              guard: "isValidYesNo",
              actions: assign({
                nutritionalBenefit1: ({ event }) =>
                  event.type === "INPUT" ? event.input : "",
              }),
            },
            {
              target: "askNutritionalBenefit1",
              actions: assign({
                message: ({ event }) => {
                  if (event.type !== "INPUT") return "";
                  const validation = validateNutritionalBenefit(event.input);
                  return `${validation.error}\n\nPlease try again.\n\n0. Back`;
                },
              }),
            },
          ],
          {
            backTarget: "askKnowsNutritionalBenefits",
            exitTarget: "routeToMain",
            enableBack: true,
            enableExit: true,
          }
        ),
      },
    },

    askNutritionalBenefit2: {
      entry: assign(() => ({
        message:
          "Do you think this is a nutritional benefit?\n(2 of 5)\nB: Support cognitive performance in iron-deficient individuals.\n\n1. Yes\n2. No\n\n0. Back",
      })),
      on: {
        INPUT: withNavigation(
          [
            {
              target: "askNutritionalBenefit3",
              guard: "isValidYesNo",
              actions: assign({
                nutritionalBenefit2: ({ event }) =>
                  event.type === "INPUT" ? event.input : "",
              }),
            },
            {
              target: "askNutritionalBenefit2",
              actions: assign({
                message: ({ event }) => {
                  if (event.type !== "INPUT") return "";
                  const validation = validateNutritionalBenefit(event.input);
                  return `${validation.error}\n\nPlease try again.\n\n0. Back`;
                },
              }),
            },
          ],
          {
            backTarget: "askNutritionalBenefit1",
            exitTarget: "routeToMain",
            enableBack: true,
            enableExit: true,
          }
        ),
      },
    },

    askNutritionalBenefit3: {
      entry: assign(() => ({
        message:
          "Do you think this is a nutritional benefit?\n(3 of 5)\nC: Enhance physical work capacity and reduce fatigue.\n\n1. Yes\n2. No\n\n0. Back",
      })),
      on: {
        INPUT: withNavigation(
          [
            {
              target: "askNutritionalBenefit4",
              guard: "isValidYesNo",
              actions: assign({
                nutritionalBenefit3: ({ event }) =>
                  event.type === "INPUT" ? event.input : "",
              }),
            },
            {
              target: "askNutritionalBenefit3",
              actions: assign({
                message: ({ event }) => {
                  if (event.type !== "INPUT") return "";
                  const validation = validateNutritionalBenefit(event.input);
                  return `${validation.error}\n\nPlease try again.\n\n0. Back`;
                },
              }),
            },
          ],
          {
            backTarget: "askNutritionalBenefit2",
            exitTarget: "routeToMain",
            enableBack: true,
            enableExit: true,
          }
        ),
      },
    },

    askNutritionalBenefit4: {
      entry: assign(() => ({
        message:
          "Do you think this is a nutritional benefit?\n(4 of 5)\nD: Provide higher iron (and often zinc) than standard bean varieties.\n\n1. Yes\n2. No\n\n0. Back",
      })),
      on: {
        INPUT: withNavigation(
          [
            {
              target: "askNutritionalBenefit5",
              guard: "isValidYesNo",
              actions: assign({
                nutritionalBenefit4: ({ event }) =>
                  event.type === "INPUT" ? event.input : "",
              }),
            },
            {
              target: "askNutritionalBenefit4",
              actions: assign({
                message: ({ event }) => {
                  if (event.type !== "INPUT") return "";
                  const validation = validateNutritionalBenefit(event.input);
                  return `${validation.error}\n\nPlease try again.\n\n0. Back`;
                },
              }),
            },
          ],
          {
            backTarget: "askNutritionalBenefit3",
            exitTarget: "routeToMain",
            enableBack: true,
            enableExit: true,
          }
        ),
      },
    },

    askNutritionalBenefit5: {
      entry: assign(() => ({
        message:
          "Do you think this is a nutritional benefit?\n(5 of 5)\nE: Supply plant protein and fiber for satiety and gut health.\n\n1. Yes\n2. No\n\n0. Back",
      })),
      on: {
        INPUT: withNavigation(
          [
            {
              target: "askAntenatalCardVerified",
              guard: "isValidYesNo",
              actions: [
                assign({
                  nutritionalBenefit5: ({ event }) =>
                    event.type === "INPUT" ? event.input : "",
                  nutritionalBenefitDetails: ({ context, event }) => {
                    if (event.type !== "INPUT") return [];
                    // Collect all 5 answers and map to array
                    const answers = [
                      context.nutritionalBenefit1 || "",
                      context.nutritionalBenefit2 || "",
                      context.nutritionalBenefit3 || "",
                      context.nutritionalBenefit4 || "",
                      event.input,
                    ];
                    return mapNutritionalBenefits(answers);
                  },
                }),
                ({
                  context,
                  event,
                }: {
                  context: ThousandDaySurveyContext;
                  event: ThousandDaySurveyEvent;
                }) => {
                  // Fire-and-forget save - use computed value directly
                  if (event.type === "INPUT") {
                    const answers = [
                      context.nutritionalBenefit1 || "",
                      context.nutritionalBenefit2 || "",
                      context.nutritionalBenefit3 || "",
                      context.nutritionalBenefit4 || "",
                      event.input,
                    ];
                    const answer = mapNutritionalBenefits(answers);
                    surveyResponseStorageService
                      .saveSurveyAnswer(
                        context.lgCustomerId,
                        context.customerId,
                        "ecs:nutritionalBenefitDetails",
                        answer
                      )
                      .catch(() => {
                        /* ignore errors */
                      });
                  }
                },
              ],
            },
            {
              target: "askNutritionalBenefit5",
              actions: assign({
                message: ({ event }) => {
                  if (event.type !== "INPUT") return "";
                  const validation = validateNutritionalBenefit(event.input);
                  return `${validation.error}\n\nPlease try again.\n\n0. Back`;
                },
              }),
            },
          ],
          {
            backTarget: "askNutritionalBenefit4",
            exitTarget: "routeToMain",
            enableBack: true,
            enableExit: true,
          }
        ),
      },
    },

    askAntenatalCardVerified: {
      entry: assign(() => ({
        message:
          "Lead Generator: I confirm I have seen a recent antenatal card for a household member.\n\n1. Yes\n2. No\n\n0. Back",
      })),
      on: {
        INPUT: withNavigation(
          [
            {
              target: "submittingClaim",
              guard: "isValidYesNo",
              actions: [
                assign({
                  antenatalCardVerified: ({ event }) =>
                    event.type === "INPUT"
                      ? mapAntenatalCardVerified(event.input)
                      : false,
                }),
                ({
                  context,
                  event,
                }: {
                  context: ThousandDaySurveyContext;
                  event: ThousandDaySurveyEvent;
                }) => {
                  // Fire-and-forget save - use event value directly
                  if (event.type === "INPUT") {
                    const answer = mapAntenatalCardVerified(event.input);
                    surveyResponseStorageService
                      .saveSurveyAnswer(
                        context.lgCustomerId,
                        context.customerId,
                        "ecs:confirmAction_antenatal_card_verified",
                        answer
                      )
                      .catch(() => {
                        /* ignore errors */
                      });

                    // Also mark survey as complete (fire-and-forget)
                    surveyResponseStorageService
                      .markSurveyComplete(
                        context.lgCustomerId,
                        context.customerId
                      )
                      .catch(() => {
                        /* ignore errors */
                      });
                  }
                },
              ],
            },
            {
              target: "askAntenatalCardVerified",
              actions: assign({
                message: ({ event }) => {
                  if (event.type !== "INPUT") return "";
                  const validation = validateYesNo(event.input);
                  return `${validation.error}\n\nPlease try again.\n\n0. Back`;
                },
              }),
            },
          ],
          {
            backTarget: "askNutritionalBenefit5",
            exitTarget: "routeToMain",
            enableBack: true,
            enableExit: true,
          }
        ),
      },
    },

    submittingClaim: {
      entry: assign(() => ({
        message: "Submitting claim to claims bot...\n\n1. Continue",
      })),
      invoke: {
        id: "submitClaim",
        src: "submitClaimService",
        input: ({ context }) => ({
          claimId: context.claimId || 0,
          lgCustomerId: context.lgCustomerId,
          customerId: context.customerId,
          beneficiaryCategory: context.beneficiaryCategory || [],
          childAge: context.childAge,
          beanIntakeFrequency: context.beanIntakeFrequency || "",
          priceSpecification: context.priceSpecification || "",
          awarenessIronBeans: context.awarenessIronBeans || "",
          knowsNutritionalBenefits: context.knowsNutritionalBenefits || "",
          nutritionalBenefitDetails: context.nutritionalBenefitDetails || [],
          antenatalCardVerified: context.antenatalCardVerified || false,
        }),
        onDone: {
          // No target - just complete the submission
        },
        onError: {
          target: "claimSubmissionFailed",
          actions: "setError",
        },
      },
      on: {
        INPUT: {
          target: "claimSubmitted",
        },
      },
    },

    claimSubmitted: {
      entry: assign(() => ({
        message:
          "Thank you. Your answers have been saved and submitted.\n\n1. Back to Agent Tools",
      })),
      on: {
        INPUT: withNavigation(
          [
            {
              target: "routeToMain",
              guard: ({ event }: { event: ThousandDaySurveyEvent }) =>
                event.type === "INPUT" && event.input === "1",
            },
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

    claimSubmissionFailed: {
      entry: assign({
        message: ({ context }) =>
          `Failed to submit claim: ${context.error}\n\n1. Retry\n2. Back to Agent Tools`,
      }),
      on: {
        INPUT: withNavigation(
          [
            {
              target: "submittingClaim",
              guard: ({ event }: { event: ThousandDaySurveyEvent }) =>
                event.type === "INPUT" && event.input === "1",
            },
            {
              target: "routeToMain",
              guard: ({ event }: { event: ThousandDaySurveyEvent }) =>
                event.type === "INPUT" && event.input === "2",
            },
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

    routeToMain: {
      type: "final",
    },

    invalidCustomer: {
      entry: assign(({ context }) => ({
        message:
          `Customer ID ${context.customerId} was not found.\n` +
          "Please check and try again.\n\n" +
          "1. Enter a different Customer ID\n" +
          "0. Back to Agent Tools",
      })),
      on: {
        INPUT: withNavigation(
          [
            {
              target: "askCustomerId",
              guard: ({ event }: { event: ThousandDaySurveyEvent }) =>
                event.type === "INPUT" && event.input === "1",
              actions: "clearErrors",
            },
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

    systemError: {
      entry: assign(() => ({
        message:
          "We couldn't start the 1,000 Day Survey due to a system error.\n" +
          "Please try again later or contact support.\n\n" +
          "0. Back to Agent Tools",
      })),
      on: {
        INPUT: withNavigation([], {
          backTarget: "routeToMain",
          exitTarget: "routeToMain",
          enableBack: true,
          enableExit: true,
        }),
      },
    },

    error: {
      entry: assign({
        message: ({ context }) =>
          `Error: ${context.error || "An unexpected error occurred"}\n\n0. Back`,
      }),
      on: {
        INPUT: withNavigation([], {
          backTarget: "routeToMain",
          exitTarget: "routeToMain",
          enableBack: true,
          enableExit: true,
        }),
      },
    },
  },
});
