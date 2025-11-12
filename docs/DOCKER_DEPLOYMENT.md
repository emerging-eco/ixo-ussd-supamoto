# Docker Deployment Guide for IXO USSD SupaMoto Server

This guide provides comprehensive instructions for deploying the IXO USSD SupaMoto server using Docker and Docker Compose.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Production Deployment](#production-deployment)
- [Environment Configuration](#environment-configuration)
- [Database Management](#database-management)
- [Monitoring and Health Checks](#monitoring-and-health-checks)
- [Troubleshooting](#troubleshooting)
- [Security Best Practices](#security-best-practices)

---

## Prerequisites

### Required Software

- **Docker**: Version 20.10 or higher
- **Docker Compose**: Version 2.0 or higher
- **Git**: For cloning the repository

### System Requirements

**Minimum**:

- 2 CPU cores
- 2 GB RAM
- 10 GB disk space

**Recommended (Production)**:

- 4 CPU cores
- 4 GB RAM
- 50 GB disk space (for database growth)

### Verify Installation

```bash
docker --version
# Docker version 24.0.0 or higher

docker-compose --version
# Docker Compose version v2.20.0 or higher
```

---

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/emerging-eco/ixo-ussd-supamoto.git
cd ixo-ussd-supamoto
```

### 2. Create Environment File

```bash
# Copy the example environment file
cp .env.example .env

# Edit with your configuration
nano .env
```

**Minimum required variables**:

```bash
DATABASE_URL=postgres://postgres:postgres@postgres:5432/ixo_ussd_supamoto
PIN_ENCRYPTION_KEY=ff7465fb16a9956a59816023838c4e31a7a5c690ff047eacc6c93ee61933f472
SYSTEM_SECRET=your_random_secret_here
```

### 3. Build and Start Services

```bash
# Build the Docker image
docker-compose -f docker-compose.production.yml build

# Start all services
docker-compose -f docker-compose.production.yml up -d

# View logs
docker-compose -f docker-compose.production.yml logs -f
```

### 4. Verify Deployment

```bash
# Check service health
docker-compose -f docker-compose.production.yml ps

# Test the health endpoint
curl http://localhost:3000/health

# Expected response: {"status":"ok"}
```

---

## Production Deployment

### Step 1: Prepare Production Environment

```bash
# Create production environment file
cp .env.production.example .env.production

# Edit with production values
nano .env.production
```

**CRITICAL**: Update these values for production:

- `SYSTEM_SECRET` - Generate with: `openssl rand -hex 32`
- `PIN_ENCRYPTION_KEY` - Generate with: `openssl rand -hex 32`
- `PG_PASSWORD` - Strong database password
- `LG_WALLET_MNEMONIC` - Lead generator wallet (24 words)
- `EVALUATOR_WALLET_MNEMONIC` - Evaluator wallet (24 words)
- `AFRICASTALKING_API_KEY` - Production SMS API key
- `CLAIMS_BOT_ACCESS_TOKEN` - Production claims bot token

### Step 2: Build Production Image

```bash
# Build the production image
docker build -t ixo-ussd-supamoto:latest .

# Tag for registry (optional)
docker tag ixo-ussd-supamoto:latest your-registry.com/ixo-ussd-supamoto:v1.0.0
```

### Step 3: Start Production Services

```bash
# Start with production configuration
docker-compose -f docker-compose.production.yml up -d

# Monitor startup
docker-compose -f docker-compose.production.yml logs -f ixo-ussd
```

### Step 4: Verify Production Deployment

```bash
# Check all services are healthy
docker-compose -f docker-compose.production.yml ps

# Verify database connection
docker-compose -f docker-compose.production.yml exec ixo-ussd \
  node -e "console.log('Database check:', process.env.DATABASE_URL)"

# Check migrations ran successfully
docker-compose -f docker-compose.production.yml logs ixo-ussd | grep "migrations"
```

---

## Environment Configuration

### Required Environment Variables

| Variable             | Description                  | Example                             | Required |
| -------------------- | ---------------------------- | ----------------------------------- | -------- |
| `NODE_ENV`           | Environment mode             | `production`                        | Yes      |
| `DATABASE_URL`       | PostgreSQL connection string | `postgres://user:pass@host:5432/db` | Yes      |
| `PIN_ENCRYPTION_KEY` | Encryption key for PINs      | 64-char hex string                  | Yes      |
| `SYSTEM_SECRET`      | System-wide secret           | Random string                       | Yes      |

### Optional but Recommended

| Variable          | Description        | Default  |
| ----------------- | ------------------ | -------- |
| `PORT`            | Server port        | `3000`   |
| `LOG_LEVEL`       | Logging level      | `info`   |
| `CHAIN_NETWORK`   | Blockchain network | `devnet` |
| `SMS_ENABLED`     | Enable SMS sending | `true`   |
| `METRICS_ENABLED` | Enable metrics     | `true`   |

### Blockchain Configuration

Network type controls all blockchain URLs (RPC, Blocksync) - URLs are auto-selected based on CHAIN_NETWORK value.

```bash
# Mainnet
CHAIN_NETWORK=mainnet

# Testnet
CHAIN_NETWORK=testnet

# Devnet (Development)
CHAIN_NETWORK=devnet
```

**Network Selection**:

The `CHAIN_NETWORK` variable automatically selects the appropriate RPC URLs:

- **Mainnet**: Uses `https://rpc.ixo.earth`
- **Testnet**: Uses `https://rpc.testnet.ixo.earth`
- **Devnet**: Uses `https://devnet.ixo.earth/rpc/`

URLs are defined in `src/constants/ixo-blockchain.ts` and selected automatically.

**Gas Fees**: Blockchain transactions use self-funded wallets (LG_WALLET_MNEMONIC, EVALUATOR_WALLET_MNEMONIC). Ensure these wallets have sufficient IXO tokens for gas fees.

---

## Database Management

### Initial Setup

The database is automatically initialized on first startup. Migrations run automatically via the `pnpm start` command.

### Manual Migration

```bash
# Run migrations manually
docker-compose -f docker-compose.production.yml exec ixo-ussd \
  node dist/src/migrations/run-migrations.js
```

### Database Backup

```bash
# Create backup directory
mkdir -p ./backups

# Backup database
docker-compose -f docker-compose.production.yml exec postgres \
  pg_dump -U postgres ixo_ussd_supamoto > ./backups/backup-$(date +%Y%m%d-%H%M%S).sql

# Automated daily backups (add to crontab)
0 2 * * * cd /path/to/ixo-ussd-supamoto && docker-compose -f docker-compose.production.yml exec -T postgres pg_dump -U postgres ixo_ussd_supamoto > ./backups/backup-$(date +\%Y\%m\%d).sql
```

### Database Restore

```bash
# Restore from backup
docker-compose -f docker-compose.production.yml exec -T postgres \
  psql -U postgres ixo_ussd_supamoto < ./backups/backup-20240101-120000.sql
```

### Database Access

```bash
# Connect to PostgreSQL
docker-compose -f docker-compose.production.yml exec postgres \
  psql -U postgres -d ixo_ussd_supamoto

# Run SQL query
docker-compose -f docker-compose.production.yml exec postgres \
  psql -U postgres -d ixo_ussd_supamoto -c "SELECT COUNT(*) FROM customers;"
```

---

## Monitoring and Health Checks

### Health Check Endpoint

```bash
# Check application health
curl http://localhost:3000/health

# Expected response
{"status":"ok"}
```

### Container Health Status

```bash
# View health status of all containers
docker-compose -f docker-compose.production.yml ps

# Expected output shows "healthy" status
NAME                 STATUS
ixo-ussd-postgres    Up (healthy)
ixo-ussd-app         Up (healthy)
```

### View Logs

```bash
# All services
docker-compose -f docker-compose.production.yml logs -f

# Specific service
docker-compose -f docker-compose.production.yml logs -f ixo-ussd

# Last 100 lines
docker-compose -f docker-compose.production.yml logs --tail=100 ixo-ussd

# Filter by error
docker-compose -f docker-compose.production.yml logs ixo-ussd | grep ERROR
```

### Metrics

If `METRICS_ENABLED=true`, metrics are available at:

```bash
# Prometheus metrics
curl http://localhost:3000/metrics
```

---

## Troubleshooting

### Common Issues

#### 1. Container Won't Start

```bash
# Check logs for errors
docker-compose -f docker-compose.production.yml logs ixo-ussd

# Common causes:
# - Missing environment variables
# - Database connection failure
# - Port already in use
```

**Solution**:

```bash
# Verify environment variables
docker-compose -f docker-compose.production.yml config

# Check port availability
lsof -i :3000

# Restart services
docker-compose -f docker-compose.production.yml restart
```

#### 2. Database Connection Failed

```bash
# Check PostgreSQL is running
docker-compose -f docker-compose.production.yml ps postgres

# Test database connection
docker-compose -f docker-compose.production.yml exec postgres \
  pg_isready -U postgres
```

**Solution**:

```bash
# Restart PostgreSQL
docker-compose -f docker-compose.production.yml restart postgres

# Wait for health check
docker-compose -f docker-compose.production.yml ps postgres
```

#### 3. Migrations Failed

```bash
# Check migration logs
docker-compose -f docker-compose.production.yml logs ixo-ussd | grep migration
```

**Solution**:

```bash
# Run migrations manually
docker-compose -f docker-compose.production.yml exec ixo-ussd \
  node dist/src/migrations/run-migrations.js

# If still failing, check SQL syntax in migrations/postgres/*.sql
```

#### 4. Out of Memory

```bash
# Check container memory usage
docker stats ixo-ussd-app
```

**Solution**:

```bash
# Increase memory limit in docker-compose.production.yml
deploy:
  resources:
    limits:
      memory: 2G  # Increase from 1G
```

### Debug Mode

```bash
# Start with debug logging
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d \
  -e LOG_LEVEL=debug

# View detailed logs
docker-compose -f docker-compose.production.yml logs -f ixo-ussd
```

### Container Shell Access

```bash
# Access application container
docker-compose -f docker-compose.production.yml exec ixo-ussd sh

# Access database container
docker-compose -f docker-compose.production.yml exec postgres sh
```

---

## Security Best Practices

### 1. Secrets Management

**DO NOT** commit sensitive values to version control:

```bash
# Add to .gitignore
echo ".env.production" >> .gitignore
echo "secrets/" >> .gitignore
```

**Use Docker Secrets** (Docker Swarm) or **External Secrets Manager**:

```yaml
# docker-compose.production.yml with secrets
secrets:
  db_password:
    external: true
  lg_wallet_mnemonic:
    external: true

services:
  ixo-ussd:
    secrets:
      - db_password
      - lg_wallet_mnemonic
```

### 2. Network Security

```bash
# Restrict PostgreSQL to internal network only
# Remove ports mapping in docker-compose.production.yml
# postgres:
#   ports:
#     - "5432:5432"  # REMOVE THIS LINE
```

### 3. Regular Updates

```bash
# Update base images
docker pull node:20-alpine
docker pull postgres:16-alpine

# Rebuild application
docker-compose -f docker-compose.production.yml build --no-cache
```

### 4. Resource Limits

Always set resource limits in production:

```yaml
deploy:
  resources:
    limits:
      cpus: "2.0"
      memory: 1G
    reservations:
      cpus: "0.25"
      memory: 256M
```

### 5. Log Rotation

Configure log rotation to prevent disk space issues:

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "50m"
    max-file: "5"
```

---

## Maintenance

### Update Application

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.production.yml build
docker-compose -f docker-compose.production.yml up -d

# Verify update
docker-compose -f docker-compose.production.yml logs -f ixo-ussd
```

### Clean Up

```bash
# Remove stopped containers
docker-compose -f docker-compose.production.yml down

# Remove volumes (WARNING: deletes data)
docker-compose -f docker-compose.production.yml down -v

# Remove unused images
docker image prune -a
```

---

## Support

For issues and questions:

- GitHub Issues: https://github.com/emerging-eco/ixo-ussd-supamoto/issues
- Documentation: https://docs.ixo.world

---

**Last Updated**: 2025-01-10
