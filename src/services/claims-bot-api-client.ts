/**
 * Claims Bot Collection ID Service
 *
 * Provides helper functions for retrieving customer collection IDs from the Claims Bot Database.
 * Uses the Database Client for direct PostgreSQL access, bypassing HTTP API validation issues.
 *
 * Key Features:
 * - Direct database access for better performance
 * - Bypasses client-side validation issues
 * - Get customer collection IDs from claims data
 *
 * Usage:
 * ```typescript
 * import { getCustomerCollectionId } from './claims-bot-api-client.js';
 *
 * const collectionId = await getCustomerCollectionId('C12345678');
 * ```
 */

import { getClaimsBotDbClient } from "./claims-bot-db-client.js";
import { createModuleLogger } from "./logger.js";

const logger = createModuleLogger("claims-bot-collection");

/**
 * Get customer's bean distribution collection ID
 *
 * Retrieves the collection ID associated with the customer's bean distribution claims.
 * This is needed to submit claim intents and claims for bean delivery.
 *
 * Uses the Database Client for direct PostgreSQL access, bypassing HTTP API validation issues.
 *
 * @param customerId - Customer ID (e.g., "C12345678")
 * @returns Collection ID string or null if not found
 * @throws Error if database query fails
 *
 * @example
 * ```typescript
 * const collectionId = await getCustomerCollectionId('C12345678');
 * if (collectionId) {
 *   console.log('Collection ID:', collectionId);
 * } else {
 *   console.log('Customer does not have a bean distribution collection');
 * }
 * ```
 */
export async function getCustomerCollectionId(
  customerId: string
): Promise<string | null> {
  try {
    logger.info(
      { customerId: customerId },
      "Fetching customer's bean distribution collection ID from Claims Bot Database"
    );

    const db = getClaimsBotDbClient();

    // Get customer's claims to find their collection ID
    const claims = await db.claims.v1.selectClaimsByCustomerId({ customerId });

    if (!claims || claims.length === 0) {
      logger.warn(
        { customerId: customerId },
        "Customer has no claims, cannot determine collection ID"
      );
      return null;
    }

    // Find the most recent bean distribution claim or any claim with a collection ID
    // Assuming all claims for a customer use the same collection ID
    const claimWithCollection = claims.find(claim => claim.collection_id);

    if (!claimWithCollection) {
      logger.warn(
        { customerId: customerId, claimsCount: claims.length },
        "Customer has claims but no collection ID found"
      );
      return null;
    }

    const collectionId = claimWithCollection.collection_id;

    logger.info(
      {
        customerId: customerId,
        collectionId,
        totalClaims: claims.length,
      },
      "Successfully retrieved customer's collection ID"
    );

    return collectionId;
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        customerId: customerId,
      },
      "Failed to fetch customer's collection ID"
    );
    throw error;
  }
}
