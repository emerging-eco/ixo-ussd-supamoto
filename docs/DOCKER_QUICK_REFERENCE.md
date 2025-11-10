# Docker Quick Reference - IXO USSD SupaMoto

Quick command reference for common Docker operations.

## 🚀 Quick Start

```bash
# Development
docker-compose up -d

# Production
docker-compose -f docker-compose.production.yml up -d
```

## 📦 Build Commands

```bash
# Build image
docker build -t ixo-ussd-supamoto:latest .

# Build with no cache
docker build --no-cache -t ixo-ussd-supamoto:latest .

# Build using docker-compose
docker-compose -f docker-compose.production.yml build

# Build specific service
docker-compose -f docker-compose.production.yml build ixo-ussd
```

## 🏃 Run Commands

```bash
# Start all services
docker-compose -f docker-compose.production.yml up -d

# Start specific service
docker-compose -f docker-compose.production.yml up -d ixo-ussd

# Start with logs
docker-compose -f docker-compose.production.yml up

# Restart services
docker-compose -f docker-compose.production.yml restart

# Stop services
docker-compose -f docker-compose.production.yml stop

# Stop and remove containers
docker-compose -f docker-compose.production.yml down

# Stop and remove volumes (WARNING: deletes data)
docker-compose -f docker-compose.production.yml down -v
```

## 📊 Status & Monitoring

```bash
# View running containers
docker-compose -f docker-compose.production.yml ps

# View container health
docker ps --format "table {{.Names}}\t{{.Status}}"

# View logs (all services)
docker-compose -f docker-compose.production.yml logs -f

# View logs (specific service)
docker-compose -f docker-compose.production.yml logs -f ixo-ussd

# View last 100 lines
docker-compose -f docker-compose.production.yml logs --tail=100 ixo-ussd

# View resource usage
docker stats

# Run health check script
./scripts/docker-health-check.sh
```

## 🔍 Debugging

```bash
# Access application container shell
docker-compose -f docker-compose.production.yml exec ixo-ussd sh

# Access database container shell
docker-compose -f docker-compose.production.yml exec postgres sh

# View environment variables
docker-compose -f docker-compose.production.yml exec ixo-ussd env

# Test database connection
docker-compose -f docker-compose.production.yml exec postgres \
  pg_isready -U postgres

# Run SQL query
docker-compose -f docker-compose.production.yml exec postgres \
  psql -U postgres -d ixo_ussd_supamoto -c "SELECT COUNT(*) FROM customers;"

# Check application health
curl http://localhost:3000/health
```

## 💾 Database Operations

```bash
# Connect to database
docker-compose -f docker-compose.production.yml exec postgres \
  psql -U postgres -d ixo_ussd_supamoto

# Run migrations manually
docker-compose -f docker-compose.production.yml exec ixo-ussd \
  node dist/src/migrations/run-migrations.js

# Backup database
docker-compose -f docker-compose.production.yml exec postgres \
  pg_dump -U postgres ixo_ussd_supamoto > backup.sql

# Restore database
docker-compose -f docker-compose.production.yml exec -T postgres \
  psql -U postgres ixo_ussd_supamoto < backup.sql

# View database size
docker-compose -f docker-compose.production.yml exec postgres \
  psql -U postgres -d ixo_ussd_supamoto -c \
  "SELECT pg_size_pretty(pg_database_size('ixo_ussd_supamoto'));"
```

## 🧹 Cleanup

```bash
# Remove stopped containers
docker-compose -f docker-compose.production.yml down

# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove everything (WARNING: nuclear option)
docker system prune -a --volumes

# Remove specific image
docker rmi ixo-ussd-supamoto:latest
```

## 🔄 Update & Restart

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.production.yml build
docker-compose -f docker-compose.production.yml up -d

# Zero-downtime update (if using multiple replicas)
docker-compose -f docker-compose.production.yml up -d --no-deps --build ixo-ussd
```

## 🔐 Security

```bash
# Scan image for vulnerabilities
docker scan ixo-ussd-supamoto:latest

# View image layers
docker history ixo-ussd-supamoto:latest

# Inspect container security
docker inspect ixo-ussd-app | grep -A 10 "SecurityOpt"
```

## 📈 Performance

```bash
# View real-time stats
docker stats ixo-ussd-app

# View container processes
docker-compose -f docker-compose.production.yml top

# Export metrics
curl http://localhost:3000/metrics
```

## 🌐 Networking

```bash
# List networks
docker network ls

# Inspect network
docker network inspect ixo-ussd-network

# Test connectivity between containers
docker-compose -f docker-compose.production.yml exec ixo-ussd \
  ping postgres
```

## 📝 Environment Variables

```bash
# View all environment variables
docker-compose -f docker-compose.production.yml config

# Validate docker-compose file
docker-compose -f docker-compose.production.yml config --quiet

# View specific variable
docker-compose -f docker-compose.production.yml exec ixo-ussd \
  printenv DATABASE_URL
```

## 🚨 Emergency Commands

```bash
# Force restart all services
docker-compose -f docker-compose.production.yml restart

# Force stop container
docker stop -t 0 ixo-ussd-app

# Force remove container
docker rm -f ixo-ussd-app

# View container exit code
docker inspect ixo-ussd-app --format='{{.State.ExitCode}}'

# View last container error
docker logs --tail=50 ixo-ussd-app | grep -i error
```

## 📚 Useful Aliases

Add to your `~/.bashrc` or `~/.zshrc`:

```bash
# Docker Compose shortcuts
alias dcp='docker-compose -f docker-compose.production.yml'
alias dcup='docker-compose -f docker-compose.production.yml up -d'
alias dcdown='docker-compose -f docker-compose.production.yml down'
alias dclogs='docker-compose -f docker-compose.production.yml logs -f'
alias dcps='docker-compose -f docker-compose.production.yml ps'
alias dcrestart='docker-compose -f docker-compose.production.yml restart'

# IXO USSD specific
alias ixo-logs='docker-compose -f docker-compose.production.yml logs -f ixo-ussd'
alias ixo-shell='docker-compose -f docker-compose.production.yml exec ixo-ussd sh'
alias ixo-health='./scripts/docker-health-check.sh'
alias ixo-db='docker-compose -f docker-compose.production.yml exec postgres psql -U postgres -d ixo_ussd_supamoto'
```

---

**For detailed documentation, see**: [DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md)
