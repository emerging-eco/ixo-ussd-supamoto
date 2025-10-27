/**
 * Survey Response Storage Service
 * Handles persistence of encrypted survey responses with session recovery support
 * Refactored to use JSON storage in household_claims table
 */

import { createModuleLogger } from "./logger.js";
import { dataService } from "./database-storage.js";
import { encrypt, decrypt } from "../utils/encryption.js";
import { config } from "../config.js";

const logger = createModuleLogger("survey-response-storage");

export interface SurveyAnswer {
  questionName: string;
  answer: string | boolean | number;
}

export interface SurveyResponseState {
  lgCustomerId: string; // Lead Generator's customer ID
  customerId: string; // Customer being surveyed
  answers: Record<string, any>;
  allFieldsCompleted: boolean;
}

export interface SurveyQuestion {
  name: string;
  title: string;
  type: string;
  required?: boolean;
  visibleIf?: string;
  choices?: any[];
}

export interface ParsedSurveyForm {
  title?: string;
  questions: SurveyQuestion[];
}

export interface SurveyFormJson {
  formDefinition: ParsedSurveyForm | null;
  answers: Record<string, any>;
  metadata: {
    startedAt: string;
    lastUpdatedAt: string;
    completedAt: string | null;
    allFieldsCompleted: boolean;
    version: string;
  };
}

/**
 * Survey Response Storage Service
 * Manages saving and retrieving survey responses with JSON encryption
 */
class SurveyResponseStorageService {
  /**
   * Encrypt survey JSON
   */
  encryptSurveyJson(surveyData: any): string {
    const encryptionKey = config.SYSTEM.ENCRYPTION_KEY;
    return encrypt(JSON.stringify(surveyData), encryptionKey);
  }

  /**
   * Decrypt survey JSON
   */
  decryptSurveyJson(encryptedJson: string): any {
    const encryptionKey = config.SYSTEM.ENCRYPTION_KEY;
    try {
      const decrypted = decrypt(encryptedJson, encryptionKey);
      return JSON.parse(decrypted);
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to decrypt survey JSON"
      );
      throw error;
    }
  }

  /**
   * Build survey form JSON structure
   */
  buildSurveyFormJson(
    formDefinition: ParsedSurveyForm | null,
    answers: Record<string, any>,
    existingMetadata?: any
  ): SurveyFormJson {
    const now = new Date().toISOString();

    return {
      formDefinition,
      answers,
      metadata: {
        startedAt: existingMetadata?.startedAt || now,
        lastUpdatedAt: now,
        completedAt: existingMetadata?.completedAt || null,
        allFieldsCompleted: existingMetadata?.allFieldsCompleted || false,
        version: "1.0",
      },
    };
  }

  /**
   * Extract answers from survey JSON
   */
  extractAnswersFromJson(surveyJson: SurveyFormJson): Record<string, any> {
    return surveyJson.answers || {};
  }

  /**
   * Check if all required fields are completed
   */
  isAllFieldsCompleted(
    surveyJson: SurveyFormJson,
    requiredQuestions: SurveyQuestion[]
  ): boolean {
    const answers = surveyJson.answers || {};

    // Check if all required questions have answers
    for (const question of requiredQuestions) {
      if (question.required && !answers[question.name]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Save a single survey answer
   */
  async saveSurveyAnswer(
    lgCustomerId: string,
    customerId: string,
    questionName: string,
    answer: string | boolean | number,
    formDefinition?: ParsedSurveyForm
  ): Promise<void> {
    logger.info(
      {
        lgCustomerId: lgCustomerId.slice(-4),
        customerId: customerId.slice(-4),
        questionName,
      },
      "Saving survey answer"
    );

    try {
      // Get existing claim with survey data
      const existingClaim = await dataService.getClaimByLgAndCustomer(
        lgCustomerId,
        customerId
      );

      let surveyJson: SurveyFormJson;

      if (existingClaim?.surveyForm) {
        // Parse existing survey JSON
        surveyJson = JSON.parse(existingClaim.surveyForm);
        // Update the answer
        surveyJson.answers[questionName] = answer;
        // Update metadata
        surveyJson.metadata.lastUpdatedAt = new Date().toISOString();
        // Update form definition if provided
        if (formDefinition) {
          surveyJson.formDefinition = formDefinition;
        }
      } else {
        // Create new survey JSON
        surveyJson = this.buildSurveyFormJson(formDefinition || null, {
          [questionName]: answer,
        });
      }

      // Save to database
      await dataService.updateClaimSurveyForm(
        lgCustomerId,
        customerId,
        surveyJson
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          customerId: customerId.slice(-4),
          questionName,
        },
        "Failed to save survey answer"
      );
      throw error;
    }
  }

  /**
   * Save multiple survey answers at once
   */
  async saveSurveyAnswers(
    lgCustomerId: string,
    customerId: string,
    answers: Record<string, any>,
    formDefinition?: ParsedSurveyForm
  ): Promise<void> {
    logger.info(
      {
        lgCustomerId: lgCustomerId.slice(-4),
        customerId: customerId.slice(-4),
        answerCount: Object.keys(answers).length,
      },
      "Saving multiple survey answers"
    );

    try {
      // Get existing claim with survey data
      const existingClaim = await dataService.getClaimByLgAndCustomer(
        lgCustomerId,
        customerId
      );

      let surveyJson: SurveyFormJson;

      if (existingClaim?.surveyForm) {
        // Parse existing survey JSON
        surveyJson = JSON.parse(existingClaim.surveyForm);
        // Merge new answers
        surveyJson.answers = { ...surveyJson.answers, ...answers };
        // Update metadata
        surveyJson.metadata.lastUpdatedAt = new Date().toISOString();
        // Update form definition if provided
        if (formDefinition) {
          surveyJson.formDefinition = formDefinition;
        }
      } else {
        // Create new survey JSON
        surveyJson = this.buildSurveyFormJson(formDefinition || null, answers);
      }

      // Save to database
      await dataService.updateClaimSurveyForm(
        lgCustomerId,
        customerId,
        surveyJson
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          customerId: customerId.slice(-4),
        },
        "Failed to save survey answers"
      );
      throw error;
    }
  }

  /**
   * Mark survey as complete
   */
  async markSurveyComplete(
    lgCustomerId: string,
    customerId: string
  ): Promise<void> {
    logger.info(
      {
        lgCustomerId: lgCustomerId.slice(-4),
        customerId: customerId.slice(-4),
      },
      "Marking survey as complete"
    );

    try {
      // Get existing claim with survey data
      const existingClaim = await dataService.getClaimByLgAndCustomer(
        lgCustomerId,
        customerId
      );

      if (!existingClaim?.surveyForm) {
        throw new Error("No survey data found to mark as complete");
      }

      // Parse existing survey JSON
      const surveyJson: SurveyFormJson = JSON.parse(existingClaim.surveyForm);

      // Update metadata
      surveyJson.metadata.allFieldsCompleted = true;
      surveyJson.metadata.completedAt = new Date().toISOString();
      surveyJson.metadata.lastUpdatedAt = new Date().toISOString();

      // Save to database
      await dataService.updateClaimSurveyForm(
        lgCustomerId,
        customerId,
        surveyJson
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          customerId: customerId.slice(-4),
        },
        "Failed to mark survey as complete"
      );
      throw error;
    }
  }

  /**
   * Get survey response state for session recovery
   */
  async getSurveyResponseState(
    lgCustomerId: string,
    customerId: string
  ): Promise<SurveyResponseState | null> {
    logger.debug(
      {
        lgCustomerId: lgCustomerId.slice(-4),
        customerId: customerId.slice(-4),
      },
      "Fetching survey response state"
    );

    try {
      const claim = await dataService.getClaimByLgAndCustomer(
        lgCustomerId,
        customerId
      );

      if (!claim?.surveyForm) {
        return null;
      }

      // Parse survey JSON
      const surveyJson: SurveyFormJson = JSON.parse(claim.surveyForm);

      return {
        lgCustomerId,
        customerId,
        answers: surveyJson.answers || {},
        allFieldsCompleted: surveyJson.metadata?.allFieldsCompleted || false,
      };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          customerId: customerId.slice(-4),
        },
        "Failed to fetch survey response state"
      );
      throw error;
    }
  }
}

// Export singleton instance
export const surveyResponseStorageService = new SurveyResponseStorageService();
