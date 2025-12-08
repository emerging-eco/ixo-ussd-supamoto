/**
 * Unified Types for the generic App Machine
 *
 * This file defines all context, event, and utility types for the unified
 * machine that combines IXO wallet functionality with generic business operations.
 */
/**
 * Context Initialization and Utility Functions
 */
/**
 * Create initial context for App Machine
 * Provides safe defaults for all context fields
 */
export function createInitialContext(input) {
    return {
        // Session metadata
        sessionId: input.sessionId ||
            `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        phoneNumber: input.phoneNumber,
        serviceCode: input.serviceCode || "*483*7#",
        language: input.language || "eng",
        message: "Welcome to USSD Supamoto App...",
        // User state tracking
        userState: {
            hasIxoAccount: false,
            isWalletSetupComplete: false,
            isAgentLoggedIn: false,
            rateLimited: false,
        },
        // IXO-specific data
        ixo: {
            addresses: [],
            selectedAddress: undefined,
            matrixSession: undefined,
            pin: undefined,
            pinAttempts: 0,
            sendRecipient: undefined,
            sendAmount: undefined,
            sendResult: undefined,
            balance: undefined,
            newDisplayName: undefined,
            username: undefined,
            displayName: undefined,
            lastActivityTimestamp: new Date().toISOString(),
            dailyTransactionCount: 0,
            dailyTransactionVolume: 0,
            validationError: undefined,
            error: undefined,
        },
        // App-specific data
        supamoto: {
            user: undefined,
            agentId: undefined,
            agentPin: undefined,
            selectedProvince: undefined,
            selectedArea: undefined,
            selectedDistrict: undefined,
            selectedBag: undefined,
            selectedAccessory: undefined,
            selectedContract: undefined,
            selectedVoucher: undefined,
            voucherType: undefined,
            voucherAmount: undefined,
            topUpAmount: undefined,
            mobileMoneyNumber: undefined,
            balance: undefined,
            paymentMethod: undefined,
            orderId: undefined,
            orderStatus: undefined,
            deliveryAddress: undefined,
            orderType: undefined,
            usagePeriod: undefined,
            savingsPeriod: undefined,
            carbonPeriod: undefined,
            totalUsage: undefined,
            averageUsage: undefined,
            moneySaved: undefined,
            fuelSaved: undefined,
            co2Saved: undefined,
            treesEquivalent: undefined,
            faultDescription: undefined,
            faultType: undefined,
            faultStatus: undefined,
            faultId: undefined,
            contracts: [],
            selectedContractIndex: undefined,
            selectedInfo: undefined,
        },
        // Shared/temporary data
        temp: {
            validationError: undefined,
            error: undefined,
            pinAttempts: 0,
            loginAttempts: 0,
            previousState: undefined,
            returnToState: undefined,
            isProcessing: false,
            lastAction: undefined,
            pinForVerification: undefined,
            transactionAmount: undefined,
            mobileMoneyNumber: undefined,
        },
    };
}
/**
 * Deep merge utility for context updates
 * Safely merges partial context updates without losing existing data
 */
export function mergeContextUpdate(currentContext, update) {
    return {
        ...currentContext,
        message: update.message ?? currentContext.message,
        userState: update.userState
            ? { ...currentContext.userState, ...update.userState }
            : currentContext.userState,
        ixo: update.ixo
            ? { ...currentContext.ixo, ...update.ixo }
            : currentContext.ixo,
        supamoto: update.supamoto
            ? { ...currentContext.supamoto, ...update.supamoto }
            : currentContext.supamoto,
        temp: update.temp
            ? { ...currentContext.temp, ...update.temp }
            : currentContext.temp,
    };
}
/**
 * Validate context integrity
 * Ensures required fields are present and valid
 */
export function validateContext(context) {
    const errors = [];
    // Validate required session fields
    if (!context.sessionId) {
        errors.push("Missing sessionId");
    }
    if (!context.phoneNumber) {
        errors.push("Missing phoneNumber");
    }
    if (!context.serviceCode) {
        errors.push("Missing serviceCode");
    }
    if (!context.language) {
        errors.push("Missing language");
    }
    // Validate userState structure
    if (!context.userState) {
        errors.push("Missing userState");
    }
    else {
        if (typeof context.userState.hasIxoAccount !== "boolean") {
            errors.push("Invalid userState.hasIxoAccount");
        }
        if (typeof context.userState.isWalletSetupComplete !== "boolean") {
            errors.push("Invalid userState.isWalletSetupComplete");
        }
        if (typeof context.userState.isAgentLoggedIn !== "boolean") {
            errors.push("Invalid userState.isAgentLoggedIn");
        }
    }
    // Validate context structure
    if (!context.ixo) {
        errors.push("Missing ixo context");
    }
    if (!context.supamoto) {
        errors.push("Missing supamoto context");
    }
    if (!context.temp) {
        errors.push("Missing temp context");
    }
    return {
        isValid: errors.length === 0,
        errors,
    };
}
/**
 * Reset a specific section of the context to defaults
 */
export function resetContextSection(context, section) {
    const defaults = createInitialContext({
        phoneNumber: context.phoneNumber,
        sessionId: context.sessionId,
        serviceCode: context.serviceCode,
        language: context.language,
    });
    return {
        ...context,
        [section]: defaults[section],
    };
}
/**
 * Sanitize context for logging (remove sensitive data)
 */
export function sanitizeContextForLogging(context) {
    return {
        sessionId: context.sessionId,
        phoneNumber: `***${context.phoneNumber.slice(-4)}`,
        serviceCode: context.serviceCode,
        language: context.language,
        userState: context.userState,
        // Omit sensitive sections
        temp: {
            validationError: context.temp.validationError,
            error: context.temp.error,
            isProcessing: context.temp.isProcessing,
            rateLimited: context.temp.rateLimited,
        },
    };
}
//# sourceMappingURL=types.js.map
