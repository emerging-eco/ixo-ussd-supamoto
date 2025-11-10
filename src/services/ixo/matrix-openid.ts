/**
 * Matrix OpenID Token Service
 * 
 * Generates short-lived OpenID access tokens for authenticating with external services
 * that support Matrix OpenID authentication (e.g., subscriptions service).
 * 
 * Flow:
 * 1. Login to Matrix with username/password → Get Matrix access token
 * 2. Request OpenID token using Matrix access token → Get OpenID access token
 * 3. Use OpenID access token to authenticate with external services
 */

import { createModuleLogger } from "../logger.js";
import { getMatrixDetails } from "./matrix.js";
import { config } from "../../config.js";

const logger = createModuleLogger("matrix-openid");

export interface OpenIDToken {
  access_token: string;
  token_type: string;
  matrix_server_name: string;
  expires_in: number;
}

/**
 * Generate OpenID access token for a customer
 * 
 * @param params - Customer credentials
 * @param params.address - Customer's blockchain address (from ixo_accounts table)
 * @param params.matrixPassword - Customer's Matrix password (decrypted from matrix_vaults)
 * @returns OpenID access token
 */
export async function generateOpenIDToken(params: {
  address: string;
  matrixPassword: string;
}): Promise<string> {
  const { address, matrixPassword } = params;
  
  logger.info(
    { address: address.slice(-8) },
    "Generating OpenID access token for customer"
  );

  try {
    // Step 1: Login to Matrix to get Matrix access token
    const homeServerUrl = config.MATRIX.homeServerUrl;
    if (!homeServerUrl) {
      throw new Error("MATRIX_HOME_SERVER not configured");
    }

    const username = `did-ixo-${address}`;
    
    logger.debug(
      { username, homeServerUrl },
      "Logging in to Matrix to get access token"
    );

    const matrixAuth = await getMatrixDetails({
      homeServerUrl,
      username,
      password: matrixPassword,
    });

    if (!matrixAuth.accessToken) {
      throw new Error("Failed to get Matrix access token");
    }

    logger.debug(
      { userId: matrixAuth.userId },
      "Matrix login successful, requesting OpenID token"
    );

    // Step 2: Request OpenID token using Matrix access token
    const matrixServer = config.SUBSCRIPTIONS.MATRIX_SERVER;
    const openIdUrl = `https://${matrixServer}/_matrix/client/r0/user/@${username}:${matrixServer}/openid/request_token`;

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      config.SUBSCRIPTIONS.REQUEST_TIMEOUT_MS
    );

    try {
      const response = await fetch(openIdUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${matrixAuth.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `OpenID token request failed: ${response.status} ${errorText}`
        );
      }

      const openIdData = (await response.json()) as OpenIDToken;

      if (!openIdData.access_token) {
        throw new Error("OpenID token not found in response");
      }

      logger.info(
        {
          address: address.slice(-8),
          expiresIn: openIdData.expires_in,
          tokenType: openIdData.token_type,
        },
        "OpenID access token generated successfully"
      );

      return openIdData.access_token;
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        address: address.slice(-8),
      },
      "Failed to generate OpenID access token"
    );
    throw error;
  }
}

/**
 * Generate OpenID token from customer ID
 * Retrieves Matrix credentials from database and generates token
 * 
 * @param customerId - Customer ID
 * @param pin - Customer's PIN (used to decrypt Matrix password)
 * @returns OpenID access token
 */
export async function generateOpenIDTokenFromCustomerId(
  customerId: string,
  pin: string
): Promise<string> {
  const { databaseManager } = await import("../database-manager.js");
  const { decrypt } = await import("../../utils/encryption.js");

  logger.info(
    { customerId: customerId.slice(-4) },
    "Generating OpenID token from customer ID"
  );

  try {
    // Query database for customer's Matrix vault and IXO account
    const db = databaseManager.getKysely();
    const result = await db
      .selectFrom("matrix_vaults as mv")
      .innerJoin("ixo_profiles as ip", "mv.ixo_profile_id", "ip.id")
      .innerJoin("customers as c", "ip.customer_id", "c.id")
      .leftJoin("ixo_accounts as ia", "ia.ixo_profile_id", "ip.id")
      .select([
        "mv.encrypted_password as encrypted_password",
        "ia.address as address",
      ])
      .where("c.customer_id", "=", customerId)
      .where("ia.is_primary", "=", true)
      .executeTakeFirst();

    if (!result) {
      throw new Error(
        `Matrix vault or IXO account not found for customer ${customerId}`
      );
    }

    if (!result.address) {
      throw new Error(
        `No primary IXO account found for customer ${customerId}`
      );
    }

    // Decrypt Matrix password using customer's PIN
    const matrixPassword = decrypt(result.encrypted_password, pin);
    if (!matrixPassword) {
      throw new Error("Failed to decrypt Matrix password (incorrect PIN?)");
    }

    // Generate OpenID token
    return await generateOpenIDToken({
      address: result.address,
      matrixPassword,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        customerId: customerId.slice(-4),
      },
      "Failed to generate OpenID token from customer ID"
    );
    throw error;
  }
}
