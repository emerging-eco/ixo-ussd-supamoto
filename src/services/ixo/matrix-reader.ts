import { createMatrixApiClient } from "@ixo/matrixclient-sdk";
import {
  createMatrixClient,
  generateUserRoomAliasFromAddress,
  getMatrixDetails,
} from "./matrix.js";
import { databaseManager } from "../../services/database-manager.js";
import { decrypt } from "../../utils/encryption.js";
import { createModuleLogger } from "../logger.js";

const logger = createModuleLogger("matrix-reader");

export interface LoginWithVaultParams {
  customerId?: string;
  phoneNumber?: string;
  pin: string; // used to decrypt stored secrets
}

export interface MatrixLoginResult {
  mxClient: any; // MatrixClient (typed in matrix.ts)
  userId: string;
  baseUrl: string;
  roomId?: string;
  roomAlias?: string;
}

export interface ContractDetailsSummary {
  contractId?: string;
  plan?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

export interface OrderSummary {
  id: string;
  type: "pellets" | "accessories";
  qty?: number;
  createdAt?: string;
  status?: "placed" | "fulfilled" | "cancelled";
}

export interface VoucherSummary {
  id: string; // e.g., tokenId or voucher identifier
  type: "BEAN";
  amount?: number; // count for 1155-like; often 1 per id
  status?: "issued" | "redeemed";
  metadataUri?: string;
}

// Proposed canonical Matrix room state schema (keys/types)
export const MATRIX_STATE_KEYS = {
  secure: {
    // holds encrypted mnemonic or secrets
    encryptedMnemonic: "ixo.room.state.secure/encrypted_mnemonic",
  },
  profile: {
    // basic profile snapshot
    account: "ixo.room.state.profile/account",
  },
  contracts: {
    // active subscription/contract data
    details: "ixo.room.state.contract/details",
  },
  orders: {
    // rolling list or last N orders
    list: "ixo.room.state.orders/list",
  },
  vouchers: {
    // rolling list or last N voucher ops
    list: "ixo.room.state.vouchers/list",
  },
} as const;

export async function loginWithVault(
  params: LoginWithVaultParams
): Promise<MatrixLoginResult> {
  const { customerId, phoneNumber, pin } = params;
  const db = databaseManager.getKysely();

  // 1) Resolve customer -> profile -> matrix vault
  let vaultRow:
    | {
        username: string;
        encrypted_password: string;
        address?: string;
        did?: string;
      }
    | undefined;
  try {
    const baseQuery = db
      .selectFrom("matrix_vaults as mv")
      .innerJoin("ixo_profiles as ip", "mv.ixo_profile_id", "ip.id")
      .innerJoin("customers as c", "ip.customer_id", "c.id")
      .leftJoin("ixo_accounts as ia", "ia.ixo_profile_id", "ip.id")
      .select([
        "mv.username as username",
        "mv.encrypted_password as encrypted_password",
        "ia.address as address",
        "ip.did as did",
      ]);

    const result = customerId
      ? await baseQuery
          .where("c.customer_id", "=", customerId)
          .executeTakeFirst()
      : phoneNumber
        ? await baseQuery
            .innerJoin("customer_phones as cp", "cp.customer_id", "c.id")
            .innerJoin("phones as p", "p.id", "cp.phone_id")
            .where("p.phone_number", "=", phoneNumber)
            .where("cp.is_primary", "=", true)
            .executeTakeFirst()
        : undefined;

    if (!result) throw new Error("Matrix vault not found for customer");
    vaultRow = result as any;
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Failed to load matrix vault"
    );
    throw error;
  }

  // 2) Decrypt password with PIN
  const mxPassword = decrypt(vaultRow!.encrypted_password, pin);
  if (!mxPassword)
    throw new Error("Failed to decrypt matrix password (PIN incorrect?)");

  // 3) Login via matrix.ts and create client
  const homeServerUrl = process.env.MATRIX_HOME_SERVER as string;
  const auth = await getMatrixDetails({
    homeServerUrl,
    username: vaultRow!.username,
    password: mxPassword,
  });
  const mxClient = await createMatrixClient({
    homeServerUrl: auth.baseUrl,
    accessToken: auth.accessToken,
    userId: auth.userId,
    deviceId: auth.deviceId,
  });

  return { mxClient, userId: auth.userId, baseUrl: auth.baseUrl };
}

export async function findUserRoom(params: {
  mxClient: any;
  userAddress?: string;
  did?: string;
}): Promise<{ roomId?: string; roomAlias?: string }> {
  const { mxClient, userAddress, did } = params;
  const homeServerUrl =
    (mxClient as any)?.baseUrl || process.env.MATRIX_HOME_SERVER;
  // Build alias from address if available; otherwise from DID-derived address when defined
  const address = userAddress || did?.replace(/^did:ixo:/, "");
  if (!address) return {};
  const alias = generateUserRoomAliasFromAddress(address, homeServerUrl!);
  try {
    const api = createMatrixApiClient({
      homeServerUrl: homeServerUrl!,
      accessToken: (mxClient as any)?.getAccessToken?.(),
    });
    const res = await api.room.v1beta1.queryId(alias);
    return { roomId: res.room_id, roomAlias: alias };
  } catch (e) {
    logger.warn({ alias }, "Could not resolve user room alias");
    return { roomAlias: alias };
  }
}

async function fetchRoomState({
  baseUrl,
  accessToken,
  roomId,
  eventType,
  stateKey,
}: {
  baseUrl: string;
  accessToken: string;
  roomId: string;
  eventType: string;
  stateKey?: string;
}): Promise<any | null> {
  const keySuffix = stateKey ? `/${encodeURIComponent(stateKey)}` : "";
  const url = `${baseUrl}/_matrix/client/r0/rooms/${encodeURIComponent(roomId)}/state/${encodeURIComponent(eventType)}${keySuffix}`;
  const controller = new AbortController();
  const timeout = Number(process.env.MATRIX_REQUEST_TIMEOUT_MS || 3000);
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function getProfileAccountFromRoom(params: {
  mxClient: any;
  roomId: string;
}): Promise<any | null> {
  const mxClient = params.mxClient;
  const baseUrl = (mxClient as any).baseUrl || process.env.MATRIX_HOME_SERVER!;
  const accessToken = (mxClient as any).getAccessToken?.();
  if (!accessToken) return null;
  return await fetchRoomState({
    baseUrl,
    accessToken,
    roomId: params.roomId,
    eventType: MATRIX_STATE_KEYS.profile.account,
  });
}

export async function getContractDetailsFromRoom(params: {
  mxClient: any;
  roomId: string;
}): Promise<ContractDetailsSummary | null> {
  const mxClient = params.mxClient;
  const baseUrl = (mxClient as any).baseUrl || process.env.MATRIX_HOME_SERVER!;
  const accessToken = (mxClient as any).getAccessToken?.();
  if (!accessToken) return null;
  const data = await fetchRoomState({
    baseUrl,
    accessToken,
    roomId: params.roomId,
    eventType: MATRIX_STATE_KEYS.contracts.details,
  });
  if (!data) return null;
  const { contract_id, plan, start_date, end_date, status } = data;
  return {
    contractId: contract_id,
    plan,
    startDate: start_date,
    endDate: end_date,
    status,
  };
}

export async function getOrdersFromRoom(params: {
  mxClient: any;
  roomId: string;
}): Promise<OrderSummary[]> {
  const mxClient = params.mxClient;
  const baseUrl = (mxClient as any).baseUrl || process.env.MATRIX_HOME_SERVER!;
  const accessToken = (mxClient as any).getAccessToken?.();
  if (!accessToken) return [];
  const list =
    (await fetchRoomState({
      baseUrl,
      accessToken,
      roomId: params.roomId,
      eventType: MATRIX_STATE_KEYS.orders.list,
    })) || [];
  return Array.isArray(list) ? list : [];
}

export async function getVouchersFromRoom(params: {
  mxClient: any;
  roomId: string;
}): Promise<VoucherSummary[]> {
  const mxClient = params.mxClient;
  const baseUrl = (mxClient as any).baseUrl || process.env.MATRIX_HOME_SERVER!;
  const accessToken = (mxClient as any).getAccessToken?.();
  if (!accessToken) return [];
  const list =
    (await fetchRoomState({
      baseUrl,
      accessToken,
      roomId: params.roomId,
      eventType: MATRIX_STATE_KEYS.vouchers.list,
    })) || [];
  return Array.isArray(list) ? list : [];
}
