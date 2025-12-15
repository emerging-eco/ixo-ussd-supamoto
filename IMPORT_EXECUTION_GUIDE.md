# Customer Import - Execution Guide

## Pre-Execution Checklist

Before running the import, ensure:

- [ ] `.env` file configured with database credentials
- [ ] CSV file located at `specs/Beans Distribution Tracker - Sheet1.csv`
- [ ] Database is accessible and running
- [ ] You have a database backup (recommended for production)
- [ ] You've reviewed the CSV data for quality

## Step-by-Step Execution

### Step 1: Validate CSV File (Dry Run)

**Purpose:** Check for data quality issues without touching the database

```bash
npm run validate:csv
```

**Expected Output:**

```
🔍 Validating CSV file...

================================================================================
CSV VALIDATION REPORT
================================================================================
Total rows:       415
Valid rows:       415
Invalid rows:     0
Validation issues: 0
Duplicate phones:  0
Duplicate contracts: 0
================================================================================
✅ CSV file is valid and ready for import!
================================================================================
```

**If validation fails:**

1. Review the validation issues listed
2. Fix the CSV file
3. Re-run validation
4. Proceed only when validation passes

### Step 2: Run the Import

**Purpose:** Import customer data into the database

```bash
npm run import:customers
```

**Expected Output:**

```
🚀 Starting Customer Data Import...

[INFO] Initializing database connection
[INFO] Database connection verified
[INFO] Reading CSV file
[INFO] CSV file parsed successfully: 415 records
[INFO] Starting customer import: 415 total
[INFO] Processing batch 1/9 (50 records)
[INFO] Batch completed: 50/415 processed
...
[INFO] Processing batch 9/9 (15 records)
[INFO] Batch completed: 415/415 processed

================================================================================
CUSTOMER IMPORT REPORT
================================================================================
Total records:         415
Successfully imported: 415
Skipped (existing):    0
Failed:                0
================================================================================
✅ Import completed successfully
================================================================================
```

### Step 3: Verify the Import

**Purpose:** Confirm customers were imported correctly

#### SQL Verification Queries

```sql
-- Count imported customers
SELECT COUNT(*) FROM customers WHERE last_completed_action = 'csv_import';

-- View sample of imported customers
SELECT customer_id, full_name, preferred_language, created_at
FROM customers
WHERE last_completed_action = 'csv_import'
ORDER BY created_at DESC
LIMIT 10;

-- Verify phone linkage
SELECT c.customer_id, c.full_name, p.phone_number
FROM customers c
JOIN customer_phones cp ON c.id = cp.customer_id
JOIN phones p ON cp.phone_id = p.id
WHERE c.last_completed_action = 'csv_import'
LIMIT 10;
```

### Step 4: Test USSD Access

1. **Select a test customer** from the imported list
2. **Dial the USSD code** from that customer's phone number
3. **System should recognize** the customer
4. **Login with default PIN:** `1234`
5. **Verify access** to USSD services

## Understanding the Output

### Import Statistics

| Metric                    | Description                                     |
| ------------------------- | ----------------------------------------------- |
| **Total records**         | Number of rows in CSV file                      |
| **Successfully imported** | New customers created in database               |
| **Skipped (existing)**    | Customers already in database (by phone number) |
| **Failed**                | Records that couldn't be imported due to errors |

## Troubleshooting

### Issue: "CSV file not found"

**Solution:**

1. Verify file exists at `specs/Beans Distribution Tracker - Sheet1.csv`
2. Check file name matches exactly (including spaces)
3. Ensure you're running from project root directory

### Issue: "Database not initialized"

**Solution:**

1. Check `.env` file exists and has database credentials
2. Verify database is running and accessible
3. Test connection manually

### Issue: "Invalid phone number"

**Solution:**

1. Fix phone number in CSV
2. Ensure format is valid Zambian number
3. Re-run import (other customers will be skipped)

### Issue: "Duplicate key violation"

**Solution:**

1. Contract Reference already exists in database
2. Check if customer was previously imported
3. Either skip this customer or use different Contract Reference

## Post-Import Actions

### 1. Customer Communication

Inform customers about:

- ✅ Their account is now active
- ✅ Default PIN is `1234`
- ✅ They should change PIN on first login
- ✅ How to access the USSD service

### 2. Security Review

- [ ] Verify all customers have encrypted PINs
- [ ] Plan for forced PIN change on first login (optional)
- [ ] Review access logs for any anomalies

### 3. Documentation

- [ ] Record import date and statistics
- [ ] Document any issues encountered
- [ ] Update customer database documentation

---

**Last Updated:** 2025-12-10
