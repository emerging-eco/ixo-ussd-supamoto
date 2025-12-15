# Customer Data Import Guide

## Overview

This guide explains how to bulk import customer data from a CSV file into the USSD database. The import process bypasses the normal USSD registration flow and directly creates customer records, allowing customers to immediately use the USSD service.

## Prerequisites

1. **Database Access**: Ensure you have access to the PostgreSQL database
2. **Environment Variables**: Verify `.env` file contains correct database credentials:
   ```
   PG_HOST=localhost
   PG_PORT=5432
   PG_DATABASE=your_database_name
   PG_USER=your_username
   PG_PASSWORD=your_password
   PIN_ENCRYPTION_KEY=your_encryption_key
   ```
3. **CSV File**: Place your CSV file at `specs/Beans Distribution Tracker - Sheet1.csv`

## CSV File Format

The CSV file must have the following columns (header row required):

```csv
UniqueID,Contract Reference,Customer Name ,Phone Numbers,Area,Collection Name,1st Bag,2nd Bag ,3rd Bag,4th Bag,Visit by MOH,Date of Visit
```

### Required Fields

- **Contract Reference**: Used as the customer ID (e.g., `C377360011`)
- **Customer Name**: Full name of the customer (2-255 characters)
- **Phone Numbers**: Zambian phone number (will be normalized to E.164 format)

### Optional Fields

- **Area**: Customer's area/location
- **Collection Name**: Collection point name
- Other fields are stored for reference but not used in customer registration

### Phone Number Format

Phone numbers are automatically normalized. Accepted formats:
- `260977202978` (with country code)
- `0977202978` (without country code)
- `977202978` (mobile number only)
- `+260977202978` (E.164 format)

All formats will be converted to E.164 format (e.g., `+260977202978`).

## Database Schema Mapping

The import script maps CSV fields to the following database tables:

### 1. `phones` Table
- `phone_number`: Normalized from "Phone Numbers" column
- `first_seen`: Current timestamp
- `last_seen`: Current timestamp
- `number_of_visits`: 1

### 2. `customers` Table
- `customer_id`: From "Contract Reference" column
- `full_name`: From "Customer Name" column
- `email`: NULL (not in CSV)
- `national_id`: NULL (not in CSV)
- `encrypted_pin`: Default PIN "1234" (encrypted)
- `preferred_language`: "eng" (default)
- `last_completed_action`: "csv_import"
- `role`: "customer"

### 3. `customer_phones` Table (Junction)
- Links customer to phone number
- `is_primary`: true

## Running the Import

### Method 1: Using npm script (Recommended)

```bash
npm run import:customers
```

### Method 2: Direct execution

```bash
NODE_ENV=dev NODE_OPTIONS='--loader ts-node/esm' ts-node --require dotenv/config scripts/import-customers-from-csv.ts
```

## Import Process

The script performs the following steps:

1. **Initialization**
   - Connects to the database
   - Verifies database connectivity
   - Reads and parses the CSV file

2. **Validation** (for each row)
   - Validates customer name (2-255 characters)
   - Normalizes and validates phone number
   - Checks for required fields (Contract Reference, Name, Phone)

3. **Duplicate Detection**
   - Checks if a customer with the same phone number already exists
   - Skips existing customers (no updates)

4. **Import** (for each new customer)
   - Creates or retrieves phone record
   - Creates customer record with encrypted PIN
   - Links customer to phone number
   - All operations in a database transaction (atomic)

5. **Reporting**
   - Displays summary statistics
   - Lists any errors encountered
   - Writes detailed error log to `logs/import-errors.json`

## Import Behavior

### Duplicate Handling

- **Existing Customers**: Skipped (counted in "Skipped" statistics)
- **New Customers**: Imported successfully
- **No Updates**: The script does NOT update existing customer records

### Error Handling

Records that fail validation or import are:
- Logged with detailed error information
- Counted in "Failed" statistics
- Written to error log file
- Do NOT stop the import process (other records continue)

### Transaction Safety

Each customer import is wrapped in a database transaction:
- If any step fails, the entire customer record is rolled back
- No partial customer records are created
- Database integrity is maintained

## Default Values

Imported customers receive these default values:

- **PIN**: `1234` (encrypted)
- **Language**: `eng` (English)
- **Role**: `customer`
- **Email**: NULL
- **National ID**: NULL
- **Last Action**: `csv_import`

### ⚠️ Important: PIN Security

All imported customers have the default PIN `1234`. For security:

1. **Inform customers** to change their PIN on first login
2. **Consider** implementing forced PIN change on first USSD access
3. **Update** the `DEFAULT_PIN` constant in the script if needed

## Output and Reporting

### Console Output

```
================================================================================
CUSTOMER IMPORT REPORT
================================================================================
Total records:         415
Successfully imported: 400
Skipped (existing):    10
Failed:                5
================================================================================
```

### Error Log

Detailed errors are written to `logs/import-errors.json`:

```json
[
  {
    "row": 42,
    "error": "Invalid phone number",
    "data": {
      "contractRef": "C123456789",
      "name": "John Doe",
      "phone": "invalid"
    }
  }
]
```

## Verification

After import, verify the data:

### 1. Check Import Statistics

Review the console output for success/failure counts.

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
WHERE c.last_completed_action = 'csv_import'
LIMIT 10;
```

### 3. Test USSD Access

Test with an imported customer:
1. Dial the USSD code from an imported phone number
2. System should recognize the customer
3. Customer can log in with default PIN `1234`

## Troubleshooting

### Database Connection Errors

```
Error: Database not initialized
```

**Solution**: Check `.env` file for correct database credentials.

### CSV File Not Found

```
Error: CSV file not found: specs/Beans Distribution Tracker - Sheet1.csv
```

**Solution**: Ensure CSV file exists at the specified path.

### Invalid Phone Numbers

```
Failed: Invalid phone number
```

**Solution**: 
- Check phone number format in CSV
- Ensure numbers are valid Zambian numbers
- Remove any special characters except `+`

### Duplicate Customer ID

```
Error: duplicate key value violates unique constraint "customers_customer_id_key"
```

**Solution**: 
- Contract Reference must be unique
- Check for duplicate Contract References in CSV
- Existing customer with same Contract Reference already in database

## Safety Considerations

### Pre-Import Checklist

- [ ] Backup database before import
- [ ] Verify CSV file format and data quality
- [ ] Test with a small subset first (edit CSV to include only 5-10 rows)
- [ ] Ensure correct environment (dev/staging, not production initially)
- [ ] Verify database credentials in `.env`

### Post-Import Checklist

- [ ] Review import statistics
- [ ] Check error log for failed records
- [ ] Verify sample customers in database
- [ ] Test USSD access with imported customers
- [ ] Document any issues or anomalies

## Customization

### Changing Default PIN

Edit `scripts/import-customers-from-csv.ts`:

```typescript
const DEFAULT_PIN = "1234"; // Change to your preferred default PIN
```

### Changing Batch Size

```typescript
const BATCH_SIZE = 50; // Adjust based on database performance
```

### Adding Custom Fields

To import additional CSV fields:

1. Update the `CSVRow` interface
2. Modify the `importCustomer` function to extract the field
3. Add the field to the customer insert statement

## Support

For issues or questions:
1. Check the error log: `logs/import-errors.json`
2. Review application logs: `logs/console.log`
3. Verify database schema matches expectations
4. Contact development team with error details

