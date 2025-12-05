import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getClaimsBotDbClient } from "../../src/services/claims-bot-db-client.js";
import * as sdk from "@ixo/supamoto-bot-sdk";

// Mock the SDK
vi.mock("@ixo/supamoto-bot-sdk", async () => {
  const actual = await vi.importActual<any>("@ixo/supamoto-bot-sdk");
  return {
    ...actual,
    createDatabaseClient: vi.fn(() => ({
      ixoAccounts: {
        v1: {
          selectIxoAccountsByCustomerId: vi.fn(),
          selectIxoAccount: vi.fn(),
        },
      },
      matrixAccounts: {
        v1: {
          selectMatrixAccount: vi.fn(),
        },
      },
      customers: {
        v1: {
          selectCustomer: vi.fn(),
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

describe("Claims Bot Database Client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the singleton by clearing the module cache
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should create database client singleton on first call", async () => {
    const client1 = getClaimsBotDbClient();
    const client2 = getClaimsBotDbClient();

    // Should return the same instance (singleton pattern)
    expect(client1).toBe(client2);

    // Should only call createDatabaseClient once
    expect(sdk.createDatabaseClient).toHaveBeenCalledTimes(1);
  });

  it("should initialize with correct database configuration", async () => {
    // Reset the mock to clear previous calls
    vi.clearAllMocks();

    // Reset the module to clear the singleton
    vi.resetModules();

    // Re-import after reset
    const { getClaimsBotDbClient: freshGetClient } = await import(
      "../../src/services/claims-bot-db-client.js"
    );

    freshGetClient();

    expect(sdk.createDatabaseClient).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "localhost",
        port: 5432,
        user: "supamoto_user",
        password: "supamoto_password",
        database: "supamoto_db",
        ssl: false,
        max: 10,
        min: 2,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      }),
      "test-encryption-key-base64"
    );
  });

  it("should throw error when encryption key is missing", async () => {
    // Re-mock config without encryption key
    vi.doMock("../../src/config.js", () => ({
      config: {
        CLAIMS_BOT: {
          DB_ENCRYPTION_KEY: "",
        },
        CLAIMS_BOT_DB: {
          host: "localhost",
          port: 5432,
          user: "supamoto_user",
          password: "supamoto_password",
          database: "supamoto_db",
        },
      },
    }));

    // Need to re-import the module to get the new config
    const { getClaimsBotDbClient: getClient } = await import(
      "../../src/services/claims-bot-db-client.js"
    );

    expect(() => getClient()).toThrow(
      "CLAIMS_BOT_DB_ENCRYPTION_KEY must be configured"
    );
  });

  it("should throw error when database connection parameters are missing", async () => {
    // Re-mock config without database parameters
    vi.doMock("../../src/config.js", () => ({
      config: {
        CLAIMS_BOT: {
          DB_ENCRYPTION_KEY: "test-encryption-key-base64",
        },
        CLAIMS_BOT_DB: {
          host: "",
          port: 5432,
          user: "supamoto_user",
          password: "supamoto_password",
          database: "",
        },
      },
    }));

    // Need to re-import the module to get the new config
    const { getClaimsBotDbClient: getClient } = await import(
      "../../src/services/claims-bot-db-client.js"
    );

    expect(() => getClient()).toThrow(
      "Claims Bot Database connection parameters"
    );
  });
});
