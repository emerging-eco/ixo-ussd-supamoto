# Railway.app Deployment Guide for IXO USSD SupaMoto Server

Comprehensive guide for deploying the IXO USSD SupaMoto server to Railway.app, a modern Platform-as-a-Service (PaaS) that simplifies Docker deployments with managed PostgreSQL, automatic HTTPS, and seamless GitHub integration.

---

## Table of Contents

- [Railway.app Platform Overview](#railwayapp-platform-overview)
- [Prerequisites and Setup](#prerequisites-and-setup)
- [Deployment Methods](#deployment-methods)
- [PostgreSQL Database Configuration](#postgresql-database-configuration)
- [Environment Variables Setup](#environment-variables-setup)
- [Dockerfile Compatibility](#dockerfile-compatibility)
- [Deployment Process](#deployment-process)
- [Railway-Specific Considerations](#railway-specific-considerations)
- [Troubleshooting Guide](#troubleshooting-guide)
- [Deployment Checklist](#deployment-checklist)
- [Best Practices](#best-practices)
- [Quick Reference](#quick-reference)

---

## Railway.app Platform Overview

### What is Railway.app?

Railway.app is a modern Platform-as-a-Service (PaaS) that provides:

- ✅ **Automatic Docker builds** - Detects Dockerfile and builds containers automatically
- ✅ **Managed PostgreSQL** - Fully managed database with automatic backups
- ✅ **GitHub integration** - Deploy on every git push with zero configuration
- ✅ **Automatic HTTPS** - Free SSL certificates with Let's Encrypt
- ✅ **Built-in monitoring** - Logs, metrics, and health checks included
- ✅ **Simple pricing** - Pay-as-you-go starting at $5/month
- ✅ **Zero DevOps** - No server management, Docker Compose, or nginx configuration

### Key Differences: Railway vs Docker Compose

| Feature                   | Docker Compose                      | Railway.app                               |
| ------------------------- | ----------------------------------- | ----------------------------------------- |
| **Infrastructure**        | Self-managed server                 | Fully managed platform                    |
| **Database**              | Self-managed PostgreSQL container   | Managed PostgreSQL service                |
| **Deployment**            | Manual or custom CI/CD              | Git push or CLI command                   |
| **Networking**            | Manual port mapping (3000:3000)     | Automatic PORT injection                  |
| **HTTPS/SSL**             | Manual setup (nginx, certbot)       | Automatic SSL certificates                |
| **Scaling**               | Manual replica configuration        | Dashboard or CLI scaling                  |
| **Monitoring**            | Self-configured (Prometheus, etc.)  | Built-in logs and metrics                 |
| **Persistent Storage**    | Docker volumes for DB and logs      | Database persistent, filesystem ephemeral |
| **Environment Variables** | .env files                          | Railway Variables dashboard               |
| **Health Checks**         | Docker HEALTHCHECK directive        | HTTP response monitoring                  |
| **Cost**                  | Server + management time            | $5-20/month + database usage              |
| **Maintenance**           | OS updates, Docker updates, backups | Fully managed by Railway                  |

### Railway-Specific Features

#### 1. Automatic DATABASE_URL Injection

When you add a PostgreSQL service, Railway automatically:

- Provisions a PostgreSQL 14+ instance
- Generates a connection string
- Injects `DATABASE_URL` environment variable into your application
- Handles connection pooling and SSL

**Format**:

```
postgresql://postgres:password@hostname.railway.internal:5432/railway
```

#### 2. Dynamic PORT Assignment

Railway assigns a random port to your application and injects it via `PORT` environment variable:

- Your app must listen on `process.env.PORT` (not hardcoded 3000)
- Railway routes external traffic to this port
- HTTPS is handled automatically

#### 3. Ephemeral Filesystem

⚠️ **CRITICAL**: Railway containers have ephemeral filesystems:

- Files written to disk are **lost on restart**
- Only PostgreSQL database is persistent
- Logs should go to stdout/stderr (Railway captures them)
- No persistent volumes like Docker Compose

#### 4. Automatic Deployments

Railway watches your GitHub repository:

- Every push to main branch triggers a new deployment
- Zero-downtime rollouts
- Automatic rollback on failure
- Deployment history and logs

---

## Prerequisites and Setup

### 1. Railway Account Creation

**Step 1: Sign Up**

```bash
# Visit Railway.app
https://railway.app

# Click "Start a New Project"
# Sign up with GitHub (recommended for seamless integration)
```

**Step 2: Authorize GitHub**

- Railway requests access to your GitHub repositories
- Grant access to the `emerging-eco/ixo-ussd-supamoto` repository
- Railway can now deploy from your repo automatically

### 2. Railway CLI Installation

#### macOS (Homebrew)

```bash
# Install via Homebrew
brew install railway

# Verify installation
railway --version
```

#### macOS/Linux (Shell Script)

```bash
# Install via shell script
curl -fsSL https://railway.app/install.sh | sh

# Add to PATH (if needed)
export PATH="$HOME/.railway/bin:$PATH"

# Verify installation
railway --version
```

#### Windows (PowerShell)

```powershell
# Install via PowerShell
iwr https://railway.app/install.ps1 | iex

# Verify installation
railway --version
```

#### npm (Cross-Platform)

```bash
# Install globally via npm
npm install -g @railway/cli

# Verify installation
railway --version
```

### 3. Repository Preparation Checklist

Before deploying to Railway, ensure your repository has:

- [ ] **Dockerfile** in repository root (✅ already exists)
- [ ] **pnpm-lock.yaml** committed to version control
- [ ] **package.json** with correct start script
- [ ] **.env.production.example** for reference (don't commit actual .env.production)
- [ ] **migrations/** directory with SQL files
- [ ] **src/config.ts** uses `process.env.PORT` and `process.env.DATABASE_URL`
- [ ] **All code pushed to GitHub** (main or production branch)

**Verify your repository**:

```bash
# Check required files exist
ls -la Dockerfile pnpm-lock.yaml package.json

# Check migrations directory
ls -la migrations/postgres/

# Verify no .env.production committed
git ls-files | grep .env.production
# Should return nothing

# Push to GitHub
git add .
git commit -m "Prepare for Railway deployment"
git push origin main
```

---

## Deployment Methods

Railway offers two deployment methods: **GitHub Integration** (recommended for automatic deployments) and **Railway CLI** (for manual control).

### Method A: GitHub Integration (Recommended)

**Advantages**:

- ✅ Automatic deployments on every git push
- ✅ Zero-downtime rollouts
- ✅ Deployment history in Railway dashboard
- ✅ Easy rollback to previous deployments
- ✅ No manual intervention needed

**Step-by-Step Instructions**:

#### Step 1: Create Railway Project from GitHub

1. **Go to Railway Dashboard**

   ```
   https://railway.app/dashboard
   ```

2. **Create New Project**
   - Click **"New Project"** button
   - Select **"Deploy from GitHub repo"**

3. **Select Repository**
   - Choose `emerging-eco/ixo-ussd-supamoto` from the list
   - If not visible, click **"Configure GitHub App"** to grant access

4. **Railway Auto-Detection**
   - Railway automatically detects the `Dockerfile` in your repository
   - Starts building the Docker image immediately
   - Shows build logs in real-time

#### Step 2: Add PostgreSQL Database

1. **Add Database Service**
   - In your Railway project, click **"+ New"**
   - Select **"Database"** → **"PostgreSQL"**

2. **Railway Provisions Database**
   - PostgreSQL 14+ instance created
   - Automatic backups enabled
   - Connection pooling configured
   - SSL enabled by default

3. **Automatic DATABASE_URL Injection**
   - Railway automatically injects `DATABASE_URL` into your application
   - No manual configuration needed
   - Format: `postgresql://postgres:password@hostname:5432/railway`

#### Step 3: Configure Environment Variables

1. **Navigate to Variables**
   - Click on your service (ixo-ussd-supamoto)
   - Go to **"Variables"** tab

2. **Add Required Variables**
   - Click **"+ New Variable"**
   - Add each variable from [Environment Variables Setup](#environment-variables-setup)
   - Railway encrypts all variables at rest

3. **Verify Auto-Injected Variables**
   - `DATABASE_URL` - Automatically set by PostgreSQL service
   - `PORT` - Automatically set by Railway (dynamic)
   - Do NOT manually set these variables

#### Step 4: Deploy

1. **Automatic Deployment**
   - Railway automatically deploys after adding variables
   - Watch build logs in **"Deployments"** tab

2. **Verify Deployment**
   - Check deployment status: **"Active"**
   - Get your Railway URL: `https://ixo-ussd-supamoto-production.up.railway.app`
   - Test health endpoint: `curl https://<railway-url>/health`

#### Step 5: Enable Automatic Deployments

1. **Configure GitHub Webhook**
   - Railway automatically sets up GitHub webhook
   - Every push to `main` branch triggers deployment

2. **Test Automatic Deployment**

   ```bash
   # Make a change
   echo "# Test" >> README.md
   git add README.md
   git commit -m "Test automatic deployment"
   git push origin main

   # Railway automatically:
   # 1. Detects push via webhook
   # 2. Builds new Docker image
   # 3. Runs migrations
   # 4. Deploys with zero downtime
   ```

---

### Method B: Railway CLI Deployment

**Advantages**:

- ✅ Manual control over deployments
- ✅ Deploy from local machine without pushing to GitHub
- ✅ Useful for testing before committing
- ✅ Can deploy specific branches

**Step-by-Step Instructions**:

#### Step 1: Login to Railway

```bash
# Login to Railway (opens browser for authentication)
railway login

# Verify login
railway whoami
```

#### Step 2: Initialize Railway Project

```bash
# Navigate to your project directory
cd /path/to/ixo-ussd-supamoto

# Initialize Railway project
railway init

# Choose option:
# - "Create a new project" (for first-time deployment)
# - "Link to existing project" (if project already exists)

# Name your project
# Example: ixo-ussd-supamoto-production
```

#### Step 3: Link to Existing Project (Optional)

```bash
# If you already created a project via dashboard
railway link

# Select your project from the list
# Example: ixo-ussd-supamoto-production
```

#### Step 4: Add PostgreSQL Database

```bash
# Add PostgreSQL service to your project
railway add --database postgresql

# Railway provisions PostgreSQL and sets DATABASE_URL automatically
# Verify database was added
railway status
```

#### Step 5: Set Environment Variables

```bash
# Set individual variables
railway variables set NODE_ENV=production
railway variables set PORT=8080
railway variables set LOG_LEVEL=info
railway variables set SYSTEM_SECRET=$(openssl rand -hex 32)
railway variables set PIN_ENCRYPTION_KEY=$(openssl rand -hex 32)

# Set multiple variables from file (NOT RECOMMENDED for production secrets)
# railway variables set --from-file .env.production

# Verify variables
railway variables
```

#### Step 6: Deploy to Railway

```bash
# Deploy current directory to Railway
railway up

# Railway will:
# 1. Detect Dockerfile
# 2. Build Docker image
# 3. Push to Railway's container registry
# 4. Run migrations (via pnpm start script)
# 5. Start the application

# View deployment logs
railway logs --follow

# Check deployment status
railway status
```

#### Step 7: Verify Deployment

```bash
# Get your Railway URL
railway domain

# Test health endpoint
curl $(railway domain)/health

# Expected response:
# {"status":"ok"}

# View application logs
railway logs --tail 100

# Check for successful startup
railway logs | grep "Server listening"
railway logs | grep "Database connection successful"
railway logs | grep "migrations completed"
```

#### Step 8: Configure Automatic Deployments (Optional)

```bash
# Link to GitHub repository for automatic deployments
# This is done via Railway dashboard:
# 1. Go to Service → Settings
# 2. Connect to GitHub repository
# 3. Select branch (main)
# 4. Enable automatic deployments

# Future deployments via git push
git add .
git commit -m "Update application"
git push origin main
# Railway automatically deploys
```

---

## PostgreSQL Database Configuration

### Provisioning PostgreSQL on Railway

Railway provides fully managed PostgreSQL with automatic backups, connection pooling, and SSL encryption.

#### Method 1: Via Railway Dashboard

**Step 1: Add PostgreSQL Service**

1. In your Railway project, click **"+ New"**
2. Select **"Database"**
3. Choose **"PostgreSQL"**
4. Railway provisions the database (takes ~30 seconds)

**Step 2: View Database Details**

1. Click on the PostgreSQL service
2. Navigate to **"Variables"** tab
3. View connection details:
   - `DATABASE_URL` - Full connection string
   - `PGHOST` - Database hostname
   - `PGPORT` - Database port (5432)
   - `PGUSER` - Database user (postgres)
   - `PGPASSWORD` - Database password
   - `PGDATABASE` - Database name (railway)

**Step 3: Automatic Injection**

- Railway automatically injects `DATABASE_URL` into your application service
- No manual configuration needed
- Connection string format:
  ```
  postgresql://postgres:password@hostname.railway.internal:5432/railway
  ```

#### Method 2: Via Railway CLI

```bash
# Add PostgreSQL to your project
railway add --database postgresql

# View database connection details
railway variables | grep PG

# Output:
# DATABASE_URL=postgresql://postgres:...
# PGHOST=containers-us-west-xxx.railway.app
# PGPORT=5432
# PGUSER=postgres
# PGPASSWORD=xxx
# PGDATABASE=railway

# Connect to database (opens psql)
railway connect postgresql
```

### Understanding Railway's DATABASE_URL

Railway automatically generates and injects `DATABASE_URL` in this format:

```
postgresql://[user]:[password]@[host]:[port]/[database]
```

**Example**:

```
postgresql://postgres:abc123xyz@containers-us-west-123.railway.app:5432/railway
```

**Your application automatically uses this** via `src/config.ts`:

```typescript
// From src/config.ts (lines 148-171)
function getDatabaseConfig() {
  // Try DATABASE_URL first (Railway provides this)
  if (process.env.DATABASE_URL) {
    try {
      return parseDatabaseUrl(process.env.DATABASE_URL);
    } catch (error) {
      logger.warn("Failed to parse DATABASE_URL, falling back...");
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
```

✅ **No code changes needed!** Your application already handles Railway's `DATABASE_URL`.

### Database Connection Configuration

**Railway's PostgreSQL Features**:

- ✅ **PostgreSQL 14+** - Latest stable version
- ✅ **Automatic backups** - Daily backups retained for 7 days
- ✅ **Connection pooling** - Built-in PgBouncer
- ✅ **SSL encryption** - All connections encrypted
- ✅ **High availability** - 99.9% uptime SLA
- ✅ **Automatic scaling** - Storage scales automatically

**Connection Pooling**:
Railway includes PgBouncer for connection pooling, but your application should also implement pooling:

```typescript
// Your existing code already uses pg Pool (from src/services/database-manager.ts)
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});
```

✅ **Already configured correctly!**

### Migration Handling

**Automatic Migrations on Deployment**:

Your `package.json` start script automatically runs migrations:

```json
// From package.json (line 12)
"start": "NODE_ENV=production dotenv -e .env node dist/src/migrations/run-migrations.js && sleep 2 && node dist/src/index.js"
```

**How it works on Railway**:

1. Railway builds your Dockerfile
2. Runs `CMD ["pnpm", "start"]` (from Dockerfile line 99)
3. This executes:
   - `run-migrations.js` - Runs all SQL migrations
   - `sleep 2` - Waits for migrations to complete
   - `index.js` - Starts the application
4. Migrations run automatically on every deployment ✅

**Migration Files**:

```bash
migrations/postgres/
├── 000-init-all.sql                           # Initial schema
└── 001-add-bean-distribution-claim-tracking.sql  # Bean distribution tables
```

**Migration Script** (`src/migrations/run-migrations.ts`):

- Reads all `.sql` files from `migrations/postgres/`
- Executes them in alphabetical order
- Uses idempotent SQL (`DROP TABLE IF EXISTS`, `CREATE TABLE IF NOT EXISTS`)
- Safe to run multiple times

**Manual Migration (if needed)**:

```bash
# Using Railway CLI
railway run node dist/src/migrations/run-migrations.js

# View migration logs
railway logs | grep migration

# Or connect to database directly
railway connect postgresql

# Then run SQL manually
\i /path/to/migration.sql
```

### Database Access and Management

**Connect to PostgreSQL via CLI**:

```bash
# Open psql connection
railway connect postgresql

# List all tables
\dt

# View table schema
\d customers

# Run queries
SELECT COUNT(*) FROM customers;
SELECT * FROM phones LIMIT 10;

# Exit psql
\q
```

**Database Backup**:

```bash
# Railway provides automatic daily backups
# To create manual backup:

# Get DATABASE_URL
railway variables | grep DATABASE_URL

# Use pg_dump (requires PostgreSQL client installed locally)
pg_dump $(railway variables get DATABASE_URL) > backup.sql

# Or via Railway CLI
railway run pg_dump > backup.sql
```

**Database Restore**:

```bash
# Restore from backup file
railway run psql < backup.sql

# Or using DATABASE_URL
psql $(railway variables get DATABASE_URL) < backup.sql
```

---

## Environment Variables Setup

Railway manages environment variables through the dashboard or CLI. All variables are encrypted at rest and injected into your application at runtime.

### Railway Auto-Injected Variables

⚠️ **CRITICAL**: Railway automatically provides these variables. **DO NOT set them manually**:

| Variable               | Description                  | Example Value                                  |
| ---------------------- | ---------------------------- | ---------------------------------------------- |
| `DATABASE_URL`         | PostgreSQL connection string | `postgresql://postgres:pass@host:5432/railway` |
| `PORT`                 | Dynamic port assignment      | `3000`, `8080`, etc. (varies)                  |
| `RAILWAY_ENVIRONMENT`  | Current environment          | `production`                                   |
| `RAILWAY_SERVICE_NAME` | Service name                 | `ixo-ussd-supamoto`                            |
| `RAILWAY_PROJECT_NAME` | Project name                 | `ixo-ussd-production`                          |

### Required Environment Variables

Below is the complete list of environment variables required for production deployment. Use `.env.production.example` as reference.

#### Setting Variables via Railway Dashboard

1. **Navigate to Variables**:
   - Go to Railway project → Service → **"Variables"** tab

2. **Add New Variable**:
   - Click **"+ New Variable"**
   - Enter **Variable Name** (e.g., `NODE_ENV`)
   - Enter **Value** (e.g., `production`)
   - Click **"Add"**

3. **Repeat for all variables** listed below

#### Setting Variables via Railway CLI

```bash
# Set individual variables
railway variables set VARIABLE_NAME=value

# Example:
railway variables set NODE_ENV=production
railway variables set PORT=8080
railway variables set LOG_LEVEL=info

# Generate and set secrets
railway variables set SYSTEM_SECRET=$(openssl rand -hex 32)
railway variables set PIN_ENCRYPTION_KEY=$(openssl rand -hex 32)

# View all variables
railway variables

# View specific variable
railway variables get NODE_ENV

# Delete variable (if needed)
railway variables delete VARIABLE_NAME
```

### Complete Variable List

#### 1. Server Configuration

```bash
# Environment mode
NODE_ENV=production

# Logging
LOG_LEVEL=info
LOG_NAME=ixo-ussd-supamoto

# Server settings
SERVER_DISABLE_REQUEST_LOGGING=false

# Port (Railway auto-injects, but can be set explicitly)
PORT=8080
TRUST_PROXY_ENABLED=true
METRICS_ENABLED=true
```

#### 2. Security (CRITICAL - Generate Unique Values)

⚠️ **NEVER use example values in production. Generate unique secrets.**

```bash
# Generate secrets locally
openssl rand -hex 32  # Use output for each secret below

# System-wide secret
SYSTEM_SECRET=<64-character-hex-string>

# PIN encryption key (CRITICAL for customer PINs)
PIN_ENCRYPTION_KEY=<64-character-hex-string>

# General encryption key
ENCRYPTION_KEY=<64-character-hex-string>

# Set on Railway
railway variables set SYSTEM_SECRET=$(openssl rand -hex 32)
railway variables set PIN_ENCRYPTION_KEY=$(openssl rand -hex 32)
railway variables set ENCRYPTION_KEY=$(openssl rand -hex 32)
```

#### 3. IXO Blockchain Configuration

```bash
# Network selection (devnet, testnet, or mainnet)
# Network type controls all blockchain URLs (RPC, Blocksync) - URLs are auto-selected based on CHAIN_NETWORK value
CHAIN_NETWORK=mainnet
```

**Network Selection**:

The `CHAIN_NETWORK` variable automatically selects the appropriate RPC URLs:

- **Mainnet**: `CHAIN_NETWORK=mainnet` → Uses `https://rpc.ixo.earth`
- **Testnet**: `CHAIN_NETWORK=testnet` → Uses `https://rpc.testnet.ixo.earth`
- **Devnet**: `CHAIN_NETWORK=devnet` → Uses `https://devnet.ixo.earth/rpc/`

URLs are defined in `src/constants/ixo-blockchain.ts` and selected automatically based on the network type.

**Gas Fees**: Blockchain transactions use self-funded wallets (LG_WALLET_MNEMONIC, EVALUATOR_WALLET_MNEMONIC). Ensure these wallets have sufficient IXO tokens for gas fees.

#### 4. Matrix Configuration

```bash
# Matrix homeserver
MATRIX_HOME_SERVER=https://mx.ixo.earth

# Matrix bot URLs
MATRIX_BOT_URL=https://rooms.bot.mx.ixo.earth
MATRIX_STATE_BOT_URL=https://state.bot.mx.ixo.earth
```

#### 5. Claims Bot Configuration

```bash
# Claims bot API endpoint
CLAIMS_BOT_URL=https://your-claims-bot-production-url.com

# Claims bot access token (CRITICAL - keep secret)
CLAIMS_BOT_ACCESS_TOKEN=<your_production_access_token>

# Optional: Database encryption key (base64-encoded)
CLAIMS_BOT_DB_ENCRYPTION_KEY=<base64_encoded_key>
```

#### 6. SMS Configuration (Africa's Talking)

```bash
# Enable SMS sending
SMS_ENABLED=true

# Africa's Talking API credentials (CRITICAL - keep secret)
AFRICASTALKING_API_KEY=<your_production_api_key>
AFRICASTALKING_USERNAME=supamoto

# Sender ID (registered with Africa's Talking)
AFRICASTALKING_SENDER_ID=SupaMoto
```

#### 7. USSD Configuration

```bash
# USSD machine type
USSD_MACHINE_TYPE=supamoto

# Service codes (comma-separated)
ZM_SERVICE_CODES=*2233#

# Support phone number
ZM_SUPPORT_PHONE=+260700000000

# OTP and security settings
OTP_VALIDITY_MINUTES=10
MAX_PIN_ATTEMPTS=3
DELIVERY_CONFIRMATION_DAYS=7
SMS_RETRY_ATTEMPTS=3

# Timezone
TIMEZONE=Africa/Nairobi
```

#### 8. Bean Distribution Configuration (CRITICAL - Wallet Mnemonics)

⚠️ **EXTREMELY SENSITIVE**: These wallet mnemonics control blockchain transactions. **NEVER commit to version control.**

```bash
# Bean distribution collection ID
BEAN_DISTRIBUTION_COLLECTION_ID=120

# Lead Generator wallet mnemonic (24 words)
LG_WALLET_MNEMONIC="word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12 word13 word14 word15 word16 word17 word18 word19 word20 word21 word22 word23 word24"

# Evaluator wallet mnemonic (24 words)
EVALUATOR_WALLET_MNEMONIC="word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12 word13 word14 word15 word16 word17 word18 word19 word20 word21 word22 word23 word24"
```

**Setting wallet mnemonics securely**:

```bash
# Store mnemonics in a secure password manager
# Set on Railway via CLI (not visible in terminal history)
railway variables set LG_WALLET_MNEMONIC="your 24 word mnemonic here"
railway variables set EVALUATOR_WALLET_MNEMONIC="your 24 word mnemonic here"

# Verify they're set (values are hidden)
railway variables | grep WALLET
```

#### 9. Claims Retry Configuration

```bash
# Retry settings for failed claims
CLAIMS_MAX_RETRIES=3
CLAIMS_RETRY_BATCH_SIZE=10
```

### Security Best Practices for Environment Variables

#### ✅ DO:

1. **Generate unique secrets for production**:

   ```bash
   openssl rand -hex 32  # For SYSTEM_SECRET, PIN_ENCRYPTION_KEY, etc.
   ```

2. **Use Railway Variables dashboard or CLI**:

   ```bash
   railway variables set SECRET_NAME=value
   ```

3. **Store wallet mnemonics in password manager**:
   - Use 1Password, LastPass, or similar
   - Never store in plain text files

4. **Rotate secrets regularly**:

   ```bash
   # Generate new secret
   NEW_SECRET=$(openssl rand -hex 32)

   # Update on Railway
   railway variables set SYSTEM_SECRET=$NEW_SECRET

   # Redeploy
   railway up
   ```

5. **Use different secrets for different environments**:
   - Development: Different secrets
   - Staging: Different secrets
   - Production: Different secrets

#### ❌ DON'T:

1. **Never commit secrets to version control**:

   ```bash
   # Add to .gitignore
   echo ".env.production" >> .gitignore
   echo "secrets/" >> .gitignore
   ```

2. **Never use example values in production**:

   ```bash
   # BAD - Don't use this
   SYSTEM_SECRET=your_system_secret

   # GOOD - Generate unique value
   SYSTEM_SECRET=$(openssl rand -hex 32)
   ```

3. **Never share secrets in chat, email, or Slack**:
   - Use secure password sharing tools
   - Railway Variables are encrypted at rest

4. **Never log secrets**:

   ```typescript
   // BAD
   console.log("Database URL:", process.env.DATABASE_URL);

   // GOOD
   console.log("Database connected");
   ```

### Verifying Environment Variables

**Via Railway Dashboard**:

1. Go to Service → Variables tab
2. Verify all required variables are set
3. Values are hidden for security (shown as `••••••••`)

**Via Railway CLI**:

```bash
# List all variables (values hidden)
railway variables

# Check specific variable exists
railway variables | grep NODE_ENV

# Count variables
railway variables | wc -l

# Verify critical variables are set
railway variables | grep -E "(DATABASE_URL|PORT|SYSTEM_SECRET|PIN_ENCRYPTION_KEY)"
```

**In Application Logs**:

```bash
# Check application startup logs
railway logs | grep "config"

# Should NOT see actual secret values
# Should see confirmation that config loaded
```

---

## Dockerfile Compatibility

Your existing multi-stage Dockerfile is **fully compatible with Railway** without any modifications. Railway's build system supports all Docker features used in your Dockerfile.

### Railway's Docker Build Process

**How Railway Builds Your Application**:

1. **Detection**: Railway automatically detects `Dockerfile` in repository root
2. **BuildKit**: Uses Docker BuildKit for efficient multi-stage builds
3. **Layer Caching**: Caches layers for faster subsequent builds
4. **Registry**: Pushes built image to Railway's container registry
5. **Deployment**: Deploys the final production stage

### Multi-Stage Build Support

Your Dockerfile uses 5 stages, all fully supported by Railway:

```dockerfile
# Stage 1: Base - Install pnpm ✅
FROM node:20-alpine AS base
RUN npm install -g pnpm@9

# Stage 2: Dependencies - Install all dependencies ✅
FROM base AS dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Stage 3: Build - Compile TypeScript ✅
FROM base AS build
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# Stage 4: Production Dependencies - Install only runtime deps ✅
FROM base AS prod-dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Stage 5: Production - Final minimal image ✅
FROM node:20-alpine AS production
# ... final production image
```

**Railway Benefits**:

- ✅ Only deploys the final `production` stage (~200MB)
- ✅ Intermediate stages cached for faster rebuilds
- ✅ Layer caching reduces build time from 5 minutes to ~30 seconds
- ✅ Automatic cleanup of intermediate images

### PORT Environment Variable Handling

⚠️ **CRITICAL**: Railway uses dynamic PORT assignment.

**How Railway Handles Ports**:

1. **Railway injects `PORT` environment variable** (e.g., `3000`, `8080`, `7000`)
2. **Your application MUST listen on `process.env.PORT`**
3. **Railway routes external traffic** to this port
4. **HTTPS is handled automatically** by Railway's load balancer

**Your Existing Code (Already Compatible)**:

```typescript
// From src/config.ts (line 211)
SERVER: {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
}

// From src/server.ts
const port = config.SERVER.PORT;
await fastify.listen({ port, host: '0.0.0.0' });
```

✅ **No changes needed!** Your application already uses `process.env.PORT`.

**Dockerfile EXPOSE Directive**:

```dockerfile
# From Dockerfile (line 88)
EXPOSE 3000
```

**Railway Behavior**:

- The `EXPOSE` directive is **informational only**
- Railway **ignores** the EXPOSE directive
- Railway uses the `PORT` environment variable instead
- Your app listens on Railway's assigned port ✅

### Health Check Configuration

**Docker HEALTHCHECK Directive**:

```dockerfile
# From Dockerfile (lines 91-93)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
```

⚠️ **Railway Limitation**: Railway does **not** use Docker's HEALTHCHECK directive.

**Railway's Health Monitoring**:

- Monitors HTTP responses on the assigned `PORT`
- If your app doesn't respond within timeout, marks as unhealthy
- Automatically restarts unhealthy containers
- No configuration needed

**Ensure Your Health Endpoint Works**:

```typescript
// Your application should have a /health endpoint
// Check src/routes/ for health endpoint implementation

// Example health endpoint:
fastify.get("/health", async (request, reply) => {
  return { status: "ok" };
});
```

**Test Health Endpoint**:

```bash
# After deployment
curl https://<railway-url>/health

# Expected response:
{"status":"ok"}
```

### Build Optimization Tips

**1. Leverage Layer Caching**:

Your Dockerfile already optimizes caching:

```dockerfile
# Copy package files first (changes infrequently)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source code last (changes frequently)
COPY . .
RUN pnpm build
```

**2. Use .dockerignore**:

Ensure `.dockerignore` excludes unnecessary files:

```bash
# .dockerignore (already exists)
node_modules/
dist/
.git/
.env*
tests/
docs/
*.md
```

**3. Commit pnpm-lock.yaml**:

```bash
# Ensure lockfile is committed
git add pnpm-lock.yaml
git commit -m "Add pnpm lockfile for reproducible builds"
git push
```

**4. Monitor Build Times**:

```bash
# View build logs via CLI
railway logs --deployment <deployment-id>

# Check build duration in Railway dashboard
# Service → Deployments → Click deployment → View build time
```

### No Dockerfile Modifications Needed

✅ **Your existing Dockerfile works perfectly on Railway**:

- ✅ Multi-stage build supported
- ✅ pnpm package manager supported
- ✅ Node.js 20 Alpine base image supported
- ✅ Non-root user (nodejs:nodejs) supported
- ✅ Dynamic PORT handling already implemented
- ✅ Health check endpoint exists
- ✅ Migrations run automatically via `pnpm start`
- ✅ dumb-init for signal handling supported

**No changes required!** Deploy as-is.

---

## Deployment Process

This section provides a detailed walkthrough of the deployment process, from initial setup to verification.

### Initial Deployment Walkthrough

#### Prerequisites Check

Before deploying, verify:

```bash
# 1. Code is pushed to GitHub
git status
git push origin main

# 2. Dockerfile exists
ls -la Dockerfile

# 3. pnpm-lock.yaml exists
ls -la pnpm-lock.yaml

# 4. Migrations directory exists
ls -la migrations/postgres/

# 5. Environment variables prepared
# Review .env.production.example for required variables
```

#### Step 1: Create Railway Project

**Via Dashboard**:

1. Go to https://railway.app/dashboard
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose `emerging-eco/ixo-ussd-supamoto`
5. Railway starts building immediately

**Via CLI**:

```bash
railway login
railway init
# Select "Create a new project"
# Name: ixo-ussd-supamoto-production
```

#### Step 2: Monitor Initial Build

**Via Dashboard**:

1. Click on your service
2. Navigate to **"Deployments"** tab
3. Click on the active deployment
4. Watch build logs in real-time

**Via CLI**:

```bash
# View build logs
railway logs --follow

# Expected output:
# [build] Step 1/5 : FROM node:20-alpine AS base
# [build] Step 2/5 : RUN npm install -g pnpm@9
# [build] Step 3/5 : COPY package.json pnpm-lock.yaml ./
# [build] Step 4/5 : RUN pnpm install --frozen-lockfile
# [build] Step 5/5 : RUN pnpm build
# [build] Successfully built image
```

#### Step 3: Add PostgreSQL Database

**Via Dashboard**:

1. In your project, click **"+ New"**
2. Select **"Database"** → **"PostgreSQL"**
3. Wait for provisioning (~30 seconds)
4. Verify `DATABASE_URL` is injected

**Via CLI**:

```bash
# Add PostgreSQL
railway add --database postgresql

# Verify DATABASE_URL
railway variables | grep DATABASE_URL
```

#### Step 4: Configure Environment Variables

**Generate Secrets**:

```bash
# Generate unique secrets
SYSTEM_SECRET=$(openssl rand -hex 32)
PIN_ENCRYPTION_KEY=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)

echo "SYSTEM_SECRET=$SYSTEM_SECRET"
echo "PIN_ENCRYPTION_KEY=$PIN_ENCRYPTION_KEY"
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY"

# Save these securely in password manager
```

**Set Variables via CLI**:

```bash
# Server configuration
railway variables set NODE_ENV=production
railway variables set PORT=8080
railway variables set LOG_LEVEL=info
railway variables set LOG_NAME=ixo-ussd-supamoto
railway variables set METRICS_ENABLED=true

# Security (use generated values)
railway variables set SYSTEM_SECRET=$SYSTEM_SECRET
railway variables set PIN_ENCRYPTION_KEY=$PIN_ENCRYPTION_KEY
railway variables set ENCRYPTION_KEY=$ENCRYPTION_KEY

# Blockchain configuration
# Network type controls all blockchain URLs (RPC, Blocksync) - URLs are auto-selected based on CHAIN_NETWORK value
railway variables set CHAIN_NETWORK=mainnet

# Matrix configuration
railway variables set MATRIX_HOME_SERVER=https://mx.ixo.earth
railway variables set MATRIX_BOT_URL=https://rooms.bot.mx.ixo.earth
railway variables set MATRIX_STATE_BOT_URL=https://state.bot.mx.ixo.earth

# Claims Bot configuration
railway variables set CLAIMS_BOT_URL=https://your-claims-bot-url.com
railway variables set CLAIMS_BOT_ACCESS_TOKEN=<your_token>

# SMS configuration
railway variables set SMS_ENABLED=true
railway variables set AFRICASTALKING_API_KEY=<your_api_key>
railway variables set AFRICASTALKING_USERNAME=supamoto
railway variables set AFRICASTALKING_SENDER_ID=SupaMoto

# USSD configuration
railway variables set USSD_MACHINE_TYPE=supamoto
railway variables set ZM_SERVICE_CODES=*2233#
railway variables set ZM_SUPPORT_PHONE=+260700000000
railway variables set OTP_VALIDITY_MINUTES=10
railway variables set MAX_PIN_ATTEMPTS=3
railway variables set DELIVERY_CONFIRMATION_DAYS=7
railway variables set SMS_RETRY_ATTEMPTS=3
railway variables set TIMEZONE=Africa/Nairobi

# Bean distribution configuration (CRITICAL - use real mnemonics)
railway variables set BEAN_DISTRIBUTION_COLLECTION_ID=120
railway variables set LG_WALLET_MNEMONIC="your 24 word mnemonic here"
railway variables set EVALUATOR_WALLET_MNEMONIC="your 24 word mnemonic here"

# Claims retry configuration
railway variables set CLAIMS_MAX_RETRIES=3
railway variables set CLAIMS_RETRY_BATCH_SIZE=10
```

**Or Set via Dashboard**:

1. Service → Variables tab
2. Click **"+ New Variable"** for each variable
3. Enter name and value
4. Click **"Add"**

#### Step 5: Trigger Deployment

**Automatic (after setting variables)**:

- Railway automatically redeploys when variables change
- Watch deployment in Deployments tab

**Manual (via CLI)**:

```bash
# Trigger deployment
railway up

# Watch logs
railway logs --follow
```

#### Step 6: Monitor Deployment

**Watch for Key Log Messages**:

```bash
# View logs
railway logs --follow

# Expected log sequence:
# 1. Migration logs
🔌 Connecting to PostgreSQL...
✅ Connected to PostgreSQL
📁 Found 2 migration file(s):
   - 000-init-all.sql
   - 001-add-bean-distribution-claim-tracking.sql
🔄 Executing migration: 000-init-all.sql
✅ Migration completed: 000-init-all.sql
🔄 Executing migration: 001-add-bean-distribution-claim-tracking.sql
✅ Migration completed: 001-add-bean-distribution-claim-tracking.sql
🎉 All migrations completed successfully!

# 2. Database connection
🔌 Attempting to initialize database connection...
✅ Database connection successful

# 3. Server startup
🚀 Starting server creation...
Environment: production
✅ Server listening on port 3000
```

### Deployment Verification Steps

After deployment completes, verify everything is working correctly.

#### 1. Check Deployment Status

**Via Dashboard**:

1. Go to Service → Deployments
2. Verify latest deployment shows **"Active"** status
3. Note the deployment URL

**Via CLI**:

```bash
# Check service status
railway status

# Expected output:
# Service: ixo-ussd-supamoto
# Status: Active
# URL: https://ixo-ussd-supamoto-production.up.railway.app
```

#### 2. Test Health Endpoint

```bash
# Get your Railway URL
RAILWAY_URL=$(railway domain)

# Test health endpoint
curl https://$RAILWAY_URL/health

# Expected response:
{"status":"ok"}

# Or with verbose output
curl -v https://$RAILWAY_URL/health

# Should show:
# HTTP/2 200
# content-type: application/json
# {"status":"ok"}
```

#### 3. Verify Database Connection

**Check Application Logs**:

```bash
# View logs
railway logs --tail 100

# Look for database connection success
railway logs | grep "Database connection successful"

# Should see:
✅ Database connection successful
```

**Connect to Database Directly**:

```bash
# Open psql connection
railway connect postgresql

# List tables (should see all migrated tables)
\dt

# Expected output:
#  Schema |            Name                | Type  | Owner
# --------+--------------------------------+-------+----------
#  public | audit_log                      | table | postgres
#  public | bean_delivery_confirmations    | table | postgres
#  public | bean_distribution_otps         | table | postgres
#  public | customers                      | table | postgres
#  public | households                     | table | postgres
#  public | lg_delivery_intents            | table | postgres
#  public | phones                         | table | postgres
#  ... (more tables)

# Check customer count
SELECT COUNT(*) FROM customers;

# Exit psql
\q
```

#### 4. Verify Migrations Ran Successfully

```bash
# Check migration logs
railway logs | grep migration

# Expected output:
🔌 Connecting to PostgreSQL...
✅ Connected to PostgreSQL
📁 Found 2 migration file(s):
   - 000-init-all.sql
   - 001-add-bean-distribution-claim-tracking.sql
🔄 Executing migration: 000-init-all.sql
✅ Migration completed: 000-init-all.sql
🔄 Executing migration: 001-add-bean-distribution-claim-tracking.sql
✅ Migration completed: 001-add-bean-distribution-claim-tracking.sql
🎉 All migrations completed successfully!
```

#### 5. Check for Errors

```bash
# Check for errors in logs
railway logs --tail 200 | grep -i error

# Should see no critical errors
# Some SDK errors may appear (handled by global error handlers)

# Check for warnings
railway logs --tail 200 | grep -i warn

# Review any warnings to ensure they're expected
```

#### 6. Test USSD Endpoint (if applicable)

```bash
# Test USSD endpoint (if you have USSD gateway configured)
curl -X POST https://$RAILWAY_URL/ussd \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "sessionId=test123&serviceCode=*2233#&phoneNumber=260970000000&text="

# Expected: USSD menu response
```

#### 7. Verify Environment Variables Loaded

```bash
# Check logs for config loading
railway logs | grep -i "config"

# Should NOT see actual secret values in logs
# Should see confirmation that config loaded successfully
```

### Automatic Deployment Triggers

Once initial deployment is complete, Railway automatically deploys on every git push.

#### Configure Automatic Deployments

**Via Dashboard**:

1. Service → Settings
2. Scroll to **"Source"** section
3. Verify GitHub repository is connected
4. Verify branch is set to `main` (or your production branch)
5. **"Auto Deploy"** should be enabled (default)

**Via CLI**:

```bash
# Check current configuration
railway status

# Automatic deployments are enabled by default when using GitHub integration
```

#### Test Automatic Deployment

```bash
# Make a small change
echo "# Test deployment" >> README.md

# Commit and push
git add README.md
git commit -m "Test automatic Railway deployment"
git push origin main

# Railway automatically:
# 1. Detects push via GitHub webhook
# 2. Starts new build
# 3. Runs migrations
# 4. Deploys new version
# 5. Zero-downtime rollout

# Watch deployment
railway logs --follow

# Or view in dashboard
# Service → Deployments → Latest deployment
```

#### Deployment Workflow

```
┌─────────────────┐
│  Git Push       │
│  (main branch)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ GitHub Webhook  │
│ Triggers Railway│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Railway Build   │
│ - Detect change │
│ - Build Docker  │
│ - Run tests     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Deploy          │
│ - Run migrations│
│ - Start app     │
│ - Health check  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Zero-Downtime   │
│ Rollout         │
│ - Old version   │
│   still running │
│ - New version   │
│   starts        │
│ - Traffic       │
│   switches      │
└─────────────────┘
```

### Viewing Logs

#### Application Logs

**Via Dashboard**:

1. Service → Deployments
2. Click on active deployment
3. View real-time logs

**Via CLI**:

```bash
# Real-time logs (follow mode)
railway logs --follow

# Last 100 lines
railway logs --tail 100

# Last 500 lines
railway logs --tail 500

# Logs since 1 hour ago
railway logs --since 1h

# Logs since specific time
railway logs --since "2024-01-10 14:00:00"

# Filter logs
railway logs | grep ERROR
railway logs | grep "Database connection"
railway logs | grep migration
```

#### Build Logs

**Via Dashboard**:

1. Service → Deployments
2. Click on a deployment
3. View **"Build Logs"** tab

**Via CLI**:

```bash
# View logs for specific deployment
railway logs --deployment <deployment-id>

# Get deployment ID
railway status
```

#### Database Logs

**Via Dashboard**:

1. Click on PostgreSQL service
2. View **"Logs"** tab

**Via CLI**:

```bash
# Connect to database and view logs
railway connect postgresql

# PostgreSQL logs are managed by Railway
# Application database queries appear in application logs
```

### Manual Deployment

If you need to deploy manually without pushing to GitHub:

**Via CLI**:

```bash
# Deploy current directory
railway up

# Deploy with verbose output
railway up --verbose

# Deploy specific service (if multiple services)
railway up --service ixo-ussd-supamoto
```

**Via Dashboard**:

1. Service → Deployments
2. Click **"Redeploy"** on any previous deployment
3. Or click **"Deploy"** to trigger new deployment

---

## Railway-Specific Considerations

Railway has some unique characteristics that differ from traditional Docker Compose deployments. Understanding these is crucial for successful production deployment.

### Ephemeral Filesystem vs Persistent Storage

⚠️ **CRITICAL**: Railway containers have **ephemeral filesystems**.

#### What This Means

**Ephemeral Filesystem**:

- Files written to disk are **lost on container restart**
- Every deployment creates a new container
- No persistent volumes like Docker Compose
- Only PostgreSQL database is persistent

**Impact on Your Application**:

1. **Logs Directory** (`/app/logs`):

   ```dockerfile
   # From Dockerfile (line 76)
   RUN mkdir -p /app/logs && chown -R nodejs:nodejs /app/logs
   ```

   **Railway Behavior**:
   - Logs written to `/app/logs` are **ephemeral**
   - Lost on restart or redeploy
   - **Solution**: Your app already logs to stdout via pino ✅
   - Railway captures stdout/stderr logs automatically

2. **Uploaded Files**:
   - If your app allows file uploads, they're lost on restart
   - **Solution**: Use external storage (AWS S3, Cloudinary, etc.)
   - Not applicable to IXO USSD (no file uploads)

3. **Database Data**:
   - PostgreSQL data is **persistent** ✅
   - Managed by Railway, not in container filesystem
   - Survives restarts and redeployments

#### Comparison: Docker Compose vs Railway

| Storage Type         | Docker Compose                      | Railway                |
| -------------------- | ----------------------------------- | ---------------------- |
| **Application Logs** | Persistent volume (`app_logs`)      | Ephemeral (use stdout) |
| **Database Data**    | Persistent volume (`postgres_data`) | Persistent (managed)   |
| **Uploaded Files**   | Persistent volume                   | Ephemeral (use S3)     |
| **Temporary Files**  | Ephemeral                           | Ephemeral              |

#### Best Practices

✅ **DO**:

- Log to stdout/stderr (your app already does this)
- Use Railway's log viewer for application logs
- Store files in external storage (S3, Cloudinary)
- Use PostgreSQL for all persistent data

❌ **DON'T**:

- Write logs to `/app/logs` (they'll be lost)
- Store uploaded files in container filesystem
- Rely on filesystem for persistent data

**Your Application is Already Compliant**:

```typescript
// From src/services/logger.ts
// Uses pino logger which outputs to stdout
export const logger = pino({
  level: config.LOG.LEVEL,
  name: config.LOG.NAME,
});

// Logs go to stdout, captured by Railway ✅
logger.info("Server started");
logger.error("Error occurred");
```

### Health Checks and Monitoring

Railway monitors your application's health differently than Docker.

#### Railway's Health Monitoring

**How It Works**:

1. Railway monitors HTTP responses on the assigned `PORT`
2. If app doesn't respond within timeout, marks as unhealthy
3. Automatically restarts unhealthy containers
4. No configuration needed

**Timeout Settings**:

- Initial startup: 60 seconds
- Health check interval: 30 seconds
- Failure threshold: 3 consecutive failures

**Your Health Endpoint**:

```typescript
// Ensure you have a /health endpoint
// Check src/routes/ for implementation

// Example:
fastify.get("/health", async (request, reply) => {
  return { status: "ok" };
});
```

#### Docker HEALTHCHECK vs Railway

**Docker HEALTHCHECK** (from your Dockerfile):

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
```

⚠️ **Railway does NOT use this directive**

**Railway Alternative**:

- Monitors HTTP responses automatically
- No HEALTHCHECK directive needed
- Ensure `/health` endpoint returns 200 OK

#### Monitoring via Railway Dashboard

**Metrics Available**:

1. **CPU Usage**: Real-time CPU utilization
2. **Memory Usage**: RAM consumption
3. **Network Traffic**: Inbound/outbound bandwidth
4. **Request Count**: HTTP requests per minute
5. **Response Time**: Average response latency

**Access Metrics**:

1. Service → **"Metrics"** tab
2. View graphs for last 1h, 24h, 7d, 30d
3. Set up alerts (Pro plan)

**Via CLI**:

```bash
# View service metrics
railway metrics

# View service status
railway status
```

### Resource Limits and Scaling

Railway automatically allocates resources based on your plan.

#### Railway Plans and Resources

| Plan      | RAM    | CPU    | Price     | Use Case             |
| --------- | ------ | ------ | --------- | -------------------- |
| **Hobby** | 512MB  | 1 vCPU | $5/month  | Development, testing |
| **Pro**   | 8GB    | 8 vCPU | $20/month | Production, scaling  |
| **Team**  | Custom | Custom | Custom    | Enterprise           |

**Recommendations for IXO USSD**:

- **Development/Staging**: Hobby plan (512MB sufficient)
- **Production**: Pro plan (better performance, scaling, support)

#### Horizontal Scaling

**Pro Plan Feature**: Scale to multiple replicas

**Via Dashboard**:

1. Service → Settings
2. Scroll to **"Replicas"**
3. Set number of replicas (1-10)
4. Railway load balances traffic automatically

**Via CLI**:

```bash
# Scale to 3 replicas (Pro plan required)
railway scale --replicas 3

# View current scale
railway status
```

**Load Balancing**:

- Railway automatically distributes traffic across replicas
- Zero-downtime deployments
- Health checks ensure only healthy replicas receive traffic

#### Vertical Scaling

Railway automatically allocates resources based on plan:

- No manual CPU/memory limits like docker-compose
- Upgrade plan for more resources
- Monitor usage in Metrics tab

**Monitor Resource Usage**:

```bash
# Via CLI
railway metrics

# Via Dashboard
# Service → Metrics → View CPU/Memory graphs
```

**Upgrade Plan**:

1. Project → Settings
2. Scroll to **"Plan"**
3. Click **"Upgrade to Pro"**
4. Confirm billing

### Custom Domains and HTTPS

Railway provides free HTTPS with automatic SSL certificate provisioning.

#### Default Railway Domain

Every service gets a free subdomain:

```
https://ixo-ussd-supamoto-production.up.railway.app
```

**Features**:

- ✅ Free subdomain
- ✅ Automatic HTTPS (Let's Encrypt)
- ✅ Auto-renewing SSL certificates
- ✅ No configuration needed

#### Adding Custom Domain

**Prerequisites**:

- Own a domain (e.g., `yourdomain.com`)
- Access to DNS settings

**Step 1: Add Domain via Dashboard**

1. Service → **"Settings"**
2. Scroll to **"Domains"**
3. Click **"+ Add Domain"**
4. Enter your domain: `ussd.yourdomain.com`
5. Railway provides CNAME target

**Step 2: Configure DNS**

Add CNAME record to your DNS provider:

```
Type: CNAME
Name: ussd
Value: <railway-provided-value>.railway.app
TTL: 3600 (or Auto)
```

**Example DNS Configuration**:

| Type  | Name | Value                                       | TTL  |
| ----- | ---- | ------------------------------------------- | ---- |
| CNAME | ussd | ixo-ussd-supamoto-production.up.railway.app | 3600 |

**Step 3: Verify Domain**

```bash
# Check DNS propagation
dig ussd.yourdomain.com

# Should show CNAME record pointing to Railway

# Test HTTPS
curl https://ussd.yourdomain.com/health

# Expected: {"status":"ok"}
```

**Step 4: SSL Certificate Provisioning**

- Railway automatically provisions SSL certificate (Let's Encrypt)
- Takes 1-5 minutes after DNS propagation
- Auto-renews every 90 days
- No manual intervention needed

#### Adding Root Domain

To use root domain (`yourdomain.com` instead of `ussd.yourdomain.com`):

**Option 1: CNAME Flattening** (if DNS provider supports):

```
Type: CNAME
Name: @
Value: ixo-ussd-supamoto-production.up.railway.app
```

**Option 2: A Record** (if CNAME not supported):

1. Railway → Service → Settings → Domains
2. Add `yourdomain.com`
3. Railway provides IP addresses
4. Add A records to DNS:

   ```
   Type: A
   Name: @
   Value: <railway-ip-1>

   Type: A
   Name: @
   Value: <railway-ip-2>
   ```

#### Multiple Domains

You can add multiple domains to one service:

```bash
# Via CLI
railway domain add ussd.yourdomain.com
railway domain add api.yourdomain.com
railway domain add ussd-prod.yourdomain.com

# List all domains
railway domain list
```

#### HTTPS Configuration

**Automatic HTTPS**:

- Railway handles SSL/TLS automatically
- No nginx or reverse proxy needed
- Certificates auto-renew
- HTTP automatically redirects to HTTPS

**Verify HTTPS**:

```bash
# Test SSL certificate
curl -v https://ussd.yourdomain.com/health

# Should show:
# * SSL connection using TLSv1.3
# * Server certificate:
#   subject: CN=ussd.yourdomain.com
#   issuer: C=US; O=Let's Encrypt
```

### Comparison: Docker Compose vs Railway

| Feature                   | Docker Compose                    | Railway.app                  |
| ------------------------- | --------------------------------- | ---------------------------- |
| **Infrastructure**        | Self-managed VPS/server           | Fully managed platform       |
| **Setup Time**            | Hours (server, Docker, nginx)     | Minutes (git push)           |
| **Database**              | Self-managed PostgreSQL container | Managed PostgreSQL service   |
| **Backups**               | Manual configuration              | Automatic daily backups      |
| **Scaling**               | Manual replica configuration      | Dashboard/CLI scaling        |
| **Load Balancing**        | Manual (nginx, HAProxy)           | Automatic                    |
| **HTTPS/SSL**             | Manual (certbot, nginx)           | Automatic (Let's Encrypt)    |
| **Monitoring**            | Self-configured (Prometheus)      | Built-in dashboard           |
| **Logs**                  | Docker logs, manual aggregation   | Centralized log viewer       |
| **Deployment**            | Manual or custom CI/CD            | Git push or CLI              |
| **Zero-Downtime**         | Manual configuration              | Automatic                    |
| **Cost**                  | Server ($10-50/mo) + time         | $5-20/mo                     |
| **Maintenance**           | OS updates, Docker updates        | Fully managed                |
| **Port Configuration**    | Manual mapping (3000:3000)        | Dynamic PORT injection       |
| **Environment Variables** | .env files                        | Railway Variables            |
| **Persistent Storage**    | Docker volumes                    | Database only (ephemeral FS) |
| **Health Checks**         | Docker HEALTHCHECK                | HTTP monitoring              |
| **Rollback**              | Manual                            | One-click in dashboard       |

**When to Use Docker Compose**:

- ✅ Full control over infrastructure
- ✅ Complex multi-service architectures
- ✅ On-premise deployment required
- ✅ Custom networking requirements

**When to Use Railway**:

- ✅ Fast deployment (minutes vs hours)
- ✅ Zero DevOps overhead
- ✅ Automatic scaling and monitoring
- ✅ Focus on code, not infrastructure
- ✅ Small to medium applications
- ✅ Startup/MVP development

---

## Troubleshooting Guide

Common issues and solutions for Railway deployments.

### Common Deployment Issues

#### Issue 1: Build Fails - "Cannot find module"

**Symptoms**:

```
Error: Cannot find module '@ixo/impactxclient-sdk'
    at Function.Module._resolveFilename (internal/modules/cjs/loader.js:880:15)
```

**Cause**: Dependencies not installed correctly during build

**Solutions**:

1. **Ensure pnpm-lock.yaml is committed**:

   ```bash
   # Check if lockfile exists
   ls -la pnpm-lock.yaml

   # If missing, generate it
   pnpm install

   # Commit to repository
   git add pnpm-lock.yaml
   git commit -m "Add pnpm lockfile"
   git push origin main
   ```

2. **Verify Dockerfile installs dependencies**:

   ```dockerfile
   # Your Dockerfile already does this (line 30-31)
   COPY package.json pnpm-lock.yaml ./
   RUN pnpm install --frozen-lockfile
   ```

3. **Clear Railway build cache**:

   ```bash
   # Via Dashboard:
   # Service → Settings → Scroll to "Danger Zone" → Clear Build Cache

   # Then redeploy
   railway up
   ```

4. **Check build logs for errors**:

   ```bash
   railway logs --deployment <deployment-id>

   # Look for npm/pnpm errors
   railway logs | grep -i "error"
   ```

#### Issue 2: Application Crashes - "ECONNREFUSED"

**Symptoms**:

```
Error: connect ECONNREFUSED 127.0.0.1:5432
    at TCPConnectWrap.afterConnect [as oncomplete] (net.js:1144:16)
```

**Cause**: Database not connected or DATABASE_URL not set

**Solutions**:

1. **Verify PostgreSQL service is running**:

   ```bash
   # Check service status
   railway status

   # Should show PostgreSQL service as "Active"
   ```

2. **Check DATABASE_URL is set**:

   ```bash
   # List all variables
   railway variables | grep DATABASE_URL

   # Should show:
   # DATABASE_URL=postgresql://postgres:...
   ```

3. **If DATABASE_URL is missing, add PostgreSQL service**:

   ```bash
   # Add PostgreSQL
   railway add --database postgresql

   # Verify it was added
   railway variables | grep DATABASE_URL

   # Redeploy
   railway up
   ```

4. **Test database connection**:

   ```bash
   # Connect to database
   railway connect postgresql

   # If connection fails, check PostgreSQL service logs
   # Dashboard → PostgreSQL service → Logs
   ```

5. **Check application logs for connection errors**:
   ```bash
   railway logs | grep -i "database"
   railway logs | grep -i "connection"
   ```

#### Issue 3: Migrations Fail

**Symptoms**:

```
Migration failed: relation "customers" already exists
```

**Cause**: Migrations already ran, or SQL syntax error

**Solutions**:

1. **Check if migrations are idempotent**:

   ```sql
   -- Your migrations use DROP TABLE IF EXISTS (idempotent)
   -- From migrations/postgres/000-init-all.sql
   DROP TABLE IF EXISTS customers;
   CREATE TABLE customers (...);
   ```

2. **View migration logs**:

   ```bash
   railway logs | grep migration

   # Should show:
   # ✅ Migration completed: 000-init-all.sql
   # ✅ Migration completed: 001-add-bean-distribution-claim-tracking.sql
   ```

3. **Run migrations manually**:

   ```bash
   # Execute migration script
   railway run node dist/src/migrations/run-migrations.js

   # View output
   railway logs --tail 50
   ```

4. **Connect to database and check tables**:

   ```bash
   # Open psql
   railway connect postgresql

   # List tables
   \dt

   # If tables exist, migrations already ran successfully

   # Drop and recreate (CAUTION: deletes data)
   DROP TABLE IF EXISTS customers CASCADE;

   # Then redeploy to run migrations
   ```

5. **Check SQL syntax errors**:

   ```bash
   # Review migration files
   cat migrations/postgres/000-init-all.sql

   # Look for syntax errors
   # Test locally with PostgreSQL
   ```

#### Issue 4: Port Binding Error

**Symptoms**:

```
Error: listen EADDRINUSE: address already in use :::3000
```

**Cause**: Application not using Railway's PORT environment variable

**Solutions**:

1. **Verify src/config.ts uses process.env.PORT**:

   ```typescript
   // From src/config.ts (line 211)
   SERVER: {
     PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
   }
   ```

   ✅ Your code already does this correctly

2. **Check application startup logs**:

   ```bash
   railway logs | grep "listening"

   # Should show:
   # Server listening on port 3000 (or Railway's assigned port)
   ```

3. **Verify PORT is injected by Railway**:

   ```bash
   # Railway automatically injects PORT
   # You should NOT manually set it

   # Check variables
   railway variables | grep PORT

   # If you manually set PORT, delete it
   railway variables delete PORT
   ```

4. **Ensure server listens on 0.0.0.0**:
   ```typescript
   // From src/server.ts
   await fastify.listen({
     port: config.SERVER.PORT,
     host: "0.0.0.0", // ✅ Correct - listens on all interfaces
   });
   ```

#### Issue 5: Environment Variables Not Loading

**Symptoms**:

```
Missing required environment variable: PIN_ENCRYPTION_KEY
```

**Cause**: Required environment variables not set in Railway

**Solutions**:

1. **List all variables**:

   ```bash
   railway variables

   # Check if PIN_ENCRYPTION_KEY is listed
   ```

2. **Set missing variable**:

   ```bash
   # Generate secret
   PIN_ENCRYPTION_KEY=$(openssl rand -hex 32)

   # Set on Railway
   railway variables set PIN_ENCRYPTION_KEY=$PIN_ENCRYPTION_KEY

   # Redeploy
   railway up
   ```

3. **Verify variable is set via dashboard**:
   - Service → Variables tab
   - Look for PIN_ENCRYPTION_KEY
   - Should show `••••••••` (hidden for security)

4. **Check application logs**:

   ```bash
   railway logs | grep "environment variable"

   # Should NOT see "Missing required environment variable"
   ```

5. **Set all required variables**:
   ```bash
   # Use the complete list from "Environment Variables Setup" section
   # Set each variable via CLI or dashboard
   ```

#### Issue 6: Health Check Fails

**Symptoms**:

- Deployment shows "Unhealthy" status
- Application keeps restarting

**Cause**: Health endpoint not responding or returning non-200 status

**Solutions**:

1. **Test health endpoint locally**:

   ```bash
   # Get Railway URL
   RAILWAY_URL=$(railway domain)

   # Test health endpoint
   curl -v https://$RAILWAY_URL/health

   # Should return:
   # HTTP/2 200
   # {"status":"ok"}
   ```

2. **Check if /health route exists**:

   ```bash
   # Search codebase for health endpoint
   grep -r "'/health'" src/

   # Should find health route definition
   ```

3. **Check application logs for errors**:

   ```bash
   railway logs | grep -i health
   railway logs | grep -i error
   ```

4. **Verify application is starting**:

   ```bash
   railway logs | grep "Server listening"

   # Should see:
   # ✅ Server listening on port 3000
   ```

5. **Increase startup timeout** (if app takes long to start):
   - Railway default: 60 seconds
   - If migrations take longer, optimize migration scripts
   - Or split migrations into separate deployment

### Debugging Failed Deployments

**Step-by-Step Debugging Process**:

#### Step 1: Check Deployment Status

```bash
# View deployment status
railway status

# Check recent deployments
# Dashboard → Service → Deployments
```

#### Step 2: View Build Logs

```bash
# View build logs for latest deployment
railway logs --deployment <deployment-id>

# Look for build errors
railway logs | grep -i "error"
railway logs | grep -i "failed"

# Common build errors:
# - Missing dependencies
# - TypeScript compilation errors
# - Docker build failures
```

#### Step 3: View Application Logs

```bash
# View real-time application logs
railway logs --follow

# View last 200 lines
railway logs --tail 200

# Filter for errors
railway logs | grep ERROR
railway logs | grep WARN

# Check for specific issues
railway logs | grep "Database connection"
railway logs | grep "migration"
railway logs | grep "Server listening"
```

#### Step 4: Verify Environment Variables

```bash
# List all variables
railway variables

# Check critical variables exist
railway variables | grep -E "(DATABASE_URL|SYSTEM_SECRET|PIN_ENCRYPTION_KEY)"

# Count variables (should be 30+)
railway variables | wc -l
```

#### Step 5: Test Database Connection

```bash
# Connect to PostgreSQL
railway connect postgresql

# If connection fails, PostgreSQL service may be down
# Check PostgreSQL service status in dashboard

# If connection succeeds, test queries
\dt  # List tables
SELECT COUNT(*) FROM customers;
```

#### Step 6: Check Resource Usage

```bash
# View metrics
railway metrics

# Check if hitting resource limits
# Dashboard → Service → Metrics
# Look for:
# - CPU usage > 90%
# - Memory usage > 90%
# - OOM (Out of Memory) errors in logs
```

#### Step 7: Review Recent Changes

```bash
# Check recent commits
git log --oneline -10

# Compare with last working deployment
git diff <last-working-commit> HEAD

# Rollback if needed (via dashboard)
# Service → Deployments → Click previous deployment → Redeploy
```

### Accessing Container Logs

Railway doesn't provide direct shell access to containers, but you can:

#### View Logs via Dashboard

1. **Application Logs**:
   - Service → Deployments → Click deployment → Logs

2. **Build Logs**:
   - Service → Deployments → Click deployment → Build Logs

3. **Database Logs**:
   - PostgreSQL service → Logs tab

#### View Logs via CLI

```bash
# Real-time application logs
railway logs --follow

# Last 100 lines
railway logs --tail 100

# Filter by level
railway logs | grep ERROR
railway logs | grep WARN
railway logs | grep INFO

# Search for specific text
railway logs | grep "Database connection"
railway logs | grep "migration"

# Logs since specific time
railway logs --since 1h
railway logs --since "2024-01-10 14:00:00"
```

#### Run One-Off Commands

```bash
# Execute command in Railway environment
railway run <command>

# Examples:
railway run node --version
railway run pnpm --version
railway run env | grep DATABASE_URL
railway run node dist/src/migrations/run-migrations.js

# Run interactive shell (limited functionality)
railway run sh
```

### Running Database Migrations Manually

If automatic migrations fail, run them manually:

#### Method 1: Railway CLI

```bash
# Run migration script
railway run node dist/src/migrations/run-migrations.js

# View output
railway logs --tail 50 | grep migration

# Expected output:
# 🔌 Connecting to PostgreSQL...
# ✅ Connected to PostgreSQL
# 🔄 Executing migration: 000-init-all.sql
# ✅ Migration completed: 000-init-all.sql
```

#### Method 2: Direct Database Access

```bash
# Connect to PostgreSQL
railway connect postgresql

# Run SQL manually
\i /path/to/migration.sql

# Or paste SQL directly
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  ...
);

# Verify tables created
\dt

# Exit
\q
```

#### Method 3: Trigger Redeploy

```bash
# Redeploy triggers migrations automatically
railway up

# Or via dashboard:
# Service → Deployments → Latest deployment → Redeploy

# Watch migration logs
railway logs --follow | grep migration
```

#### Method 4: Disable Automatic Migrations (Temporary)

If migrations keep failing and blocking deployment:

1. **Temporarily modify start script**:

   ```json
   // package.json
   "start": "NODE_ENV=production node dist/src/index.js"
   // Removed: node dist/src/migrations/run-migrations.js
   ```

2. **Deploy without migrations**:

   ```bash
   git add package.json
   git commit -m "Temporarily disable automatic migrations"
   git push origin main
   ```

3. **Run migrations manually**:

   ```bash
   railway run node dist/src/migrations/run-migrations.js
   ```

4. **Restore automatic migrations**:

   ```json
   // package.json
   "start": "NODE_ENV=production dotenv -e .env node dist/src/migrations/run-migrations.js && sleep 2 && node dist/src/index.js"
   ```

5. **Deploy with migrations restored**:
   ```bash
   git add package.json
   git commit -m "Restore automatic migrations"
   git push origin main
   ```

---

## Deployment Checklist

Use these checklists to ensure successful deployment.

### Pre-Deployment Checklist

Before deploying to Railway, verify:

- [ ] **Code Quality**
  - [ ] All tests passing locally (`pnpm test`)
  - [ ] No TypeScript errors (`pnpm tsc --noEmit`)
  - [ ] Code formatted (`pnpm format`)
  - [ ] Linting passes (`pnpm lint`)

- [ ] **Repository**
  - [ ] Code pushed to GitHub (main branch)
  - [ ] `Dockerfile` exists in repository root
  - [ ] `pnpm-lock.yaml` committed to version control
  - [ ] `.gitignore` includes `.env.production`
  - [ ] No sensitive data committed (secrets, API keys)

- [ ] **Configuration**
  - [ ] `.env.production.example` reviewed
  - [ ] All required environment variables identified
  - [ ] Secrets generated (SYSTEM_SECRET, PIN_ENCRYPTION_KEY)
  - [ ] Wallet mnemonics prepared (stored in password manager)
  - [ ] API keys obtained (Africa's Talking, Claims Bot)
  - [ ] Wallets funded with sufficient IXO tokens for gas fees

- [ ] **Database**
  - [ ] Migration files exist in `migrations/postgres/`
  - [ ] Migrations are idempotent (DROP TABLE IF EXISTS)
  - [ ] Migration scripts tested locally

- [ ] **Application**
  - [ ] Health endpoint implemented (`/health`)
  - [ ] Application uses `process.env.PORT`
  - [ ] Application uses `process.env.DATABASE_URL`
  - [ ] Logging goes to stdout/stderr (not files)

### Railway Setup Checklist

Setting up Railway project:

- [ ] **Account Setup**
  - [ ] Railway account created
  - [ ] GitHub account linked to Railway
  - [ ] Railway authorized to access repository

- [ ] **Project Creation**
  - [ ] Railway project created from GitHub repo
  - [ ] Dockerfile detected by Railway
  - [ ] Initial build completed successfully

- [ ] **Database Setup**
  - [ ] PostgreSQL service added to project
  - [ ] `DATABASE_URL` automatically injected
  - [ ] Database connection verified

- [ ] **Environment Variables**
  - [ ] All required variables set (see Environment Variables Setup)
  - [ ] Secrets generated with `openssl rand -hex 32`
  - [ ] Wallet mnemonics set securely
  - [ ] API keys configured
  - [ ] Variables verified via `railway variables`

- [ ] **Deployment Configuration**
  - [ ] GitHub integration enabled
  - [ ] Auto-deploy enabled for main branch
  - [ ] Build settings verified

### Deployment Verification Checklist

After deployment, verify:

- [ ] **Deployment Status**
  - [ ] Deployment shows "Active" status
  - [ ] No build errors in build logs
  - [ ] No application errors in logs

- [ ] **Application Health**
  - [ ] Health endpoint responds: `curl https://<railway-url>/health`
  - [ ] Returns `{"status":"ok"}`
  - [ ] HTTP status code is 200

- [ ] **Database Connection**
  - [ ] Logs show "Database connection successful"
  - [ ] Can connect via `railway connect postgresql`
  - [ ] Tables exist (verify with `\dt`)

- [ ] **Migrations**
  - [ ] Logs show "All migrations completed successfully"
  - [ ] All expected tables created
  - [ ] No migration errors in logs

- [ ] **Application Startup**
  - [ ] Logs show "Server listening on port XXXX"
  - [ ] No startup errors
  - [ ] Application responds to requests

- [ ] **Environment Variables**
  - [ ] No "Missing required environment variable" errors
  - [ ] Config loaded successfully
  - [ ] No secrets visible in logs

- [ ] **Error Check**
  - [ ] No ERROR level logs: `railway logs | grep ERROR`
  - [ ] No critical WARN logs: `railway logs | grep WARN`
  - [ ] No database connection errors

### Post-Deployment Checklist

After successful deployment:

- [ ] **Monitoring Setup**
  - [ ] Metrics dashboard reviewed
  - [ ] Baseline metrics recorded (CPU, memory, requests)
  - [ ] Alerts configured (Pro plan)

- [ ] **Domain Configuration** (if applicable)
  - [ ] Custom domain added
  - [ ] DNS CNAME record configured
  - [ ] SSL certificate provisioned
  - [ ] HTTPS working on custom domain

- [ ] **Backup Verification**
  - [ ] Automatic backups enabled (Railway default)
  - [ ] Backup schedule verified
  - [ ] Test restore procedure documented

- [ ] **Documentation**
  - [ ] Deployment documented (date, version, changes)
  - [ ] Environment variables documented (names only, not values)
  - [ ] Rollback procedure documented
  - [ ] Team access configured

- [ ] **Testing**
  - [ ] Smoke tests passed (health endpoint, basic functionality)
  - [ ] Integration tests passed (if applicable)
  - [ ] End-to-end tests passed (if applicable)

- [ ] **Security**
  - [ ] Secrets rotated from development values
  - [ ] No secrets committed to version control
  - [ ] Access controls configured
  - [ ] Audit log reviewed

- [ ] **Performance**
  - [ ] Response times acceptable
  - [ ] No memory leaks detected
  - [ ] CPU usage within limits
  - [ ] Database queries optimized

---

## Best Practices

Railway-specific best practices for production deployments.

### Railway-Specific Coding Patterns

#### 1. Use Railway's DATABASE_URL

✅ **DO**:

```typescript
// Your config.ts already does this correctly
function getDatabaseConfig() {
  if (process.env.DATABASE_URL) {
    return parseDatabaseUrl(process.env.DATABASE_URL);
  }
  // Fallback to individual vars
}
```

❌ **DON'T**:

```typescript
// Don't hardcode database connection
const dbConfig = {
  host: "localhost",
  port: 5432,
  database: "mydb",
};
```

#### 2. Use Railway's PORT Variable

✅ **DO**:

```typescript
// Your config.ts already does this correctly
SERVER: {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
}

// Listen on all interfaces
await fastify.listen({
  port: config.SERVER.PORT,
  host: '0.0.0.0'
});
```

❌ **DON'T**:

```typescript
// Don't hardcode port
const PORT = 3000;

// Don't listen on localhost only
await fastify.listen({ port: 3000, host: "localhost" });
```

#### 3. Log to stdout/stderr

✅ **DO**:

```typescript
// Your logger.ts already does this with pino
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
});

logger.info("Server started");
logger.error("Error occurred", { error });
```

❌ **DON'T**:

```typescript
// Don't write logs to files (ephemeral filesystem)
import fs from "fs";
fs.appendFileSync("/app/logs/app.log", "log message\n");
```

#### 4. Handle Graceful Shutdown

✅ **DO**:

```typescript
// Your index.ts already handles this
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully");
  await fastify.close();
  await databaseManager.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received, shutting down gracefully");
  await fastify.close();
  await databaseManager.close();
  process.exit(0);
});
```

❌ **DON'T**:

```typescript
// Don't exit immediately without cleanup
process.on("SIGTERM", () => {
  process.exit(0);
});
```

#### 5. Use Environment Variables for All Config

✅ **DO**:

```typescript
// Your config.ts already does this
export const config = {
  CHAIN_NETWORK: process.env.CHAIN_NETWORK,
  MATRIX_HOME_SERVER: process.env.MATRIX_HOME_SERVER,
  SMS_ENABLED: process.env.SMS_ENABLED === "true",
};
```

❌ **DON'T**:

```typescript
// Don't hardcode configuration
const config = {
  CHAIN_NETWORK: "mainnet",
  MATRIX_HOME_SERVER: "https://mx.ixo.earth",
};
```

#### 6. Implement Health Checks

✅ **DO**:

```typescript
// Implement /health endpoint
fastify.get("/health", async (request, reply) => {
  // Check database connection
  try {
    await db.raw("SELECT 1");
    return { status: "ok", database: "connected" };
  } catch (error) {
    reply.code(503);
    return { status: "error", database: "disconnected" };
  }
});
```

❌ **DON'T**:

```typescript
// Don't skip health checks
// Railway needs HTTP responses to monitor health
```

#### 7. Handle Database Connection Errors

✅ **DO**:

```typescript
// Your database-manager.ts already does this
async function initialize() {
  try {
    await pool.connect();
    logger.info("Database connection successful");
  } catch (error) {
    logger.error("Database connection failed", { error });
    // Retry logic or graceful degradation
  }
}
```

❌ **DON'T**:

```typescript
// Don't crash on database errors
const pool = new Pool(config);
// No error handling - app crashes if DB unavailable
```

### Security Best Practices

#### 1. Rotate Secrets Regularly

```bash
# Generate new secrets
NEW_SYSTEM_SECRET=$(openssl rand -hex 32)
NEW_PIN_KEY=$(openssl rand -hex 32)

# Update on Railway
railway variables set SYSTEM_SECRET=$NEW_SYSTEM_SECRET
railway variables set PIN_ENCRYPTION_KEY=$NEW_PIN_KEY

# Redeploy
railway up

# Schedule: Rotate every 90 days
```

#### 2. Use Different Secrets per Environment

```bash
# Development
railway variables set SYSTEM_SECRET=dev_secret_here --environment development

# Staging
railway variables set SYSTEM_SECRET=staging_secret_here --environment staging

# Production
railway variables set SYSTEM_SECRET=prod_secret_here --environment production
```

#### 3. Never Log Secrets

✅ **DO**:

```typescript
logger.info("Database connected");
logger.info("Configuration loaded");
```

❌ **DON'T**:

```typescript
logger.info("Database URL:", process.env.DATABASE_URL);
logger.info("API Key:", process.env.AFRICASTALKING_API_KEY);
```

#### 4. Use HTTPS Only

```typescript
// Redirect HTTP to HTTPS (Railway handles this automatically)
// But you can enforce it in your app:
fastify.addHook("onRequest", async (request, reply) => {
  if (
    request.headers["x-forwarded-proto"] !== "https" &&
    process.env.NODE_ENV === "production"
  ) {
    reply.redirect(301, `https://${request.hostname}${request.url}`);
  }
});
```

#### 5. Validate Environment Variables on Startup

```typescript
// Your config.ts already does this
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
```

### Monitoring and Maintenance

#### 1. Monitor Resource Usage

```bash
# Check metrics regularly
railway metrics

# Set up alerts (Pro plan)
# Dashboard → Service → Settings → Alerts
# Configure alerts for:
# - CPU > 80%
# - Memory > 80%
# - Error rate > 5%
```

#### 2. Review Logs Daily

```bash
# Check for errors
railway logs --since 24h | grep ERROR

# Check for warnings
railway logs --since 24h | grep WARN

# Monitor database queries
railway logs --since 24h | grep "slow query"
```

#### 3. Monitor Database Size

```bash
# Connect to database
railway connect postgresql

# Check database size
SELECT pg_size_pretty(pg_database_size('railway'));

# Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

# Set up alerts if size > 80% of plan limit
```

#### 4. Test Backups Regularly

```bash
# Railway provides automatic backups
# Test restore procedure monthly:

# 1. Create test database
railway add --database postgresql --name test-restore

# 2. Restore backup to test database
# (via Railway dashboard or support)

# 3. Verify data integrity
railway connect test-restore
SELECT COUNT(*) FROM customers;

# 4. Delete test database
railway remove test-restore
```

#### 5. Keep Dependencies Updated

```bash
# Check for outdated dependencies
pnpm outdated

# Update dependencies
pnpm update

# Test locally
pnpm test

# Deploy to staging first
git checkout staging
git merge main
git push origin staging

# Monitor staging for issues
railway logs --environment staging

# Deploy to production
git checkout main
git push origin main
```

### Performance Optimization

#### 1. Enable Connection Pooling

```typescript
// Your database-manager.ts already uses connection pooling
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

#### 2. Optimize Database Queries

```typescript
// Use indexes for frequently queried columns
// Add to migration:
CREATE INDEX idx_customers_phone ON customers(phone_number);
CREATE INDEX idx_phones_number ON phones(phone_number);

// Use EXPLAIN ANALYZE to optimize queries
const result = await db.raw('EXPLAIN ANALYZE SELECT * FROM customers WHERE phone_number = ?', [phone]);
```

#### 3. Cache Frequently Accessed Data

```typescript
// Use in-memory cache for static data
const cache = new Map();

async function getConfig(key: string) {
  if (cache.has(key)) {
    return cache.get(key);
  }

  const value = await db.query("SELECT value FROM config WHERE key = ?", [key]);
  cache.set(key, value);
  return value;
}
```

#### 4. Minimize Build Time

```dockerfile
# Your Dockerfile already optimizes this:
# 1. Copy package files first (cached if unchanged)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 2. Copy source code last (changes frequently)
COPY . .
RUN pnpm build
```

#### 5. Use Railway's Build Cache

```bash
# Railway automatically caches Docker layers
# To clear cache if needed:
# Dashboard → Service → Settings → Clear Build Cache

# Then redeploy
railway up
```

---

## Quick Reference

Common Railway CLI commands and useful aliases.

### Essential Railway CLI Commands

#### Authentication

```bash
# Login to Railway
railway login

# Logout
railway logout

# Check current user
railway whoami
```

#### Project Management

```bash
# Initialize new project
railway init

# Link to existing project
railway link

# List all projects
railway list

# Switch project
railway switch

# View project status
railway status
```

#### Deployment

```bash
# Deploy current directory
railway up

# Deploy with verbose output
railway up --verbose

# Deploy specific service
railway up --service ixo-ussd-supamoto

# Redeploy (via dashboard or trigger new deployment)
git commit --allow-empty -m "Trigger redeploy"
git push origin main
```

#### Environment Variables

```bash
# List all variables
railway variables

# Get specific variable
railway variables get NODE_ENV

# Set variable
railway variables set NODE_ENV=production
railway variables set PORT=8080

# Set multiple variables
railway variables set KEY1=value1 KEY2=value2

# Delete variable
railway variables delete KEY_NAME

# Set from file (NOT recommended for secrets)
railway variables set --from-file .env.production
```

#### Database

```bash
# Add PostgreSQL
railway add --database postgresql

# Connect to database (opens psql)
railway connect postgresql

# Get DATABASE_URL
railway variables get DATABASE_URL

# Run database command
railway run psql -c "SELECT COUNT(*) FROM customers;"
```

#### Logs

```bash
# View real-time logs
railway logs --follow

# View last N lines
railway logs --tail 100

# Logs since time
railway logs --since 1h
railway logs --since "2024-01-10 14:00:00"

# Logs for specific deployment
railway logs --deployment <deployment-id>

# Filter logs
railway logs | grep ERROR
railway logs | grep "Database connection"
```

#### Domains

```bash
# Add custom domain
railway domain add ussd.yourdomain.com

# List domains
railway domain list

# Remove domain
railway domain remove ussd.yourdomain.com

# Get default Railway domain
railway domain
```

#### Services

```bash
# List services in project
railway service list

# Add service
railway add

# Remove service
railway remove <service-name>

# View service metrics
railway metrics
```

#### Execution

```bash
# Run command in Railway environment
railway run <command>

# Examples:
railway run node --version
railway run pnpm --version
railway run env | grep DATABASE_URL
railway run node dist/src/migrations/run-migrations.js

# Interactive shell
railway run sh
```

### Useful Bash Aliases

Add to your `~/.bashrc` or `~/.zshrc`:

```bash
# Railway shortcuts
alias rw='railway'
alias rwl='railway login'
alias rws='railway status'
alias rwu='railway up'
alias rwlog='railway logs --follow'
alias rwlogs='railway logs --tail 100'
alias rwvar='railway variables'
alias rwdb='railway connect postgresql'
alias rwrun='railway run'

# IXO USSD specific
alias ixo-deploy='railway up'
alias ixo-logs='railway logs --follow'
alias ixo-status='railway status'
alias ixo-db='railway connect postgresql'
alias ixo-health='curl $(railway domain)/health'
alias ixo-vars='railway variables | grep -v "DATABASE_URL\|PASSWORD\|SECRET\|KEY\|TOKEN\|MNEMONIC"'

# Deployment workflow
alias ixo-push='git add . && git commit -m "Deploy to Railway" && git push origin main'
alias ixo-watch='railway logs --follow | grep -E "(ERROR|WARN|migration|Database|Server listening)"'

# Database helpers
alias ixo-db-size='railway run psql -c "SELECT pg_size_pretty(pg_database_size(current_database()));"'
alias ixo-db-tables='railway run psql -c "\dt"'
alias ixo-db-customers='railway run psql -c "SELECT COUNT(*) FROM customers;"'

# Monitoring
alias ixo-errors='railway logs --since 1h | grep ERROR'
alias ixo-warnings='railway logs --since 1h | grep WARN'
alias ixo-metrics='railway metrics'
```

### Common Command Patterns

#### Deploy and Monitor

```bash
# Deploy and watch logs
railway up && railway logs --follow

# Deploy and check health
railway up && sleep 30 && curl $(railway domain)/health

# Deploy and verify database
railway up && railway run psql -c "\dt"
```

#### Debugging

```bash
# Check deployment status and logs
railway status && railway logs --tail 50

# Check environment and database
railway variables | grep DATABASE_URL && railway connect postgresql

# Full diagnostic
railway status && \
railway variables | wc -l && \
railway logs --tail 20 && \
curl $(railway domain)/health
```

#### Database Operations

```bash
# Backup database
railway run pg_dump > backup-$(date +%Y%m%d).sql

# Restore database
railway run psql < backup-20240110.sql

# Run migration
railway run node dist/src/migrations/run-migrations.js

# Check database size
railway run psql -c "SELECT pg_size_pretty(pg_database_size(current_database()));"
```

### Quick Troubleshooting Commands

```bash
# Check if deployment is healthy
railway status && curl -I $(railway domain)/health

# View recent errors
railway logs --tail 200 | grep -i error

# Check database connection
railway run psql -c "SELECT 1;"

# Verify environment variables
railway variables | grep -E "(NODE_ENV|DATABASE_URL|PORT)"

# Check build logs
railway logs --deployment $(railway status | grep "Deployment ID" | awk '{print $3}')

# Restart service (redeploy)
git commit --allow-empty -m "Restart service" && git push origin main
```

---

## Summary

### Railway.app Deployment: Key Takeaways

✅ **Your Application is Railway-Ready**:

- No Dockerfile changes needed
- No code changes needed
- Automatic migrations work out of the box
- Proper logging already implemented

✅ **Simple Deployment Process**:

1. Push code to GitHub
2. Create Railway project from repo
3. Add PostgreSQL service
4. Set environment variables
5. Deploy automatically

✅ **Railway Handles**:

- Docker builds (multi-stage supported)
- PostgreSQL database (managed, automatic backups)
- HTTPS/SSL (automatic Let's Encrypt)
- Monitoring (built-in dashboard)
- Scaling (horizontal and vertical)
- Zero-downtime deployments

✅ **You Configure**:

- Environment variables (via dashboard or CLI)
- Custom domains (optional)
- Scaling replicas (Pro plan)
- Alerts (Pro plan)

### Next Steps

1. **Create Railway Account**: https://railway.app
2. **Deploy Your Application**: Follow [Deployment Methods](#deployment-methods)
3. **Configure Environment Variables**: See [Environment Variables Setup](#environment-variables-setup)
4. **Verify Deployment**: Use [Deployment Verification Steps](#deployment-verification-steps)
5. **Monitor Application**: Review [Monitoring and Maintenance](#monitoring-and-maintenance)

### Support Resources

- **Railway Documentation**: https://docs.railway.app
- **Railway Discord**: https://discord.gg/railway
- **Railway Status**: https://status.railway.app
- **IXO Documentation**: https://docs.ixo.world
- **This Guide**: `docs/RAILWAY_DEPLOYMENT.md`

---

**Last Updated**: 2025-01-10
**Railway CLI Version**: Latest
**Tested With**: Node.js 20, PostgreSQL 14+, pnpm 9

---

**Questions or Issues?**

- Check [Troubleshooting Guide](#troubleshooting-guide)
- Review [Common Deployment Issues](#common-deployment-issues)
- Contact Railway support via Discord or dashboard
- Open GitHub issue: https://github.com/emerging-eco/ixo-ussd-supamoto/issues
