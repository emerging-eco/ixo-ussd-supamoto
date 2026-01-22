# Fix Code Review Comment

Address the code review feedback by making surgical, minimal fixes to the codebase. Follow the `Instructions` carefully to resolve the reviewer's concern.

## Instructions

- You're fixing code based on a code review comment - be surgical and precise.
- IMPORTANT: Understand the reviewer's concern fully before making any changes.
- Research the codebase to understand the context of the code being reviewed.
- Use your reasoning model: THINK HARD about the root cause and ensure your fix addresses the actual issue, not just the symptom.
- IMPORTANT: Be minimal with changes - only fix what's necessary to address the review comment.
- Check for related code locations that may need consistent changes (the reviewer may have only pointed out one instance).
- If the fix touches tests, make sure they still pass and update them if needed.
- Don't introduce new patterns or abstractions - follow existing conventions.
- If the reviewer's suggestion would require significant refactoring, explain the tradeoffs before proceeding.

## Steps

1. **Parse the Review Comment**: Extract the file location(s), line number(s), and the specific concern raised.
2. **Locate All Related Code**: Find the mentioned code and any related locations that may have the same issue.
3. **Understand Root Cause**: Determine why the issue exists and what the correct behavior should be.
4. **Implement Fix**: Make the minimal changes needed to address the concern consistently.
5. **Validate**: Run the validation commands to ensure no regressions.

## Relevant Files

Focus on the following files:

- Files explicitly mentioned in the code review comment.
- `src/**` - Contains the codebase logic.
- `tests/**` - Contains the codebase test cases.
- Related files that share the same pattern or logic being reviewed.

Ignore unrelated files in the codebase.

## Validation Commands

Execute every command to validate the fix is correct with zero regressions.

- `pnpm install && pnpm format && pnpm lint && pnpm tsc --noEmit && pnpm build && pnpm test` - Run all checks to validate the fix is complete with zero regressions.

## Code Review Comment

$ARGUMENTS

