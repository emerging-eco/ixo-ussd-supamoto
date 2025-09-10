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

import { getIxoConfig } from "./config.js";
// LEADGEN defaults (can be overridden by env)
process.env.LEADGEN_COLLECTION_ID ??= "410";
process.env.LEADGEN_TEMPLATE_URL ??=
  "https://devmx.ixo.earth/_matrix/media/v3/download/devmx.ixo.earth/LWCamzPswXpgrfwyyJvcjzoK";
import { submitClaim } from "./ixo-claims.js";
import { sha256 } from "@cosmjs/crypto";
import { toHex } from "@cosmjs/encoding";
const logger = createModuleLogger("background-ixo");

export interface BackgroundIxoParams {
  customerId: string;
  customerRecordId: number;
  phoneNumber: string;
  fullName: string;
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
 */
export async function createIxoAccountBackground(
  params: BackgroundIxoParams
): Promise<IxoCreationResult> {
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

    // Step 3: Submit LeadGeneration Claim (non-blocking failure)
    try {
      const config = getIxoConfig();
      // Build deterministic claimId from customerId + template URL to avoid duplicates
      const templateUrl =
        process.env.LEADGEN_TEMPLATE_URL ||
        "https://devmx.ixo.earth/_matrix/media/v3/download/devmx.ixo.earth/LWCamzPswXpgrfwyyJvcjzoK";
      const claimId = toHex(
        sha256(new TextEncoder().encode(`${params.customerId}|${templateUrl}`))
      );

      const claimValue: any = {
        collectionId: process.env.LEADGEN_COLLECTION_ID || "410",
        claimId,
        agentDid: ixoResult.did,
        agentAddress: ixoResult.address,
        // you may set adminAddress if required by collection admin checks
        // adminAddress: ixoResult.address,
        useIntent: false,
        // Optionally include Coin amounts if collection requires payments override
        amount: [],
        cw20Payment: [],
        // Additional metadata can be included via protocol VC/evidence referencing the templateUrl
        // e.g., evidenceCid / metadata reference stored elsewhere
      };

      if (!claimValue.collectionId) {
        logger.warn(
          { customerId: params.customerId },
          "LEADGEN_COLLECTION_ID is not set — skipping LeadGeneration claim submission"
        );
      } else {
        const result = await submitClaim({
          mnemonic: ixoResult.mnemonic,
          chainRpcUrl: config.chainRpcUrl,
          claim: claimValue,
          memo: `LeadGeneration for ${params.customerId}`,
          feegranter: config.feegrantGranter,
        });
        logger.info(
          {
            customerId: params.customerId,
            txHash: result.transactionHash,
            height: result.height,
          },
          "LeadGeneration claim submitted"
        );
      }
    } catch (claimError) {
      logger.warn(
        {
          error:
            claimError instanceof Error
              ? claimError.message
              : String(claimError),
          customerId: params.customerId,
        },
        "LeadGeneration claim submission failed (non-critical)"
      );
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
    const errorMessage = error instanceof Error ? error.message : String(error);

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
