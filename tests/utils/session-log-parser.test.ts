import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { SessionLogParser } from "../../src/utils/session-log-parser.js";

describe("SessionLogParser", () => {
  let parser: SessionLogParser;
  let tempDir: string;

  beforeEach(() => {
    parser = new SessionLogParser();
    // Create temp directory for test log files
    tempDir = path.join(process.cwd(), "tests", "fixtures", "temp-logs");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up temp files
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        fs.unlinkSync(path.join(tempDir, file));
      }
      fs.rmdirSync(tempDir);
    }
  });

  describe("parseLogFile", () => {
    it("should parse a complete valid log file", () => {
      const logContent = `================================================================================
USSD INTERACTIVE TEST SESSION LOG
================================================================================
{
  "sessionId": "test-session-123",
  "phoneNumber": "+260971230001",
  "serviceCode": "*2233#",
  "startTime": "2025-10-25T05:45:15.754Z",
  "nodeVersion": "v24.10.0",
  "platform": "darwin",
  "environment": "development"
}
================================================================================

[2025-10-25T05:45:15.792Z] 
CON Welcome to USSD App
1. Option 1
2. Option 2

[2025-10-25T05:46:12.386Z] USER INPUT: 1
[2025-10-25T05:46:12.395Z] 
CON You selected option 1
0. Back

[2025-10-25T05:46:15.176Z] USER INPUT: 0
[2025-10-25T05:46:15.184Z] 
END Thank you for using USSD App

================================================================================
SESSION ENDED
{
  "endTime": "2025-10-25T05:47:15.037Z",
  "status": "completed"
}
================================================================================
`;

      const logPath = path.join(tempDir, "test-session.log");
      fs.writeFileSync(logPath, logContent);

      const fixture = parser.parseLogFile(logPath);

      expect(fixture).toBeDefined();
      expect(fixture.sessionId).toBe("test-session-123");
      expect(fixture.phoneNumber).toBe("+260971230001");
      expect(fixture.serviceCode).toBe("*2233#");
      expect(fixture.timestamp).toBe("2025-10-25T05:45:15.754Z");
      expect(fixture.turns).toHaveLength(3); // Initial dial + 2 user inputs
    });

    it("should extract correct conversation turns", () => {
      const logContent = `================================================================================
USSD INTERACTIVE TEST SESSION LOG
================================================================================
{
  "sessionId": "test-session-456",
  "phoneNumber": "+260971230001",
  "serviceCode": "*2233#",
  "startTime": "2025-10-25T05:45:15.754Z"
}
================================================================================

[2025-10-25T05:45:15.792Z] 
CON Welcome to USSD App
1. Option 1

[2025-10-25T05:46:12.386Z] USER INPUT: 1
[2025-10-25T05:46:12.395Z] 
CON You selected option 1

================================================================================
SESSION ENDED
================================================================================
`;

      const logPath = path.join(tempDir, "test-turns.log");
      fs.writeFileSync(logPath, logContent);

      const fixture = parser.parseLogFile(logPath);

      expect(fixture.turns).toHaveLength(2);

      // First turn: initial dial (empty input)
      expect(fixture.turns[0].textSent).toBe("");
      expect(fixture.turns[0].serverReply).toContain("Welcome to USSD App");

      // Second turn: user input "1"
      expect(fixture.turns[1].textSent).toBe("1");
      expect(fixture.turns[1].serverReply).toContain("You selected option 1");
    });

    it("should handle multi-line server responses", () => {
      const logContent = `================================================================================
USSD INTERACTIVE TEST SESSION LOG
================================================================================
{
  "sessionId": "test-session-789",
  "phoneNumber": "+260971230001",
  "serviceCode": "*2233#",
  "startTime": "2025-10-25T05:45:15.754Z"
}
================================================================================

[2025-10-25T05:45:15.792Z] 
CON Welcome to USSD App
This is line 2
This is line 3
1. Option 1
2. Option 2

[2025-10-25T05:46:12.386Z] USER INPUT: 1
[2025-10-25T05:46:12.395Z] 
CON Response line 1
Response line 2

================================================================================
SESSION ENDED
================================================================================
`;

      const logPath = path.join(tempDir, "test-multiline.log");
      fs.writeFileSync(logPath, logContent);

      const fixture = parser.parseLogFile(logPath);

      expect(fixture.turns[0].serverReply).toContain("This is line 2");
      expect(fixture.turns[0].serverReply).toContain("This is line 3");
      expect(fixture.turns[1].serverReply).toContain("Response line 2");
    });

    it("should throw error for non-existent file", () => {
      const nonExistentPath = path.join(tempDir, "does-not-exist.log");

      expect(() => parser.parseLogFile(nonExistentPath)).toThrow(
        "Log file not found"
      );
    });

    it("should throw error for log with missing metadata", () => {
      const logContent = `Some random log content without metadata`;

      const logPath = path.join(tempDir, "no-metadata.log");
      fs.writeFileSync(logPath, logContent);

      expect(() => parser.parseLogFile(logPath)).toThrow(
        "Could not find metadata block"
      );
    });

    it("should throw error for log with malformed JSON metadata", () => {
      const logContent = `================================================================================
USSD INTERACTIVE TEST SESSION LOG
================================================================================
{
  "sessionId": "test-session-123"
  "phoneNumber": "+260971230001"
  INVALID JSON
}
================================================================================
`;

      const logPath = path.join(tempDir, "malformed-json.log");
      fs.writeFileSync(logPath, logContent);

      expect(() => parser.parseLogFile(logPath)).toThrow(
        "Failed to parse metadata JSON"
      );
    });

    it("should throw error for metadata missing required fields", () => {
      const logContent = `================================================================================
USSD INTERACTIVE TEST SESSION LOG
================================================================================
{
  "sessionId": "test-session-123"
}
================================================================================
`;

      const logPath = path.join(tempDir, "missing-fields.log");
      fs.writeFileSync(logPath, logContent);

      expect(() => parser.parseLogFile(logPath)).toThrow("Missing phoneNumber");
    });

    it("should handle partial sessions (no END response)", () => {
      const logContent = `================================================================================
USSD INTERACTIVE TEST SESSION LOG
================================================================================
{
  "sessionId": "test-session-partial",
  "phoneNumber": "+260971230001",
  "serviceCode": "*2233#",
  "startTime": "2025-10-25T05:45:15.754Z"
}
================================================================================

[2025-10-25T05:45:15.792Z] 
CON Welcome to USSD App
1. Option 1

[2025-10-25T05:46:12.386Z] USER INPUT: 1
[2025-10-25T05:46:12.395Z] 
CON You selected option 1
`;

      const logPath = path.join(tempDir, "partial-session.log");
      fs.writeFileSync(logPath, logContent);

      const fixture = parser.parseLogFile(logPath);

      // Should still parse successfully
      expect(fixture).toBeDefined();
      expect(fixture.turns).toHaveLength(2);
    });

    it("should handle empty logs (no conversation turns)", () => {
      const logContent = `================================================================================
USSD INTERACTIVE TEST SESSION LOG
================================================================================
{
  "sessionId": "test-session-empty",
  "phoneNumber": "+260971230001",
  "serviceCode": "*2233#",
  "startTime": "2025-10-25T05:45:15.754Z"
}
================================================================================

================================================================================
SESSION ENDED
================================================================================
`;

      const logPath = path.join(tempDir, "empty-session.log");
      fs.writeFileSync(logPath, logContent);

      const fixture = parser.parseLogFile(logPath);

      expect(fixture).toBeDefined();
      expect(fixture.turns).toHaveLength(0);
    });
  });

  describe("validateFixture", () => {
    it("should validate a correct fixture", () => {
      const fixture = {
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

      expect(parser.validateFixture(fixture)).toBe(true);
    });

    it("should reject fixture with missing flowName", () => {
      const fixture = {
        flowName: "",
        timestamp: "2025-10-25T05:45:15.754Z",
        sessionId: "test-session-123",
        phoneNumber: "+260971230001",
        serviceCode: "*2233#",
        turns: [],
      };

      expect(parser.validateFixture(fixture)).toBe(false);
    });

    it("should reject fixture with invalid turns array", () => {
      const fixture = {
        flowName: "test-flow",
        timestamp: "2025-10-25T05:45:15.754Z",
        sessionId: "test-session-123",
        phoneNumber: "+260971230001",
        serviceCode: "*2233#",
        turns: "not-an-array" as any,
      };

      expect(parser.validateFixture(fixture)).toBe(false);
    });
  });
});
