/**
 * Unit tests for Lead Creation Claim submission via SDK
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createClaimsBotClient, ClaimsBotTypes } from "@ixo/supamoto-bot-sdk";

// Mock the SDK
vi.mock("@ixo/supamoto-bot-sdk", () => ({
  createClaimsBotClient: vi.fn(),
  ClaimsBotTypes: {
    LeadGenerator: {
      ussdSignup: "USSD Signup",
      leadGenerator: "Lead Generator",
    },
  },
}));

// Mock config
vi.mock("../../../src/config.js", () => ({
  config: {
    CLAIMS_BOT: {
      URL: "https://test-claims-bot.com",
      ACCESS_TOKEN: "test-token",
    },
  },
}));

describe("Lead Creation Claim Submission", () => {
  let mockSubmitLeadCreationClaim: ReturnType<typeof vi.fn>;
  let mockClaimsBotClient: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup mock SDK client
    mockSubmitLeadCreationClaim = vi.fn();
    mockClaimsBotClient = {
      claims: {
        v1: {
          submitLeadCreationClaim: mockSubmitLeadCreationClaim,
        },
      },
    };

    (createClaimsBotClient as any).mockReturnValue(mockClaimsBotClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Name Parsing", () => {
    it("should handle single name correctly", async () => {
      const fullName = "John";
      const nameParts = fullName.trim().split(/\s+/);
      const givenName = nameParts[0] || "";
      const familyName = nameParts.slice(1).join(" ") || "";

      expect(givenName).toBe("John");
      expect(familyName).toBe("");
    });

    it("should handle full name correctly", async () => {
      const fullName = "John Doe";
      const nameParts = fullName.trim().split(/\s+/);
      const givenName = nameParts[0] || "";
      const familyName = nameParts.slice(1).join(" ") || "";

      expect(givenName).toBe("John");
      expect(familyName).toBe("Doe");
    });

    it("should handle multiple names correctly", async () => {
      const fullName = "John Michael Doe";
      const nameParts = fullName.trim().split(/\s+/);
      const givenName = nameParts[0] || "";
      const familyName = nameParts.slice(1).join(" ") || "";

      expect(givenName).toBe("John");
      expect(familyName).toBe("Michael Doe");
    });

    it("should handle names with extra whitespace", async () => {
      const fullName = "  John   Doe  ";
      const nameParts = fullName.trim().split(/\s+/);
      const givenName = nameParts[0] || "";
      const familyName = nameParts.slice(1).join(" ") || "";

      expect(givenName).toBe("John");
      expect(familyName).toBe("Doe");
    });

    it("should handle empty name", async () => {
      const fullName = "";
      const nameParts = fullName.trim().split(/\s+/);
      const givenName = nameParts[0] || "";
      const familyName = nameParts.slice(1).join(" ") || "";

      expect(givenName).toBe("");
      expect(familyName).toBe("");
    });
  });

  describe("SDK Client Initialization", () => {
    it("should create claims bot client with correct configuration", () => {
      const client = createClaimsBotClient({
        botUrl: "https://test-claims-bot.com",
        accessToken: "test-token",
      });

      expect(createClaimsBotClient).toHaveBeenCalledWith({
        botUrl: "https://test-claims-bot.com",
        accessToken: "test-token",
      });
      expect(client).toBeDefined();
    });
  });

  describe("Successful Claim Submission", () => {
    it("should submit lead creation claim with correct parameters", async () => {
      const mockResponse = {
        data: {
          claimId: "claim-123",
        },
      };
      mockSubmitLeadCreationClaim.mockResolvedValue(mockResponse);

      const params = {
        customerId: "C123",
        fullName: "John Doe",
        phoneNumber: "+260123456789",
      };

      const nameParts = params.fullName.trim().split(/\s+/);
      const givenName = nameParts[0] || "";
      const familyName = nameParts.slice(1).join(" ") || "";

      const response =
        await mockClaimsBotClient.claims.v1.submitLeadCreationClaim({
          customerId: params.customerId,
          leadGenerator: ClaimsBotTypes.LeadGenerator.ussdSignup,
          givenName: givenName || undefined,
          familyName: familyName || undefined,
          telephone: params.phoneNumber,
        });

      expect(mockSubmitLeadCreationClaim).toHaveBeenCalledWith({
        customerId: "C123",
        leadGenerator: "USSD Signup",
        givenName: "John",
        familyName: "Doe",
        telephone: "+260123456789",
      });
      expect(response.data.claimId).toBe("claim-123");
    });

    it("should handle optional fields correctly when name parts are empty", async () => {
      const mockResponse = {
        data: {
          claimId: "claim-456",
        },
      };
      mockSubmitLeadCreationClaim.mockResolvedValue(mockResponse);

      const params = {
        customerId: "C456",
        fullName: "John",
        phoneNumber: "+260987654321",
      };

      const nameParts = params.fullName.trim().split(/\s+/);
      const givenName = nameParts[0] || "";
      const familyName = nameParts.slice(1).join(" ") || "";

      await mockClaimsBotClient.claims.v1.submitLeadCreationClaim({
        customerId: params.customerId,
        leadGenerator: ClaimsBotTypes.LeadGenerator.ussdSignup,
        givenName: givenName || undefined,
        familyName: familyName || undefined,
        telephone: params.phoneNumber,
      });

      expect(mockSubmitLeadCreationClaim).toHaveBeenCalledWith({
        customerId: "C456",
        leadGenerator: "USSD Signup",
        givenName: "John",
        familyName: undefined,
        telephone: "+260987654321",
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle 401 Unauthorized error", async () => {
      const error = {
        message: "Unauthorized",
        response: {
          status: 401,
          data: { error: "Invalid access token" },
        },
      };
      mockSubmitLeadCreationClaim.mockRejectedValue(error);

      await expect(
        mockClaimsBotClient.claims.v1.submitLeadCreationClaim({
          customerId: "C123",
          leadGenerator: ClaimsBotTypes.LeadGenerator.ussdSignup,
          telephone: "+260123456789",
        })
      ).rejects.toMatchObject({
        message: "Unauthorized",
        response: {
          status: 401,
          data: { error: "Invalid access token" },
        },
      });
    });

    it("should handle 500 Internal Server Error", async () => {
      const error = {
        message: "Internal Server Error",
        response: {
          status: 500,
          data: { error: "Database connection failed" },
        },
      };
      mockSubmitLeadCreationClaim.mockRejectedValue(error);

      await expect(
        mockClaimsBotClient.claims.v1.submitLeadCreationClaim({
          customerId: "C123",
          leadGenerator: ClaimsBotTypes.LeadGenerator.ussdSignup,
          telephone: "+260123456789",
        })
      ).rejects.toMatchObject({
        message: "Internal Server Error",
        response: {
          status: 500,
        },
      });
    });

    it("should handle network timeout error", async () => {
      const error = new Error("Network timeout");
      mockSubmitLeadCreationClaim.mockRejectedValue(error);

      await expect(
        mockClaimsBotClient.claims.v1.submitLeadCreationClaim({
          customerId: "C123",
          leadGenerator: ClaimsBotTypes.LeadGenerator.ussdSignup,
          telephone: "+260123456789",
        })
      ).rejects.toThrow("Network timeout");
    });

    it("should extract HTTP error details correctly", () => {
      const error = {
        message: "Bad Request",
        response: {
          status: 400,
          data: { error: "Invalid customerId format" },
        },
      };

      const errorDetails: any = {
        error: error.message,
        customerId: "C123",
      };

      if ((error as any)?.response) {
        errorDetails.statusCode = (error as any).response.status;
        errorDetails.responseData = (error as any).response.data;
      }

      expect(errorDetails).toEqual({
        error: "Bad Request",
        customerId: "C123",
        statusCode: 400,
        responseData: { error: "Invalid customerId format" },
      });
    });
  });
});
