/**
 * Guard Utilities for Supamoto Wallet Machine
 *
 * This module contains utility functions for combining and manipulating guards.
 * These utilities help create complex guard logic from simpler components.
 */
import { createModuleLogger } from "../../../../src/services/logger.js";
const logger = createModuleLogger("guard-utils");
// =================================================================================================
// GUARD COMPOSITION UTILITIES
// =================================================================================================
/**
 * Combines multiple guards with AND logic
 * Returns true only if ALL guards return true
 */
export const allGuards = (...guards) => (context, event) => {
    return guards.every(guard => guard(context, event));
};
/**
 * Combines multiple guards with OR logic
 * Returns true if ANY guard returns true
 */
export const anyGuard = (...guards) => (context, event) => {
    return guards.some(guard => guard(context, event));
};
/**
 * Negates a guard result
 * Returns the opposite of the guard's result
 */
export const notGuard = (guard) => (context, event) => {
    return !guard(context, event);
};
/**
 * Creates a guard that always returns true
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const alwaysTrue = (context, event) => true;
/**
 * Creates a guard that always returns false
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const alwaysFalse = (context, event) => false;
// =================================================================================================
// GUARD DEBUGGING UTILITIES
// =================================================================================================
/**
 * Creates a guard that logs when it's evaluated (for debugging)
 */
export const logGuard = (name, guard) => (context, event) => {
    const result = guard(context, event);
    logger.debug({
        phoneNumber: `***${context.phoneNumber.slice(-4)}`,
        eventType: event.type,
    }, `Guard ${name} evaluated to ${result}`);
    return result;
};
/**
 * Creates a guard that logs detailed information about the evaluation
 */
export const verboseLogGuard = (name, guard) => (context, event) => {
    const startTime = Date.now();
    const result = guard(context, event);
    const endTime = Date.now();
    logger.debug({
        result,
        duration: endTime - startTime,
        phoneNumber: `***${context.phoneNumber.slice(-4)}`,
        eventType: event.type,
        hasInput: event.type === "INPUT" ? !!event.input : false,
    }, `Guard ${name} evaluation`);
    return result;
};
// =================================================================================================
// GUARD PERFORMANCE UTILITIES
// =================================================================================================
/**
 * Creates a guard that measures execution time
 */
export const timedGuard = (name, guard) => (context, event) => {
    const startTime = Date.now();
    const result = guard(context, event);
    const endTime = Date.now();
    if (endTime - startTime > 10) {
        // Log if guard takes more than 10ms
        logger.warn({
            duration: endTime - startTime,
            phoneNumber: `***${context.phoneNumber.slice(-4)}`,
        }, `Slow guard execution: ${name}`);
    }
    return result;
};
/**
 * Creates a guard that caches results for a short period
 */
export const cachedGuard = (guard, cacheDurationMs = 1000) => {
    let lastResult = null;
    let lastEvalTime = 0;
    return (context, event) => {
        const now = Date.now();
        if (lastResult !== null && now - lastEvalTime < cacheDurationMs) {
            return lastResult;
        }
        lastResult = guard(context, event);
        lastEvalTime = now;
        return lastResult;
    };
};
// =================================================================================================
// GUARD CONDITION UTILITIES
// =================================================================================================
/**
 * Creates a guard that only evaluates the provided guard if a condition is met
 */
export const conditionalGuard = (condition, guard) => (context, event) => {
    if (!condition(context, event)) {
        return false;
    }
    return guard(context, event);
};
/**
 * Creates a guard that evaluates different guards based on a condition
 */
export const ifElseGuard = (condition, trueGuard, falseGuard) => (context, event) => {
    if (condition(context, event)) {
        return trueGuard(context, event);
    }
    else {
        return falseGuard(context, event);
    }
};
// =================================================================================================
// GUARD VALIDATION UTILITIES
// =================================================================================================
/**
 * Validates that a guard function is properly implemented
 */
export const validateGuard = (guard, name) => {
    if (typeof guard !== "function") {
        logger.error(`Guard ${name} is not a function`);
        return false;
    }
    if (guard.length !== 2) {
        logger.error(`Guard ${name} does not accept exactly 2 parameters`);
        return false;
    }
    return true;
};
/**
 * Creates a safe guard wrapper that catches errors
 */
export const safeGuard = (guard, name, fallback = false) => (context, event) => {
    try {
        return guard(context, event);
    }
    catch (error) {
        logger.error({
            error: error instanceof Error ? error.message : String(error),
            phoneNumber: `***${context.phoneNumber.slice(-4)}`,
        }, `Guard ${name} threw an error`);
        return fallback;
    }
};
// =================================================================================================
// GUARD UTILITIES COLLECTION
// =================================================================================================
/**
 * Collection of all guard utilities for easy access
 */
export const guardUtils = {
    allGuards,
    anyGuard,
    notGuard,
    alwaysTrue,
    alwaysFalse,
    logGuard,
    verboseLogGuard,
    timedGuard,
    cachedGuard,
    conditionalGuard,
    ifElseGuard,
    validateGuard,
    safeGuard,
};
//# sourceMappingURL=guardUtils.js.map
