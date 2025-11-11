#!/bin/bash

################################################################################
# SupaMoto Claims Bot API - Customer Data Retrieval Script
################################################################################
#
# This script demonstrates how to retrieve customer data from the SupaMoto
# Claims Bot service using the @ixo/supamoto-bot-sdk HTTP API endpoints.
#
# Prerequisites:
#   - jq (JSON processor): brew install jq  OR  apt-get install jq
#   - curl (usually pre-installed)
#
# Configuration:
#   Set the following environment variables or edit the defaults below:
#   - CLAIMS_BOT_URL: Base URL of the Claims Bot service
#   - CLAIMS_BOT_ACCESS_TOKEN: Bearer token for authentication
#
# Usage:
#   ./scripts/get-customer-data.sh [CUSTOMER_ID]
#
# Examples:
#   ./scripts/get-customer-data.sh C12345678
#   CLAIMS_BOT_URL=https://api.example.com ./scripts/get-customer-data.sh C12345678
#
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration - Load from environment or use defaults
CLAIMS_BOT_URL="${CLAIMS_BOT_URL:-https://supamoto.claims.bot.devmx.ixo.earth/}"
ACCESS_TOKEN="${CLAIMS_BOT_ACCESS_TOKEN:-syt_ZGlkLWl4by1peG8xamdwd2thbW5kMDltdTZnZXRhYXNzbWtrdWVuNmc5bXNudGw5bHE_DGIFOudKmGuXDkxjMsYq_2ja1np}"

# Get customer ID from command line argument or use default
CUSTOMER_ID="${1:-C12345678}"

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is not installed. Please install it first:${NC}"
    echo "  macOS:   brew install jq"
    echo "  Ubuntu:  sudo apt-get install jq"
    echo "  CentOS:  sudo yum install jq"
    exit 1
fi

# Validate configuration
if [[ "$CLAIMS_BOT_URL" == "https://your-claims-bot-url.com" ]]; then
    echo -e "${YELLOW}Warning: Using default CLAIMS_BOT_URL. Set CLAIMS_BOT_URL environment variable.${NC}"
fi

if [[ "$ACCESS_TOKEN" == "your-access-token-here" ]]; then
    echo -e "${YELLOW}Warning: Using default ACCESS_TOKEN. Set CLAIMS_BOT_ACCESS_TOKEN environment variable.${NC}"
fi

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  SupaMoto Claims Bot API - Customer Data Retrieval            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Configuration:${NC}"
echo "  Base URL:    $CLAIMS_BOT_URL"
echo "  Customer ID: $CUSTOMER_ID"
echo ""

################################################################################
# 1. Get Customer by ID
################################################################################
echo -e "${BLUE}═══ 1. Get Customer by ID ═══${NC}"
echo "Endpoint: GET /api/v1/customers/${CUSTOMER_ID}"
echo ""

curl -s -X GET \
  "${CLAIMS_BOT_URL}/api/v1/customers/${CUSTOMER_ID}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  | jq '.' || echo -e "${RED}Failed to retrieve customer${NC}"

echo ""

################################################################################
# 2. Get Customer Claims
################################################################################
echo -e "${BLUE}═══ 2. Get Customer Claims ═══${NC}"
echo "Endpoint: GET /api/v1/claims/customer/${CUSTOMER_ID}"
echo ""

curl -s -X GET \
  "${CLAIMS_BOT_URL}/api/v1/claims/customer/${CUSTOMER_ID}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  | jq '.' || echo -e "${RED}Failed to retrieve claims${NC}"

echo ""

################################################################################
# 3. Get IXO Accounts
################################################################################
echo -e "${BLUE}═══ 3. Get IXO Accounts ═══${NC}"
echo "Endpoint: GET /api/v1/ixo-accounts/customer/${CUSTOMER_ID}"
echo ""

curl -s -X GET \
  "${CLAIMS_BOT_URL}/api/v1/ixo-accounts/customer/${CUSTOMER_ID}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  | jq '.' || echo -e "${RED}Failed to retrieve IXO accounts${NC}"

echo ""

################################################################################
# 4. Search Customers
################################################################################
echo -e "${BLUE}═══ 4. Search Customers ═══${NC}"
echo "Endpoint: GET /api/v1/customers/search?search=${CUSTOMER_ID}&limit=10"
echo ""

curl -s -X GET \
  "${CLAIMS_BOT_URL}/api/v1/customers/search?search=${CUSTOMER_ID}&limit=10&offset=0" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  | jq '.' || echo -e "${RED}Failed to search customers${NC}"

echo ""

################################################################################
# 5. Get Collection IDs
################################################################################
echo -e "${BLUE}═══ 5. Get Collection IDs ═══${NC}"
echo "Endpoint: GET /api/v1/collection-ids"
echo ""

curl -s -X GET \
  "${CLAIMS_BOT_URL}/api/v1/collection-ids" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  | jq '.' || echo -e "${RED}Failed to retrieve collection IDs${NC}"

echo ""
echo -e "${GREEN}✓ Script completed${NC}"

