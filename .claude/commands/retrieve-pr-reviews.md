# Retrieve PR Review Comments

> Retrieve and analyze all review comments from a GitHub Pull Request to prepare for addressing reviewer feedback.

## Instructions

- Retrieve all review comments from the specified PR using the GitHub CLI (`gh`)
- Parse and organize the comments by file and line number
- Identify which comments require code changes vs. which are informational/resolved
- Summarize each actionable comment clearly
- Do NOT proceed to fixing - wait for user direction on which comments to address

## Prerequisites

- GitHub CLI (`gh`) must be installed and authenticated
- You must be in a git repository with a GitHub remote

## Run

1. Retrieve the PR review comments for PR: `$ARGUMENTS`
2. Execute the following commands to gather review data:
   ```bash
   # Get PR details and review comments
   gh pr view $ARGUMENTS --json number,title,state,reviewDecision,reviews,comments
   
   # Get inline review comments (code-specific feedback)
   gh api repos/:owner/:repo/pulls/$ARGUMENTS/comments
   ```
3. Parse and categorize the comments:
   - **Actionable**: Comments requesting code changes
   - **Questions**: Comments asking for clarification
   - **Resolved**: Comments already addressed or approved
   - **Informational**: General observations or suggestions

## Report

Output a structured summary with the following sections:

### PR Summary

- **PR Number**: [PR number]
- **Title**: [PR title]
- **State**: [open/closed/merged]
- **Review Decision**: [approved/changes_requested/review_required]

### Actionable Comments

For each comment requiring code changes:

#### Comment #[N]

- **File**: `[file path]`
- **Line(s)**: [line number or range]
- **Reviewer**: [reviewer username]
- **Status**: [pending/resolved]
- **Concern**: [summarize the reviewer's concern in one sentence]
- **Suggested Fix**: [brief description of what needs to change]

```
[Quote the relevant part of the review comment]
```

### Questions Requiring Response

List any comments that are questions needing clarification before code changes.

### Already Resolved

List comments that have been marked as resolved or are no longer applicable.

### Summary Statistics

- **Total Comments**: [count]
- **Actionable**: [count]
- **Questions**: [count]
- **Resolved**: [count]

### Suggested Next Steps

For each actionable comment, provide a ready-to-use command:

```
/fix-code-review [file]:[line] - [brief description of the concern]
```

**Wait for user direction before proceeding to fix any comments.**

