import fs from "fs";
import path from "path";
export class SessionRecorder {
    turns = [];
    flowName = "";
    sessionId = "";
    phoneNumber = "";
    serviceCode = "";
    validateFixture(fixture) {
        try {
            // Check required fields
            if (!fixture.flowName || typeof fixture.flowName !== "string") {
                throw new Error("flowName is required and must be a string");
            }
            if (!fixture.timestamp || typeof fixture.timestamp !== "string") {
                throw new Error("timestamp is required and must be a string");
            }
            if (!fixture.sessionId || typeof fixture.sessionId !== "string") {
                throw new Error("sessionId is required and must be a string");
            }
            if (!fixture.phoneNumber || typeof fixture.phoneNumber !== "string") {
                throw new Error("phoneNumber is required and must be a string");
            }
            if (!fixture.serviceCode || typeof fixture.serviceCode !== "string") {
                throw new Error("serviceCode is required and must be a string");
            }
            if (!Array.isArray(fixture.turns)) {
                throw new Error("turns must be an array");
            }
            // Validate each turn
            for (const turn of fixture.turns) {
                if (typeof turn.textSent !== "string") {
                    throw new Error("turn.textSent must be a string");
                }
                if (typeof turn.serverReply !== "string") {
                    throw new Error("turn.serverReply must be a string");
                }
                if (typeof turn.sessionId !== "string") {
                    throw new Error("turn.sessionId must be a string");
                }
                if (typeof turn.timestamp !== "string") {
                    throw new Error("turn.timestamp must be a string");
                }
                // Validate timestamp format (ISO 8601)
                if (isNaN(Date.parse(turn.timestamp))) {
                    throw new Error("turn.timestamp must be a valid ISO 8601 date string");
                }
            }
            // Validate main timestamp format
            if (isNaN(Date.parse(fixture.timestamp))) {
                throw new Error("timestamp must be a valid ISO 8601 date string");
            }
            return true;
        }
        catch (error) {
            console.error("❌ Fixture validation failed:", error instanceof Error ? error.message : String(error));
            return false;
        }
    }
    constructor(sessionId, phoneNumber, serviceCode) {
        this.sessionId = sessionId;
        this.phoneNumber = phoneNumber;
        this.serviceCode = serviceCode;
    }
    startRecording(flowName) {
        this.flowName = flowName.trim();
        this.turns = [];
        console.log(`\nStarting recording for flow: ${this.flowName}`);
        console.log("🔴 Recording started...\n");
    }
    recordTurn(textSent, serverReply) {
        const turn = {
            textSent,
            serverReply,
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
        };
        this.turns.push(turn);
    }
    saveSession() {
        if (!this.flowName) {
            console.warn("⚠️ No flow name set, cannot save session");
            return;
        }
        try {
            // Ensure fixtures directory exists
            const fixturesDir = path.join(process.cwd(), "src", "test", "fixtures", "flows");
            if (!fs.existsSync(fixturesDir)) {
                fs.mkdirSync(fixturesDir, { recursive: true });
            }
            // Generate timestamp in YYYYMMDDTHHMM format
            const now = new Date();
            const timestamp = now.toISOString().slice(0, 16).replace(/[-:]/g, "");
            // Create filename
            const filename = `${timestamp}-${this.flowName}.json`;
            const filepath = path.join(fixturesDir, filename);
            // Create fixture object
            const fixture = {
                flowName: this.flowName,
                timestamp: now.toISOString(),
                sessionId: this.sessionId,
                phoneNumber: this.phoneNumber,
                serviceCode: this.serviceCode,
                turns: this.turns,
            };
            // Validate fixture before saving
            if (!this.validateFixture(fixture)) {
                throw new Error("Fixture validation failed");
            }
            // Write to file
            fs.writeFileSync(filepath, JSON.stringify(fixture, null, 2));
            console.log(`\n🛑 Recording stopped`);
            console.log(`✅ Session recorded successfully!`);
            console.log(`📁 Saved to: ${filepath}`);
            console.log(`📊 Recorded ${this.turns.length} conversation turns`);
        }
        catch (error) {
            console.error("\n❌ Error saving session fixture:", error);
            this.savePartialSession(error);
        }
    }
    savePartialSession(error) {
        try {
            const fixturesDir = path.join(process.cwd(), "src", "test", "fixtures", "flows");
            if (!fs.existsSync(fixturesDir)) {
                fs.mkdirSync(fixturesDir, { recursive: true });
            }
            const now = new Date();
            const timestamp = now.toISOString().slice(0, 16).replace(/[-:]/g, "");
            const filename = `${timestamp}-${this.flowName || "partial"}-ERROR.json`;
            const filepath = path.join(fixturesDir, filename);
            const partialFixture = {
                flowName: this.flowName || "partial",
                timestamp: now.toISOString(),
                sessionId: this.sessionId,
                phoneNumber: this.phoneNumber,
                serviceCode: this.serviceCode,
                turns: this.turns,
                error: error instanceof Error ? error.message : String(error),
                partial: true,
            };
            fs.writeFileSync(filepath, JSON.stringify(partialFixture, null, 2));
            console.log(`🔶 Partial session saved to: ${filepath}`);
        }
        catch (saveError) {
            console.error("❌ Failed to save even partial session:", saveError);
        }
    }
    getTurnCount() {
        return this.turns.length;
    }
    getFlowName() {
        return this.flowName;
    }
    hasRecordedTurns() {
        return this.turns.length > 0;
    }
}
//# sourceMappingURL=session-recorder.js.map
