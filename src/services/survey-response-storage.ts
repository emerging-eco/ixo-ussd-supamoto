/**
 * Survey Response Storage Service
 * Handles persistence of encrypted survey responses with session recovery support
 */

import { createModuleLogger } from "./logger.js";
import {
  dataService,
  HouseholdSurveyResponseRecord,
  HouseholdSurveyResponseData,
} from "./database-storage.js";

const logger = createModuleLogger("survey-response-storage");

export interface SurveyAnswer {
  questionName: string;
  answer: string | boolean | number;
}

export interface SurveyResponseState {
  customerId: string;
  leadGeneratorId: string;
  answers: Record<string, any>;
  allFieldsCompleted: boolean;
}

/**
 * Survey Response Storage Service
 * Manages saving and retrieving survey responses with encryption
 */
class SurveyResponseStorageService {
  /**
   * Save a single survey answer
   */
  async saveSurveyAnswer(
    customerId: string,
    leadGeneratorId: string,
    questionName: string,
    answer: string | boolean | number
  ): Promise<HouseholdSurveyResponseRecord> {
    logger.info(
      {
        customerId: customerId.slice(-4),
        leadGeneratorId: leadGeneratorId.slice(-4),
        questionName,
      },
      "Saving survey answer"
    );

    try {
      // Get existing response or create new one
      const existing = await dataService.getSurveyResponse(
        customerId,
        leadGeneratorId
      );

      const data: HouseholdSurveyResponseData = {
        customerId,
        leadGeneratorId,
      };

      // Map question name to field name
      const fieldName = this.mapQuestionNameToFieldName(questionName);
      (data as any)[fieldName] = String(answer);

      // Preserve existing answers
      if (existing) {
        Object.keys(existing).forEach(key => {
          if (
            key !== "id" &&
            key !== "customerId" &&
            key !== "leadGeneratorId" &&
            key !== "createdAt" &&
            key !== "updatedAt" &&
            key !== "allFieldsCompleted" &&
            (data as any)[key] === undefined
          ) {
            (data as any)[key] = (existing as any)[key];
          }
        });
      }

      return await dataService.createOrUpdateSurveyResponse(data);
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
    customerId: string,
    leadGeneratorId: string,
    answers: Record<string, any>
  ): Promise<HouseholdSurveyResponseRecord> {
    logger.info(
      {
        customerId: customerId.slice(-4),
        leadGeneratorId: leadGeneratorId.slice(-4),
        answerCount: Object.keys(answers).length,
      },
      "Saving multiple survey answers"
    );

    try {
      const data: HouseholdSurveyResponseData = {
        customerId,
        leadGeneratorId,
      };

      // Map all answers to field names
      Object.entries(answers).forEach(([questionName, answer]) => {
        const fieldName = this.mapQuestionNameToFieldName(questionName);
        (data as any)[fieldName] = String(answer);
      });

      return await dataService.createOrUpdateSurveyResponse(data);
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
    customerId: string,
    leadGeneratorId: string
  ): Promise<HouseholdSurveyResponseRecord> {
    logger.info(
      {
        customerId: customerId.slice(-4),
        leadGeneratorId: leadGeneratorId.slice(-4),
      },
      "Marking survey as complete"
    );

    try {
      return await dataService.markSurveyComplete(customerId, leadGeneratorId);
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
    customerId: string,
    leadGeneratorId: string
  ): Promise<SurveyResponseState | null> {
    logger.debug(
      {
        customerId: customerId.slice(-4),
        leadGeneratorId: leadGeneratorId.slice(-4),
      },
      "Fetching survey response state"
    );

    try {
      const response = await dataService.getSurveyResponse(
        customerId,
        leadGeneratorId
      );

      if (!response) {
        return null;
      }

      // Convert decrypted fields back to answers object
      const answers: Record<string, any> = {};

      if (response.beneficiaryCategory) {
        answers.beneficiaryCategory = response.beneficiaryCategory;
      }
      if (response.childMaxAge) {
        answers.childMaxAge = response.childMaxAge;
      }
      if (response.beanIntakeFrequency) {
        answers.beanIntakeFrequency = response.beanIntakeFrequency;
      }
      if (response.priceSpecification) {
        answers.priceSpecification = response.priceSpecification;
      }
      if (response.awarenessIronBeans) {
        answers.awarenessIronBeans = response.awarenessIronBeans;
      }
      if (response.knowsNutritionalBenefits) {
        answers.knowsNutritionalBenefits = response.knowsNutritionalBenefits;
      }
      if (response.nutritionalBenefitDetails) {
        answers.nutritionalBenefitDetails = response.nutritionalBenefitDetails;
      }
      if (response.confirmActionAntenatalCardVerified) {
        answers.confirmActionAntenatalCardVerified =
          response.confirmActionAntenatalCardVerified;
      }

      return {
        customerId: response.customerId,
        leadGeneratorId: response.leadGeneratorId,
        answers,
        allFieldsCompleted: response.allFieldsCompleted,
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

  /**
   * Map question name to database field name
   */
  private mapQuestionNameToFieldName(questionName: string): string {
    const mapping: Record<string, string> = {
      beneficiaryCategory: "beneficiaryCategory",
      childMaxAge: "childMaxAge",
      beanIntakeFrequency: "beanIntakeFrequency",
      priceSpecification: "priceSpecification",
      awarenessIronBeans: "awarenessIronBeans",
      knowsNutritionalBenefits: "knowsNutritionalBenefits",
      nutritionalBenefitDetails: "nutritionalBenefitDetails",
      confirmActionAntenatalCardVerified: "confirmActionAntenatalCardVerified",
    };

    return mapping[questionName] || questionName;
  }
}

// Export singleton instance
export const surveyResponseStorageService = new SurveyResponseStorageService();
