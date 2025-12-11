/**
 * Claims Bot API Client Service
 *
 * Provides singleton access to the @ixo/supamoto-bot-sdk API Client for reading
 * customer data, claims, and collection IDs from the Claims Bot service.
 *
 * Key Features:
 * - Singleton pattern for efficient connection management
 * - Read-only HTTP API access to Claims Bot
 * - Get customer data, claims, and collection IDs
 *
 * Usage:
 * ```typescript
 * import { getClaimsBotApiClient, getCustomerCollectionId } from './claims-bot-api-client.js';
 *
 * const api = getClaimsBotApiClient();
 * const customer = await api.customers.v1.getCustomer({ customerId: 'C12345678' });
 *
 * // Or use helper function
 * const collectionId = await getCustomerCollectionId('C12345678');
 * ```
 */

import { createApiClient } from "@ixo/supamoto-bot-sdk";
import { config } from "../config.js";
import { createModuleLogger } from "./logger.js";

const logger = createModuleLogger("claims-bot-api");

// Singleton API client
let apiClient: ReturnType<typeof createApiClient> | null = null;

/**
 * Get or create the Claims Bot API Client singleton
 *
 * The API Client provides HTTP-based read access to the Claims Bot service
 * for retrieving customer data, claims, and collection IDs.
 *
 * @returns API client instance
 * @throws Error if CLAIMS_BOT_URL or CLAIMS_BOT_ACCESS_TOKEN is not configured
 */
export function getClaimsBotApiClient() {
  if (!apiClient) {
    if (!config.CLAIMS_BOT.URL || !config.CLAIMS_BOT.ACCESS_TOKEN) {
      throw new Error(
        "CLAIMS_BOT_URL and CLAIMS_BOT_ACCESS_TOKEN must be configured to use the API Client"
      );
    }

    logger.info(
      { botUrl: config.CLAIMS_BOT.URL },
      "Initializing Claims Bot API Client"
    );

    apiClient = createApiClient({
      botUrl: config.CLAIMS_BOT.URL,
      accessToken: config.CLAIMS_BOT.ACCESS_TOKEN,
    });

    logger.info("Claims Bot API Client initialized successfully");
  }

  return apiClient;
}

/**
 * Get customer's bean distribution collection ID
 *
 * Retrieves the collection ID associated with the customer's bean distribution claims.
 * This is needed to submit claim intents and claims for bean delivery.
 *
 * @param customerId - Customer ID (e.g., "C12345678")
 * @returns Collection ID string or null if not found
 * @throws Error if API request fails
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
      { customerId: customerId.slice(-4) },
      "Fetching customer's bean distribution collection ID from Claims Bot API"
    );

    const api = getClaimsBotApiClient();

    // Get customer's claims to find their collection ID
    const claims = await api.claims.v1.getCustomerClaims({ customerId });

    if (!claims || claims.length === 0) {
      logger.warn(
        { customerId: customerId.slice(-4) },
        "Customer has no claims, cannot determine collection ID"
      );
      return null;
    }

    // Find the most recent bean distribution claim or any claim with a collection ID
    // Assuming all claims for a customer use the same collection ID
    const claimWithCollection = claims.find(claim => claim.collection_id);

    if (!claimWithCollection) {
      logger.warn(
        { customerId: customerId.slice(-4), claimsCount: claims.length },
        "Customer has claims but no collection ID found"
      );
      return null;
    }

    const collectionId = claimWithCollection.collection_id;

    logger.info(
      {
        customerId: customerId.slice(-4),
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
        customerId: customerId.slice(-4),
      },
      "Failed to fetch customer's collection ID"
    );
    throw error;
  }
}

