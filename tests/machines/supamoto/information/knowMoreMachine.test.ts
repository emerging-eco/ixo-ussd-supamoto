import { describe, it, expect, beforeEach, vi } from "vitest";
import { createActor, waitFor } from "xstate";
import { knowMoreMachine } from "../../../../src/machines/supamoto/information/knowMoreMachine.js";

// Mock the SMS service
vi.mock("../../../../src/services/sms.js", () => ({
  sendSMS: vi.fn().mockResolvedValue({
    success: true,
    messageId: "test-message-id-123",
  }),
}));

import { sendSMS } from "../../../../src/services/sms.js";

describe("knowMoreMachine", () => {
  const mockInput = {
    sessionId: "test-session-123",
    phoneNumber: "+260971230000",
    serviceCode: "*2233#",
  };

  let actor: ReturnType<typeof createActor<typeof knowMoreMachine>>;

  beforeEach(() => {
    vi.clearAllMocks();
    actor = createActor(knowMoreMachine, {
      input: mockInput,
    });
    actor.start();
  });

  describe("Initial State", () => {
    it("should start in the correct initial state", () => {
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("infoMenu");
      expect(snapshot.context.sessionId).toBe(mockInput.sessionId);
      expect(snapshot.context.phoneNumber).toBe(mockInput.phoneNumber);
      expect(snapshot.context.serviceCode).toBe(mockInput.serviceCode);
    });

    it("should have the correct initial context", () => {
      const snapshot = actor.getSnapshot();
      expect(snapshot.context).toMatchObject({
        sessionId: mockInput.sessionId,
        phoneNumber: mockInput.phoneNumber,
        serviceCode: mockInput.serviceCode,
      });
      expect(snapshot.context.message).toMatch(
        /Welcome to .+ Information Center/
      );
    });
  });

  describe("Menu Options", () => {
    it("should show all 7 menu options", () => {
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.message).toContain("1. Interested in a stove");
      expect(snapshot.context.message).toContain(
        "2. Pellet Bag Prices & Accessories"
      );
      expect(snapshot.context.message).toContain(
        "3. Can we deliver it to you?"
      );
      expect(snapshot.context.message).toContain("4. Can a stove be fixed?");
      expect(snapshot.context.message).toContain("5. What is Performance?");
      expect(snapshot.context.message).toContain(
        "6. What is a digital voucher?"
      );
      expect(snapshot.context.message).toContain("7. What is a contract?");
    });

    it("should transition to sendingSMS on input '1'", () => {
      actor.send({ type: "INPUT", input: "1" });
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("sendingSMS");
      expect(snapshot.context.selectedOption).toBe(1);
    });

    it("should transition to sendingSMS on input '4'", () => {
      actor.send({ type: "INPUT", input: "4" });
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("sendingSMS");
      expect(snapshot.context.selectedOption).toBe(4);
    });

    it("should transition to sendingSMS on input '7'", () => {
      actor.send({ type: "INPUT", input: "7" });
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("sendingSMS");
      expect(snapshot.context.selectedOption).toBe(7);
    });

    it("should handle back navigation correctly", () => {
      actor.send({ type: "INPUT", input: "0" });
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("routeToMain");
    });
  });

  describe("SMS Sending", () => {
    it("should send SMS for option 1 (Interested in stove)", async () => {
      actor.send({ type: "INPUT", input: "1" });

      // Wait for SMS sending to complete
      await waitFor(actor, state => state.matches("smsSent"), {
        timeout: 5000,
      });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("smsSent");
      expect(sendSMS).toHaveBeenCalledWith({
        to: mockInput.phoneNumber,
        message: expect.stringContaining("Chinja Malasha, Chinya Umoyo!"),
      });
      expect(sendSMS).toHaveBeenCalledWith({
        to: mockInput.phoneNumber,
        message: expect.stringContaining("Interested in getting a stove"),
      });
    });

    it("should send SMS for option 4 (Can a stove be fixed?)", async () => {
      actor.send({ type: "INPUT", input: "4" });

      await waitFor(actor, state => state.matches("smsSent"), {
        timeout: 5000,
      });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("smsSent");
      expect(sendSMS).toHaveBeenCalledWith({
        to: mockInput.phoneNumber,
        message: expect.stringContaining("your stove can be fixed"),
      });
    });

    it("should send correct SMS template for each option", async () => {
      const options = [1, 2, 3, 4, 5, 6, 7];

      for (const option of options) {
        // Reset actor for each test
        actor = createActor(knowMoreMachine, { input: mockInput });
        actor.start();
        vi.clearAllMocks();

        actor.send({ type: "INPUT", input: option.toString() });

        await waitFor(actor, state => state.matches("smsSent"), {
          timeout: 5000,
        });

        expect(sendSMS).toHaveBeenCalledWith({
          to: mockInput.phoneNumber,
          message: expect.stringContaining("Chinja Malasha, Chinya Umoyo!"),
        });
      }
    });

    it("should handle SMS send failure gracefully", async () => {
      // Mock SMS failure
      vi.mocked(sendSMS).mockResolvedValueOnce({
        success: false,
        error: "Network error",
      });

      actor.send({ type: "INPUT", input: "1" });

      await waitFor(actor, state => state.matches("smsError"), {
        timeout: 5000,
      });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("smsError");
      expect(snapshot.context.error).toBe("SMS_SEND_FAILED");
      expect(snapshot.context.message).toContain("Failed to send SMS");
    });

    it("should transition to smsSent state on successful SMS", async () => {
      actor.send({ type: "INPUT", input: "2" });

      await waitFor(actor, state => state.matches("smsSent"), {
        timeout: 5000,
      });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("smsSent");
      expect(snapshot.context.message).toContain("SMS sent successfully");
    });
  });

  describe("SMS Sent State", () => {
    it("should display success message", async () => {
      actor.send({ type: "INPUT", input: "1" });

      await waitFor(actor, state => state.matches("smsSent"), {
        timeout: 5000,
      });

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.message).toContain("SMS sent successfully");
      expect(snapshot.context.message).toContain(
        "Check your phone for details"
      );
    });

    it("should return to main menu on input '1'", async () => {
      actor.send({ type: "INPUT", input: "1" });

      await waitFor(actor, state => state.matches("smsSent"), {
        timeout: 5000,
      });

      actor.send({ type: "INPUT", input: "1" });
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("routeToMain");
    });

    it("should return to info menu on back input", async () => {
      actor.send({ type: "INPUT", input: "1" });

      await waitFor(actor, state => state.matches("smsSent"), {
        timeout: 5000,
      });

      actor.send({ type: "INPUT", input: "0" });
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("infoMenu");
    });
  });

  describe("Exit State", () => {
    it("should be a final state", () => {
      actor.send({ type: "INPUT", input: "*" });
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("routeToMain");
      expect(snapshot.status).toBe("done");
    });
  });

  describe("Error Handling", () => {
    it("should handle ERROR events gracefully", () => {
      actor.send({ type: "ERROR", error: "Test error" });
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.error).toBe("Test error");
    });

    it("should transition to error state on system errors", () => {
      actor.send({ type: "ERROR", error: "System failure" });
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("error");
    });
  });

  describe("Navigation Patterns", () => {
    it("should handle exit commands from info menu", () => {
      actor.send({ type: "INPUT", input: "*" });
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("routeToMain");
    });

    it("should handle exit commands from smsError state", async () => {
      // Mock SMS failure
      vi.mocked(sendSMS).mockResolvedValueOnce({
        success: false,
        error: "Network error",
      });

      actor.send({ type: "INPUT", input: "1" });

      await waitFor(actor, state => state.matches("smsError"), {
        timeout: 5000,
      });

      actor.send({ type: "INPUT", input: "*" });
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("routeToMain");
    });
  });

  describe("Context Updates", () => {
    it("should maintain session information throughout navigation", async () => {
      actor.send({ type: "INPUT", input: "1" });

      await waitFor(actor, state => state.matches("smsSent"), {
        timeout: 5000,
      });

      actor.send({ type: "INPUT", input: "0" });
      actor.send({ type: "INPUT", input: "2" });

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.sessionId).toBe(mockInput.sessionId);
      expect(snapshot.context.phoneNumber).toBe(mockInput.phoneNumber);
      expect(snapshot.context.serviceCode).toBe(mockInput.serviceCode);
    });

    it("should update messages appropriately on state changes", () => {
      const initialMessage = actor.getSnapshot().context.message;

      actor.send({ type: "INPUT", input: "1" });
      const sendingMessage = actor.getSnapshot().context.message;

      expect(sendingMessage).not.toBe(initialMessage);
      expect(sendingMessage).toContain("Sending information SMS");
    });

    it("should track selected option in context", () => {
      actor.send({ type: "INPUT", input: "5" });
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.selectedOption).toBe(5);
    });
  });

  describe("Output", () => {
    it("should provide correct output when machine completes", () => {
      actor.send({ type: "INPUT", input: "*" });
      const snapshot = actor.getSnapshot();

      expect(snapshot.value).toBe("routeToMain");
      expect(snapshot.status).toBe("done");
    });
  });
});
