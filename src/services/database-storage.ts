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
  nationalId?: string;
  pin: string;
  preferredLanguage: string;
  lastCompletedAction: string;
}

export interface CustomerRecord {
  id: number;
  customerId: string;
  claimsBotCustomerId?: string; // SDK-compatible ID (C + 8 hex chars) for Claims Bot integration
  fullName: string;
  email?: string;
  nationalId?: string;
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
  claimId: string | null;
  claimTxHash: string | null;
  claimEvaluationTxHash: string | null;
  fuelDeliveryClaimId: string | null;
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
  surveyForm: string | null; // Encrypted JSON string containing survey form and responses
  surveyFormUpdatedAt: Date | null; // Timestamp of last survey update
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

/**
 * Data Service
 *
 * Handles the step-by-step data collection and storage for USSD users
 */
class DataService {
  /**
   * Helper method to normalize National ID to the format with slashes
   * Converts "123456789" to "123456/78/9"
   * Returns null if the input is not a valid National ID format
   */
  private normalizeNationalId(nationalId: string): string | null {
    // Remove whitespace
    const cleaned = nationalId.trim();

    // Check if it already has slashes (format: XXXXXX/XX/X)
    if (/^\d{6}\/\d{2}\/\d$/.test(cleaned)) {
      return cleaned;
    }

    // Check if it's 9 digits without slashes (format: XXXXXXXXX)
    if (/^\d{9}$/.test(cleaned)) {
      // Convert to format with slashes: XXXXXX/XX/X
      return `${cleaned.slice(0, 6)}/${cleaned.slice(6, 8)}/${cleaned.slice(8)}`;
    }

    // Invalid format
    return null;
  }

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
            national_id: customerData.nationalId || null,
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

    // Normalize customer ID to uppercase for case-insensitive comparison
    const normalizedCustomerId = customerId.toUpperCase();

    logger.debug(
      { customerId: normalizedCustomerId.slice(-4) },
      "Looking up customer by customer ID"
    );

    try {
      const result = await db
        .selectFrom("customers")
        .select([
          "customers.id",
          "customers.customer_id",
          "customers.claims_bot_customer_id",
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
        .where("customers.customer_id", "=", normalizedCustomerId)
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
        claimsBotCustomerId: result.claims_bot_customer_id || undefined,
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
   * Get customer by national ID
   * Normalizes the national ID to the format with slashes (XXXXXX/XX/X) before querying
   */
  async getCustomerByNationalId(
    nationalId: string
  ): Promise<CustomerRecord | null> {
    const db = databaseManager.getKysely();

    // Normalize national ID to format with slashes (e.g., "123456789" -> "123456/78/9")
    // This ensures we can find customers regardless of whether they enter slashes or not
    const normalizedId = this.normalizeNationalId(nationalId);

    logger.debug(
      {
        inputNationalId: nationalId.slice(-4),
        normalizedNationalId: normalizedId?.slice(-4),
      },
      "Looking up customer by national ID"
    );

    // If normalization failed, the ID is invalid - return null
    if (!normalizedId) {
      logger.debug(
        { nationalId: nationalId.slice(-4) },
        "Invalid national ID format - cannot normalize"
      );
      return null;
    }

    try {
      const result = await db
        .selectFrom("customers")
        .select([
          "customers.id",
          "customers.customer_id",
          "customers.claims_bot_customer_id",
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
        .where("customers.national_id", "=", normalizedId)
        .executeTakeFirst();

      if (!result) {
        logger.debug(
          { nationalId: nationalId.slice(-4) },
          "No customer found for national ID"
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
        "Found customer by national ID"
      );

      return {
        id: result.id!,
        customerId: result.customer_id,
        claimsBotCustomerId: result.claims_bot_customer_id || undefined,
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
          nationalId: nationalId.slice(-4),
        },
        "Failed to get customer by national ID"
      );
      throw error;
    }
  }

  /**
   * Get customer by identifier (customer ID or national ID)
   * Attempts lookup by customer_id first, then by national_id if not found
   */
  async getCustomerByIdentifier(
    identifier: string
  ): Promise<CustomerRecord | null> {
    logger.debug(
      { identifier: identifier.slice(-4) },
      "Looking up customer by identifier (customer ID or national ID)"
    );

    // First, try to find by customer_id
    let customer = await this.getCustomerByCustomerId(identifier);

    if (customer) {
      logger.info(
        { customerId: customer.customerId },
        "Customer found by customer ID"
      );
      return customer;
    }

    // If not found, try to find by national_id
    customer = await this.getCustomerByNationalId(identifier);

    if (customer) {
      logger.info(
        { customerId: customer.customerId },
        "Customer found by national ID"
      );
      return customer;
    }

    logger.debug(
      { identifier: identifier.slice(-4) },
      "No customer found for identifier (tried both customer ID and national ID)"
    );
    return null;
  }

  /**
   * Clear customer PIN (used when max login attempts exceeded)
   */
  async clearCustomerPin(customerId: string): Promise<void> {
    const db = databaseManager.getKysely();

    // Normalize customer ID to uppercase for case-insensitive comparison
    const normalizedCustomerId = customerId.toUpperCase();

    logger.info(
      { customerId: normalizedCustomerId.slice(-4) },
      "Clearing customer PIN due to max attempts exceeded"
    );

    try {
      const result = await db
        .updateTable("customers")
        .set({
          encrypted_pin: null,
          updated_at: new Date(),
        })
        .where("customer_id", "=", normalizedCustomerId)
        .executeTakeFirst();

      if (result.numUpdatedRows === 0n) {
        throw new Error(`Customer not found: ${normalizedCustomerId}`);
      }

      logger.info(
        { customerId: normalizedCustomerId.slice(-4) },
        "Successfully cleared customer PIN"
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          customerId: normalizedCustomerId.slice(-4),
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

    // Normalize customer IDs to uppercase for case-insensitive comparison
    const normalizedCustomerId = customerId.toUpperCase();
    const normalizedLgCustomerId = lgCustomerId?.toUpperCase();

    logger.info(
      {
        customerId: normalizedCustomerId.slice(-4),
        lgCustomerId: normalizedLgCustomerId?.slice(-4),
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
          { customerId: normalizedCustomerId.slice(-4) },
          "📝 Encrypted temporary PIN"
        );

        // Update customer's encrypted_pin with the temporary PIN
        // First verify customer exists
        const customer = await trx
          .selectFrom("customers")
          .select("id")
          .where("customer_id", "=", normalizedCustomerId)
          .executeTakeFirst();

        if (!customer) {
          throw new Error(`Customer not found: ${normalizedCustomerId}`);
        }

        // Update the PIN
        await trx
          .updateTable("customers")
          .set({
            encrypted_pin: encryptedPin,
            updated_at: new Date(),
          })
          .where("customer_id", "=", normalizedCustomerId)
          .execute();

        logger.info(
          { customerId: normalizedCustomerId.slice(-4) },
          "✅ Temporary PIN stored in customers.encrypted_pin"
        );

        // Create audit log entry for PIN reset
        await trx
          .insertInto("audit_log")
          .values({
            event_type: "PIN_RESET",
            customer_id: normalizedCustomerId,
            lg_customer_id: normalizedLgCustomerId || null,
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
            customerId: normalizedCustomerId.slice(-4),
            lgCustomerId: normalizedLgCustomerId?.slice(-4),
          },
          "📋 Audit log entry created for PIN_RESET"
        );
      });
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          customerId: normalizedCustomerId.slice(-4),
          lgCustomerId: normalizedLgCustomerId?.slice(-4),
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
   * Update customer PIN
   */
  async updateCustomerPin(
    customerId: string,
    encryptedPin: string
  ): Promise<void> {
    const db = databaseManager.getKysely();

    // Normalize customer ID to uppercase for case-insensitive comparison
    const normalizedCustomerId = customerId.toUpperCase();

    logger.info(
      { customerId: normalizedCustomerId.slice(-4) },
      "Updating customer PIN"
    );

    try {
      await db
        .updateTable("customers")
        .set({
          encrypted_pin: encryptedPin,
          updated_at: new Date(),
        })
        .where("customer_id", "=", normalizedCustomerId)
        .execute();

      logger.info(
        { customerId: normalizedCustomerId.slice(-4) },
        "Customer PIN updated successfully"
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          customerId: normalizedCustomerId.slice(-4),
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

    // Normalize customer IDs to uppercase for case-insensitive comparison
    const normalizedCustomerId = customerId.toUpperCase();
    const normalizedAssignedBy = assignedBy.toUpperCase();

    logger.info(
      {
        customerId: normalizedCustomerId.slice(-4),
        newRole: role,
        assignedBy: normalizedAssignedBy.slice(-4),
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
        .where("customer_id", "=", normalizedCustomerId)
        .execute();

      logger.info(
        {
          customerId: normalizedCustomerId.slice(-4),
          newRole: role,
          assignedBy: normalizedAssignedBy.slice(-4),
        },
        "Agent role assigned successfully"
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          customerId: normalizedCustomerId.slice(-4),
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

    // Normalize customer ID to uppercase for case-insensitive comparison
    const normalizedCustomerId = customerId.toUpperCase();

    logger.info(
      { customerId: normalizedCustomerId.slice(-4) },
      "Validating bean distribution OTP"
    );

    try {
      const result = await db
        .selectFrom("bean_distribution_otps")
        .selectAll()
        .where("customer_id", "=", normalizedCustomerId)
        .where("otp", "=", otp)
        .where("is_valid", "=", true)
        .where("used_at", "is", null)
        .executeTakeFirst();

      if (!result) {
        logger.warn(
          { customerId: normalizedCustomerId.slice(-4) },
          "OTP not found or already used"
        );
        return null;
      }

      // Check if expired
      const now = new Date();
      if (now > result.expires_at) {
        logger.warn(
          { customerId: normalizedCustomerId.slice(-4) },
          "OTP has expired"
        );
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
        claimId: result.claim_id,
        claimTxHash: result.claim_tx_hash,
        claimEvaluationTxHash: result.claim_evaluation_tx_hash,
        fuelDeliveryClaimId: result.fuel_delivery_claim_id,
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

    // Normalize customer IDs to uppercase for case-insensitive comparison
    const normalizedCustomerId = customerId.toUpperCase();
    const normalizedLgCustomerId = lgCustomerId.toUpperCase();

    logger.info(
      {
        customerId: normalizedCustomerId.slice(-4),
        lgCustomerId: normalizedLgCustomerId.slice(-4),
      },
      "Getting delivery confirmation"
    );

    try {
      const result = await db
        .selectFrom("bean_delivery_confirmations")
        .selectAll()
        .where("customer_id", "=", normalizedCustomerId)
        .where("lg_customer_id", "=", normalizedLgCustomerId)
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
        claimId: result.claim_id,
        claimTxHash: result.claim_tx_hash,
        claimEvaluationTxHash: result.claim_evaluation_tx_hash,
        fuelDeliveryClaimId: result.fuel_delivery_claim_id,
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
        surveyForm: result.survey_form,
        surveyFormUpdatedAt: result.survey_form_updated_at,
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
   * Update claim survey form with JSON data
   */
  async updateClaimSurveyForm(
    lgCustomerId: string,
    customerId: string,
    surveyFormJson: any
  ): Promise<void> {
    const db = databaseManager.getKysely();
    const { encrypt } = await import("../utils/encryption.js");
    const { config } = await import("../config.js");
    const encryptionKey = config.SYSTEM.ENCRYPTION_KEY;

    // Normalize customer IDs to uppercase for case-insensitive comparison
    const normalizedLgCustomerId = lgCustomerId.toUpperCase();
    const normalizedCustomerId = customerId.toUpperCase();

    logger.info(
      {
        lgCustomerId: normalizedLgCustomerId.slice(-4),
        customerId: normalizedCustomerId.slice(-4),
      },
      "Updating claim survey form"
    );

    try {
      // Encrypt the entire JSON object
      const encryptedJson = encrypt(
        JSON.stringify(surveyFormJson),
        encryptionKey
      );

      // Try to update existing claim
      const result = await db
        .updateTable("household_claims")
        .set({
          survey_form: encryptedJson,
          survey_form_updated_at: new Date(),
        })
        .where("lg_customer_id", "=", normalizedLgCustomerId)
        .where("customer_id", "=", normalizedCustomerId)
        .executeTakeFirst();

      // If no claim exists, create one
      if (result.numUpdatedRows === BigInt(0)) {
        await db
          .insertInto("household_claims")
          .values({
            lg_customer_id: normalizedLgCustomerId,
            customer_id: normalizedCustomerId,
            is_1000_day_household: false, // Will be updated when claim is submitted
            claim_submitted_at: new Date(),
            survey_form: encryptedJson,
            survey_form_updated_at: new Date(),
            bean_voucher_allocated: false,
            created_at: new Date(),
          })
          .execute();
      }
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          customerId: normalizedCustomerId.slice(-4),
        },
        "Failed to update claim survey form"
      );
      throw error;
    }
  }

  /**
   * Get claim by LG and customer ID
   */
  async getClaimByLgAndCustomer(
    lgCustomerId: string,
    customerId: string
  ): Promise<HouseholdClaimRecord | null> {
    const db = databaseManager.getKysely();
    const { decrypt } = await import("../utils/encryption.js");
    const { config } = await import("../config.js");
    const encryptionKey = config.SYSTEM.ENCRYPTION_KEY;

    // Normalize customer IDs to uppercase for case-insensitive comparison
    const normalizedLgCustomerId = lgCustomerId.toUpperCase();
    const normalizedCustomerId = customerId.toUpperCase();

    logger.debug(
      {
        lgCustomerId: normalizedLgCustomerId.slice(-4),
        customerId: normalizedCustomerId.slice(-4),
      },
      "Fetching claim by LG and customer"
    );

    try {
      const result = await db
        .selectFrom("household_claims")
        .selectAll()
        .where("lg_customer_id", "=", normalizedLgCustomerId)
        .where("customer_id", "=", normalizedCustomerId)
        .orderBy("created_at", "desc")
        .executeTakeFirst();

      if (!result) {
        return null;
      }

      // Decrypt survey form if it exists
      let surveyForm = null;
      if (result.survey_form) {
        try {
          surveyForm = decrypt(result.survey_form, encryptionKey);
        } catch (error) {
          logger.warn(
            {
              error: error instanceof Error ? error.message : String(error),
              customerId: customerId.slice(-4),
            },
            "Failed to decrypt survey form, returning null"
          );
        }
      }

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
        surveyForm,
        surveyFormUpdatedAt: result.survey_form_updated_at,
        createdAt: result.created_at,
      };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          customerId: customerId.slice(-4),
        },
        "Failed to fetch claim"
      );
      throw error;
    }
  }

  /**
   * Insert a failed claim into the retry queue
   */
  async insertFailedClaim(params: {
    claimType: "lead_creation" | "1000_day_household";
    customerId: string;
    claimData: any;
    errorMessage: string;
    httpStatusCode?: number;
  }): Promise<number> {
    const db = databaseManager.getKysely();
    const { config } = await import("../config.js");

    // Calculate next retry time (5 minutes from now for first attempt)
    const nextRetryAt = new Date(
      Date.now() + config.CLAIMS_RETRY.RETRY_DELAYS_MINUTES[0] * 60 * 1000
    );

    logger.info(
      {
        claimType: params.claimType,
        customerId: params.customerId.slice(-4),
        httpStatusCode: params.httpStatusCode,
        nextRetryAt,
      },
      "Inserting failed claim into retry queue"
    );

    try {
      const result = await db
        .insertInto("failed_claims_queue")
        .values({
          claim_type: params.claimType,
          customer_id: params.customerId,
          claim_data: JSON.stringify(params.claimData),
          error_message: params.errorMessage,
          http_status_code: params.httpStatusCode || null,
          retry_count: 0,
          max_retries: config.CLAIMS_RETRY.MAX_RETRIES,
          next_retry_at: nextRetryAt,
          last_attempted_at: new Date(),
          created_at: new Date(),
          status: "pending",
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      logger.info(
        {
          queueId: result.id,
          customerId: params.customerId.slice(-4),
        },
        "Failed claim queued for retry"
      );

      return result.id!;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          customerId: params.customerId.slice(-4),
        },
        "Failed to insert failed claim into queue"
      );
      throw error;
    }
  }

  /**
   * Get failed claims ready for retry
   */
  async getFailedClaimsForRetry(limit: number = 10): Promise<any[]> {
    const db = databaseManager.getKysely();

    try {
      const results = await db
        .selectFrom("failed_claims_queue")
        .selectAll()
        .where("status", "=", "pending")
        .where("next_retry_at", "<=", new Date())
        .orderBy("created_at", "asc")
        .limit(limit)
        .execute();

      return results;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to fetch claims for retry"
      );
      throw error;
    }
  }

  /**
   * Update failed claim retry attempt
   */
  async updateFailedClaimRetry(
    queueId: number,
    retryCount: number,
    errorMessage?: string
  ): Promise<void> {
    const db = databaseManager.getKysely();
    const { config } = await import("../config.js");

    // Calculate next retry time with exponential backoff
    const delayIndex = Math.min(
      retryCount,
      config.CLAIMS_RETRY.RETRY_DELAYS_MINUTES.length - 1
    );
    const delayMinutes = config.CLAIMS_RETRY.RETRY_DELAYS_MINUTES[delayIndex];
    const nextRetryAt = new Date(Date.now() + delayMinutes * 60 * 1000);

    // Determine status based on retry count
    const status =
      retryCount >= config.CLAIMS_RETRY.MAX_RETRIES ? "failed" : "pending";

    try {
      await db
        .updateTable("failed_claims_queue")
        .set({
          retry_count: retryCount,
          last_attempted_at: new Date(),
          next_retry_at: status === "failed" ? null : nextRetryAt,
          status,
          error_message: errorMessage || undefined,
        })
        .where("id", "=", queueId)
        .execute();

      logger.info(
        {
          queueId,
          retryCount,
          status,
          nextRetryAt: status === "failed" ? null : nextRetryAt,
        },
        "Updated failed claim retry status"
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          queueId,
        },
        "Failed to update claim retry status"
      );
      throw error;
    }
  }

  /**
   * Mark failed claim as resolved
   */
  async markFailedClaimResolved(queueId: number): Promise<void> {
    const db = databaseManager.getKysely();

    try {
      await db
        .updateTable("failed_claims_queue")
        .set({
          status: "resolved",
          resolved_at: new Date(),
        })
        .where("id", "=", queueId)
        .execute();

      logger.info({ queueId }, "Marked failed claim as resolved");
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          queueId,
        },
        "Failed to mark claim as resolved"
      );
      throw error;
    }
  }

  /**
   * Log audit event (convenience wrapper for createAuditLog)
   * Used for security events, failed operations, and compliance tracking
   */
  async logAuditEvent(params: {
    eventType: string;
    customerId?: string;
    lgCustomerId?: string;
    phoneNumber?: string;
    details: any;
  }): Promise<void> {
    try {
      await this.createAuditLog({
        eventType: params.eventType,
        customerId: params.customerId,
        lgCustomerId: params.lgCustomerId,
        details: {
          ...params.details,
          phoneNumber: params.phoneNumber,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      // Log error but don't throw - audit logging should not break application flow
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          eventType: params.eventType,
        },
        "Failed to log audit event (non-fatal)"
      );
    }
  }
}

// Export singleton instance
export const dataService = new DataService();
