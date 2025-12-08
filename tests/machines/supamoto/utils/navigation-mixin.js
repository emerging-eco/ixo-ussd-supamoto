/**
 * Navigation Mixin - Adds universal back/exit handling to states
 */
/**
 * Adds universal navigation transitions to existing INPUT handlers
 */
export function withNavigation(existingInputHandlers, options = {}) {
    const { backTarget = "preMenu", exitTarget = "closeSession", enableBack = true, enableExit = true, } = options;
    const navigationHandlers = [];
    // Add back handler
    if (enableBack) {
        navigationHandlers.push({
            target: backTarget,
            guard: "isBack",
            actions: "clearErrors",
        });
    }
    // Add exit handler
    if (enableExit) {
        navigationHandlers.push({
            target: exitTarget,
            guard: "isExit",
            actions: "clearErrors",
        });
    }
    // Return: navigation handlers first, then existing handlers
    // This ensures navigation commands are checked before catch-all handlers
    return [...navigationHandlers, ...existingInputHandlers];
}
//# sourceMappingURL=navigation-mixin.js.map
