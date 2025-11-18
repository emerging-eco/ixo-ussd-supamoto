/**
 * Unit tests for JSON-based survey storage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  surveyResponseStorageService,
  ParsedSurveyForm,
  SurveyFormJson,
  SurveyQuestion,
} from "../../src/services/survey-response-storage.js";
import { dataService } from "../../src/services/database-storage.js";

describe("Survey JSON Storage", () => {
  describe("encryptSurveyJson and decryptSurveyJson", () => {
    it("should encrypt and decrypt JSON objects correctly", () => {
      const testData = {
        formDefinition: { title: "Test Survey", questions: [] },
        answers: { question1: "answer1", question2: "answer2" },
        metadata: {
          startedAt: "2025-01-01T00:00:00Z",
          lastUpdatedAt: "2025-01-01T00:00:00Z",
          completedAt: null,
          allFieldsCompleted: false,
          version: "1.0",
        },
      };

      const encrypted =
        surveyResponseStorageService.encryptSurveyJson(testData);
      expect(encrypted).toBeTruthy();
      expect(typeof encrypted).toBe("string");

      const decrypted =
        surveyResponseStorageService.decryptSurveyJson(encrypted);
      expect(decrypted).toEqual(testData);
    });

    it("should handle complex nested JSON structures", () => {
      const complexData = {
        formDefinition: {
          title: "Complex Survey",
          questions: [
            {
              name: "q1",
              title: "Question 1",
              type: "radiogroup",
              choices: ["a", "b", "c"],
              required: true,
            },
          ],
        },
        answers: {
          q1: "a",
          q2: { nested: "value", array: [1, 2, 3] },
        },
        metadata: {
          startedAt: "2025-01-01T00:00:00Z",
          lastUpdatedAt: "2025-01-01T00:00:00Z",
          completedAt: null,
          allFieldsCompleted: false,
          version: "1.0",
        },
      };

      const encrypted =
        surveyResponseStorageService.encryptSurveyJson(complexData);
      const decrypted =
        surveyResponseStorageService.decryptSurveyJson(encrypted);
      expect(decrypted).toEqual(complexData);
    });
  });

  describe("buildSurveyFormJson", () => {
    it("should build survey JSON with form definition and answers", () => {
      const formDefinition: ParsedSurveyForm = {
        title: "Test Survey",
        questions: [
          {
            name: "q1",
            title: "Question 1",
            type: "text",
            required: true,
          },
        ],
      };

      const answers = { q1: "answer1" };

      const result = surveyResponseStorageService.buildSurveyFormJson(
        formDefinition,
        answers
      );

      expect(result.formDefinition).toEqual(formDefinition);
      expect(result.answers).toEqual(answers);
      expect(result.metadata.allFieldsCompleted).toBe(false);
      expect(result.metadata.version).toBe("1.0");
      expect(result.metadata.startedAt).toBeTruthy();
      expect(result.metadata.lastUpdatedAt).toBeTruthy();
      expect(result.metadata.completedAt).toBeNull();
    });

    it("should preserve existing metadata when provided", () => {
      const existingMetadata = {
        startedAt: "2025-01-01T00:00:00Z",
        lastUpdatedAt: "2025-01-01T00:00:00Z",
        completedAt: "2025-01-01T01:00:00Z",
        allFieldsCompleted: true,
        version: "1.0",
      };

      const result = surveyResponseStorageService.buildSurveyFormJson(
        null,
        { q1: "answer1" },
        existingMetadata
      );

      expect(result.metadata.startedAt).toBe(existingMetadata.startedAt);
      expect(result.metadata.completedAt).toBe(existingMetadata.completedAt);
      expect(result.metadata.allFieldsCompleted).toBe(true);
    });

    it("should handle null form definition", () => {
      const result = surveyResponseStorageService.buildSurveyFormJson(null, {
        q1: "answer1",
      });

      expect(result.formDefinition).toBeNull();
      expect(result.answers).toEqual({ q1: "answer1" });
    });
  });

  describe("extractAnswersFromJson", () => {
    it("should extract answers from survey JSON", () => {
      const surveyJson: SurveyFormJson = {
        formDefinition: null,
        answers: { q1: "answer1", q2: "answer2" },
        metadata: {
          startedAt: "2025-01-01T00:00:00Z",
          lastUpdatedAt: "2025-01-01T00:00:00Z",
          completedAt: null,
          allFieldsCompleted: false,
          version: "1.0",
        },
      };

      const answers =
        surveyResponseStorageService.extractAnswersFromJson(surveyJson);
      expect(answers).toEqual({ q1: "answer1", q2: "answer2" });
    });

    it("should return empty object if no answers", () => {
      const surveyJson: SurveyFormJson = {
        formDefinition: null,
        answers: {},
        metadata: {
          startedAt: "2025-01-01T00:00:00Z",
          lastUpdatedAt: "2025-01-01T00:00:00Z",
          completedAt: null,
          allFieldsCompleted: false,
          version: "1.0",
        },
      };

      const answers =
        surveyResponseStorageService.extractAnswersFromJson(surveyJson);
      expect(answers).toEqual({});
    });
  });

  describe("isAllFieldsCompleted", () => {
    it("should return true when all required questions are answered", () => {
      const questions: SurveyQuestion[] = [
        { name: "q1", title: "Q1", type: "text", required: true },
        { name: "q2", title: "Q2", type: "text", required: true },
        { name: "q3", title: "Q3", type: "text", required: false },
      ];

      const surveyJson: SurveyFormJson = {
        formDefinition: null,
        answers: { q1: "answer1", q2: "answer2" },
        metadata: {
          startedAt: "2025-01-01T00:00:00Z",
          lastUpdatedAt: "2025-01-01T00:00:00Z",
          completedAt: null,
          allFieldsCompleted: false,
          version: "1.0",
        },
      };

      const result = surveyResponseStorageService.isAllFieldsCompleted(
        surveyJson,
        questions
      );
      expect(result).toBe(true);
    });

    it("should return false when required questions are missing", () => {
      const questions: SurveyQuestion[] = [
        { name: "q1", title: "Q1", type: "text", required: true },
        { name: "q2", title: "Q2", type: "text", required: true },
      ];

      const surveyJson: SurveyFormJson = {
        formDefinition: null,
        answers: { q1: "answer1" }, // q2 is missing
        metadata: {
          startedAt: "2025-01-01T00:00:00Z",
          lastUpdatedAt: "2025-01-01T00:00:00Z",
          completedAt: null,
          allFieldsCompleted: false,
          version: "1.0",
        },
      };

      const result = surveyResponseStorageService.isAllFieldsCompleted(
        surveyJson,
        questions
      );
      expect(result).toBe(false);
    });

    it("should return true when only optional questions are missing", () => {
      const questions: SurveyQuestion[] = [
        { name: "q1", title: "Q1", type: "text", required: true },
        { name: "q2", title: "Q2", type: "text", required: false },
      ];

      const surveyJson: SurveyFormJson = {
        formDefinition: null,
        answers: { q1: "answer1" }, // q2 is optional and missing
        metadata: {
          startedAt: "2025-01-01T00:00:00Z",
          lastUpdatedAt: "2025-01-01T00:00:00Z",
          completedAt: null,
          allFieldsCompleted: false,
          version: "1.0",
        },
      };

      const result = surveyResponseStorageService.isAllFieldsCompleted(
        surveyJson,
        questions
      );
      expect(result).toBe(true);
    });

    it("should return true when no required questions exist", () => {
      const questions: SurveyQuestion[] = [
        { name: "q1", title: "Q1", type: "text", required: false },
        { name: "q2", title: "Q2", type: "text", required: false },
      ];

      const surveyJson: SurveyFormJson = {
        formDefinition: null,
        answers: {},
        metadata: {
          startedAt: "2025-01-01T00:00:00Z",
          lastUpdatedAt: "2025-01-01T00:00:00Z",
          completedAt: null,
          allFieldsCompleted: false,
          version: "1.0",
        },
      };

      const result = surveyResponseStorageService.isAllFieldsCompleted(
        surveyJson,
        questions
      );
      expect(result).toBe(true);
    });
  });

  describe("Incremental answer updates", () => {
    it("should preserve existing answers when adding new ones", () => {
      const initialJson: SurveyFormJson = {
        formDefinition: null,
        answers: { q1: "answer1" },
        metadata: {
          startedAt: "2025-01-01T00:00:00Z",
          lastUpdatedAt: "2025-01-01T00:00:00Z",
          completedAt: null,
          allFieldsCompleted: false,
          version: "1.0",
        },
      };

      // Simulate adding a new answer
      const updatedAnswers = { ...initialJson.answers, q2: "answer2" };
      const updatedJson = surveyResponseStorageService.buildSurveyFormJson(
        null,
        updatedAnswers,
        initialJson.metadata
      );

      expect(updatedJson.answers).toEqual({ q1: "answer1", q2: "answer2" });
    });

    it("should allow updating existing answers", () => {
      const initialJson: SurveyFormJson = {
        formDefinition: null,
        answers: { q1: "answer1", q2: "answer2" },
        metadata: {
          startedAt: "2025-01-01T00:00:00Z",
          lastUpdatedAt: "2025-01-01T00:00:00Z",
          completedAt: null,
          allFieldsCompleted: false,
          version: "1.0",
        },
      };

      // Simulate updating an answer
      const updatedAnswers = { ...initialJson.answers, q1: "updated_answer1" };
      const updatedJson = surveyResponseStorageService.buildSurveyFormJson(
        null,
        updatedAnswers,
        initialJson.metadata
      );

      expect(updatedJson.answers.q1).toBe("updated_answer1");
      expect(updatedJson.answers.q2).toBe("answer2");
    });
  });

  describe("Error handling and strict mode", () => {
    const testLgCustomerId = "LG_TEST_1234";
    const testCustomerId = "C_TEST_1234";
    let originalStrictMode: string | undefined;

    beforeEach(() => {
      originalStrictMode = process.env.USSD_SURVEY_STRICT_MODE;
      vi.restoreAllMocks();
    });

    afterEach(() => {
      if (originalStrictMode === undefined) {
        delete process.env.USSD_SURVEY_STRICT_MODE;
      } else {
        process.env.USSD_SURVEY_STRICT_MODE = originalStrictMode;
      }
      vi.restoreAllMocks();
    });

    it("logs audit event and does not throw when saveSurveyAnswer fails in non-strict mode", async () => {
      delete process.env.USSD_SURVEY_STRICT_MODE;

      const error = new Error("Simulated persistence failure");
      vi
        .spyOn(dataService, "getClaimByLgAndCustomer")
        .mockResolvedValue(null as any);
      const updateSpy = vi
        .spyOn(dataService, "updateClaimSurveyForm")
        .mockRejectedValue(error);
      const auditSpy = vi
        .spyOn(dataService, "logAuditEvent")
        .mockResolvedValue(undefined as any);

      await expect(
        surveyResponseStorageService.saveSurveyAnswer(
          testLgCustomerId,
          testCustomerId,
          "ecs:beneficiaryCategory",
          ["pregnant_woman"]
        )
      ).resolves.toBeUndefined();

      expect(updateSpy).toHaveBeenCalled();
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "SURVEY_SAVE_FAILED",
          customerId: testCustomerId,
          lgCustomerId: testLgCustomerId,
        })
      );
    });

    it("rethrows persistence errors in strict mode", async () => {
      process.env.USSD_SURVEY_STRICT_MODE = "true";

      const error = new Error("Simulated strict mode persistence failure");
      vi
        .spyOn(dataService, "getClaimByLgAndCustomer")
        .mockResolvedValue(null as any);
      const updateSpy = vi
        .spyOn(dataService, "updateClaimSurveyForm")
        .mockRejectedValue(error);
      const auditSpy = vi
        .spyOn(dataService, "logAuditEvent")
        .mockResolvedValue(undefined as any);

      await expect(
        surveyResponseStorageService.saveSurveyAnswer(
          testLgCustomerId,
          testCustomerId,
          "ecs:beneficiaryCategory",
          ["pregnant_woman"]
        )
      ).rejects.toBe(error);

      expect(updateSpy).toHaveBeenCalled();
      expect(auditSpy).toHaveBeenCalled();
    });
  });
});
