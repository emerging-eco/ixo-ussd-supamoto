/**
 * Flow Tests Setup
 *
 * This setup file is specifically for generated flow tests that need to connect
 * to a real running USSD server instead of using mocked services.
 *
 * Unlike the main test setup (tests/setup.ts), this does NOT:
 * - Initialize mocked database services
 * - Initialize mocked IXO services
 * - Initialize mocked Matrix services
 * - Set up beforeEach hooks that reset mocks
 *
 * Flow tests make actual HTTP requests to a running server.
 */

import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env file (not .env.test)
// This allows flow tests to use the same configuration as the running server
const envPath = path.resolve(process.cwd(), ".env");
dotenv.config({ path: envPath });

// Set minimal required environment variables for flow tests
const defaultValues = {
  CHAIN_NETWORK: process.env.CHAIN_NETWORK || "devnet",
  MATRIX_HOME_SERVER:
    process.env.MATRIX_HOME_SERVER || "https://devmx.ixo.earth",
  FEEGRANT_URL: process.env.FEEGRANT_URL || "https://feegrant.devnet.ixo.earth",
};

// Set defaults only if not already set
for (const [key, value] of Object.entries(defaultValues)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}

console.log("🌐 Flow test environment initialized");
console.log("📡 Tests will connect to real USSD server");
console.log(
  `🔗 Server URL: ${process.env.USSD_TEST_SERVER_URL || "https://ixo-ussd-supamoto-development.up.railway.app/api/ussd"}`
);
console.log("");
console.log(
  "⚠️  Make sure the USSD server is running before executing flow tests!"
);
console.log("   Start server with: pnpm dev");
console.log("");
