import { describe, it, expect } from "vitest";
import { createActor, waitFor } from "xstate";
import { userServicesMachine } from "../../../../src/machines/supamoto/user-services/userServicesMachine.js";

// Helper to wait for actor to reach a specific state (more deterministic than setTimeout)
const waitForState = async (
  actor: ReturnType<typeof createActor>,
  state: string,
  timeout = 1000
) => {
  await waitFor(actor, (snapshot) => snapshot.value === state, {
    timeout,
  });
};

describe("userServicesMachine", () => {
  const mockCustomerInput = {
    sessionId: "test-session",
    phoneNumber: "+260123456789",
    serviceCode: "*2233#",
    customerRole: "customer" as const,
  };

  const mockAgentInput = {
    sessionId: "test-session",
    phoneNumber: "+260123456789",
    serviceCode: "*2233#",
    customerRole: "lead_generator" as const,
    customerId: "C12345678", // Agent with valid customerId
  };

  const mockAgentInputNoCustomerId = {
    sessionId: "test-session",
    phoneNumber: "+260123456789",
    serviceCode: "*2233#",
    customerRole: "lead_generator" as const,
    // No customerId - agent without linked customer account
  };

  it("starts at customerTools for customer role", async () => {
    const actor = createActor(userServicesMachine, {
      input: mockCustomerInput,
    });
    actor.start();
    await waitForState(actor, "customerTools");

    expect(actor.getSnapshot().value).toBe("customerTools");
  });

  it("starts at agent for agent role", async () => {
    const actor = createActor(userServicesMachine, { input: mockAgentInput });
    actor.start();
    await waitForState(actor, "agent");

    expect(actor.getSnapshot().value).toBe("agent");
    expect(actor.getSnapshot().context.message).toContain("Agent Tools");
  });

  it("agent menu contains Confirm Receival of Beans as option 1", async () => {
    const actor = createActor(userServicesMachine, { input: mockAgentInput });
    actor.start();
    await waitForState(actor, "agent");

    const message = actor.getSnapshot().context.message;
    expect(message).toContain("1. Confirm Receival of Beans");
    expect(message).toContain("2. Activate a Customer");
    expect(message).toContain("3. 1,000 Day Survey");
    expect(message).toContain("4. Register Intent to Deliver Beans");
    expect(message).toContain("5. Submit Customer OTP");
    expect(message).toContain("6. Confirm Bean Delivery");
  });

  it("input 1 transitions to agentConfirmBeans state when customerId exists", async () => {
    const actor = createActor(userServicesMachine, { input: mockAgentInput });
    actor.start();
    await waitForState(actor, "agent");

    actor.send({ type: "INPUT", input: "1" });
    expect(actor.getSnapshot().value).toBe("agentConfirmBeans");
  });

  it("input 1 transitions to missingCustomerId state when customerId is missing", async () => {
    const actor = createActor(userServicesMachine, {
      input: mockAgentInputNoCustomerId,
    });
    actor.start();
    await waitForState(actor, "agent");

    actor.send({ type: "INPUT", input: "1" });
    expect(actor.getSnapshot().value).toBe("missingCustomerId");
    expect(actor.getSnapshot().context.message).toContain(
      "not linked to a customer ID"
    );
  });

  it("input 2 transitions to agentActivateCustomer state", async () => {
    const actor = createActor(userServicesMachine, { input: mockAgentInput });
    actor.start();
    await waitForState(actor, "agent");

    actor.send({ type: "INPUT", input: "2" });
    expect(actor.getSnapshot().value).toBe("agentActivateCustomer");
  });

  it("input 3 transitions to agentSurvey state", async () => {
    const actor = createActor(userServicesMachine, { input: mockAgentInput });
    actor.start();
    await waitForState(actor, "agent");

    actor.send({ type: "INPUT", input: "3" });
    expect(actor.getSnapshot().value).toBe("agentSurvey");
  });

  it("input 4 transitions to agentRegisterIntent state", async () => {
    const actor = createActor(userServicesMachine, { input: mockAgentInput });
    actor.start();
    await waitForState(actor, "agent");

    actor.send({ type: "INPUT", input: "4" });
    expect(actor.getSnapshot().value).toBe("agentRegisterIntent");
  });

  it("input 5 transitions to agentSubmitOTP state", async () => {
    const actor = createActor(userServicesMachine, { input: mockAgentInput });
    actor.start();
    await waitForState(actor, "agent");

    actor.send({ type: "INPUT", input: "5" });
    expect(actor.getSnapshot().value).toBe("agentSubmitOTP");
  });

  it("input 6 transitions to agentConfirmDelivery state", async () => {
    const actor = createActor(userServicesMachine, { input: mockAgentInput });
    actor.start();
    await waitForState(actor, "agent");

    actor.send({ type: "INPUT", input: "6" });
    expect(actor.getSnapshot().value).toBe("agentConfirmDelivery");
  });

  it("goes to routeToMain on back from agent menu", async () => {
    const actor = createActor(userServicesMachine, { input: mockAgentInput });
    actor.start();
    await waitForState(actor, "agent");

    actor.send({ type: "INPUT", input: "0" }); // Back
    expect(actor.getSnapshot().value).toBe("routeToMain");
  });

  it("goes to routeToMain on exit from agent menu", async () => {
    const actor = createActor(userServicesMachine, { input: mockAgentInput });
    actor.start();
    await waitForState(actor, "agent");

    actor.send({ type: "INPUT", input: "*" }); // Exit
    expect(actor.getSnapshot().value).toBe("routeToMain");
  });
});
