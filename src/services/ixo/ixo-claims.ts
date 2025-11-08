import { createSigningClient, ixo } from "@ixo/impactxclient-sdk";
import { coins, DeliverTxResponse } from "@cosmjs/stargate";
import { getSecpClient } from "../../utils/secp.js";
import { createModuleLogger } from "../logger.js";

// Create a module-specific logger
const logger = createModuleLogger("ixo-claims");

export const typeUrlMsgSubmitClaim =
  "/ixo.claims.v1beta1.MsgSubmitClaim" as const;
export const typeUrlMsgClaimIntent =
  "/ixo.claims.v1beta1.MsgClaimIntent" as const;
export const typeUrlMsgEvaluateClaim =
  "/ixo.claims.v1beta1.MsgEvaluateClaim" as const;

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

/**
 * Claim Intent Value interface
 */
export interface ClaimIntentValue {
  collectionId: string;
  agentDid: string;
  agentAddress: string;
  amount?: any[]; // Coin[]
  cw20Payment?: any[]; // CW20Payment[]
  [k: string]: unknown;
}

/**
 * Submit Claim Intent Params
 */
export interface SubmitClaimIntentParams {
  /** Mnemonic of the agent submitting the intent */
  mnemonic: string;
  /** RPC URL for the IXO chain */
  chainRpcUrl: string;
  /** Claim intent payload */
  intent: Partial<ClaimIntentValue> | ClaimIntentValue;
  /** Fee amount in uixo (defaults to 5000 uixo) */
  feeAmountInUixo?: string;
  /** Gas limit (defaults to 200000) */
  gas?: string;
  /** Optional memo */
  memo?: string;
  /** Optional feegrant granter address */
  feegranter?: string;
}

/**
 * Sign and broadcast a Claim Intent transaction (MsgClaimIntent).
 * This locks funds in escrow for the claim.
 */
export async function submitClaimIntent(
  params: SubmitClaimIntentParams
): Promise<DeliverTxResponse> {
  const {
    mnemonic,
    chainRpcUrl,
    intent,
    feeAmountInUixo = "5000",
    gas = "200000",
    memo = "",
    feegranter,
  } = params;

  if (!mnemonic || !chainRpcUrl || !intent) {
    throw new Error("Missing required arguments for submitClaimIntent");
  }

  // 1) Create wallet & signing client
  const wallet = await getSecpClient(mnemonic);
  const fromAddress = wallet.baseAccount.address;
  const signingClient = await createSigningClient(chainRpcUrl, wallet);

  // 2) Compose message
  const msg = {
    typeUrl: typeUrlMsgClaimIntent,
    value: ixo.claims.v1beta1.MsgClaimIntent.fromPartial(intent as any),
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
      collectionId: intent.collectionId,
      feeAmountInUixo,
      gas,
      hasFeegranter: !!feegranter,
    },
    "Submitting claim intent (MsgClaimIntent)"
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
        collectionId: intent.collectionId,
      },
      "Claim intent submitted successfully"
    );

    return result;
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        fromAddress,
        collectionId: intent.collectionId,
      },
      "Failed to submit claim intent"
    );
    throw error;
  }
}

/**
 * Evaluate Claim Value interface
 */
export interface EvaluateClaimValue {
  claimId: string;
  collectionId: string;
  oracle: string;
  agentDid: string;
  agentAddress: string;
  status: number; // 1 = APPROVED, 2 = REJECTED
  reason?: string;
  amount?: any[]; // Coin[]
  cw20Payment?: any[]; // CW20Payment[]
  [k: string]: unknown;
}

/**
 * Evaluate Claim Params
 */
export interface EvaluateClaimParams {
  /** Mnemonic of the evaluator */
  mnemonic: string;
  /** RPC URL for the IXO chain */
  chainRpcUrl: string;
  /** Evaluation payload */
  evaluation: Partial<EvaluateClaimValue> | EvaluateClaimValue;
  /** Fee amount in uixo (defaults to 5000 uixo) */
  feeAmountInUixo?: string;
  /** Gas limit (defaults to 200000) */
  gas?: string;
  /** Optional memo */
  memo?: string;
  /** Optional feegrant granter address */
  feegranter?: string;
}

/**
 * Sign and broadcast a Claim Evaluation transaction (MsgEvaluateClaim).
 * This approves or rejects a claim, releasing escrowed funds if approved.
 */
export async function evaluateClaim(
  params: EvaluateClaimParams
): Promise<DeliverTxResponse> {
  const {
    mnemonic,
    chainRpcUrl,
    evaluation,
    feeAmountInUixo = "5000",
    gas = "200000",
    memo = "",
    feegranter,
  } = params;

  if (!mnemonic || !chainRpcUrl || !evaluation) {
    throw new Error("Missing required arguments for evaluateClaim");
  }

  // 1) Create wallet & signing client
  const wallet = await getSecpClient(mnemonic);
  const fromAddress = wallet.baseAccount.address;
  const signingClient = await createSigningClient(chainRpcUrl, wallet);

  // 2) Compose message
  const msg = {
    typeUrl: typeUrlMsgEvaluateClaim,
    value: ixo.claims.v1beta1.MsgEvaluateClaim.fromPartial(evaluation as any),
  };

  // 3) Prepare fee
  const fee: any = {
    amount: coins(feeAmountInUixo, "uixo"),
    gas,
  };
  if (feegranter) {
    fee.granter = feegranter;
  }

  const statusText = evaluation.status === 1 ? "APPROVED" : "REJECTED";

  logger.info(
    {
      fromAddress,
      claimId: evaluation.claimId,
      collectionId: evaluation.collectionId,
      status: statusText,
      feeAmountInUixo,
      gas,
      hasFeegranter: !!feegranter,
    },
    "Evaluating claim (MsgEvaluateClaim)"
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
        claimId: evaluation.claimId,
        status: statusText,
      },
      "Claim evaluated successfully"
    );

    return result;
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        fromAddress,
        claimId: evaluation.claimId,
        status: statusText,
      },
      "Failed to evaluate claim"
    );
    throw error;
  }
}
