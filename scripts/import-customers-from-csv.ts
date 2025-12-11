#!/usr/bin/env ts-node
/**
 * Customer Data Import Script
 * 
 * Imports customer data from CSV file into the USSD database.
 * This script bypasses the normal USSD registration flow and directly
 * creates customer records in the database.
 * 
 * Usage:
 *   npm run import:customers
 *   or
 *   NODE_OPTIONS='--loader ts-node/esm' ts-node --require dotenv/config scripts/import-customers-from-csv.ts
 * 
 * CSV Format Expected:
 *   UniqueID,Contract Reference,Customer Name,Phone Numbers,Area,Collection Name,1st Bag,2nd Bag,3rd Bag,4th Bag,Visit by MOH,Date of Visit
 */

import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { databaseManager } from "../src/services/database-manager.js";
import { createModuleLogger } from "../src/services/logger.js";
import { encryptPin } from "../src/utils/encryption.js";
import { parsePhoneNumber } from "libphonenumber-js";

const logger = createModuleLogger("csv-import");

// Configuration
const CSV_FILE_PATH = "specs/Beans Distribution Tracker - Sheet1.csv";
const DEFAULT_PIN = "1234"; // Default PIN for imported customers
const DEFAULT_LANGUAGE = "eng";
const BATCH_SIZE = 50; // Process records in batches

// Import statistics
interface ImportStats {
  total: number;
  successful: number;
  skipped: number;
  failed: number;
  errors: Array<{ row: number; error: string; data: any }>;
}

// CSV Row interface
interface CSVRow {
  UniqueID: string;
  "Contract Reference": string;
  "Customer Name ": string; // Note: has trailing space in CSV
  "Phone Numbers": string;
  Area: string;
  "Collection Name": string;
  "1st Bag": string;
  "2nd Bag ": string;
  "3rd Bag": string;
  "4th Bag": string;
  "Visit by MOH": string;
  "Date of Visit": string;
}

/**
 * Normalize and validate phone number
 */
function normalizePhoneNumber(phoneNumber: string): string | null {
  try {
    // Remove any whitespace
    let cleaned = phoneNumber.trim().replace(/\s+/g, "");
    
    // If it doesn't start with +, assume it's a Zambian number (260)
    if (!cleaned.startsWith("+")) {
      if (cleaned.startsWith("260")) {
        cleaned = "+" + cleaned;
      } else if (cleaned.startsWith("0")) {
        cleaned = "+260" + cleaned.substring(1);
      } else {
        cleaned = "+260" + cleaned;
      }
    }
    
    // Parse and validate using libphonenumber-js
    const parsed = parsePhoneNumber(cleaned, "ZM");
    
    if (!parsed || !parsed.isValid()) {
      logger.warn({ phoneNumber, cleaned }, "Invalid phone number");
      return null;
    }
    
    return parsed.number; // Returns in E.164 format (e.g., +260977202978)
  } catch (error) {
    logger.warn(
      { phoneNumber, error: error instanceof Error ? error.message : String(error) },
      "Failed to parse phone number"
    );
    return null;
  }
}

/**
 * Validate customer name
 */
function validateCustomerName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 255;
}

/**
 * Read and parse CSV file
 */
function readCSVFile(filePath: string): CSVRow[] {
  logger.info({ filePath }, "Reading CSV file");
  
  const fileContent = fs.readFileSync(filePath, "utf-8");
  
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CSVRow[];
  
  logger.info({ recordCount: records.length }, "CSV file parsed successfully");
  
  return records;
}

/**
 * Check if customer already exists by phone number
 */
async function customerExists(phoneNumber: string): Promise<boolean> {
  const db = databaseManager.getKysely();
  
  const result = await db
    .selectFrom("phones")
    .innerJoin("customer_phones", "phones.id", "customer_phones.phone_id")
    .innerJoin("customers", "customer_phones.customer_id", "customers.id")
    .select("customers.id")
    .where("phones.phone_number", "=", phoneNumber)
    .where("customer_phones.is_primary", "=", true)
    .executeTakeFirst();
  
  return !!result;
}

/**
 * Import a single customer record
 */
async function importCustomer(
  row: CSVRow,
  rowNumber: number
): Promise<{ success: boolean; error?: string }> {
  const db = databaseManager.getKysely();

  try {
    // Extract and validate data
    const customerName = row["Customer Name "].trim();
    const contractRef = row["Contract Reference"].trim();
    const phoneNumber = normalizePhoneNumber(row["Phone Numbers"]);
    const area = row.Area?.trim() || "";
    const collectionName = row["Collection Name"]?.trim() || "";

    // Validation
    if (!validateCustomerName(customerName)) {
      return { success: false, error: "Invalid customer name" };
    }

    if (!phoneNumber) {
      return { success: false, error: "Invalid phone number" };
    }

    if (!contractRef) {
      return { success: false, error: "Missing contract reference" };
    }

    // Check if customer already exists
    const exists = await customerExists(phoneNumber);
    if (exists) {
      logger.debug(
        { phoneNumber: phoneNumber.slice(-4), contractRef },
        "Customer already exists, skipping"
      );
      return { success: false, error: "Customer already exists" };
    }

    // Import customer in a transaction
    await db.transaction().execute(async (trx) => {
      // 1. Create or get phone record
      let phoneRecord = await trx
        .selectFrom("phones")
        .selectAll()
        .where("phone_number", "=", phoneNumber)
        .executeTakeFirst();

      if (!phoneRecord) {
        phoneRecord = await trx
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
      }

      // 2. Create customer record
      const encryptedPin = encryptPin(DEFAULT_PIN);

      const customer = await trx
        .insertInto("customers")
        .values({
          customer_id: contractRef, // Use Contract Reference as customer_id
          full_name: customerName,
          email: null,
          national_id: null,
          encrypted_pin: encryptedPin,
          preferred_language: DEFAULT_LANGUAGE,
          date_added: new Date(),
          last_completed_action: "csv_import",
          household_id: null,
          role: "customer",
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // 3. Link customer to phone
      await trx
        .insertInto("customer_phones")
        .values({
          customer_id: customer.id!,
          phone_id: phoneRecord.id!,
          is_primary: true,
          created_at: new Date(),
        })
        .execute();

      logger.info(
        {
          customerId: customer.customer_id,
          phoneNumber: phoneNumber.slice(-4),
          fullName: customerName,
          area,
          collectionName,
        },
        "Customer imported successfully"
      );
    });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      {
        rowNumber,
        error: errorMessage,
        contractRef: row["Contract Reference"],
      },
      "Failed to import customer"
    );
    return { success: false, error: errorMessage };
  }
}

/**
 * Main import function
 */
async function importCustomers(): Promise<ImportStats> {
  const stats: ImportStats = {
    total: 0,
    successful: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  try {
    // Read CSV file
    const csvPath = path.resolve(process.cwd(), CSV_FILE_PATH);

    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV file not found: ${csvPath}`);
    }

    const records = readCSVFile(csvPath);
    stats.total = records.length;

    logger.info({ total: stats.total }, "Starting customer import");

    // Process records in batches
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(records.length / BATCH_SIZE);

      logger.info(
        { batchNumber, totalBatches, batchSize: batch.length },
        "Processing batch"
      );

      // Process batch sequentially to avoid overwhelming the database
      for (let j = 0; j < batch.length; j++) {
        const row = batch[j];
        const rowNumber = i + j + 2; // +2 because CSV is 1-indexed and has header

        const result = await importCustomer(row, rowNumber);

        if (result.success) {
          stats.successful++;
        } else if (result.error === "Customer already exists") {
          stats.skipped++;
        } else {
          stats.failed++;
          stats.errors.push({
            row: rowNumber,
            error: result.error || "Unknown error",
            data: {
              contractRef: row["Contract Reference"],
              name: row["Customer Name "],
              phone: row["Phone Numbers"],
            },
          });
        }
      }

      // Log progress
      logger.info(
        {
          processed: i + batch.length,
          total: stats.total,
          successful: stats.successful,
          skipped: stats.skipped,
          failed: stats.failed,
        },
        "Batch completed"
      );
    }

    return stats;
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Import process failed"
    );
    throw error;
  }
}

/**
 * Generate import report
 */
function generateReport(stats: ImportStats): void {
  console.log("\n" + "=".repeat(80));
  console.log("CUSTOMER IMPORT REPORT");
  console.log("=".repeat(80));
  console.log(`Total records:      ${stats.total}`);
  console.log(`Successfully imported: ${stats.successful}`);
  console.log(`Skipped (existing):    ${stats.skipped}`);
  console.log(`Failed:                ${stats.failed}`);
  console.log("=".repeat(80));

  if (stats.errors.length > 0) {
    console.log("\nERRORS:");
    console.log("-".repeat(80));

    stats.errors.forEach((error, index) => {
      console.log(`\n${index + 1}. Row ${error.row}:`);
      console.log(`   Error: ${error.error}`);
      console.log(`   Contract Ref: ${error.data.contractRef}`);
      console.log(`   Name: ${error.data.name}`);
      console.log(`   Phone: ${error.data.phone}`);
    });

    console.log("\n" + "-".repeat(80));

    // Write errors to file
    const errorLogPath = path.resolve(process.cwd(), "logs/import-errors.json");
    fs.mkdirSync(path.dirname(errorLogPath), { recursive: true });
    fs.writeFileSync(errorLogPath, JSON.stringify(stats.errors, null, 2));
    console.log(`\nDetailed error log written to: ${errorLogPath}`);
  }

  console.log("\n" + "=".repeat(80));
  console.log(`Import completed at: ${new Date().toISOString()}`);
  console.log("=".repeat(80) + "\n");
}

/**
 * Main execution
 */
async function main() {
  console.log("\n🚀 Starting Customer Data Import...\n");

  try {
    // Initialize database connection
    logger.info("Initializing database connection");
    await databaseManager.initialize();

    // Verify database connection
    const db = databaseManager.getKysely();
    await db.selectFrom("customers").select("id").limit(1).execute();
    logger.info("Database connection verified");

    // Run import
    const stats = await importCustomers();

    // Generate report
    generateReport(stats);

    // Exit with appropriate code
    if (stats.failed > 0) {
      console.log("⚠️  Import completed with errors");
      process.exit(1);
    } else {
      console.log("✅ Import completed successfully");
      process.exit(0);
    }
  } catch (error) {
    console.error("\n❌ Import failed:");
    console.error(error instanceof Error ? error.message : String(error));

    if (error instanceof Error && error.stack) {
      logger.error({ stack: error.stack }, "Stack trace");
    }

    process.exit(1);
  } finally {
    // Clean up database connection
    try {
      await databaseManager.close();
      logger.info("Database connection closed");
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        "Error closing database connection"
      );
    }
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

