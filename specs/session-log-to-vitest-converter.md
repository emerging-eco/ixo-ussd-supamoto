# Feature: Session Log to Vitest Converter

## Feature Description

This feature enables developers to record interactive USSD test sessions using the existing `pnpm test:interactive` script, then automatically convert those session logs into executable Vitest test files. The converter parses session log files (which contain timestamped user inputs and server responses) and generates Vitest test suites that replay the exact same interaction flow against a running server, comparing actual responses with expected outputs from the recorded session.

This bridges the gap between manual exploratory testing and automated regression testing, allowing developers to:

1. Manually interact with the USSD server to explore and validate specific flows
2. Automatically capture the complete interaction as a session log
3. Convert the session log into a reusable Vitest test file
4. Run the generated test against the server to verify the flow still works correctly

The feature provides value by reducing the effort required to create comprehensive integration tests, ensuring that manually validated flows remain working through automated testing, and enabling rapid test creation for complex multi-step USSD interactions.

## User Story

As a **USSD developer**
I want to **convert recorded interactive test sessions into automated Vitest tests**
So that **I can quickly create regression tests from manually validated flows without writing test code by hand**

## Problem Statement

Currently, developers can manually test USSD flows using `pnpm test:interactive`, which creates session logs with complete interaction history (user inputs and server responses). However, there's no automated way to convert these valuable session logs into reusable automated tests. This means:

1. Developers must manually write Vitest tests to replicate flows they've already validated interactively
2. Session logs are only useful for debugging, not for regression testing
3. Creating comprehensive integration tests for complex multi-step flows is time-consuming
4. There's duplication of effort between manual testing and automated test creation

The existing `SessionRecorder` and `ReplayTestHelper` classes work with JSON fixtures stored in `src/test/fixtures/flows/`, but there's no bridge between the session logs in `logs/sessions/` and these test fixtures.
These two classes are not currently being used, as far as aware, and therefore can be replaced or rewritten.

## Solution Statement

Create a log parser and test generator system that:

1. **Parses session log files** from `logs/sessions/` directory, extracting:
   - Session metadata (sessionId, phoneNumber, serviceCode, timestamps)
   - User input entries (marked with "USER INPUT:" prefix)
   - Server response entries (CON/END USSD responses)
   - Conversation turns (input-response pairs)

2. **Converts parsed data** into `SessionFixture` format compatible with existing `SessionRecorder` and `ReplayTestHelper` infrastructure

3. **Generates Vitest test files** that:
   - Import necessary test helpers and utilities
   - Set up test suites with descriptive names based on flow
   - Create test cases that replay the session against a running server
   - Assert that server responses match expected outputs
   - Provide clear error messages when assertions fail

4. **Provides CLI commands** for:
   - Converting a specific session log to a test file: `pnpm generate:test <log-file> <flow-name>`
   - Running generated tests: `pnpm test:flow:<flow-name>`

The solution leverages existing infrastructure (`SessionFixture`, `ReplayTestHelper`) and follows established patterns in the codebase for test organization and execution.

## Relevant Files

### Existing Files to Modify

- **`package.json`** - Add new npm scripts for test generation and running flow-specific tests
  - `generate:test` - Script to convert session log to Vitest test file
  - `test:flow:*` - Dynamic scripts to run specific flow tests

- **`scripts/test-interactive.ts`** - Enhance to optionally prompt for flow name at session end for easier test generation
  - Add optional flow name prompt when session ends successfully
  - Display command to generate test from the session log

- **`tests/helpers/session-recorder.ts`** - May need minor updates to ensure compatibility with log-based fixtures
  - Ensure `SessionFixture` interface supports all fields from parsed logs
  - Add validation for log-sourced fixtures

- **`tests/helpers/replay-test-helper.ts`** - Enhance to support HTTP-based replay against running server
  - Add method to replay against live server via HTTP requests
  - Support both mock handler and HTTP endpoint replay modes

- **`vitest.config.ts`** - Update to include generated test files in test runs
  - Add `tests/flows/**/*.test.ts` to include patterns
  - Ensure generated tests are not excluded

### New Files

- **`scripts/generate-test-from-log.ts`** - Main CLI script to convert session logs to Vitest tests
  - Parse session log file
  - Extract conversation turns
  - Generate Vitest test file
  - Save to appropriate location

- **`src/utils/session-log-parser.ts`** - Utility to parse session log files into structured data
  - Parse log file line by line
  - Extract metadata from header
  - Identify user inputs and server responses
  - Build conversation turns array
  - Return `SessionFixture` object

- **`src/utils/vitest-generator.ts`** - Utility to generate Vitest test code from SessionFixture
  - Generate test file boilerplate
  - Create describe/it blocks
  - Generate assertions for each turn
  - Format code with proper indentation
  - Add helpful comments

- **`tests/flows/README.md`** - Documentation for generated flow tests
  - Explain how to generate tests from logs
  - Describe test file structure
  - Provide examples of running flow tests

- **`tests/utils/session-log-parser.test.ts`** - Unit tests for log parser
  - Test parsing valid log files
  - Test handling malformed logs
  - Test edge cases (empty logs, partial sessions)

- **`tests/utils/vitest-generator.test.ts`** - Unit tests for test generator
  - Test generating valid Vitest code
  - Test code formatting
  - Test handling various fixture structures

## Implementation Plan

### Phase 1: Foundation - Log Parsing Infrastructure

Build the core log parsing functionality to extract structured data from session log files. This includes:

- Creating the `SessionLogParser` class to read and parse log files
- Implementing regex patterns to identify user inputs, server responses, and metadata
- Converting parsed data into `SessionFixture` format
- Adding comprehensive error handling for malformed logs

### Phase 2: Core Implementation - Test Generation

Implement the test file generation system that converts parsed session data into executable Vitest tests:

- Creating the `VitestGenerator` class to generate test code
- Building templates for test file structure (imports, describe blocks, test cases)
- Implementing the HTTP-based replay functionality in `ReplayTestHelper`
- Creating the CLI script to orchestrate parsing and generation

### Phase 3: Integration - CLI and Workflow

Integrate the feature into the development workflow with CLI commands and documentation:

- Adding npm scripts to `package.json` for test generation and execution
- Enhancing `test-interactive.ts` to suggest test generation at session end
- Creating documentation and examples
- Adding validation and user-friendly error messages

### Phase 4: Advanced - Additionally

Support additional needs:

- Use system-generated values as Input when necessary
- Example: Notice that the value for Customer ID (CA87AF12C) was created and provided by the server during the flow. The user then copied and pasted this value to use as input.

```plaintext
[2025-10-25T05:46:38.969Z]
CON Account created successfully!
Your Customer ID: CA87AF12C
Save your Customer ID to access services.
1. Back to Account Menu

[2025-10-25T05:46:45.105Z] USER INPUT: 1
[2025-10-25T05:46:45.113Z]
CON Account Menu

Do you have an existing account?
1. Yes, log me in
2. No, create my account
0. Back

[2025-10-25T05:46:50.825Z] USER INPUT: 1
[2025-10-25T05:46:50.830Z]
CON Enter your Customer ID to log in:
0. Back

[2025-10-25T05:46:56.127Z] USER INPUT: CA87AF12C
```

## Step by Step Tasks

IMPORTANT: Execute every step in order, top to bottom.

### 1. Create Session Log Parser Utility

- Create `src/utils/session-log-parser.ts` with `SessionLogParser` class
- Implement `parseLogFile(logFilePath: string): SessionFixture` method
- Add regex patterns to extract:
  - Metadata from header (sessionId, phoneNumber, serviceCode, timestamps)
  - User input lines (pattern: `[timestamp] USER INPUT: <input>`)
  - Server response lines (pattern: `[timestamp] CON/END <response>`)
- Build conversation turns by pairing consecutive user inputs with server responses
- Handle edge cases: partial sessions, malformed logs, missing metadata
- Add TypeScript types and JSDoc comments
- Export `SessionLogParser` class and related types

### 2. Create Unit Tests for Log Parser

- Create `tests/utils/session-log-parser.test.ts`
- Create sample log file fixtures for testing
- Test parsing complete valid log files
- Test handling logs with missing metadata
- Test handling logs with malformed timestamps
- Test handling partial sessions (session ended early)
- Test extracting correct number of conversation turns
- Test error handling for non-existent files
- Verify parsed `SessionFixture` matches expected structure

### 3. Create Vitest Test Generator Utility

- Create `src/utils/vitest-generator.ts` with `VitestGenerator` class
- Implement `generateTestFile(fixture: SessionFixture, flowName: string): string` method
- Create template for test file structure:
  - Import statements (vitest, test helpers, types)
  - Describe block with flow name
  - beforeAll/afterAll hooks for server setup
  - Individual test cases for each conversation turn
  - Helper function to make HTTP requests to USSD endpoint
- Add code formatting utilities (indentation, line breaks)
- Add comments in generated code explaining the test
- Export `VitestGenerator` class

### 4. Create Unit Tests for Vitest Generator

- Create `tests/utils/vitest-generator.test.ts`
- Create sample `SessionFixture` objects for testing
- Test generating valid TypeScript/Vitest code
- Test code includes all necessary imports
- Test describe block has correct flow name
- Test each conversation turn generates a test case
- Test generated code has proper indentation
- Test generated code includes helpful comments
- Verify generated code is syntactically valid TypeScript

### 5. Enhance ReplayTestHelper for HTTP Replay

- Update `tests/helpers/replay-test-helper.ts`
- Add `replaySessionViaHTTP(fixture: SessionFixture, serverUrl: string): Promise<ReplaySession>` method
- Implement HTTP request logic using `fetch` to call USSD endpoint
- Support both CON and END response validation
- Add timeout handling for slow responses
- Add connection error handling
- Maintain existing mock-based replay functionality
- Add JSDoc comments for new method

### 6. Create CLI Script for Test Generation

- Create `scripts/generate-test-from-log.ts`
- Accept command-line arguments: `<log-file-path> <flow-name>`
- Validate arguments (file exists, flow name provided)
- Use `SessionLogParser` to parse the log file
- Use `VitestGenerator` to generate test code
- Save generated test to `tests/flows/<flow-name>.test.ts`
- Create `tests/flows/` directory if it doesn't exist
- Display success message with file path
- Display command to run the generated test
- Handle errors gracefully with helpful messages

### 7. Add NPM Scripts to package.json

- Add `generate:test` script: `NODE_OPTIONS='--loader ts-node/esm' ts-node scripts/generate-test-from-log.ts`
- Add example flow test scripts (can be customized per flow):
  - `test:flow:knowmore` - Run know more flow test
  - `test:flow:login` - Run login flow test
  - `test:flow:activation` - Run activation flow test
- Update `test` script to include flow tests if desired
- Add comments explaining the new scripts

### 8. Enhance Interactive Test Script

- Update `scripts/test-interactive.ts`
- After session ends successfully (END response), prompt user:
  - "Would you like to generate a test from this session? (y/n)"
  - If yes, prompt for flow name
  - Display the command to generate the test
- Add helper text explaining the test generation feature
- Ensure prompts don't interfere with existing functionality
- Make prompts optional (can skip with 'n' or just exit)

### 9. Create Documentation for Generated Tests

- Create `tests/flows/README.md`
- Document the test generation workflow:
  1. Run interactive test session
  2. Complete the flow you want to test
  3. Generate test from session log
  4. Run the generated test
- Provide examples of generated test structure
- Explain how to customize generated tests
- Document how to run specific flow tests
- Add troubleshooting section for common issues

### 10. Create Example Generated Test

- Manually create an example test file: `tests/flows/example-knowmore.test.ts`
- Use the "Know More" flow as the example
- Include comments explaining each section
- Show best practices for flow tests
- Demonstrate assertion patterns
- This serves as a template and documentation

### 11. Update vitest.config.ts

- Add `tests/flows/**/*.test.ts` to `include` patterns
- Ensure flow tests are not in `exclude` list
- Add comment explaining flow tests are generated from session logs
- Verify configuration allows flow tests to run with `pnpm test`

### 12. Create Integration Test for End-to-End Workflow

- Create `tests/integration/log-to-test-generation.test.ts`
- Test complete workflow:
  1. Create a sample session log file
  2. Parse it with `SessionLogParser`
  3. Generate test code with `VitestGenerator`
  4. Verify generated code structure
  5. Optionally: write generated code to temp file and import it
- Test error handling for invalid inputs
- Test file system operations (reading logs, writing tests)
- Clean up temporary files after test

### 13. Run Validation Commands

- Execute all validation commands to ensure zero regressions
- Fix any issues discovered during validation
- Ensure all new tests pass
- Verify generated tests can run successfully
- Check code formatting and linting
- Verify TypeScript compilation succeeds

## Testing Strategy

### Unit Tests

- **`session-log-parser.test.ts`**: Test log file parsing with various valid and invalid inputs
  - Valid complete logs
  - Logs with missing metadata
  - Logs with malformed timestamps
  - Partial sessions
  - Empty logs
  - Non-existent files

- **`vitest-generator.test.ts`**: Test Vitest code generation
  - Generate code from simple fixtures
  - Generate code from complex multi-turn fixtures
  - Verify code syntax validity
  - Test code formatting (indentation, spacing)
  - Test comment generation

### Integration Tests

- **`log-to-test-generation.test.ts`**: Test complete workflow from log file to generated test
  - Parse real session log
  - Generate test file
  - Verify file contents
  - Test file system operations
  - Test error handling

- **Generated flow tests**: Each generated test serves as an integration test
  - Tests actual server responses
  - Validates complete USSD flows
  - Ensures flows work end-to-end

### Edge Cases

- **Empty session logs**: Logs with no conversation turns
- **Partial sessions**: Sessions that ended with errors
- **Malformed logs**: Logs with corrupted or missing data
- **Special characters**: User inputs or responses with special characters, newlines, quotes
- **Very long sessions**: Logs with many conversation turns (50+)
- **Concurrent sessions**: Multiple session logs with same flow name
- **Server errors**: Server returns errors during replay
- **Network timeouts**: Server doesn't respond during replay
- **Invalid flow names**: Flow names with special characters or spaces

## Acceptance Criteria

1. ✅ Session log files can be parsed into `SessionFixture` objects with 100% accuracy for valid logs
2. ✅ Parsed fixtures contain correct metadata (sessionId, phoneNumber, serviceCode, timestamps)
3. ✅ Conversation turns are correctly extracted with matching user inputs and server responses
4. ✅ Generated Vitest test files are syntactically valid TypeScript
5. ✅ Generated tests can be executed with `pnpm test` or `pnpm vitest`
6. ✅ Generated tests successfully replay sessions against a running server
7. ✅ Test assertions correctly compare expected vs actual server responses
8. ✅ CLI script provides clear error messages for invalid inputs
9. ✅ CLI script displays helpful success messages with next steps
10. ✅ Documentation clearly explains the workflow and provides examples
11. ✅ All existing tests continue to pass (zero regressions)
12. ✅ New unit tests achieve >80% code coverage for new utilities
13. ✅ Interactive test script optionally prompts for test generation
14. ✅ Generated tests are saved to `tests/flows/` directory with correct naming
15. ✅ NPM scripts work correctly for test generation and execution

## Validation Commands

Execute every command to validate the feature works correctly with zero regressions.

- `pnpm install && pnpm format && pnpm lint && pnpm tsc --noEmit && pnpm build && pnpm validate:machines && pnpm test` - Run tests to validate the feature is complete with zero regressions
- `pnpm test tests/utils/session-log-parser.test.ts` - Run log parser unit tests
- `pnpm test tests/utils/vitest-generator.test.ts` - Run test generator unit tests
- `pnpm test tests/integration/log-to-test-generation.test.ts` - Run integration test for complete workflow
- `pnpm dev` (in separate terminal) - Start the server for testing generated tests
- `pnpm generate:test logs/sessions/<example-log-file> knowmore` - Test generating a test from an actual session log
- `pnpm test tests/flows/knowmore.test.ts` - Run the generated test to verify it works
- `pnpm test:coverage` - Verify code coverage meets thresholds

## Notes

### Future Enhancements

- **Interactive flow name selection**: When generating tests, show a list of common flow names to choose from
- **Batch generation**: Generate tests for all session logs in a directory at once
- **Test customization**: Allow adding custom assertions or setup/teardown logic to generated tests
- **Fixture library**: Build a library of reusable fixtures for common flows
- **Visual diff**: Show visual diff between expected and actual responses when tests fail
- **Test templates**: Support different test templates (integration, e2e, smoke tests)
- **Auto-naming**: Automatically suggest flow names based on the session content

### Technical Considerations

- **Log format stability**: Session log format must remain stable for parser to work. Document the format.
- **Server dependency**: Generated tests require a running server. Consider adding server startup to test setup.
- **Session state**: Tests assume clean session state. May need database reset between tests.
- **Timing**: Some flows may have timing dependencies. Consider adding delays if needed.
- **Authentication**: Flows requiring authentication may need special handling in generated tests.

### Dependencies

- No new external dependencies required
- Uses existing libraries: `fs`, `path`, `vitest`, `fetch`
- Leverages existing test infrastructure: `SessionRecorder`, `ReplayTestHelper`

### Compatibility

- Works with existing session log format from `scripts/test-interactive.ts`
- Compatible with existing `SessionFixture` and `ReplayTestHelper` infrastructure
- Generated tests follow existing test patterns and conventions
- No breaking changes to existing functionality
