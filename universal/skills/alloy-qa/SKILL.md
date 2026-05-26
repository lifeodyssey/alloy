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

### Phase 2: Authenticate (if --auth)

- Import cookies via playwright `context.addCookies()`
- Verify session by visiting an authed page → check for redirect or 200

### Phase 3: Orient

For each target route:

```bash
playwright goto <route>
playwright screenshot --full-page  # save to .alloy/qa-reports/<ts>/<route>.png
# capture console errors + network failures
```

### Phase 4: Explore (per-page checklist)

For each page visited, check:

- [ ] **Visual scan** — does layout render? any obvious overflow, alignment, contrast issues?
- [ ] **Interactive elements** — click each visible button. Does state update?
- [ ] **Forms** — submit with valid + invalid + empty. Get appropriate feedback?
- [ ] **Navigation** — does back/forward work? deep links work? programmatic nav?
- [ ] **States** — loading, empty, error, populated — all rendered correctly?
- [ ] **Console** — any errors? warnings? failed requests in Network panel?
- [ ] **Responsive** — test 375 (mobile), 768 (tablet), 1440 (desktop). Layout breaks?

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

### Phase 6: Wrap

- Compute baseline health score (see rubric below)
- Save `baseline.json` for future regression runs

### Phase 7: Triage

Sort all issues by severity. Filter by tier:

| Tier | Fix |
|---|---|
| Quick | critical + high only |
| Standard | + medium |
| Exhaustive | + low + cosmetic |

Mark third-party / infra bugs as **deferred** (we can't fix in this run).

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

### 8b. Minimal fix

- Smallest change that addresses the issue
- No "while I'm here" refactoring
- No bundled fixes (one issue per commit)

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

### 8e. Regression test

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

## Phase 9: Final QA

Re-run the same exploration as Phase 3–4. Compute final health score. **If health regressed from baseline, STOP and surface — autopilot must not silently merge regressions.**

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

Concept-only fusion of:
- **gstack/qa** — phase structure, health score rubric (8-category weighted), WTF-likelihood self-regulator, fix loop discipline, regression test attribution format, framework-specific hints (CONCEPT ONLY; gstack runtime stripped — we use playwright instead of `$B browse`, `.alloy/qa-reports/` instead of `~/.gstack/projects/`)
- **Alloy** — playwright-cli integration, evidence ledger, no gstack runtime dependency

NO depends on `~/.claude/skills/gstack/bin/` or `~/.gstack/` — fully standalone.
