/**
 * Claims Bot Database Client Service
 *
 * Provides singleton access to the @ixo/supamoto-bot-sdk Database Client for the Claims Bot Database (supamoto_db).
 * This client automatically handles encryption/decryption of sensitive fields.
 *
 * IMPORTANT: This connects to the Claims Bot Database (supamoto_db), NOT the USSD database (ixo-ussd-dev).
 *
 * Key Features:
 * - Singleton pattern for efficient connection pooling
 * - Automatic encryption/decryption of IXO account data (mnemonics, DIDs)
 * - Automatic encryption/decryption of Matrix account data (passwords, access tokens)
 * - Direct PostgreSQL access with type safety
 * - Read-only access to Claims Bot Database
 *
 * Usage:
 * ```typescript
 * import { getClaimsBotDbClient } from './claims-bot-db-client.js';
 *
 * const db = getClaimsBotDbClient();
 * const ixoAccounts = await db.ixoAccounts.v1.selectIxoAccountsByCustomerId({ customerId: 'C12345678' });
 * ```
 */

import { createDatabaseClient, DbTypes } from "@ixo/supamoto-bot-sdk";
import { config } from "../config.js";
import { createModuleLogger } from "./logger.js";

// Export types from SDK for convenience
export type IIxoAccount = DbTypes.IIxoAccount;
export type IMatrixAccount = DbTypes.IMatrixAccount;
export type IClaim = DbTypes.IClaim;
export type ICustomerDecrypted = DbTypes.ICustomerDecrypted;

const logger = createModuleLogger("claims-bot-db");

// Singleton database client
let dbClient: ReturnType<typeof createDatabaseClient> | null = null;

/**
 * Get or create the Claims Bot Database Client singleton
 *
 * IMPORTANT: This connects to the Claims Bot Database (supamoto_db), NOT the USSD database.
 *
 * The Database Client provides direct PostgreSQL access with automatic
 * encryption/decryption of sensitive fields using the configured encryption key.
 *
 * Connection pool configuration:
 * - Max connections: 10 (lower than USSD DB since this is read-only)
 * - Min connections: 0 (lazy connection - only connect when needed)
 * - Idle timeout: 30 seconds
 * - Connection timeout: 10 seconds
 * - Query timeout: 30 seconds
 *
 * @returns Database client instance
 * @throws Error if CLAIMS_BOT_DB_ENCRYPTION_KEY is not configured
 * @throws Error if Claims Bot Database connection parameters are missing
 */
export function getClaimsBotDbClient() {
  if (!dbClient) {
    // Get encryption key from config
    const encryptionKey = config.CLAIMS_BOT.DB_ENCRYPTION_KEY;

    if (!encryptionKey) {
      throw new Error(
        "CLAIMS_BOT_DB_ENCRYPTION_KEY must be configured to use the Claims Bot Database Client"
      );
    }

    // Validate database connection parameters
    if (!config.CLAIMS_BOT_DB.host || !config.CLAIMS_BOT_DB.database) {
      throw new Error(
        "Claims Bot Database connection parameters (CLAIMS_BOT_DB_HOST, CLAIMS_BOT_DB_NAME) must be configured"
      );
    }

    logger.info(
      {
        host: config.CLAIMS_BOT_DB.host,
        port: config.CLAIMS_BOT_DB.port,
        database: config.CLAIMS_BOT_DB.database,
        user: config.CLAIMS_BOT_DB.user,
      },
      "Initializing Claims Bot Database Client"
    );

    dbClient = createDatabaseClient(
      {
        user: config.CLAIMS_BOT_DB.user,
        password: config.CLAIMS_BOT_DB.password,
        host: config.CLAIMS_BOT_DB.host,
        database: config.CLAIMS_BOT_DB.database,
        port: config.CLAIMS_BOT_DB.port,
        ssl: config.CLAIMS_BOT_DB.ssl ? { rejectUnauthorized: false } : false,
        // Connection pool configuration (read-only access, lower limits)
        max: 10, // Maximum number of clients in pool
        min: 0, // Minimum number of clients (lazy connection - only connect when needed)
        idleTimeoutMillis: 30000, // Idle timeout (30 seconds)
        connectionTimeoutMillis: 10000, // Connection timeout (10 seconds)
        query_timeout: 30000, // Query timeout (30 seconds)
      },
      encryptionKey // Base64-encoded encryption key
    );

    logger.info("Claims Bot Database Client initialized successfully");
  }

  return dbClient;
}
