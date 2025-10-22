/**
 * Survey Engine Service
 * Fetches and manages SurveyJS form definitions with caching
 */

import { createModuleLogger } from "./logger.js";
import {
  parseSurveyForm,
  getNextQuestion,
  SurveyQuestion,
  ParsedSurveyForm,
} from "../utils/survey-form-parser.js";
import { config } from "../config.js";

const logger = createModuleLogger("survey-engine");

/**
 * Survey Engine Service
 * Manages form fetching, caching, and question sequencing
 */
class SurveyEngineService {
  private cachedForm: ParsedSurveyForm | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION_MS = 3600000; // 1 hour

  /**
   * Fetch survey form from configured URL
   */
  async fetchSurveyForm(): Promise<ParsedSurveyForm> {
    const now = Date.now();

    // Return cached form if still valid
    if (this.cachedForm && now - this.cacheTimestamp < this.CACHE_DURATION_MS) {
      logger.debug("Returning cached survey form");
      return this.cachedForm;
    }

    const surveyFormUrl = config.SURVEY_FORM_URL;
    if (!surveyFormUrl) {
      throw new Error("SURVEY_FORM_URL environment variable is not set");
    }

    logger.info({ url: surveyFormUrl }, "Fetching survey form from URL");

    try {
      const response = await fetch(surveyFormUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch survey form: ${response.status} ${response.statusText}`
        );
      }

      const formJson = await response.json();
      this.cachedForm = parseSurveyForm(formJson);
      this.cacheTimestamp = now;

      logger.info(
        { questionCount: this.cachedForm.questions.length },
        "Survey form fetched and cached successfully"
      );

      return this.cachedForm;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          url: surveyFormUrl,
        },
        "Failed to fetch survey form"
      );
      throw error;
    }
  }

  /**
   * Get next question based on current answers
   */
  async getNextQuestion(
    answers: Record<string, any>,
    currentIndex: number = 0
  ): Promise<SurveyQuestion | null> {
    try {
      const form = await this.fetchSurveyForm();
      return getNextQuestion(form.questions, answers, currentIndex);
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to get next question"
      );
      throw error;
    }
  }

  /**
   * Get all questions from the form
   */
  async getAllQuestions(): Promise<SurveyQuestion[]> {
    try {
      const form = await this.fetchSurveyForm();
      return form.questions;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to get all questions"
      );
      throw error;
    }
  }

  /**
   * Get question by name
   */
  async getQuestionByName(name: string): Promise<SurveyQuestion | undefined> {
    try {
      const form = await this.fetchSurveyForm();
      return form.questions.find(q => q.name === name);
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          questionName: name,
        },
        "Failed to get question by name"
      );
      throw error;
    }
  }

  /**
   * Get form title and description
   */
  async getFormMetadata(): Promise<{ title: string; description?: string }> {
    try {
      const form = await this.fetchSurveyForm();
      return {
        title: form.title,
        description: form.description,
      };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to get form metadata"
      );
      throw error;
    }
  }

  /**
   * Clear cache (useful for testing or forcing refresh)
   */
  clearCache(): void {
    logger.debug("Clearing survey form cache");
    this.cachedForm = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Get cache status
   */
  getCacheStatus(): {
    isCached: boolean;
    age: number;
    isValid: boolean;
  } {
    const now = Date.now();
    const age = now - this.cacheTimestamp;
    const isValid = age < this.CACHE_DURATION_MS;

    return {
      isCached: this.cachedForm !== null,
      age,
      isValid,
    };
  }
}

// Export singleton instance
export const surveyEngineService = new SurveyEngineService();
