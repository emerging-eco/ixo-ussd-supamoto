import { describe, it, expect, vi, beforeEach } from "vitest";
import { createIxoAccountBackground } from "../../../src/services/ixo/background-ixo-creation.js";

vi.mock("../../../src/services/ixo/ixo-profile.js", () => ({
  createIxoAccount: vi.fn(async () => ({
    userId: "CABCDEF1",
    mnemonic: "test mnemonic",
    address: "ixo1testaddress",
    did: "did:ixo:test",
    matrix: {
      mxUsername: "@user:matrix",
      mxPassword: "pass",
    },
  })),
}));

// Mock the SDK instead of direct blockchain submission
const mockSubmitLeadCreationClaim = vi.fn(async () => ({
  data: {
    claimId: "claim-123",
  },
}));

vi.mock("@ixo/supamoto-bot-sdk", () => ({
  createClaimsBotClient: vi.fn(() => ({
    claims: {
      v1: {
        submitLeadCreationClaim: mockSubmitLeadCreationClaim,
      },
    },
  })),
  ClaimsBotTypes: {
    LeadGenerator: {
      ussdSignup: "USSD Signup",
    },
  },
}));

vi.mock("../../../src/config.js", () => ({
  config: {
    CLAIMS_BOT: {
      URL: "https://test-claims-bot.com",
      ACCESS_TOKEN: "test-token",
    },
  },
  ENV: {
    IS_TEST: true,
    IS_PRODUCTION: false,
    IS_DEVELOPMENT: false,
    IS_DEV_OR_TEST: true,
    IS_VITEST: true,
    IS_ANY_TEST: true,
    CURRENT: "test",
  },
}));

vi.mock("../../../src/db/index.js", () => ({
  db: {
    transaction: () => ({
      execute: async (fn: any) =>
        fn({
          insertInto: () => ({
            values: () => ({
              returning: () => ({
                executeTakeFirstOrThrow: async () => ({ id: 1 }),
              }),
            }),
            returning: () => ({
              executeTakeFirstOrThrow: async () => ({ id: 1 }),
            }),
          }),
          updateTable: () => ({
            set: () => ({ where: () => ({ execute: async () => ({}) }) }),
          }),
        }),
    }),
  },
}));

describe("background IXO creation flow (smoke)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates IXO account, saves to DB, and submits lead creation claim via SDK", async () => {
    const customerId = "CABCDEF1";
    const fullName = "Test User";
    const phoneNumber = "+123";

    const res = await createIxoAccountBackground({
      customerId,
      customerRecordId: 1,
      phoneNumber,
      fullName,
      pin: "1234",
    });

    expect(res.success).toBe(true);

    // Verify SDK was called with correct parameters
    expect(mockSubmitLeadCreationClaim).toHaveBeenCalledWith({
      customerId,
      leadGenerator: "USSD Signup",
      givenName: "Test",
      familyName: "User",
      telephone: phoneNumber,
    });

    // Verify it was called exactly once
    expect(mockSubmitLeadCreationClaim).toHaveBeenCalledTimes(1);
  });
});
