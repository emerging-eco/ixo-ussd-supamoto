# Implement the following plan

Follow the `Instructions` to implement the `Plan`, then `Run` the commands and, finally, `Report` the completed work.

## Instructions

- Read the plan, think hard about the plan and implement the plan.
- **Extract Linear Issue ID from the plan** (if available in "Linear Issue" section)
  - Store the Linear Issue ID in context for use with `/commit` command
  - If the plan includes a Linear Issue section, note the Issue ID (e.g., IXO-284)
  - This ensures the commit message will include the correct Linear Issue reference
- **Create branch**:

  ### Create Branch
  ```bash
  # Create a new branch from dev
  git checkout dev
  git pull origin dev
  git checkout -b <branch-type>/<descriptive-name>
  ```

  **Branch Types:**
  - `feature/` - New features
  - `chore/` - Maintenance, refactoring, dependencies
  - `fix/` - Bug fixes

- **Before implementing**, verify you're on the correct branch:
  ```bash
  git branch --show-current
  ```

- **After implementing**, commit changes but DO NOT push without permission

## Plan

$ARGUMENTS

## Run

Execute the following validation commands sequentially to ensure code quality and build success. If any command fails, diagnose and fix the issues before proceeding to the next command: 1. **Install dependencies**: `pnpm install` 2. **Format code**: `pnpm format` 3. **Lint code**: `pnpm lint` 4. **Type check**: `pnpm tsc --noEmit` 5. **Build project**: `pnpm build`
For each command:

- Run the command and wait for completion
- If it fails, analyze the error output
- Fix any issues (e.g., formatting errors, linting violations, type errors, build failures)
- Re-run the failed command to verify the fix
- Only proceed to the next command after the current one succeeds

## Report

- Summarize the work you've just done in a concise bullet point list.
- Report the files and total lines changed with `git diff --stat`
