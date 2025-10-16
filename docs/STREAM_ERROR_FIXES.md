# Stream Error Fixes - Implementation Summary

## Overview

This document describes the fixes implemented to resolve the "Cannot call write after a stream was destroyed" error that was occurring when testing the USSD endpoint through Africa's Talking's phone simulator.

## Root Cause Analysis

The error was caused by multiple issues:

1. **Multiple Response Sends**: Both try and catch blocks in the endpoint were attempting to send responses without checking if one had already been sent
2. **Missing Global Error Handler**: No centralized error handling to catch errors during response serialization
3. **Plugin Hook Errors**: Security plugin hooks could throw errors without proper error handling
4. **No Request Timeout**: Long-running requests could cause stream destruction
5. **Missing Lifecycle Logging**: Difficult to debug stream issues without proper logging

## Fixes Implemented

### Fix 1: Global Error Handler (Priority 1) ✅

**File**: `src/server.ts`

Added a global error handler using `fastify.setErrorHandler()` that:

- Catches all errors that occur during request processing
- Checks if the response has already been sent before attempting to write
- Returns USSD-formatted error responses for USSD endpoints
- Returns JSON error responses for other endpoints
- Logs all errors with context information

```typescript
fastify.setErrorHandler(async (error, request, reply) => {
  logger.error({...}, "Request error");

  if (!reply.sent) {
    if (request.url.startsWith("/api/ussd")) {
      return reply.status(500).type("text/plain")
        .send("END Service error. Please try again later.");
    }
    return reply.status(error.statusCode || 500).send({...});
  }
});
```

### Fix 2: Improved USSD Endpoint Error Handling (Priority 1) ✅

**File**: `src/routes/ussd.ts`

Modified the `/api/ussd` endpoint to:

- Remove `return` statement before `reply.send()` in try block
- Add `reply.sent` check in catch block before sending error response
- Prevent double-send attempts that destroy the stream

```typescript
// Send response without immediate return
reply.type("text/plain").send(response.formattedResponse);

// In catch block, check if already sent
if (!reply.sent) {
  reply.type("text/plain").send("END Service error...");
}
```

### Fix 3: Security Plugin Error Handling (Priority 2) ✅

**Files**: `src/plugins/security.ts`, `src/plugins/advanced-security.ts`

Wrapped `onSend` hooks in try-catch blocks to:

- Catch errors during header setting
- Log errors without crashing
- Return payload unchanged if errors occur
- Prevent stream destruction from plugin errors

```typescript
fastify.addHook("onSend", async (request, reply, payload) => {
  try {
    // Add headers...
    return payload;
  } catch (error) {
    logger.error({...}, "Error in onSend hook");
    return payload; // Return unchanged
  }
});
```

### Fix 4: Request/Response Lifecycle Logging (Priority 2) ✅

**File**: `src/server.ts`

Added lifecycle hooks for debugging:

- `onRequest` hook: Logs when requests start
- `onResponse` hook: Logs when responses complete
- Helps identify where stream destruction occurs

```typescript
fastify.addHook("onRequest", async (request) => {
  logger.debug({...}, "Request started");
});

fastify.addHook("onResponse", async (request, reply) => {
  logger.debug({...}, "Response sent");
});
```

### Fix 5: Request Timeout Configuration (Priority 3) ✅

**File**: `src/server.ts`

Added `requestTimeout` configuration to Fastify:

- Set to 30 seconds (30000ms)
- Prevents hanging requests from destroying streams
- Ensures timely cleanup of resources

```typescript
const fastify = Fastify({
  // ... other config
  requestTimeout: 30000, // 30 seconds
});
```

## Test Coverage

Created comprehensive test suite: `src/test/stream-error-fixes.test.ts`

### Test Categories

1. **Error Handling and Response Management** (4 tests)
   - Successful requests without stream errors
   - Multiple consecutive requests
   - Error response formatting
   - No double-send attempts

2. **Security Plugin Error Handling** (2 tests)
   - Security headers without stream errors
   - Graceful error handling under stress

3. **Request/Response Lifecycle** (2 tests)
   - Complete lifecycle without errors
   - Health check endpoint

4. **Request Timeout Configuration** (1 test)
   - Timeout configuration verification

5. **Integration Tests** (3 tests)
   - Multiple concurrent requests
   - Rapid sequential requests
   - Error response format validation

**Test Results**: ✅ All 12 tests passing

## Deployment Checklist

- [x] Fix 1: Global error handler implemented
- [x] Fix 2: USSD endpoint error handling improved
- [x] Fix 3: Security plugin error handling added
- [x] Fix 4: Lifecycle logging hooks added
- [x] Fix 5: Request timeout configured
- [x] Tests created and passing
- [ ] Deploy to Railway.com
- [ ] Test with Africa's Talking simulator
- [ ] Monitor logs for stream errors

## Expected Improvements

After these fixes:

1. **No More Stream Destruction Errors**: Proper error handling prevents stream destruction
2. **Better Error Recovery**: Graceful error handling with proper response formatting
3. **Improved Debugging**: Lifecycle logging helps identify issues
4. **Timeout Protection**: Request timeout prevents hanging connections
5. **Consistent Behavior**: Multiple consecutive requests work reliably

## Monitoring

After deployment, monitor:

1. **Error Logs**: Check for "Cannot call write after a stream was destroyed" errors
2. **Response Times**: Verify requests complete within timeout window
3. **Concurrent Requests**: Test with multiple simultaneous USSD sessions
4. **Error Responses**: Verify USSD-formatted error messages are returned

## References

- Fastify Error Handling: https://www.fastify.io/docs/latest/Guides/Errors/
- Stream Management: https://nodejs.org/en/docs/guides/backpressuring-in-streams/
- USSD Protocol: Standard USSD response format (CON/END)
