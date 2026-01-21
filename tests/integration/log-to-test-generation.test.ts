import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { SessionLogParser } from "../../src/utils/session-log-parser.js";
import { VitestGenerator } from "../utils/vitest-generator.js";

describe("Log to Test Generation - End-to-End Workflow", () => {
  let tempDir: string;
  let tempLogFile: string;
  let tempTestFile: string;

  beforeEach(() => {
    // Create temp directory for test files
    tempDir = path.join(process.cwd(), "tests", "fixtures", "temp-e2e");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up temp files
    if (fs.existsSync(tempLogFile)) {
      fs.unlinkSync(tempLogFile);
    }
    if (fs.existsSync(tempTestFile)) {
      fs.unlinkSync(tempTestFile);
    }
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        fs.unlinkSync(path.join(tempDir, file));
      }
      fs.rmdirSync(tempDir);
    }
  });

  it("should complete full workflow: log file → parse → generate → validate", () => {
    // Step 1: Create a sample session log file
    const logContent = `================================================================================
USSD INTERACTIVE TEST SESSION LOG
================================================================================
{
  "sessionId": "e2e-test-session-123",
  "phoneNumber": "+260971230001",
  "serviceCode": "*2233#",
  "startTime": "2025-10-25T10:00:00.000Z",
  "nodeVersion": "v24.10.0",
  "platform": "darwin",
  "environment": "test"
}
================================================================================

[2025-10-25T10:00:00.100Z] 
CON Welcome to USSD App
1. Option 1
2. Option 2

[2025-10-25T10:00:05.200Z] USER INPUT: 1
[2025-10-25T10:00:05.300Z] 
CON You selected option 1
0. Back

[2025-10-25T10:00:10.400Z] USER INPUT: 0
[2025-10-25T10:00:10.500Z] 
END Thank you for using USSD App

================================================================================
SESSION ENDED
{
  "endTime": "2025-10-25T10:00:15.000Z",
  "status": "completed"
}
================================================================================
`;

    tempLogFile = path.join(tempDir, "e2e-test-session.log");
    fs.writeFileSync(tempLogFile, logContent);

    // Step 2: Parse the log file
    const parser = new SessionLogParser();
    const fixture = parser.parseLogFile(tempLogFile);

    // Verify parsing
    expect(fixture).toBeDefined();
    expect(fixture.sessionId).toBe("e2e-test-session-123");
    expect(fixture.phoneNumber).toBe("+260971230001");
    expect(fixture.serviceCode).toBe("*2233#");
    expect(fixture.turns).toHaveLength(3); // Initial dial + 2 user inputs

    // Verify turns
    expect(fixture.turns[0].textSent).toBe(""); // Initial dial
    expect(fixture.turns[0].serverReply).toContain("Welcome to USSD App");
    expect(fixture.turns[1].textSent).toBe("1");
    expect(fixture.turns[1].serverReply).toContain("You selected option 1");
    expect(fixture.turns[2].textSent).toBe("0");
    expect(fixture.turns[2].serverReply).toContain("Thank you");

    // Step 3: Generate test code
    fixture.flowName = "e2e-test-flow";
    const generator = new VitestGenerator();
    const testCode = generator.generateTestFile(fixture, "e2e-test-flow");

    // Verify generated code
    expect(testCode).toBeDefined();
    expect(testCode.length).toBeGreaterThan(0);

    // Step 4: Validate generated code structure
    expect(testCode).toContain("import { describe, it, expect");
    expect(testCode).toContain('describe("e2e-test-flow - USSD Flow Test"');
    expect(testCode).toContain("async function sendUssdRequest");
    expect(testCode).toContain("beforeAll(");
    expect(testCode).toContain("afterAll(");

    // Verify test cases for each turn (quotes should be escaped)
    expect(testCode).toContain("Turn 1: Initial dial");
    expect(testCode).toContain('Turn 2: Input: \\"1\\"');
    expect(testCode).toContain('Turn 3: Input: \\"0\\"');

    // Verify assertions
    expect(testCode).toContain("expect(response).toBe(expected)");

    // Step 5: Validate code syntax
    expect(generator.validateGeneratedCode(testCode)).toBe(true);

    // Step 6: Write generated code to file
    tempTestFile = path.join(tempDir, "e2e-test-flow.test.ts");
    fs.writeFileSync(tempTestFile, testCode);

    // Verify file was created
    expect(fs.existsSync(tempTestFile)).toBe(true);

    // Verify file content matches generated code
    const savedContent = fs.readFileSync(tempTestFile, "utf-8");
    expect(savedContent).toBe(testCode);
  });

  it("should handle errors gracefully for invalid log file", () => {
    const invalidLogContent = `This is not a valid session log file`;

    tempLogFile = path.join(tempDir, "invalid-log.log");
    fs.writeFileSync(tempLogFile, invalidLogContent);

    const parser = new SessionLogParser();

    expect(() => parser.parseLogFile(tempLogFile)).toThrow(
      "Could not find metadata block"
    );
  });

  it("should handle empty session logs", () => {
    const emptyLogContent = `================================================================================
USSD INTERACTIVE TEST SESSION LOG
================================================================================
{
  "sessionId": "empty-session-123",
  "phoneNumber": "+260971230001",
  "serviceCode": "*2233#",
  "startTime": "2025-10-25T10:00:00.000Z"
}
================================================================================

================================================================================
SESSION ENDED
{
  "endTime": "2025-10-25T10:00:15.000Z",
  "status": "completed"
}
================================================================================
`;

    tempLogFile = path.join(tempDir, "empty-session.log");
    fs.writeFileSync(tempLogFile, emptyLogContent);

    const parser = new SessionLogParser();
    const fixture = parser.parseLogFile(tempLogFile);

    expect(fixture).toBeDefined();
    expect(fixture.turns).toHaveLength(0);

    // Should still generate valid test code (with no test cases)
    fixture.flowName = "empty-flow";
    const generator = new VitestGenerator();
    const testCode = generator.generateTestFile(fixture, "empty-flow");

    expect(testCode).toBeDefined();
    expect(testCode).toContain('describe("empty-flow - USSD Flow Test"');
    expect(generator.validateGeneratedCode(testCode)).toBe(true);
  });

  it("should handle multi-line server responses correctly", () => {
    const multiLineLogContent = `================================================================================
USSD INTERACTIVE TEST SESSION LOG
================================================================================
{
  "sessionId": "multiline-session-123",
  "phoneNumber": "+260971230001",
  "serviceCode": "*2233#",
  "startTime": "2025-10-25T10:00:00.000Z"
}
================================================================================

[2025-10-25T10:00:00.100Z] 
CON Welcome to USSD App
This is line 2
This is line 3
1. Option 1
2. Option 2

[2025-10-25T10:00:05.200Z] USER INPUT: 1
[2025-10-25T10:00:05.300Z] 
CON Multi-line response
Line 2 of response
Line 3 of response

================================================================================
SESSION ENDED
================================================================================
`;

    tempLogFile = path.join(tempDir, "multiline-session.log");
    fs.writeFileSync(tempLogFile, multiLineLogContent);

    const parser = new SessionLogParser();
    const fixture = parser.parseLogFile(tempLogFile);

    expect(fixture.turns).toHaveLength(2);
    expect(fixture.turns[0].serverReply).toContain("This is line 2");
    expect(fixture.turns[0].serverReply).toContain("This is line 3");
    expect(fixture.turns[1].serverReply).toContain("Line 2 of response");
    expect(fixture.turns[1].serverReply).toContain("Line 3 of response");

    // Generate test and verify multi-line strings are escaped
    fixture.flowName = "multiline-flow";
    const generator = new VitestGenerator();
    const testCode = generator.generateTestFile(fixture, "multiline-flow");

    expect(testCode).toContain("\\n"); // Newlines should be escaped
  });

  it("should handle special characters in user input and responses", () => {
    const specialCharsLogContent = `================================================================================
USSD INTERACTIVE TEST SESSION LOG
================================================================================
{
  "sessionId": "special-chars-session-123",
  "phoneNumber": "+260971230001",
  "serviceCode": "*2233#",
  "startTime": "2025-10-25T10:00:00.000Z"
}
================================================================================

[2025-10-25T10:00:00.100Z] 
CON Enter your name:

[2025-10-25T10:00:05.200Z] USER INPUT: John "The Boss" Doe
[2025-10-25T10:00:05.300Z] 
CON Hello, John "The Boss" Doe!

================================================================================
SESSION ENDED
================================================================================
`;

    tempLogFile = path.join(tempDir, "special-chars-session.log");
    fs.writeFileSync(tempLogFile, specialCharsLogContent);

    const parser = new SessionLogParser();
    const fixture = parser.parseLogFile(tempLogFile);

    expect(fixture.turns).toHaveLength(2);
    expect(fixture.turns[1].textSent).toBe('John "The Boss" Doe');

    // Generate test and verify quotes are escaped
    fixture.flowName = "special-chars-flow";
    const generator = new VitestGenerator();
    const testCode = generator.generateTestFile(fixture, "special-chars-flow");

    expect(testCode).toContain('\\"'); // Quotes should be escaped
  });
});
