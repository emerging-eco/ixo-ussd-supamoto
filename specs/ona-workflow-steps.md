# Ona cloud agents
ona.com a.k.a. gitpod.io enables secure, contained developer environments for Ona cloud agents. This allows developers to work on Ona cloud agents in a safe and controlled environment, without having to worry about security or compatibility issues.

# Workflow steps
Each commissioned cloud agent will be promted to perform the following slash commands in order of completion:
1. Developer ensures that cloud agent points to `specs` branch.
2. /implement "./specs/[LINEAR-ID]-specification-name"
2. Developer reviews the cloud agent's actions and outputs using the Ona web UI.
3. /commit
4. Developer instructs agent to "Push the commit and create a PR. Ensure that the `specs` branch is the base branch."
5. /retrieve-pr-reviews
6. /fix-code-review
7. /finalise
8. Developer merges PR and deletes branch.
8. Developer stops and deletes the cloud agent.
