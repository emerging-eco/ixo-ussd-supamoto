import { defineConfig } from "vitest/config";
import { BaseSequencer, TestSpecification } from "vitest/node";

/**
 * Alphabetical sequencer — guarantees test files execute in lexicographic
 * order by filepath.  This is critical because flow tests have implicit
 * ordering dependencies (e.g. account-creation 02-* must run before
 * login 03-* which must run before agent 05-*).
 */
class AlphabeticalSequencer extends BaseSequencer {
  async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    return [...files].sort((a, b) => a.moduleId.localeCompare(b.moduleId));
  }
}

/**
 * Vitest Configuration for Flow Tests
 *
 * This configuration is specifically for generated flow tests that connect
 * to a real running USSD server via HTTP requests.
 *
 * Key differences from main vitest.config.ts:
 * - Uses tests/flows/setup.ts instead of tests/setup.ts
 * - Does NOT initialize mocked services
 * - Only runs tests in tests/flows/ directory
 * - Longer timeout to account for real server response times
 *
 * Usage:
 *   pnpm vitest --config vitest.flows.config.ts
 *   USSD_TEST_SERVER_URL=http://localhost:3005/api/ussd pnpm vitest --config vitest.flows.config.ts
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Use flow-specific setup that doesn't initialize mocks
    setupFiles: ["./tests/fixtures/flows/setup.ts"],
    testTimeout: 60_000, // 60s - longer timeout for real server requests
    // Sequential execution: tests run in a single fork, alphabetically by filename.
    // This ensures account-creation tests run before login tests (which need DB state).
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    sequence: {
      concurrent: false,
      sequencer: AlphabeticalSequencer,
    },
    // Only include flow tests
    include: ["tests/fixtures/flows/**/*.test.ts"],
    // Exclude example tests
    exclude: [
      "dist/**",
      "**/node_modules/**",
      "**/tests/flows/example-*.test.ts",
    ],
  },
  // Support for path aliases from tsconfig.json
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
