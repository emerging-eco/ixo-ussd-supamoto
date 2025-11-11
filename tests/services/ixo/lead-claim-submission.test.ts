import { describe, it, expect, vi, beforeEach } from "vitest";
import { submitLeadCreationClaim } from "../../../src/services/ixo/lead-claim-submission.js";

// Mock the SDK
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

vi.mock("../../../src/services/database-storage.js", () => ({
  dataService: {
    insertFailedClaim: vi.fn(async () => ({})),
    createAuditLog: vi.fn(async () => ({})),
  },
}));

describe("Lead Claim Submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits lead creation claim via SDK", async () => {
    const customerId = "CABCDEF1";
    const fullName = "Test User";
    const phoneNumber = "+123";

    const res = await submitLeadCreationClaim({
      customerId,
      phoneNumber,
      fullName,
    });

    expect(res.success).toBe(true);
    expect(res.claimId).toBe("claim-123");

    // Verify SDK was called with correct parameters
    expect(mockSubmitLeadCreationClaim).toHaveBeenCalledWith({
      customerId,
      leadGenerator: "USSD Signup",
      givenName: "Test",
      familyName: "User",
      telephone: phoneNumber,
      nationalId: undefined,
    });

    // Verify it was called exactly once
    expect(mockSubmitLeadCreationClaim).toHaveBeenCalledTimes(1);
  });

  it("handles claim submission timeout", async () => {
    // Mock timeout
    mockSubmitLeadCreationClaim.mockImplementationOnce(
      () => new Promise(() => setTimeout(() => {}, 20000))
    );

    const res = await submitLeadCreationClaim({
      customerId: "CABCDEF1",
      phoneNumber: "+123",
      fullName: "Test User",
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("timeout");
  });
});
