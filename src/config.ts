/**
 * Application configuration
 */
import * as process from "process";
import dotenv from "dotenv";
import { createModuleLogger } from "./services/logger.js";

// Create a module-specific logger
const logger = createModuleLogger("config");

// Load environment variables
dotenv.config();

// Environment detection and validation
export type Environment = "production" | "development" | "test";

/**
 * Get the current environment from NODE_ENV with proper validation
 * This is the single source of truth for environment detection
 */
export function getCurrentEnvironment(): Environment {
  const nodeEnv = process.env.NODE_ENV?.toLowerCase();

  switch (nodeEnv) {
    case "production":
    case "prod":
      return "production";
    case "test":
    case "testing":
      return "test";
    case "development":
    case "dev":
    default:
      return "development";
  }
}

/**
 * Current environment - single source of truth
 */
export const ENVIRONMENT = getCurrentEnvironment();

/**
 * Environment check utilities
 */
export const ENV = {
  /** Current environment */
  CURRENT: ENVIRONMENT,
  /** Is production environment */
  IS_PRODUCTION: ENVIRONMENT === "production",
  /** Is development environment */
  IS_DEVELOPMENT: ENVIRONMENT === "development",
  /** Is test environment */
  IS_TEST: ENVIRONMENT === "test",
  /** Is not production (dev or test) */
  IS_DEV_OR_TEST: ENVIRONMENT !== "production",
  /** Is running under Vitest test runner */
  IS_VITEST: process.env.VITEST === "true",
  /** Is any kind of test environment (NODE_ENV=test or Vitest) */
  IS_ANY_TEST: ENVIRONMENT === "test" || process.env.VITEST === "true",
} as const;

// Validate required environment variables
const requiredEnvVars = [
  "DATABASE_URL",
  "LOG_LEVEL",
  "PIN_ENCRYPTION_KEY",
] as const;

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

function stringToList(str: string | undefined): string[] {
  if (!str) return [];
  try {
    return str.split(",").map(item => item.trim());
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        input: str,
      },
      "Error parsing string to list"
    );
    return [];
  }
}

/**
 * Parse DATABASE_URL into individual components
 * Format: postgres://user:password@host:port/database
 */
function parseDatabaseUrl(databaseUrl: string): {
  database: string;
  user: string;
  password: string;
  host: string;
  port: number;
} {
  try {
    // Use the URL class for robust parsing (handles IPv6, colons in password, etc.)
    const url = new URL(databaseUrl);
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
      throw new Error(
        "Invalid protocol: expected postgres:// or postgresql://"
      );
    }
    const database = url.pathname.replace(/^\//, "");
    if (!database) {
      throw new Error("Invalid format: missing database name");
    }
    const user = url.username;
    const password = url.password;
    const host = url.hostname;
    const port = url.port ? parseInt(url.port, 10) : 5432;
    if (!user) {
      throw new Error("Invalid format: missing user");
    }
    if (!password) {
      throw new Error("Invalid format: missing password");
    }
    if (!host) {
      throw new Error("Invalid format: missing host");
    }
    if (isNaN(port) || port <= 0 || port > 65535) {
      throw new Error(`Invalid port: ${url.port}`);
    }
    return {
      database,
      user,
      password,
      host,
      port,
    };
  } catch (error) {
    throw new Error(
      `Invalid DATABASE_URL format: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get database configuration from DATABASE_URL or individual env vars
 */
function getDatabaseConfig() {
  // Try DATABASE_URL first
  if (process.env.DATABASE_URL) {
    try {
      return parseDatabaseUrl(process.env.DATABASE_URL);
    } catch (error) {
      logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to parse DATABASE_URL, falling back to individual env vars"
      );
    }
  }

  // Fallback to individual env vars
  return {
    database: process.env.PG_DATABASE || "ixo-ussd-dev",
    user: process.env.PG_USER || "postgres",
    password: process.env.PG_PASSWORD || "",
    host: process.env.PG_HOST || "localhost",
    port: process.env.PG_PORT ? parseInt(process.env.PG_PORT, 10) : 5432,
  };
}

export const config = {
  DEMO_CONFIG: {
    VALID_PIN: process.env.DEMO_PIN || "12345",
    ENCRYPTED_PIN_HASH: process.env.DEMO_PIN_HASH || "hashed-pin",
  },
  DATABASE: {
    URL: process.env.DATABASE_URL,
    PG: getDatabaseConfig(),
  },
  DEV: ENV.IS_DEV_OR_TEST,
  ENVIRONMENT: ENVIRONMENT,
  ZM: {
    SUPPORT_PHONE: process.env.ZM_SUPPORT_PHONE ?? "0700000000",
    SERVICE_CODES: stringToList(process.env.ZM_SERVICE_CODES) ?? ["*2233#"],
  },
  LOG: {
    LEVEL: process.env.LOG_LEVEL ?? "info",
    NAME: process.env.LOG_NAME ?? "ixo-ussd",
  },
  METRICS: {
    ENABLED: process.env.METRICS_ENABLED === "true",
  },
  SMS: {
    ENABLED: process.env.SMS_ENABLED === "true",
    API_KEY: process.env.AFRICASTALKING_API_KEY,
    USERNAME: process.env.AFRICASTALKING_USERNAME || "sandbox",
    // Use provided SENDER_ID, fallback to empty string if not set
    // Empty string allows Africa's Talking to use the default sender ID for the account
    // This is more reliable than hardcoding a sender ID that may not be registered
    SENDER_ID: process.env.AFRICASTALKING_SENDER_ID?.trim() || "",
  },
  SERVER: {
    DISABLE_REQUEST_LOGGING:
      process.env.SERVER_DISABLE_REQUEST_LOGGING === "true",
    HOST: "0.0.0.0",
    PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
    TRUST_PROXY_ENABLED: process.env.TRUST_PROXY_ENABLED === "true",
  },
  SYSTEM: {
    SECRET: process.env.SYSTEM_SECRET ?? "systemSecret",
    PIN_ENCRYPTION_KEY: process.env.PIN_ENCRYPTION_KEY!,
    ENCRYPTION_KEY:
      process.env.ENCRYPTION_KEY ?? process.env.PIN_ENCRYPTION_KEY!,
  },
  TIMEZONE: process.env.TIMEZONE ?? "Africa/Nairobi",
  logLevel: process.env.LOG_LEVEL ?? "info",
  databaseUrl: process.env.DATABASE_URL,
  MATRIX: {
    homeServerUrl: process.env.MATRIX_HOME_SERVER,
    botUrl: process.env.MATRIX_BOT_URL,
    stateBotUrl: process.env.MATRIX_STATE_BOT_URL,
  },
  USSD_MACHINE_TYPE: process.env.USSD_MACHINE_TYPE || "supamoto",
  USSD: {
    // Service code is accessed via: config.ZM.SERVICE_CODES[0]
    OTP_VALIDITY_MINUTES: parseInt(
      process.env.OTP_VALIDITY_MINUTES || "10",
      10
    ),
    MAX_PIN_ATTEMPTS: parseInt(process.env.MAX_PIN_ATTEMPTS || "3", 10),
    DELIVERY_CONFIRMATION_DAYS: parseInt(
      process.env.DELIVERY_CONFIRMATION_DAYS || "7",
      10
    ),
    SMS_RETRY_ATTEMPTS: parseInt(process.env.SMS_RETRY_ATTEMPTS || "3", 10),
    SMS_RETRY_DELAYS_SECONDS: [0, 10, 30], // Immediate, 10s, 30s for 3 attempts
  },
  CLAIMS_BOT: {
    URL: process.env.CLAIMS_BOT_URL || "",
    ACCESS_TOKEN: process.env.CLAIMS_BOT_ACCESS_TOKEN || "",
    DB_ENCRYPTION_KEY: process.env.CLAIMS_BOT_DB_ENCRYPTION_KEY || "",
  },
  CLAIMS_BOT_DB: {
    host: process.env.CLAIMS_BOT_DB_HOST || "localhost",
    port: process.env.CLAIMS_BOT_DB_PORT
      ? parseInt(process.env.CLAIMS_BOT_DB_PORT, 10)
      : 5432,
    user: process.env.CLAIMS_BOT_DB_USER || "supamoto_user",
    password: process.env.CLAIMS_BOT_DB_PASSWORD || "",
    database: process.env.CLAIMS_BOT_DB_NAME || "supamoto_db",
  },
  CLAIMS_RETRY: {
    MAX_RETRIES: parseInt(process.env.CLAIMS_MAX_RETRIES || "3", 10),
    RETRY_DELAYS_MINUTES: [5, 30, 120], // 5min, 30min, 2hr
    BATCH_SIZE: parseInt(process.env.CLAIMS_RETRY_BATCH_SIZE || "10", 10),
  },
  BEAN_DISTRIBUTION: {
    COLLECTION_ID: process.env.BEAN_DISTRIBUTION_COLLECTION_ID || "120",
    LG_WALLET_MNEMONIC: process.env.LG_WALLET_MNEMONIC || "",
    EVALUATOR_WALLET_MNEMONIC: process.env.EVALUATOR_WALLET_MNEMONIC || "",
  },
  SUBSCRIPTIONS: {
    API_BASE_URL:
      process.env.SUBSCRIPTIONS_API_BASE_URL ||
      "https://subscriptions-api.alwyn-vanwyk.workers.dev",
    MATRIX_SERVER:
      process.env.MATRIX_HOME_SERVER?.replace("https://", "") ||
      "devmx.ixo.earth",
    REQUEST_TIMEOUT_MS: parseInt(
      process.env.SUBSCRIPTIONS_REQUEST_TIMEOUT_MS || "10000",
      10
    ),
  },
} as const;

// Type for the config object
export type Config = typeof config;
