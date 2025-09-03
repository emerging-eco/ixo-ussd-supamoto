import { describe, it, expect } from "vitest";
import { createActor } from "xstate";
import { userServicesMachine } from "./userServicesMachine.js";

describe("userServicesMachine", () => {
  const mockInput = {
    sessionId: "test-session",
    phoneNumber: "+260123456789",
    serviceCode: "*2233#",
  };

  it("starts at menu with correct message", () => {
    const actor = createActor(userServicesMachine, { input: mockInput });
    actor.start();

    expect(actor.getSnapshot().value).toBe("menu");
    expect(actor.getSnapshot().context.message).toContain("User Services");
  });

  it("navigates to submenus and back", () => {
    const actor = createActor(userServicesMachine, { input: mockInput });
    actor.start();

    actor.send({ type: "INPUT", input: "2" }); // Balances
    expect(actor.getSnapshot().value).toBe("balances");
    expect(actor.getSnapshot().context.message).toContain("SUPA");

    actor.send({ type: "INPUT", input: "1" }); // Back
    expect(actor.getSnapshot().value).toBe("menu");
  });

  it("routeToMain on back/exit from menu", () => {
    const actor = createActor(userServicesMachine, { input: mockInput });
    actor.start();

    actor.send({ type: "INPUT", input: "0" }); // Back
    expect(actor.getSnapshot().value).toBe("routeToMain");
  });
});
