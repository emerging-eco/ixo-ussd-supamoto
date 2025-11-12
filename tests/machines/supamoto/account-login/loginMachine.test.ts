/**
 *
 * Login Machine Tests
 *
 * Tests the login machine's behavior including:
 * - Customer ID validation and lookup
 * - PIN verification with attempt tracking
 * - Error handling and security measures
 * - Navigation flows
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createActor } from "xstate";
import {
  loginMachine,
  LoginOutput,
  PIN_PROMPT,
  VERIFYING_MSG,
  VERIFYING_PIN_MSG,
} from "./loginMachine.js";
import { dataService } from "../../../../src/services/database-storage.js";
import { encryptPin } from "../../../../src/utils/encryption.js";

// Mock dependencies
vi.mock("../../../../src/services/database-storage.js", () => ({
  dataService: {
    getCustomerByCustomerId: vi.fn(),
    clearCustomerPin: vi.fn(),
    createAuditLog: vi.fn(),
  },
}));
vi.mock("../../../../src/utils/encryption.js", () => ({
  encryptPin: vi.fn(),
}));
vi.mock("../../../../src/services/logger.js", () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));
vi.mock("../../../../src/services/sms.js", () => ({
  sendSMSWithRetry: vi.fn(),
}));

const mockDataService = vi.mocked(dataService);
const mockEncryptPin = vi.mocked(encryptPin);

describe("loginMachine", () => {
  const mockInput = {
    sessionId: "test-session",
    phoneNumber: "+260123456789",
    serviceCode: "*2233#",
  };

  const mockCustomer = {
    id: 1,
    customerId: "C12345678",
    fullName: "Test Customer",
    email: "test@example.com",
    encryptedPin: "9YMhFg0zu5IKq9aFG5a/PA==",
    preferredLanguage: "eng",
    lastCompletedAction: "",
    householdId: undefined,
    role: "customer" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Customer ID Entry", () => {
    it("should start in customerIdEntry state with correct message", () => {
      const actor = createActor(loginMachine, { input: mockInput });
      actor.start();

      expect(actor.getSnapshot().value).toBe("customerIdEntry");
      expect(actor.getSnapshot().context.message).toBe(
        "Enter your Customer ID to log in:"
      );
    });

    it("should validate customer ID format", () => {
      const actor = createActor(loginMachine, { input: mockInput });
      actor.start();

      // Invalid format
      actor.send({ type: "INPUT", input: "invalid" });
      expect(actor.getSnapshot().value).toBe("customerIdEntry");
      expect(actor.getSnapshot().context.message).toBe(
        "Invalid Customer ID format. Please try again."
      );

      // Valid format
      mockDataService.getCustomerByCustomerId.mockResolvedValue(mockCustomer);
      actor.send({ type: "INPUT", input: "C12345678" });
      expect(actor.getSnapshot().value).toBe("verifyingCustomerId");
    });

    it("should handle exit navigation", () => {
      const actor = createActor(loginMachine, { input: mockInput });
      actor.start();

      // Test exit navigation
      actor.send({ type: "INPUT", input: "*" });
      expect(actor.getSnapshot().value).toBe("routeToMain");
    });
  });

  describe("Customer Verification", () => {
    it("should handle customer not found", async () => {
      mockDataService.getCustomerByCustomerId.mockRejectedValue(
        new Error("CUSTOMER_NOT_FOUND")
      );

      const actor = createActor(loginMachine, { input: mockInput });
      actor.start();

      actor.send({ type: "INPUT", input: "C12345678" });

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(actor.getSnapshot().value).toBe("routeToMain");
      expect((actor.getSnapshot().output as any)?.result).toBe(
        LoginOutput.CUSTOMER_NOT_FOUND
      );
    });

    it("should handle customer with empty PIN", async () => {
      mockDataService.getCustomerByCustomerId.mockRejectedValue(
        new Error("ENCRYPTED_PIN_FIELD_EMPTY")
      );

      const actor = createActor(loginMachine, { input: mockInput });
      actor.start();

      actor.send({ type: "INPUT", input: "C12345678" });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(actor.getSnapshot().value).toBe("routeToMain");
      expect((actor.getSnapshot().output as any)?.result).toBe(
        LoginOutput.ENCRYPTED_PIN_FIELD_EMPTY
      );
    });

    it("should proceed to PIN entry for valid customer", async () => {
      mockDataService.getCustomerByCustomerId.mockResolvedValue(mockCustomer);

      const actor = createActor(loginMachine, { input: mockInput });
      actor.start();

      actor.send({ type: "INPUT", input: "C12345678" });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(actor.getSnapshot().value).toBe("verifyingCustomerId");
      expect(actor.getSnapshot().context.message).toBe(VERIFYING_MSG);
      expect(actor.getSnapshot().context.customer).toEqual(mockCustomer);
    });
  });

  describe("PIN Entry and Verification", () => {
    beforeEach(async () => {
      mockDataService.getCustomerByCustomerId.mockResolvedValue(mockCustomer);
    });

    it("should validate PIN format", async () => {
      const actor = createActor(loginMachine, { input: mockInput });
      actor.start();

      actor.send({ type: "INPUT", input: "C12345678" });
      await new Promise(resolve => setTimeout(resolve, 10));

      // Invalid PIN format
      actor.send({ type: "INPUT", input: "abc" });
      expect(actor.getSnapshot().value).toBe("pinEntry");
      expect(actor.getSnapshot().context.message).toContain(PIN_PROMPT);

      // Valid PIN format - mock encryptPin to return the stored encrypted PIN
      mockEncryptPin.mockReturnValue("encrypted-pin-hash");
      actor.send({ type: "INPUT", input: "1234" });
      expect(actor.getSnapshot().value).toBe("verifyingPin");
    });

    it("should handle successful PIN verification", async () => {
      // Mock encryptPin to return the same value as stored encrypted PIN
      mockEncryptPin.mockReturnValue("9YMhFg0zu5IKq9aFG5a/PA==");

      const actor = createActor(loginMachine, { input: mockInput });
      actor.start();

      actor.send({ type: "INPUT", input: "C12345678" });
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(actor.getSnapshot().value).toBe("verifyingCustomerId");

      actor.send({ type: "INPUT", input: "C12345678" });
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(actor.getSnapshot().value).toBe("pinEntry");

      actor.send({ type: "INPUT", input: "10101" });
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(actor.getSnapshot().value).toBe("verifyingCredentials");
      expect(actor.getSnapshot().context.message).toContain("Verifying credentials");

      actor.send({ type: "INPUT", input: "1" });
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(actor.getSnapshot().value).toBe("loginSuccess");
    });

    it("should handle incorrect PIN with retry", async () => {
      // Mock encryptPin to return a different value than stored (wrong PIN)
      mockEncryptPin.mockReturnValue("different-encrypted-value");

      const actor = createActor(loginMachine, { input: mockInput });
      actor.start();

      actor.send({ type: "INPUT", input: "C12345678" });
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(actor.getSnapshot().value).toBe("verifyingCustomerId");

      actor.send({ type: "INPUT", input: "1" });
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(actor.getSnapshot().value).toBe("pinEntry");

      actor.send({ type: "INPUT", input: "1234" });
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(actor.getSnapshot().value).toBe("pinEntry");
      expect(actor.getSnapshot().context.pinAttempts).toBe(1);
    });

    it("should handle max attempts exceeded", async () => {
      // Mock encryptPin to return wrong encrypted value for all attempts
      mockEncryptPin.mockReturnValue("wrong-encrypted-value");
      mockDataService.clearCustomerPin.mockResolvedValue();

      const actor = createActor(loginMachine, { input: mockInput });
      actor.start();

      actor.send({ type: "INPUT", input: "C12345678" });
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(actor.getSnapshot().value).toBe("verifyingCustomerId");

      actor.send({ type: "INPUT", input: "1" });
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(actor.getSnapshot().value).toBe("pinEntry");

      // First attempt - INCORRECT_PIN transitions immediately to pinEntry
      actor.send({ type: "INPUT", input: "1234" });
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(actor.getSnapshot().value).toBe("pinEntry");
      console.log(
        "After 1st attempt - State:",
        actor.getSnapshot().value,
        "Message:",
        actor.getSnapshot().context.message
      );

      // Second attempt - INCORRECT_PIN transitions immediately to pinEntry
      actor.send({ type: "INPUT", input: "1234" });
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(actor.getSnapshot().value).toBe("pinEntry");
      console.log(
        "After 2nd attempt - State:",
        actor.getSnapshot().value,
        "Message:",
        actor.getSnapshot().context.message
      );

      // Third attempt - MAX_ATTEMPTS_EXCEEDED waits for user input
      actor.send({ type: "INPUT", input: "1234" });
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(actor.getSnapshot().value).toBe("verifyingPin");
      console.log(
        "After 3rd attempt (before pressing 1) - State:",
        actor.getSnapshot().value,
        "Message:",
        actor.getSnapshot().context.message
      );

      actor.send({ type: "INPUT", input: "1" });
      await new Promise(resolve => setTimeout(resolve, 10));
      console.log(
        "After 3rd attempt (after pressing 1) - State:",
        actor.getSnapshot().value,
        "Message:",
        actor.getSnapshot().context.message
      );

      expect(actor.getSnapshot().value).toBe("routeToMain");
      const context = actor.getSnapshot().context;
      const output = actor.getSnapshot().output as any;

      console.log("Context message:", context.message);
      console.log("Output keys:", Object.keys(output || {}));
      console.log("Output.message:", output?.message);
      console.log("Full output:", output);

      expect(output?.result).toBe(LoginOutput.MAX_ATTEMPTS_EXCEEDED);
      expect(context.message).toBeDefined();
      expect(context.message).toContain("account was locked");
      expect(mockDataService.clearCustomerPin).toHaveBeenCalledWith(
        "C12345678"
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors gracefully", async () => {
      mockDataService.getCustomerByCustomerId.mockRejectedValue(
        new Error("Database connection failed")
      );

      const actor = createActor(loginMachine, { input: mockInput });
      actor.start();

      actor.send({ type: "INPUT", input: "C12345678" });
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(actor.getSnapshot().value).toBe("error");
      expect(actor.getSnapshot().context.message).toBe(
        "System error. Please try again."
      );
    });

    it("should handle ERROR events", () => {
      const actor = createActor(loginMachine, { input: mockInput });
      actor.start();

      actor.send({ type: "ERROR", error: "Network error" });
      expect(actor.getSnapshot().value).toBe("error");
      expect(actor.getSnapshot().context.error).toBe("Network error");
    });
  });

  describe("Navigation", () => {
    it("should handle back navigation to routeToMain state", () => {
      const actor = createActor(loginMachine, { input: mockInput });
      actor.start();

      actor.send({ type: "INPUT", input: "0" });
      expect(actor.getSnapshot().value).toBe("routeToMain");
    });

    it("should handle exit navigation to routeToMain state", () => {
      const actor = createActor(loginMachine, { input: mockInput });
      actor.start();

      actor.send({ type: "INPUT", input: "*" });
      expect(actor.getSnapshot().value).toBe("routeToMain");
    });
  });
});
