#!/usr/bin/env ts-node
/**
 * CSV Import Validation Script (Dry Run)
 * 
 * Validates the CSV file without importing data to the database.
 * Use this to check for data quality issues before running the actual import.
 * 
 * Usage:
 *   npm run validate:csv
 *   or
 *   NODE_OPTIONS='--loader ts-node/esm' ts-node scripts/validate-csv-import.ts
 */

import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { parsePhoneNumber } from "libphonenumber-js";

// const CSV_FILE_PATH = "specs/Beans Distribution Tracker - Sheet1.csv";
const CSV_FILE_PATH = "specs/existing-customer.csv";

interface CSVRow {
  UniqueID: string;
  "Contract Reference": string;
  "Customer Name": string;
  "Phone Numbers": string;
  Area: string;
  "Collection Name": string;
}

interface ValidationIssue {
  row: number;
  field: string;
  value: string;
  issue: string;
}

interface ValidationReport {
  totalRows: number;
  validRows: number;
  issues: ValidationIssue[];
  duplicatePhones: Map<string, number[]>;
  duplicateContracts: Map<string, number[]>;
}

function normalizePhoneNumber(phoneNumber: string): string | null {
  try {
    let cleaned = phoneNumber.trim().replace(/\s+/g, "");
    
    if (!cleaned.startsWith("+")) {
      if (cleaned.startsWith("260")) {
        cleaned = "+" + cleaned;
      } else if (cleaned.startsWith("0")) {
        cleaned = "+260" + cleaned.substring(1);
      } else {
        cleaned = "+260" + cleaned;
      }
    }
    
    const parsed = parsePhoneNumber(cleaned, "ZM");
    return parsed && parsed.isValid() ? parsed.number : null;
  } catch {
    return null;
  }
}

function validateCSV(): ValidationReport {
  const report: ValidationReport = {
    totalRows: 0,
    validRows: 0,
    issues: [],
    duplicatePhones: new Map(),
    duplicateContracts: new Map(),
  };
  
  // Read CSV
  const csvPath = path.resolve(process.cwd(), CSV_FILE_PATH);
  
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV file not found: ${csvPath}`);
    process.exit(1);
  }
  
  const fileContent = fs.readFileSync(csvPath, "utf-8");
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CSVRow[];
  
  report.totalRows = records.length;
  
  const phoneMap = new Map<string, number[]>();
  const contractMap = new Map<string, number[]>();
  
  // Validate each row
  records.forEach((row, index) => {
    const rowNumber = index + 2; // +2 for header and 1-based indexing
    let rowValid = true;
    
    // Validate Contract Reference
    const contractRef = row["Contract Reference"]?.trim();
    if (!contractRef) {
      report.issues.push({
        row: rowNumber,
        field: "Contract Reference",
        value: contractRef || "",
        issue: "Missing contract reference",
      });
      rowValid = false;
    } else {
      // Track duplicates
      const existing = contractMap.get(contractRef) || [];
      existing.push(rowNumber);
      contractMap.set(contractRef, existing);
    }
    
    // Validate Customer Name
    const customerName = row["Customer Name"]?.trim();
    if (!customerName || customerName.length < 2) {
      report.issues.push({
        row: rowNumber,
        field: "Customer Name",
        value: customerName || "",
        issue: "Invalid or missing customer name (must be at least 2 characters)",
      });
      rowValid = false;
    }
    
    // Validate Phone Number
    const phoneNumber = row["Phone Numbers"];
    const normalized = normalizePhoneNumber(phoneNumber);
    
    if (!normalized) {
      report.issues.push({
        row: rowNumber,
        field: "Phone Numbers",
        value: phoneNumber,
        issue: "Invalid phone number format",
      });
      rowValid = false;
    } else {
      // Track duplicates
      const existing = phoneMap.get(normalized) || [];
      existing.push(rowNumber);
      phoneMap.set(normalized, existing);
    }
    
    if (rowValid) {
      report.validRows++;
    }
  });
  
  // Find duplicates
  phoneMap.forEach((rows, phone) => {
    if (rows.length > 1) {
      report.duplicatePhones.set(phone, rows);
    }
  });
  
  contractMap.forEach((rows, contract) => {
    if (rows.length > 1) {
      report.duplicateContracts.set(contract, rows);
    }
  });
  
  return report;
}

function printReport(report: ValidationReport): void {
  console.log("\n" + "=".repeat(80));
  console.log("CSV VALIDATION REPORT");
  console.log("=".repeat(80));
  console.log(`Total rows:       ${report.totalRows}`);
  console.log(`Valid rows:       ${report.validRows}`);
  console.log(`Invalid rows:     ${report.totalRows - report.validRows}`);
  console.log(`Validation issues: ${report.issues.length}`);
  console.log(`Duplicate phones:  ${report.duplicatePhones.size}`);
  console.log(`Duplicate contracts: ${report.duplicateContracts.size}`);
  console.log("=".repeat(80));
  
  if (report.issues.length > 0) {
    console.log("\n⚠️  VALIDATION ISSUES:");
    console.log("-".repeat(80));
    report.issues.slice(0, 20).forEach((issue, index) => {
      console.log(`${index + 1}. Row ${issue.row} - ${issue.field}:`);
      console.log(`   Value: "${issue.value}"`);
      console.log(`   Issue: ${issue.issue}`);
    });
    
    if (report.issues.length > 20) {
      console.log(`\n... and ${report.issues.length - 20} more issues`);
    }
  }
  
  if (report.duplicatePhones.size > 0) {
    console.log("\n⚠️  DUPLICATE PHONE NUMBERS:");
    console.log("-".repeat(80));
    let count = 0;
    for (const [phone, rows] of report.duplicatePhones) {
      if (count++ < 10) {
        console.log(`${phone}: rows ${rows.join(", ")}`);
      }
    }
    if (report.duplicatePhones.size > 10) {
      console.log(`... and ${report.duplicatePhones.size - 10} more duplicates`);
    }
  }
  
  if (report.duplicateContracts.size > 0) {
    console.log("\n⚠️  DUPLICATE CONTRACT REFERENCES:");
    console.log("-".repeat(80));
    let count = 0;
    for (const [contract, rows] of report.duplicateContracts) {
      if (count++ < 10) {
        console.log(`${contract}: rows ${rows.join(", ")}`);
      }
    }
    if (report.duplicateContracts.size > 10) {
      console.log(`... and ${report.duplicateContracts.size - 10} more duplicates`);
    }
  }
  
  console.log("\n" + "=".repeat(80));
  
  if (report.validRows === report.totalRows && 
      report.duplicatePhones.size === 0 && 
      report.duplicateContracts.size === 0) {
    console.log("✅ CSV file is valid and ready for import!");
  } else {
    console.log("❌ CSV file has issues that should be resolved before import");
  }
  
  console.log("=".repeat(80) + "\n");
}

// Main execution
console.log("\n🔍 Validating CSV file...\n");
const report = validateCSV();
printReport(report);

process.exit(report.validRows === report.totalRows && 
             report.duplicatePhones.size === 0 && 
             report.duplicateContracts.size === 0 ? 0 : 1);
