import { describe, it, expect, vi, beforeEach } from "vitest";
import { createActor } from "xstate";
import { thousandDaySurveyMachine } from "../../../../src/machines/supamoto/thousand-day-survey/thousandDaySurveyMachine.js";

// Mock the database service
vi.mock("../../../../src/services/database-storage.js", () => ({
  dataService: {
    getCustomerByCustomerId: vi.fn(),
    getClaimByLgAndCustomer: vi.fn(),
    createHouseholdClaim: vi.fn(),
    getHouseholdClaimById: vi.fn(),
    saveAnswer: vi.fn(),
    saveMultipleAnswers: vi.fn(),
    markClaimComplete: vi.fn(),
  },
}));

// Mock the claims bot service
vi.mock("../../../../src/services/ixo/claims-bot.js", () => ({
  submitHouseholdClaim: vi.fn(),
}));
// Mock the survey response storage service
vi.mock("../../../../src/services/survey-response-storage.js", () => ({
  surveyResponseStorageService: {
    getSurveyResponseState: vi.fn(),
    saveSurveyAnswer: vi.fn(),
    saveSurveyAnswers: vi.fn(),
  },
}));



import { surveyResponseStorageService } from "../../../../src/services/survey-response-storage.js";

import { dataService } from "../../../../src/services/database-storage.js";

describe("1,000 Day Survey - Customer Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Valid Customer ID (exists in database)", () => {
    it("should proceed to claim creation when customer exists", async () => {
      // Mock customer exists
      vi.mocked(dataService.getCustomerByCustomerId).mockResolvedValue({
        id: 1,
        customerId: "C12345678",
        fullName: "Test Customer",
        email: undefined,
        nationalId: undefined,
        encryptedPin: "encrypted_pin",
        preferredLanguage: "eng",
        lastCompletedAction: "",
        householdId: undefined,
        role: "customer",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock claim creation
      vi.mocked(dataService.createHouseholdClaim).mockResolvedValue({
        id: 1,
        lgCustomerId: "CLG123456",
        customerId: "C12345678",
        is1000DayHousehold: true,
        claimSubmittedAt: new Date(),
        claimProcessedAt: null,
        claimStatus: "pending",
        beanVoucherAllocated: false,
        claimsBotResponse: null,
        surveyForm: null,
        surveyFormUpdatedAt: null,
        createdAt: new Date(),
      });

      const actor = createActor(thousandDaySurveyMachine, {
        input: {
          sessionId: "test-session",
          phoneNumber: "+260123456789",
          serviceCode: "*2233#",
          lgCustomerId: "CLG123456",
        },
      });

      actor.start();

      // Navigate to askCustomerId state
      // (Assuming we start at a state that leads to askCustomerId)
      // For this test, we'll send the customer ID input directly

      // Send valid customer ID
      actor.send({ type: "INPUT", input: "C12345678" });

      // Wait for async validation
      await new Promise(resolve => setTimeout(resolve, 100));

      const snapshot = actor.getSnapshot();

      // Should validate customer, create/reuse claim, and store IDs in context
      expect(dataService.getCustomerByCustomerId).toHaveBeenCalledWith(
        "C12345678"
      );
      expect(dataService.getClaimByLgAndCustomer).toHaveBeenCalledWith(
        "CLG123456",
        "C12345678"
      );
      expect(dataService.createHouseholdClaim).toHaveBeenCalled();
      expect(snapshot.context.customerId).toBe("C12345678");
      expect(snapshot.context.claimId).toBe(1);
      expect(snapshot.context.error).toBeUndefined();
    });
  });

  describe("Invalid Customer ID Format", () => {
    it("should show format error for invalid customer ID", () => {
      const actor = createActor(thousandDaySurveyMachine, {
        input: {
          sessionId: "test-session",
          phoneNumber: "+260123456789",
          serviceCode: "*2233#",
          lgCustomerId: "CLG123456",
        },
      });

      actor.start();

      // Send invalid format (no 'C' prefix)
      actor.send({ type: "INPUT", input: "12345678" });

      const snapshot = actor.getSnapshot();

      // Should remain in askCustomerId state with error message
      expect(snapshot.context.message).toContain("Invalid Customer ID format");
      expect(dataService.getCustomerByCustomerId).not.toHaveBeenCalled();
    });

    it("should show format error for too short customer ID", () => {
      const actor = createActor(thousandDaySurveyMachine, {
        input: {
          sessionId: "test-session",
          phoneNumber: "+260123456789",
          serviceCode: "*2233#",
          lgCustomerId: "CLG123456",
        },
      });

      actor.start();

      // Send invalid format (too short)
      actor.send({ type: "INPUT", input: "C1234" });

      const snapshot = actor.getSnapshot();

      // Should remain in askCustomerId state with error message
      expect(snapshot.context.message).toContain("Invalid Customer ID format");
      expect(dataService.getCustomerByCustomerId).not.toHaveBeenCalled();
    });
  });

  describe("Valid Format but Customer Doesn't Exist", () => {
    it("should go to invalidCustomer state when customer doesn't exist", async () => {
      // Mock customer doesn't exist
      vi.mocked(dataService.getCustomerByCustomerId).mockResolvedValue(null);

      const actor = createActor(thousandDaySurveyMachine, {
        input: {
          sessionId: "test-session",
          phoneNumber: "+260123456789",
          serviceCode: "*2233#",
          lgCustomerId: "CLG123456",
        },
      });

      actor.start();

      // Send valid format but non-existent customer ID
      actor.send({ type: "INPUT", input: "CBBB807C4" });

      // Wait for async validation
      await new Promise(resolve => setTimeout(resolve, 100));

      const snapshot = actor.getSnapshot();

      // Should call validation service
      expect(dataService.getCustomerByCustomerId).toHaveBeenCalledWith(
        "CBBB807C4"
      );

      // Should transition to invalidCustomer state with friendly message
      expect(snapshot.value).toBe("invalidCustomer");
      expect(snapshot.context.error).toContain("not found in the system");
      expect(snapshot.context.error).toContain("CBBB807C4");
      expect(snapshot.context.message).toContain(
        "Customer ID CBBB807C4 was not found."
      );
      expect(snapshot.context.message).toContain("Enter a different Customer ID");
    });

    it("should go to systemError state when validation throws unexpected error", async () => {
      const error = new Error("Database unavailable");
      vi.mocked(dataService.getCustomerByCustomerId).mockRejectedValue(error);

      const actor = createActor(thousandDaySurveyMachine, {
        input: {
          sessionId: "test-session",
          phoneNumber: "+260123456789",
          serviceCode: "*2233#",
          lgCustomerId: "CLG123456",
        },
      });

      actor.start();

      actor.send({ type: "INPUT", input: "CERROR001" });

      await new Promise(resolve => setTimeout(resolve, 100));

      const snapshot = actor.getSnapshot();

      expect(dataService.getCustomerByCustomerId).toHaveBeenCalledWith(
        "CERROR001"
      );
      expect(snapshot.value).toBe("systemError");
      expect(snapshot.context.error).toContain("Database unavailable");
      expect(snapshot.context.message).toContain(
        "We couldn't start the 1,000 Day Survey due to a system error."
      );
    });
  });

  describe("Navigation from Validating Customer State", () => {
    it("should automatically proceed through validation and claim creation", async () => {
      // Mock customer exists
      vi.mocked(dataService.getCustomerByCustomerId).mockResolvedValue({
        id: 1,
        customerId: "C12345678",
        fullName: "Test Customer",
        email: undefined,
        nationalId: undefined,
        encryptedPin: "encrypted_pin",
        preferredLanguage: "eng",
        lastCompletedAction: "",
        householdId: undefined,
        role: "customer",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock claim creation
      vi.mocked(dataService.createHouseholdClaim).mockResolvedValue({
        id: 1,
        lgCustomerId: "CLG123456",
        customerId: "C12345678",
        is1000DayHousehold: true,
        claimSubmittedAt: new Date(),
        claimProcessedAt: null,
        claimStatus: "pending",
        beanVoucherAllocated: false,

        claimsBotResponse: null,
        surveyForm: null,
        surveyFormUpdatedAt: null,
        createdAt: new Date(),
      });

      const actor = createActor(thousandDaySurveyMachine, {
        input: {
          sessionId: "test-session",
          phoneNumber: "+260123456789",
          serviceCode: "*2233#",
          lgCustomerId: "CLG123456",
        },
      });

      actor.start();

      // Send valid customer ID
      actor.send({ type: "INPUT", input: "C12345678" });

      // Wait for validation and claim creation to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      const snapshot = actor.getSnapshot();

      // Should have validated customer and created claim
      expect(dataService.getCustomerByCustomerId).toHaveBeenCalledWith(
        "C12345678"
      );
      expect(dataService.createHouseholdClaim).toHaveBeenCalled();
      expect(snapshot.context.customerId).toBe("C12345678");
    });
  });


  describe("Session initialization with existing answers", () => {
    it("should hydrate context from surveyResponseState and reuse existing claim", async () => {
      vi.mocked(dataService.getCustomerByCustomerId).mockResolvedValue({
        id: 1,
        customerId: "C12345678",
        fullName: "Test Customer",
        email: undefined,
        nationalId: undefined,
        encryptedPin: "encrypted_pin",
        preferredLanguage: "eng",
        lastCompletedAction: "",
        householdId: undefined,
        role: "customer",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(dataService.getClaimByLgAndCustomer).mockResolvedValue({
        id: 99,
        lgCustomerId: "CLG123456",
        customerId: "C12345678",
        is1000DayHousehold: true,
        claimSubmittedAt: new Date(),
        claimProcessedAt: null,
        claimStatus: "pending",
        beanVoucherAllocated: false,
        claimsBotResponse: null,
        surveyForm: null,
        surveyFormUpdatedAt: null,
        createdAt: new Date(),
      } as any);

      vi
        .mocked(surveyResponseStorageService.getSurveyResponseState)
        .mockResolvedValue({
          lgCustomerId: "CLG123456",
          customerId: "C12345678",
          answers: {
            "ecs:beneficiaryCategory": ["pregnant_woman"],
            "ecs:beanIntakeFrequency": "daily",
          },
          allFieldsCompleted: false,
        });

      const actor = createActor(thousandDaySurveyMachine, {
        input: {
          sessionId: "test-session",
          phoneNumber: "+260123456789",
          serviceCode: "*2233#",
          lgCustomerId: "CLG123456",
        },
      });

      actor.start();

      actor.send({ type: "INPUT", input: "C12345678" });

      await new Promise(resolve => setTimeout(resolve, 100));

      const snapshot = actor.getSnapshot();

      expect(dataService.getClaimByLgAndCustomer).toHaveBeenCalledWith(
        "CLG123456",
        "C12345678"
      );
      expect(dataService.createHouseholdClaim).not.toHaveBeenCalled();
      expect(
        surveyResponseStorageService.getSurveyResponseState
      ).toHaveBeenCalledWith("CLG123456", "C12345678");
      expect(snapshot.context.claimId).toBe(99);
      expect(snapshot.context.beneficiaryCategory).toEqual(["pregnant_woman"]);
      expect(snapshot.context.beanIntakeFrequency).toBe("daily");
    });
  });

  describe("Error Message Content", () => {
    it("should include customer ID in error message", async () => {
      // Mock customer doesn't exist
      vi.mocked(dataService.getCustomerByCustomerId).mockResolvedValue(null);

      const actor = createActor(thousandDaySurveyMachine, {
        input: {
          sessionId: "test-session",
          phoneNumber: "+260123456789",
          serviceCode: "*2233#",
          lgCustomerId: "CLG123456",
        },
      });

      actor.start();

      const testCustomerId = "CTEST1234";
      actor.send({ type: "INPUT", input: testCustomerId });

      // Wait for async validation
      await new Promise(resolve => setTimeout(resolve, 100));

      const snapshot = actor.getSnapshot();

      // Error message should include the customer ID
      expect(snapshot.context.error).toContain(testCustomerId);
      expect(snapshot.context.error).toContain("Please verify the Customer ID");
    });
  });
});
