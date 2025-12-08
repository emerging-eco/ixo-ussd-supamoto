/**
 * Validation Guards for Supamoto Wallet Machine
 *
 * This module contains guards related to input validation.
 * These guards validate user input using the input validation utilities.
 */
import { createModuleLogger } from "../../../../src/services/logger.js";
import { validateUserInput } from "../../../../src/utils/input-validation.js";
import { isInputOneOf } from "./navigation.guards.js";
const logger = createModuleLogger("validation-guards");
 
export function createValidationGuard(type, options = {}) {
    return (context, event) => {
        if (event.type !== "INPUT")
            return false;
        const validation = validateUserInput(event.input, type, options);
        if (!validation.isValid) {
            logger.warn({
                type,
                error: validation.error,
                hasInput: !!event.input,
                phoneNumber: `***${context.phoneNumber.slice(-4)}`,
            }, "Input validation failed");
        }
        return validation.isValid;
    };
}
// =================================================================================================
// SPECIFIC VALIDATION GUARDS
// =================================================================================================
/**
 * Validates menu selection input
 */
export const isValidMenuInput = createValidationGuard("menu");
/**
 * Validates PIN input
 */
export const isValidPin = createValidationGuard("pin");
/**
 * Validates PIN input with weak PIN checking
 */
export const isValidStrongPin = createValidationGuard("pin", {
    checkWeakPins: true,
});
/**
 * Validates amount input for transactions
 */
export const isValidAmount = createValidationGuard("amount");
/**
 * Validates IXO address input
 */
export const isValidIxoAddress = createValidationGuard("address");
/**
 * Validates wallet ID input
 */
export const isValidWalletId = createValidationGuard("wallet");
/**
 * Validates text input (general purpose)
 */
export const isValidTextInput = createValidationGuard("text");
/**
 * Validates boolean input (yes/no, 1/0)
 */
export const isValidBooleanInput = createValidationGuard("boolean");
/**
 * Validates phone number input
 */
export const isValidPhoneInput = createValidationGuard("phone");
// =================================================================================================
// COMPOSITE VALIDATION GUARDS
// =================================================================================================
/**
 * Checks if input is valid menu selection for specific menu options
 */
export const isValidMenuChoice = (validOptions) => (context, event) => {
    return (isValidMenuInput(context, event) &&
        isInputOneOf(validOptions)(context, event));
};
/**
 * Validates menu selection for common menu sizes
 */
export const isValidMainMenuChoice = isValidMenuChoice([
    "1",
    "2",
    "3",
    "4",
    "5",
]);
export const isValidSubMenuChoice = isValidMenuChoice(["1", "2", "3", "0"]);
export const isValidBinaryChoice = isValidMenuChoice(["1", "2", "0"]);
// =================================================================================================
// VALIDATION GUARD COLLECTION
// =================================================================================================
/**
 * Collection of all validation guards for easy access
 */
export const validationGuards = {
    createValidationGuard,
    isValidMenuInput,
    isValidPin,
    isValidStrongPin,
    isValidAmount,
    isValidIxoAddress,
    isValidWalletId,
    isValidTextInput,
    isValidBooleanInput,
    isValidPhoneInput,
    isValidMenuChoice,
    isValidMainMenuChoice,
    isValidSubMenuChoice,
    isValidBinaryChoice,
};
//# sourceMappingURL=validation.guards.js.map
