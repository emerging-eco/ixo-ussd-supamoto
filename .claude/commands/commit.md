# Commit Changes

> Create a meaningful commit with the Linear issue ID and stage all changes.

## Instructions

- Create a commit message following repository conventions
- Include the Linear issue ID in the commit message format: `[ISSUE-ID] type: description`
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
4. Extract the Linear issue ID from the context (e.g., `IXO-284`)
5. Create a concise, descriptive commit message
6. Stage all changes: `git add .`
7. Commit with message: `git commit -m "[ISSUE-ID] type: description"`

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
