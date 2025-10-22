import { describe, it, expect } from "vitest";
import { createActor } from "xstate";
import { userServicesMachine } from "./userServicesMachine.js";

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
  };

  it("starts at customerTools for customer role", async () => {
    const actor = createActor(userServicesMachine, {
      input: mockCustomerInput,
    });
    actor.start();

    // Wait for the always transition to complete
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(actor.getSnapshot().value).toBe("customerTools");
  });

  it("starts at agent for agent role", async () => {
    const actor = createActor(userServicesMachine, { input: mockAgentInput });
    actor.start();

    // Wait for the always transition to complete
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(actor.getSnapshot().value).toBe("agent");
    expect(actor.getSnapshot().context.message).toContain("Agent Tools");
  });

  it("goes to routeToMain on back from agent menu", () => {
    const actor = createActor(userServicesMachine, { input: mockAgentInput });
    actor.start();

    actor.send({ type: "INPUT", input: "0" }); // Back
    expect(actor.getSnapshot().value).toBe("routeToMain");
  });

  it("goes to routeToMain on exit from agent menu", () => {
    const actor = createActor(userServicesMachine, { input: mockAgentInput });
    actor.start();

    actor.send({ type: "INPUT", input: "*" }); // Exit
    expect(actor.getSnapshot().value).toBe("routeToMain");
  });
});
