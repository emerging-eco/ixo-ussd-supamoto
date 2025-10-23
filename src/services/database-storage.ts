import { databaseManager } from "./database-manager.js";
import { generateUniqueCustomerId } from "../utils/customer-id.js";
import { encryptPin } from "../utils/encryption.js";
import { createModuleLogger } from "./logger.js";

const logger = createModuleLogger("data");

// Type definitions for data records
export interface PhoneRecord {
  id: number;
  phoneNumber: string;
  firstSeen: Date;
  lastSeen: Date;
  numberOfVisits: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerData {
  fullName: string;
  email?: string;
  pin: string;
  preferredLanguage: string;
  lastCompletedAction: string;
}

export interface CustomerRecord {
  id: number;
  customerId: string;
  fullName: string;
  email?: string;
  encryptedPin: string | null; // Allow null when PIN is cleared
  preferredLanguage: string;
  lastCompletedAction: string;
  householdId?: number;
  role: "customer" | "lead_generator" | "call_center" | "admin"; // Role-based access control
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletData {
  did: string;
  address: string;
  encryptedMnemonic: string;
}

export interface WalletRecord {
  profileId: number;
  accountId: number;
  customerId?: number; // For individual wallets
  householdId?: number; // For household wallets
  did: string;
  address: string;
  isPrimary: boolean;
}

export interface MatrixVaultData {
  vaultId: string;
  encryptedData: string;
}

export interface MatrixVaultRecord {
  id: number;
  profileId: number;
  vaultId: string;
  encryptedData: string;
  createdAt: Date;
  updatedAt: Date;
}

// Customer Activation and Eligibility Types
export interface TempPinRecord {
  id: number;
  customerId: string;
  phoneNumber: string;
  tempPin: string;
  createdAt: Date;
  expiresAt: Date;
  used: boolean;
  usedAt?: Date;
}

export interface EligibilityRecord {
  id: number;
  customerId: string;
  phoneNumber: string;
  isEligible: boolean;
  verificationDate: Date;
  claimId?: string;
  claimStatus?: string;
  claimSubmittedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Bean Distribution Types
export interface LGDeliveryIntentRecord {
  id: number;
  customerId: string;
  lgCustomerId: string;
  intentRegisteredAt: Date;
  hasBeanVoucher: boolean;
  voucherStatus: string | null;
  voucherCheckResponse: any; // JSONB
  createdAt: Date;
}

export interface BeanDistributionOTPRecord {
  id: number;
  customerId: string;
  lgCustomerId: string;
  intentId: number | null;
  otp: string;
  generatedAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  isValid: boolean;
  createdAt: Date;
}

export interface BeanDeliveryConfirmationRecord {
  id: number;
  customerId: string;
  lgCustomerId: string;
  otpId: number | null;
  lgConfirmedAt: Date | null;
  customerConfirmedAt: Date | null;
  customerConfirmedReceipt: boolean | null;
  tokenTransferredAt: Date | null;
  confirmationDeadline: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface HouseholdClaimRecord {
  id: number;
  lgCustomerId: string; // Lead Generator who submitted the claim
  customerId: string; // Customer the claim is for
  is1000DayHousehold: boolean;
  claimSubmittedAt: Date;
  claimProcessedAt: Date | null;
  claimStatus: string | null;
  beanVoucherAllocated: boolean;
  claimsBotResponse: any; // JSONB
  createdAt: Date;
}

export interface AuditLogRecord {
  id: number;
  eventType: string;
  customerId: string | null;
  lgCustomerId: string | null;
  details: any; // JSONB
  createdAt: Date;
}

export interface DistributionOTPRecord {
  id: number;
  customerId: string;
  otpCode: string;
  createdAt: Date;
  expiresAt: Date;
  used: boolean;
  usedAt?: Date;
  verifiedBy?: string;
}

// Household Survey Response Types
export interface HouseholdSurveyResponseRecord {
  id: number;
  lgCustomerId: string; // Lead Generator's customer ID
  customerId: string; // Customer being surveyed
  beneficiaryCategory: string | null;
  childMaxAge: string | null;
  beanIntakeFrequency: string | null;
  priceSpecification: string | null;
  awarenessIronBeans: string | null;
  knowsNutritionalBenefits: string | null;
  nutritionalBenefitDetails: string | null;
  confirmActionAntenatalCardVerified: string | null;
  allFieldsCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface HouseholdSurveyResponseData {
  lgCustomerId: string; // Lead Generator's customer ID
  customerId: string; // Customer being surveyed
  beneficiaryCategory?: string;
  childMaxAge?: string;
  beanIntakeFrequency?: string;
  priceSpecification?: string;
  awarenessIronBeans?: string;
  knowsNutritionalBenefits?: string;
  nutritionalBenefitDetails?: string;
  confirmActionAntenatalCardVerified?: string;
}

/**
 * Data Service
 *
 * Handles the step-by-step data collection and storage for USSD users
 */
class DataService {
  /**
   * Step 1: Create or update phone record (independent)
   */
  async createOrUpdatePhoneRecord(phoneNumber: string): Promise<PhoneRecord> {
    const db = databaseManager.getKysely();

    logger.debug(
      { phoneNumber: phoneNumber.slice(-4) },
      "Creating or updating phone record"
    );

    try {
      // Try to find existing phone record
      const existingPhone = await db
        .selectFrom("phones")
        .selectAll()
        .where("phone_number", "=", phoneNumber)
        .executeTakeFirst();

      if (existingPhone) {
        // Update existing record
        const updatedPhone = await db
          .updateTable("phones")
          .set({
            last_seen: new Date(),
            number_of_visits: existingPhone.number_of_visits + 1,
            updated_at: new Date(),
          })
          .where("id", "=", existingPhone.id)
          .returningAll()
          .executeTakeFirstOrThrow();

        logger.info(
          {
            phoneId: updatedPhone.id,
            phoneNumber: phoneNumber.slice(-4),
            visits: updatedPhone.number_of_visits,
          },
          "Updated existing phone record"
        );

        return {
          id: updatedPhone.id!,
          phoneNumber: updatedPhone.phone_number,
          firstSeen: updatedPhone.first_seen,
          lastSeen: updatedPhone.last_seen,
          numberOfVisits: updatedPhone.number_of_visits,
          createdAt: updatedPhone.created_at,
          updatedAt: updatedPhone.updated_at,
        };
      } else {
        // Create new phone record
        const newPhone = await db
          .insertInto("phones")
          .values({
            phone_number: phoneNumber,
            first_seen: new Date(),
            last_seen: new Date(),
            number_of_visits: 1,
            created_at: new Date(),
            updated_at: new Date(),
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        logger.info(
          {
            phoneId: newPhone.id,
            phoneNumber: phoneNumber.slice(-4),
            visits: newPhone.number_of_visits,
          },
          "Created new phone record"
        );

        return {
          id: newPhone.id!,
          phoneNumber: newPhone.phone_number,
          firstSeen: newPhone.first_seen,
          lastSeen: newPhone.last_seen,
          numberOfVisits: newPhone.number_of_visits,
          createdAt: newPhone.created_at,
          updatedAt: newPhone.updated_at,
        };
      }
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          phoneNumber: phoneNumber.slice(-4),
        },
        "Failed to create or update phone record"
      );
      throw error;
    }
  }

  /**
   * Step 2: Create customer record (needs phone)
   */
  async createCustomerRecord(
    phoneId: number,
    customerData: CustomerData
  ): Promise<CustomerRecord> {
    const db = databaseManager.getKysely();

    logger.debug(
      {
        phoneId,
        fullName: customerData.fullName,
        hasEmail: !!customerData.email,
      },
      "Creating customer record"
    );

    try {
      return await db.transaction().execute(async trx => {
        // Generate unique customer ID
        const customerId = generateUniqueCustomerId();

        // Encrypt PIN
        const encryptedPin = encryptPin(customerData.pin);

        // Create customer record
        const customer = await trx
          .insertInto("customers")
          .values({
            customer_id: customerId,
            full_name: customerData.fullName,
            email: customerData.email || null,
            encrypted_pin: encryptedPin,
            preferred_language: customerData.preferredLanguage,
            date_added: new Date(),
            last_completed_action: customerData.lastCompletedAction,
            role: "customer", // Default role for new customers
            created_at: new Date(),
            updated_at: new Date(),
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        // Link customer to phone
        await trx
          .insertInto("customer_phones")
          .values({
            customer_id: customer.id!,
            phone_id: phoneId,
            is_primary: true,
            created_at: new Date(),
          })
          .execute();

        logger.info(
          {
            customerId: customer.customer_id,
            customerDbId: customer.id,
            phoneId,
            fullName: customer.full_name,
          },
          "Created customer record and linked to phone"
        );

        return {
          id: customer.id!,
          customerId: customer.customer_id,
          fullName: customer.full_name || "",
          email: customer.email || undefined,
          encryptedPin: customer.encrypted_pin,
          preferredLanguage: customer.preferred_language || "eng",
          lastCompletedAction: customer.last_completed_action || "",
          householdId: customer.household_id || undefined,
          role: customer.role || "customer",
          createdAt: customer.created_at,
          updatedAt: customer.updated_at,
        };
      });
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          phoneId,
          fullName: customerData.fullName,
        },
        "Failed to create customer record"
      );
      throw error;
    }
  }

  /**
   * Get customer by customer ID
   */
  async getCustomerByCustomerId(
    customerId: string
  ): Promise<CustomerRecord | null> {
    const db = databaseManager.getKysely();

    logger.debug(
      { customerId: customerId.slice(-4) },
      "Looking up customer by customer ID"
    );

    try {
      const result = await db
        .selectFrom("customers")
        .select([
          "customers.id",
          "customers.customer_id",
          "customers.full_name",
          "customers.email",
          "customers.encrypted_pin",
          "customers.preferred_language",
          "customers.last_completed_action",
          "customers.household_id",
          "customers.role",
          "customers.created_at",
          "customers.updated_at",
        ])
        .where("customers.customer_id", "=", customerId)
        .executeTakeFirst();

      if (!result) {
        logger.debug(
          { customerId: customerId.slice(-4) },
          "No customer found for customer ID"
        );
        return null;
      }

      logger.info(
        {
          customerId: result.customer_id,
          customerDbId: result.id,
          fullName: result.full_name,
          hasEncryptedPin: !!result.encrypted_pin,
        },
        "Found customer by customer ID"
      );

      return {
        id: result.id!,
        customerId: result.customer_id,
        fullName: result.full_name || "",
        email: result.email || undefined,
        encryptedPin: result.encrypted_pin,
        preferredLanguage: result.preferred_language || "eng",
        lastCompletedAction: result.last_completed_action || "",
        householdId: result.household_id || undefined,
        role: result.role || "customer",
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          customerId: customerId.slice(-4),
        },
        "Failed to get customer by customer ID"
      );
      throw error;
    }
  }

  /**
   * Clear customer PIN (used when max login attempts exceeded)
   */
  async clearCustomerPin(customerId: string): Promise<void> {
    const db = databaseManager.getKysely();

    logger.info(
      { customerId: customerId.slice(-4) },
      "Clearing customer PIN due to max attempts exceeded"
    );

    try {
      const result = await db
        .updateTable("customers")
        .set({
          encrypted_pin: null,
          updated_at: new Date(),
        })
        .where("customer_id", "=", customerId)
        .executeTakeFirst();

      if (result.numUpdatedRows === 0n) {
        throw new Error(`Customer not found: ${customerId}`);
      }

      logger.info(
        { customerId: customerId.slice(-4) },
        "Successfully cleared customer PIN"
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          customerId: customerId.slice(-4),
        },
        "Failed to clear customer PIN"
      );
      throw error;
    }
  }

  /**
   * Get customer by phone number
   */
  async getCustomerByPhone(
    phoneNumber: string
  ): Promise<CustomerRecord | null> {
    const db = databaseManager.getKysely();

    logger.debug(
      { phoneNumber: phoneNumber.slice(-4) },
      "Looking up customer by phone number"
    );

    try {
      const result = await db
        .selectFrom("phones")
        .innerJoin("customer_phones", "phones.id", "customer_phones.phone_id")
        .innerJoin("customers", "customer_phones.customer_id", "customers.id")
        .select([
          "customers.id",
          "customers.customer_id",
          "customers.full_name",
          "customers.email",
          "customers.encrypted_pin",
          "customers.preferred_language",
          "customers.last_completed_action",
          "customers.household_id",
          "customers.role",
          "customers.created_at",
          "customers.updated_at",
        ])
        .where("phones.phone_number", "=", phoneNumber)
        .where("customer_phones.is_primary", "=", true)
        .executeTakeFirst();

      if (!result) {
        logger.debug(
          { phoneNumber: phoneNumber.slice(-4) },
          "No customer found for phone number"
        );
        return null;
      }

      logger.debug(
        {
          customerId: result.customer_id,
          phoneNumber: phoneNumber.slice(-4),
        },
        "Found customer by phone number"
      );

      return {
        id: result.id!,
        customerId: result.customer_id,
        fullName: result.full_name || "",
        email: result.email || undefined,
        encryptedPin: result.encrypted_pin,
        preferredLanguage: result.preferred_language || "eng",
        lastCompletedAction: result.last_completed_action || "",
        householdId: result.household_id || undefined,
        role: result.role || "customer",
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          phoneNumber: phoneNumber.slice(-4),
        },
        "Failed to get customer by phone number"
      );
      throw error;
    }
  }

  /**
   * Step 3a: Create individual wallet (IXO Profile + Account) - directly linked to customer
   */
  async createIndividualWallet(
    customerId: number,
    walletData: WalletData
  ): Promise<WalletRecord> {
    return this.createWalletRecord(customerId, walletData, {
      createHousehold: false,
    });
  }

  /**
   * Step 3b: Create household wallet (IXO Profile + Account) - shared via household
   */
  async createHouseholdWallet(
    customerId: number,
    walletData: WalletData
  ): Promise<WalletRecord> {
    return this.createWalletRecord(customerId, walletData, {
      createHousehold: true,
    });
  }

  /**
   * Step 3: Create wallet (IXO Profile + Account) - individual or household-based
   */
  async createWalletRecord(
    customerId: number,
    walletData: WalletData,
    options: { createHousehold?: boolean } = {}
  ): Promise<WalletRecord> {
    const db = databaseManager.getKysely();

    logger.debug(
      {
        customerId,
        did: walletData.did,
        address: walletData.address,
        createHousehold: options.createHousehold,
      },
      "Creating wallet record (IXO Profile + Account)"
    );

    try {
      return await db.transaction().execute(async trx => {
        let householdId: number | undefined;

        // Create household if requested (for shared wallets)
        if (options.createHousehold) {
          const household = await trx
            .insertInto("households")
            .values({
              created_at: new Date(),
              updated_at: new Date(),
            })
            .returningAll()
            .executeTakeFirstOrThrow();

          householdId = household.id!;

          // Update customer with household ID
          await trx
            .updateTable("customers")
            .set({
              household_id: householdId,
              updated_at: new Date(),
            })
            .where("id", "=", customerId)
            .execute();
        }

        // Create IXO Profile (individual or household-based)
        const ixoProfile = await trx
          .insertInto("ixo_profiles")
          .values({
            customer_id: options.createHousehold ? null : customerId,
            household_id: householdId || null,
            did: walletData.did,
            created_at: new Date(),
            updated_at: new Date(),
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        // Create IXO Account
        const ixoAccount = await trx
          .insertInto("ixo_accounts")
          .values({
            ixo_profile_id: ixoProfile.id!,
            address: walletData.address,
            encrypted_mnemonic: walletData.encryptedMnemonic,
            is_primary: true,
            created_at: new Date(),
            updated_at: new Date(),
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        const walletType = options.createHousehold ? "household" : "individual";

        logger.info(
          {
            customerId,
            householdId,
            profileId: ixoProfile.id,
            accountId: ixoAccount.id,
            did: walletData.did,
            address: walletData.address,
            walletType,
          },
          `Created ${walletType} wallet record (profile + account)`
        );

        return {
          profileId: ixoProfile.id!,
          accountId: ixoAccount.id!,
          customerId: options.createHousehold ? undefined : customerId,
          householdId,
          did: ixoProfile.did,
          address: ixoAccount.address,
          isPrimary: ixoAccount.is_primary || false,
        };
      });
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          customerId,
          did: walletData.did,
        },
        "Failed to create wallet record"
      );
      throw error;
    }
  }

  /**
   * Customer Activation and Eligibility Methods
   */

  /**
   * Reset customer PIN during activation
   * Encrypts the temporary PIN and stores it in customers.encrypted_pin
   * Creates audit log entry for compliance and security tracking
   */
  async resetCustomerPin(
    customerId: string,
    tempPin: string,
    lgCustomerId?: string
  ): Promise<void> {
    const db = databaseManager.getKysely();

    logger.info(
      {
        customerId: customerId.slice(-4),
        lgCustomerId: lgCustomerId?.slice(-4),
      },
      "🔐 Resetting customer PIN during activation"
    );

    try {
      return await db.transaction().execute(async trx => {
        // Import encryptPin here to avoid circular dependency
        const { encryptPin } = await import("../utils/encryption.js");

        // Encrypt the temporary PIN
        const encryptedPin = encryptPin(tempPin);
        logger.info(
          { customerId: customerId.slice(-4) },
          "📝 Encrypted temporary PIN"
        );

        // Update customer's encrypted_pin with the temporary PIN
        // First verify customer exists
        const customer = await trx
          .selectFrom("customers")
          .select("id")
          .where("customer_id", "=", customerId)
          .executeTakeFirst();

        if (!customer) {
          throw new Error(`Customer not found: ${customerId}`);
        }

        // Update the PIN
        await trx
          .updateTable("customers")
          .set({
            encrypted_pin: encryptedPin,
            updated_at: new Date(),
          })
          .where("customer_id", "=", customerId)
          .execute();

        logger.info(
          { customerId: customerId.slice(-4) },
          "✅ Temporary PIN stored in customers.encrypted_pin"
        );

        // Create audit log entry for PIN reset
        await trx
          .insertInto("audit_log")
          .values({
            event_type: "PIN_RESET",
            customer_id: customerId,
            lg_customer_id: lgCustomerId || null,
            details: JSON.stringify({
              action: "CUSTOMER_ACTIVATED",
              timestamp: new Date().toISOString(),
              pinType: "temporary",
              expiresIn: "30 minutes (until customer logs in and changes PIN)",
            }),
            created_at: new Date(),
          })
          .execute();

        logger.info(
          {
            customerId: customerId.slice(-4),
            lgCustomerId: lgCustomerId?.slice(-4),
          },
          "📋 Audit log entry created for PIN_RESET"
        );
      });
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          customerId: customerId.slice(-4),
          lgCustomerId: lgCustomerId?.slice(-4),
        },
        "❌ Failed to reset customer PIN"
      );
      throw error;
    }
  }

  /**
   * Temporary PIN verification is now handled by the login machine
   * which uses the standard PIN verification logic:
   * - Encrypts the input PIN using encryptPin()
   * - Compares it to customers.encrypted_pin
   * - No need for separate temp_pins table or verification logic
   */

  /**
   * Record eligibility verification (for audit trail)
   * Stores both Yes and No responses
   */
  async recordEligibility(
    customerId: string,
    phoneNumber: string,
    isEligible: boolean,
    notes?: string
  ): Promise<EligibilityRecord> {
    const db = databaseManager.getKysely();

    logger.info(
      {
        customerId: customerId.slice(-4),
        phoneNumber: phoneNumber.slice(-4),
        isEligible,
      },
      "Recording eligibility verification"
    );

    try {
      const result = await db
        .insertInto("eligibility_verifications")
        .values({
          customer_id: customerId,
          phone_number: phoneNumber,
          is_eligible: isEligible,
          verification_date: new Date(),
          notes: notes || null,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      logger.info(
        { customerId: customerId.slice(-4), recordId: result.id },
        "Eligibility verification recorded"
      );

      return {
        id: result.id!,
        customerId: result.customer_id,
        phoneNumber: result.phone_number,
        isEligible: result.is_eligible,
        verificationDate: result.verification_date,
        claimId: result.claim_id || undefined,
        claimStatus: result.claim_status || undefined,
        claimSubmittedAt: result.claim_submitted_at || undefined,
        notes: result.notes || undefined,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          customerId: customerId.slice(-4),
        },
        "Failed to record eligibility verification"
      );
      throw error;
    }
  }

  /**
   * Update eligibility record with claim information
   */
  async updateEligibilityWithClaim(
    eligibilityId: number,
    claimId: string,
    claimStatus: string
  ): Promise<void> {
    const db = databaseManager.getKysely();

    logger.info(
      { eligibilityId, claimId, claimStatus },
      "Updating eligibility record with claim information"
    );

    try {
      await db
        .updateTable("eligibility_verifications")
        .set({
          claim_id: claimId,
          claim_status: claimStatus,
          claim_submitted_at: new Date(),
          updated_at: new Date(),
        })
        .where("id", "=", eligibilityId)
        .execute();

      logger.info({ eligibilityId, claimId }, "Eligibility record updated");
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          eligibilityId,
        },
        "Failed to update eligibility record"
      );
      throw error;
    }
  }

  /**
   * Generate and store OTP for bean distribution
   */
  async generateDistributionOTP(customerId: string): Promise<string> {
    const db = databaseManager.getKysely();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    logger.info(
      { customerId: customerId.slice(-4) },
      "Generating distribution OTP"
    );

    try {
      await db
        .insertInto("distribution_otps")
        .values({
          customer_id: customerId,
          otp_code: otp,
          expires_at: expiresAt,
          created_at: new Date(),
          used: false,
        })
        .execute();

      logger.info(
        { customerId: customerId.slice(-4), expiresAt },
        "Distribution OTP generated"
      );

      return otp;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          customerId: customerId.slice(-4),
        },
        "Failed to generate distribution OTP"
      );
      throw error;
    }
  }

  /**
   * Verify distribution OTP
   * Returns true if OTP is valid and not expired
   */
  async verifyDistributionOTP(
    customerId: string,
    otp: string,
    verifiedBy?: string
  ): Promise<boolean> {
    const db = databaseManager.getKysely();

    logger.debug(
      { customerId: customerId.slice(-4) },
      "Verifying distribution OTP"
    );

    try {
      const record = await db
        .selectFrom("distribution_otps")
        .selectAll()
        .where("customer_id", "=", customerId)
        .where("otp_code", "=", otp)
        .where("used", "=", false)
        .where("expires_at", ">", new Date())
        .executeTakeFirst();

      if (!record) {
        logger.warn(
          { customerId: customerId.slice(-4) },
          "Distribution OTP verification failed - invalid or expired"
        );
        return false;
      }

      // Mark as used
      await db
        .updateTable("distribution_otps")
        .set({
          used: true,
          used_at: new Date(),
          verified_by: verifiedBy || null,
        })
        .where("id", "=", record.id)
        .execute();

      logger.info(
        { customerId: customerId.slice(-4) },
        "Distribution OTP verified successfully"
      );

      return true;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          customerId: customerId.slice(-4),
        },
        "Failed to verify distribution OTP"
      );
      throw error;
    }
  }

  /**
   * Update customer PIN
   */
  async updateCustomerPin(
    customerId: string,
    encryptedPin: string
  ): Promise<void> {
    const db = databaseManager.getKysely();

    logger.info({ customerId: customerId.slice(-4) }, "Updating customer PIN");

    try {
      await db
        .updateTable("customers")
        .set({
          encrypted_pin: encryptedPin,
          updated_at: new Date(),
        })
        .where("customer_id", "=", customerId)
        .execute();

      logger.info(
        { customerId: customerId.slice(-4) },
        "Customer PIN updated successfully"
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          customerId: customerId.slice(-4),
        },
        "Failed to update customer PIN"
      );
      throw error;
    }
  }

  /**
   * Assign an agent role to a customer
   * Used by administrators to grant agent permissions
   */
  async assignAgentRole(
    customerId: string,
    role: "lead_generator" | "call_center" | "admin",
    assignedBy: string
  ): Promise<void> {
    const db = databaseManager.getKysely();

    logger.info(
      {
        customerId: customerId.slice(-4),
        newRole: role,
        assignedBy: assignedBy.slice(-4),
      },
      "Assigning agent role to customer"
    );

    try {
      await db
        .updateTable("customers")
        .set({
          role: role,
          updated_at: new Date(),
        })
        .where("customer_id", "=", customerId)
        .execute();

      logger.info(
        {
          customerId: customerId.slice(-4),
          newRole: role,
          assignedBy: assignedBy.slice(-4),
        },
        "Agent role assigned successfully"
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          customerId: customerId.slice(-4),
          role: role,
        },
        "Failed to assign agent role"
      );
      throw error;
    }
  }

  /**
   * Create LG delivery intent record
   */
  async createLGIntent(
    customerId: string,
    lgCustomerId: string,
    hasBeanVoucher: boolean,
    voucherStatus: string,
    voucherCheckResponse: any
  ): Promise<LGDeliveryIntentRecord> {
    const db = databaseManager.getKysely();

    logger.info(
      {
        customerId: customerId.slice(-4),
        lgCustomerId: lgCustomerId.slice(-4),
        hasBeanVoucher,
      },
      "Creating LG delivery intent"
    );

    try {
      const result = await db
        .insertInto("lg_delivery_intents")
        .values({
          customer_id: customerId,
          lg_customer_id: lgCustomerId,
          intent_registered_at: new Date(),
          has_bean_voucher: hasBeanVoucher,
          voucher_status: voucherStatus,
          voucher_check_response: JSON.stringify(voucherCheckResponse),
          created_at: new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return {
        id: result.id!,
        customerId: result.customer_id,
        lgCustomerId: result.lg_customer_id,
        intentRegisteredAt: result.intent_registered_at,
        hasBeanVoucher: result.has_bean_voucher,
        voucherStatus: result.voucher_status,
        voucherCheckResponse: result.voucher_check_response,
        createdAt: result.created_at,
      };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          customerId: customerId.slice(-4),
        },
        "Failed to create LG delivery intent"
      );
      throw error;
    }
  }

  /**
   * Create OTP for bean distribution
   */
  async createOTP(
    customerId: string,
    lgCustomerId: string,
    intentId: number,
    otp: string,
    validityMinutes: number
  ): Promise<BeanDistributionOTPRecord> {
    const db = databaseManager.getKysely();

    const now = new Date();
    const expiresAt = new Date(now.getTime() + validityMinutes * 60 * 1000);

    logger.info(
      {
        customerId: customerId.slice(-4),
        lgCustomerId: lgCustomerId.slice(-4),
        validityMinutes,
      },
      "Creating bean distribution OTP"
    );

    try {
      const result = await db
        .insertInto("bean_distribution_otps")
        .values({
          customer_id: customerId,
          lg_customer_id: lgCustomerId,
          intent_id: intentId,
          otp: otp,
          generated_at: now,
          expires_at: expiresAt,
          used_at: null,
          is_valid: true,
          created_at: now,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return {
        id: result.id!,
        customerId: result.customer_id,
        lgCustomerId: result.lg_customer_id,
        intentId: result.intent_id,
        otp: result.otp,
        generatedAt: result.generated_at,
        expiresAt: result.expires_at,
        usedAt: result.used_at,
        isValid: result.is_valid,
        createdAt: result.created_at,
      };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          customerId: customerId.slice(-4),
        },
        "Failed to create OTP"
      );
      throw error;
    }
  }

  /**
   * Validate OTP for bean distribution
   */
  async validateOTP(
    customerId: string,
    otp: string
  ): Promise<BeanDistributionOTPRecord | null> {
    const db = databaseManager.getKysely();

    logger.info(
      { customerId: customerId.slice(-4) },
      "Validating bean distribution OTP"
    );

    try {
      const result = await db
        .selectFrom("bean_distribution_otps")
        .selectAll()
        .where("customer_id", "=", customerId)
        .where("otp", "=", otp)
        .where("is_valid", "=", true)
        .where("used_at", "is", null)
        .executeTakeFirst();

      if (!result) {
        logger.warn(
          { customerId: customerId.slice(-4) },
          "OTP not found or already used"
        );
        return null;
      }

      // Check if expired
      const now = new Date();
      if (now > result.expires_at) {
        logger.warn({ customerId: customerId.slice(-4) }, "OTP has expired");
        // Mark as invalid
        await db
          .updateTable("bean_distribution_otps")
          .set({ is_valid: false })
          .where("id", "=", result.id!)
          .execute();
        return null;
      }

      return {
        id: result.id!,
        customerId: result.customer_id,
        lgCustomerId: result.lg_customer_id,
        intentId: result.intent_id,
        otp: result.otp,
        generatedAt: result.generated_at,
        expiresAt: result.expires_at,
        usedAt: result.used_at,
        isValid: result.is_valid,
        createdAt: result.created_at,
      };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          customerId: customerId.slice(-4),
        },
        "Failed to validate OTP"
      );
      throw error;
    }
  }

  /**
   * Mark OTP as used
   */
  async markOTPAsUsed(otpId: number): Promise<void> {
    const db = databaseManager.getKysely();

    logger.info({ otpId }, "Marking OTP as used");

    try {
      await db
        .updateTable("bean_distribution_otps")
        .set({
          used_at: new Date(),
          is_valid: false,
        })
        .where("id", "=", otpId)
        .execute();

      logger.info({ otpId }, "OTP marked as used");
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          otpId,
        },
        "Failed to mark OTP as used"
      );
      throw error;
    }
  }

  /**
   * Create delivery confirmation record
   */
  async createDeliveryConfirmation(
    customerId: string,
    lgCustomerId: string,
    otpId: number,
    deadlineDays: number
  ): Promise<BeanDeliveryConfirmationRecord> {
    const db = databaseManager.getKysely();

    const now = new Date();
    const deadline = new Date(
      now.getTime() + deadlineDays * 24 * 60 * 60 * 1000
    );

    logger.info(
      {
        customerId: customerId.slice(-4),
        lgCustomerId: lgCustomerId.slice(-4),
        deadlineDays,
      },
      "Creating delivery confirmation record"
    );

    try {
      const result = await db
        .insertInto("bean_delivery_confirmations")
        .values({
          customer_id: customerId,
          lg_customer_id: lgCustomerId,
          otp_id: otpId,
          lg_confirmed_at: null,
          customer_confirmed_at: null,
          customer_confirmed_receipt: null,
          token_transferred_at: null,
          confirmation_deadline: deadline,
          created_at: now,
          updated_at: now,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return {
        id: result.id!,
        customerId: result.customer_id,
        lgCustomerId: result.lg_customer_id,
        otpId: result.otp_id,
        lgConfirmedAt: result.lg_confirmed_at,
        customerConfirmedAt: result.customer_confirmed_at,
        customerConfirmedReceipt: result.customer_confirmed_receipt,
        tokenTransferredAt: result.token_transferred_at,
        confirmationDeadline: result.confirmation_deadline,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          customerId: customerId.slice(-4),
        },
        "Failed to create delivery confirmation"
      );
      throw error;
    }
  }

  /**
   * Update delivery confirmation
   */
  async updateDeliveryConfirmation(
    confirmationId: number,
    updates: {
      lgConfirmedAt?: Date;
      customerConfirmedAt?: Date;
      customerConfirmedReceipt?: boolean;
      tokenTransferredAt?: Date;
    }
  ): Promise<void> {
    const db = databaseManager.getKysely();

    logger.info({ confirmationId, updates }, "Updating delivery confirmation");

    try {
      const updateData: any = {
        updated_at: new Date(),
      };

      if (updates.lgConfirmedAt !== undefined) {
        updateData.lg_confirmed_at = updates.lgConfirmedAt;
      }
      if (updates.customerConfirmedAt !== undefined) {
        updateData.customer_confirmed_at = updates.customerConfirmedAt;
      }
      if (updates.customerConfirmedReceipt !== undefined) {
        updateData.customer_confirmed_receipt =
          updates.customerConfirmedReceipt;
      }
      if (updates.tokenTransferredAt !== undefined) {
        updateData.token_transferred_at = updates.tokenTransferredAt;
      }

      await db
        .updateTable("bean_delivery_confirmations")
        .set(updateData)
        .where("id", "=", confirmationId)
        .execute();

      logger.info({ confirmationId }, "Delivery confirmation updated");
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          confirmationId,
        },
        "Failed to update delivery confirmation"
      );
      throw error;
    }
  }

  /**
   * Get delivery confirmation by customer and LG
   */
  async getDeliveryConfirmation(
    customerId: string,
    lgCustomerId: string
  ): Promise<BeanDeliveryConfirmationRecord | null> {
    const db = databaseManager.getKysely();

    logger.info(
      {
        customerId: customerId.slice(-4),
        lgCustomerId: lgCustomerId.slice(-4),
      },
      "Getting delivery confirmation"
    );

    try {
      const result = await db
        .selectFrom("bean_delivery_confirmations")
        .selectAll()
        .where("customer_id", "=", customerId)
        .where("lg_customer_id", "=", lgCustomerId)
        .orderBy("created_at", "desc")
        .executeTakeFirst();

      if (!result) {
        return null;
      }

      return {
        id: result.id!,
        customerId: result.customer_id,
        lgCustomerId: result.lg_customer_id,
        otpId: result.otp_id,
        lgConfirmedAt: result.lg_confirmed_at,
        customerConfirmedAt: result.customer_confirmed_at,
        customerConfirmedReceipt: result.customer_confirmed_receipt,
        tokenTransferredAt: result.token_transferred_at,
        confirmationDeadline: result.confirmation_deadline,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          customerId: customerId.slice(-4),
        },
        "Failed to get delivery confirmation"
      );
      throw error;
    }
  }

  /**
   * Create household claim (submitted by Lead Generator)
   */
  async createHouseholdClaim(
    lgCustomerId: string,
    customerId: string,
    is1000DayHousehold: boolean
  ): Promise<HouseholdClaimRecord> {
    const db = databaseManager.getKysely();

    logger.info(
      {
        lgCustomerId: lgCustomerId.slice(-4),
        customerId: customerId.slice(-4),
        is1000DayHousehold,
      },
      "Creating household claim (submitted by LG)"
    );

    try {
      const result = await db
        .insertInto("household_claims")
        .values({
          lg_customer_id: lgCustomerId,
          customer_id: customerId,
          is_1000_day_household: is1000DayHousehold,
          claim_submitted_at: new Date(),
          claim_processed_at: null,
          claim_status: "PENDING",
          bean_voucher_allocated: false,
          claims_bot_response: null,
          created_at: new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return {
        id: result.id!,
        lgCustomerId: result.lg_customer_id,
        customerId: result.customer_id,
        is1000DayHousehold: result.is_1000_day_household,
        claimSubmittedAt: result.claim_submitted_at,
        claimProcessedAt: result.claim_processed_at,
        claimStatus: result.claim_status,
        beanVoucherAllocated: result.bean_voucher_allocated,
        claimsBotResponse: result.claims_bot_response,
        createdAt: result.created_at,
      };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          customerId: customerId.slice(-4),
        },
        "Failed to create household claim"
      );
      throw error;
    }
  }

  /**
   * Update household claim
   */
  async updateHouseholdClaim(
    claimId: number,
    updates: {
      claimProcessedAt?: Date;
      claimStatus?: string;
      beanVoucherAllocated?: boolean;
      claimsBotResponse?: any;
    }
  ): Promise<void> {
    const db = databaseManager.getKysely();

    logger.info({ claimId, updates }, "Updating household claim");

    try {
      const updateData: any = {};

      if (updates.claimProcessedAt !== undefined) {
        updateData.claim_processed_at = updates.claimProcessedAt;
      }
      if (updates.claimStatus !== undefined) {
        updateData.claim_status = updates.claimStatus;
      }
      if (updates.beanVoucherAllocated !== undefined) {
        updateData.bean_voucher_allocated = updates.beanVoucherAllocated;
      }
      if (updates.claimsBotResponse !== undefined) {
        updateData.claims_bot_response = JSON.stringify(
          updates.claimsBotResponse
        );
      }

      await db
        .updateTable("household_claims")
        .set(updateData)
        .where("id", "=", claimId)
        .execute();

      logger.info({ claimId }, "Household claim updated");
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          claimId,
        },
        "Failed to update household claim"
      );
      throw error;
    }
  }

  /**
   * Create audit log entry
   */
  async createAuditLog(params: {
    eventType: string;
    customerId?: string;
    lgCustomerId?: string;
    details: any;
  }): Promise<AuditLogRecord> {
    const db = databaseManager.getKysely();

    logger.info(
      {
        eventType: params.eventType,
        customerId: params.customerId?.slice(-4),
        lgCustomerId: params.lgCustomerId?.slice(-4),
      },
      "Creating audit log entry"
    );

    try {
      const result = await db
        .insertInto("audit_log")
        .values({
          event_type: params.eventType,
          customer_id: params.customerId || null,
          lg_customer_id: params.lgCustomerId || null,
          details: JSON.stringify(params.details),
          created_at: new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return {
        id: result.id!,
        eventType: result.event_type,
        customerId: result.customer_id,
        lgCustomerId: result.lg_customer_id,
        details: result.details,
        createdAt: result.created_at,
      };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          eventType: params.eventType,
        },
        "Failed to create audit log entry"
      );
      throw error;
    }
  }

  /**
   * Check if confirmation is within deadline
   */
  async checkConfirmationDeadline(confirmationId: number): Promise<boolean> {
    const db = databaseManager.getKysely();

    logger.info({ confirmationId }, "Checking confirmation deadline");

    try {
      const result = await db
        .selectFrom("bean_delivery_confirmations")
        .select(["confirmation_deadline"])
        .where("id", "=", confirmationId)
        .executeTakeFirst();

      if (!result) {
        logger.warn({ confirmationId }, "Confirmation not found");
        return false;
      }

      const now = new Date();
      const isWithinDeadline = now <= result.confirmation_deadline;

      logger.info(
        { confirmationId, isWithinDeadline },
        "Confirmation deadline checked"
      );

      return isWithinDeadline;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          confirmationId,
        },
        "Failed to check confirmation deadline"
      );
      throw error;
    }
  }

  /**
   * Create or update household survey response
   */
  async createOrUpdateSurveyResponse(
    data: HouseholdSurveyResponseData
  ): Promise<HouseholdSurveyResponseRecord> {
    const db = databaseManager.getKysely();
    const { encrypt } = await import("../utils/encryption.js");
    const { config } = await import("../config.js");
    const encryptionKey = config.SYSTEM.ENCRYPTION_KEY;

    logger.info(
      {
        lgCustomerId: data.lgCustomerId.slice(-4),
        customerId: data.customerId.slice(-4),
      },
      "Creating or updating household survey response"
    );

    try {
      // Encrypt all survey fields
      const encryptedData = {
        beneficiary_category: data.beneficiaryCategory
          ? encrypt(data.beneficiaryCategory, encryptionKey)
          : null,
        child_max_age: data.childMaxAge
          ? encrypt(data.childMaxAge, encryptionKey)
          : null,
        bean_intake_frequency: data.beanIntakeFrequency
          ? encrypt(data.beanIntakeFrequency, encryptionKey)
          : null,
        price_specification: data.priceSpecification
          ? encrypt(data.priceSpecification, encryptionKey)
          : null,
        awareness_iron_beans: data.awarenessIronBeans
          ? encrypt(data.awarenessIronBeans, encryptionKey)
          : null,
        knows_nutritional_benefits: data.knowsNutritionalBenefits
          ? encrypt(data.knowsNutritionalBenefits, encryptionKey)
          : null,
        nutritional_benefit_details: data.nutritionalBenefitDetails
          ? encrypt(data.nutritionalBenefitDetails, encryptionKey)
          : null,
        confirm_action_antenatal_card_verified:
          data.confirmActionAntenatalCardVerified
            ? encrypt(data.confirmActionAntenatalCardVerified, encryptionKey)
            : null,
      };

      // Try to find existing response for this LG-Customer pair
      const existing = await db
        .selectFrom("household_survey_responses")
        .selectAll()
        .where("lg_customer_id", "=", data.lgCustomerId)
        .where("customer_id", "=", data.customerId)
        .orderBy("created_at", "desc")
        .executeTakeFirst();

      if (existing) {
        // Update existing record
        const result = await db
          .updateTable("household_survey_responses")
          .set({
            ...encryptedData,
            updated_at: new Date(),
          })
          .where("id", "=", existing.id)
          .returningAll()
          .executeTakeFirstOrThrow();

        return this.mapSurveyResponseRecord(result);
      } else {
        // Create new record
        const result = await db
          .insertInto("household_survey_responses")
          .values({
            lg_customer_id: data.lgCustomerId,
            customer_id: data.customerId,
            ...encryptedData,
            all_fields_completed: false,
            created_at: new Date(),
            updated_at: new Date(),
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        return this.mapSurveyResponseRecord(result);
      }
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          customerId: data.customerId.slice(-4),
        },
        "Failed to create or update survey response"
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
  ): Promise<HouseholdSurveyResponseRecord> {
    const db = databaseManager.getKysely();

    logger.info(
      {
        lgCustomerId: lgCustomerId.slice(-4),
        customerId: customerId.slice(-4),
      },
      "Marking survey as complete"
    );

    try {
      // First, find the most recent record ID
      const recordToUpdate = await db
        .selectFrom("household_survey_responses")
        .select("id")
        .where("lg_customer_id", "=", lgCustomerId)
        .where("customer_id", "=", customerId)
        .orderBy("created_at", "desc")
        .limit(1)
        .executeTakeFirstOrThrow();

      // Then update that specific record
      const result = await db
        .updateTable("household_survey_responses")
        .set({
          all_fields_completed: true,
          updated_at: new Date(),
        })
        .where("id", "=", recordToUpdate.id)
        .returningAll()
        .executeTakeFirstOrThrow();

      return this.mapSurveyResponseRecord(result);
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
   * Get latest survey response for LG-Customer pair
   */
  async getSurveyResponse(
    lgCustomerId: string,
    customerId: string
  ): Promise<HouseholdSurveyResponseRecord | null> {
    const db = databaseManager.getKysely();
    const { decrypt } = await import("../utils/encryption.js");
    const { config } = await import("../config.js");
    const encryptionKey = config.SYSTEM.ENCRYPTION_KEY;

    logger.debug(
      {
        lgCustomerId: lgCustomerId.slice(-4),
        customerId: customerId.slice(-4),
      },
      "Fetching survey response"
    );

    try {
      const result = await db
        .selectFrom("household_survey_responses")
        .selectAll()
        .where("lg_customer_id", "=", lgCustomerId)
        .where("customer_id", "=", customerId)
        .orderBy("created_at", "desc")
        .executeTakeFirst();

      if (!result) {
        return null;
      }

      // Decrypt all fields
      return {
        id: result.id!,
        lgCustomerId: result.lg_customer_id,
        customerId: result.customer_id,
        beneficiaryCategory: result.beneficiary_category
          ? decrypt(result.beneficiary_category, encryptionKey)
          : null,
        childMaxAge: result.child_max_age
          ? decrypt(result.child_max_age, encryptionKey)
          : null,
        beanIntakeFrequency: result.bean_intake_frequency
          ? decrypt(result.bean_intake_frequency, encryptionKey)
          : null,
        priceSpecification: result.price_specification
          ? decrypt(result.price_specification, encryptionKey)
          : null,
        awarenessIronBeans: result.awareness_iron_beans
          ? decrypt(result.awareness_iron_beans, encryptionKey)
          : null,
        knowsNutritionalBenefits: result.knows_nutritional_benefits
          ? decrypt(result.knows_nutritional_benefits, encryptionKey)
          : null,
        nutritionalBenefitDetails: result.nutritional_benefit_details
          ? decrypt(result.nutritional_benefit_details, encryptionKey)
          : null,
        confirmActionAntenatalCardVerified:
          result.confirm_action_antenatal_card_verified
            ? decrypt(
                result.confirm_action_antenatal_card_verified,
                encryptionKey
              )
            : null,
        allFieldsCompleted: result.all_fields_completed,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          customerId: customerId.slice(-4),
        },
        "Failed to fetch survey response"
      );
      throw error;
    }
  }

  /**
   * Helper to map database record to typed record
   */
  private mapSurveyResponseRecord(
    dbRecord: any
  ): HouseholdSurveyResponseRecord {
    return {
      id: dbRecord.id!,
      lgCustomerId: dbRecord.lg_customer_id,
      customerId: dbRecord.customer_id,
      beneficiaryCategory: dbRecord.beneficiary_category,
      childMaxAge: dbRecord.child_max_age,
      beanIntakeFrequency: dbRecord.bean_intake_frequency,
      priceSpecification: dbRecord.price_specification,
      awarenessIronBeans: dbRecord.awareness_iron_beans,
      knowsNutritionalBenefits: dbRecord.knows_nutritional_benefits,
      nutritionalBenefitDetails: dbRecord.nutritional_benefit_details,
      confirmActionAntenatalCardVerified:
        dbRecord.confirm_action_antenatal_card_verified,
      allFieldsCompleted: dbRecord.all_fields_completed,
      createdAt: dbRecord.created_at,
      updatedAt: dbRecord.updated_at,
    };
  }
}

// Export singleton instance
export const dataService = new DataService();
