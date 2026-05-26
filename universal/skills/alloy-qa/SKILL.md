---
name: alloy-qa
description: Use to systematically QA test a web application and fix bugs found. Runs QA testing, then iteratively fixes bugs in source code, committing each fix atomically and re-verifying. Three tiers (Quick / Standard / Exhaustive). Produces before/after health scores and ship-readiness summary. For report-only mode, omit the fix phase.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Task
---

# Alloy QA

## Overview

`/alloy-qa <url> [--tier quick|standard|exhaustive] [--regression baseline.json] [--diff-aware] [--report-only]`

QA the app, find bugs, fix them, verify, report. Health score before vs after.

**Announce:** "Using `alloy-qa` for [tier] QA on [url]"

## Setup Parameters

| Param | Default | Notes |
|---|---|---|
| `<url>` | (required for visit modes) | Target URL — local dev or staging |
| `--tier` | `standard` | `quick` (smoke), `standard` (+ medium), `exhaustive` (+ low / cosmetic) |
| `--regression <baseline.json>` | none | Compare against saved baseline |
| `--diff-aware` | auto on feature branch | Only test routes affected by `git diff main...HEAD` |
| `--report-only` | false | Skip Phase 8 fix loop; just QA + report |
| `--scope <area>` | full app | Constrain to a feature area |
| `--auth <creds-file>` | none | Path to cookies / token for auth-required testing |

### `--report-only` Contract

`--report-only` is not "lighter QA." It is the same discovery, scoring, evidence, and report workflow with all source mutation disabled.

When `--report-only` is set:

- Run Phases 1-7 exactly as usual.
- Skip Phase 8 entirely: no source reads for fixes, no edits, no commits, no regression-test authoring.
- Still run Phase 9 final QA as a second pass to confirm findings are stable and not one-off browser noise.
- Mark every fixable issue as `open` instead of `fixed`, `verified`, or `best-effort`.
- Write `.alloy/qa-reports/<ts>/report.md` and `.alloy/TODOS.md` entries for follow-up work.
- Emit evidence with `kind: "qa_report_only"` so downstream agents do not mistake the report for a completed fix run.

Use `--report-only` for release audits, third-party apps, design reviews, or any dirty worktree where the user has not approved code changes.

## Pre-Flight: Clean Working Tree

Before any testing:

```bash
git status --porcelain
```

If output non-empty, present 3 options:
1. **Commit current changes** (`git add -A && git commit -m "wip: pre-qa snapshot"`)
2. **Stash** (`git stash push -m "pre-qa stash"`)
3. **Abort** (let the user clean up manually)

**Why:** atomic per-bug commits in Phase 8 require a clean starting state.

## Browser

Use `playwright-cli` skill (vendor) for browser automation. Browser command cheatsheet:

| Action | Playwright | Notes |
|---|---|---|
| `goto <url>` | `playwright goto <url>` | Visit page |
| `snapshot` | `playwright screenshot --full-page` | Visual capture |
| `links` | `playwright eval 'document.querySelectorAll("a").length'` + scrape | Find nav |
| `console --errors` | `playwright eval` + console listener | Capture console errors |
| `click <selector>` | `playwright click "button:has-text('Submit')"` | Use semantic selectors, not numeric indices |
| `fill <field> <value>` | `playwright fill "input[name=email]" "test@example.com"` | |
| `viewport <wxh>` | `playwright resize 375x667` | Responsive testing |

**If playwright not installed:** `npx playwright install chromium` (one-shot). Skip QA on machines without Node if not available.

### Portable Playwright Command Table

Use the local `playwright-cli` skill or equivalent shell commands. Do not rely on gstack `$B` syntax.

| Need | Preferred command shape | Evidence to save |
|---|---|---|
| Open route | `playwright goto "$URL"` or `npx playwright open "$URL"` | URL, status, screenshot path |
| Full-page screenshot | `playwright screenshot --full-page <path>` | `screenshots/<route>-desktop.png` |
| Mobile screenshot | `playwright resize 375x667` then screenshot | `screenshots/<route>-mobile.png` |
| Console capture | browser console listener or `playwright eval` wrapper | `console/<route>.log` |
| Network failures | response listener filtered to status >= 400 | `network/<route>.json` |
| Link crawl | DOM query for `a[href]`, then visit internal links | `links.json` + broken-link issues |
| Form probe | fill valid, invalid, and empty values | before/action/after screenshots |
| A11y scan | axe if available; otherwise keyboard + landmarks + labels | `a11y/<route>.json` or checklist |
| Trace repro | Playwright trace around a single issue | `traces/ISSUE-NNN.zip` |

If a command shape differs in the installed `playwright-cli`, adapt the command but keep the artifact contract. The report should make it possible to replay the QA run without knowing which local helper wrapper was used.

## Modes (pick one per run)

### Diff-Aware (default on feature branch when no URL given)

1. `git diff main...HEAD --name-only`
2. Map changed files to affected routes:
   - `app/**/page.tsx` (Next.js) → `/page-path`
   - `controllers/*Controller.kt` (Spring) → REST endpoints
   - `*.css` / `*.scss` → all pages using those styles
3. Detect running app on common dev ports (3000, 5173, 8080, 8000)
4. Fall back to homepage + top-5 routes if diff has no UI signal

### Full

Visit every reachable page. Slow but thorough. Use for pre-release QA.

### Quick

Homepage + top-5 most-linked pages. Smoke test only. ~2 min.

### Regression

Diff current state against `baseline.json` (produced by an earlier QA run). Report newly-introduced issues and any resolved ones.

## Workflow Phases

### Phase 1: Initialize

- Parse params
- Capture timestamp + git SHA
- Create `.alloy/qa-reports/<timestamp>/` for evidence
- Detect running app or start it (`pnpm dev` / `./gradlew bootRun` / etc.)
- Detect framework, test runner, package manager, and common route roots
- Save run metadata to `.alloy/qa-reports/<timestamp>/run.json`
- Record the starting worktree state and whether fixes are allowed
- Emit `alloy_evidence { kind: "qa_start", taskId, summary: "tier=<tier>, reportOnly=<bool>, url=<url>" }`

Exit criteria:

- Target URL or route set is known.
- Evidence directory exists.
- Browser automation is available or the run is explicitly blocked with setup instructions.
- Baseline git SHA is recorded.

### Phase 2: Authenticate (if --auth)

- Import cookies via playwright `context.addCookies()`
- Verify session by visiting an authed page → check for redirect or 200
- Save sanitized auth notes in `auth.md` without secrets
- Capture screenshot proving authenticated state when relevant
- Emit `alloy_evidence { kind: "qa_auth", taskId, summary: "auth verified for <role>" }`

Exit criteria:

- Authenticated pages are reachable, or the report clearly states that auth setup failed.
- No credentials are written to report files.

### Phase 3: Orient

For each target route:

```bash
playwright goto <route>
playwright screenshot --full-page  # save to .alloy/qa-reports/<ts>/<route>.png
# capture console errors + network failures
```

- Build a route inventory with title, status code, main landmarks, visible nav, and key CTAs.
- Classify each route as marketing, auth, dashboard, form, content, or error/state page.
- Save desktop and mobile screenshots before interacting.
- Emit `alloy_evidence { kind: "qa_orient", taskId, summary: "N routes inventoried, M console/network failures" }`

Exit criteria:

- Every selected route has at least one screenshot.
- Console and network collection are active before interactions begin.

### Phase 4: Explore (per-page checklist)

For each page visited, check:

- [ ] **Visual scan** — does layout render? any obvious overflow, alignment, contrast issues?
- [ ] **Interactive elements** — click each visible button. Does state update?
- [ ] **Forms** — submit with valid + invalid + empty. Get appropriate feedback?
- [ ] **Navigation** — does back/forward work? deep links work? programmatic nav?
- [ ] **States** — loading, empty, error, populated — all rendered correctly?
- [ ] **Console** — any errors? warnings? failed requests in Network panel?
- [ ] **Responsive** — test 375 (mobile), 768 (tablet), 1440 (desktop). Layout breaks?

Explore like a user first, not like an implementer. Do not open source files during this phase.

Route depth by tier:

| Tier | Exploration depth |
|---|---|
| Quick | Primary happy path + obvious failure path |
| Standard | Happy path, validation path, navigation path, responsive path |
| Exhaustive | Standard + edge states, keyboard-only pass, a11y scan, link crawl, low-severity polish |

Emit `alloy_evidence { kind: "qa_explore", taskId, summary: "N interactions, M suspected issues" }` after exploration.

### Phase 5: Document Bugs (incrementally as found)

For each bug, write to `.alloy/qa-reports/<ts>/issues.md`:

```markdown
## ISSUE-NNN: <one-line description>

**Severity:** critical | high | medium | low
**Category:** functional | visual | ux | content | performance | console | accessibility
**Page:** <url>
**Steps to reproduce:**
1. Visit <url>
2. Click "Submit"
3. ...

**Expected:** ...
**Actual:** ...

**Evidence:**
- Interactive: before.png + action-frame.png + after.png
- Static: single annotated screenshot
- Console error: <copy/paste>

**Source location guess:** <file:line> (filled by Phase 8a)
```

Issue quality bar:

- Each issue must have reproduction steps specific enough for another agent to replay.
- Each issue must include at least one artifact path unless it is a pure console/network failure.
- Avoid duplicate issues; link related symptoms under one root issue when they share reproduction.
- Mark uncertainty explicitly as `Observation`, not `Issue`, until reproduced twice.
- Emit `alloy_evidence { kind: "qa_issue", taskId, summary: "ISSUE-NNN <severity> <category>: <title>" }` for each confirmed issue.

### Phase 6: Wrap

- Compute baseline health score (see rubric below)
- Save `baseline.json` for future regression runs
- Save category score breakdown and deduction reasons
- Save route coverage summary so reviewers can see what was not tested
- Emit `alloy_evidence { kind: "qa_baseline", taskId, summary: "Health <score>/100, N issues found" }`

### Phase 7: Triage

Sort all issues by severity. Filter by tier:

| Tier | Fix |
|---|---|
| Quick | critical + high only |
| Standard | + medium |
| Exhaustive | + low + cosmetic |

Mark third-party / infra bugs as **deferred** (we can't fix in this run).

For each issue decide:

- `fix-now` — in tier, reproducible, project-owned code, safe to change
- `defer` — real issue but outside tier/scope/ownership
- `needs-human` — ambiguous product/design judgment
- `observation` — not stable enough to call a bug

Emit `alloy_evidence { kind: "qa_triage", taskId, summary: "fixNow=N, deferred=M, needsHuman=P" }`.

## Health Score Rubric

Weighted across 8 categories. Each category starts at 100. Deduct per issue:

| Severity | Deduction |
|---|---|
| Critical | 25 |
| High | 15 |
| Medium | 8 |
| Low | 3 |

**Category weights:**

| Category | Weight |
|---|---|
| Console (no errors) | 15% |
| Functional (features work) | 20% |
| UX (intuitive interactions) | 15% |
| Accessibility (a11y compliance) | 15% |
| Links (no 404s) | 10% |
| Visual (layout / contrast) | 10% |
| Performance (TTI / LCP) | 10% |
| Content (no typos / placeholders) | 5% |

Overall health = weighted average.

## Phase 8: Fix Loop (skip if --report-only)

For each fixable issue (in severity order):

### 8a. Locate source

- Read relevant component / endpoint / template
- Map symptom to code location
- Update ISSUE-NNN with confirmed `Source location`
- Trace the code path from user action to rendered output or response
- Name the first project-owned function/component that can plausibly fix the bug
- If more than three files look equally likely, stop and use `alloy-debug` before editing

### 8b. Minimal fix

- Smallest change that addresses the issue
- No "while I'm here" refactoring
- No bundled fixes (one issue per commit)
- Preserve unrelated user changes and local worktree state
- Keep the fix small enough to explain in one sentence
- Emit `alloy_evidence { kind: "qa_fix_start", taskId, summary: "ISSUE-NNN source=<file:line>" }`

### 8c. Commit

```bash
git add <specific-files>
git commit -m "fix(qa): ISSUE-NNN — <one-line description>"
```

### 8d. Re-test

- Re-run the exact reproduction from ISSUE-NNN
- Capture before/after screenshots
- Classify outcome:
  - **verified** — bug gone, no regression
  - **best-effort** — partially addresses; user must judge
  - **reverted** — fix caused new issue; `git revert` and document why
- Emit `alloy_evidence { kind: "qa_fix_result", taskId, summary: "ISSUE-NNN verified|best-effort|reverted" }`

### 8e.5 Mandatory regression test

- Trace the bug's code path
- Mirror existing test conventions (look at neighboring test files)
- Filename: `<component>.regression-N.test.<ext>` (auto-increment N if file exists)
- Test includes attribution comment:
  ```
  // Regression for ISSUE-NNN: <description>
  // Discovered during alloy-qa on 2026-05-25 (commit <sha>)
  ```
- Run only this test → MUST pass
- Commit: `test(qa): regression test for ISSUE-NNN`
- If the repo has no test harness for this layer, document why and downgrade the fix to `best-effort`
- Do not count a fix as `verified` without either a regression test or an explicit user-approved exception
- Emit `alloy_evidence { kind: "qa_regression_test", taskId, summary: "ISSUE-NNN test=<path>" }`

### 8f. Self-regulation (WTF-likelihood)

Track a "things are going wrong" counter:

| Signal | Weight |
|---|---|
| Fix reverted | +15% |
| Multi-file fix (touched > 2 files) | +5% |
| Fixing only low-severity (signal of diminishing returns) | +10% |
| Touching files unrelated to the bug | +20% |
| Past fix 15 in this run | +1% per additional |

**Stop if > 20%.** Hard cap: 50 fixes per run.

When stopping mid-run, write `.alloy/qa-reports/<ts>/wtf-stopped.md` explaining why.

Also emit `alloy_evidence { kind: "qa_self_regulation", taskId, summary: "stopped at <percent>%: <reason>" }`.

## Phase 9: Final QA

Re-run the same exploration as Phase 3–4. Compute final health score. **If health regressed from baseline, STOP and surface — autopilot must not silently merge regressions.**

Final QA is not optional in fix mode. It protects against the common failure where a targeted bug is fixed but the page, console, or responsive layout regresses elsewhere.

Emit `alloy_evidence { kind: "qa_final", taskId, summary: "Health <after>/100 (<delta>), regressions=<N>" }`.

## Phase 10: Report

Write `.alloy/qa-reports/<ts>/report.md`:

```markdown
# QA Report — <date> — <tier> tier

## Health Score
| | Baseline | After fixes | Δ |
|---|---|---|---|
| Console | 85 | 100 | +15 |
| Functional | 70 | 95 | +25 |
| ... | ... | ... | ... |
| **Overall** | **76** | **94** | **+18** |

## Top 3 Fixes
1. ISSUE-007: Login button unresponsive on mobile → fixed by adding touch handler
2. ISSUE-012: ...
3. ISSUE-015: ...

## Console Health
Before: 8 errors across 5 pages
After: 0 errors

## Summary
- N issues found
- M fixed (verified)
- P best-effort (need human review)
- Q deferred (third-party / out of scope)

## Issues
<full table of every ISSUE-NNN with severity, category, status, commit SHA>

## Fixes Applied
<for each verified fix: ISSUE-NNN, file:line changed, commit SHA, before/after screenshot paths>

## Regression Tests
<list of new test files with commit SHAs>

## Ship Readiness
✅ Ready / ⚠️ Needs review / ❌ Not ready (with reason)

## Regressions Introduced
None / <list with severity>
```

## Phase 11: Update TODOS.md

For deferred bugs (third-party, out of scope, can't fix in this run):

```bash
# Append to .alloy/TODOS.md
- [ ] ISSUE-NNN: <description> (deferred from QA <date>; see <report-path>)
```

Emit `alloy_evidence { kind: "qa_todos", taskId, summary: "N deferred issues appended" }`.

## Evidence Ledger by Phase

| Phase | Required evidence kind | Minimum payload |
|---|---|---|
| 1 Initialize | `qa_start` | tier, URL/scope, report-only flag, git SHA |
| 2 Authenticate | `qa_auth` | auth role or explicit skip reason |
| 3 Orient | `qa_orient` | route count, screenshot directory, console/network counts |
| 4 Explore | `qa_explore` | interaction count, route coverage |
| 5 Document | `qa_issue` | issue ID, severity, category, artifact path |
| 6 Wrap | `qa_baseline` | health score and issue count |
| 7 Triage | `qa_triage` | fix/defer/needs-human counts |
| 8 Fix | `qa_fix_start`, `qa_fix_result`, `qa_regression_test` | source, commit SHA, test path |
| 9 Final | `qa_final` | after score, delta, regression count |
| 10 Report | `qa_report` | report path and ship-readiness status |
| 11 TODOs | `qa_todos` | deferred count and TODO path |

If the environment does not expose an `alloy_evidence` tool, append equivalent JSONL entries to `.alloy/state/evidence.jsonl` using the same `kind`, `taskId`, `summary`, and `command` fields.

## Important Rules

1. **Repro is everything.** No bug ships without exact reproduction steps.
2. **Verify before documenting.** If you can't reproduce a bug consistently, don't write it up as a bug — write it as an observation.
3. **Never read source code during exploration phase** (Phases 3–5). You test as a user. Source-reading happens in Phase 8a.
4. **Show screenshots to the user.** Use the `Read` tool on saved screenshots so chat surface renders them.
5. **Never refuse to use the browser.** If playwright fails, fix playwright before continuing.
6. **One bug per commit in Phase 8.** Atomic = revertible.
7. **Regression test is non-negotiable** for verified fixes. If you can't write one (no test framework, can't reproduce), classify as "best-effort" not "verified".
8. **No "while I'm here" refactoring** during fixes.
9. **No batching unrelated fixes** in one commit.
10. **Stop on WTF-likelihood > 20%.** Don't push through.
11. **Capture deferred bugs in TODOS.md** even if you don't fix.
12. **Final health score must beat baseline** or autopilot/user gets notified.
13. **Report-only means no mutation.** Do not edit source, create commits, or write tests in `--report-only`.
14. **Evidence before claims.** Every health-score, fix, and readiness statement needs a saved artifact or command output.
15. **Portable over clever.** Prefer commands and artifacts that work without gstack runtime, shell aliases, or machine-specific state.

## Framework-Specific Hints

- **Next.js**: watch for hydration errors in console, `_next/data` 404s, missing `'use client'` markers
- **Spring Boot / Kotlin**: N+1 query log, CSRF token mismatches, JPA lazy-loading exceptions
- **WordPress** (if applicable): plugin conflicts, REST API permission errors
- **SPA (any)**: nav doesn't trigger snapshot reset, stale store state, history API mismatches

## Output Structure

```
.alloy/qa-reports/<timestamp>/
├── report.md              # Phase 10 final report
├── issues.md              # All bugs found (Phase 5)
├── baseline.json          # Phase 6 health snapshot (for future regression runs)
├── wtf-stopped.md         # (if Phase 8 self-regulated stop)
├── screenshots/
│   ├── home.png
│   ├── login-before.png
│   ├── login-action.png
│   ├── login-after.png
│   └── ...
└── playwright-trace.zip   # (optional, if --trace)
```

## Related Skills

- **playwright-cli** — browser automation primitives
- **alloy-tdd** — for writing the regression test in Phase 8e (use exact RGR discipline)
- **alloy-debug** — when fixes fail repeatedly (3-fix architectural gate applies)
- **harden** (vendor: gstack-derived, frontend scope) — production-readiness checks beyond visible bugs

## Evidence

```
alloy_evidence { kind: "qa_baseline", taskId, summary: "Health 76/100, N issues found" }
alloy_evidence { kind: "qa_fix", taskId, summary: "ISSUE-007 fixed, regression test added", command: "git rev-parse HEAD" }
alloy_evidence { kind: "qa_final", taskId, summary: "Health 94/100 (+18), ship-ready" }
```

## Attribution

This skill is **inspired by** gstack `/qa` (garrytan/gstack, MIT) but **rewritten** to remove gstack runtime dependencies (gstack-* binaries, $B browse, ~/.gstack/). Core concepts adopted: 11-phase workflow / 8-category health rubric / WTF-likelihood self-regulator / Phase 8e.5 regression discipline. alloy adds: evidence ledger integration / playwright-cli abstraction / --report-only mode.

See CREDITS.md for full attribution chain.
