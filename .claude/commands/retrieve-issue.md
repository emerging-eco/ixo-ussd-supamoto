# Retrieve Linear Issue

> Retrieve and analyze a Linear issue to understand requirements, identify affected components, and prepare for implementation planning.

## Instructions

- Retrieve the Linear issue using the Linear API tool
- Analyze the issue description, acceptance criteria, and any attached context
- Use codebase-retrieval to identify affected components and related code
- Summarize the requirements clearly and concisely
- Identify potential technical challenges, dependencies, or ambiguities
- Ask clarifying questions if requirements are unclear
- Do NOT proceed to planning or implementation - wait for user direction

## Run

1. Retrieve the Linear issue by ID: `$ARGUMENTS`
2. Extract and analyze:
   - Issue title and description
   - Acceptance criteria
   - Labels, priority, and status
   - Any comments or additional context
   - Suggested branch name (if available)
3. Use codebase-retrieval to identify:
   - Files and components that will be affected
   - Existing patterns and conventions to follow
   - Related functionality or dependencies
   - Potential integration points

## Report

Output a structured summary with the following sections:

### Issue Summary

- **ID**: [Issue ID]
- **Title**: [Issue title]
- **Type**: [Bug/Feature/Chore based on labels]
- **Priority**: [Priority level]
- **Current Status**: [Current status]

### Requirements

- List the main requirements from the issue description
- Include acceptance criteria if specified
- Note any user stories or use cases

### Affected Components

- List files, modules, or systems that will be affected
- Explain why each component is relevant
- Identify existing patterns to follow

### Technical Considerations

- Highlight potential technical challenges
- Note dependencies on other systems or features
- Identify edge cases or error handling needs
- List any architectural decisions needed

### Clarifying Questions

- List any ambiguities or unclear requirements
- Ask specific questions that need answers before planning

### Suggested Next Steps

- Recommend which slash command to use next: `/feature`, `/chore`, or `/bug`
- Suggest the branch name from Linear (if available)

**Wait for user direction before proceeding to Phase 2 (Specification).**
