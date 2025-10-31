# Finalise Implementation

> Update Linear issue status, add implementation summary comment, create project update (triggers Slack), and update changelog.

## Instructions

- Ask user what status to set for the Linear issue (e.g., "Done", "In Review", "Completed")
- Update the Linear issue status via Linear API
- Add a comment to the Linear issue summarizing the implementation
- **Create a Linear project update to trigger Slack notifications**
- Create or update changelog entry with the changes made
- Include Linear issue ID references in all documentation
- Do NOT proceed without user confirmation on the status to set

## Linear API Integration Notes

### Project Update Creation (Critical for Slack Integration)

The Slack integration only triggers on **project updates**, not issue status changes. You MUST create a project update after updating the issue status.

**GraphQL Mutation:**

```graphql
mutation ProjectUpdateCreate($input: ProjectUpdateCreateInput!) {
  projectUpdateCreate(input: $input) {
    success
    projectUpdate {
      id
      body
      health
      project {
        id
        name
      }
    }
  }
}
```

**Input Parameters:**

- `projectId`: Retrieved from the issue's project association
- `body`: Use the implementation summary (same as the comment)
- `health`: "onTrack" (default), "atRisk", or "offTrack"

**Error Handling:**

- If the issue is not associated with a project, skip project update creation
- Log this in the report and explain that Slack notification will not be triggered
- Suggest to the user to manually associate the issue with a project if notifications are needed

## Run

1. Ask user: "What status should I set for the Linear issue?"
2. Wait for user response with the desired status
3. Extract the Linear issue ID from context (e.g., `IXO-284`)
4. Retrieve current issue details from Linear API
5. Update the Linear issue status to the user-specified status
6. Generate implementation summary from:
   - Commit messages
   - Files changed (`git diff --stat`)
   - Key functionality added/modified
7. Add a comment to the Linear issue with the implementation summary
8. **Create a Linear project update (status report):**
   - Retrieve the project ID associated with the issue
   - Use Linear API `projectUpdateCreate` mutation to create a project update
   - Include the implementation summary as the update body
   - Optionally, generate and add to the implementation summary an image using Gemini Nano Banana that describes the project update in a fun way
   - Set health status to "onTrack" (default) or user-specified
   - **This triggers the Slack integration notification**
   - If the issue is not associated with a project, skip this step and note it in the report
9. Check if `CHANGELOG.md` exists in the repository
10. If changelog exists, add an entry with:

- Date
- Linear issue ID reference
- Type of change (Added/Fixed/Changed/Removed)
- Brief description of changes

11. If changelog doesn't exist, ask user if they want to create one

## Report

Output the following:

### Linear Issue Updated

- **Issue ID**: [Issue ID]
- **Previous Status**: [Old status]
- **New Status**: [User-specified status]
- **Comment Added**: [Summary of implementation]

### Linear Project Update Created

- **Project ID**: [Project ID or "N/A - Issue not associated with a project"]
- **Project Name**: [Project name or "N/A"]
- **Update Created**: [Yes/No]
- **Health Status**: [onTrack/atRisk/offTrack or "N/A"]
- **Slack Notification**: [Triggered/Not triggered - explain why]

### Implementation Summary

- List key changes made
- Reference files modified
- Note any new functionality added
- Mention tests added/updated

### Changelog Updated

- **Entry Added**: [Changelog entry text]
- **Location**: [Path to changelog file]

### Completion Checklist

- ✅ Linear issue status updated
- ✅ Implementation comment added to Linear
- ✅ Linear project update created (triggers Slack notification)
- ✅ Changelog updated with Linear issue reference
- ✅ All changes committed (reference commit hash)

### Final Notes

- Confirm that all Phase 6 tasks are complete
- Remind user to push changes if not already done
- Suggest creating a Pull Request if applicable

**Implementation workflow complete. Issue [ISSUE-ID] has been finalized.**
