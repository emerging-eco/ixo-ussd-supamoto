/**
 * IXO Claim Signing Service
 *
 * High-level service for signing and broadcasting blockchain claims on behalf of customers.
 * This service retrieves customer IXO accounts from the Claims Bot Database, decrypts mnemonics,
 * and signs blockchain transactions (MsgClaimIntent, MsgSubmitClaim).
 *
 * Key Features:
 * - Retrieve customer IXO account with encrypted mnemonic
 * - Decrypt mnemonic for signing (SDK handles decryption)
 * - Create wallet from mnemonic
 * - Verify derived address matches stored address (security check)
 * - Sign and broadcast claim intent transactions
 * - Comprehensive error handling and logging
 *
 * Usage:
 * ```typescript
 * import { submitCustomerClaimIntent } from './ixo-claim-signing-service.js';
 *
 * const result = await submitCustomerClaimIntent({
 *   customerId: 'C12345678',
 *   collectionId: '120',
 *   memo: 'Bean delivery claim',
 * });
 * console.log('Transaction Hash:', result.transactionHash);
 * ```
 */

import { getCustomerIxoAccount } from "./ixo-account-service.js";
import { submitClaimIntent, type ClaimIntentValue } from "./ixo/ixo-claims.js";
import { getSecpClient } from "../utils/secp.js";
import { CHAIN_RPC_URL } from "../constants/ixo-blockchain.js";
import { createModuleLogger } from "./logger.js";

const logger = createModuleLogger("ixo-claim-signing");

/**
 * Decrypt mnemonic from Buffer to string
 *
 * The SDK automatically decrypts the mnemonic when querying the database,
 * but returns it as a Buffer. This function converts it to a UTF-8 string.
 *
 * @param encryptedMnemonicBuffer - Encrypted mnemonic as Buffer (already decrypted by SDK)
 * @returns Mnemonic as string
 */
export function decryptMnemonic(encryptedMnemonicBuffer: Buffer): string {
  return encryptedMnemonicBuffer.toString("utf-8");
}

/**
 * Submit Claim Intent Parameters
 */
export interface SubmitCustomerClaimIntentParams {
  /** Customer ID (e.g., "C12345678") */
  customerId: string;
  /** Collection ID for the claim */
  collectionId: string;
  /** Optional memo for the transaction */
  memo?: string;
  /** Optional fee amount in uixo (default: "5000") */
  feeAmountInUixo?: string;
  /** Optional gas limit (default: "200000") */
  gas?: string;
  /** Optional fee granter address */
  feegranter?: string;
}

/**
 * Submit Claim Intent Result
 */
export interface SubmitCustomerClaimIntentResult {
  /** Transaction hash */
  transactionHash: string;
  /** Block height */
  height: number;
  /** Customer's IXO address */
  address: string;
  /** Customer's DID */
  did: string;
}

/**
 * Submit a claim intent on behalf of a customer
 *
 * This function:
 * 1. Retrieves the customer's IXO account from Claims Bot Database
 * 2. Decrypts the mnemonic (SDK handles decryption)
 * 3. Creates a wallet from the mnemonic
 * 4. Verifies the derived address matches the stored address (security check)
 * 5. Signs and broadcasts the claim intent transaction
 *
 * Security:
 * - Mnemonics are only decrypted in memory, never logged
 * - Address verification ensures mnemonic matches expected account
 * - Throws error if IXO account not found or address mismatch
 *
 * @param params - Submit claim intent parameters
 * @returns Transaction result with hash, height, address, and DID
 * @throws Error if customer doesn't have an IXO account
 * @throws Error if derived address doesn't match stored address
 * @throws Error if blockchain transaction fails
 *
 * @example
 * ```typescript
 * const result = await submitCustomerClaimIntent({
 *   customerId: 'C12345678',
 *   collectionId: '120',
 *   memo: 'Bean delivery claim',
 * });
 * console.log('Transaction Hash:', result.transactionHash);
 * console.log('Block Height:', result.height);
 * console.log('Customer Address:', result.address);
 * ```
 */
export async function submitCustomerClaimIntent(
  params: SubmitCustomerClaimIntentParams
): Promise<SubmitCustomerClaimIntentResult> {
  const {
    customerId,
    collectionId,
    memo = "",
    feeAmountInUixo = "5000",
    gas = "200000",
    feegranter,
  } = params;

  try {
    logger.info(
      {
        customerId: customerId.slice(-4),
        collectionId,
      },
      "Submitting claim intent on behalf of customer"
    );

    // 1. Retrieve customer's IXO account
    const ixoAccount = await getCustomerIxoAccount(customerId);

    if (!ixoAccount) {
      throw new Error(
        `Customer ${customerId} does not have an IXO account yet. IXO accounts are created lazily by the Claims Bot service.`
      );
    }

    // 2. Decrypt mnemonic (SDK already decrypted, just convert Buffer to string)
    const mnemonic = decryptMnemonic(ixoAccount.encryptedMnemonic);

    // 3. Create wallet from mnemonic
    const wallet = await getSecpClient(mnemonic);
    const derivedAddress = wallet.baseAccount.address;
    const derivedDid = wallet.did;

    // 4. Security check: Verify derived address matches stored address
    if (derivedAddress !== ixoAccount.address) {
      logger.error(
        {
          customerId: customerId.slice(-4),
          storedAddress: ixoAccount.address.slice(0, 10) + "...",
          derivedAddress: derivedAddress.slice(0, 10) + "...",
        },
        "Address mismatch: derived address does not match stored address"
      );
      throw new Error(
        "Security check failed: derived address does not match stored address"
      );
    }

    logger.info(
      {
        customerId: customerId.slice(-4),
        address: derivedAddress.slice(0, 10) + "...",
        did: derivedDid,
        collectionId,
      },
      "Wallet created and verified, submitting claim intent to blockchain"
    );

    // 5. Submit claim intent to blockchain
    const intent: ClaimIntentValue = {
      collectionId,
      agentDid: derivedDid,
      agentAddress: derivedAddress,
    };

    const result = await submitClaimIntent({
      mnemonic,
      chainRpcUrl: CHAIN_RPC_URL,
      intent,
      feeAmountInUixo,
      gas,
      memo,
      feegranter,
    });

    logger.info(
      {
        customerId: customerId.slice(-4),
        transactionHash: result.transactionHash,
        height: result.height,
        address: derivedAddress.slice(0, 10) + "...",
      },
      "Claim intent submitted successfully on behalf of customer"
    );

    return {
      transactionHash: result.transactionHash,
      height: result.height,
      address: derivedAddress,
      did: derivedDid,
    };
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        customerId: customerId.slice(-4),
        collectionId,
      },
      "Failed to submit claim intent on behalf of customer"
    );
    throw error;
  }
}
