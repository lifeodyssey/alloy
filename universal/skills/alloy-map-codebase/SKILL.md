---
name: alloy-map-codebase
description: Use when starting work on an unfamiliar codebase or before planning a non-trivial feature. Produces durable architecture/modules/boundaries maps that downstream agents reference instead of re-reading the whole codebase every time.
---

# Alloy Map Codebase

## Overview

Most agent failures in unfamiliar codebases come from one of two extremes:
- **Reading too little** — making changes that violate hidden conventions
- **Reading too much** — burning context on files the current task doesn't touch

`alloy-map-codebase` finds the middle: it produces three durable artifacts that summarize the codebase at the right level for planning + execution, then downstream skills (alloy-plan, alloy-execute) read those artifacts instead of re-scanning the whole repo.

**When to use:**
- First time working in this repo
- Existing repo where context.md / findings.md doesn't yet describe the architecture
- Before a non-trivial feature plan (any task touching 3+ unrelated files)
- After a major refactor (re-run to refresh maps)
- Before debugging a bug that touches a module you don't recognize

**When NOT to use:**
- Single-file edits / typo fixes
- Pure documentation changes
- Maps already exist and are < 1 month old (re-read them instead)

## Output Artifacts

Three files in `.alloy/codebase/`:

```
.alloy/codebase/
├── architecture.md   ← system shape: layers, technology choices, key flows
├── modules.md        ← per-module summaries: what it does, what it depends on
└── boundaries.md     ← contracts between modules: interfaces, invariants, "don't cross this line"
```

These files are durable — they survive `/clear`, they're commit-able, and downstream skills read selectively (e.g., alloy-plan reads `boundaries.md` to know what NOT to change).

## The Process

### Phase 1: Initial Scout (5 minutes max)

Don't read everything. Get the shape:

1. `ls` at repo root — top-level layout
2. Read: `README.md`, `AGENTS.md`, `CLAUDE.md`, `package.json` / `pom.xml` / `build.gradle` / `Cargo.toml`
3. Skim: `docs/` if exists, `.github/workflows/` for CI hints
4. `git log --oneline -30` — what's been actively worked on
5. Identify: build system, language(s), framework(s), test setup

**Output of Phase 1:** mental model of "what kind of repo is this?"

### Phase 2: Identify Top-Level Modules

Find the unit of organization. Common patterns:
- Monolith: by feature folders (`src/auth`, `src/users`, `src/billing`)
- Layered: by technical layer (`controllers/`, `services/`, `repositories/`)
- Monorepo: by package (`packages/api`, `packages/web`, `packages/shared`)
- DDD: by bounded context (`contexts/order-management/`)

Pick the unit. List them. For each, read ONLY:
- The top-level entry file (`index.ts`, `Application.kt`, `main.go`, `lib.rs`)
- One representative leaf (the most-recently-modified file inside)
- README if the module has its own

**DO NOT** read every file. The goal is "what does this module do at the contract level?"

### Phase 3: Trace 1–2 Key Flows

Pick the most important user-facing flow (login, place order, generate report).

Trace it from entry point → output:
- Where does the HTTP/CLI/event enter?
- What modules does it touch in order?
- Where is state persisted?
- Where does the response go?

Don't enumerate every branch. Find the happy path.

This becomes the "key flow" diagram in `architecture.md`.

### Phase 4: Find Boundaries

For each module, identify:
- **Public interface** — exported types, functions, REST endpoints, events emitted
- **Private internals** — what is NOT exposed (and therefore safe to refactor freely)
- **Invariants** — what MUST be true after any operation completes
- **Hard rules** — patterns the team decided NEVER to violate (often in AGENTS.md or PR review history)

This becomes `boundaries.md` — the most important file for downstream agents because it tells them "you can change X, but DON'T change Y."

### Phase 5: Write the Three Files

**architecture.md:**
```markdown
# Architecture: <repo name>

## Shape
- Language(s): TypeScript + Kotlin
- Frontend: Next.js 15 App Router on Vercel-style hosting
- Backend: Spring Boot 3 + Kotlin + PostgreSQL + Redis
- Infra: Terraform → AWS ECS Fargate

## Layers
- `apps/web` — Next.js frontend
- `apps/api` — Spring Boot REST API
- `apps/worker` — Background job processor (Spring Boot, no HTTP)
- `packages/db` — Shared DB schema (Flyway migrations)
- `infra/` — Terraform for AWS

## Key Flow: User Login
1. POST /auth/login → `apps/web` proxies to API
2. `AuthController.login()` validates credentials via `UserService`
3. `UserService` calls `UserRepository` (JPA + jOOQ hybrid)
4. On success, creates session in Redis via `SessionStore`
5. Sets HttpOnly cookie via response
6. Frontend redirects to `/dashboard`

## Technology Choices (with rationale if known)
- Spring Boot 3 (not 4): team migration in Q4 2026
- jOOQ + JPA hybrid: JPA for entities, jOOQ for reports
- Redis: sessions + rate limit + cache (one cluster)
```

**modules.md:**
```markdown
# Modules

## apps/api/src/main/kotlin/com/team/auth
**Purpose:** Authentication + authorization
**Entry:** `AuthController.kt` (REST endpoints)
**Depends on:** `users/UserService`, `infrastructure/SessionStore`
**Tests:** `apps/api/src/test/kotlin/com/team/auth/` (95% coverage, see `AuthServiceTest.kt`)
**Owner:** Backend team (last 5 commits all from @alice, @bob)
**Notes:** Don't reimplement password hashing — use `BCryptHasher` from `infrastructure/crypto`

## apps/api/src/main/kotlin/com/team/users
**Purpose:** User CRUD + profile management
**Entry:** `UserService.kt`
**Depends on:** `infrastructure/db` (JPA), no external services
**Tests:** Solid unit coverage; integration via `@DataJpaTest`
**Notes:** Email column has unique index; case-insensitive comparison via `LOWER()`

## packages/db
**Purpose:** Database schema + migrations
**Entry:** Flyway migrations in `src/main/resources/db/migration/`
**Convention:** `V<N>__<description>.sql`, never re-numbered
**Notes:** Run via `./gradlew flywayMigrate`; staging auto-migrates on deploy
```

**boundaries.md:**
```markdown
# Boundaries

## auth → users
**Direction:** auth depends on users (one-way)
**Contract:** `UserService.findByEmail(email): User?`, never expose Repository or JPA entities outside the module
**Invariant:** auth NEVER writes to users table directly

## users → infrastructure/db
**Contract:** Use `UserRepository` (Spring Data JPA interface)
**Don't:** Use `EntityManager` directly outside `UserRepository`
**Why:** Centralized query logging + transaction boundary

## All modules → infrastructure/crypto
**Contract:** Use `BCryptHasher.hash()` and `verify()` for ALL password operations
**Don't:** Add another hashing library; don't roll your own
**Why:** Single source of truth for password security; auditable

## frontend → API
**Contract:** TypeScript client generated from OpenAPI spec at `packages/db/openapi.yaml`
**Don't:** Hand-write `fetch()` calls; regenerate after API changes
**Workflow:** Backend updates `openapi.yaml`, frontend runs `pnpm gen:api`, types appear in `packages/api-client`

## Hard Rules (NEVER violate without architecture discussion)
- NEVER add a new database directly. We have ONE PostgreSQL. Use it.
- NEVER call AWS SDK from `apps/api`. Use `infrastructure/aws` wrapper.
- NEVER reach across modules via deep imports (`com.team.auth.internal.X`).
```

### Phase 6: Hand Off

> "Codebase maps written to `.alloy/codebase/{architecture,modules,boundaries}.md`. These survive `/clear` and downstream skills will reference them. Ready for `alloy-plan` / `alloy-debug` to use this context selectively."

## Anti-Patterns

| Don't | Do |
|---|---|
| Read every file before mapping | Read entry + one leaf per module |
| Trace every flow | Trace 1–2 key user-facing flows |
| Document internals | Document boundaries (the things that matter to others) |
| Write opinions / recommendations | Write facts (this is reference material) |
| Re-read modules each task | Read the map once, reference it per task |
| Map maps that are < 1 month old | Read the existing maps — only re-run if stale |

## Maintenance

Re-run `alloy-map-codebase` when:
- New module added (update modules.md)
- Module renamed / split / merged (update all three)
- Architecture decision (new tech, removed tech, layer change — update architecture.md)
- Boundary changes (update boundaries.md)

Stale maps are dangerous because downstream agents trust them. If you can't update accurately, **delete the map** rather than leave stale info.

## Evidence

```
alloy_evidence { kind: "codebase_mapped", taskId, summary: "3 maps written: N modules, M boundaries, K key flows" }
```

## Related Skills

- **alloy-discuss** — calls this before generating gray areas
- **alloy-plan** — reads `boundaries.md` for "don't change X" constraints
- **alloy-debug** — reads `modules.md` when debug surfaces in unfamiliar module
- **zoom-out** (vendor: Matt Pocock) — for in-the-moment "I'm lost, give me higher context" during an active task

## Attribution

Fuses:
- **GSD codebase-mapper / brownfield onboarding** — three-artifact pattern (architecture / modules / boundaries), context-budget discipline (concept, not code)
- **Alloy** — `.alloy/codebase/` location, integration with downstream skills, evidence
