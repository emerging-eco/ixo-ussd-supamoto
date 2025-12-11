# CSV Import Quick Start Guide

## TL;DR - Quick Steps

```bash
# 1. Validate CSV file (dry run - no database changes)
npm run validate:csv

# 2. If validation passes, run the import
npm run import:customers

# 3. Verify the import
npm run view:db-queries
```

## Step-by-Step Instructions

### Step 1: Prepare Your Environment

Ensure your `.env` file has the correct database credentials:

```env
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=your_database_name
PG_USER=your_username
PG_PASSWORD=your_password
PIN_ENCRYPTION_KEY=your_encryption_key
```

### Step 2: Validate CSV File (Recommended)

Before importing, validate your CSV file to catch any issues:

```bash
npm run validate:csv
```

This will check for:
- ✅ Missing required fields
- ✅ Invalid phone numbers
- ✅ Invalid customer names
- ✅ Duplicate phone numbers
- ✅ Duplicate contract references

**Example Output:**
```
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

### Step 3: Run the Import

If validation passes, run the actual import:

```bash
npm run import:customers
```

**Example Output:**
```
🚀 Starting Customer Data Import...

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

### Step 4: Verify the Import

Check the database to confirm customers were imported:

```sql
-- Count imported customers
SELECT COUNT(*) FROM customers WHERE last_completed_action = 'csv_import';

-- View sample of imported customers
SELECT customer_id, full_name, preferred_language, created_at 
FROM customers 
WHERE last_completed_action = 'csv_import'
ORDER BY created_at DESC
LIMIT 10;
```

Or use the database query script:

```bash
npm run view:db-queries
```

## Important Notes

### Default PIN

⚠️ **All imported customers will have the default PIN: `1234`**

Customers should be instructed to change their PIN on first login.

### Duplicate Handling

- Customers with existing phone numbers are **skipped** (not updated)
- The script will not overwrite existing customer data
- Check the "Skipped" count in the report

### Error Handling

If errors occur:
1. Check the console output for error details
2. Review the error log: `logs/import-errors.json`
3. Fix issues in the CSV file
4. Re-run the import (already imported customers will be skipped)

## CSV File Requirements

### Location
Place your CSV file at: `specs/Beans Distribution Tracker - Sheet1.csv`

### Required Columns
- `Contract Reference` - Used as customer ID
- `Customer Name ` - Full name (note: has trailing space in header)
- `Phone Numbers` - Zambian phone number

### Phone Number Formats (All Accepted)
- `260977202978`
- `0977202978`
- `977202978`
- `+260977202978`

## Troubleshooting

### "CSV file not found"
**Solution:** Ensure CSV file is at `specs/Beans Distribution Tracker - Sheet1.csv`

### "Database not initialized"
**Solution:** Check `.env` file for correct database credentials

### "Invalid phone number"
**Solution:** 
- Ensure phone numbers are valid Zambian numbers
- Remove special characters (except `+`)
- Use validation script to identify problematic rows

### "Duplicate key violation"
**Solution:**
- Contract Reference must be unique
- Check for duplicates in CSV using validation script
- Remove or update duplicate entries

## Testing Before Production

### Test with Small Dataset

1. Create a test CSV with 5-10 rows
2. Run validation: `npm run validate:csv`
3. Run import: `npm run import:customers`
4. Verify in database
5. Test USSD access with imported phone numbers

### Backup Database

Before importing to production:

```bash
# PostgreSQL backup
pg_dump -U your_username -d your_database_name > backup_before_import.sql
```

## Post-Import Checklist

- [ ] Review import statistics (successful/skipped/failed counts)
- [ ] Check error log if any failures occurred
- [ ] Verify sample customers in database
- [ ] Test USSD access with 2-3 imported phone numbers
- [ ] Confirm customers can login with default PIN `1234`
- [ ] Plan communication to customers about their default PIN

## Need Help?

1. **Validation Issues**: Run `npm run validate:csv` to identify problems
2. **Import Errors**: Check `logs/import-errors.json` for details
3. **Database Issues**: Verify `.env` credentials and database connectivity
4. **Full Documentation**: See `docs/CSV_IMPORT_GUIDE.md`

## Advanced Options

### Change Default PIN

Edit `scripts/import-customers-from-csv.ts`:

```typescript
const DEFAULT_PIN = "1234"; // Change this value
```

### Change Batch Size

Edit `scripts/import-customers-from-csv.ts`:

```typescript
const BATCH_SIZE = 50; // Adjust for performance
```

### Custom CSV Path

Edit `scripts/import-customers-from-csv.ts`:

```typescript
const CSV_FILE_PATH = "path/to/your/file.csv";
```

## Summary

```bash
# Complete workflow
npm run validate:csv        # Validate CSV (no DB changes)
npm run import:customers    # Import to database
npm run view:db-queries     # Verify import
```

That's it! 🎉

