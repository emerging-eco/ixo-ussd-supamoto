/* eslint-disable @typescript-eslint/no-unused-vars */
import { Kysely } from "kysely";
import { databaseManager } from "../services/database-manager.js";
import { ENV } from "../config.js";

// Initialize database manager
if (!ENV.IS_TEST) {
  // In production/development, initialize immediately
  databaseManager.initialize().catch(error => {
    // Use process.stderr for logging during initialization
    process.stderr.write(`Failed to initialize database: ${error}\n`);
    process.exit(1);
  });
}

// Export getter function instead of direct instance
export const getDb = (): Kysely<Database> => {
  return databaseManager.getKysely();
};

// Export lazy db instance for backwards compatibility with full proxy support
export const db = new Proxy({} as Kysely<Database>, {
  get(target, prop) {
    const kysely = databaseManager.getKysely();
    const value = (kysely as any)[prop];
    return typeof value === "function" ? value.bind(kysely) : value;
  },

  set(target, prop, value) {
    const kysely = databaseManager.getKysely();
    (kysely as any)[prop] = value;
    return true;
  },

  deleteProperty(target, prop) {
    const kysely = databaseManager.getKysely();
    delete (kysely as any)[prop];
    return true;
  },

  has(target, prop) {
    const kysely = databaseManager.getKysely();
    return prop in kysely;
  },

  ownKeys(target) {
    const kysely = databaseManager.getKysely();
    return Reflect.ownKeys(kysely);
  },

  getOwnPropertyDescriptor(target, prop) {
    const kysely = databaseManager.getKysely();
    return Reflect.getOwnPropertyDescriptor(kysely, prop);
  },

  defineProperty(target, prop, descriptor) {
    const kysely = databaseManager.getKysely();
    return Reflect.defineProperty(kysely, prop, descriptor);
  },

  getPrototypeOf(target) {
    const kysely = databaseManager.getKysely();
    return Reflect.getPrototypeOf(kysely);
  },

  setPrototypeOf(target, prototype) {
    const kysely = databaseManager.getKysely();
    return Reflect.setPrototypeOf(kysely, prototype);
  },

  isExtensible(target) {
    const kysely = databaseManager.getKysely();
    return Reflect.isExtensible(kysely);
  },

  preventExtensions(target) {
    const kysely = databaseManager.getKysely();
    return Reflect.preventExtensions(kysely);
  },
});

export interface Database {
  phones: {
    id?: number;
    phone_number: string;
    first_seen: Date;
    last_seen: Date;
    number_of_visits: number;
    created_at: Date;
    updated_at: Date;
  };
  households: {
    id?: number;
    created_at: Date;
    updated_at: Date;
  };
  customers: {
    id?: number;
    customer_id: string;
    full_name: string | null;
    email: string | null;
    national_id: string | null;
    encrypted_pin: string | null; // Allow null for PIN clearing
    preferred_language: string | null;
    date_added: Date;
    last_completed_action: string | null;
    household_id: number | null;
    role: "customer" | "lead_generator" | "call_center" | "admin"; // Role-based access control
    created_at: Date;
    updated_at: Date;
  };
  customer_phones: {
    id?: number;
    customer_id: number;
    phone_id: number;
    is_primary: boolean | null;
    created_at: Date;
  };
  // temp_pins table removed - temporary PINs now stored encrypted in customers.encrypted_pin
  // eligibility_verifications table removed - replaced by household_claims + household_survey_responses
  // ixo_profiles, ixo_accounts, matrix_vaults tables removed - IXO account creation delegated to Claims Bot
  lg_delivery_intents: {
    id?: number;
    customer_id: string;
    lg_customer_id: string;
    intent_registered_at: Date;
    has_bean_voucher: boolean;
    voucher_status: string | null;
    voucher_check_response: any; // JSONB
    claim_intent_id: string | null;
    claim_intent_tx_hash: string | null;
    claim_intent_response: any; // JSONB
    customer_claim_collection_id: string | null;
    created_at: Date;
  };
  bean_distribution_otps: {
    id?: number;
    customer_id: string;
    lg_customer_id: string;
    intent_id: number | null;
    otp: string;
    generated_at: Date;
    expires_at: Date;
    used_at: Date | null;
    is_valid: boolean;
    created_at: Date;
  };
  bean_delivery_confirmations: {
    id?: number;
    customer_id: string;
    lg_customer_id: string;
    otp_id: number | null;
    lg_confirmed_at: Date | null;
    customer_confirmed_at: Date | null;
    customer_confirmed_receipt: boolean | null;
    token_transferred_at: Date | null;
    confirmation_deadline: Date;
    claim_id: string | null;
    claim_tx_hash: string | null;
    claim_evaluation_tx_hash: string | null;
    fuel_delivery_claim_id: string | null;
    created_at: Date;
    updated_at: Date;
  };
  household_claims: {
    id?: number;
    lg_customer_id: string; // Lead Generator who submitted the claim
    customer_id: string; // Customer the claim is for
    is_1000_day_household: boolean;
    claim_submitted_at: Date;
    claim_processed_at: Date | null;
    claim_status: string | null;
    bean_voucher_allocated: boolean;
    claims_bot_response: any; // JSONB
    survey_form: string | null; // Encrypted JSON string containing survey form and responses
    survey_form_updated_at: Date | null; // Timestamp of last survey update
    created_at: Date;
  };
  failed_claims_queue: {
    id?: number;
    claim_type: "lead_creation" | "1000_day_household";
    customer_id: string;
    claim_data: any; // JSONB - full claim payload for retry
    error_message: string | null;
    http_status_code: number | null;
    retry_count: number;
    max_retries: number;
    next_retry_at: Date | null;
    last_attempted_at: Date | null;
    created_at: Date;
    resolved_at: Date | null;
    status: "pending" | "retrying" | "failed" | "resolved";
  };
  audit_log: {
    id?: number;
    event_type: string;
    customer_id: string | null;
    lg_customer_id: string | null;
    details: any; // JSONB
    created_at: Date;
  };
}
