---
name: alloy-autopilot
description: Use when you have a spec and want unattended execution through the full plan→execute→verify→ship pipeline. Risk-tiered review depth and bounded iteration. Stop on first BLOCKED status.
---

# Alloy Autopilot

## Overview

`alloy-autopilot` chains the existing Alloy phase pipeline into an unattended run:

```
spec (input) → alloy-plan → alloy-execute → alloy-verify → alloy-ship → done
                  ↑                              ↓
                  └─── (on fail × N) ────────────┘
```

It does NOT add new agent capabilities — it removes the human between phases. Use it when:
- You trust the spec (already user-approved)
- The work is bounded (clear acceptance criteria, time-boxed)
- You want to walk away while it runs (overnight, weekend batch)

Do NOT use it when:
- The spec is ambiguous (run `alloy-discuss` + `alloy-brainstorm` first)
- The task touches production secrets or sensitive infrastructure (always supervise)
- You don't have a fresh test suite (verify gate will be unreliable)
- It's a one-off / exploratory task (the ceremony overhead isn't worth it)

## Invocation

```
/autopilot <spec-id> [--risk low|med|high] [--max-iters N] [--resume]
```

| Flag | Default | Meaning |
|---|---|---|
| `--risk` | `med` | Review depth: low=1 pass, med=2 passes, high=3 passes (each pass = different reviewer perspective) |
| `--max-iters` | `5` | Max retry attempts per phase before escalating |
| `--resume` | `false` | Pick up from last incomplete phase (reads `.alloy/state/autopilot.jsonl`) |

## The Loop

```
load spec from .alloy/specs/<id>/task_plan.md

if --resume:
    read .alloy/state/autopilot.jsonl
    determine last completed phase
    set current_phase = next phase
else:
    set current_phase = plan

while current_phase != "done":
    if current_phase == "plan":
        invoke alloy-plan
        if plan written OK: → execute
        else: BLOCKED → stop

    elif current_phase == "execute":
        invoke alloy-execute
        for each task:
            if status == DONE: continue
            if status == DONE_WITH_CONCERNS: log + continue
            if status == NEEDS_CONTEXT:
                if iter_count < max_iters:
                    invoke alloy-debug to investigate
                    retry
                else: ESCALATE → stop
            if status == BLOCKED: stop
        if all tasks DONE or DONE_WITH_CONCERNS: → verify
        else: stop

    elif current_phase == "verify":
        invoke alloy-verify
        run full test suite + lint + typecheck + build
        if all pass: → ship
        else:
            if iter_count < max_iters:
                invoke alloy-debug per failure
                go back to execute
            else: ESCALATE → stop

    elif current_phase == "ship":
        invoke alloy-ship (vendor: SuperPower finishing-a-development-branch)
        if branch ready for PR: → done
        else: stop

    write progress to .alloy/state/autopilot.jsonl
```

## Risk Tiers

Risk controls **review depth at the verify phase**:

| Tier | Review count | Per-pass reviewer perspective |
|---|---|---|
| **low** | 1 pass | `alloy-review` (general code review) |
| **med** | 2 passes | `alloy-review` + `plan-eng-review` (architectural lens, vendor: gstack) |
| **high** | 3 passes | `alloy-review` + `plan-eng-review` + `cso` security review (vendor: gstack) |

If any pass surfaces a Critical-severity issue, the verify phase fails and autopilot returns to execute.

## Bounded Iteration

Per-phase retry cap = `--max-iters` (default 5).

If exceeded, autopilot **stops and escalates** — it does NOT silently keep trying. Stall detection from `alloy-debug`'s "3-fix architectural gate" applies recursively: if execute phase fails 3 times in the same area, autopilot stops even before max-iters is hit.

**Escalation surface:**
```markdown
[Autopilot] STOPPED at phase=execute, iter=5/5
Last status: NEEDS_CONTEXT
Failed task: "Implement password reset email send"
Reason: Missing SendGrid API key in env
Recommended next action: User adds SENDGRID_API_KEY to .env, re-run with --resume
```

## Stop on First BLOCKED

If any phase emits `BLOCKED`, autopilot stops immediately. BLOCKED means external state is wrong (missing creds, broken dep, infra down) — retry won't help.

The output should include exact recovery steps:

```markdown
[Autopilot] BLOCKED at phase=execute
Reason: PostgreSQL connection refused on localhost:5432
Recovery:
  1. `colima start postgres` (if using local container)
  2. OR: `docker compose up -d postgres`
  3. Verify: `psql postgresql://localhost:5432/dev`
Resume with: `/autopilot <spec-id> --resume`
```

## State Persistence

After each phase transition, append to `.alloy/state/autopilot.jsonl`:

```json
{"phase": "plan", "status": "done", "ts": "2026-05-25T10:30:00Z", "specId": "<id>"}
{"phase": "execute", "status": "in_progress", "ts": "...", "currentTask": 3, "totalTasks": 8}
{"phase": "execute", "status": "done", "ts": "...", "totalTasks": 8, "concerns": 2}
{"phase": "verify", "status": "done", "ts": "...", "reviewPasses": 2, "issuesFound": 0}
{"phase": "ship", "status": "done", "ts": "...", "prUrl": "https://github.com/...", "branch": "feat/password-reset"}
```

`--resume` reads this and jumps to the next phase.

## Cost Bounding

**Hard cap:** autopilot will not run past `--max-iters * N_phases` (default 5 × 4 = 20 phase invocations).

After cap, it stops with full state preserved. The user can:
- Review what was done (read `.alloy/state/autopilot.jsonl` + `.alloy/specs/<id>/`)
- Resume with higher cap (`/autopilot <id> --resume --max-iters 10`)
- Fix the root cause and resume

## Notification Hook (future)

When complete (DONE or stopped), emit a desktop notification via the OpenCode plugin's notification API (if available):

```
[Autopilot] DONE: feature/password-reset
- Plan: 8 tasks
- Execute: 8 DONE, 2 with concerns (see findings.md)
- Verify: 2-pass review, all pass
- Ship: PR #234 ready for review
```

This lets you walk away.

## Anti-Patterns

| Don't | Do |
|---|---|
| Use autopilot for first-time / exploratory tasks | Use direct `/plan` `/execute` `/verify` so you're in the loop |
| Skip the user-approved spec | Always run `alloy-brainstorm` or `alloy-discuss` first to lock the spec |
| Set `--max-iters 100` to push through | If iter > 5, the spec or codebase has a real problem; investigate, don't brute-force |
| Trust the final report without reading | Always read `.alloy/specs/<id>/progress.md` + `findings.md` after autopilot returns |
| Use for ship-to-production deploys | Autopilot ends at "PR ready"; humans approve the merge |

## Hand-Off

After done:

> "Autopilot complete for spec `<id>`.
> - Phase report: see `.alloy/state/autopilot.jsonl`
> - Concerns: `.alloy/specs/<id>/findings.md`
> - Verification: `.alloy/specs/<id>/verification.md`
> - PR: <url> (ready for human review)
>
> Recommend: read findings.md before merging."

## Evidence

```
alloy_evidence { kind: "autopilot_start", taskId, summary: "Risk=med, max-iters=5" }
alloy_evidence { kind: "autopilot_phase", taskId, summary: "execute DONE, 8 tasks, 2 concerns" }
alloy_evidence { kind: "autopilot_done", taskId, summary: "PR #234 ready, 0 verify issues" }
```

## Related Skills

- **alloy-plan** — phase 1
- **alloy-execute** — phase 2 (uses 4 status codes; NEEDS_CONTEXT and BLOCKED stop autopilot)
- **alloy-verify** — phase 3 (run with risk-tier review depth)
- **alloy-ship** (vendor: SuperPower finishing-a-development-branch) — phase 4
- **alloy-debug** — invoked on retry to investigate failures
- **plan-eng-review** / **cso** (vendor: gstack) — additional review passes at med/high risk tiers

## Attribution

Concept-only rewrite from:

- **axledbetter/claude-autopilot** (MIT) — phase-per-skill chaining pattern, risk-tier review depth, on-disk state for resume. No upstream skill file was vendored in this sandbox; Alloy re-authors the flow against its existing 3-phase pipeline.
- **GSD bounded iteration** (rokicool/gsd-opencode and gsd-build/get-shit-done, MIT) — max-iters + stall detection escalation, autopilot.jsonl ledger.
- **Alloy** (MIT / first-party) — 4 status codes from alloy-execute drive the loop, integration with our existing skill chain.

See `/CREDITS.md` at repo root for the full attribution chain.
