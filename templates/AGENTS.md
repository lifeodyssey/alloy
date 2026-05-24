# AGENTS.md — OpenCode Alloy Project Instructions

> Install an Alloy pack into this repo with `bash setup.sh --pack <pack> --target local`, then adapt this file for repo-specific conventions. `--profile` remains as a deprecated alias.

## Project Context

- **Name**: [project name]
- **Stack**: [e.g., Next.js 16 + Kotlin/Spring Boot + Postgres + AWS]
- **Repo**: [repo URL]

## Conventions

- **Branching**: Trunk-based. Feature branches squash to 1 commit.
- **Testing**: TDD mandatory with the `alloy-tdd` skill. RED -> GREEN -> REFACTOR.
- **Code size**: Functions ≤10 lines, Components ≤100 lines, Files ≤300 lines.
- **Workflow**: Use `.alloy/` tasks, claims, evidence, and gates for bounded changes. Use GSD planning state only when this repo installed the legacy `workflow-gsd` pack.
- **External systems**: Use `gh`, `az devops`, and `psql` for GitHub, Azure DevOps, and Postgres workflows.

## Architecture

- **Frontend**: [e.g., app/ directory, App Router, Server Components]
- **Backend**: [e.g., src/main/kotlin, layered: controller → service → repository]
- **Database**: [e.g., Postgres + Flyway migrations in db/migration/]
- **Infra**: [e.g., Terraform in infra/, Terragrunt for env separation]

## Existing Abstractions (DO NOT reinvent)

- [e.g., HTTP client: src/lib/api-client.ts]
- [e.g., Auth: src/middleware/auth.kt]
- [e.g., DB connection: src/config/database.kt]

## Do NOT Touch

- [e.g., legacy/ directory — scheduled for removal]
- [e.g., .env files — never commit]

## Testing Commands

```bash
# Frontend
npm run test          # vitest
npm run test:e2e      # playwright

# Backend
./gradlew test        # unit tests
./gradlew integrationTest

# Infra
terraform plan
```
