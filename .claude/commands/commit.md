# Commit Changes

> Create a meaningful commit with the Linear issue ID and stage all changes.

## Instructions

- Create a commit message following repository conventions
- Include the Linear issue ID, if it is available, in the commit message format: `type: [ISSUE-ID] description`
- Use conventional commit types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`, `style`, `perf`, `ci`, `build`
- Stage all changes with `git add`
- Execute `git commit` with the generated message
- Do NOT push without explicit user permission

## Run

1. Check current git status: `git status`
2. Review changes to be committed: `git diff --stat`
3. Determine the appropriate commit type based on the changes:
   - `feat` - New feature
   - `fix` - Bug fix
   - `chore` - Maintenance, refactoring, or non-functional changes
   - `test` - Adding or updating tests
   - `docs` - Documentation changes
   - `refactor` - Code refactoring without changing functionality
4. **Extract the Linear issue ID using this fallback strategy:**
   a. **First, try conversation context**: Check if Linear Issue ID is available from `/retrieve-issue` or `/implement` commands in the current conversation (e.g., `IXO-284`)
   b. **If not in context, search spec files**:
      - Get current branch name: `git branch --show-current`
      - Search for matching spec file in `specs/` directory based on branch name pattern
      - Example: branch `chore/update-deps` → look for `specs/chore-update-deps.md` or `specs/*update-deps*.md`
      - Extract Linear Issue ID from the spec file's "Linear Issue" section
   c. **If still not found, ask user**: Prompt user to provide the Linear Issue ID manually
   d. **Validation**: Ensure the Issue ID follows the pattern (e.g., `IXO-123`, `PROJ-456`)
5. Create a concise, descriptive commit message. If you can accurately express the change in just the subject line, don't include anything in the message body. Only use the body when it is providing *useful* information.
6. Don't repeat information from the subject line in the message body.
7. Stage all changes: `git add .`
8. Commit with message: `git commit -m "type: [ISSUE-ID] description"`
9. Follow good Git style:
- Separate the subject from the body with a blank line
- Try to limit the subject line to 50 characters
- Capitalize the subject line
- Do not end the subject line with any punctuation
- Use the imperative mood in the subject line
- Wrap the body at 72 characters
- Keep the body short and concise (omit it entirely if not useful)

## Report

Output the following:

### Commit Details

- **Linear Issue ID**: [Issue ID]
- **Commit Type**: [feat/fix/chore/etc.]
- **Commit Message**: [Full commit message]
- **Files Changed**: [Output of `git diff --stat`]
- **Branch**: [Current branch name]

### Git Status

- Show the result of `git log -1` to confirm the commit
- Show current branch status with `git status`

### Next Steps

- Remind user that changes are committed but NOT pushed
- Ask if user wants to push to remote
- Mention that `/finalise` command can be used to update Linear and documentation

**Wait for explicit user permission before pushing to remote.**
