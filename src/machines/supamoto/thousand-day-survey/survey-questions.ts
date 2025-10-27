/**
 * Hardcoded survey questions for 1,000 Day Household Survey
 * Based on SurveyJS form definition
 */

export interface SurveyChoice {
  value: string;
  text: string;
}

export interface SurveyQuestion {
  name: string;
  title: string;
  type: string;
  required: boolean;
  visibleIf?: string;
  choices?: SurveyChoice[];
  inputType?: string;
}

/**
 * Hardcoded survey questions based on SurveyJS form
 * Reference: https://devmx.ixo.earth/_matrix/media/v3/download/devmx.ixo.earth/rzmqolmRxTyVRuPWfrvkjZbX
 */
export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    name: "ecs:customerId",
    title:
      "A Lead Generator completes this survey on behalf of a Customer.\nWhat is the Customer ID for the Customer on whose behalf you are completing the survey?",
    type: "text",
    required: true,
    inputType: "text",
  },
  {
    name: "ecs:beneficiaryCategory",
    title:
      "Select all TRUE options for your household\nA: Pregnant Woman\nB: Breastfeeding Mother\nC: Child under 2 years",
    type: "checkbox",
    required: true,
    choices: [
      { value: "pregnant_woman", text: "A" },
      { value: "breastfeeding_mother", text: "B" },
      { value: "child_below_2_years", text: "C" },
      { value: "pregnant_woman,breastfeeding_mother", text: "A + B" },
      { value: "pregnant_woman,child_below_2_years", text: "A + C" },
      { value: "breastfeeding_mother,child_below_2_years", text: "B + C" },
      {
        value: "pregnant_woman,breastfeeding_mother,child_below_2_years",
        text: "All",
      },
      { value: "none", text: "None" },
    ],
  },
  {
    name: "schema:childMaxAge",
    title: "What is the child's age in months?",
    type: "text",
    required: false,
    visibleIf: "{ecs:beneficiaryCategory} contains 'child_below_2_years'",
    inputType: "number",
  },
  {
    name: "ecs:beanIntakeFrequency",
    title: "How many times a week does the child eat beans?",
    type: "radiogroup",
    required: true,
    choices: [
      { value: "none_at_all", text: "None at all" },
      { value: "1_2_times_week", text: "1–2 times a week" },
      { value: "3_4_times_week", text: "3–4 times a week" },
      { value: "5_6_times_week", text: "5–6 times a week" },
      { value: "daily", text: "Daily" },
    ],
  },
  {
    name: "schema:priceSpecification",
    title: "How much are you willing to pay for a 1 kg bag of beans? (ZMW)",
    type: "text",
    required: true,
    inputType: "text",
  },
  {
    name: "ecs:awarenessIronBeans",
    title: "Have you ever heard about iron-fortified beans (mbereshi beans)?",
    type: "radiogroup",
    required: true,
    choices: [
      { value: "yes", text: "Yes" },
      { value: "no", text: "No" },
    ],
  },
  {
    name: "ecs:knowsNutritionalBenefits",
    title:
      "Do you know any nutritional benefits of iron-fortified beans (mbereshi beans)?",
    type: "radiogroup",
    required: true,
    choices: [
      { value: "yes", text: "Yes" },
      { value: "no", text: "No" },
    ],
  },
  {
    name: "ecs:nutritionalBenefitDetails",
    title: "Do you think this is a nutritional benefit?",
    type: "checkbox",
    required: true,
    choices: [
      {
        value: "iron_status",
        text: "Improve iron status and help reduce iron deficiency/anemia.",
      },
      {
        value: "cognitive_support",
        text: "Support cognitive performance in iron-deficient individuals.",
      },
      {
        value: "work_capacity",
        text: "Enhance physical work capacity and reduce fatigue.",
      },
      {
        value: "high_iron_zinc",
        text: "Provide higher iron (and often zinc) than standard bean varieties.",
      },
      {
        value: "protein_fiber",
        text: "Supply plant protein and fiber for satiety and gut health.",
      },
    ],
  },
  {
    name: "ecs:confirmAction_antenatal_card_verified",
    title:
      "Lead Generator: I confirm I have seen a recent antenatal card for a household member.",
    type: "radiogroup",
    required: true,
    choices: [
      { value: "true", text: "Yes" },
      { value: "false", text: "No" },
    ],
  },
];

/**
 * Get question by name
 */
export function getQuestionByName(name: string): SurveyQuestion | undefined {
  return SURVEY_QUESTIONS.find(q => q.name === name);
}

/**
 * Get all required questions
 */
export function getRequiredQuestions(): SurveyQuestion[] {
  return SURVEY_QUESTIONS.filter(q => q.required);
}
