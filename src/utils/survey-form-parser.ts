/**
 * Survey Form Parser
 * Parses SurveyJS form definitions and extracts questions with visibility conditions
 */

import { createModuleLogger } from "../services/logger.js";

const logger = createModuleLogger("survey-form-parser");

export interface SurveyQuestion {
  name: string;
  title: string;
  type: string;
  choices?: Array<{ value: string; text: string }>;
  visibleIf?: string;
  required?: boolean;
  description?: string;
}

export interface ParsedSurveyForm {
  title: string;
  description?: string;
  questions: SurveyQuestion[];
  pages?: Array<{ name: string; elements: SurveyQuestion[] }>;
}

/**
 * Parse SurveyJS form JSON and extract questions
 */
export function parseSurveyForm(formJson: any): ParsedSurveyForm {
  logger.debug("Parsing survey form JSON");

  if (!formJson) {
    throw new Error("Form JSON is required");
  }

  const form: ParsedSurveyForm = {
    title: formJson.title || "Survey",
    description: formJson.description,
    questions: [],
  };

  // Handle both single-page and multi-page forms
  if (formJson.pages && Array.isArray(formJson.pages)) {
    form.pages = formJson.pages.map((page: any) => ({
      name: page.name,
      elements: extractQuestions(page.elements || []),
    }));
    // Flatten all questions for easier access
    form.questions = form.pages?.flatMap((page: any) => page.elements) || [];
  } else if (formJson.elements && Array.isArray(formJson.elements)) {
    form.questions = extractQuestions(formJson.elements);
  }

  logger.info(
    { questionCount: form.questions.length },
    "Parsed survey form successfully"
  );

  return form;
}

/**
 * Extract questions from SurveyJS elements array
 */
function extractQuestions(elements: any[]): SurveyQuestion[] {
  return elements
    .filter(el => el.type !== "html" && el.type !== "text") // Skip non-question elements
    .map(el => ({
      name: el.name,
      title: el.title || el.name,
      type: el.type,
      choices: el.choices,
      visibleIf: el.visibleIf,
      required: el.isRequired || el.required || false,
      description: el.description,
    }));
}

/**
 * Get next question based on current answers
 * Respects visibleIf conditions
 */
export function getNextQuestion(
  questions: SurveyQuestion[],
  answeredQuestions: Record<string, any>,
  currentIndex: number = 0
): SurveyQuestion | null {
  for (let i = currentIndex; i < questions.length; i++) {
    const question = questions[i];

    // Check if question is already answered
    if (answeredQuestions[question.name] !== undefined) {
      continue;
    }

    // Check visibility condition
    if (
      question.visibleIf &&
      !evaluateVisibility(question.visibleIf, answeredQuestions)
    ) {
      continue;
    }

    return question;
  }

  return null;
}

/**
 * Evaluate SurveyJS visibleIf condition
 * Supports simple conditions like: "{fieldName} = 'value'" or "{fieldName} == true"
 */
function evaluateVisibility(
  condition: string,
  answers: Record<string, any>
): boolean {
  try {
    // Replace {fieldName} with actual values from answers
    let evaluableCondition = condition;

    // Find all {fieldName} patterns
    const fieldPattern = /\{([^}]+)\}/g;
    const matches = condition.matchAll(fieldPattern);

    for (const match of matches) {
      const fieldName = match[1];
      const value = answers[fieldName];

      // Replace {fieldName} with quoted value
      if (typeof value === "string") {
        evaluableCondition = evaluableCondition.replace(
          `{${fieldName}}`,
          `'${value}'`
        );
      } else if (typeof value === "boolean") {
        evaluableCondition = evaluableCondition.replace(
          `{${fieldName}}`,
          value ? "true" : "false"
        );
      } else if (value === null || value === undefined) {
        evaluableCondition = evaluableCondition.replace(
          `{${fieldName}}`,
          "null"
        );
      } else {
        evaluableCondition = evaluableCondition.replace(
          `{${fieldName}}`,
          String(value)
        );
      }
    }

    // Normalize operators
    evaluableCondition = evaluableCondition.replace(/\s*==\s*/g, " === ");
    evaluableCondition = evaluableCondition.replace(/\s*!=\s*/g, " !== ");

    // Safely evaluate the condition

    const result = eval(evaluableCondition);

    logger.debug(
      { condition, evaluableCondition, result },
      "Evaluated visibility condition"
    );

    return Boolean(result);
  } catch (error) {
    logger.warn(
      {
        condition,
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to evaluate visibility condition, assuming visible"
    );
    return true; // Default to visible if evaluation fails
  }
}

/**
 * Get all required questions
 */
export function getRequiredQuestions(
  questions: SurveyQuestion[]
): SurveyQuestion[] {
  return questions.filter(q => q.required);
}

/**
 * Check if all required questions are answered
 */
export function areAllRequiredQuestionsAnswered(
  questions: SurveyQuestion[],
  answers: Record<string, any>
): boolean {
  const requiredQuestions = getRequiredQuestions(questions);
  return requiredQuestions.every(
    q =>
      answers[q.name] !== undefined &&
      answers[q.name] !== null &&
      answers[q.name] !== ""
  );
}

/**
 * Get question by name
 */
export function getQuestionByName(
  questions: SurveyQuestion[],
  name: string
): SurveyQuestion | undefined {
  return questions.find(q => q.name === name);
}
