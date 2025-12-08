/**
 * Common navigation patterns for different state types
 */
export const NavigationPatterns = {
    // For main menu states - exit only
    mainMenu: {
        enableBack: false,
        enableExit: true,
        exitTarget: "closeSession",
    },
    // For authentication flows - back to account menu
    authentication: {
        enableBack: true,
        enableExit: true,
        backTarget: "accountMenu",
        exitTarget: "closeSession",
    },
    // For service flows - back to main menu
    service: {
        enableBack: true,
        enableExit: true,
        backTarget: "preMenu",
        exitTarget: "closeSession",
    },
    // For agent flows - back to agent menu
    agent: {
        enableBack: true,
        enableExit: true,
        backTarget: "agentMainMenu",
        exitTarget: "closeSession",
    },
    // For error states - back to main menu
    error: {
        enableBack: true,
        enableExit: true,
        backTarget: "preMenu",
        exitTarget: "closeSession",
    },
    // For processing states - no navigation
    processing: {
        enableBack: false,
        enableExit: false,
    },
    // =================================================================================================
    // CHILD MACHINE PATTERNS
    // =================================================================================================
    // For information child machines - route back to main
    informationChild: {
        enableBack: true,
        enableExit: true,
        backTarget: "routeToMain",
        exitTarget: "routeToMain",
    },
    // For user services child machines - route back to main
    userServicesChild: {
        enableBack: true,
        enableExit: true,
        backTarget: "routeToMain",
        exitTarget: "routeToMain",
    },
    // For agent child machines - route back to main
    agentChild: {
        enableBack: true,
        enableExit: true,
        backTarget: "routeToMain",
        exitTarget: "routeToMain",
    },
    // For account creation child machines - cancel and route to main
    accountMenuChild: {
        enableBack: true,
        enableExit: true,
        backTarget: "routeToMain",
        exitTarget: "routeToMain",
    },
    // For account creation child machines - cancel and route to main
    accountCreationChild: {
        enableBack: true,
        enableExit: true,
        backTarget: "routeToMain",
        exitTarget: "routeToMain",
    },
    // For login child machines - cancel and route to main
    loginChild: {
        enableBack: true,
        enableExit: true,
        backTarget: "routeToMain",
        exitTarget: "routeToMain",
    },
    // For nested child states - back to parent state within same machine
    nestedChild: {
        enableBack: true,
        enableExit: true,
        // backTarget and exitTarget should be specified per use case
    },
};
//# sourceMappingURL=navigation-patterns.js.map
