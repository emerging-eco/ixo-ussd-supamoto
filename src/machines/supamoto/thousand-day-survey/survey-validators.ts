/**
 * Survey validation functions for 1,000 Day Household Survey
 */

/**
 * Validate customer ID format
 * Pattern: /^C[A-Za-z0-9]{8,}$/
 * Example: CDDA2FB60
 */
export function validateCustomerId(input: string): {
  valid: boolean;
  error?: string;
} {
  const pattern = /^C[A-Za-z0-9]{8,}$/;
  if (!pattern.test(input)) {
    return {
      valid: false,
      error:
        "Invalid Customer ID format. Must start with 'C' followed by at least 8 alphanumeric characters.",
    };
  }
  return { valid: true };
}

/**
 * Validate beneficiary category selection (1-8)
 */
export function validateBeneficiaryCategory(input: string): {
  valid: boolean;
  error?: string;
} {
  const option = parseInt(input, 10);
  if (isNaN(option) || option < 1 || option > 8) {
    return {
      valid: false,
      error: "Please select a valid option (1-8).",
    };
  }
  return { valid: true };
}

/**
 * Validate child age (0-24 months)
 */
export function validateChildAge(input: string): {
  valid: boolean;
  error?: string;
} {
  const age = parseInt(input, 10);
  if (isNaN(age)) {
    return {
      valid: false,
      error: "Please enter a valid number for the child's age.",
    };
  }
  if (age < 0 || age > 24) {
    return {
      valid: false,
      error: "Child age must be between 0 and 24 months.",
    };
  }
  return { valid: true };
}

/**
 * Validate bean intake frequency selection (1-5)
 */
export function validateBeanIntakeFrequency(input: string): {
  valid: boolean;
  error?: string;
} {
  const option = parseInt(input, 10);
  if (isNaN(option) || option < 1 || option > 5) {
    return {
      valid: false,
      error: "Please select a valid option (1-5).",
    };
  }
  return { valid: true };
}

/**
 * Validate price specification
 * Accepts formats: "10", "10 ZMW", "10ZMW"
 */
export function validatePriceSpecification(input: string): {
  valid: boolean;
  error?: string;
} {
  // Strip "ZMW" suffix (case-insensitive, with or without space)
  const cleaned = input.replace(/\s*ZMW\s*$/i, "").trim();
  const price = parseFloat(cleaned);

  if (isNaN(price) || price < 0) {
    return {
      valid: false,
      error: "Please enter a valid price (e.g., '10' or '10 ZMW').",
    };
  }
  return { valid: true };
}

/**
 * Validate yes/no selection (1-2)
 */
export function validateYesNo(input: string): {
  valid: boolean;
  error?: string;
} {
  const option = parseInt(input, 10);
  if (isNaN(option) || option < 1 || option > 2) {
    return {
      valid: false,
      error: "Please select 1 for Yes or 2 for No.",
    };
  }
  return { valid: true };
}

/**
 * Validate nutritional benefit selection (1-2)
 */
export function validateNutritionalBenefit(input: string): {
  valid: boolean;
  error?: string;
} {
  return validateYesNo(input);
}

/**
 * Validate that input is not "0" (back command)
 * Used to ensure user doesn't accidentally submit "0" as an answer
 */
export function isNotBackCommand(input: string): boolean {
  return input !== "0";
}

/**
 * Validate any non-empty input
 */
export function validateNonEmpty(input: string): {
  valid: boolean;
  error?: string;
} {
  if (!input || input.trim().length === 0) {
    return {
      valid: false,
      error: "Please enter a value.",
    };
  }
  return { valid: true };
}
