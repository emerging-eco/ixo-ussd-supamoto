#!/bin/bash
# ============================================================================
# Docker Health Check Script for IXO USSD SupaMoto Server
# ============================================================================
# This script performs comprehensive health checks on the Docker deployment
# Usage: ./scripts/docker-health-check.sh
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"
APP_CONTAINER="${APP_CONTAINER:-ixo-ussd-app}"
DB_CONTAINER="${DB_CONTAINER:-ixo-ussd-postgres}"
HEALTH_ENDPOINT="${HEALTH_ENDPOINT:-http://localhost:3000/health}"

echo "============================================================================"
echo "IXO USSD SupaMoto Server - Health Check"
echo "============================================================================"
echo ""

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
    fi
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check 1: Docker is running
echo "1. Checking Docker daemon..."
if docker info > /dev/null 2>&1; then
    print_status 0 "Docker daemon is running"
else
    print_status 1 "Docker daemon is not running"
    exit 1
fi

# Check 2: Docker Compose file exists
echo ""
echo "2. Checking Docker Compose configuration..."
if [ -f "$COMPOSE_FILE" ]; then
    print_status 0 "Docker Compose file found: $COMPOSE_FILE"
else
    print_status 1 "Docker Compose file not found: $COMPOSE_FILE"
    exit 1
fi

# Check 3: Containers are running
echo ""
echo "3. Checking container status..."
POSTGRES_RUNNING=$(docker-compose -f "$COMPOSE_FILE" ps -q postgres 2>/dev/null)
APP_RUNNING=$(docker-compose -f "$COMPOSE_FILE" ps -q ixo-ussd 2>/dev/null)

if [ -n "$POSTGRES_RUNNING" ]; then
    print_status 0 "PostgreSQL container is running"
else
    print_status 1 "PostgreSQL container is not running"
fi

if [ -n "$APP_RUNNING" ]; then
    print_status 0 "Application container is running"
else
    print_status 1 "Application container is not running"
fi

# Check 4: Container health status
echo ""
echo "4. Checking container health..."
POSTGRES_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "$DB_CONTAINER" 2>/dev/null || echo "unknown")
APP_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "$APP_CONTAINER" 2>/dev/null || echo "unknown")

if [ "$POSTGRES_HEALTH" = "healthy" ]; then
    print_status 0 "PostgreSQL is healthy"
elif [ "$POSTGRES_HEALTH" = "starting" ]; then
    print_warning "PostgreSQL is starting..."
else
    print_status 1 "PostgreSQL health: $POSTGRES_HEALTH"
fi

if [ "$APP_HEALTH" = "healthy" ]; then
    print_status 0 "Application is healthy"
elif [ "$APP_HEALTH" = "starting" ]; then
    print_warning "Application is starting..."
else
    print_status 1 "Application health: $APP_HEALTH"
fi

# Check 5: Database connectivity
echo ""
echo "5. Checking database connectivity..."
DB_CHECK=$(docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U postgres 2>/dev/null || echo "failed")
if echo "$DB_CHECK" | grep -q "accepting connections"; then
    print_status 0 "Database is accepting connections"
else
    print_status 1 "Database is not accepting connections"
fi

# Check 6: Application health endpoint
echo ""
echo "6. Checking application health endpoint..."
if command -v curl > /dev/null 2>&1; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_ENDPOINT" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        print_status 0 "Health endpoint returned 200 OK"
    else
        print_status 1 "Health endpoint returned $HTTP_CODE"
    fi
else
    print_warning "curl not installed, skipping HTTP health check"
fi

# Check 7: Recent errors in logs
echo ""
echo "7. Checking for recent errors..."
ERROR_COUNT=$(docker-compose -f "$COMPOSE_FILE" logs --tail=100 ixo-ussd 2>/dev/null | grep -i "error" | wc -l)
if [ "$ERROR_COUNT" -eq 0 ]; then
    print_status 0 "No errors in recent logs"
else
    print_warning "Found $ERROR_COUNT error(s) in recent logs"
fi

# Check 8: Disk space
echo ""
echo "8. Checking disk space..."
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 80 ]; then
    print_status 0 "Disk usage: ${DISK_USAGE}%"
elif [ "$DISK_USAGE" -lt 90 ]; then
    print_warning "Disk usage: ${DISK_USAGE}% (consider cleanup)"
else
    print_status 1 "Disk usage: ${DISK_USAGE}% (critical)"
fi

# Summary
echo ""
echo "============================================================================"
echo "Health Check Complete"
echo "============================================================================"
echo ""
echo "For detailed logs, run:"
echo "  docker-compose -f $COMPOSE_FILE logs -f"
echo ""
echo "To restart services:"
echo "  docker-compose -f $COMPOSE_FILE restart"
echo ""

