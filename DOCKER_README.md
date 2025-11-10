# 🐳 Docker Deployment for IXO USSD SupaMoto Server

Production-ready Docker deployment configuration for the IXO USSD SupaMoto server with PostgreSQL database.

## 📋 What's Included

This Docker deployment provides:

- ✅ **Multi-stage Dockerfile** - Optimized for minimal image size (~200MB)
- ✅ **Docker Compose** - Development and production configurations
- ✅ **PostgreSQL Database** - With persistent storage and health checks
- ✅ **Security** - Non-root user, secrets management, resource limits
- ✅ **Health Checks** - Automated monitoring and restart policies
- ✅ **Kubernetes** - Optional K8s deployment manifests
- ✅ **Documentation** - Comprehensive guides and quick reference

## 🚀 Quick Start (5 minutes)

### 1. Prerequisites

```bash
# Verify Docker installation
docker --version  # Should be 20.10+
docker-compose --version  # Should be 2.0+
```

### 2. Setup Environment

```bash
# Clone repository
git clone https://github.com/emerging-eco/ixo-ussd-supamoto.git
cd ixo-ussd-supamoto

# Create production environment file
cp .env.production.example .env.production

# Edit with your configuration (REQUIRED)
nano .env.production
```

**Minimum required changes**:

- `PG_PASSWORD` - Strong database password
- `SYSTEM_SECRET` - Generate with: `openssl rand -hex 32`
- `PIN_ENCRYPTION_KEY` - Generate with: `openssl rand -hex 32`

### 3. Build and Deploy

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

# Test health endpoint
curl http://localhost:3000/health
# Expected: {"status":"ok"}

# Run comprehensive health check
./scripts/docker-health-check.sh
```

## 📁 File Structure

```
.
├── Dockerfile                          # Multi-stage production Dockerfile
├── .dockerignore                       # Excludes unnecessary files from build
├── docker-compose.yml                  # Development configuration
├── docker-compose.production.yml       # Production configuration
├── .env.production.example             # Production environment template
├── scripts/
│   └── docker-health-check.sh         # Automated health check script
├── k8s/
│   └── deployment.yaml                # Kubernetes deployment (optional)
└── docs/
    ├── DOCKER_DEPLOYMENT.md           # Comprehensive deployment guide
    └── DOCKER_QUICK_REFERENCE.md      # Quick command reference
```

## 🎯 Key Features

### Multi-Stage Build

The Dockerfile uses 5 stages for optimal image size:

1. **Base** - Install pnpm
2. **Dependencies** - Install all dependencies
3. **Build** - Compile TypeScript
4. **Production Dependencies** - Install only runtime deps
5. **Production** - Final minimal image (~200MB)

### Security

- ✅ Non-root user (nodejs:nodejs)
- ✅ Minimal attack surface (Alpine Linux)
- ✅ Secrets management support
- ✅ Resource limits configured
- ✅ Health checks enabled

### Database

- ✅ PostgreSQL 16 Alpine
- ✅ Persistent volume storage
- ✅ Automatic migrations on startup
- ✅ Health checks and auto-restart
- ✅ Backup support

## 📚 Documentation

### Comprehensive Guides

- **[DOCKER_DEPLOYMENT.md](docs/DOCKER_DEPLOYMENT.md)** - Full deployment guide with:
  - Prerequisites and system requirements
  - Step-by-step production deployment
  - Environment configuration
  - Database management and backups
  - Monitoring and health checks
  - Troubleshooting common issues
  - Security best practices

- **[DOCKER_QUICK_REFERENCE.md](docs/DOCKER_QUICK_REFERENCE.md)** - Quick command reference:
  - Build commands
  - Run commands
  - Status & monitoring
  - Debugging
  - Database operations
  - Cleanup
  - Useful aliases

### Quick Commands

```bash
# Start services
docker-compose -f docker-compose.production.yml up -d

# View logs
docker-compose -f docker-compose.production.yml logs -f ixo-ussd

# Stop services
docker-compose -f docker-compose.production.yml down

# Health check
./scripts/docker-health-check.sh

# Database backup
docker-compose -f docker-compose.production.yml exec postgres \
  pg_dump -U postgres ixo_ussd_supamoto > backup.sql

# Access application shell
docker-compose -f docker-compose.production.yml exec ixo-ussd sh

# Access database
docker-compose -f docker-compose.production.yml exec postgres \
  psql -U postgres -d ixo_ussd_supamoto
```

## 🔧 Configuration

### Environment Variables

**Required**:

- `DATABASE_URL` - PostgreSQL connection string
- `PIN_ENCRYPTION_KEY` - 64-char hex for PIN encryption
- `SYSTEM_SECRET` - System-wide secret key

**Blockchain**:

- `CHAIN_NETWORK` - devnet, testnet, or mainnet
- `CHAIN_RPC_URL` - IXO blockchain RPC endpoint
- `LG_WALLET_MNEMONIC` - Lead generator wallet (24 words)
- `EVALUATOR_WALLET_MNEMONIC` - Evaluator wallet (24 words)

**SMS**:

- `AFRICASTALKING_API_KEY` - Africa's Talking API key
- `AFRICASTALKING_USERNAME` - Africa's Talking username

**Claims Bot**:

- `CLAIMS_BOT_URL` - Claims bot API URL
- `CLAIMS_BOT_ACCESS_TOKEN` - Access token

See `.env.production.example` for complete list.

## 🏗️ Advanced Deployment

### Kubernetes

For Kubernetes deployment:

```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/deployment.yaml

# Check deployment status
kubectl get pods -n ixo-ussd

# View logs
kubectl logs -f -n ixo-ussd deployment/ixo-ussd-app
```

See `k8s/deployment.yaml` for full configuration including:

- StatefulSet for PostgreSQL
- Deployment for application
- Services and Ingress
- ConfigMaps and Secrets
- Horizontal Pod Autoscaler

### Docker Swarm

For Docker Swarm deployment:

```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.production.yml ixo-ussd

# View services
docker stack services ixo-ussd
```

## 🔍 Monitoring

### Health Checks

Built-in health checks for both services:

```bash
# Application health
curl http://localhost:3000/health

# Database health
docker-compose -f docker-compose.production.yml exec postgres \
  pg_isready -U postgres

# Comprehensive check
./scripts/docker-health-check.sh
```

### Metrics

If `METRICS_ENABLED=true`:

```bash
# Prometheus metrics
curl http://localhost:3000/metrics
```

### Logs

```bash
# All services
docker-compose -f docker-compose.production.yml logs -f

# Application only
docker-compose -f docker-compose.production.yml logs -f ixo-ussd

# Filter errors
docker-compose -f docker-compose.production.yml logs ixo-ussd | grep ERROR
```

## 🆘 Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose -f docker-compose.production.yml logs ixo-ussd

# Verify environment
docker-compose -f docker-compose.production.yml config

# Restart services
docker-compose -f docker-compose.production.yml restart
```

### Database connection failed

```bash
# Check PostgreSQL status
docker-compose -f docker-compose.production.yml ps postgres

# Test connection
docker-compose -f docker-compose.production.yml exec postgres \
  pg_isready -U postgres
```

### Migrations failed

```bash
# Run migrations manually
docker-compose -f docker-compose.production.yml exec ixo-ussd \
  node dist/src/migrations/run-migrations.js
```

See [DOCKER_DEPLOYMENT.md](docs/DOCKER_DEPLOYMENT.md) for detailed troubleshooting.

## 📊 Resource Requirements

**Minimum**:

- 2 CPU cores
- 2 GB RAM
- 10 GB disk

**Recommended (Production)**:

- 4 CPU cores
- 4 GB RAM
- 50 GB disk

## 🔐 Security Checklist

- [ ] Generate strong random values for secrets
- [ ] Never commit `.env.production` to version control
- [ ] Use external secrets manager (AWS Secrets Manager, Vault)
- [ ] Restrict PostgreSQL to internal network only
- [ ] Enable HTTPS/TLS for production
- [ ] Regular security updates for base images
- [ ] Configure log rotation
- [ ] Set resource limits
- [ ] Enable firewall rules

## 📞 Support

- **Documentation**: [docs/DOCKER_DEPLOYMENT.md](docs/DOCKER_DEPLOYMENT.md)
- **Quick Reference**: [docs/DOCKER_QUICK_REFERENCE.md](docs/DOCKER_QUICK_REFERENCE.md)
- **Issues**: https://github.com/emerging-eco/ixo-ussd-supamoto/issues
- **IXO Docs**: https://docs.ixo.world

---

**Last Updated**: 2025-01-10  
**Docker Version**: 24.0+  
**Docker Compose Version**: 2.0+
