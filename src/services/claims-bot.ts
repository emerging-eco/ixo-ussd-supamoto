/**
 * Claims Bot Service
 * Wrapper for @ixo/supamoto-bot-sdk claims bot client
 */

import { createClaimsBotClient, ClaimsBotTypes } from "@ixo/supamoto-bot-sdk";
import { config } from "../config.js";
import { createModuleLogger } from "./logger.js";

const logger = createModuleLogger("claims-bot");

/**
 * Get or create the claims bot client singleton
 */
let claimsBotClient: ReturnType<typeof createClaimsBotClient> | null = null;

export function getClaimsBotClient() {
  if (!claimsBotClient) {
    const botUrl = config.CLAIMS_BOT.URL;
    const accessToken = config.CLAIMS_BOT.ACCESS_TOKEN;

    if (!botUrl || !accessToken) {
      throw new Error(
        "CLAIMS_BOT_URL and CLAIMS_BOT_ACCESS_TOKEN must be configured"
      );
    }

    logger.info({ botUrl }, "Initializing claims bot client");

    claimsBotClient = createClaimsBotClient({
      botUrl,
      accessToken,
    });
  }

  return claimsBotClient;
}

/**
 * Map survey data to beneficiary category enum
 * The survey stores beneficiary categories as an array of strings
 * We need to map this to the SDK's BeneficiaryCategory enum
 */
export function mapBeneficiaryCategoryToEnum(
  categories: string[]
): ClaimsBotTypes.BeneficiaryCategory {
  // Check for combinations first
  const hasPregnant = categories.includes("pregnant_woman");
  const hasBreastfeeding = categories.includes("breastfeeding_mother");
  const hasChild = categories.includes("child_below_2_years");

  // For now, we'll use the first matching category
  // Note: The SDK enum only supports single values, not combinations
  // This may need to be updated when the SDK supports multiple categories
  if (hasPregnant) {
    return ClaimsBotTypes.BeneficiaryCategory.pregnant;
  } else if (hasBreastfeeding) {
    return ClaimsBotTypes.BeneficiaryCategory.breastfeeding;
  } else if (hasChild) {
    return ClaimsBotTypes.BeneficiaryCategory.child;
  }

  // Default to pregnant if none match (shouldn't happen with validation)
  logger.warn(
    { categories },
    "No matching beneficiary category found, defaulting to pregnant"
  );
  return ClaimsBotTypes.BeneficiaryCategory.pregnant;
}

/**
 * Map bean intake frequency to enum
 */
export function mapBeanIntakeFrequencyToEnum(
  frequency: string
): ClaimsBotTypes.BeanIntakeFrequency {
  switch (frequency) {
    case "none_at_all":
      return ClaimsBotTypes.BeanIntakeFrequency.none;
    case "1_2_times_week":
      return ClaimsBotTypes.BeanIntakeFrequency.oneOrTwo;
    case "3_4_times_week":
      return ClaimsBotTypes.BeanIntakeFrequency.threeOrFour;
    case "5_6_times_week":
      return ClaimsBotTypes.BeanIntakeFrequency.fiveOrSize;
    case "daily":
      return ClaimsBotTypes.BeanIntakeFrequency.daily;
    default:
      logger.warn(
        { frequency },
        "Unknown bean intake frequency, defaulting to none"
      );
      return ClaimsBotTypes.BeanIntakeFrequency.none;
  }
}

/**
 * Map yes/no string to enum
 */
export function mapYesNoToEnum(
  value: string
): ClaimsBotTypes.AwarenessIronBeans | ClaimsBotTypes.KnowsNutritionalBenefits {
  return value === "yes"
    ? ClaimsBotTypes.AwarenessIronBeans.yes
    : ClaimsBotTypes.AwarenessIronBeans.no;
}

/**
 * Map nutritional benefits array to enum
 * Note: The SDK type definition shows NutritionalBenefitsDetail as a single enum,
 * but according to requirements it should be an array. We'll map the first value
 * for now and log a warning if there are multiple values.
 */
export function mapNutritionalBenefitsToEnum(
  benefits: string[]
): ClaimsBotTypes.NutritionalBenefitsDetail {
  if (benefits.length === 0) {
    logger.warn("No nutritional benefits provided, using default");
    return ClaimsBotTypes.NutritionalBenefitsDetail.ironStatus;
  }

  if (benefits.length > 1) {
    logger.warn(
      { benefits, count: benefits.length },
      "Multiple nutritional benefits provided, but SDK only supports single value. Using first value."
    );
  }

  const firstBenefit = benefits[0];

  switch (firstBenefit) {
    case "iron_status":
      return ClaimsBotTypes.NutritionalBenefitsDetail.ironStatus;
    case "cognitive_support":
      return ClaimsBotTypes.NutritionalBenefitsDetail.cognitiveSupport;
    case "work_capacity":
      return ClaimsBotTypes.NutritionalBenefitsDetail.workCapacity;
    case "high_iron_zinc":
      return ClaimsBotTypes.NutritionalBenefitsDetail.highIronZinc;
    case "protein_fiber":
      return ClaimsBotTypes.NutritionalBenefitsDetail.protein_fiber;
    default:
      logger.warn(
        { benefit: firstBenefit },
        "Unknown nutritional benefit, defaulting to iron_status"
      );
      return ClaimsBotTypes.NutritionalBenefitsDetail.ironStatus;
  }
}

/**
 * Submit 1,000 Day Household Claim
 */
export async function submit1000DayHouseholdClaim(params: {
  leadGeneratorId: string;
  customerId: string;
  beneficiaryCategory: string[];
  childMaxAge?: number;
  beanIntakeFrequency: string;
  priceSpecification: string;
  awarenessIronBeans: string;
  knowsNutritionalBenefits: string;
  nutritionalBenefitDetails: string[];
  antenatalCardVerified: boolean;
}) {
  const client = getClaimsBotClient();

  logger.info(
    {
      leadGeneratorId: params.leadGeneratorId.slice(-4),
      customerId: params.customerId.slice(-4),
      beneficiaryCategory: params.beneficiaryCategory,
      childMaxAge: params.childMaxAge,
    },
    "Submitting 1,000 Day Household claim to claims bot"
  );

  try {
    const response = await client.claims.v1.submit1000DayHouseholdClaim({
      leadGeneratorId: params.leadGeneratorId,
      customerId: params.customerId,
      beneficiaryCategory: [
        mapBeneficiaryCategoryToEnum(params.beneficiaryCategory),
      ],
      childMaxAge: params.childMaxAge || 0,
      beanIntakeFrequency: mapBeanIntakeFrequencyToEnum(
        params.beanIntakeFrequency
      ),
      priceSpecification: params.priceSpecification,
      awarenessIronBeans: mapYesNoToEnum(
        params.awarenessIronBeans
      ) as ClaimsBotTypes.AwarenessIronBeans,
      knowsNutritionalBenefits: mapYesNoToEnum(
        params.knowsNutritionalBenefits
      ) as ClaimsBotTypes.KnowsNutritionalBenefits,
      nutritionalBenefitsDetails: [
        mapNutritionalBenefitsToEnum(params.nutritionalBenefitDetails),
      ],
      antenatalCardVerified: params.antenatalCardVerified,
    });

    logger.info(
      {
        customerId: params.customerId.slice(-4),
        claimId: response.data.claimId,
      },
      "1,000 Day Household claim submitted successfully"
    );

    return response;
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        customerId: params.customerId.slice(-4),
      },
      "Failed to submit 1,000 Day Household claim"
    );
    throw error;
  }
}
