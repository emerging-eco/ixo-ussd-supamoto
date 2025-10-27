/**
 * USSD input to SurveyJS value mappers for 1,000 Day Household Survey
 */

/**
 * Map beneficiary category USSD option to SurveyJS checkbox array
 * Options:
 * 1. A (Pregnant Woman)
 * 2. B (Breastfeeding Mother)
 * 3. C (Child under 2 years)
 * 4. A + B
 * 5. A + C
 * 6. B + C
 * 7. All (A + B + C)
 * 8. None
 */
export function mapBeneficiaryCategory(ussdInput: string): string[] {
  const option = parseInt(ussdInput, 10);

  switch (option) {
    case 1:
      return ["pregnant_woman"];
    case 2:
      return ["breastfeeding_mother"];
    case 3:
      return ["child_below_2_years"];
    case 4:
      return ["pregnant_woman", "breastfeeding_mother"];
    case 5:
      return ["pregnant_woman", "child_below_2_years"];
    case 6:
      return ["breastfeeding_mother", "child_below_2_years"];
    case 7:
      return ["pregnant_woman", "breastfeeding_mother", "child_below_2_years"];
    case 8:
      return ["none"];
    default:
      return [];
  }
}

/**
 * Map child age string to number
 */
export function mapChildAge(ussdInput: string): number {
  return parseInt(ussdInput, 10);
}

/**
 * Map bean intake frequency USSD option to SurveyJS value
 * Options:
 * 1. None at all
 * 2. 1–2 times a week
 * 3. 3–4 times a week
 * 4. 5–6 times a week
 * 5. Daily
 */
export function mapBeanIntakeFrequency(ussdInput: string): string {
  const option = parseInt(ussdInput, 10);

  switch (option) {
    case 1:
      return "none_at_all";
    case 2:
      return "1_2_times_week";
    case 3:
      return "3_4_times_week";
    case 4:
      return "5_6_times_week";
    case 5:
      return "daily";
    default:
      return "";
  }
}

/**
 * Map price specification - strip "ZMW" and convert to number
 * Accepts: "10", "10 ZMW", "10ZMW"
 * Returns: "10"
 */
export function mapPriceSpecification(ussdInput: string): string {
  // Strip "ZMW" suffix (case-insensitive, with or without space)
  const cleaned = ussdInput.replace(/\s*ZMW\s*$/i, "").trim();
  return cleaned;
}

/**
 * Map yes/no USSD option to SurveyJS value
 * Options:
 * 1. Yes
 * 2. No
 */
export function mapYesNo(ussdInput: string): string {
  const option = parseInt(ussdInput, 10);
  return option === 1 ? "yes" : "no";
}

/**
 * Map nutritional benefits answers to SurveyJS checkbox array
 * Collects 5 yes/no answers and returns array of selected benefits
 *
 * @param answers Array of 5 USSD inputs (1 for Yes, 2 for No)
 * @returns Array of selected benefit values
 */
export function mapNutritionalBenefits(answers: string[]): string[] {
  const benefits = [
    "iron_status",
    "cognitive_support",
    "work_capacity",
    "high_iron_zinc",
    "protein_fiber",
  ];

  const selected: string[] = [];

  for (let i = 0; i < answers.length && i < benefits.length; i++) {
    const option = parseInt(answers[i], 10);
    if (option === 1) {
      // User selected "Yes"
      selected.push(benefits[i]);
    }
  }

  return selected;
}

/**
 * Map antenatal card verification to boolean
 * Options:
 * 1. Yes -> true
 * 2. No -> false
 */
export function mapAntenatalCardVerified(ussdInput: string): boolean {
  const option = parseInt(ussdInput, 10);
  return option === 1;
}

/**
 * Check if beneficiary category includes "child_below_2_years"
 * Used to determine if child age question should be shown
 */
export function shouldShowChildAgeQuestion(
  beneficiaryCategoryArray: string[]
): boolean {
  return beneficiaryCategoryArray.includes("child_below_2_years");
}
