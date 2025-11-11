#!/bin/bash
# Subscription Service Test Script
# This script tests the complete subscription lifecycle
set -e  # Exit on error
# Configuration
API_BASE_URL="https://subscriptions-api.alwyn-vanwyk.workers.dev"
MATRIX_SERVER="devmx.ixo.earth"
USER_ADDRESS="ixo1s5xqjuk4w8mj8jd2cnxv5395qv9dlcxqpjltwf"
PASSWORD="NzViNjJmMWU2NTgwMmI2NDI4"
CUSTOMER_ID="C61FBF35F"
PLAN_ID="prod_TCFBlRPDX8G0kP"
KV_NAMESPACE_ID="3c79e41e797d433d91cfe59b274bfd27"
echo "========================================="
echo "Subscription Service Test Script"
echo "========================================="
echo ""
# Step 1: Health Check
echo "Step 1: Checking API health..."
curl "${API_BASE_URL}/health" || echo "No health endpoint"
echo ""
# Step 1.5: Get Matrix Access Token
echo ""
echo "Step 1.5: Get Matrix Access Token"
curl -X POST "https://devmx.ixo.earth/_matrix/client/r0/login" \
  -H "Content-Type: application/json" \
  -d "{
  \"type\": \"m.login.password\",
  \"user\": \"did-ixo-${USER_ADDRESS}\",
  \"password\": \"${PASSWORD}\"
  }"
MATRIX_ACCESS_TOKEN=$(curl -X POST "https://devmx.ixo.earth/_matrix/client/r0/login" \
  -H "Content-Type: application/json" \
  -d "{
  \"type\": \"m.login.password\",
  \"user\": \"did-ixo-${USER_ADDRESS}\",
  \"password\": \"${PASSWORD}\"
  }" | jq -r '.access_token')
echo $MATRIX_ACCESS_TOKEN
echo ""
# Step 2: Get OpenID Access Token
echo "Step 2: Getting OpenID access token..."
OPEN_ID_ACCESS_TOKEN=$(curl -s -X POST \
  "https://${MATRIX_SERVER}/_matrix/client/r0/user/@did-ixo-${USER_ADDRESS}:${MATRIX_SERVER}/openid/request_token" \
  -H "Authorization: Bearer ${MATRIX_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{}' | jq -r '.access_token')
if [ -z "$OPEN_ID_ACCESS_TOKEN" ] || [ "$OPEN_ID_ACCESS_TOKEN" = "null" ]; then
  echo "ERROR: Failed to get OpenID access token"
  exit 1
fi
echo "OpenID Access Token: ${OPEN_ID_ACCESS_TOKEN}"
echo ""
# Step 3: Create Subscription
echo "Step 3: Creating subscription..."
curl -X POST \
  "${API_BASE_URL}/api/v1/subscriptions/create" \
  -H "Authorization: Bearer ${OPEN_ID_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"userAddress\": \"${USER_ADDRESS}\",
    \"planId\": \"${PLAN_ID}\",
    \"stripeCustomerId\": \"${CUSTOMER_ID}\",
    \"amountInUSD\": 1,
    \"currentPeriod\": {
      \"startDate\": 1761936000000,
      \"endDate\": 1764528000000
    },
    \"previousPeriod\": {
      \"startDate\": 1759257600000,
      \"endDate\": 1761859200000
    },
    \"idempotencyKey\": \"devnet-supamoto-subscriptions-001\"
  }"
echo ""
echo ""
# Step 4: Wait for workflow to complete
echo "Step 4: Waiting some minutes for workflow to complete..."
sleep 360
echo ""
# Step 5: Get Subscription Status
echo "Step 5: Getting subscription status..."
curl -X GET \
  "${API_BASE_URL}/api/v1/subscriptions" \
  -H "Authorization: Bearer ${OPEN_ID_ACCESS_TOKEN}" | jq
echo ""
# Step 6: Check KV Store (REQUIRED)
echo "Step 6: Checking KV store..."
# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
  echo "ERROR: Wrangler CLI is not installed. Please install it to continue."
  echo "Install with: npm install -g wrangler"
  exit 1
fi
# Get the value from KV store
KV_VALUE=$(wrangler kv key get "${USER_ADDRESS}" --namespace-id ${KV_NAMESPACE_ID})
# Check if the command succeeded and returned a value
if [ $? -ne 0 ]; then
  echo "ERROR: Failed to retrieve value from KV store"
  exit 1
fi
if [ -z "$KV_VALUE" ]; then
  echo "ERROR: No value found in KV store for user address: ${USER_ADDRESS}"
  exit 1
fi
echo "KV Store value: ${KV_VALUE}"
echo ""
# Step 7: Topup Subscription
echo "Step 7: Topping up subscription..."
curl -X POST \
  "${API_BASE_URL}/api/v1/subscriptions/topup" \
  -H "Authorization: Bearer ${OPEN_ID_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"userAddress\": \"${USER_ADDRESS}\",
    \"planId\": \"${PLAN_ID}\",
    \"stripeCustomerId\": \"${CUSTOMER_ID}\",
    \"amountInUSD\": 10.0,
    \"currentPeriod\": {
      \"startDate\": 1761936000000,
      \"endDate\": 1764528000000
    },
    \"previousPeriod\": {
      \"startDate\": 1759257600000,
      \"endDate\": 1761859200000
    },
    \"idempotencyKey\": \"devnet-supamoto-topup-001\"
  }"
echo ""
echo ""
# Step 8: Cancel Subscription
echo "Step 8: Cancelling subscription..."
curl -X POST \
  "${API_BASE_URL}/api/v1/subscriptions/cancel" \
  -H "Authorization: Bearer ${OPEN_ID_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"userAddress\": \"${USER_ADDRESS}\",
    \"planId\": \"${PLAN_ID}\",
    \"stripeCustomerId\": \"${CUSTOMER_ID}\",
    \"subscriptionId\": \"sub_test123\",
    \"previousPeriod\": {
      \"startDate\": 1759257600000,
      \"endDate\": 1761859200000
    },
    \"idempotencyKey\": \"devnet-supamoto-cancel-001\"
  }"
echo ""
echo ""
echo "========================================="
echo "Test script completed!"
echo "========================================="
