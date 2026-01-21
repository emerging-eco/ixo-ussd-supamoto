import { describe, it, expect } from "vitest";
import { VitestGenerator } from "./vitest-generator.js";
import { SessionFixture } from "../helpers/session-recorder.js";

describe("VitestGenerator", () => {
  let generator: VitestGenerator;

  beforeEach(() => {
    generator = new VitestGenerator();
  });

  describe("generateTestFile", () => {
    it("should generate valid TypeScript code", () => {
      const fixture: SessionFixture = {
        flowName: "test-flow",
        timestamp: "2025-10-25T05:45:15.754Z",
        sessionId: "test-session-123",
        phoneNumber: "+260971230001",
        serviceCode: "*2233#",
        turns: [
          {
            textSent: "",
            serverReply: "CON Welcome\n1. Option 1",
            sessionId: "test-session-123",
            timestamp: "2025-10-25T05:45:15.754Z",
          },
          {
            textSent: "1",
            serverReply: "END Thank you",
            sessionId: "test-session-123",
            timestamp: "2025-10-25T05:45:20.754Z",
          },
        ],
      };

      const code = generator.generateTestFile(fixture, "test-flow");

      expect(code).toBeDefined();
      expect(code.length).toBeGreaterThan(0);
    });

    it("should include all necessary imports", () => {
      const fixture: SessionFixture = {
        flowName: "test-flow",
        timestamp: "2025-10-25T05:45:15.754Z",
        sessionId: "test-session-123",
        phoneNumber: "+260971230001",
        serviceCode: "*2233#",
        turns: [],
      };

      const code = generator.generateTestFile(fixture, "test-flow");

      expect(code).toContain("import { describe, it, expect");
      expect(code).toContain('from "vitest"');
    });

    it("should include test configuration constants", () => {
      const fixture: SessionFixture = {
        flowName: "test-flow",
        timestamp: "2025-10-25T05:45:15.754Z",
        sessionId: "test-session-123",
        phoneNumber: "+260971230001",
        serviceCode: "*2233#",
        turns: [],
      };

      const code = generator.generateTestFile(fixture, "test-flow");

      expect(code).toContain("const SERVER_URL");
      expect(code).toContain("const SESSION_ID");
      expect(code).toContain("const PHONE_NUMBER");
      expect(code).toContain("const SERVICE_CODE");
      expect(code).toContain(fixture.sessionId);
      expect(code).toContain(fixture.phoneNumber);
      expect(code).toContain(fixture.serviceCode);
    });

    it("should include HTTP helper function", () => {
      const fixture: SessionFixture = {
        flowName: "test-flow",
        timestamp: "2025-10-25T05:45:15.754Z",
        sessionId: "test-session-123",
        phoneNumber: "+260971230001",
        serviceCode: "*2233#",
        turns: [],
      };

      const code = generator.generateTestFile(fixture, "test-flow");

      expect(code).toContain("async function sendUssdRequest");
      expect(code).toContain("fetch(SERVER_URL");
      expect(code).toContain("POST");
      expect(code).toContain("application/json");
    });

    it("should create describe block with flow name", () => {
      const fixture: SessionFixture = {
        flowName: "test-flow",
        timestamp: "2025-10-25T05:45:15.754Z",
        sessionId: "test-session-123",
        phoneNumber: "+260971230001",
        serviceCode: "*2233#",
        turns: [],
      };

      const code = generator.generateTestFile(fixture, "login-flow");

      expect(code).toContain('describe("login-flow - USSD Flow Test"');
    });

    it("should generate test case for each conversation turn", () => {
      const fixture: SessionFixture = {
        flowName: "test-flow",
        timestamp: "2025-10-25T05:45:15.754Z",
        sessionId: "test-session-123",
        phoneNumber: "+260971230001",
        serviceCode: "*2233#",
        turns: [
          {
            textSent: "",
            serverReply: "CON Welcome",
            sessionId: "test-session-123",
            timestamp: "2025-10-25T05:45:15.754Z",
          },
          {
            textSent: "1",
            serverReply: "CON Option 1",
            sessionId: "test-session-123",
            timestamp: "2025-10-25T05:45:20.754Z",
          },
          {
            textSent: "2",
            serverReply: "END Goodbye",
            sessionId: "test-session-123",
            timestamp: "2025-10-25T05:45:25.754Z",
          },
        ],
      };

      const code = generator.generateTestFile(fixture, "test-flow");

      // Should have 3 test cases
      const itMatches = code.match(/it\(/g);
      expect(itMatches).toHaveLength(3);

      // Check test descriptions (quotes should be escaped in the test names)
      expect(code).toContain("Turn 1: Initial dial");
      expect(code).toContain('Turn 2: Input: \\"1\\"');
      expect(code).toContain('Turn 3: Input: \\"2\\"');
    });

    it("should include beforeAll and afterAll hooks", () => {
      const fixture: SessionFixture = {
        flowName: "test-flow",
        timestamp: "2025-10-25T05:45:15.754Z",
        sessionId: "test-session-123",
        phoneNumber: "+260971230001",
        serviceCode: "*2233#",
        turns: [],
      };

      const code = generator.generateTestFile(fixture, "test-flow");

      expect(code).toContain("beforeAll(");
      expect(code).toContain("afterAll(");
    });

    it("should include assertions in test cases", () => {
      const fixture: SessionFixture = {
        flowName: "test-flow",
        timestamp: "2025-10-25T05:45:15.754Z",
        sessionId: "test-session-123",
        phoneNumber: "+260971230001",
        serviceCode: "*2233#",
        turns: [
          {
            textSent: "1",
            serverReply: "CON Response",
            sessionId: "test-session-123",
            timestamp: "2025-10-25T05:45:15.754Z",
          },
        ],
      };

      const code = generator.generateTestFile(fixture, "test-flow");

      expect(code).toContain("expect(response).toBe(expected)");
      expect(code).toContain('const expected = "CON Response"');
    });

    it("should escape special characters in strings", () => {
      const fixture: SessionFixture = {
        flowName: "test-flow",
        timestamp: "2025-10-25T05:45:15.754Z",
        sessionId: "test-session-123",
        phoneNumber: "+260971230001",
        serviceCode: "*2233#",
        turns: [
          {
            textSent: 'test"quote',
            serverReply: "CON Line 1\nLine 2",
            sessionId: "test-session-123",
            timestamp: "2025-10-25T05:45:15.754Z",
          },
        ],
      };

      const code = generator.generateTestFile(fixture, "test-flow");

      // Should escape quotes
      expect(code).toContain('\\"');
      // Should escape newlines
      expect(code).toContain("\\n");
    });

    it("should escape quotes in test descriptions", () => {
      const fixture: SessionFixture = {
        flowName: "test-flow",
        timestamp: "2025-10-25T05:45:15.754Z",
        sessionId: "test-session-123",
        phoneNumber: "+260971230001",
        serviceCode: "*2233#",
        turns: [
          {
            textSent: "1",
            serverReply: "CON Response",
            sessionId: "test-session-123",
            timestamp: "2025-10-25T05:45:15.754Z",
          },
          {
            textSent: "*",
            serverReply: "END Goodbye",
            sessionId: "test-session-123",
            timestamp: "2025-10-25T05:45:20.754Z",
          },
        ],
      };

      const code = generator.generateTestFile(fixture, "test-flow");

      // Test descriptions should have escaped quotes
      expect(code).toContain('it("Turn 1: Input: \\"1\\"", async () => {');
      expect(code).toContain('it("Turn 2: Input: \\"*\\"", async () => {');

      // Should not have unescaped quotes that would break syntax
      expect(code).not.toContain('it("Turn 1: Input: "1"", async () => {');
    });

    it("should include helpful comments", () => {
      const fixture: SessionFixture = {
        flowName: "test-flow",
        timestamp: "2025-10-25T05:45:15.754Z",
        sessionId: "test-session-123",
        phoneNumber: "+260971230001",
        serviceCode: "*2233#",
        turns: [
          {
            textSent: "1",
            serverReply: "CON Response",
            sessionId: "test-session-123",
            timestamp: "2025-10-25T05:45:15.754Z",
          },
        ],
      };

      const code = generator.generateTestFile(fixture, "test-flow");

      expect(code).toContain("// Send user input");
      expect(code).toContain("// Expected server response");
      expect(code).toContain("// Assert response matches expected");
      expect(code).toContain("// Test Configuration");
    });

    it("should include file header with metadata", () => {
      const fixture: SessionFixture = {
        flowName: "test-flow",
        timestamp: "2025-10-25T05:45:15.754Z",
        sessionId: "test-session-123",
        phoneNumber: "+260971230001",
        serviceCode: "*2233#",
        turns: [],
      };

      const code = generator.generateTestFile(fixture, "login-flow");

      expect(code).toContain("/**");
      expect(code).toContain("* Generated Test: login-flow");
      expect(code).toContain("- Session ID: test-session-123");
      expect(code).toContain("- Phone: +260971230001");
      expect(code).toContain("* @generated");
    });
  });

  describe("validateGeneratedCode", () => {
    it("should validate correct code", () => {
      const validCode = `
import { describe, it, expect } from "vitest";

describe("test", () => {
  it("should work", () => {
    expect(true).toBe(true);
  });
});
`;

      expect(generator.validateGeneratedCode(validCode)).toBe(true);
    });

    it("should reject code without describe block", () => {
      const invalidCode = `
import { it, expect } from "vitest";
it("test", () => {});
`;

      expect(generator.validateGeneratedCode(invalidCode)).toBe(false);
    });

    it("should accept code without test cases (empty sessions)", () => {
      const validCode = `
import { describe, expect } from "vitest";
describe("test", () => {});
`;

      // Empty sessions are valid - they just have no test cases
      expect(generator.validateGeneratedCode(validCode)).toBe(true);
    });

    it("should reject code with unbalanced braces", () => {
      const invalidCode = `
import { describe, it, expect } from "vitest";
describe("test", () => {
  it("test", () => {
    expect(true).toBe(true);
  });
`;

      expect(generator.validateGeneratedCode(invalidCode)).toBe(false);
    });
  });
});
