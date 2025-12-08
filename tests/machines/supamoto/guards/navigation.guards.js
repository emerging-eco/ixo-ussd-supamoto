/**
 * Navigation Guards for Supamoto Wallet Machine
 *
 * This module contains guards related to navigation and basic input handling.
 * These guards help determine user navigation intent and validate basic input patterns.
 */
import { EVENT_INPUTS, EVENT_TYPES, } from "../../../../src/constants/navigation.js";
// =================================================================================================
// NAVIGATION GUARDS
// =================================================================================================
/**
 * Creates a guard that checks if input matches a specific value
 */
export const isInput = (expectedInput) => (context, event) => {
    if (event.type !== EVENT_TYPES.INPUT)
        return false;
    return event.input === expectedInput;
};
/**
 * Creates a guard that checks if input is in a list of valid options
 */
export const isInputOneOf = (validInputs) => (context, event) => {
    if (event.type !== EVENT_TYPES.INPUT)
        return false;
    return validInputs.includes(event.input);
};
/**
 * Checks if input is the back command ("0")
 */
export const isBackCommand = (context, event) => {
    return isInput(EVENT_INPUTS.BACK)(context, event);
};
/**
 * Checks if input is the exit command (case-insensitive)
 */
export const isExitCommand = (context, event) => {
    if (event.type !== EVENT_TYPES.INPUT)
        return false;
    return event.input === EVENT_INPUTS.EXIT;
};
/**
 * Checks if input is empty or just whitespace
 */
export const isEmptyInput = (context, event) => {
    if (event.type !== EVENT_TYPES.INPUT)
        return false;
    return !event.input || event.input.trim().length === 0;
};
/**
 * Combined navigation guard - checks for back OR exit
 */
export const isNavigationCommand = (context, event) => {
    return isBackCommand(context, event) || isExitCommand(context, event);
};
// =================================================================================================
// NAVIGATION GUARD COLLECTION
// =================================================================================================
/**
 * Collection of all navigation guards for easy access
 */
export const navigationGuards = {
    isInput,
    isInputOneOf,
    isBackCommand,
    isExitCommand,
    isEmptyInput,
    isNavigationCommand,
};
/**
 * Common navigation shortcuts
 */
export const commonNavigation = {
    isBack: isBackCommand,
    isMenu1: isInput("1"),
    isMenu2: isInput("2"),
    isMenu3: isInput("3"),
    isMenu4: isInput("4"),
    isMenu5: isInput("5"),
    isMenu6: isInput("6"),
    isMenu7: isInput("7"),
    isMenu8: isInput("8"),
    isMenu9: isInput("9"),
    isEmpty: isEmptyInput,
};
//# sourceMappingURL=navigation.guards.js.map
