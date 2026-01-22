import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true, // Jest-style globals
    environment: "node", // Fast execution for Node.js backend
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 30_000, // 30s - covers USSD session TTL flows
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      thresholds: {
        global: {
          branches: 10,
          functions: 15,
          lines: 20,
          statements: 20,
        },
      },
      exclude: [
        "node_modules/**",
        "dist/**",
        "coverage/**",
        "**/*.d.ts",
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "tests/**/*",
        "src/**/__tests__/**/*",
        "src/**/__mocks__/**/*",
        "src/index.ts",
        "src/i18n/**/*",
        "vitest.config.ts",
      ],
    },
    // Test file patterns
    include: [
      "tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
      "src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
    ],
    // Exclude Docker-dependent integration tests and flow tests
    exclude: [
      "dist/**",
      "**/node_modules/**",
      "**/tests/integration/survey-refactor.test.ts", // Exclude Docker-dependent integration tests
      "**/tests/e2e/recorded-flows.test.ts", // Exclude recorded flows - run manually with test:replay
      "**/tests/flows/**/*.test.ts", // Exclude flow tests - run with pnpm test:flows (requires running server)
      "**/tests/fixtures/flows/**/*.test.ts", // Exclude flow tests - run with pnpm test:flows (requires running server)
    ],
  },
  // Support for path aliases from tsconfig.json
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
