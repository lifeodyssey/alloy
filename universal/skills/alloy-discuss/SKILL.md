---
name: alloy-discuss
description: Use BEFORE planning for large or ambiguous features. Extracts implementation gray areas through adaptive questioning so downstream planning has decision-locked context. Use when a feature is too large for direct planning, or when the user says "let's think this through first."
---

# Alloy Discuss

## Overview

`alloy-discuss` extracts implementation decisions that downstream agents (Architect, Builder) need — so they don't have to ask the user again. It is deeper than normal planning: planning asks "what are we building and how?", discuss asks "what gray areas must be locked down first?"

**When to use this vs alloy-plan:**
- Use `alloy-plan` for everyday features where the design space is small
- Use `alloy-discuss` for large features, ambiguous requirements, or "let's think this through" requests
- Use `alloy-discuss` when prior planning surfaced too many unresolved gray areas

**Output:** `.alloy/plans/<id>/context.md` — decisions clear enough that downstream agents can act without asking the user again.

## Roles (from GSD)

- **User = Founder / Visionary.** They know what they want at the product level.
- **Claude = Builder.** Your job is to extract the specific implementation choices the vision implies.

**Don't ask the user about:**
- Codebase patterns (Explorer reads the code)
- Technical risks (you identify these)
- Implementation approach (that's for `alloy-plan`)

**Do ask the user about:**
- Vision (what success looks like)
- Gray-area implementation choices that change UX visibly
- Edge cases where the product behavior is genuinely a product decision

## The Process

### Phase 1: Load Prior Context

Before any questions:

1. Read `.alloy/projections/status.md` — what's the current state?
2. Read prior plans in `.alloy/plans/` — what has the team decided before?
3. Read project `AGENTS.md` / `CLAUDE.md` / `README.md` — what conventions exist?
4. Skim recent commits — what was just shipped?

**Skip questions already decided in prior context.** If the team has an ADR saying "we use JWT for auth," don't ask "should we use JWT or sessions?"

### Phase 2: Scout the Codebase

Run `alloy-map-codebase` (or skim manually) to find:
- Reusable patterns / abstractions
- Existing similar features (you can model after them)
- Anti-patterns to avoid (the team learned these the hard way)

This becomes the "facts" half of context.md — what already exists.

### Phase 3: Analyze the Feature — Identify Gray Areas

Read the user's request. Generate **specific gray areas**, not generic categories.

**WRONG (generic):**
- "UI questions"
- "UX questions"
- "Behavior questions"

**RIGHT (specific):**

For "Build user authentication":
- Session handling: cookie-based, JWT, or hybrid?
- Error responses: uniform "invalid credentials" (no enumeration) or specific "email not found"?
- Multi-device policy: allow N sessions, single session, or unlimited?
- Recovery flow: email link, SMS code, security questions, or chained?
- Password rules: enforce on registration, on change, or both?
- Brute force defense: rate limit per IP, per account, both, or CAPTCHA?

For "Add export to CSV":
- Streaming or buffered? (impacts memory + latency tradeoff)
- Server-generated or client-generated? (impacts large dataset behavior)
- Default filename format? (impacts user re-finding)
- Header row included? (impacts paste-into-spreadsheet UX)
- Date / number format: locale-aware or fixed? (impacts internationalization)
- Permission scope: caller's row-level access enforced? (impacts security)

Each gray area becomes a discussion item with an ID: `D-01`, `D-02`, etc.

### Phase 4: Present Gray Areas — User Selects

> "I've identified N gray areas in this feature:
> - D-01: Session handling (cookie vs JWT vs hybrid)
> - D-02: Error responses (uniform vs specific)
> - D-03: Multi-device policy
> - D-04: Recovery flow shape
> - D-05: Password rules surface
>
> Which would you like to discuss? You can pick any subset, or 'all'."

User picks (e.g., "D-01, D-04, all of recovery flow").

**Don't deep-dive areas the user said are settled or out of scope.** Trust their selection.

### Phase 5: Deep-Dive Each Selected Area

For EACH selected D-NN:

1. Restate the gray area in your own words
2. Present 2–3 concrete options with tradeoffs
3. Make a recommendation if you have one
4. Ask ONE clarifying question if the user's answer is ambiguous
5. Record the decision

**Format the decision exactly:**

```markdown
### D-01: Session handling
**Decision:** Cookie-based sessions with HttpOnly + SameSite=Strict.
**Rationale:** Team already uses cookies elsewhere (per AGENTS.md). JWT adds complexity (revocation, secret rotation) without clear benefit for this use case.
**Implications:** Need session store (Redis already provisioned per .alloy/state). Logout flow must clear cookie + invalidate session.
**Source:** User on 2026-05-25.
```

### Phase 6: Scope Creep Redirection

When user mentions something OUTSIDE the current feature ("oh and while we're at it, let's also do X"):

```
> "X is interesting but it's outside the scope of this feature. I'm capturing it 
>  in `.alloy/deferred-ideas.md` so we don't lose it. We can plan it as a 
>  separate feature after this one ships."
```

Write to `.alloy/deferred-ideas.md`:
```markdown
## Deferred from <feature>, captured 2026-05-25
- [topic] — brief description
```

**Never silently absorb scope creep.** Always redirect to deferred.

### Phase 7: Write context.md

Save decisions to `.alloy/plans/<id>/context.md`:

```markdown
# Context for <feature>

## Background
<one paragraph from prior context + codebase scout>

## Decisions Locked

### D-01: <area>
**Decision:** ...
**Rationale:** ...
**Implications:** ...

### D-02: <area>
...

## Gray Areas Skipped
- D-NN: <area> — user said "out of scope" or "defer"

## Facts From Codebase
- Existing pattern: `src/auth/Session.kt` uses cookie + Redis
- Existing convention: error responses use `ErrorResponse` shape (see `src/api/errors/`)
- Anti-pattern to avoid: don't reinvent password hashing — use existing `BCryptHasher`

## Next Step
Invoke `alloy-plan`, which now reads this context and produces the final design plus implementation tasks.
```

## Anti-Patterns

| Don't | Do |
|---|---|
| Use generic category labels ("UI", "UX", "Behavior") | Generate specific gray areas with concrete options |
| Ask about codebase facts | Run `alloy-map-codebase` or grep yourself |
| Silently absorb scope creep | Redirect to `.alloy/deferred-ideas.md` |
| Re-ask questions already decided | Read prior context first |
| Push for more areas than user wants | Trust their selection |
| Make implementation decisions for the user | Recommend, but the user picks |

## Hand-Off

After context.md is written and reviewed:

> "Context locked at `.alloy/plans/<id>/context.md`. N decisions made, M deferred. Ready for `alloy-plan` to produce the implementation plan."

## Evidence

```
alloy_evidence { kind: "discuss_done", taskId, summary: "context.md written with N decisions, M deferred" }
alloy_evidence { kind: "decision", taskId, summary: "D-01: cookie sessions chosen because Y" }
```

## Related Skills

- **alloy-map-codebase** — pre-discuss codebase scout
- **alloy-plan** — turns context into the final design and implementation tasks
- **grill-me** (vendor: Matt Pocock) — alternative for one-on-one decision pressure-testing on a single topic

## Attribution

Fuses:
- **GSD discuss-phase** — User/Builder framing, gray-area extraction, no-generic-categories rule, scope-creep redirection to deferred, D-NN decision IDs (concept, not code — GSD's command requires gsd-sdk runtime which we don't ship)
- **Alloy** — `.alloy/plans/<id>/context.md` artifact, evidence integration, hand-off to plan
