/**
 * Matrix Account Service
 *
 * Service layer for retrieving Matrix account data from the Claims Bot Database.
 * Matrix accounts contain encrypted passwords, access tokens, and room IDs.
 *
 * Key Features:
 * - Retrieve Matrix account by customer ID
 * - Handle lazy loading (customer may not have Matrix account yet)
 * - Return decrypted credentials as Buffers (SDK handles decryption)
 * - Optional service for future Matrix-specific operations
 *
 * Usage:
 * ```typescript
 * import { getCustomerMatrixAccount } from './matrix-account-service.js';
 *
 * const matrixAccount = await getCustomerMatrixAccount('C12345678');
 * if (matrixAccount) {
 *   console.log(matrixAccount.username);           // @ixo1abc123:devmx.ixo.earth
 *   console.log(matrixAccount.roomId);             // !abc123:devmx.ixo.earth
 *   console.log(matrixAccount.encryptedPassword);  // Buffer (decrypted by SDK)
 * }
 * ```
 */

import { getClaimsBotDbClient } from "./claims-bot-db-client.js";
import { getCustomerIxoAccount } from "./ixo-account-service.js";
import { createModuleLogger } from "./logger.js";

const logger = createModuleLogger("matrix-account-service");

/**
 * Matrix Account Data returned by service
 */
export interface MatrixAccountData {
  /** IXO blockchain address (used as key for Matrix account) */
  address: string;
  /** Matrix username (e.g., @ixo1abc123:devmx.ixo.earth) */
  username: string;
  /** Encrypted password as Buffer (decrypted by SDK, ready for use) */
  encryptedPassword?: Buffer;
  /** Encrypted access token as Buffer (decrypted by SDK, ready for use) */
  encryptedAccessToken?: Buffer;
  /** Matrix room ID (e.g., !abc123:devmx.ixo.earth) */
  roomId?: string;
}

/**
 * Get customer's Matrix account from Claims Bot Database
 *
 * Retrieves the customer's Matrix account data including encrypted password, access token, and room ID.
 * The SDK automatically decrypts credentials using the configured encryption key.
 *
 * Matrix accounts are keyed by IXO address, so this function:
 * 1. First retrieves the customer's IXO account to get the address
 * 2. Then queries the Matrix account using that address
 *
 * Lazy Loading Pattern:
 * - Matrix accounts are created by the Claims Bot service when needed
 * - This service only reads existing accounts
 * - Returns null if customer doesn't have a Matrix account yet
 * - Also returns null if customer doesn't have an IXO account yet
 *
 * @param customerId - Customer ID (e.g., "C12345678")
 * @returns Matrix account data or null if not found
 * @throws Error if database query fails
 *
 * @example
 * ```typescript
 * const matrixAccount = await getCustomerMatrixAccount('C12345678');
 * if (matrixAccount) {
 *   console.log('Username:', matrixAccount.username);
 *   console.log('Room ID:', matrixAccount.roomId);
 *   // Use encryptedPassword and encryptedAccessToken for Matrix operations
 * } else {
 *   console.log('Customer does not have a Matrix account yet');
 * }
 * ```
 */
export async function getCustomerMatrixAccount(
  customerId: string
): Promise<MatrixAccountData | null> {
  try {
    logger.info(
      { customerId: customerId.slice(-4) },
      "Fetching Matrix account from Claims Bot Database"
    );

    // First get IXO account to retrieve address (Matrix accounts keyed by address)
    const ixoAccount = await getCustomerIxoAccount(customerId);

    if (!ixoAccount) {
      logger.info(
        { customerId: customerId.slice(-4) },
        "Customer does not have an IXO account, cannot retrieve Matrix account"
      );
      return null;
    }

    const db = getClaimsBotDbClient();
    const matrixAccount = await db.matrixAccounts.v1.selectMatrixAccount({
      address: ixoAccount.address,
    });

    if (!matrixAccount) {
      logger.info(
        {
          customerId: customerId.slice(-4),
          address: ixoAccount.address.slice(0, 10) + "...",
        },
        "Customer does not have a Matrix account yet (lazy loading)"
      );
      return null;
    }

    logger.info(
      {
        customerId: customerId.slice(-4),
        address: matrixAccount.address.slice(0, 10) + "...",
        username: matrixAccount.username,
        hasRoomId: !!matrixAccount.room_id,
      },
      "Matrix account retrieved successfully"
    );

    return {
      address: matrixAccount.address,
      username: matrixAccount.username,
      encryptedPassword: matrixAccount.encrypted_password,
      encryptedAccessToken: matrixAccount.encrypted_access_token,
      roomId: matrixAccount.room_id,
    };
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        customerId: customerId.slice(-4),
      },
      "Failed to fetch Matrix account from Claims Bot Database"
    );
    throw error;
  }
}
