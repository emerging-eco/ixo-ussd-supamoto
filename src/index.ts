/**
 * @fileoverview Main entry point for the USSD server.
 *
 * This module serves as the primary entry point for both development and production
 * environments. It delegates to the unified server factory for environment-aware
 * configuration and startup.
 *
 * @module index
 * @version 2.0.0
 * @since 1.0.0
 * @author USSD Server Team
 */

import { startServer } from "./server.js";
import { logger } from "./services/logger.js";

/**
 * Configure Node.js to NOT exit on unhandled rejections.
 * This is critical for preventing crashes from third-party SDKs that throw
 * errors in ways that escape traditional error handling.
 *
 * CRITICAL: The default behavior in Node.js is to EXIT the process on unhandled rejections.
 * We override this by listening to the events but NOT calling process.exit().
 */
if (process.env.NODE_ENV !== "test") {
  // Remove all existing listeners to ensure our handlers are the only ones
  process.removeAllListeners("unhandledRejection");
  process.removeAllListeners("uncaughtException");

  // Handle unhandled promise rejections - DO NOT EXIT
  process.on("unhandledRejection", (reason, promise) => {
    logger.error(
      {
        reason: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
        promise: String(promise),
      },
      "Unhandled promise rejection caught by global handler (non-fatal)"
    );
    // DO NOT exit the process - log and continue
    // This is intentional to prevent server crashes from SDK errors
  });

  // Handle uncaught exceptions - DO NOT EXIT
  process.on("uncaughtException", error => {
    logger.error(
      {
        error: error.message,
        stack: error.stack,
      },
      "Uncaught exception caught by global handler (non-fatal)"
    );
    // DO NOT exit the process - log and continue
    // This is intentional to prevent server crashes from SDK errors
  });
}

/**
 * Start the USSD server using the unified server factory.
 *
 * This delegates to the environment-aware server factory which handles
 * all configuration, plugin registration, and startup logic.
 */
startServer().catch(error => {
  // eslint-disable-next-line no-console
  console.error("❌ Failed to start USSD server:", error);
  process.exit(1);
});
