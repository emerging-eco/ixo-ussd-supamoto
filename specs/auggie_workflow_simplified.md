# Simplified Spec-Driven Workflow for Auggie

## Overview
You help me write detailed specifications for features. Those specs are then implemented by three cloud agents in parallel, and I review and merge their work.

## Your Role: Spec Author
1. **Interrogate the codebase** using local context in Zed
2. **Write the specification** (what needs to be built, how, and why)
3. **Create a spec file**: `./specs/<feature>/<version>.md` with architecture, steps, and testing plan
4. **Commit it** to the `specs` branch with a baseline commit SHA

## The Three Agents
Once specs are done, three independent cloud agents each:
- Clone the repo at the baseline commit you specified
- Create their own feature branch (`feature/agent-1-slug`, etc.)
- Implement the spec in parallel
- Open draft PRs with their work for me to review

## Your Role: Reviewer
1. Review each agent's PR against the spec
2. Check that tests pass and coverage is adequate
3. Merge approved PRs into main

## The Spec File: `./specs/<feature>/<version>.md`
- **Summary**: What problem does this solve? Why does it matter?
- **Architecture**: How does it work? What modules/interfaces?
- **Implementation Plan**: Step-by-step tasks with file paths
- **Testing**: Unit tests, integration tests, coverage targets
- **Dependencies**: Libraries, migrations, external services
- **Baseline SHA**: The commit agents should start from
- **Risks**: What could go wrong? How to roll back?

## Workflow Steps

### Step 1: Talk to Auggie (You in Zed Terminal)
```
Auggie, help me understand:
- What does X module do?
- How would we implement feature Y?
- What's the schema for Z?
```

### Step 2: Write the Spec
Using Auggie's answers, create:
- `./specs/my-feature/v1.md` (detailed plan)
- `./specs/my-feature/v1.yaml` (structured tasks)

### Step 3: Commit Specs
```bash
git checkout -b specs
git add ./specs/my-feature/
git commit -m "Spec: my-feature v1 (baseline: abc123def)"
git push -u origin specs
```

### Step 4: Agents Implement
(Automated in Ona Environments)
- Each agent reads your spec files
- Each creates `feature/agent-1-slug`, `feature/agent-2-slug`, `feature/agent-3-slug`
- They implement in parallel and open draft PRs

### Step 5: You Review
For each PR:
- Does it match the spec?
- Do tests pass?
- Is scope reasonable?

### Step 6: Merge
- Convert draft PR to ready
- Squash merge to main
- Tag with the spec ID for traceability

## Why This Works
- **Parallel work**: Three agents don't block each other
- **Clear requirements**: Spec prevents scope creep
- **Easy review**: You know exactly what was supposed to happen
- **Traceable**: Every merged change links back to a spec
- **Isolated**: Each agent works on their own branch—no conflicts mid-implementation

## Branch Structure
```
main                          ← Production (only PRs merge here)
├── specs                     ← Your spec files
├── feature/agent-1-slug      ← Agent 1's implementation
├── feature/agent-2-slug      ← Agent 2's implementation
└── feature/agent-3-slug      ← Agent 3's implementation
```

## What Auggie Needs to Help With
- Explaining how parts of the codebase work
- Suggesting architecture and design patterns
- Drafting implementation steps and acceptance criteria
- Identifying edge cases and testing scenarios
- Estimating complexity and dependencies