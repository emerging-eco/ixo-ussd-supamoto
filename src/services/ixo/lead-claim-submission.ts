/**
 * Lead Claim Submission Service
 *
 * Handles asynchronous lead creation claim submission to Claims Bot
 * without blocking the main account creation flow.
 */

import fs from "fs";
import path from "path";
import { createModuleLogger } from "../logger.js";
import { createClaimsBotClient, ClaimsBotTypes } from "@ixo/supamoto-bot-sdk";
import { config } from "../../config.js";

const logger = createModuleLogger("lead-claim-submission");

// Singleton claims bot client
let claimsBotClient: ReturnType<typeof createClaimsBotClient> | null = null;

function getClaimsBotClient() {
  if (!claimsBotClient) {
    claimsBotClient = createClaimsBotClient({
      botUrl: config.CLAIMS_BOT.URL,
      accessToken: config.CLAIMS_BOT.ACCESS_TOKEN,
    });
  }
  return claimsBotClient;
}

export interface LeadClaimParams {
  customerId: string;
  phoneNumber: string;
  fullName: string;
  nationalId?: string;
}

export interface LeadClaimSubmissionResult {
  success: boolean;
  claimId?: string;
  error?: string;
  duration: number;
}

/**
 * Submits lead creation claim in background with comprehensive error handling
 * Wrapped in Promise.resolve() to catch even thenable errors
 */
export async function submitLeadCreationClaim(
  params: LeadClaimParams
): Promise<LeadClaimSubmissionResult> {
  // Wrap entire function in Promise.resolve().then().catch() to ensure
  // even thenable errors are caught and don't escape to global handler
  return Promise.resolve()
    .then(async () => {
      const startTime = Date.now();

      logger.info(
        {
          customerId: params.customerId,
          phoneNumber: params.phoneNumber,
          fullName: params.fullName,
        },
        "Starting lead creation claim submission"
      );

      try {
        // Submit Lead Creation Claim via SDK with timeout
        const timeoutMs = config.CLAIMS_SUBMISSION.TIMEOUT_MS;
        const timeoutSeconds = Math.round(timeoutMs / 1000);

        const claimResult = await Promise.race([
          submitClaimToBot(params),
          new Promise<never>((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    `Claim submission timeout after ${timeoutSeconds} seconds`
                  )
                ),
              timeoutMs
            )
          ),
        ]);

        const duration = Date.now() - startTime;

        logger.info(
          {
            customerId: params.customerId,
            claimId: claimResult.claimId,
            duration,
          },
          "Lead creation claim submitted successfully"
        );

        return {
          success: true,
          claimId: claimResult.claimId,
          duration,
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        logger.error(
          {
            customerId: params.customerId,
            phoneNumber: params.phoneNumber,
            error: errorMessage,
            duration,
          },
          "Lead creation claim submission failed"
        );

        // Log failure to monitoring file
        await logClaimSubmissionFailure({
          ...params,
          error: errorMessage,
          duration,
        });

        // Queue for retry
        await queueFailedClaimForRetry(params, errorMessage);

        return {
          success: false,
          error: errorMessage,
          duration,
        };
      }
    })
    .catch(error => {
      // Final safety net for any errors that escape the inner try-catch
      // This prevents unhandled promise rejections from crashing the server
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        {
          customerId: params.customerId,
          error: errorMessage,
        },
        "Unhandled error in lead claim submission (final safety net)"
      );

      return {
        success: false,
        error: errorMessage,
        duration: 0,
      };
    });
}

/**
 * Submit claim to Claims Bot API
 */
async function submitClaimToBot(
  params: LeadClaimParams
): Promise<{ claimId: string }> {
  // Split full name into given name and family name
  const nameParts = params.fullName.trim().split(/\s+/);
  const givenName = nameParts[0] || "";
  const familyName = nameParts.slice(1).join(" ") || "";

  const claimsBot = getClaimsBotClient();

  logger.info(
    {
      customerId: params.customerId,
      leadGenerator: "USSD Signup",
    },
    "Submitting lead creation claim via SDK"
  );

  const response = await claimsBot.claims.v1.submitLeadCreationClaim({
    customerId: params.customerId,
    leadGenerator: ClaimsBotTypes.LeadGenerator.ussdSignup,
    givenName: givenName || undefined, // Only include if not empty
    familyName: familyName || undefined, // Only include if not empty
    telephone: params.phoneNumber,
    nationalId: params.nationalId || undefined,
  });

  logger.info(
    {
      customerId: params.customerId,
      claimId: response.data.claimId,
    },
    "Lead creation claim submitted successfully via SDK"
  );

  return { claimId: response.data.claimId };
}

/**
 * Queue failed claim for retry
 */
async function queueFailedClaimForRetry(
  params: LeadClaimParams,
  errorMessage: string
): Promise<void> {
  try {
    const { dataService } = await import("../database-storage.js");

    // Split full name for claim data
    const nameParts = params.fullName.trim().split(/\s+/);
    const givenName = nameParts[0] || "";
    const familyName = nameParts.slice(1).join(" ") || "";

    const claimData = {
      customerId: params.customerId,
      leadGenerator: ClaimsBotTypes.LeadGenerator.ussdSignup,
      givenName: givenName || undefined,
      familyName: familyName || undefined,
      telephone: params.phoneNumber,
      nationalId: params.nationalId || undefined,
    };

    await dataService.insertFailedClaim({
      claimType: "lead_creation",
      customerId: params.customerId,
      claimData,
      errorMessage,
      httpStatusCode: undefined,
    });

    await dataService.createAuditLog({
      eventType: "CLAIMS_SUBMISSION_FAILED",
      customerId: params.customerId,
      details: {
        claimType: "lead_creation",
        error: errorMessage,
        queuedForRetry: true,
      },
    });

    logger.info(
      {
        customerId: params.customerId,
        claimType: "lead_creation",
      },
      "Failed claim logged and queued for retry"
    );
  } catch (dbError) {
    logger.error(
      {
        error: dbError instanceof Error ? dbError.message : String(dbError),
        customerId: params.customerId,
      },
      "Failed to queue claim for retry (non-critical)"
    );
  }
}

/**
 * Log claim submission failure to monitoring file
 */
async function logClaimSubmissionFailure(params: {
  customerId: string;
  phoneNumber: string;
  fullName: string;
  nationalId?: string;
  error: string;
  duration: number;
}): Promise<void> {
  try {
    const logDir = path.join(process.cwd(), "logs");
    const logFile = path.join(logDir, "claim-submission-failures.log");

    // Ensure log directory exists
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      customerId: params.customerId,
      phoneNumber: params.phoneNumber,
      fullName: params.fullName,
      nationalId: params.nationalId,
      error: params.error,
      duration: params.duration,
    };

    fs.appendFileSync(logFile, JSON.stringify(logEntry) + "\n");

    logger.info(
      { customerId: params.customerId },
      "Claim submission failure logged to file"
    );
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        customerId: params.customerId,
      },
      "Failed to write claim submission failure log"
    );
  }
}
