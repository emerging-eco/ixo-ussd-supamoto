/**
 * Customer Activation Machine - Unit Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createActor } from "xstate";
import { customerActivationMachine } from "./customerActivationMachine.js";

describe("Customer Activation Machine", () => {
  let actor: ReturnType<typeof createActor<typeof customerActivationMachine>>;

  beforeEach(() => {
    actor = createActor(customerActivationMachine, {
      input: {
        sessionId: "test-session",
        phoneNumber: "+260971234567",
        serviceCode: "*2233#",
      },
    });
    actor.start();
  });

  describe("Initial State", () => {
    it("should start in verifyCustomer state", () => {
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("verifyCustomer");
    });

    it("should display customer ID prompt", () => {
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.message).toContain("Enter your Customer ID");
    });
  });

  describe("Customer ID Validation", () => {
    it("should accept valid customer ID format", () => {
      actor.send({ type: "INPUT", input: "C12345678" });
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("enterPhone");
      expect(snapshot.context.customerId).toBe("C12345678");
    });

    it("should reject invalid customer ID format", () => {
      actor.send({ type: "INPUT", input: "12345678" });
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("verifyCustomer");
      expect(snapshot.context.message).toContain("Invalid Customer ID");
    });

    it("should reject short customer ID", () => {
      actor.send({ type: "INPUT", input: "C123" });
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("verifyCustomer");
    });
  });

  describe("Phone Number Validation", () => {
    beforeEach(() => {
      actor.send({ type: "INPUT", input: "C12345678" });
    });

    it("should accept valid phone number with country code", () => {
      actor.send({ type: "INPUT", input: "+260971234567" });
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("sendingActivationSMS");
      expect(snapshot.context.customerPhone).toBe("+260971234567");
    });

    it("should reject phone number without country code", () => {
      actor.send({ type: "INPUT", input: "0971234567" });
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("enterPhone");
      expect(snapshot.context.message).toContain("Invalid phone number");
    });

    it("should reject invalid phone format", () => {
      actor.send({ type: "INPUT", input: "+26097" });
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("enterPhone");
    });
  });

  describe("Context Initialization", () => {
    it("should initialize with correct default values", () => {
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.sessionId).toBe("test-session");
      expect(snapshot.context.phoneNumber).toBe("+260971234567");
      expect(snapshot.context.serviceCode).toBe("*2233#");
      expect(snapshot.context.isActivated).toBe(false);
      expect(snapshot.context.isEligible).toBeUndefined();
    });
  });

  describe("Error Handling", () => {
    it("should handle ERROR event", () => {
      actor.send({ type: "ERROR", error: "Test error" });
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("error");
      expect(snapshot.context.error).toBe("Test error");
    });
  });
});
