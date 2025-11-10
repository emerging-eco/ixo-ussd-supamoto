/**
 * Subscriptions Service
 * 
 * Handles communication with the subscriptions API to fetch customer balances
 * and subscription information.
 */

import { createModuleLogger } from "./logger.js";
import { config } from "../config.js";

const logger = createModuleLogger("subscriptions");

export interface SubscriptionBalance {
  userAddress: string;
  planId: string;
  balance: number;
  currency: string;
  lastUpdated: string;
}

export interface SubscriptionDetails {
  subscriptionId: string;
  planId: string;
  status: "active" | "cancelled" | "expired";
  currentPeriod: {
    startDate: number;
    endDate: number;
  };
  balances: SubscriptionBalance[];
}

/**
 * Fetch subscription balances from subscriptions API
 * 
 * @param openIdToken - OpenID access token for authentication
 * @returns Subscription details with balances
 */
export async function fetchSubscriptionBalances(
  openIdToken: string
): Promise<SubscriptionDetails | null> {
  const apiBaseUrl = config.SUBSCRIPTIONS.API_BASE_URL;

  if (!apiBaseUrl) {
    throw new Error("SUBSCRIPTIONS_API_BASE_URL not configured");
  }

  const url = `${apiBaseUrl}/api/v1/subscriptions`;

  logger.info("Fetching subscription balances from API");

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    config.SUBSCRIPTIONS.REQUEST_TIMEOUT_MS
  );

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${openIdToken}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 404) {
        logger.warn("No subscription found for customer");
        return null;
      }

      const errorText = await response.text();
      throw new Error(
        `Subscriptions API request failed: ${response.status} ${errorText}`
      );
    }

    const data = (await response.json()) as SubscriptionDetails;

    logger.info(
      {
        subscriptionId: data.subscriptionId,
        status: data.status,
        balanceCount: data.balances?.length || 0,
      },
      "Subscription balances fetched successfully"
    );

    return data;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timeout: Subscriptions API did not respond in time");
    }

    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to fetch subscription balances"
    );
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Format subscription balances for USSD display
 * 
 * @param subscription - Subscription details
 * @returns Formatted message for USSD display
 */
export function formatBalancesForUSSD(
  subscription: SubscriptionDetails | null
): string {
  if (!subscription) {
    return "No active subscription found.\n\n1. Continue";
  }

  if (!subscription.balances || subscription.balances.length === 0) {
    return "Your Balances:\nNo balances available.\n\n1. Continue";
  }

  let message = "Your Balances:\n";

  for (const balance of subscription.balances) {
    message += `${balance.currency}: ${balance.balance}\n`;
  }

  message += "\n1. Continue";

  return message;
}
