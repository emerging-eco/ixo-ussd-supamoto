/**
 * Supamoto Database Client Service
 *
 * Provides access to the @ixo/supamoto-bot-sdk Database Client for fetching
 * decrypted customer data. This client automatically handles encryption/decryption
 * of sensitive fields.
 *
 * Key Features:
 * - Singleton pattern for efficient connection pooling
 * - Automatic encryption/decryption of customer data
 * - Returns ICustomerDecrypted with all fields as strings (not Buffers)
 * - Direct PostgreSQL access with type safety
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

    logger.info("Initializing Supamoto Database Client");

    dbClient = createDatabaseClient(
      {
        user: config.DATABASE.PG.user,
        password: config.DATABASE.PG.password,
        host: config.DATABASE.PG.host,
        database: config.DATABASE.PG.database,
        port: config.DATABASE.PG.port,
        ssl: false,
        // Connection pool configuration
        max: 20, // Maximum number of clients in pool
        min: 5, // Minimum number of clients in pool
        idleTimeoutMillis: 30000, // Idle timeout
        connectionTimeoutMillis: 2000, // Connection timeout
      },
      encryptionKey // Base64-encoded encryption key
    );

    logger.info("Supamoto Database Client initialized successfully");
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
