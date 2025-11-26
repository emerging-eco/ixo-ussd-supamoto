/**
 * Test for nested child message retrieval fix
 * 
 * This test verifies that the USSD response service correctly retrieves
 * messages from deeply nested child machines (grandchildren).
 * 
 * Bug: When a parent machine invokes a child machine that itself invokes
 * another child machine (grandchild), the message from the grandchild
 * was not being displayed. Instead, the parent or first-level child's
 * message was shown.
 * 
 * Fix: Made getMessageFromSnapshot and getActiveStateValue recursive
 * to traverse the entire child hierarchy.
 */

import { describe, it, expect } from "vitest";
import { ussdResponseService } from "../../src/services/ussd-response.js";

describe("Nested Child Message Retrieval", () => {
  it("should retrieve message from grandchild machine (depth 2)", () => {
    // Simulate a snapshot with nested children:
    // Parent -> Child -> Grandchild
    const mockSnapshot = {
      value: "parentState",
      context: {
        message: "Parent message (should not be used)",
      },
      children: {
        childActor: {
          getSnapshot: () => ({
            value: "childState",
            context: {
              message: "Child message (should not be used)",
            },
            children: {
              grandchildActor: {
                getSnapshot: () => ({
                  value: "grandchildState",
                  context: {
                    message: "Grandchild message (should be used)",
                  },
                  children: {},
                }),
              },
            },
          }),
        },
      },
    };

    const response = ussdResponseService.generateResponse(mockSnapshot);
    
    expect(response.message).toContain("Grandchild message (should be used)");
  });

  it("should retrieve message from child when no grandchild exists", () => {
    // Simulate a snapshot with only one level of children
    const mockSnapshot = {
      value: "parentState",
      context: {
        message: "Parent message (should not be used)",
      },
      children: {
        childActor: {
          getSnapshot: () => ({
            value: "childState",
            context: {
              message: "Child message (should be used)",
            },
            children: {},
          }),
        },
      },
    };

    const response = ussdResponseService.generateResponse(mockSnapshot);
    
    expect(response.message).toContain("Child message (should be used)");
  });

  it("should fallback to parent message when no children exist", () => {
    // Simulate a snapshot with no children
    const mockSnapshot = {
      value: "parentState",
      context: {
        message: "Parent message (should be used)",
      },
      children: {},
    };

    const response = ussdResponseService.generateResponse(mockSnapshot);
    
    expect(response.message).toContain("Parent message (should be used)");
  });

  it("should handle deeply nested children (depth 3+)", () => {
    // Simulate a snapshot with 3 levels of nesting
    const mockSnapshot = {
      value: "parentState",
      context: {
        message: "Parent message",
      },
      children: {
        childActor: {
          getSnapshot: () => ({
            value: "childState",
            context: {
              message: "Child message",
            },
            children: {
              grandchildActor: {
                getSnapshot: () => ({
                  value: "grandchildState",
                  context: {
                    message: "Grandchild message",
                  },
                  children: {
                    greatGrandchildActor: {
                      getSnapshot: () => ({
                        value: "greatGrandchildState",
                        context: {
                          message: "Great-grandchild message (should be used)",
                        },
                        children: {},
                      }),
                    },
                  },
                }),
              },
            },
          }),
        },
      },
    };

    const response = ussdResponseService.generateResponse(mockSnapshot);
    
    expect(response.message).toContain("Great-grandchild message (should be used)");
  });
});
