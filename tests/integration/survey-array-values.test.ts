/**
 * Integration tests for survey array value storage
 * Tests that array values (like beneficiaryCategory) can be saved and retrieved correctly
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { surveyResponseStorageService } from "../../src/services/survey-response-storage.js";
import { databaseManager } from "../../src/services/database-manager.js";

describe("Survey Array Values Integration Tests", () => {
  const testLgCustomerId = "C12345678";
  const testCustomerId = "C87654321";

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

  describe("Single array value (beneficiaryCategory)", () => {
    it("should save and retrieve single-element array", async () => {
      const beneficiaryCategory = ["pregnant_woman"];

      await surveyResponseStorageService.saveSurveyAnswer(
        testLgCustomerId,
        testCustomerId,
        "ecs:beneficiaryCategory",
        beneficiaryCategory
      );

      const state = await surveyResponseStorageService.getSurveyResponseState(
        testLgCustomerId,
        testCustomerId
      );

      expect(state?.answers["ecs:beneficiaryCategory"]).toEqual(
        beneficiaryCategory
      );
      expect(Array.isArray(state?.answers["ecs:beneficiaryCategory"])).toBe(
        true
      );
    });

    it("should save and retrieve multi-element array", async () => {
      const beneficiaryCategory = ["pregnant_woman", "breastfeeding_mother"];

      await surveyResponseStorageService.saveSurveyAnswer(
        testLgCustomerId,
        testCustomerId,
        "ecs:beneficiaryCategory",
        beneficiaryCategory
      );

      const state = await surveyResponseStorageService.getSurveyResponseState(
        testLgCustomerId,
        testCustomerId
      );

      expect(state?.answers["ecs:beneficiaryCategory"]).toEqual(
        beneficiaryCategory
      );
      expect(state?.answers["ecs:beneficiaryCategory"]).toHaveLength(2);
    });

    it("should save and retrieve all three categories", async () => {
      const beneficiaryCategory = [
        "pregnant_woman",
        "breastfeeding_mother",
        "child_below_2_years",
      ];

      await surveyResponseStorageService.saveSurveyAnswer(
        testLgCustomerId,
        testCustomerId,
        "ecs:beneficiaryCategory",
        beneficiaryCategory
      );

      const state = await surveyResponseStorageService.getSurveyResponseState(
        testLgCustomerId,
        testCustomerId
      );

      expect(state?.answers["ecs:beneficiaryCategory"]).toEqual(
        beneficiaryCategory
      );
      expect(state?.answers["ecs:beneficiaryCategory"]).toHaveLength(3);
    });
  });

  describe("Multiple array values", () => {
    it("should save multiple array fields in one call", async () => {
      const answers = {
        "ecs:beneficiaryCategory": ["pregnant_woman", "breastfeeding_mother"],
        "ecs:nutritionalBenefitDetails": ["protein", "fiber"],
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

      expect(state?.answers["ecs:beneficiaryCategory"]).toEqual(
        answers["ecs:beneficiaryCategory"]
      );
      expect(state?.answers["ecs:nutritionalBenefitDetails"]).toEqual(
        answers["ecs:nutritionalBenefitDetails"]
      );
    });
  });

  describe("Mixed primitive and array values", () => {
    it("should save and retrieve mixed types correctly", async () => {
      // Save array value first
      await surveyResponseStorageService.saveSurveyAnswer(
        testLgCustomerId,
        testCustomerId,
        "ecs:beneficiaryCategory",
        ["pregnant_woman"]
      );

      // Save primitive values
      await surveyResponseStorageService.saveSurveyAnswer(
        testLgCustomerId,
        testCustomerId,
        "ecs:childAge",
        6
      );

      await surveyResponseStorageService.saveSurveyAnswer(
        testLgCustomerId,
        testCustomerId,
        "ecs:beanIntakeFrequency",
        "daily"
      );

      await surveyResponseStorageService.saveSurveyAnswer(
        testLgCustomerId,
        testCustomerId,
        "ecs:hasAccessToCleanWater",
        true
      );

      const state = await surveyResponseStorageService.getSurveyResponseState(
        testLgCustomerId,
        testCustomerId
      );

      // Verify all values are preserved with correct types
      expect(state?.answers["ecs:beneficiaryCategory"]).toEqual([
        "pregnant_woman",
      ]);
      expect(Array.isArray(state?.answers["ecs:beneficiaryCategory"])).toBe(
        true
      );
      expect(state?.answers["ecs:childAge"]).toBe(6);
      expect(typeof state?.answers["ecs:childAge"]).toBe("number");
      expect(state?.answers["ecs:beanIntakeFrequency"]).toBe("daily");
      expect(typeof state?.answers["ecs:beanIntakeFrequency"]).toBe("string");
      expect(state?.answers["ecs:hasAccessToCleanWater"]).toBe(true);
      expect(typeof state?.answers["ecs:hasAccessToCleanWater"]).toBe(
        "boolean"
      );
    });
  });

  describe("Array value updates", () => {
    it("should update array value correctly", async () => {
      // Save initial array value
      await surveyResponseStorageService.saveSurveyAnswer(
        testLgCustomerId,
        testCustomerId,
        "ecs:beneficiaryCategory",
        ["pregnant_woman"]
      );

      // Update to different array value
      await surveyResponseStorageService.saveSurveyAnswer(
        testLgCustomerId,
        testCustomerId,
        "ecs:beneficiaryCategory",
        ["pregnant_woman", "breastfeeding_mother"]
      );

      const state = await surveyResponseStorageService.getSurveyResponseState(
        testLgCustomerId,
        testCustomerId
      );

      expect(state?.answers["ecs:beneficiaryCategory"]).toEqual([
        "pregnant_woman",
        "breastfeeding_mother",
      ]);
      expect(state?.answers["ecs:beneficiaryCategory"]).toHaveLength(2);
    });
  });

  describe("Encryption/Decryption round-trip", () => {
    it("should preserve array structure through encryption", async () => {
      const testAnswers = {
        "ecs:beneficiaryCategory": [
          "pregnant_woman",
          "breastfeeding_mother",
          "child_below_2_years",
        ],
        "ecs:nutritionalBenefitDetails": ["protein", "fiber", "vitamins"],
        "ecs:childAge": 12,
        "ecs:beanIntakeFrequency": "daily",
      };

      await surveyResponseStorageService.saveSurveyAnswers(
        testLgCustomerId,
        testCustomerId,
        testAnswers
      );

      const state = await surveyResponseStorageService.getSurveyResponseState(
        testLgCustomerId,
        testCustomerId
      );

      // Verify all array structures are preserved
      expect(state?.answers["ecs:beneficiaryCategory"]).toEqual(
        testAnswers["ecs:beneficiaryCategory"]
      );
      expect(state?.answers["ecs:nutritionalBenefitDetails"]).toEqual(
        testAnswers["ecs:nutritionalBenefitDetails"]
      );
      expect(state?.answers["ecs:childAge"]).toBe(testAnswers["ecs:childAge"]);
      expect(state?.answers["ecs:beanIntakeFrequency"]).toBe(
        testAnswers["ecs:beanIntakeFrequency"]
      );
    });
  });

  describe("Number array values", () => {
    it("should save and retrieve number arrays", async () => {
      const numberArray = [1, 2, 3, 4, 5];

      await surveyResponseStorageService.saveSurveyAnswer(
        testLgCustomerId,
        testCustomerId,
        "ecs:testNumberArray",
        numberArray
      );

      const state = await surveyResponseStorageService.getSurveyResponseState(
        testLgCustomerId,
        testCustomerId
      );

      expect(state?.answers["ecs:testNumberArray"]).toEqual(numberArray);
      expect(Array.isArray(state?.answers["ecs:testNumberArray"])).toBe(true);
      expect(state?.answers["ecs:testNumberArray"]).toHaveLength(5);
    });
  });

  describe("Empty array values", () => {
    it("should handle empty arrays correctly", async () => {
      const emptyArray: string[] = [];

      await surveyResponseStorageService.saveSurveyAnswer(
        testLgCustomerId,
        testCustomerId,
        "ecs:beneficiaryCategory",
        emptyArray
      );

      const state = await surveyResponseStorageService.getSurveyResponseState(
        testLgCustomerId,
        testCustomerId
      );

      expect(state?.answers["ecs:beneficiaryCategory"]).toEqual(emptyArray);
      expect(Array.isArray(state?.answers["ecs:beneficiaryCategory"])).toBe(
        true
      );
      expect(state?.answers["ecs:beneficiaryCategory"]).toHaveLength(0);
    });
  });
});
