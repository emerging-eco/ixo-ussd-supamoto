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
      "Creating household claim for 1,000 Day Survey"
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
      if (event.type !== "INPUT") return false;
      return validateCustomerId(event.input).valid;
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
  },
  actors: {
    createClaimService,
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
          "A Lead Generator completes this survey on behalf of a Customer.\nWhat is the Customer ID for the Customer on whose behalf you are completing the survey?\n\n0. Back to Agent Tools",
      })),
      on: {
        INPUT: withNavigation(
          [
            {
              target: "creatingClaim",
              guard: "isValidCustomerId",
              actions: assign({
                customerId: ({ event }) =>
                  event.type === "INPUT" ? event.input : "",
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

    creatingClaim: {
      entry: assign(() => ({
        message: "Creating claim record...",
      })),
      invoke: {
        id: "createClaim",
        src: "createClaimService",
        input: ({ context }) => ({
          lgCustomerId: context.lgCustomerId,
          customerId: context.customerId,
        }),
        onDone: {
          target: "recoveringSession",
          actions: assign({
            claimId: ({ event }) => event.output.claimId,
          }),
        },
        onError: {
          target: "error",
          actions: "setError",
        },
      },
    },

    recoveringSession: {
      entry: assign(() => ({
        message: "Checking for existing survey data...",
      })),
      invoke: {
        id: "recoverSession",
        src: "recoverSessionService",
        input: ({ context }) => ({
          lgCustomerId: context.lgCustomerId,
          customerId: context.customerId,
        }),
        onDone: {
          target: "askBeneficiaryCategory",
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
          // No existing data, start fresh
          target: "askBeneficiaryCategory",
        },
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
              target: "savingBeneficiaryCategory",
              guard: "isValidBeneficiaryCategory",
              actions: assign({
                beneficiaryCategory: ({ event }) =>
                  event.type === "INPUT"
                    ? mapBeneficiaryCategory(event.input)
                    : [],
              }),
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

    savingBeneficiaryCategory: {
      entry: assign(() => ({
        message: "Saving answer...",
      })),
      invoke: {
        id: "saveBeneficiaryCategory",
        src: "saveAnswerService",
        input: ({ context }) => ({
          lgCustomerId: context.lgCustomerId,
          customerId: context.customerId,
          questionName: "ecs:beneficiaryCategory",
          answer: context.beneficiaryCategory,
        }),
        onDone: [
          {
            target: "askChildAge",
            guard: "shouldShowChildAge",
          },
          {
            target: "askBeanIntakeFrequency",
          },
        ],
        onError: {
          target: "error",
          actions: "setError",
        },
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
              target: "savingChildAge",
              guard: "isValidChildAge",
              actions: assign({
                childAge: ({ event }) =>
                  event.type === "INPUT" ? mapChildAge(event.input) : undefined,
              }),
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

    savingChildAge: {
      entry: assign(() => ({
        message: "Saving answer...",
      })),
      invoke: {
        id: "saveChildAge",
        src: "saveAnswerService",
        input: ({ context }) => ({
          lgCustomerId: context.lgCustomerId,
          customerId: context.customerId,
          questionName: "schema:childMaxAge",
          answer: context.childAge,
        }),
        onDone: {
          target: "askBeanIntakeFrequency",
        },
        onError: {
          target: "error",
          actions: "setError",
        },
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
              target: "savingBeanIntakeFrequency",
              guard: "isValidBeanIntakeFrequency",
              actions: assign({
                beanIntakeFrequency: ({ event }) =>
                  event.type === "INPUT"
                    ? mapBeanIntakeFrequency(event.input)
                    : "",
              }),
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

    savingBeanIntakeFrequency: {
      entry: assign(() => ({
        message: "Saving answer...",
      })),
      invoke: {
        id: "saveBeanIntakeFrequency",
        src: "saveAnswerService",
        input: ({ context }) => ({
          lgCustomerId: context.lgCustomerId,
          customerId: context.customerId,
          questionName: "ecs:beanIntakeFrequency",
          answer: context.beanIntakeFrequency,
        }),
        onDone: {
          target: "askPriceSpecification",
        },
        onError: {
          target: "error",
          actions: "setError",
        },
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
              target: "savingPriceSpecification",
              guard: "isValidPriceSpecification",
              actions: assign({
                priceSpecification: ({ event }) =>
                  event.type === "INPUT"
                    ? mapPriceSpecification(event.input)
                    : "",
              }),
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
            backTarget: "askBeanIntakeFrequency",
            exitTarget: "routeToMain",
            enableBack: true,
            enableExit: true,
          }
        ),
      },
    },

    savingPriceSpecification: {
      entry: assign(() => ({
        message: "Saving answer...",
      })),
      invoke: {
        id: "savePriceSpecification",
        src: "saveAnswerService",
        input: ({ context }) => ({
          lgCustomerId: context.lgCustomerId,
          customerId: context.customerId,
          questionName: "schema:priceSpecification",
          answer: context.priceSpecification,
        }),
        onDone: {
          target: "askAwarenessIronBeans",
        },
        onError: {
          target: "error",
          actions: "setError",
        },
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
              target: "savingAwarenessIronBeans",
              guard: "isValidYesNo",
              actions: assign({
                awarenessIronBeans: ({ event }) =>
                  event.type === "INPUT" ? mapYesNo(event.input) : "",
              }),
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

    savingAwarenessIronBeans: {
      entry: assign(() => ({
        message: "Saving answer...",
      })),
      invoke: {
        id: "saveAwarenessIronBeans",
        src: "saveAnswerService",
        input: ({ context }) => ({
          lgCustomerId: context.lgCustomerId,
          customerId: context.customerId,
          questionName: "ecs:awarenessIronBeans",
          answer: context.awarenessIronBeans,
        }),
        onDone: {
          target: "askKnowsNutritionalBenefits",
        },
        onError: {
          target: "error",
          actions: "setError",
        },
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
              target: "savingKnowsNutritionalBenefits",
              guard: "isValidYesNo",
              actions: assign({
                knowsNutritionalBenefits: ({ event }) =>
                  event.type === "INPUT" ? mapYesNo(event.input) : "",
              }),
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

    savingKnowsNutritionalBenefits: {
      entry: assign(() => ({
        message: "Saving answer...",
      })),
      invoke: {
        id: "saveKnowsNutritionalBenefits",
        src: "saveAnswerService",
        input: ({ context }) => ({
          lgCustomerId: context.lgCustomerId,
          customerId: context.customerId,
          questionName: "ecs:knowsNutritionalBenefits",
          answer: context.knowsNutritionalBenefits,
        }),
        onDone: {
          target: "askNutritionalBenefit1",
        },
        onError: {
          target: "error",
          actions: "setError",
        },
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
              target: "savingNutritionalBenefits",
              guard: "isValidYesNo",
              actions: assign({
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

    savingNutritionalBenefits: {
      entry: assign(() => ({
        message: "Saving answers...",
      })),
      invoke: {
        id: "saveNutritionalBenefits",
        src: "saveAnswerService",
        input: ({ context }) => ({
          lgCustomerId: context.lgCustomerId,
          customerId: context.customerId,
          questionName: "ecs:nutritionalBenefitDetails",
          answer: context.nutritionalBenefitDetails,
        }),
        onDone: {
          target: "askAntenatalCardVerified",
        },
        onError: {
          target: "error",
          actions: "setError",
        },
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
              target: "savingAntenatalCardVerified",
              guard: "isValidYesNo",
              actions: assign({
                antenatalCardVerified: ({ event }) =>
                  event.type === "INPUT"
                    ? mapAntenatalCardVerified(event.input)
                    : false,
              }),
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

    savingAntenatalCardVerified: {
      entry: assign(() => ({
        message: "Saving answer...",
      })),
      invoke: {
        id: "saveAntenatalCardVerified",
        src: "saveAnswerService",
        input: ({ context }) => ({
          lgCustomerId: context.lgCustomerId,
          customerId: context.customerId,
          questionName: "ecs:confirmAction_antenatal_card_verified",
          answer: context.antenatalCardVerified,
        }),
        onDone: {
          target: "markingComplete",
        },
        onError: {
          target: "error",
          actions: "setError",
        },
      },
    },

    markingComplete: {
      entry: assign(() => ({
        message: "Completing survey...",
      })),
      invoke: {
        id: "markComplete",
        src: "markCompleteService",
        input: ({ context }) => ({
          lgCustomerId: context.lgCustomerId,
          customerId: context.customerId,
        }),
        onDone: {
          target: "submittingClaim",
        },
        onError: {
          target: "error",
          actions: "setError",
        },
      },
    },

    submittingClaim: {
      entry: assign(() => ({
        message: "Submitting claim to claims bot...",
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
          target: "claimSubmitted",
        },
        onError: {
          target: "claimSubmissionFailed",
          actions: "setError",
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
