import { describe, it, expect, beforeEach, vi } from "vitest";
import { createActor } from "xstate";
import { accountCreationMachine } from "./accountCreationMachine.js";

// Mock the database service
vi.mock("../../../../src/services/database-storage.js", () => ({
  dataService: {
    createOrUpdatePhoneRecord: vi.fn().mockResolvedValue({ id: 1 }),
    createCustomerRecord: vi.fn().mockResolvedValue({
      id: 1,
      customerId: "C12345678",
    }),
  },
}));

// Mock the background IXO creation
vi.mock("../../../../src/services/ixo/background-ixo-creation.js", () => ({
  createIxoAccountBackground: vi.fn().mockResolvedValue({ success: true }),
}));

describe("National ID Entry - Zambian NRC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should accept valid NRC with slashes", () => {
    const actor = createActor(accountCreationMachine, {
      input: {
        sessionId: "test-session",
        phoneNumber: "+260123456789",
        serviceCode: "*2233#",
      },
    });

    actor.start();

    // Navigate through the flow
    actor.send({ type: "INPUT", input: "John Doe" }); // name
    actor.send({ type: "INPUT", input: "00" }); // skip email
    actor.send({ type: "INPUT", input: "123456/05/1" }); // NRC with slashes

    const snapshot = actor.getSnapshot();
    expect(snapshot.context.nationalId).toBe("123456/05/1");
    expect(snapshot.context.isNationalIdSkipped).toBe(false);
    expect(snapshot.context.currentStep).toBe("pinEntry");
  });

  it("should accept valid NRC without slashes and normalize", () => {
    const actor = createActor(accountCreationMachine, {
      input: {
        sessionId: "test-session",
        phoneNumber: "+260123456789",
        serviceCode: "*2233#",
      },
    });

    actor.start();

    // Navigate through the flow
    actor.send({ type: "INPUT", input: "John Doe" }); // name
    actor.send({ type: "INPUT", input: "00" }); // skip email
    actor.send({ type: "INPUT", input: "123456051" }); // NRC without slashes

    const snapshot = actor.getSnapshot();
    expect(snapshot.context.nationalId).toBe("123456/05/1");
    expect(snapshot.context.isNationalIdSkipped).toBe(false);
    expect(snapshot.context.currentStep).toBe("pinEntry");
  });

  it("should accept province code 99 (province validation removed)", () => {
    const actor = createActor(accountCreationMachine, {
      input: {
        sessionId: "test-session",
        phoneNumber: "+260123456789",
        serviceCode: "*2233#",
      },
    });

    actor.start();

    // Navigate through the flow
    actor.send({ type: "INPUT", input: "John Doe" }); // name
    actor.send({ type: "INPUT", input: "00" }); // skip email
    actor.send({ type: "INPUT", input: "123456/99/1" }); // Province code 99 now accepted

    const snapshot = actor.getSnapshot();
    // Should move to pinEntry state
    expect(snapshot.context.currentStep).toBe("pinEntry");
    expect(snapshot.context.nationalId).toBe("123456/99/1");
  });

  it("should show error message for invalid national ID", () => {
    const actor = createActor(accountCreationMachine, {
      input: {
        sessionId: "test-session",
        phoneNumber: "+260123456789",
        serviceCode: "*2233#",
      },
    });

    actor.start();

    // Navigate through the flow
    actor.send({ type: "INPUT", input: "John Doe" }); // name
    actor.send({ type: "INPUT", input: "00" }); // skip email
    actor.send({ type: "INPUT", input: "12345/05/1" }); // Invalid NRC - too short registration number

    const snapshot = actor.getSnapshot();
    // Should remain in nationalIdEntry state with error
    expect(snapshot.context.currentStep).toBe("nationalIdEntry");
    expect(snapshot.context.validationError).toBe("Invalid National ID format");
    expect(snapshot.context.message).toContain("Invalid format");
    expect(snapshot.context.message).toContain("123456/12/1");
  });

  it("should allow skipping national ID with 00", () => {
    const actor = createActor(accountCreationMachine, {
      input: {
        sessionId: "test-session",
        phoneNumber: "+260123456789",
        serviceCode: "*2233#",
      },
    });

    actor.start();

    // Navigate through the flow
    actor.send({ type: "INPUT", input: "John Doe" }); // name
    actor.send({ type: "INPUT", input: "00" }); // skip email
    actor.send({ type: "INPUT", input: "00" }); // skip NRC

    const snapshot = actor.getSnapshot();
    expect(snapshot.context.nationalId).toBe("");
    expect(snapshot.context.isNationalIdSkipped).toBe(true);
    expect(snapshot.context.currentStep).toBe("pinEntry");
  });

  it("should support back navigation to emailEntry", () => {
    const actor = createActor(accountCreationMachine, {
      input: {
        sessionId: "test-session",
        phoneNumber: "+260123456789",
        serviceCode: "*2233#",
      },
    });

    actor.start();

    // Navigate to national ID entry
    actor.send({ type: "INPUT", input: "John Doe" }); // name
    actor.send({ type: "INPUT", input: "00" }); // skip email

    // Verify we're at national ID entry
    let snapshot = actor.getSnapshot();
    expect(snapshot.context.currentStep).toBe("nationalIdEntry");

    // Go back
    actor.send({ type: "INPUT", input: "0" }); // back command

    snapshot = actor.getSnapshot();
    expect(snapshot.context.currentStep).toBe("emailEntry");
  });

  it("should support forward navigation to pinEntry", () => {
    const actor = createActor(accountCreationMachine, {
      input: {
        sessionId: "test-session",
        phoneNumber: "+260123456789",
        serviceCode: "*2233#",
      },
    });

    actor.start();

    // Navigate through the flow
    actor.send({ type: "INPUT", input: "John Doe" }); // name
    actor.send({ type: "INPUT", input: "00" }); // skip email
    actor.send({ type: "INPUT", input: "123456/05/1" }); // valid NRC

    const snapshot = actor.getSnapshot();
    expect(snapshot.context.currentStep).toBe("pinEntry");
  });

  it("should accept all valid province codes (01-10)", () => {
    for (let i = 1; i <= 10; i++) {
      const actor = createActor(accountCreationMachine, {
        input: {
          sessionId: "test-session",
          phoneNumber: "+260123456789",
          serviceCode: "*2233#",
        },
      });

      actor.start();

      const provinceCode = i.toString().padStart(2, "0");
      const nrc = `123456/${provinceCode}/1`;

      // Navigate through the flow
      actor.send({ type: "INPUT", input: "John Doe" }); // name
      actor.send({ type: "INPUT", input: "00" }); // skip email
      actor.send({ type: "INPUT", input: nrc }); // NRC with province code

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.nationalId).toBe(nrc);
      expect(snapshot.context.currentStep).toBe("pinEntry");
    }
  });

  it("should reject invalid NRC formats", () => {
    const invalidNRCs = [
      "12345/05/1", // too short registration number
      "1234567/05/1", // too long registration number
      "ABC456/05/1", // alphabetic characters
      "000000/05/1", // all zeros registration number
    ];

    invalidNRCs.forEach(invalidNRC => {
      const actor = createActor(accountCreationMachine, {
        input: {
          sessionId: "test-session",
          phoneNumber: "+260123456789",
          serviceCode: "*2233#",
        },
      });

      actor.start();

      // Navigate through the flow
      actor.send({ type: "INPUT", input: "John Doe" }); // name
      actor.send({ type: "INPUT", input: "00" }); // skip email
      actor.send({ type: "INPUT", input: invalidNRC }); // invalid NRC

      const snapshot = actor.getSnapshot();
      // Should remain in nationalIdEntry state
      expect(snapshot.context.currentStep).toBe("nationalIdEntry");
    });
  });

  it("should handle back navigation from pinEntry to nationalIdEntry", () => {
    const actor = createActor(accountCreationMachine, {
      input: {
        sessionId: "test-session",
        phoneNumber: "+260123456789",
        serviceCode: "*2233#",
      },
    });

    actor.start();

    // Navigate to PIN entry
    actor.send({ type: "INPUT", input: "John Doe" }); // name
    actor.send({ type: "INPUT", input: "00" }); // skip email
    actor.send({ type: "INPUT", input: "123456/05/1" }); // valid NRC

    // Verify we're at PIN entry
    let snapshot = actor.getSnapshot();
    expect(snapshot.context.currentStep).toBe("pinEntry");

    // Go back
    actor.send({ type: "INPUT", input: "0" }); // back command

    snapshot = actor.getSnapshot();
    expect(snapshot.context.currentStep).toBe("nationalIdEntry");
  });

  it("should preserve national ID value when navigating back and forth", () => {
    const actor = createActor(accountCreationMachine, {
      input: {
        sessionId: "test-session",
        phoneNumber: "+260123456789",
        serviceCode: "*2233#",
      },
    });

    actor.start();

    // Navigate to PIN entry
    actor.send({ type: "INPUT", input: "John Doe" }); // name
    actor.send({ type: "INPUT", input: "00" }); // skip email
    actor.send({ type: "INPUT", input: "123456/05/1" }); // valid NRC

    // Go back to national ID entry
    actor.send({ type: "INPUT", input: "0" }); // back command

    let snapshot = actor.getSnapshot();
    expect(snapshot.context.nationalId).toBe("123456/05/1");

    // Enter a different NRC
    actor.send({ type: "INPUT", input: "654321/10/3" }); // different NRC

    snapshot = actor.getSnapshot();
    expect(snapshot.context.nationalId).toBe("654321/10/3");
    expect(snapshot.context.currentStep).toBe("pinEntry");
  });
});
