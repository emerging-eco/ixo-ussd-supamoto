import { describe, it, expect, vi, beforeEach } from "vitest";
import { createActor } from "xstate";
import {
  agentToolsMachine,
  AgentToolsOutput,
} from "../../../../src/machines/supamoto/agent-tools/agentToolsMachine.js";

// Mock all external dependencies
vi.mock("../../../../src/services/database-storage.js", () => ({
  dataService: {
    getCustomerByCustomerId: vi.fn(),
    createOTP: vi.fn(),
    validateOTP: vi.fn(),
    markOTPAsUsed: vi.fn(),
    createLGIntent: vi.fn(),
    createDeliveryConfirmation: vi.fn(),
    getDeliveryConfirmation: vi.fn(),
    updateDeliveryConfirmation: vi.fn(),
  },
}));

vi.mock("../../../../src/services/database-manager.js", () => ({
  databaseManager: {
    getKysely: vi.fn(() => ({
      selectFrom: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            select: vi.fn(() => ({
              where: vi.fn(() => ({
                where: vi.fn(() => ({
                  executeTakeFirst: vi.fn(),
                })),
              })),
            })),
          })),
        })),
      })),
      updateTable: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            execute: vi.fn(),
          })),
        })),
      })),
    })),
  },
}));

vi.mock("../../../../src/services/ixo/ixo-claims.js", () => ({
  submitClaimIntent: vi.fn(),
  submitClaim: vi.fn(),
}));

vi.mock("../../../../src/services/claims-bot.js", () => ({
  logBeanDeliveryConfirmation: vi.fn(),
}));

vi.mock("../../../../src/services/sms.js", () => ({
  sendSMS: vi.fn(),
  generatePin: vi.fn(() => "12345"),
}));

vi.mock("../../../../src/utils/secp.js", () => ({
  getSecpClient: vi.fn(() =>
    Promise.resolve({
      baseAccount: {
        address: "ixo1testaddress",
      },
    })
  ),
}));

import { dataService } from "../../../../src/services/database-storage.js";
import { databaseManager } from "../../../../src/services/database-manager.js";
import { submitClaim } from "../../../../src/services/ixo/ixo-claims.js";
import { logBeanDeliveryConfirmation } from "../../../../src/services/claims-bot.js";

describe("Agent Tools Machine", () => {
  const mockInput = {
    sessionId: "test-session",
    phoneNumber: "+260971234567",
    serviceCode: "*2233#",
    lgCustomerId: "C12345678",
    menuItem: "registerIntent" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Initial State", () => {
    it("should start in determineInitialState and route to registerIntent", () => {
      const actor = createActor(agentToolsMachine, { input: mockInput });
      actor.start();

      const snapshot = actor.getSnapshot();
      // Should transition to registerIntent based on menuItem
      expect(snapshot.value).toMatchObject({
        registerIntent: "enterCustomerId",
      });
    });

    it("should route to submitOTP when menuItem is submitOTP", () => {
      const actor = createActor(agentToolsMachine, {
        input: { ...mockInput, menuItem: "submitOTP" },
      });
      actor.start();

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toMatchObject({ submitOTP: "enterCustomerId" });
    });

    it("should route to confirmDelivery when menuItem is confirmDelivery", () => {
      const actor = createActor(agentToolsMachine, {
        input: { ...mockInput, menuItem: "confirmDelivery" },
      });
      actor.start();

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toMatchObject({
        confirmDelivery: "enterCustomerId",
      });
    });

    it("should initialize context with correct values", () => {
      const actor = createActor(agentToolsMachine, { input: mockInput });
      actor.start();

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.sessionId).toBe("test-session");
      expect(snapshot.context.phoneNumber).toBe("+260971234567");
      expect(snapshot.context.lgCustomerId).toBe("C12345678");
      expect(snapshot.context.menuItem).toBe("registerIntent");
    });
  });

  describe("Menu Item 3: Register Intent to Deliver Beans", () => {
    beforeEach(() => {
      // Setup common mocks for register intent flow
      const mockDb = databaseManager.getKysely();
      vi.mocked(mockDb.selectFrom).mockReturnValue({
        innerJoin: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            select: vi.fn(() => ({
              where: vi.fn(() => ({
                where: vi.fn(() => ({
                  executeTakeFirst: vi.fn(() =>
                    Promise.resolve({ phone_number: "+260979999999" })
                  ),
                })),
              })),
            })),
          })),
        })),
      } as any);
    });

    it("should display enter customer ID prompt", () => {
      const actor = createActor(agentToolsMachine, { input: mockInput });
      actor.start();

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.message).toContain("Enter Customer ID");
    });

    it("should accept valid customer ID and transition to fetchingCustomerData", () => {
      vi.mocked(dataService.getCustomerByCustomerId).mockResolvedValue({
        id: 1,
        customerId: "C98765432",
        fullName: "Test Customer",
        email: undefined,
        nationalId: undefined,
        encryptedPin: "encrypted",
        preferredLanguage: "eng",
        lastCompletedAction: "",
        householdId: undefined,
        role: "customer",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const actor = createActor(agentToolsMachine, { input: mockInput });
      actor.start();

      actor.send({ type: "INPUT", input: "C98765432" });

      // Should transition to fetchingCustomerData
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toMatchObject({
        registerIntent: "fetchingCustomerData",
      });
      expect(snapshot.context.customerId).toBe("C98765432");
    });

    it("should reject invalid customer ID format", () => {
      const actor = createActor(agentToolsMachine, { input: mockInput });
      actor.start();

      actor.send({ type: "INPUT", input: "INVALID" });

      const snapshot = actor.getSnapshot();
      // Should stay in enterCustomerId state
      expect(snapshot.value).toMatchObject({
        registerIntent: "enterCustomerId",
      });
    });

    it("should handle back navigation from enterCustomerId", () => {
      const actor = createActor(agentToolsMachine, { input: mockInput });
      actor.start();

      actor.send({ type: "INPUT", input: "0" });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("complete");
      expect(snapshot.context.nextParentState).toBe(AgentToolsOutput.BACK);
    });

    it("should handle customer not found error", async () => {
      vi.mocked(dataService.getCustomerByCustomerId).mockResolvedValue(null);

      const actor = createActor(agentToolsMachine, { input: mockInput });
      actor.start();

      actor.send({ type: "INPUT", input: "C98765432" });

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 50));

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toMatchObject({ registerIntent: "error" });
      expect(snapshot.context.error).toBeDefined();
    });

    it("should progress through register intent flow states", async () => {
      // This test verifies the state transitions work correctly
      // Full integration testing would require more complex mocking
      vi.mocked(dataService.getCustomerByCustomerId).mockResolvedValue({
        id: 1,
        customerId: "C98765432",
        fullName: "Test Customer",
        email: undefined,
        nationalId: undefined,
        encryptedPin: "encrypted",
        preferredLanguage: "eng",
        lastCompletedAction: "",
        householdId: undefined,
        role: "customer",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const actor = createActor(agentToolsMachine, { input: mockInput });
      actor.start();

      // Verify initial state
      expect(actor.getSnapshot().value).toMatchObject({
        registerIntent: "enterCustomerId",
      });

      // Send valid customer ID
      actor.send({ type: "INPUT", input: "C98765432" });

      // Should transition to fetchingCustomerData
      expect(actor.getSnapshot().value).toMatchObject({
        registerIntent: "fetchingCustomerData",
      });
      expect(actor.getSnapshot().context.customerId).toBe("C98765432");

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have progressed past initial states (may be in checkingVoucher or error)
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.customerId).toBe("C98765432");
      expect(dataService.getCustomerByCustomerId).toHaveBeenCalledWith(
        "C98765432"
      );
    });
  });

  describe("Menu Item 4: Submit Customer OTP", () => {
    const otpInput = {
      ...mockInput,
      menuItem: "submitOTP" as const,
    };

    it("should display enter customer ID prompt", () => {
      const actor = createActor(agentToolsMachine, { input: otpInput });
      actor.start();

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toMatchObject({ submitOTP: "enterCustomerId" });
      expect(snapshot.context.message).toContain("Enter Customer ID");
    });

    it("should transition to enterOTP after valid customer ID", () => {
      const actor = createActor(agentToolsMachine, { input: otpInput });
      actor.start();

      actor.send({ type: "INPUT", input: "C98765432" });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toMatchObject({ submitOTP: "enterOTP" });
      expect(snapshot.context.customerId).toBe("C98765432");
    });

    it("should accept valid 5-digit OTP", () => {
      const actor = createActor(agentToolsMachine, { input: otpInput });
      actor.start();

      actor.send({ type: "INPUT", input: "C98765432" });
      actor.send({ type: "INPUT", input: "12345" });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toMatchObject({ submitOTP: "validatingOTP" });
      expect(snapshot.context.otp).toBe("12345");
    });

    it("should reject invalid OTP format", () => {
      const actor = createActor(agentToolsMachine, { input: otpInput });
      actor.start();

      actor.send({ type: "INPUT", input: "C98765432" });
      actor.send({ type: "INPUT", input: "123" }); // Too short

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toMatchObject({ submitOTP: "enterOTP" });
    });

    it("should handle valid OTP and submit claim", async () => {
      vi.mocked(dataService.validateOTP).mockResolvedValue({
        id: 1,
        customerId: "C98765432",
        lgCustomerId: "C12345678",
        intentId: 1,
        otp: "12345",
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 600000),
        usedAt: null,
        isValid: true,
        createdAt: new Date(),
      });

      vi.mocked(submitClaim).mockResolvedValue({
        transactionHash: "DEF456",
        height: 12346,
        code: 0,
        events: [
          {
            type: "ixo.claims.v1beta1.ClaimSubmitted",
            attributes: [{ key: "claim_id", value: "claim-456" }],
          },
        ],
      } as any);

      vi.mocked(dataService.markOTPAsUsed).mockResolvedValue(undefined);
      vi.mocked(dataService.createDeliveryConfirmation).mockResolvedValue({
        id: 1,
        customerId: "C98765432",
        lgCustomerId: "C12345678",
        otpId: 1,
        lgConfirmedAt: null,
        customerConfirmedAt: null,
        customerConfirmedReceipt: null,
        tokenTransferredAt: null,
        confirmationDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const actor = createActor(agentToolsMachine, { input: otpInput });
      actor.start();

      actor.send({ type: "INPUT", input: "C98765432" });
      actor.send({ type: "INPUT", input: "12345" });

      await new Promise(resolve => setTimeout(resolve, 200));

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toMatchObject({ submitOTP: "complete" });
      expect(snapshot.context.claimId).toBe("claim-456");
      expect(dataService.markOTPAsUsed).toHaveBeenCalledWith(1);
    });

    it("should handle invalid OTP error", async () => {
      vi.mocked(dataService.validateOTP).mockResolvedValue(null);

      const actor = createActor(agentToolsMachine, { input: otpInput });
      actor.start();

      actor.send({ type: "INPUT", input: "C98765432" });
      actor.send({ type: "INPUT", input: "99999" });

      await new Promise(resolve => setTimeout(resolve, 50));

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toMatchObject({ submitOTP: "error" });
      expect(snapshot.context.error).toBeDefined();
    });
  });

  describe("Menu Item 5: Confirm Bean Delivery", () => {
    const confirmInput = {
      ...mockInput,
      menuItem: "confirmDelivery" as const,
    };

    it("should display enter customer ID prompt", () => {
      const actor = createActor(agentToolsMachine, { input: confirmInput });
      actor.start();

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toMatchObject({
        confirmDelivery: "enterCustomerId",
      });
      expect(snapshot.context.message).toContain("Enter Customer ID");
    });

    it("should successfully confirm delivery", async () => {
      vi.mocked(dataService.getDeliveryConfirmation).mockResolvedValue({
        id: 1,
        customerId: "C98765432",
        lgCustomerId: "C12345678",
        otpId: 1,
        lgConfirmedAt: null,
        customerConfirmedAt: null,
        customerConfirmedReceipt: null,
        tokenTransferredAt: null,
        confirmationDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(dataService.updateDeliveryConfirmation).mockResolvedValue(
        undefined
      );
      vi.mocked(logBeanDeliveryConfirmation).mockResolvedValue({
        success: true,
        message: "Bean delivery tracked via blockchain and database",
      });

      const actor = createActor(agentToolsMachine, { input: confirmInput });
      actor.start();

      actor.send({ type: "INPUT", input: "C98765432" });

      await new Promise(resolve => setTimeout(resolve, 100));

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toMatchObject({ confirmDelivery: "complete" });
      expect(dataService.updateDeliveryConfirmation).toHaveBeenCalled();
      expect(logBeanDeliveryConfirmation).toHaveBeenCalled();
    });

    it("should handle missing confirmation record error", async () => {
      vi.mocked(dataService.getDeliveryConfirmation).mockResolvedValue(null);

      const actor = createActor(agentToolsMachine, { input: confirmInput });
      actor.start();

      actor.send({ type: "INPUT", input: "C98765432" });

      await new Promise(resolve => setTimeout(resolve, 50));

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toMatchObject({ confirmDelivery: "error" });
      expect(snapshot.context.error).toBeDefined();
    });
  });

  describe("Navigation and Guards", () => {
    it("should validate customer ID format correctly", () => {
      const actor = createActor(agentToolsMachine, { input: mockInput });
      actor.start();

      // Valid formats
      actor.send({ type: "INPUT", input: "C12345678" });
      expect(actor.getSnapshot().context.customerId).toBe("C12345678");

      // Invalid formats should not update context
      const actor2 = createActor(agentToolsMachine, { input: mockInput });
      actor2.start();
      actor2.send({ type: "INPUT", input: "12345678" }); // Missing C prefix
      expect(actor2.getSnapshot().value).toMatchObject({
        registerIntent: "enterCustomerId",
      });
    });

    it("should validate OTP format correctly", () => {
      const otpInput = { ...mockInput, menuItem: "submitOTP" as const };
      const actor = createActor(agentToolsMachine, { input: otpInput });
      actor.start();

      actor.send({ type: "INPUT", input: "C98765432" });

      // Valid 5-digit OTP
      actor.send({ type: "INPUT", input: "12345" });
      expect(actor.getSnapshot().context.otp).toBe("12345");

      // Invalid OTP formats
      const actor2 = createActor(agentToolsMachine, { input: otpInput });
      actor2.start();
      actor2.send({ type: "INPUT", input: "C98765432" });
      actor2.send({ type: "INPUT", input: "1234" }); // Too short
      expect(actor2.getSnapshot().value).toMatchObject({
        submitOTP: "enterOTP",
      });
    });
  });
});
