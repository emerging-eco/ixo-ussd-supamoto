# SupaMoto Bot SDK Usage Guide

This guide provides comprehensive documentation for using the `@ixo/supamoto-bot-sdk` package in the ixo-ussd-supamoto project.

## Table of Contents

- [Overview](#overview)
- [SDK Architecture](#sdk-architecture)
- [Installation & Configuration](#installation--configuration)
- [API Client (Reading Data)](#api-client-reading-data)
- [Claims Bot Client (Submitting Claims)](#claims-bot-client-submitting-claims)
- [Database Client (Direct Database Access)](#database-client-direct-database-access)
- [Integration Examples](#integration-examples)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)

---

## Overview

The `@ixo/supamoto-bot-sdk` provides three distinct clients for interacting with the SupaMoto Bot ecosystem:

1. **API Client** (`createApiClient`) - HTTP API for reading customer data, claims, and collection IDs
2. **Claims Bot Client** (`createClaimsBotClient`) - HTTP API for submitting claims (write-only)
3. **Database Client** (`createDatabaseClient`) - Direct PostgreSQL access with automatic encryption/decryption

### Current Usage in Codebase

- **Claims Bot Client**: Used in `src/services/claims-bot.ts` and `src/services/ixo/background-ixo-creation.ts`
- **API Client**: Previously used for `getCustomerCollectionId()`, migrated to Database Client for better performance and to bypass validation issues
- **Database Client**: Used in `src/services/claims-bot-db-client.ts` for retrieving IXO accounts and customer claims data

### SDK Version

Current version: `0.1.0` (see `package.json`)

---

## SDK Architecture

### Three-Client Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  @ixo/supamoto-bot-sdk                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ API Client   │  │ Claims Bot   │  │ Database     │     │
│  │              │  │ Client       │  │ Client       │     │
│  │ (Read Data)  │  │ (Write Only) │  │ (Direct DB)  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                  │                  │            │
│         ▼                  ▼                  ▼            │
│  HTTP API Calls    HTTP API Calls    PostgreSQL Queries   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### When to Use Each Client

| Client                | Purpose                     | Use Cases                                             | Authentication                        |
| --------------------- | --------------------------- | ----------------------------------------------------- | ------------------------------------- |
| **API Client**        | Read customer data via HTTP | Search customers, get claims, retrieve collection IDs | Access Token                          |
| **Claims Bot Client** | Submit claims               | Lead creation, 1000-day household claims              | Access Token                          |
| **Database Client**   | Direct database access      | Bulk operations, complex queries, encrypted data      | Database credentials + Encryption key |

---

## Installation & Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Claims Bot Configuration
# Used for submitting claims via the ixo-supamoto-bot-sdk
# - Lead creation claims (submitted during customer account creation)
# - 1,000 Day Household survey claims
CLAIMS_BOT_URL=https://your-claims-bot-url.com
CLAIMS_BOT_ACCESS_TOKEN=your-access-token-here

# Database Client Configuration (if using direct database access)
# CLAIMS_BOT_DB_ENCRYPTION_KEY=base64-encoded-encryption-key
```

### Import SDK Components

```typescript
import {
  createApiClient,
  createClaimsBotClient,
  createDatabaseClient,
  ClaimsBotTypes,
  utils,
} from "@ixo/supamoto-bot-sdk";

// Import types
import type {
  ICustomer,
  IClaim,
  IPhone,
  IIxoAccount,
} from "@ixo/supamoto-bot-sdk";
```

---

## API Client (Reading Data)

The API Client provides HTTP-based access to customer data, claims, and collection IDs.

### Creating the API Client

```typescript
import { createApiClient } from "@ixo/supamoto-bot-sdk";
import { config } from "../config.js";

const api = createApiClient({
  botUrl: config.CLAIMS_BOT.URL,
  accessToken: config.CLAIMS_BOT.ACCESS_TOKEN,
});
```

### Reading Customer Data

#### Get a Single Customer

```typescript
// Get customer by ID
const customer = await api.customers.v1.getCustomer({
  customerId: "C12345678",
});

console.log(customer);
// {
//   customer_id: 'C12345678',
//   full_name: Buffer,  // Encrypted
//   email: Buffer,      // Encrypted
//   status: 'active',
//   preferred_language: 'en',
//   created_at: '2024-01-15T10:30:00Z',
//   ...
// }
```

#### Get Multiple Customers

```typescript
// Get multiple customers by IDs
const customers = await api.customers.v1.getCustomers({
  customerIds: ["C12345678", "C87654321"],
});

console.log(customers); // Array of ICustomer objects
```

#### Search Customers

```typescript
// Search customers with filters
const searchResults = await api.customers.v1.searchCustomers({
  queue: "screening", // Optional: Filter by queue status
  search: "John", // Optional: Search term (name, phone, etc.)
  country: "ZM", // Optional: Country code (ZM, MW)
  queued: true, // Optional: Filter by queued status
  limit: 10, // Optional: Results per page (default: 10)
  offset: 0, // Optional: Pagination offset (default: 0)
});

console.log(searchResults);
// {
//   customers: [...],  // Array of ICustomer objects
//   total: 42,         // Total matching customers
//   limit: 10,
//   offset: 0
// }
```

### Reading Claims Data

#### Get Customer Claims

```typescript
// Get all claims for a customer
const customerClaims = await api.claims.v1.getCustomerClaims({
  customerId: "C12345678",
});

console.log(customerClaims); // Array of IClaim objects
```

#### Get Claims by Collection

```typescript
// Get claims for a specific collection
const collectionClaims = await api.claims.v1.getCollectionClaims({
  collectionId: "collection-123",
});

// Get claims for multiple collections
const multipleCollectionClaims = await api.claims.v1.getCollectionClaims({
  collectionIds: ["collection-123", "collection-456"],
});
```

#### Get a Specific Claim

```typescript
// Get claim by ID
const claim = await api.claims.v1.getClaim({
  claimId: "claim-123",
  collectionId: "collection-123",
});

console.log(claim);
// {
//   claim_id: 'claim-123',
//   customer_id: 'C12345678',
//   collection_id: 'collection-123',
//   status: 'approved',
//   created_at: '2024-01-15T10:30:00Z',
//   ...
// }
```

### Reading Collection IDs

```typescript
// Get all collection IDs
const collectionIds = await api.collectionIds.v1.getCollectionIds();
console.log(collectionIds);
// {
//   lead: 'collection-123',
//   screening: 'collection-456',
//   contract: 'collection-789',
//   onboardingFee: 'collection-012',
//   ...
// }

// Get a specific collection ID
const leadCollectionId = await api.collectionIds.v1.getCollectionId({
  collectionKey: "lead", // 'lead', 'screening', 'contract', etc.
});
```

### Override Parameters

All API methods support optional override parameters for bot URL and access token:

```typescript
// Use different credentials for a specific call
const customer = await api.customers.v1.getCustomer(
  { customerId: "C12345678" },
  "https://different-bot-url.com", // Override bot URL
  "different-access-token" // Override access token
);
```

---

## Claims Bot Client (Submitting Claims)

The Claims Bot Client is used for submitting various types of claims to the SupaMoto Bot system.

### Creating the Claims Bot Client

```typescript
import { createClaimsBotClient } from "@ixo/supamoto-bot-sdk";
import { config } from "../config.js";

const claimsBot = createClaimsBotClient({
  botUrl: config.CLAIMS_BOT.URL,
  accessToken: config.CLAIMS_BOT.ACCESS_TOKEN,
});
```

**Current Implementation**: See `src/services/claims-bot.ts` for the singleton pattern used in this codebase.

### Submitting Lead Creation Claims

Lead creation claims are submitted during customer account creation.

```typescript
import { ClaimsBotTypes } from "@ixo/supamoto-bot-sdk";

const leadClaim = await claimsBot.claims.v1.submitLeadCreationClaim({
  customerId: "C12345678", // Required
  nationalId: "123456789", // Optional
  leadGenerator: ClaimsBotTypes.LeadGenerator.ussdSignup, // Required
  leadGeneratorName: "John Doe", // Optional (required if leadGenerator is 'Lead Generator')
  givenName: "Jane", // Optional
  familyName: "Smith", // Optional
  telephone: "+260123456789", // Optional
});

console.log(leadClaim.data.claimId); // 'claim-123'
```

**Current Usage**: See `src/services/ixo/lead-claim-submission.ts` for implementation.

### Submitting 1,000 Day Household Claims

1,000 Day Household claims are submitted after completing the survey questionnaire.

```typescript
import { ClaimsBotTypes } from "@ixo/supamoto-bot-sdk";

const householdClaim = await claimsBot.claims.v1.submit1000DayHouseholdClaim({
  leadGeneratorId: "LG-123", // Required
  customerId: "C12345678", // Required
  beneficiaryCategory: [ClaimsBotTypes.BeneficiaryCategory.pregnant], // Required: array
  childMaxAge: 18, // Required: 1-23 months
  beanIntakeFrequency: ClaimsBotTypes.BeanIntakeFrequency.daily, // Required
  priceSpecification: "5 ZMW", // Required
  awarenessIronBeans: ClaimsBotTypes.AwarenessIronBeans.yes, // Required
  knowsNutritionalBenefits: ClaimsBotTypes.KnowsNutritionalBenefits.yes, // Required
  nutritionalBenefitsDetails: [
    ClaimsBotTypes.NutritionalBenefitsDetail.ironStatus,
    ClaimsBotTypes.NutritionalBenefitsDetail.cognitiveSupport,
  ], // Required: array
  antenatalCardVerified: true, // Required
});

console.log(householdClaim.data.claimId); // 'claim-456'
```

**Current Usage**: See `src/services/claims-bot.ts` function `submit1000DayHouseholdClaim()` for implementation with enum mapping.

### Supported Enums

The SDK provides type-safe enums for claim submission:

```typescript
import { ClaimsBotTypes } from "@ixo/supamoto-bot-sdk";

// Countries
ClaimsBotTypes.Country.Zambia; // 'ZM'
ClaimsBotTypes.Country.Malawi; // 'MW'

// Currencies
ClaimsBotTypes.Currency.ZambianKwacha; // 'ZMW'
ClaimsBotTypes.Currency.MalawianKwacha; // 'MWK'

// Payment Providers
ClaimsBotTypes.PaymentProvider.MTN; // 'mtn'
ClaimsBotTypes.PaymentProvider.ZAMTEL; // 'zamtel'
ClaimsBotTypes.PaymentProvider.TNM; // 'tnm'
ClaimsBotTypes.PaymentProvider.AIRTEL; // 'airtel'

// Beneficiary Categories
ClaimsBotTypes.BeneficiaryCategory.pregnant; // 'Pregnant Woman'
ClaimsBotTypes.BeneficiaryCategory.breastfeeding; // 'Breastfeeding Woman'
ClaimsBotTypes.BeneficiaryCategory.child; // 'Child Below 2 Years'

// Bean Intake Frequency
ClaimsBotTypes.BeanIntakeFrequency.none; // 'None at all'
ClaimsBotTypes.BeanIntakeFrequency.oneOrTwo; // '1-2 times a week'
ClaimsBotTypes.BeanIntakeFrequency.threeOrFour; // '3-4 times a week'
ClaimsBotTypes.BeanIntakeFrequency.fiveOrSize; // '5-6 times a week'
ClaimsBotTypes.BeanIntakeFrequency.daily; // 'Daily'

// Awareness Iron Beans
ClaimsBotTypes.AwarenessIronBeans.yes; // 'Yes'
ClaimsBotTypes.AwarenessIronBeans.no; // 'No'

// Knows Nutritional Benefits
ClaimsBotTypes.KnowsNutritionalBenefits.yes; // 'Yes'
ClaimsBotTypes.KnowsNutritionalBenefits.no; // 'No'

// Nutritional Benefits Details
ClaimsBotTypes.NutritionalBenefitsDetail.ironStatus; // 'iron_status'
ClaimsBotTypes.NutritionalBenefitsDetail.cognitiveSupport; // 'cognitive_support'
ClaimsBotTypes.NutritionalBenefitsDetail.workCapacity; // 'work_capacity'
ClaimsBotTypes.NutritionalBenefitsDetail.highIronZinc; // 'high_iron_zinc'
ClaimsBotTypes.NutritionalBenefitsDetail.protein_fiber; // 'protein_fiber'

// Lead Generators
ClaimsBotTypes.LeadGenerator.callCenter; // 'Call Center'
ClaimsBotTypes.LeadGenerator.leadGenerator; // 'Lead Generator'
ClaimsBotTypes.LeadGenerator.resellerShop; // 'Reseller Shop'
ClaimsBotTypes.LeadGenerator.ussdSignup; // 'USSD Signup'
```

### Other Claim Types

The SDK also supports:

- **Onboarding Fee Claims**: `submitOnboardingFeeClaim()`
- **Fuel Purchase Claims**: `submitFuelPurchaseClaim()`
- **Fuel Delivery Claims**: `submitFuelDeliveryClaim()`

See the [SDK README](../../node_modules/@ixo/supamoto-bot-sdk/README.md) for detailed examples.

---

## Database Client (Direct Database Access)

The Database Client provides direct PostgreSQL access with automatic encryption/decryption of sensitive fields.

⚠️ **Note**: This client is NOT currently used in the codebase. The existing code uses Kysely for database operations.

### Creating the Database Client

```typescript
import { createDatabaseClient } from "@ixo/supamoto-bot-sdk";

const db = createDatabaseClient({
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  port: parseInt(process.env.PG_PORT || "5432"),
  ssl: false,

  // Optional: Connection pool configuration
  max: 20, // Maximum number of clients in pool
  min: 5, // Minimum number of clients in pool
  idleTimeoutMillis: 30000, // Idle timeout
  connectionTimeoutMillis: 2000, // Connection timeout
});
```

### Encryption Key Requirement

The Database Client requires a base64-encoded encryption key for automatic encryption/decryption:

```bash
# Add to .env
CLAIMS_BOT_DB_ENCRYPTION_KEY=base64-encoded-encryption-key
```

**Important**: The Database Client handles encryption automatically, unlike manual Kysely queries which require explicit encryption/decryption.

### Reading Customer Data

```typescript
// Select a single customer (with automatic decryption)
const customer = await db.customers.v1.selectCustomer({
  customerId: "C12345678",
});

console.log(customer);
// {
//   customer_id: 'C12345678',
//   full_name: Buffer,  // Decrypted automatically
//   email: Buffer,      // Decrypted automatically
//   status: 'active',
//   ...
// }

// Select multiple customers
const customers = await db.customers.v1.selectCustomers({
  customerIds: ["C12345678", "C87654321"],
});
```

### Reading IXO Accounts

```typescript
// Get IXO accounts by customer ID
const ixoAccounts = await db.ixoAccounts.v1.selectIxoAccountsByCustomerId({
  customerId: "C12345678",
});

console.log(ixoAccounts);
// [
//   {
//     address: 'ixo1abc123...',
//     did: 'did:ixo:123',
//     customer_id: 'C12345678',
//     encrypted_mnemonic: '...',
//     is_primary: true,
//     ...
//   }
// ]

// Get IXO account by DID
const accountsByDid = await db.ixoAccounts.v1.selectIxoAccountsByDid({
  did: "did:ixo:123",
});
```

### Reading Phone Data

```typescript
// Get phone by ID
const phone = await db.phones.v1.selectPhone({
  id: "phone-123",
});

// Get multiple phones
const phones = await db.phones.v1.selectPhones({
  ids: ["phone-123", "phone-456"],
});
```

### Reading Claims

```typescript
// Get claims by customer ID
const claims = await db.claims.v1.selectClaimsByCustomerId({
  customerId: "C12345678",
});

// Get claims by collection ID
const collectionClaims = await db.claims.v1.selectClaimsByCollectionId({
  collectionId: "collection-123",
});

// Get claims by status
const pendingClaims = await db.claims.v1.selectClaimsByStatus({
  status: "pending",
});
```

### Using Transactions

```typescript
await db.transaction(async client => {
  // All operations within this block use the same transaction

  const customer = await db.customers.v1.insertCustomer(
    {
      customerId: "C12345678",
      status: "active",
      fullName: Buffer.from("John Doe"),
      email: Buffer.from("john@example.com"),
    },
    client // Pass transaction client
  );

  const phone = await db.phones.v1.insertPhone(
    {
      id: "phone-123",
      phoneNumber: Buffer.from("+260123456789"),
    },
    client // Pass transaction client
  );

  await db.customerPhones.v1.insertCustomerPhone(
    {
      customerId: customer.customer_id,
      phoneId: phone.id,
      isPrimary: true,
    },
    client // Pass transaction client
  );
});
```

---

## Integration Examples

### Example 1: Reading Customer Data Before Claim Submission

```typescript
import { createApiClient, createClaimsBotClient } from "@ixo/supamoto-bot-sdk";
import { config } from "../config.js";

// Create clients
const api = createApiClient({
  botUrl: config.CLAIMS_BOT.URL,
  accessToken: config.CLAIMS_BOT.ACCESS_TOKEN,
});

const claimsBot = createClaimsBotClient({
  botUrl: config.CLAIMS_BOT.URL,
  accessToken: config.CLAIMS_BOT.ACCESS_TOKEN,
});

// Read customer data first
async function submitClaimWithValidation(customerId: string) {
  try {
    // Step 1: Verify customer exists
    const customer = await api.customers.v1.getCustomer({ customerId });

    if (customer.status !== "active") {
      throw new Error(`Customer ${customerId} is not active`);
    }

    // Step 2: Check existing claims
    const existingClaims = await api.claims.v1.getCustomerClaims({
      customerId,
    });
    const hasLeadClaim = existingClaims.some(c => c.collection_id === "lead");

    if (hasLeadClaim) {
      console.log("Customer already has a lead creation claim");
      return;
    }

    // Step 3: Submit claim
    const claim = await claimsBot.claims.v1.submitLeadCreationClaim({
      customerId,
      leadGenerator: ClaimsBotTypes.LeadGenerator.ussdSignup,
      telephone: customer.phone_number,
    });

    console.log("Claim submitted:", claim.data.claimId);
  } catch (error) {
    console.error("Error submitting claim:", error);
    throw error;
  }
}
```

### Example 2: Integrating API Client into Existing Services

```typescript
// src/services/customer-data.ts
import { createApiClient } from "@ixo/supamoto-bot-sdk";
import { config } from "../config.js";
import { createModuleLogger } from "./logger.js";

const logger = createModuleLogger("customer-data");

// Singleton API client
let apiClient: ReturnType<typeof createApiClient> | null = null;

export function getApiClient() {
  if (!apiClient) {
    apiClient = createApiClient({
      botUrl: config.CLAIMS_BOT.URL,
      accessToken: config.CLAIMS_BOT.ACCESS_TOKEN,
    });
  }
  return apiClient;
}

/**
 * Get customer data from Claims Bot API
 */
export async function getCustomerData(customerId: string) {
  const api = getApiClient();

  try {
    logger.info({ customerId }, "Fetching customer data from API");

    const customer = await api.customers.v1.getCustomer({ customerId });

    logger.info(
      { customerId, status: customer.status },
      "Customer data retrieved"
    );

    return customer;
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        customerId,
      },
      "Failed to fetch customer data"
    );
    throw error;
  }
}

/**
 * Search customers by phone number
 */
export async function searchCustomersByPhone(phoneNumber: string) {
  const api = getApiClient();

  try {
    logger.info(
      { phoneNumber: phoneNumber.slice(-4) },
      "Searching customers by phone"
    );

    const results = await api.customers.v1.searchCustomers({
      search: phoneNumber,
      limit: 10,
    });

    logger.info(
      { phoneNumber: phoneNumber.slice(-4), count: results.total },
      "Customer search completed"
    );

    return results.customers;
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Failed to search customers"
    );
    throw error;
  }
}
```

### Example 3: Using SDK Alongside Kysely

The SDK complements (not replaces) existing Kysely database queries:

```typescript
import { db } from "../db/index.js"; // Kysely database
import { getApiClient } from "./customer-data.js"; // SDK API client

async function getCustomerWithClaims(customerId: string) {
  // Use Kysely for local database queries
  const localCustomer = await db
    .selectFrom("customers")
    .where("customer_id", "=", customerId)
    .selectAll()
    .executeTakeFirst();

  if (!localCustomer) {
    throw new Error(`Customer ${customerId} not found in local database`);
  }

  // Use SDK API client for Claims Bot data
  const api = getApiClient();
  const claims = await api.claims.v1.getCustomerClaims({ customerId });

  return {
    customer: localCustomer,
    claims,
  };
}
```

---

## Error Handling

### API Client Errors

```typescript
import { getApiClient } from "./customer-data.js";

async function safeGetCustomer(customerId: string) {
  const api = getApiClient();

  try {
    const customer = await api.customers.v1.getCustomer({ customerId });
    return { success: true, data: customer };
  } catch (error) {
    // Handle HTTP errors
    if (error instanceof Error) {
      if (error.message.includes("404")) {
        return { success: false, error: "Customer not found" };
      }
      if (error.message.includes("401")) {
        return { success: false, error: "Unauthorized - check access token" };
      }
      if (error.message.includes("500")) {
        return { success: false, error: "Server error - try again later" };
      }
    }

    return { success: false, error: "Unknown error occurred" };
  }
}
```

### Claims Bot Client Errors

```typescript
import { getClaimsBotClient } from "./claims-bot.js";

async function safeSubmitClaim(params: any) {
  const claimsBot = getClaimsBotClient();

  try {
    const response = await claimsBot.claims.v1.submitLeadCreationClaim(params);
    return { success: true, claimId: response.data.claimId };
  } catch (error) {
    // Log error details
    const errorMessage = error instanceof Error ? error.message : String(error);
    const httpStatusCode = (error as any)?.response?.status;

    logger.error(
      { error: errorMessage, httpStatusCode, customerId: params.customerId },
      "Claim submission failed"
    );

    // Queue for retry
    await queueFailedClaim({
      claimType: "lead_creation",
      customerId: params.customerId,
      claimData: params,
      errorMessage,
      httpStatusCode,
    });

    return { success: false, error: errorMessage };
  }
}
```

### Database Client Errors

```typescript
import { createDatabaseClient } from "@ixo/supamoto-bot-sdk";

async function safeSelectCustomer(customerId: string) {
  const db = createDatabaseClient({
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    port: parseInt(process.env.PG_PORT || "5432"),
  });

  try {
    const customer = await db.customers.v1.selectCustomer({ customerId });
    return { success: true, data: customer };
  } catch (error) {
    console.error("Database error:", error);
    return { success: false, error: "Database query failed" };
  }
}
```

---

## Best Practices

### 1. Use Singleton Pattern for Clients

Create clients once and reuse them throughout your application:

```typescript
// ✅ Good: Singleton pattern
let apiClient: ReturnType<typeof createApiClient> | null = null;

export function getApiClient() {
  if (!apiClient) {
    apiClient = createApiClient({
      botUrl: config.CLAIMS_BOT.URL,
      accessToken: config.CLAIMS_BOT.ACCESS_TOKEN,
    });
  }
  return apiClient;
}

// ❌ Bad: Creating new client on every call
export function getCustomer(customerId: string) {
  const api = createApiClient({ ... });  // Don't do this!
  return api.customers.v1.getCustomer({ customerId });
}
```

### 2. Always Wrap SDK Calls in Try-Catch

SDK operations can fail due to network issues, authentication errors, or server errors:

```typescript
// ✅ Good: Proper error handling
async function submitClaim(params: any) {
  try {
    const response = await claimsBot.claims.v1.submitLeadCreationClaim(params);
    logger.info({ claimId: response.data.claimId }, "Claim submitted");
    return response;
  } catch (error) {
    logger.error({ error }, "Claim submission failed");
    throw error;
  }
}

// ❌ Bad: No error handling
async function submitClaim(params: any) {
  return await claimsBot.claims.v1.submitLeadCreationClaim(params);
}
```

### 3. Use Type-Safe Enums

Always use the SDK's type-safe enums instead of string literals:

```typescript
import { ClaimsBotTypes } from "@ixo/supamoto-bot-sdk";

// ✅ Good: Type-safe enums
const claim = await claimsBot.claims.v1.submitLeadCreationClaim({
  customerId: "C12345678",
  leadGenerator: ClaimsBotTypes.LeadGenerator.ussdSignup,
});

// ❌ Bad: String literals (prone to typos)
const claim = await claimsBot.claims.v1.submitLeadCreationClaim({
  customerId: "C12345678",
  leadGenerator: "USSD Signup", // Might not match expected value
});
```

### 4. Log SDK Operations

Always log SDK operations for debugging and monitoring:

```typescript
// ✅ Good: Comprehensive logging
async function submitClaim(params: any) {
  logger.info({ customerId: params.customerId }, "Submitting claim");

  try {
    const response = await claimsBot.claims.v1.submitLeadCreationClaim(params);

    logger.info(
      { customerId: params.customerId, claimId: response.data.claimId },
      "Claim submitted successfully"
    );

    return response;
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Claim submission failed"
    );
    throw error;
  }
}
```

### 5. Handle Encryption Keys Securely

When using the Database Client, never hardcode encryption keys:

```typescript
// ✅ Good: Load from environment variables
const db = createDatabaseClient({
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  port: parseInt(process.env.PG_PORT || "5432"),
  // Encryption key from environment
  encryptionKey: process.env.CLAIMS_BOT_DB_ENCRYPTION_KEY,
});

// ❌ Bad: Hardcoded encryption key
const db = createDatabaseClient({
  user: "user",
  password: "password",
  encryptionKey: "my-secret-key-123", // Never do this!
});
```

### 6. Use API Client for Reads, Claims Bot for Writes

Follow the separation of concerns:

```typescript
// ✅ Good: Use appropriate client for each operation
const api = getApiClient();
const claimsBot = getClaimsBotClient();

// Read operations: Use API Client
const customer = await api.customers.v1.getCustomer({ customerId });
const claims = await api.claims.v1.getCustomerClaims({ customerId });

// Write operations: Use Claims Bot Client
const newClaim = await claimsBot.claims.v1.submitLeadCreationClaim({ ... });

// ❌ Bad: Using wrong client
// Claims Bot Client doesn't support read operations
const customer = await claimsBot.customers.v1.getCustomer({ customerId }); // Error!
```

### 7. Complement Kysely, Don't Replace It

The SDK should complement your existing Kysely database queries:

```typescript
// ✅ Good: Use both Kysely and SDK appropriately
import { db } from "../db/index.js"; // Kysely
import { getApiClient } from "./customer-data.js"; // SDK

async function getCustomerProfile(customerId: string) {
  // Use Kysely for local database queries (faster, more control)
  const localData = await db
    .selectFrom("customers")
    .where("customer_id", "=", customerId)
    .selectAll()
    .executeTakeFirst();

  // Use SDK for Claims Bot data (centralized, consistent)
  const api = getApiClient();
  const claims = await api.claims.v1.getCustomerClaims({ customerId });

  return { ...localData, claims };
}

// ❌ Bad: Replacing all Kysely queries with SDK
// This adds unnecessary network overhead for local data
```

### 8. Queue Failed Claims for Retry

Implement retry logic for failed claim submissions:

```typescript
// ✅ Good: Queue failed claims for retry
async function submitClaimWithRetry(params: any) {
  try {
    const response = await claimsBot.claims.v1.submitLeadCreationClaim(params);
    return { success: true, claimId: response.data.claimId };
  } catch (error) {
    // Log failure
    logger.error(
      { error, customerId: params.customerId },
      "Claim submission failed"
    );

    // Queue for retry
    await dataService.insertFailedClaim({
      claimType: "lead_creation",
      customerId: params.customerId,
      claimData: params,
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    return { success: false, error: "Queued for retry" };
  }
}
```

**Current Implementation**: See `src/services/ixo/background-ixo-creation.ts` lines 212-256 for retry queue implementation.

---

## Comparison Table

| Feature            | API Client                 | Claims Bot Client      | Database Client                  | Kysely (Current)          |
| ------------------ | -------------------------- | ---------------------- | -------------------------------- | ------------------------- |
| **Purpose**        | Read data via HTTP         | Submit claims via HTTP | Direct DB access                 | Direct DB access          |
| **Authentication** | Access Token               | Access Token           | DB credentials + Encryption key  | DB credentials            |
| **Encryption**     | Handled by server          | N/A                    | Automatic                        | Manual                    |
| **Network**        | HTTP API calls             | HTTP API calls         | Direct PostgreSQL                | Direct PostgreSQL         |
| **Performance**    | Slower (HTTP)              | Slower (HTTP)          | Faster (direct)                  | Faster (direct)           |
| **Use Case**       | Read customer data, claims | Submit claims          | Bulk operations, complex queries | All current DB operations |
| **Current Usage**  | Not used                   | ✅ Used                | Not used                         | ✅ Used everywhere        |

---

## Related Documentation

- **SDK README**: [node_modules/@ixo/supamoto-bot-sdk/README.md](../../node_modules/@ixo/supamoto-bot-sdk/README.md)
- **Current Claims Bot Usage**: [src/services/claims-bot.ts](../../src/services/claims-bot.ts)
- **Lead Claim Submission**: [src/services/ixo/lead-claim-submission.ts](../../src/services/ixo/lead-claim-submission.ts)
- **SupaMoto Documentation**: [README.md](./README.md)
- **Sequence Diagrams**: [SEQUENCE_DIAGRAM.md](./SEQUENCE_DIAGRAM.md)

---

## Summary

The `@ixo/supamoto-bot-sdk` provides three powerful clients for interacting with the SupaMoto Bot ecosystem:

1. **API Client**: Read customer data, claims, and collection IDs via HTTP API
2. **Claims Bot Client**: Submit claims (lead creation, 1000-day household) via HTTP API
3. **Database Client**: Direct PostgreSQL access with automatic encryption/decryption

**Current Status**:

- ✅ Claims Bot Client is actively used for claim submission
- ❌ API Client is not currently used (documented for future implementation)
- ❌ Database Client is not currently used (Kysely is used instead)

**Key Takeaways**:

- Use singleton pattern for SDK clients
- Always wrap SDK calls in try-catch blocks
- Use type-safe enums for claim submission
- Log all SDK operations for debugging
- Handle encryption keys securely
- Complement Kysely with SDK, don't replace it
- Queue failed claims for retry

For questions or issues, refer to the SDK README or contact the IXO team.
