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
   * Store temporary PIN for customer activation
   * Uses upsert pattern to handle retries
   */
  async setTempPin(
    customerId: string,
    phoneNumber: string,
    tempPin: string
  ): Promise<void> {
    const db = databaseManager.getKysely();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    logger.info(
      { customerId: customerId.slice(-4), phoneNumber: phoneNumber.slice(-4) },
      "Setting temporary PIN for customer activation"
    );

    try {
      await db
        .insertInto("temp_pins")
        .values({
          customer_id: customerId,
          phone_number: phoneNumber,
          temp_pin: tempPin,
          expires_at: expiresAt,
          created_at: new Date(),
          used: false,
        })
        .onConflict(oc =>
          oc.columns(["customer_id", "phone_number"]).doUpdateSet({
            temp_pin: tempPin,
            expires_at: expiresAt,
            used: false,
            created_at: new Date(),
          })
        )
        .execute();

      logger.info(
        { customerId: customerId.slice(-4), expiresAt },
        "Temporary PIN set successfully"
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          customerId: customerId.slice(-4),
        },
        "Failed to set temporary PIN"
      );
      throw error;
    }
  }

  /**
   * Verify and consume temporary PIN
   * Returns true if PIN is valid and not expired
   */
  async verifyTempPin(
    customerId: string,
    phoneNumber: string,
    pin: string
  ): Promise<boolean> {
    const db = databaseManager.getKysely();

    logger.debug(
      { customerId: customerId.slice(-4), phoneNumber: phoneNumber.slice(-4) },
      "Verifying temporary PIN"
    );

    try {
      const record = await db
        .selectFrom("temp_pins")
        .selectAll()
        .where("customer_id", "=", customerId)
        .where("phone_number", "=", phoneNumber)
        .where("temp_pin", "=", pin)
        .where("used", "=", false)
        .where("expires_at", ">", new Date())
        .executeTakeFirst();

      if (!record) {
        logger.warn(
          { customerId: customerId.slice(-4) },
          "Temporary PIN verification failed - invalid or expired"
        );
        return false;
      }

      // Mark as used
      await db
        .updateTable("temp_pins")
        .set({ used: true, used_at: new Date() })
        .where("id", "=", record.id)
        .execute();

      logger.info(
        { customerId: customerId.slice(-4) },
        "Temporary PIN verified successfully"
      );

      return true;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          customerId: customerId.slice(-4),
        },
        "Failed to verify temporary PIN"
      );
      throw error;
    }
  }

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
}

// Export singleton instance
export const dataService = new DataService();
