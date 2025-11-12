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
      // Submit claim to claims bot
      const response = await submit1000DayHouseholdClaim({
        leadGeneratorId: input.lgCustomerId,
        customerId: input.customerId,
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
          "A Lead Generator completes this survey on behalf of a Customer.\nEnter the Customer ID on whose behalf you are completing the survey.\n\n0. Back to Agent Tools",
      })),
      on: {
        INPUT: withNavigation(
          [
            {
              target: "validatingCustomer",
              guard: "isValidCustomerId",
              actions: assign({
                customerId: ({ event }) => {
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

    validatingCustomer: {
      entry: assign(() => ({
        message: "Validating Customer ID...\n\n1. Continue",
      })),
      invoke: {
        id: "validateCustomerExists",
        src: "validateCustomerExistsService",
        input: ({ context }) => ({
          customerId: context.customerId,
        }),
        onDone: {
          target: "creatingClaim",
        },
        onError: {
          target: "error",
          actions: assign({
            error: ({ event }) => {
              const errorMessage =
                event.error instanceof Error
                  ? event.error.message
                  : String(event.error);
              return errorMessage;
            },
          }),
        },
      },
      on: {
        INPUT: {
          target: "creatingClaim",
        },
      },
    },

    creatingClaim: {
      entry: assign(() => {
        return {
          message: "Creating claim record...\n\n1. Continue",
        };
      }),
      invoke: {
        id: "createClaim",
        src: "createClaimService",
        input: ({ context }) => ({
          lgCustomerId: context.lgCustomerId,
          customerId: context.customerId,
        }),
        onDone: {
          actions: assign({
            claimId: ({ event }) => event.output.claimId,
          }),
        },
        onError: {
          target: "error",
          actions: assign({
            error: ({ event }) => {
              const errorMessage =
                event.error instanceof Error
                  ? event.error.message
                  : String(event.error);
              return errorMessage;
            },
          }),
        },
      },
      on: {
        INPUT: {
          target: "recoveringSession",
        },
      },
    },

    recoveringSession: {
      entry: assign(() => ({
        message: "Checking for existing survey data...\n\n1. Continue",
      })),
      invoke: {
        id: "recoverSession",
        src: "recoverSessionService",
        input: ({ context }) => ({
          lgCustomerId: context.lgCustomerId,
          customerId: context.customerId,
        }),
        onDone: {
          actions: assign({
            // Populate context with recovered answers if they exist
            beneficiaryCategory: ({ event }) =>
              event.output?.answers?.["ecs:beneficiaryCategory"],
            childAge: ({ event }) =>
              event.output?.answers?.["schema:childMaxAge"],
            beanIntakeFrequency: ({ event }) =>
              event.output?.answers?.["ecs:beanIntakeFrequency"],
            priceSpecification: ({ event }) =>
              event.output?.answers?.["schema:priceSpecification"],
            awarenessIronBeans: ({ event }) =>
              event.output?.answers?.["ecs:awarenessIronBeans"],
            knowsNutritionalBenefits: ({ event }) =>
              event.output?.answers?.["ecs:knowsNutritionalBenefits"],
            nutritionalBenefitDetails: ({ event }) =>
              event.output?.answers?.["ecs:nutritionalBenefitDetails"],
            antenatalCardVerified: ({ event }) =>
              event.output?.answers?.[
                "ecs:confirmAction_antenatal_card_verified"
              ],
          }),
        },
        onError: {
          // No existing data, start fresh - still transition to askBeneficiaryCategory
          target: "askBeneficiaryCategory",
        },
      },
      on: {
        INPUT: withNavigation(
          [
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
          {
            backTarget: "askCustomerId",
            exitTarget: "routeToMain",
            enableBack: true,
            enableExit: true,
          }
        ),
      },
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
              guard: ({
                event,
                context,
              }: {
                event: ThousandDaySurveyEvent;
                context: ThousandDaySurveyContext;
              }) => {
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
              target: "askBeanIntakeFrequency",
              guard: ({ event }: { event: ThousandDaySurveyEvent }) => {
                if (event.type !== "INPUT") return false;
                return validateBeneficiaryCategory(event.input).valid;
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
            backTarget: "askBeneficiaryCategory",
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
        INPUT: withNavigation(
          [
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
          {
            backTarget: "askBeneficiaryCategory",
            exitTarget: "routeToMain",
            enableBack: true,
            enableExit: true,
          }
        ),
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
