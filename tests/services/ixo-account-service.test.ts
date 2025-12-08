import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getCustomerIxoAccount } from "../../src/services/ixo-account-service.js";

// Mock the Claims Bot DB Client
const mockSelectIxoAccountsByCustomerId = vi.fn();

vi.mock("../../src/services/claims-bot-db-client.js", () => ({
  getClaimsBotDbClient: vi.fn(() => ({
    ixoAccounts: {
      v1: {
        selectIxoAccountsByCustomerId: mockSelectIxoAccountsByCustomerId,
      },
    },
  })),
}));

// Mock logger
vi.mock("../../src/services/logger.js", () => ({
  createModuleLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

describe("IXO Account Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should retrieve IXO account by customer ID", async () => {
    const mockAccount = {
      address: "ixo1abc123def456",
      did: "did:ixo:abc123",
      customer_id: "C12345678",
      encrypted_mnemonic: Buffer.from("test mnemonic"),
      is_primary: true,
    };

    mockSelectIxoAccountsByCustomerId.mockResolvedValue([mockAccount]);

    const result = await getCustomerIxoAccount("C12345678");

    expect(result).toEqual({
      address: "ixo1abc123def456",
      did: "did:ixo:abc123",
      encryptedMnemonic: Buffer.from("test mnemonic"),
      isPrimary: true,
    });

    expect(mockSelectIxoAccountsByCustomerId).toHaveBeenCalledWith({
      customerId: "C12345678",
    });
  });

  it("should return null when customer has no IXO account", async () => {
    mockSelectIxoAccountsByCustomerId.mockResolvedValue([]);

    const result = await getCustomerIxoAccount("C12345678");

    expect(result).toBeNull();
    expect(mockSelectIxoAccountsByCustomerId).toHaveBeenCalledWith({
      customerId: "C12345678",
    });
  });

  it("should return null when selectIxoAccountsByCustomerId returns null", async () => {
    mockSelectIxoAccountsByCustomerId.mockResolvedValue(null);

    const result = await getCustomerIxoAccount("C12345678");

    expect(result).toBeNull();
  });

  it("should select primary account when multiple accounts exist", async () => {
    const mockAccounts = [
      {
        address: "ixo1account1",
        did: "did:ixo:account1",
        customer_id: "C12345678",
        encrypted_mnemonic: Buffer.from("mnemonic 1"),
        is_primary: false,
      },
      {
        address: "ixo1account2",
        did: "did:ixo:account2",
        customer_id: "C12345678",
        encrypted_mnemonic: Buffer.from("mnemonic 2"),
        is_primary: true,
      },
      {
        address: "ixo1account3",
        did: "did:ixo:account3",
        customer_id: "C12345678",
        encrypted_mnemonic: Buffer.from("mnemonic 3"),
        is_primary: false,
      },
    ];

    mockSelectIxoAccountsByCustomerId.mockResolvedValue(mockAccounts);

    const result = await getCustomerIxoAccount("C12345678");

    expect(result).toEqual({
      address: "ixo1account2",
      did: "did:ixo:account2",
      encryptedMnemonic: Buffer.from("mnemonic 2"),
      isPrimary: true,
    });
  });

  it("should select first account when no primary account exists", async () => {
    const mockAccounts = [
      {
        address: "ixo1account1",
        did: "did:ixo:account1",
        customer_id: "C12345678",
        encrypted_mnemonic: Buffer.from("mnemonic 1"),
        is_primary: false,
      },
      {
        address: "ixo1account2",
        did: "did:ixo:account2",
        customer_id: "C12345678",
        encrypted_mnemonic: Buffer.from("mnemonic 2"),
        is_primary: false,
      },
    ];

    mockSelectIxoAccountsByCustomerId.mockResolvedValue(mockAccounts);

    const result = await getCustomerIxoAccount("C12345678");

    expect(result).toEqual({
      address: "ixo1account1",
      did: "did:ixo:account1",
      encryptedMnemonic: Buffer.from("mnemonic 1"),
      isPrimary: false,
    });
  });

  it("should throw error when database query fails", async () => {
    mockSelectIxoAccountsByCustomerId.mockRejectedValue(
      new Error("Database connection failed")
    );

    await expect(getCustomerIxoAccount("C12345678")).rejects.toThrow(
      "Database connection failed"
    );
  });
});
