# Flow Tests - Quick Start Guide

## 🚀 Running Flow Tests

### Prerequisites

```bash
# Terminal 1: Start the USSD server
pnpm dev
```

### Run Tests

```bash
# Terminal 2: Run all flow tests
pnpm test:flows:run

# Or run in watch mode
pnpm test:flows
```

## ⚠️ Common Mistakes

### ❌ This Will NOT Work

```bash
pnpm test ./tests/flows/
# Error: No test files found, exiting with code 1
# Reason: Flow tests are excluded from main vitest.config.ts
```

### ✅ Use This Instead

```bash
pnpm test:flows:run
# Uses vitest.flows.config.ts which includes flow tests
```

## 📝 Creating New Flow Tests

### 1. Record a Session

```bash
pnpm test:interactive
# Navigate through the USSD flow you want to test
```

### 2. Generate Test

```bash
pnpm generate:test logs/sessions/session-YYYY-MM-DD-HH-mm-ss.log my-flow-name
```

### 3. Run the Test

```bash
# Make sure server is running
pnpm dev

# Run the test
pnpm test:flows:run
```

## 🔧 Configuration

Flow tests use **separate configuration** from unit tests:

| Aspect          | Unit Tests         | Flow Tests               |
| --------------- | ------------------ | ------------------------ |
| Config File     | `vitest.config.ts` | `vitest.flows.config.ts` |
| Setup File      | `tests/setup.ts`   | `tests/flows/setup.ts`   |
| Environment     | Mocked services    | Real server              |
| Command         | `pnpm test`        | `pnpm test:flows`        |
| Requires Server | ❌ No              | ✅ Yes                   |

## 🌐 Environment Variables

```bash
# Override server URL
USSD_TEST_SERVER_URL=http://localhost:3000/api/ussd pnpm test:flows:run

# Test against staging
USSD_TEST_SERVER_URL=https://staging.example.com/api/ussd pnpm test:flows:run
```

## 📚 More Information

See [README.md](./README.md) for complete documentation.
