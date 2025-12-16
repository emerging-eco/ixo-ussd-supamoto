import { describe, it, expect, vi, beforeEach } from "vitest";

// Create a shared mock function that can be accessed across tests
const mockSelectClaimsByCustomerId = vi.fn();

// Mock the SDK
vi.mock("@ixo/supamoto-bot-sdk", async () => {
  const actual = await vi.importActual<any>("@ixo/supamoto-bot-sdk");
  return {
    ...actual,
    createDatabaseClient: vi.fn(() => ({
      claims: {
        v1: {
          selectClaimsByCustomerId: mockSelectClaimsByCustomerId,
        },
      },
    })),
  };
});

// Mock config
vi.mock("../../src/config.js", () => ({
  config: {
    CLAIMS_BOT: {
      DB_ENCRYPTION_KEY: "test-encryption-key-base64",
    },
    CLAIMS_BOT_DB: {
      host: "localhost",
      port: 5432,
      user: "supamoto_user",
      password: "supamoto_password",
      database: "supamoto_db",
      ssl: false,
    },
  },
}));

// Mock logger
vi.mock("../../src/services/logger.js", () => ({
  createModuleLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

describe("getCustomerCollectionId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("should return collection ID when customer has claims with collection ID", async () => {
    const mockClaims = [
      {
        id: "claim-1",
        customerId: "C12345678",
        collection_id: "collection-123",
        status: "approved",
      },
    ];

    mockSelectClaimsByCustomerId.mockResolvedValue(mockClaims);

    // Re-import to get fresh instance with mocks
    const { getCustomerCollectionId: freshGetCollectionId } = await import(
      "../../src/services/claims-bot-api-client.js"
    );

    const result = await freshGetCollectionId("C12345678");

    expect(result).toBe("collection-123");
    expect(mockSelectClaimsByCustomerId).toHaveBeenCalledWith({
      customerId: "C12345678",
    });
  });

  it("should return null when customer has no claims", async () => {
    mockSelectClaimsByCustomerId.mockResolvedValue([]);

    const { getCustomerCollectionId: freshGetCollectionId } = await import(
      "../../src/services/claims-bot-api-client.js"
    );

    const result = await freshGetCollectionId("C12345678");

    expect(result).toBeNull();
    expect(mockSelectClaimsByCustomerId).toHaveBeenCalledWith({
      customerId: "C12345678",
    });
  });

  it("should return null when customer has claims but no collection ID", async () => {
    const mockClaims = [
      {
        id: "claim-1",
        customerId: "C12345678",
        status: "pending",
        // No collection_id field
      },
      {
        id: "claim-2",
        customerId: "C12345678",
        collection_id: null,
        status: "pending",
      },
    ];

    mockSelectClaimsByCustomerId.mockResolvedValue(mockClaims);

    const { getCustomerCollectionId: freshGetCollectionId } = await import(
      "../../src/services/claims-bot-api-client.js"
    );

    const result = await freshGetCollectionId("C12345678");

    expect(result).toBeNull();
  });

  it("should throw error when database query fails", async () => {
    const dbError = new Error("Database connection failed");
    mockSelectClaimsByCustomerId.mockRejectedValue(dbError);

    const { getCustomerCollectionId: freshGetCollectionId } = await import(
      "../../src/services/claims-bot-api-client.js"
    );

    await expect(freshGetCollectionId("C12345678")).rejects.toThrow(
      "Database connection failed"
    );
  });

  it("should handle customer IDs with 10 digits (e.g., C359660016)", async () => {
    const mockClaims = [
      {
        id: "claim-1",
        customerId: "C359660016",
        collection_id: "collection-456",
        status: "approved",
      },
    ];

    mockSelectClaimsByCustomerId.mockResolvedValue(mockClaims);

    const { getCustomerCollectionId: freshGetCollectionId } = await import(
      "../../src/services/claims-bot-api-client.js"
    );

    const result = await freshGetCollectionId("C359660016");

    expect(result).toBe("collection-456");
    expect(mockSelectClaimsByCustomerId).toHaveBeenCalledWith({
      customerId: "C359660016",
    });
  });

  it("should find first claim with collection ID from multiple claims", async () => {
    const mockClaims = [
      {
        id: "claim-1",
        customerId: "C12345678",
        status: "pending",
        // No collection_id
      },
      {
        id: "claim-2",
        customerId: "C12345678",
        collection_id: "collection-first",
        status: "approved",
      },
      {
        id: "claim-3",
        customerId: "C12345678",
        collection_id: "collection-second",
        status: "approved",
      },
    ];

    mockSelectClaimsByCustomerId.mockResolvedValue(mockClaims);

    const { getCustomerCollectionId: freshGetCollectionId } = await import(
      "../../src/services/claims-bot-api-client.js"
    );

    const result = await freshGetCollectionId("C12345678");

    expect(result).toBe("collection-first");
  });
});
