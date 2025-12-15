import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies BEFORE imports
vi.mock("../../src/services/ixo-account-service.js", () => ({
  getCustomerIxoAccount: vi.fn(),
}));

vi.mock("../../src/services/ixo/ixo-claims.js", () => ({
  submitClaimIntent: vi.fn(),
}));

vi.mock("../../src/utils/secp.js", () => ({
  getSecpClient: vi.fn(),
}));

vi.mock("../../src/constants/ixo-blockchain.js", () => ({
  CHAIN_RPC_URL: "https://devnet.ixo.earth/rpc/",
}));

// Import after mocks
import {
  submitCustomerClaimIntent,
  decryptMnemonic,
} from "../../src/services/ixo-claim-signing-service.js";
import { getCustomerIxoAccount } from "../../src/services/ixo-account-service.js";
import { submitClaimIntent } from "../../src/services/ixo/ixo-claims.js";
import { getSecpClient } from "../../src/utils/secp.js";

const mockGetCustomerIxoAccount = vi.mocked(getCustomerIxoAccount);
const mockSubmitClaimIntent = vi.mocked(submitClaimIntent);
const mockGetSecpClient = vi.mocked(getSecpClient);

// Mock logger
vi.mock("../../src/services/logger.js", () => ({
  createModuleLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

describe("IXO Claim Signing Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("decryptMnemonic", () => {
    it("should convert Buffer to UTF-8 string for valid 12-word mnemonic", () => {
      const validMnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
      const buffer = Buffer.from(validMnemonic);
      const result = decryptMnemonic(buffer);

      expect(result).toBe(validMnemonic);
    });

    it("should throw error for invalid mnemonic format", () => {
      const invalidMnemonic = "test mnemonic phrase"; // Only 3 words
      const buffer = Buffer.from(invalidMnemonic);

      expect(() => decryptMnemonic(buffer)).toThrow(
        "Failed to decrypt mnemonic"
      );
    });

    it("should accept valid 24-word mnemonic", () => {
      const validMnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";
      const buffer = Buffer.from(validMnemonic);
      const result = decryptMnemonic(buffer);

      expect(result).toBe(validMnemonic);
    });
  });

  describe("submitCustomerClaimIntent", () => {
    it("should submit claim intent successfully", async () => {
      const validMnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
      const mockIxoAccount = {
        address: "ixo1abc123def456",
        did: "did:ixo:abc123",
        encryptedMnemonic: Buffer.from(validMnemonic),
        isPrimary: true,
      };

      const mockWallet = {
        baseAccount: {
          address: "ixo1abc123def456",
          algo: "secp256k1" as const,
          pubkey: new Uint8Array(33),
        },
        did: "did:ixo:abc123",
        mnemonic: validMnemonic,
        getAccounts: vi.fn(),
        signDirect: vi.fn(),
        sign: vi.fn(),
      };

      const mockTxResult = {
        transactionHash: "ABC123XYZ",
        height: 12345,
        rawLog: "",
        code: 0,
        txIndex: 0,
        events: [],
        msgResponses: [],
        gasUsed: BigInt(0),
        gasWanted: BigInt(0),
      };

      mockGetCustomerIxoAccount.mockResolvedValue(mockIxoAccount);
      mockGetSecpClient.mockResolvedValue(mockWallet);
      mockSubmitClaimIntent.mockResolvedValue(mockTxResult);

      const result = await submitCustomerClaimIntent({
        customerId: "C12345678",
        collectionId: "120",
        memo: "Test claim",
      });

      expect(result).toEqual({
        transactionHash: "ABC123XYZ",
        height: 12345,
        address: "ixo1abc123def456",
        did: "did:ixo:abc123",
      });

      expect(mockGetCustomerIxoAccount).toHaveBeenCalledWith("C12345678");
      expect(mockGetSecpClient).toHaveBeenCalledWith(validMnemonic);
      expect(mockSubmitClaimIntent).toHaveBeenCalledWith({
        mnemonic: validMnemonic,
        chainRpcUrl: "https://devnet.ixo.earth/rpc/",
        intent: {
          collectionId: "120",
          agentDid: "did:ixo:abc123",
          agentAddress: "ixo1abc123def456",
        },
        feeAmountInUixo: "5000",
        gas: "200000",
        memo: "Test claim",
        feegranter: undefined,
      });
    });

    it("should throw error when customer has no IXO account", async () => {
      mockGetCustomerIxoAccount.mockResolvedValue(null);

      await expect(
        submitCustomerClaimIntent({
          customerId: "C12345678",
          collectionId: "120",
        })
      ).rejects.toThrow("does not have an IXO account yet");

      expect(mockGetSecpClient).not.toHaveBeenCalled();
      expect(mockSubmitClaimIntent).not.toHaveBeenCalled();
    });

    it("should throw error when derived address does not match stored address", async () => {
      const validMnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
      const mockIxoAccount = {
        address: "ixo1abc123def456",
        did: "did:ixo:abc123",
        encryptedMnemonic: Buffer.from(validMnemonic),
        isPrimary: true,
      };

      const mockWallet = {
        baseAccount: {
          address: "ixo1different_address", // Mismatch!
          algo: "secp256k1" as const,
          pubkey: new Uint8Array(33),
        },
        did: "did:ixo:different",
        mnemonic: validMnemonic,
        getAccounts: vi.fn(),
        signDirect: vi.fn(),
        sign: vi.fn(),
      };

      mockGetCustomerIxoAccount.mockResolvedValue(mockIxoAccount);
      mockGetSecpClient.mockResolvedValue(mockWallet);

      await expect(
        submitCustomerClaimIntent({
          customerId: "C12345678",
          collectionId: "120",
        })
      ).rejects.toThrow("Security check failed");

      expect(mockSubmitClaimIntent).not.toHaveBeenCalled();
    });

    it("should use custom fee and gas parameters", async () => {
      const mockIxoAccount = {
        address: "ixo1abc123def456",
        did: "did:ixo:abc123",
        encryptedMnemonic: Buffer.from("test mnemonic phrase"),
        isPrimary: true,
      };

      const mockWallet = {
        baseAccount: {
          address: "ixo1abc123def456",
          algo: "secp256k1" as const,
          pubkey: new Uint8Array(33),
        },
        did: "did:ixo:abc123",
        mnemonic: "test mnemonic phrase",
        getAccounts: vi.fn(),
        signDirect: vi.fn(),
        sign: vi.fn(),
      };

      const mockTxResult = {
        transactionHash: "ABC123XYZ",
        height: 12345,
        rawLog: "",
        code: 0,
        txIndex: 0,
        events: [],
        msgResponses: [],
        gasUsed: BigInt(0),
        gasWanted: BigInt(0),
      };

      mockGetCustomerIxoAccount.mockResolvedValue(mockIxoAccount);
      mockGetSecpClient.mockResolvedValue(mockWallet);
      mockSubmitClaimIntent.mockResolvedValue(mockTxResult);

      await submitCustomerClaimIntent({
        customerId: "C12345678",
        collectionId: "120",
        feeAmountInUixo: "10000",
        gas: "300000",
        feegranter: "ixo1feegranter",
      });

      expect(mockSubmitClaimIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          feeAmountInUixo: "10000",
          gas: "300000",
          feegranter: "ixo1feegranter",
        })
      );
    });
  });
});
