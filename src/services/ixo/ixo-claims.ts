import { createSigningClient, ixo } from "@ixo/impactxclient-sdk";
import { coins, DeliverTxResponse } from "@cosmjs/stargate";
import { getSecpClient } from "../../utils/secp.js";
import { createModuleLogger } from "../logger.js";

// Create a module-specific logger
const logger = createModuleLogger("ixo-claims");

export const typeUrlMsgSubmitClaim =
  "/ixo.claims.v1beta1.MsgSubmitClaim" as const;

// Minimal shape for claim value we construct and accept
export interface SubmitClaimValue {
  collectionId: string;
  claimId?: string;
  agentDid: string;
  agentAddress: string;
  adminAddress?: string;
  useIntent?: boolean;
  amount?: any[]; // Coin[]
  cw20Payment?: any[]; // CW20Payment[]
  // Allow extra fields to flow through to fromPartial
  [k: string]: unknown;
}

export interface SubmitClaimParams {
  /** Mnemonic of the submitting agent (derived account will be used as signer) */
  mnemonic: string;
  /** RPC URL for the IXO chain (e.g. from CHAIN_RPC_URL constant) */
  chainRpcUrl: string;
  /** Claim payload value. If Partial, it will be converted with fromPartial */
  claim: Partial<SubmitClaimValue> | SubmitClaimValue;
  /** Fee amount in uixo (defaults to 5000 uixo) */
  feeAmountInUixo?: string;
  /** Gas limit (defaults to 200000) */
  gas?: string;
  /** Optional memo */
  memo?: string;
  /** Optional feegrant granter address */
  feegranter?: string;
}

export function buildMsgSubmitClaim(value: Partial<SubmitClaimValue>) {
  return {
    typeUrl: typeUrlMsgSubmitClaim,
    value: ixo.claims.v1beta1.MsgSubmitClaim.fromPartial(value as any),
  } as const;
}

/**
 * Sign and broadcast a Claim transaction (MsgSubmitClaim).
 *
 * This uses the same signing/broadcast pattern as other IXO tx helpers in this codebase.
 */
export async function submitClaim(
  params: SubmitClaimParams
): Promise<DeliverTxResponse> {
  const {
    mnemonic,
    chainRpcUrl,
    claim,
    feeAmountInUixo = "5000",
    gas = "200000",
    memo = "",
    feegranter,
  } = params;

  if (!mnemonic || !chainRpcUrl || !claim) {
    throw new Error("Missing required arguments for submitClaim");
  }

  // 1) Create wallet & signing client
  const wallet = await getSecpClient(mnemonic);
  const fromAddress = wallet.baseAccount.address;
  const signingClient = await createSigningClient(chainRpcUrl, wallet);

  // 2) Compose message
  const msg = {
    typeUrl: typeUrlMsgSubmitClaim,
    value: ixo.claims.v1beta1.MsgSubmitClaim.fromPartial(claim as any),
  };

  // 3) Prepare fee
  const fee: any = {
    amount: coins(feeAmountInUixo, "uixo"),
    gas,
  };
  if (feegranter) {
    fee.granter = feegranter;
  }

  logger.info(
    {
      fromAddress,
      feeAmountInUixo,
      gas,
      hasFeegranter: !!feegranter,
    },
    "Submitting claim (MsgSubmitClaim)"
  );

  // 4) Sign & broadcast
  try {
    const result = await signingClient.signAndBroadcast(
      fromAddress,
      [msg],
      fee,
      memo
    );

    logger.info(
      {
        transactionHash: result.transactionHash,
        height: result.height,
        fromAddress,
      },
      "Claim submitted successfully"
    );

    return result;
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        fromAddress,
      },
      "Failed to submit claim"
    );
    throw error;
  }
}
