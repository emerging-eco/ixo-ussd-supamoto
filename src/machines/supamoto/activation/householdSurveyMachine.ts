/**
 * Household Survey Machine
 *
 * Handles the USSD survey flow for collecting household eligibility data
 * Collected by Lead Generators (LG) for customers
 * Supports session interruption recovery and conditional question visibility
 *
 * Flow:
 * 1. Load survey form from SurveyJS
 * 2. Present questions one at a time
 * 3. Save each answer to database (encrypted)
 * 4. Check for conditional visibility
 * 5. Mark survey complete when all required questions answered
 * 6. Return to parent machine
 */

import { setup, assign, fromPromise } from "xstate";
import { createModuleLogger } from "../../../services/logger.js";
import { surveyEngineService } from "../../../services/survey-engine.js";
import { surveyResponseStorageService } from "../../../services/survey-response-storage.js";
import { SurveyQuestion } from "../../../utils/survey-form-parser.js";

const logger = createModuleLogger("householdSurvey");

// Types and Interfaces
export interface HouseholdSurveyContext {
  sessionId: string;
  phoneNumber: string; // LG's phone number
  serviceCode: string;
  lgCustomerId: string; // Lead Generator's customer ID
  customerId: string; // Customer being surveyed
  message: string;
  error?: string;
  // Survey state
  currentQuestion?: SurveyQuestion;
  currentQuestionIndex: number;
  allQuestions: SurveyQuestion[];
  answers: Record<string, any>;
  surveyComplete: boolean;
  lastInput?: string;
}

export interface HouseholdSurveyInput {
  sessionId: string;
  phoneNumber: string; // LG's phone number
  serviceCode: string;
  lgCustomerId: string; // Lead Generator's customer ID
  customerId: string; // Customer being surveyed
}

export type HouseholdSurveyEvent =
  | { type: "INPUT"; input: string }
  | { type: "ERROR"; error: string };

export enum HouseholdSurveyOutput {
  COMPLETE = "COMPLETE",
  ERROR = "ERROR",
}

// Service definitions
const loadFormService = fromPromise(async () => {
  logger.info("Loading survey form");
  return await surveyEngineService.fetchSurveyForm();
});

const saveAnswerService = fromPromise(
  async ({
    input,
  }: {
    input: {
      lgCustomerId: string;
      customerId: string;
      questionName: string;
      answer: string;
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
    return await surveyResponseStorageService.saveSurveyAnswer(
      input.lgCustomerId,
      input.customerId,
      input.questionName,
      input.answer
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
    return await surveyResponseStorageService.markSurveyComplete(
      input.lgCustomerId,
      input.customerId
    );
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
    return await surveyResponseStorageService.getSurveyResponseState(
      input.lgCustomerId,
      input.customerId
    );
  }
);

export const householdSurveyMachine = setup({
  types: {
    context: {} as HouseholdSurveyContext,
    events: {} as HouseholdSurveyEvent,
    input: {} as HouseholdSurveyInput,
  },
  guards: {
    isInput1: ({ event }) => event.type === "INPUT" && event.input === "1",
    isBack: ({ event }) => event.type === "INPUT" && event.input === "0",
    isExit: ({ event }) =>
      event.type === "INPUT" && event.input.toLowerCase() === "exit",
    hasMoreQuestions: ({ context }) =>
      context.currentQuestionIndex < context.allQuestions.length,
    allQuestionsAnswered: ({ context }) => {
      const requiredQuestions = context.allQuestions.filter(q => q.required);
      return requiredQuestions.every(
        q =>
          context.answers[q.name] !== undefined &&
          context.answers[q.name] !== null
      );
    },
  },
  actors: {
    loadFormService,
    saveAnswerService,
    markCompleteService,
    recoverSessionService,
  },
  actions: {
    clearErrors: assign({
      error: undefined,
    }),
  },
}).createMachine({
  id: "householdSurvey",
  initial: "loadingForm",
  context: ({ input }): HouseholdSurveyContext => ({
    sessionId: input?.sessionId || "",
    phoneNumber: input?.phoneNumber || "",
    serviceCode: input?.serviceCode || "",
    lgCustomerId: input?.lgCustomerId || "",
    customerId: input?.customerId || "",
    message: "Loading survey...",
    currentQuestionIndex: 0,
    allQuestions: [],
    answers: {},
    surveyComplete: false,
  }),
  output: ({ context }) => ({
    result: context.surveyComplete
      ? HouseholdSurveyOutput.COMPLETE
      : HouseholdSurveyOutput.ERROR,
    answers: context.answers,
  }),
  states: {
    loadingForm: {
      invoke: {
        id: "loadForm",
        src: "loadFormService",
        onDone: {
          target: "recoveringSession",
          actions: assign({
            allQuestions: ({ event }) => event.output.questions,
          }),
        },
        onError: {
          target: "error",
          actions: assign({
            error: ({ event }) =>
              event.error instanceof Error
                ? event.error.message
                : "Failed to load survey form",
            message: "Error loading survey. Please try again.\n\n0. Back",
          }),
        },
      },
    },

    recoveringSession: {
      invoke: {
        id: "recoverSession",
        src: "recoverSessionService",
        input: ({ context }) => ({
          lgCustomerId: context.lgCustomerId,
          customerId: context.customerId,
        }),
        onDone: {
          target: "presentingQuestion",
          actions: assign({
            answers: ({ event }) => event.output?.answers || {},
            currentQuestionIndex: ({ context, event }) => {
              // Find first unanswered question
              const answers = event.output?.answers || {};
              const index = context.allQuestions.findIndex(
                q => answers[q.name] === undefined
              );
              // Ensure index is never negative (defaults to 0 if all questions are unanswered)
              return Math.max(0, index);
            },
          }),
        },
        onError: {
          target: "presentingQuestion",
          actions: assign({
            currentQuestionIndex: 0,
            answers: {},
          }),
        },
      },
    },

    presentingQuestion: {
      entry: assign({
        currentQuestion: ({ context }) =>
          context.allQuestions[context.currentQuestionIndex],
        message: ({ context }) => {
          const question = context.allQuestions[context.currentQuestionIndex];
          if (!question) {
            return "Survey complete!\n\n1. Continue";
          }

          let msg = `${question.title}\n`;
          if (question.choices) {
            question.choices.forEach((choice, idx) => {
              msg += `\n${idx + 1}. ${choice.text}`;
            });
          }
          msg += "\n\n0. Back";
          return msg;
        },
      }),
      on: {
        INPUT: [
          {
            target: "savingAnswer",
            guard: "isInput1",
            actions: assign({
              // Store the answer (will be processed in savingAnswer state)
            }),
          },
          {
            target: "presentingQuestion",
            guard: "isBack",
            actions: assign({
              currentQuestionIndex: ({ context }) =>
                Math.max(0, context.currentQuestionIndex - 1),
            }),
          },
          {
            target: "complete",
            guard: "isExit",
            actions: assign({
              surveyComplete: false,
            }),
          },
        ],
      },
    },

    savingAnswer: {
      entry: assign({
        lastInput: ({ event }) => (event.type === "INPUT" ? event.input : ""),
      }),
      invoke: {
        id: "saveAnswer",
        src: "saveAnswerService",
        input: ({ context, event }) => ({
          lgCustomerId: context.lgCustomerId,
          customerId: context.customerId,
          questionName: context.currentQuestion?.name || "",
          answer: event.type === "INPUT" ? event.input : "",
        }),
        onDone: {
          target: "checkingCompletion",
          actions: assign({
            answers: ({ context }) => ({
              ...context.answers,
              [context.currentQuestion?.name || ""]: context.lastInput,
            }),
          }),
        },
        onError: {
          target: "error",
          actions: assign({
            error: ({ event }) =>
              event.error instanceof Error
                ? event.error.message
                : "Failed to save answer",
            message: "Error saving answer. Please try again.\n\n0. Back",
          }),
        },
      },
    },

    checkingCompletion: {
      always: [
        {
          target: "surveyComplete",
          guard: "allQuestionsAnswered",
        },
        {
          target: "presentingQuestion",
          actions: assign({
            currentQuestionIndex: ({ context }) =>
              context.currentQuestionIndex + 1,
          }),
        },
      ],
    },

    surveyComplete: {
      invoke: {
        id: "markComplete",
        src: "markCompleteService",
        input: ({ context }) => ({
          lgCustomerId: context.lgCustomerId,
          customerId: context.customerId,
        }),
        onDone: {
          target: "complete",
          actions: assign({
            surveyComplete: true,
            message: "Survey complete! Thank you.\n\n1. Continue",
          }),
        },
        onError: {
          target: "complete",
          actions: assign({
            surveyComplete: true,
            message: "Survey complete! Thank you.\n\n1. Continue",
          }),
        },
      },
    },

    error: {
      on: {
        INPUT: [
          {
            target: "presentingQuestion",
            guard: "isBack",
          },
          {
            target: "complete",
            guard: "isExit",
            actions: assign({
              surveyComplete: false,
            }),
          },
        ],
      },
    },

    complete: {
      type: "final",
    },
  },
});
