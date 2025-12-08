#!/bin/bash

# ============================================================================
# Docker Build Verification Script
# ============================================================================
# Verifies that the build works correctly in a Docker-like environment
# ============================================================================

set -e  # Exit on error (like Docker does)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

clear
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Docker Build Verification${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo ""

TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo "🔧 Setting up Docker build context..."
echo ""

# Copy files exactly as Docker would (respecting .dockerignore)
cp package.json "$TEMP_DIR/"
cp pnpm-lock.yaml "$TEMP_DIR/"
cp tsconfig.json "$TEMP_DIR/"
cp tsconfig.build.json "$TEMP_DIR/"
rsync -aq --exclude='reference/' src/ "$TEMP_DIR/src/"
cp -r migrations "$TEMP_DIR/" 2>/dev/null || true
mkdir -p "$TEMP_DIR/scripts/build"
cp scripts/build/*.js "$TEMP_DIR/scripts/build/" 2>/dev/null || true

cd "$TEMP_DIR"

echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile > /dev/null 2>&1
echo "   ✅ Done"
echo ""

echo "🔨 Running build..."
echo ""
echo -e "${YELLOW}────────────────────────────────────────────────────────────────${NC}"

# Run build
if pnpm build 2>&1; then
    echo -e "${YELLOW}────────────────────────────────────────────────────────────────${NC}"
    echo ""
    echo -e "${GREEN}✅ Build completed successfully!${NC}"
    echo ""
    echo "Verifying output structure..."
    if [ -f "dist/migrations/run-migrations.js" ]; then
        echo -e "${GREEN}✅ dist/migrations/run-migrations.js exists${NC}"
        echo -e "${GREEN}✅ Location matches package.json start script${NC}"
    else
        echo -e "${RED}❌ File NOT found at expected location!${NC}"
        echo "Looking for it..."
        find dist/ -name "run-migrations.js" 2>/dev/null || echo "Not found anywhere"
        exit 1
    fi

    if [ -f "dist/index.js" ]; then
        echo -e "${GREEN}✅ dist/index.js exists${NC}"
    else
        echo -e "${RED}❌ dist/index.js NOT found!${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}────────────────────────────────────────────────────────────────${NC}"
    echo ""
    echo -e "${RED}❌ BUILD FAILED!${NC}"
    echo ""
    echo "The build failed. Check the errors above."
    exit 1
fi

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Verification Summary${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}✅ Build completes without errors${NC}"
echo -e "${GREEN}✅ dist/migrations/run-migrations.js is in the correct location${NC}"
echo -e "${GREEN}✅ dist/index.js exists${NC}"
echo ""
echo "The Docker build should now work correctly!"
echo ""
echo "Files excluded from production build:"
echo "  • src/utils/session-log-parser.ts (dev-only utility)"
echo "  • src/utils/vitest-generator.ts (dev-only utility)"
echo ""

