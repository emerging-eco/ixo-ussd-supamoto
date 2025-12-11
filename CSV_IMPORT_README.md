# Customer CSV Import - Implementation Summary

## Overview

A complete solution for bulk importing customer data from CSV files into the USSD database has been implemented. This allows pre-populating customer records programmatically, bypassing the normal USSD registration flow.

## What Was Created

### 1. Import Script

**File:** `scripts/import-customers-from-csv.ts`

Main import script that:

- Reads customer data from CSV file
- Validates phone numbers, names, and required fields
- Creates customer records in the database
- Links customers to phone numbers
- Handles duplicates gracefully (skips existing customers)
- Provides detailed progress reporting and error logging
- Uses database transactions for data integrity

### 2. Validation Script (Dry Run)

**File:** `scripts/validate-csv-import.ts`

Pre-import validation tool that:

- Checks CSV file without touching the database
- Identifies invalid phone numbers
- Detects missing required fields
- Finds duplicate phone numbers and contract references
- Provides detailed validation report

### 3. Documentation

#### Quick Start Guide

**File:** `docs/CSV_IMPORT_QUICK_START.md`

- Step-by-step instructions
- Common troubleshooting
- Quick reference for daily use

#### Comprehensive Guide

**File:** `docs/CSV_IMPORT_GUIDE.md`

- Detailed database schema mapping
- Security considerations
- Advanced customization options
- Complete troubleshooting guide

### 4. NPM Scripts

Added to `package.json`:

```json
{
  "scripts": {
    "validate:csv": "Validate CSV file (dry run)",
    "import:customers": "Import customers from CSV"
  }
}
```

## Database Schema Mapping

### CSV → Database Tables

```
CSV File: specs/Beans Distribution Tracker - Sheet1.csv
├── Contract Reference → customers.customer_id
├── Customer Name      → customers.full_name
├── Phone Numbers      → phones.phone_number (normalized to E.164)
└── Area, Collection   → (stored for reference, not in core schema)

Database Tables Created/Updated:
├── phones              (phone records)
├── customers           (customer profiles)
└── customer_phones     (phone-customer linkage)
```

### Default Values for Imported Customers

| Field       | Value              | Notes                                     |
| ----------- | ------------------ | ----------------------------------------- |
| PIN         | `1234` (encrypted) | ⚠️ Customers should change on first login |
| Language    | `eng`              | English                                   |
| Role        | `customer`         | Standard customer role                    |
| Email       | `NULL`             | Not in CSV                                |
| National ID | `NULL`             | Not in CSV                                |
| Last Action | `csv_import`       | Identifies imported customers             |

## Quick Usage

### Step 1: Validate CSV (Recommended)

```bash
npm run validate:csv
```

### Step 2: Import Customers

```bash
npm run import:customers
```

### Step 3: Verify Import

```sql
SELECT COUNT(*) FROM customers WHERE last_completed_action = 'csv_import';
```

## Key Features

### ✅ Data Validation

- Phone number normalization (supports multiple formats)
- Customer name validation (2-255 characters)
- Required field checking
- Duplicate detection

### ✅ Error Handling

- Graceful failure (one bad record doesn't stop import)
- Detailed error logging to `logs/import-errors.json`
- Transaction-based imports (atomic operations)
- Comprehensive error reporting

### ✅ Safety Features

- Dry-run validation script
- Skips existing customers (no overwrites)
- Database transactions (rollback on failure)
- Detailed audit trail

### ✅ Performance

- Batch processing (configurable batch size)
- Efficient database queries
- Progress reporting during import

## CSV File Format

**Location:** `specs/Beans Distribution Tracker - Sheet1.csv`

**Required Columns:**

```csv
UniqueID,Contract Reference,Customer Name ,Phone Numbers,Area,Collection Name,...
100614068,C377360011,Josephat Masiliso Kubama,260977202978,Matero,Matero shop,...
```

**Phone Number Formats Accepted:**

- `260977202978` (with country code)
- `0977202978` (without country code)
- `977202978` (mobile only)
- `+260977202978` (E.164 format)

All formats are normalized to E.164: `+260977202978`

## Import Process Flow

```
1. Read CSV File
   ↓
2. Parse and Validate Each Row
   ├─ Validate phone number
   ├─ Validate customer name
   └─ Check required fields
   ↓
3. Check for Existing Customer
   ├─ If exists → Skip (count as "Skipped")
   └─ If new → Continue
   ↓
4. Database Transaction
   ├─ Create/Get phone record
   ├─ Create customer record
   └─ Link customer to phone
   ↓
5. Report Results
   ├─ Success count
   ├─ Skipped count
   ├─ Failed count
   └─ Error details
```

## Security Considerations

### ⚠️ Default PIN Security

**All imported customers have PIN: `1234`**

**Recommendations:**

1. Inform customers to change PIN on first login
2. Consider implementing forced PIN change on first USSD access
3. Update `DEFAULT_PIN` in script if different default is needed

### Database Access

- Script requires database credentials in `.env`
- Use read-write database user
- Test in development/staging before production
- Always backup database before import

## Verification Steps

### 1. Check Import Statistics

Review console output for counts:

- Total records processed
- Successfully imported
- Skipped (existing customers)
- Failed (with errors)

### 2. Query Database

```sql
-- Count imported customers
SELECT COUNT(*) FROM customers WHERE last_completed_action = 'csv_import';

-- View recent imports
SELECT customer_id, full_name, created_at
FROM customers
WHERE last_completed_action = 'csv_import'
ORDER BY created_at DESC
LIMIT 10;

-- Verify phone linkage
SELECT c.customer_id, c.full_name, p.phone_number
FROM customers c
JOIN customer_phones cp ON c.id = cp.customer_id
JOIN phones p ON cp.phone_id = p.id
WHERE c.last_completed_action = 'csv_import';
```

### 3. Test USSD Access

1. Dial USSD code from imported phone number
2. System should recognize customer
3. Login with default PIN `1234`
4. Verify customer can access services

## Troubleshooting

| Issue                         | Solution                                                          |
| ----------------------------- | ----------------------------------------------------------------- |
| CSV file not found            | Ensure file is at `specs/Beans Distribution Tracker - Sheet1.csv` |
| Database connection error     | Check `.env` credentials                                          |
| Invalid phone numbers         | Run `npm run validate:csv` to identify issues                     |
| Duplicate contract references | Check CSV for duplicates, remove or update                        |
| Import fails mid-process      | Check `logs/import-errors.json` for details                       |

## Files Modified/Created

### Created Files

- ✅ `scripts/import-customers-from-csv.ts` - Main import script
- ✅ `scripts/validate-csv-import.ts` - Validation script
- ✅ `docs/CSV_IMPORT_GUIDE.md` - Comprehensive documentation
- ✅ `docs/CSV_IMPORT_QUICK_START.md` - Quick reference
- ✅ `CSV_IMPORT_README.md` - This file

### Modified Files

- ✅ `package.json` - Added npm scripts

### No Changes Required

- ✅ Database schema (uses existing tables)
- ✅ USSD application code (no modifications needed)
- ✅ Existing customer records (not affected)

## Next Steps

1. **Test in Development**

   ```bash
   npm run validate:csv
   npm run import:customers
   ```

2. **Verify Results**
   - Check import statistics
   - Query database
   - Test USSD access

3. **Production Deployment**
   - Backup database
   - Run validation
   - Import customers
   - Verify and test

4. **Customer Communication**
   - Inform customers about default PIN
   - Provide instructions for PIN change
   - Share USSD access instructions

## Support

For issues or questions:

1. Check validation output: `npm run validate:csv`
2. Review error log: `logs/import-errors.json`
3. Consult documentation: `docs/CSV_IMPORT_GUIDE.md`
4. Check application logs: `logs/console.log`

---

**Status:** ✅ Ready for use
**Last Updated:** 2025-12-10
