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

vi.mock("../../../src/services/ixo/ixo-claims.js", () => ({
  submitClaim: vi.fn(async () => ({
    transactionHash: "TX123",
    height: 100,
    rawLog: "",
    code: 0,
    gasUsed: 100000,
    gasWanted: 200000,
  })),
}));

vi.mock("../../../src/services/ixo/config.js", () => ({
  getIxoConfig: vi.fn(() => ({
    chainRpcUrl: "https://rpc.test",
    feegrantGranter: "",
    matrixHomeserverUrl: "https://matrix.test",
    roomBotUrl: "https://bot.test",
  })),
}));

vi.mock("../../db/index.js", () => ({
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
    process.env.LEADGEN_COLLECTION_ID = "leadgen-1";
  });

  it("creates IXO account, saves to DB, and submits LeadGeneration claim", async () => {
    const customerId = "CABCDEF1";
    const templateUrl =
      "https://devmx.ixo.earth/_matrix/media/v3/download/devmx.ixo.earth/LWCamzPswXpgrfwyyJvcjzoK";
    process.env.LEADGEN_COLLECTION_ID = "410";
    process.env.LEADGEN_TEMPLATE_URL = templateUrl;

    const res = await createIxoAccountBackground({
      customerId,
      customerRecordId: 1,
      phoneNumber: "+123",
      fullName: "Test User",
      pin: "1234",
    });

    expect(res.success).toBe(true);

    // Verify deterministic claimId derivation and that submitClaim received it
    const { submitClaim } = await import("./ixo-claims.js");
    const submitMock: any = submitClaim as any;
    const call = submitMock.mock.calls[0];
    const args = call[0];

    // Recompute expected claimId
    const { sha256 } = await import("@cosmjs/crypto");
    const { toHex } = await import("@cosmjs/encoding");
    const expectedClaimId = toHex(
      sha256(new TextEncoder().encode(`${customerId}|${templateUrl}`))
    );

    expect(args.claim.claimId).toBe(expectedClaimId);
    expect(args.claim.collectionId).toBe("410");
  });
});
