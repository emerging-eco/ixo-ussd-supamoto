/**
 * Survey validation functions for 1,000 Day Household Survey
 */

/**
 * Validate customer identifier (Customer ID or National ID)
 * Accepts:
 * - Customer ID: C[A-Za-z0-9]{8,19} (e.g., CA6A546EF, C3283000017) - max 20 chars total
 * - National ID: XXXXXX/XX/X or XXXXXXXXX (e.g., 123456/05/1, 123456051)
 */
export function validateCustomerId(input: string): {
  valid: boolean;
  error?: string;
} {
  // Normalize input: trim and remove dangerous characters
  const sanitized = input
    .trim()
    .replace(/[<>"'&]/g, "")
    .replace(/\s+/g, "");

  if (!sanitized) {
    return {
      valid: false,
      error: "Customer ID or National ID cannot be empty.",
    };
  }

  // Check if it's a Customer ID (case-insensitive, max 20 chars total)
  const customerIdPattern = /^C[A-Za-z0-9]{8,19}$/i;
  if (customerIdPattern.test(sanitized)) {
    return { valid: true };
  }

  // Check if it's a National ID with slashes (XXXXXX/XX/X)
  const nationalIdWithSlashes = /^(\d{6})\/(\d{2})\/(\d)$/;
  if (nationalIdWithSlashes.test(sanitized)) {
    return { valid: true };
  }

  // Check if it's a National ID without slashes (XXXXXXXXX)
  const nationalIdWithoutSlashes = /^(\d{6})(\d{2})(\d)$/;
  if (nationalIdWithoutSlashes.test(sanitized)) {
    return { valid: true };
  }

  // If none of the patterns match, return error
  return {
    valid: false,
    error:
      "Invalid format. Enter a Customer ID (e.g., CA6A546EF) or National ID (e.g., 123456/05/1).",
  };
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
