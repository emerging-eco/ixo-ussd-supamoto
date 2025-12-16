#!/usr/bin/env ts-node
/**
 * Customer Credentials Export Script
 *
 * Exports customer credentials (IXO account mnemonic, Matrix account details) to CSV.
 *
 * Usage:
 *   npm run export:credentials
 *   or
 *   NODE_ENV=dev DOTENV_CONFIG_PATH=.env.local NODE_OPTIONS='--loader ts-node/esm' ts-node --require dotenv/config scripts/export-customer-credentials.ts
 */

import fs from "fs";
import path from "path";
import { stringify } from "csv-stringify/sync";
import { databaseManager } from "../src/services/database-manager.js";
import { getClaimsBotDbClient } from "../src/services/claims-bot-db-client.js";
import { createModuleLogger } from "../src/services/logger.js";

const logger = createModuleLogger("credentials-export");

// Configuration
const OUTPUT_FILE_PATH = "exports/customer-credentials.csv";

// Export statistics
interface ExportStats {
  total: number;
  successful: number;
  failed: number;
  errors: Array<{ customerId: string; error: string }>;
}

// CSV Row interface
interface CredentialRow {
  customer_id: string;
  ixo_account_mnemonic: string;
  matrix_account_name: string;
  matrix_account_password: string;
}

/**
 * Get all unique customer IDs from the customers table
 */
async function getAllCustomerIds(): Promise<string[]> {
  const db = databaseManager.getKysely();
  
  logger.info("Fetching all customer IDs from customers table");
  
  const customers = await db
    .selectFrom("customers")
    .select("customer_id")
    .execute();
  
  const customerIds = customers.map(c => c.customer_id);
  
  logger.info({ count: customerIds.length }, "Retrieved customer IDs");
  
  return customerIds;
}

/**
 * Get customer credentials from Supamoto database
 */
async function getCustomerCredentials(customerId: string): Promise<CredentialRow | null> {
  try {
    const db = getClaimsBotDbClient();
    
    // Get IXO account
    const ixoAccounts = await db.ixoAccounts.v1.selectIxoAccountsByCustomerId({
      customerId,
    });
    
    if (!ixoAccounts || ixoAccounts.length === 0) {
      logger.warn(
        { customerId: customerId.slice(-4) },
        "No IXO account found for customer"
      );
      return null;
    }
    
    // Select primary account or first account
    const ixoAccount = ixoAccounts.find(acc => acc.is_primary) || ixoAccounts[0];
    
    // Get Matrix account using the IXO address
    const matrixAccount = await db.matrixAccounts.v1.selectMatrixAccount({
      address: ixoAccount.address,
    });
    
    if (!matrixAccount) {
      logger.warn(
        { customerId: customerId.slice(-4), address: ixoAccount.address.slice(0, 10) },
        "No Matrix account found for customer"
      );
      return null;
    }
    
    // Convert Buffers to strings (SDK already decrypted them)
    const mnemonic = ixoAccount.encrypted_mnemonic.toString("utf-8");
    const matrixPassword = matrixAccount.encrypted_password
      ? matrixAccount.encrypted_password.toString("utf-8")
      : "";
    
    logger.info(
      { customerId: customerId.slice(-4) },
      "Successfully retrieved credentials"
    );
    
    return {
      customer_id: customerId,
      ixo_account_mnemonic: mnemonic,
      matrix_account_name: matrixAccount.username,
      matrix_account_password: matrixPassword,
    };
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        customerId: customerId.slice(-4),
      },
      "Failed to retrieve credentials for customer"
    );
    throw error;
  }
}

/**
 * Write credentials to CSV file
 */
function writeCredentialsToCSV(credentials: CredentialRow[], outputPath: string): void {
  logger.info({ outputPath, count: credentials.length }, "Writing credentials to CSV");

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Convert to CSV
  const csvContent = stringify(credentials, {
    header: true,
    columns: [
      { key: "customer_id", header: "customer_id" },
      { key: "ixo_account_mnemonic", header: "ixo_account_mnemonic" },
      { key: "matrix_account_name", header: "matrix_account_name" },
      { key: "matrix_account_password", header: "matrix_account_password" },
    ],
  });

  // Write to file
  fs.writeFileSync(outputPath, csvContent, "utf-8");

  logger.info({ outputPath }, "CSV file written successfully");
}

/**
 * Main export function
 */
async function exportCredentials(): Promise<ExportStats> {
  const stats: ExportStats = {
    total: 0,
    successful: 0,
    failed: 0,
    errors: [],
  };

  const credentials: CredentialRow[] = [];

  try {
    // Initialize database connections
    await databaseManager.initialize();

    // Get all customer IDs
    const customerIds = await getAllCustomerIds();
    stats.total = customerIds.length;

    logger.info({ total: stats.total }, "Starting credentials export");

    // Process each customer
    for (const customerId of customerIds) {
      try {
        const creds = await getCustomerCredentials(customerId);

        if (creds) {
          credentials.push(creds);
          stats.successful++;
        } else {
          stats.failed++;
          stats.errors.push({
            customerId,
            error: "No credentials found (missing IXO or Matrix account)",
          });
        }
      } catch (error) {
        stats.failed++;
        stats.errors.push({
          customerId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Log progress every 10 customers
      if ((stats.successful + stats.failed) % 10 === 0) {
        logger.info(
          {
            processed: stats.successful + stats.failed,
            total: stats.total,
            successful: stats.successful,
            failed: stats.failed,
          },
          "Export progress"
        );
      }
    }

    // Write to CSV
    if (credentials.length > 0) {
      const outputPath = path.resolve(process.cwd(), OUTPUT_FILE_PATH);
      writeCredentialsToCSV(credentials, outputPath);
    } else {
      logger.warn("No credentials to export");
    }

    return stats;
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Export failed"
    );
    throw error;
  } finally {
    // Close database connections
    await databaseManager.close();
  }
}

/**
 * Print export summary
 */
function printSummary(stats: ExportStats): void {
  console.log("\n" + "=".repeat(80));
  console.log("EXPORT SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total customers:     ${stats.total}`);
  console.log(`Successful exports:  ${stats.successful}`);
  console.log(`Failed exports:      ${stats.failed}`);
  console.log("=".repeat(80));

  if (stats.errors.length > 0) {
    console.log("\nERRORS:");
    console.log("-".repeat(80));

    stats.errors.forEach((error, index) => {
      console.log(`\n${index + 1}. Customer ID: ${error.customerId}`);
      console.log(`   Error: ${error.error}`);
    });

    console.log("\n" + "-".repeat(80));

    // Write errors to file
    const errorLogPath = path.resolve(process.cwd(), "logs/export-errors.json");
    fs.mkdirSync(path.dirname(errorLogPath), { recursive: true });
    fs.writeFileSync(errorLogPath, JSON.stringify(stats.errors, null, 2));
    console.log(`\nDetailed error log written to: ${errorLogPath}`);
  }

  console.log(`\n✅ Export complete! CSV file: ${OUTPUT_FILE_PATH}\n`);
}

// Run the export
exportCredentials()
  .then(stats => {
    printSummary(stats);
    process.exit(0);
  })
  .catch(error => {
    console.error("\n❌ Export failed:", error);
    process.exit(1);
  });

