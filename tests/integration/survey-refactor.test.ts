/**
 * Integration tests for survey JSON storage refactoring
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { surveyResponseStorageService } from "../../src/services/survey-response-storage.js";
import { databaseManager } from "../../src/services/database-manager.js";

describe("Survey Refactor Integration Tests", () => {
  const testLgCustomerId = "LG12345678";
  const testCustomerId = "C12345678";

  beforeEach(async () => {
    // Initialize database for tests
    await databaseManager.initialize();

    // Clean up any existing test data
    const db = databaseManager.getKysely();
    await db
      .deleteFrom("household_claims")
      .where("lg_customer_id", "=", testLgCustomerId)
      .where("customer_id", "=", testCustomerId)
      .execute();
  });

  afterEach(async () => {
    // Clean up test data
    const db = databaseManager.getKysely();
    await db
      .deleteFrom("household_claims")
      .where("lg_customer_id", "=", testLgCustomerId)
      .where("customer_id", "=", testCustomerId)
      .execute();
  });

  describe("Complete survey flow with JSON storage", () => {
    it("should save survey answers incrementally and retrieve them", async () => {
      // Save first answer (array value for beneficiaryCategory)
      await surveyResponseStorageService.saveSurveyAnswer(
        testLgCustomerId,
        testCustomerId,
        "beneficiaryCategory",
        ["pregnant_woman"]
      );

      // Retrieve state
      let state = await surveyResponseStorageService.getSurveyResponseState(
        testLgCustomerId,
        testCustomerId
      );

      expect(state).toBeTruthy();
      expect(state?.answers.beneficiaryCategory).toEqual(["pregnant_woman"]);
      expect(state?.allFieldsCompleted).toBe(false);

      // Save second answer
      await surveyResponseStorageService.saveSurveyAnswer(
        testLgCustomerId,
        testCustomerId,
        "childMaxAge",
        "6_months"
      );

      // Retrieve state again
      state = await surveyResponseStorageService.getSurveyResponseState(
        testLgCustomerId,
        testCustomerId
      );

      expect(state?.answers.beneficiaryCategory).toEqual(["pregnant_woman"]);
      expect(state?.answers.childMaxAge).toBe("6_months");
      expect(state?.allFieldsCompleted).toBe(false);
    });

    it("should mark survey as complete", async () => {
      // Save some answers (array value for beneficiaryCategory)
      await surveyResponseStorageService.saveSurveyAnswer(
        testLgCustomerId,
        testCustomerId,
        "beneficiaryCategory",
        ["pregnant_woman"]
      );

      await surveyResponseStorageService.saveSurveyAnswer(
        testLgCustomerId,
        testCustomerId,
        "childMaxAge",
        "6_months"
      );

      // Mark as complete
      await surveyResponseStorageService.markSurveyComplete(
        testLgCustomerId,
        testCustomerId
      );

      // Retrieve state
      const state = await surveyResponseStorageService.getSurveyResponseState(
        testLgCustomerId,
        testCustomerId
      );

      expect(state?.allFieldsCompleted).toBe(true);
      expect(state?.answers.beneficiaryCategory).toEqual(["pregnant_woman"]);
      expect(state?.answers.childMaxAge).toBe("6_months");
    });

    it("should handle session interruption and recovery", async () => {
      // Start survey - save first answer (array value)
      await surveyResponseStorageService.saveSurveyAnswer(
        testLgCustomerId,
        testCustomerId,
        "beneficiaryCategory",
        ["pregnant_woman"]
      );

      // Simulate session interruption (no explicit action needed)

      // Resume survey - retrieve state
      const state = await surveyResponseStorageService.getSurveyResponseState(
        testLgCustomerId,
        testCustomerId
      );

      expect(state).toBeTruthy();
      expect(state?.answers.beneficiaryCategory).toEqual(["pregnant_woman"]);

      // Continue survey - save next answer
      await surveyResponseStorageService.saveSurveyAnswer(
        testLgCustomerId,
        testCustomerId,
        "childMaxAge",
        "6_months"
      );

      // Verify both answers are present
      const finalState =
        await surveyResponseStorageService.getSurveyResponseState(
          testLgCustomerId,
          testCustomerId
        );

      expect(finalState?.answers.beneficiaryCategory).toEqual([
        "pregnant_woman",
      ]);
      expect(finalState?.answers.childMaxAge).toBe("6_months");
    });
  });

  describe("Survey completion check before claim submission", () => {
    it("should block claim submission if survey not complete", async () => {
      // Save partial survey (array value)
      await surveyResponseStorageService.saveSurveyAnswer(
        testLgCustomerId,
        testCustomerId,
        "beneficiaryCategory",
        ["pregnant_woman"]
      );

      // Check completion
      const state = await surveyResponseStorageService.getSurveyResponseState(
        testLgCustomerId,
        testCustomerId
      );

      expect(state?.allFieldsCompleted).toBe(false);
    });

    it("should allow claim submission if survey complete", async () => {
      // Save complete survey (array value)
      await surveyResponseStorageService.saveSurveyAnswer(
        testLgCustomerId,
        testCustomerId,
        "beneficiaryCategory",
        ["pregnant_woman"]
      );

      await surveyResponseStorageService.saveSurveyAnswer(
        testLgCustomerId,
        testCustomerId,
        "childMaxAge",
        "6_months"
      );

      // Mark as complete
      await surveyResponseStorageService.markSurveyComplete(
        testLgCustomerId,
        testCustomerId
      );

      // Check completion
      const state = await surveyResponseStorageService.getSurveyResponseState(
        testLgCustomerId,
        testCustomerId
      );

      expect(state?.allFieldsCompleted).toBe(true);
    });
  });

  describe("Data encryption and decryption", () => {
    it("should encrypt survey data in database", async () => {
      // Save answer (array value)
      await surveyResponseStorageService.saveSurveyAnswer(
        testLgCustomerId,
        testCustomerId,
        "beneficiaryCategory",
        ["pregnant_woman"]
      );

      // Get raw data from database
      const db = databaseManager.getKysely();
      const rawClaim = await db
        .selectFrom("household_claims")
        .selectAll()
        .where("lg_customer_id", "=", testLgCustomerId)
        .where("customer_id", "=", testCustomerId)
        .executeTakeFirst();

      expect(rawClaim).toBeTruthy();
      expect(rawClaim?.survey_form).toBeTruthy();
      // Encrypted data should not contain plaintext
      expect(rawClaim?.survey_form).not.toContain("pregnant_woman");
    });

    it("should decrypt survey data correctly", async () => {
      // Save answer (array value)
      await surveyResponseStorageService.saveSurveyAnswer(
        testLgCustomerId,
        testCustomerId,
        "beneficiaryCategory",
        ["pregnant_woman"]
      );

      // Retrieve through service (should decrypt)
      const state = await surveyResponseStorageService.getSurveyResponseState(
        testLgCustomerId,
        testCustomerId
      );

      expect(state?.answers.beneficiaryCategory).toEqual(["pregnant_woman"]);
    });
  });

  describe("Multiple survey answers at once", () => {
    it("should save multiple answers in one call", async () => {
      const answers = {
        beneficiaryCategory: ["pregnant_woman"],
        childMaxAge: "6_months",
        beanIntakeFrequency: "daily",
      };

      await surveyResponseStorageService.saveSurveyAnswers(
        testLgCustomerId,
        testCustomerId,
        answers
      );

      const state = await surveyResponseStorageService.getSurveyResponseState(
        testLgCustomerId,
        testCustomerId
      );

      expect(state?.answers).toEqual(answers);
    });

    it("should merge new answers with existing ones", async () => {
      // Save first batch (array value)
      await surveyResponseStorageService.saveSurveyAnswers(
        testLgCustomerId,
        testCustomerId,
        {
          beneficiaryCategory: ["pregnant_woman"],
          childMaxAge: "6_months",
        }
      );

      // Save second batch
      await surveyResponseStorageService.saveSurveyAnswers(
        testLgCustomerId,
        testCustomerId,
        {
          beanIntakeFrequency: "daily",
          priceSpecification: "affordable",
        }
      );

      const state = await surveyResponseStorageService.getSurveyResponseState(
        testLgCustomerId,
        testCustomerId
      );

      expect(state?.answers).toEqual({
        beneficiaryCategory: ["pregnant_woman"],
        childMaxAge: "6_months",
        beanIntakeFrequency: "daily",
        priceSpecification: "affordable",
      });
    });
  });

  describe("Edge cases", () => {
    it("should return null for non-existent survey", async () => {
      const state = await surveyResponseStorageService.getSurveyResponseState(
        "NONEXISTENT_LG",
        "NONEXISTENT_CUSTOMER"
      );

      expect(state).toBeNull();
    });

    it("should handle updating same answer multiple times", async () => {
      // Save initial answer
      await surveyResponseStorageService.saveSurveyAnswer(
        testLgCustomerId,
        testCustomerId,
        "beneficiaryCategory",
        "pregnant_woman"
      );

      // Update same answer
      await surveyResponseStorageService.saveSurveyAnswer(
        testLgCustomerId,
        testCustomerId,
        "beneficiaryCategory",
        "breastfeeding_mother"
      );

      const state = await surveyResponseStorageService.getSurveyResponseState(
        testLgCustomerId,
        testCustomerId
      );

      // Last answer should win
      expect(state?.answers.beneficiaryCategory).toBe("breastfeeding_mother");
    });
  });
});
