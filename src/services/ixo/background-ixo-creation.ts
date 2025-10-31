/**
 * Background IXO Account Creation Service
 *
 * Handles asynchronous IXO account creation and database persistence
 * without blocking the main account creation flow.
 */

import fs from "fs";
import path from "path";
import { db } from "../../db/index.js";
import { encrypt } from "../../utils/encryption.js";
import { createModuleLogger } from "../logger.js";
import { createIxoAccount } from "./ixo-profile.js";
import { MatrixResult } from "./matrix-storage.js";
import { createClaimsBotClient, ClaimsBotTypes } from "@ixo/supamoto-bot-sdk";
import { config } from "../../config.js";

const logger = createModuleLogger("background-ixo");

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

export interface BackgroundIxoParams {
  customerId: string;
  customerRecordId: number;
  phoneNumber: string;
  fullName: string;
  nationalId?: string;
  pin: string;
}

export interface IxoCreationResult {
  success: boolean;
  ixoProfileId?: number;
  ixoAccountId?: number;
  matrixVaultId?: number;
  error?: string;
  duration: number;
}

/**
 * Creates IXO account in background with comprehensive error handling
 * Wrapped in Promise.resolve() to catch even thenable errors
 */
export async function createIxoAccountBackground(
  params: BackgroundIxoParams
): Promise<IxoCreationResult> {
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
        "Starting background IXO account creation"
      );

      try {
        // Step 1: Create IXO account with timeout
        const ixoResult = await Promise.race([
          createIxoAccount({
            userId: params.customerId,
            pin: params.pin,
            lastMenuLocation: "account_creation",
            lastCompletedAction: "account_creation",
          }),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("IXO creation timeout after 60 seconds")),
              60000
            )
          ),
        ]);

        logger.info(
          {
            customerId: params.customerId,
            address: ixoResult.address,
            did: ixoResult.did,
          },
          "IXO account created successfully"
        );

        // Step 2: Save to database
        const dbResult = await saveIxoAccountData(ixoResult, params);

        // Step 3: Submit Lead Creation Claim via SDK (non-blocking failure)
        // Split full name into given name and family name (outside try block for catch access)
        const nameParts = params.fullName.trim().split(/\s+/);
        const givenName = nameParts[0] || "";
        const familyName = nameParts.slice(1).join(" ") || "";

        try {
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
            // leadGeneratorName: undefined,  // Not applicable for USSD signup
          });

          logger.info(
            {
              customerId: params.customerId,
              claimId: response.data.claimId,
            },
            "Lead creation claim submitted successfully via SDK"
          );
        } catch (claimError) {
          // Comprehensive error handling to prevent server crash
          try {
            // Convert error to plain object immediately to prevent promise escape
            const errorMessage =
              claimError instanceof Error
                ? claimError.message
                : typeof claimError === "object" && claimError !== null
                  ? JSON.stringify(claimError)
                  : String(claimError);

            // Extract HTTP status code if available
            const httpStatusCode =
              (claimError as any)?.response?.status ||
              (claimError as any)?.statusCode ||
              undefined;

            const errorDetails: any = {
              error: errorMessage,
              customerId: params.customerId,
              httpStatusCode,
            };

            // Add HTTP-specific error details if available
            if ((claimError as any)?.response) {
              errorDetails.responseData = (claimError as any).response.data;
            }

            logger.warn(
              errorDetails,
              "Lead creation claim submission failed (non-critical)"
            );

            // Prepare claim data for retry queue
            const claimData = {
              customerId: params.customerId,
              leadGenerator: ClaimsBotTypes.LeadGenerator.ussdSignup,
              givenName: givenName || undefined,
              familyName: familyName || undefined,
              telephone: params.phoneNumber,
              nationalId: params.nationalId || undefined,
            };

            // Log to file for monitoring
            await logClaimsSubmissionFailure({
              customerId: params.customerId,
              claimType: "lead_creation",
              error: errorMessage,
              httpStatusCode,
              retryCount: 0,
            });

            // Queue for retry
            const { dataService } = await import("../database-storage.js");
            await dataService.insertFailedClaim({
              claimType: "lead_creation",
              customerId: params.customerId,
              claimData,
              errorMessage,
              httpStatusCode,
            });

            // Create audit log entry
            await dataService.createAuditLog({
              eventType: "CLAIMS_SUBMISSION_FAILED",
              customerId: params.customerId,
              details: {
                claimType: "lead_creation",
                error: errorMessage,
                httpStatusCode,
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
          } catch (handlingError) {
            // Final safety net - log but don't throw
            logger.error(
              {
                error:
                  handlingError instanceof Error
                    ? handlingError.message
                    : String(handlingError),
                customerId: params.customerId,
              },
              "Error while handling claims submission failure (non-critical)"
            );
          }
        }
        const duration = Date.now() - startTime;

        logger.info(
          {
            customerId: params.customerId,
            ixoProfileId: dbResult.ixoProfileId,
            ixoAccountId: dbResult.ixoAccountId,
            matrixVaultId: dbResult.matrixVaultId,
            duration,
          },
          "Background IXO account creation completed successfully"
        );

        return {
          success: true,
          ixoProfileId: dbResult.ixoProfileId,
          ixoAccountId: dbResult.ixoAccountId,
          matrixVaultId: dbResult.matrixVaultId,
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
          "Background IXO account creation failed"
        );

        // Log failure to monitoring file
        await logIxoCreationFailure({
          ...params,
          error: errorMessage,
          duration,
        });

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
        "Unhandled error in background IXO creation (final safety net)"
      );

      return {
        success: false,
        error: errorMessage,
        duration: Date.now() - Date.now(), // Approximate
      };
    });
}

/**
 * Saves IXO account data to database with transaction support
 */
async function saveIxoAccountData(
  ixoResult: {
    userId: string;
    mnemonic: string;
    address: string;
    did: string;
    matrix?: MatrixResult;
  },
  params: BackgroundIxoParams
): Promise<{
  ixoProfileId: number;
  ixoAccountId: number;
  matrixVaultId?: number;
}> {
  return await db.transaction().execute(async trx => {
    // Step 1: Create IXO profile
    const ixoProfile = await trx
      .insertInto("ixo_profiles")
      .values({
        customer_id: params.customerRecordId,
        household_id: null, // Individual account
        did: ixoResult.did,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    logger.info(
      { ixoProfileId: ixoProfile.id, customerId: params.customerId },
      "IXO profile created"
    );

    // Step 2: Create IXO account
    const encryptedMnemonic = encrypt(ixoResult.mnemonic, params.pin);

    const ixoAccount = await trx
      .insertInto("ixo_accounts")
      .values({
        ixo_profile_id: ixoProfile.id!,
        address: ixoResult.address,
        encrypted_mnemonic: encryptedMnemonic,
        is_primary: true, // First account is primary
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    logger.info(
      { ixoAccountId: ixoAccount.id, address: ixoResult.address },
      "IXO account created"
    );

    // Step 3: Create Matrix vault (if Matrix data is available)
    let matrixVaultId: number | undefined;

    if (ixoResult.matrix) {
      try {
        const encryptedPassword = encrypt(
          ixoResult.matrix.mxPassword,
          params.pin
        );

        const matrixVault = await trx
          .insertInto("matrix_vaults")
          .values({
            ixo_profile_id: ixoProfile.id!,
            username: ixoResult.matrix.mxUsername,
            encrypted_password: encryptedPassword,
            created_at: new Date(),
            updated_at: new Date(),
          })
          .returning("id")
          .executeTakeFirstOrThrow();

        matrixVaultId = matrixVault.id;

        logger.info(
          {
            matrixVaultId: matrixVault.id,
            username: ixoResult.matrix.mxUsername,
            ixoProfileId: ixoProfile.id,
          },
          "Matrix vault created successfully"
        );
      } catch (matrixError) {
        logger.warn(
          {
            error:
              matrixError instanceof Error
                ? matrixError.message
                : String(matrixError),
            ixoProfileId: ixoProfile.id,
            username: ixoResult.matrix.mxUsername,
          },
          "Matrix vault creation failed (non-critical)"
        );
      }
    } else {
      logger.info(
        { ixoProfileId: ixoProfile.id },
        "Matrix vault creation skipped (no Matrix data available)"
      );
    }

    return {
      ixoProfileId: ixoProfile.id!,
      ixoAccountId: ixoAccount.id!,
      matrixVaultId,
    };
  });
}

/**
 * Logs IXO creation failures to monitoring file
 */
async function logIxoCreationFailure(
  params: BackgroundIxoParams & { error: string; duration: number }
): Promise<void> {
  try {
    const logDir = "./logs";
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logFile = path.join(logDir, "ixo-creation-failures.log");
    const logEntry = {
      timestamp: new Date().toISOString(),
      phoneNumber: params.phoneNumber,
      customerId: params.customerId,
      error: params.error,
      duration: params.duration,
      step: params.error.includes("timeout")
        ? "timeout"
        : params.error.includes("database")
          ? "database_save"
          : "ixo_creation",
    };

    const logLine = JSON.stringify(logEntry) + "\n";

    fs.appendFileSync(logFile, logLine);

    logger.info(
      { logFile, customerId: params.customerId },
      "IXO creation failure logged to monitoring file"
    );
  } catch (logError) {
    logger.error(
      {
        error: logError instanceof Error ? logError.message : String(logError),
        customerId: params.customerId,
      },
      "Failed to log IXO creation failure"
    );
  }
}

/**
 * Logs claims submission failures to monitoring file
 */
async function logClaimsSubmissionFailure(params: {
  customerId: string;
  claimType: "lead_creation" | "1000_day_household";
  error: string;
  httpStatusCode?: number;
  retryCount: number;
}): Promise<void> {
  try {
    const logDir = "./logs";
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logFile = path.join(logDir, "claims-submission-failures.log");
    const logEntry = {
      timestamp: new Date().toISOString(),
      customerId: params.customerId,
      claimType: params.claimType,
      error: params.error,
      httpStatusCode: params.httpStatusCode,
      retryCount: params.retryCount,
    };

    const logLine = JSON.stringify(logEntry) + "\n";

    fs.appendFileSync(logFile, logLine);

    logger.info(
      { logFile, customerId: params.customerId, claimType: params.claimType },
      "Claims submission failure logged to monitoring file"
    );
  } catch (logError) {
    logger.error(
      {
        error: logError instanceof Error ? logError.message : String(logError),
        customerId: params.customerId,
      },
      "Failed to log claims submission failure"
    );
  }
}
