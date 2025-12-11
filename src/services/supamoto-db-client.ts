/**
 * Supamoto Database Client Service
 *
 * Provides access to the @ixo/supamoto-bot-sdk Database Client for the Claims Bot Database (supamoto_db).
 * This client automatically handles encryption/decryption of sensitive fields.
 *
 * IMPORTANT: This connects to the Claims Bot Database (supamoto_db), NOT the USSD database (ixo-ussd-dev).
 *
 * Key Features:
 * - Singleton pattern for efficient connection pooling
 * - Automatic encryption/decryption of customer data
 * - Returns ICustomerDecrypted with all fields as strings (not Buffers)
 * - Direct PostgreSQL access with type safety
 * - Read-only access to Claims Bot Database
 *
 * Usage:
 * ```typescript
 * import { getDecryptedCustomerData } from './supamoto-db-client.js';
 *
 * const customerData = await getDecryptedCustomerData('C12345678');
 * console.log(customerData.full_name); // string (decrypted)
 * console.log(customerData.email);     // string (decrypted)
 * ```
 */

import { createDatabaseClient, DbTypes } from "@ixo/supamoto-bot-sdk";
import { config } from "../config.js";
import { createModuleLogger } from "./logger.js";

type ICustomerDecrypted = DbTypes.ICustomerDecrypted;

const logger = createModuleLogger("supamoto-db");

// Singleton database client
let dbClient: ReturnType<typeof createDatabaseClient> | null = null;

/**
 * Get or create the Supamoto Database Client singleton
 *
 * IMPORTANT: This connects to the Claims Bot Database (supamoto_db), NOT the USSD database.
 *
 * The Database Client provides direct PostgreSQL access with automatic
 * encryption/decryption of sensitive fields using the configured encryption key.
 *
 * @returns Database client instance
 * @throws Error if CLAIMS_BOT_DB_ENCRYPTION_KEY is not configured
 */
export function getSupamotoDbClient() {
  if (!dbClient) {
    // Get encryption key from config
    const encryptionKey = config.CLAIMS_BOT.DB_ENCRYPTION_KEY;

    if (!encryptionKey) {
      throw new Error(
        "CLAIMS_BOT_DB_ENCRYPTION_KEY must be configured to use the Database Client"
      );
    }

    logger.info(
      "Initializing Supamoto Database Client for Claims Bot Database (supamoto_db)"
    );

    dbClient = createDatabaseClient(
      {
        user: config.CLAIMS_BOT_DB.user,
        password: config.CLAIMS_BOT_DB.password,
        host: config.CLAIMS_BOT_DB.host,
        database: config.CLAIMS_BOT_DB.database,
        port: config.CLAIMS_BOT_DB.port,
        ssl: config.CLAIMS_BOT_DB.ssl ? { rejectUnauthorized: false } : false,
        // Connection pool configuration
        max: 20, // Maximum number of clients in pool
        min: 5, // Minimum number of clients in pool
        idleTimeoutMillis: 30000, // Idle timeout
        connectionTimeoutMillis: 2000, // Connection timeout
      },
      encryptionKey // Base64-encoded encryption key
    );

    logger.info(
      "Supamoto Database Client initialized successfully for Claims Bot Database"
    );
  }

  return dbClient;
}

/**
 * Get decrypted customer data by customer ID
 *
 * Fetches customer data from the database and automatically decrypts all
 * sensitive fields. Returns ICustomerDecrypted with all fields as strings
 * (not Buffers).
 *
 * @param customerId - Customer ID (e.g., "C12345678")
 * @returns Decrypted customer data or null if not found
 * @throws Error if database query fails
 *
 * @example
 * ```typescript
 * const customer = await getDecryptedCustomerData('C12345678');
 * if (customer) {
 *   console.log(customer.full_name);    // string (decrypted)
 *   console.log(customer.email);        // string (decrypted)
 *   console.log(customer.national_id);  // string (decrypted)
 *   console.log(customer.status);       // 'active' | 'inactive' | etc.
 * }
 * ```
 */
export async function getDecryptedCustomerData(
  customerId: string
): Promise<ICustomerDecrypted | null> {
  const db = getSupamotoDbClient();

  try {
    logger.info(
      { customerId: customerId.slice(-4) },
      "Fetching decrypted customer data from SDK"
    );

    const customer = await db.customers.v1.selectCustomer({ customerId });

    if (!customer) {
      logger.warn(
        { customerId: customerId.slice(-4) },
        "Customer not found in database"
      );
      return null;
    }

    logger.info(
      {
        customerId: customer.customer_id,
        status: customer.status,
        hasFullName: !!customer.full_name,
        hasEmail: !!customer.email,
        hasNationalId: !!customer.national_id,
        hasAddress: !!customer.address,
      },
      "Customer data retrieved and decrypted successfully"
    );

    return customer;
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        customerId: customerId.slice(-4),
      },
      "Failed to fetch decrypted customer data"
    );
    throw error;
  }
}
