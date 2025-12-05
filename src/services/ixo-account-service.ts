/**
 * IXO Account Service
 *
 * Service layer for retrieving IXO account data from the Claims Bot Database.
 * IXO accounts contain encrypted mnemonics, DIDs, and blockchain addresses.
 *
 * Key Features:
 * - Retrieve IXO account by customer ID
 * - Handle lazy loading (customer may not have IXO account yet)
 * - Select primary account when multiple accounts exist
 * - Return decrypted mnemonic as Buffer (SDK handles decryption)
 *
 * Usage:
 * ```typescript
 * import { getCustomerIxoAccount } from './ixo-account-service.js';
 *
 * const ixoAccount = await getCustomerIxoAccount('C12345678');
 * if (ixoAccount) {
 *   console.log(ixoAccount.address);           // ixo1abc123...
 *   console.log(ixoAccount.did);               // did:ixo:123
 *   console.log(ixoAccount.encryptedMnemonic); // Buffer (decrypted by SDK)
 * }
 * ```
 */

import { getClaimsBotDbClient } from "./claims-bot-db-client.js";
import { createModuleLogger } from "./logger.js";

const logger = createModuleLogger("ixo-account-service");

/**
 * IXO Account Data returned by service
 */
export interface IxoAccountData {
  /** Blockchain address (e.g., ixo1abc123...) */
  address: string;
  /** Decentralized Identifier (e.g., did:ixo:123) */
  did: string;
  /** Encrypted mnemonic as Buffer (decrypted by SDK, ready for use) */
  encryptedMnemonic: Buffer;
  /** Whether this is the primary account for the customer */
  isPrimary: boolean;
}

/**
 * Get customer's IXO account from Claims Bot Database
 *
 * Retrieves the customer's IXO account data including encrypted mnemonic, DID, and address.
 * The SDK automatically decrypts the mnemonic using the configured encryption key.
 *
 * Lazy Loading Pattern:
 * - IXO accounts are created by the Claims Bot service when needed
 * - This service only reads existing accounts
 * - Returns null if customer doesn't have an IXO account yet
 *
 * Primary Account Selection:
 * - If customer has multiple IXO accounts, returns the primary account
 * - If no primary account is set, returns the first account
 * - Most customers will only have one account
 *
 * @param customerId - Customer ID (e.g., "C12345678")
 * @returns IXO account data or null if not found
 * @throws Error if database query fails
 *
 * @example
 * ```typescript
 * const ixoAccount = await getCustomerIxoAccount('C12345678');
 * if (ixoAccount) {
 *   console.log('Address:', ixoAccount.address);
 *   console.log('DID:', ixoAccount.did);
 *   console.log('Is Primary:', ixoAccount.isPrimary);
 *   // Use encryptedMnemonic for signing transactions
 * } else {
 *   console.log('Customer does not have an IXO account yet');
 * }
 * ```
 */
export async function getCustomerIxoAccount(
  customerId: string
): Promise<IxoAccountData | null> {
  try {
    logger.info(
      { customerId: customerId.slice(-4) },
      "Fetching IXO account from Claims Bot Database"
    );

    const db = getClaimsBotDbClient();
    const ixoAccounts = await db.ixoAccounts.v1.selectIxoAccountsByCustomerId({
      customerId,
    });

    if (!ixoAccounts || ixoAccounts.length === 0) {
      logger.info(
        { customerId: customerId.slice(-4) },
        "Customer does not have an IXO account yet (lazy loading)"
      );
      return null;
    }

    // Select primary account if available, otherwise first account
    const selectedAccount =
      ixoAccounts.find(account => account.is_primary) || ixoAccounts[0];

    logger.info(
      {
        customerId: customerId.slice(-4),
        address: selectedAccount.address.slice(0, 10) + "...",
        did: selectedAccount.did,
        isPrimary: selectedAccount.is_primary,
        totalAccounts: ixoAccounts.length,
      },
      "IXO account retrieved successfully"
    );

    return {
      address: selectedAccount.address,
      did: selectedAccount.did,
      encryptedMnemonic: selectedAccount.encrypted_mnemonic,
      isPrimary: selectedAccount.is_primary,
    };
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        customerId: customerId.slice(-4),
      },
      "Failed to fetch IXO account from Claims Bot Database"
    );
    throw error;
  }
}
