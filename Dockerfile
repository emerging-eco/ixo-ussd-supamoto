# ============================================================================
# Multi-stage Dockerfile for IXO USSD SupaMoto Server
# ============================================================================
# This Dockerfile creates a production-ready container with:
# - Multi-stage build for minimal image size
# - Non-root user for security
# - Health checks for container orchestration
# - Optimized layer caching for faster builds
# ============================================================================

# ============================================================================
# Stage 1: Base - Install pnpm and setup workspace
# ============================================================================
FROM node:20-alpine AS base

# Install pnpm globally
RUN npm install -g pnpm@9

# Set working directory
WORKDIR /app

# ============================================================================
# Stage 2: Dependencies - Install all dependencies
# ============================================================================
FROM base AS dependencies

# Install build dependencies for native modules
# python3, make, g++ are required for node-gyp (used by bcrypt, ssh2, etc.)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install ALL dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# ============================================================================
# Stage 3: Build - Compile TypeScript
# ============================================================================
FROM base AS build

# Copy dependencies from previous stage
COPY --from=dependencies /app/node_modules ./node_modules

# Copy source code and configuration
COPY . .

# Build the application
# This runs: rimraf dist && tsc && tsc-alias && copy SQL files
RUN pnpm build

# ============================================================================
# Stage 4: Production Dependencies - Install only runtime dependencies
# ============================================================================
FROM base AS prod-dependencies

# Install build dependencies for native modules (bcrypt needs these)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install ONLY production dependencies
RUN pnpm install --frozen-lockfile --prod

# ============================================================================
# Stage 5: Production - Final minimal image
# ============================================================================
FROM node:20-alpine AS production

# Install pnpm in production image
RUN npm install -g pnpm@9

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy production dependencies
COPY --from=prod-dependencies --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy built application
COPY --from=build --chown=nodejs:nodejs /app/dist ./dist
COPY --from=build --chown=nodejs:nodejs /app/package.json ./package.json

# Create logs directory with proper permissions
RUN mkdir -p /app/logs && chown -R nodejs:nodejs /app/logs

# Switch to non-root user
USER nodejs

# Expose port (Railway typically uses 8080, but respects PORT env var)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 8080) + '/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
# This runs migrations then starts the server
CMD ["pnpm", "start"]

