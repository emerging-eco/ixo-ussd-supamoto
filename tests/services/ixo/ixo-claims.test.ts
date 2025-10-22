import { describe, it, expect, vi, beforeEach } from "vitest";
import * as impact from "@ixo/impactxclient-sdk";
import {
  submitClaim,
  typeUrlMsgSubmitClaim,
} from "../../../src/services/ixo/ixo-claims.js";

vi.mock("@ixo/impactxclient-sdk", async () => {
  const actual = await vi.importActual<any>("@ixo/impactxclient-sdk");
  return {
    ...actual,
    createSigningClient: vi.fn(async () => ({
      signAndBroadcast: vi.fn(async () => ({
        transactionHash: "ABC123",
        height: 12345,
        rawLog: "",
        code: 0,
        gasUsed: 100000,
        gasWanted: 200000,
      })),
    })),
  };
});

vi.mock("../../../src/utils/secp.js", () => ({
  getSecpClient: vi.fn(async (mnemonic: string) => ({
    baseAccount: { address: "ixo1testaddress" },
    mnemonic,
  })),
}));

describe("ixo-claims submitClaim helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("signs and broadcasts MsgSubmitClaim with expected typeUrl", async () => {
    const claimValue = {
      collectionId: "col-1",
      agentDid: "did:ixo:abc",
      agentAddress: "ixo1testaddress",
    } as any;

    const res = await submitClaim({
      mnemonic: "test mnemonic",
      chainRpcUrl: "https://rpc.test",
      claim: claimValue,
      memo: "test memo",
    });

    expect(res.transactionHash).toBe("ABC123");

    // Capture what was sent to signAndBroadcast
    const client = await (impact.createSigningClient as any).mock.results[0]
      .value;
    const call = client.signAndBroadcast.mock.calls[0];
    const [fromAddress, msgs, fee, memo] = call;

    expect(fromAddress).toBe("ixo1testaddress");
    expect(memo).toBe("test memo");
    expect(Array.isArray(msgs)).toBe(true);
    expect(msgs[0].typeUrl).toBe(typeUrlMsgSubmitClaim);
    expect(fee.amount?.[0]?.denom).toBe("uixo");
  });
});
