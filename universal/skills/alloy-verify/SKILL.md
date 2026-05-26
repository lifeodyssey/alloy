---
name: alloy-verify
description: Use BEFORE claiming work is complete, fixed, passing, or ready to commit/PR. Requires running verification commands and confirming output before any success claims; evidence before assertions always.
---

# Alloy Verify

## Overview

Claiming work is complete without verification is **dishonesty, not efficiency**.

**Core principle:** Evidence before claims, always.

**Violating the letter of this rule is violating the spirit of this rule.**

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you haven't run the verification command in this message (or the previous tool call), you cannot claim it passes.

## The Gate Function

```
BEFORE claiming any status or expressing satisfaction:

1. IDENTIFY: What command proves this claim?
2. RUN: Execute the FULL command (fresh, complete)
3. READ: Full output, check exit code, count failures
4. VERIFY: Does output confirm the claim?
   - If NO: State actual status with evidence
   - If YES: State claim WITH evidence
5. ONLY THEN: Make the claim

Skip any step = lying, not verifying
```

## Common Failures

| Claim | Requires | Not Sufficient |
|-------|----------|----------------|
| Tests pass | Test command output: 0 failures | Previous run, "should pass" |
| Linter clean | Linter output: 0 errors | Partial check, extrapolation |
| Build succeeds | Build command: exit 0 | Linter passing, logs look good |
| Bug fixed | Test original symptom: passes | Code changed, assumed fixed |
| Regression test works | Red-green cycle verified | Test passes once |
| Agent completed | VCS diff shows changes | Agent reports "success" |
| Requirements met | Line-by-line spec checklist | Tests passing |
| Deploy succeeded | Health check returns 200 | CI pipeline green |

## Red Flags — STOP

If you catch yourself doing any of these, STOP and run the verification:

- Using "should", "probably", "seems to"
- Expressing satisfaction before verification ("Great!", "Perfect!", "Done!", "All good!")
- About to commit/push/PR without verification
- Trusting agent success reports without independent check
- Relying on partial verification (linter passing → assuming compiler passing)
- Thinking "just this once"
- Tired and wanting work over
- **ANY wording implying success without having run verification**

## Rationalization Prevention

| Excuse | Reality |
|--------|---------|
| "Should work now" | RUN the verification |
| "I'm confident" | Confidence ≠ evidence |
| "Just this once" | No exceptions |
| "Linter passed" | Linter ≠ compiler |
| "Agent said success" | Verify independently |
| "I'm tired" | Exhaustion ≠ excuse |
| "Partial check is enough" | Partial proves nothing |
| "Different words so rule doesn't apply" | Spirit over letter |
| "User said it's working" | User testing ≠ your verification |

## Key Patterns

**Tests:**
```
✅ [Run test command] [See: 34/34 pass] → "All tests pass (34/34)"
❌ "Should pass now" / "Looks correct"
```

**Regression tests (TDD Red-Green verified):**
```
✅ Write test → Run (pass) → Revert fix → Run (MUST FAIL) → Restore → Run (pass)
❌ "I've written a regression test" (without red-green verification)
```

**Build:**
```
✅ [Run build] [See: exit 0] → "Build passes"
❌ "Linter passed" (linter doesn't check compilation)
```

**Requirements:**
```
✅ Re-read spec → Create checklist from acceptance criteria → Verify each → Report gaps or completion
❌ "Tests pass, phase complete" (tests don't cover all spec items)
```

**Agent delegation:**
```
✅ Agent reports success → Check VCS diff → Verify changes match spec → Report actual state
❌ Trust agent report
```

**Deploy:**
```
✅ Deploy → Wait for health check → curl health endpoint → exit 0 → "Deploy live"
❌ "Pipeline green, deploy done" (pipeline ≠ live service)
```

## Why This Matters

From past trust-breaks:
- User said "I don't believe you" — trust broken, hard to rebuild
- Undefined functions shipped — would crash in prod
- Missing requirements shipped — incomplete features merged
- Time wasted on false completion → redirect → rework
- Violates: "Honesty is a core value."

## When to Apply

**ALWAYS before:**
- ANY variation of success/completion claims
- ANY expression of satisfaction
- ANY positive statement about work state
- Committing, PR creation, task completion
- Moving to next task in `alloy-execute`
- Closing an Alloy task via `alloy-claim`
- Delegating to agents (you still must verify their output)
- Reporting back to the user that a phase is done

**Rule applies to:**
- Exact phrases
- Paraphrases and synonyms
- Implications of success
- ANY communication suggesting completion/correctness

## How alloy-verify Plugs Into the Gate

The Alloy plugin gates task closure on verification evidence. To close a task:

1. Run verification command(s) — minimum: the project's test runner
2. Capture exit code, output, failure count
3. Emit evidence:
   ```
   alloy_evidence { kind: "verification", taskId, summary: "npm test: 34/34 pass", command: "npm test", exitCode: 0 }
   ```
4. Emit claim bound to that evidence:
   ```
   alloy_claim { taskId, text: "Task N implementation verified", evidenceIds: ["<verification-evidence-id>"] }
   ```
5. Run `alloy gate check --task-id <id>` to confirm the task can close

`alloy gate check` will REJECT a claim if:
- No `verification` evidence exists for the task
- Evidence is older than the most recent code change
- Evidence's `exitCode != 0`

## The Verify Loop for Complex Work

For multi-step work (a full plan execution), apply at TWO levels:

**Per-task verify** (in `alloy-execute`):
- After each task → run task-scoped tests → emit evidence
- Status code DONE requires verification evidence

**Per-spec verify** (here, at end of plan execution):
- Re-read the plan acceptance criteria
- For each criterion → identify proof command → run → record evidence
- Run full test suite
- Run lint + typecheck + build (whatever the project has)
- Emit `verification.md` to `.alloy/plans/<id>/verification.md` with the matrix

```markdown
# Verification for <feature>

## Acceptance Criteria
- [x] User can reset password via email — verified by `e2e/auth.spec.ts::reset-password-flow` (PASS)
- [x] Reset links expire 1hr — verified by `unit/tokens.test.ts::expiry` (PASS, 12/12)
- [x] Rate limit at 5 failures — verified by `e2e/rate-limit.spec.ts` (PASS)
- [x] No account enumeration — verified by manual review of `POST /reset-password` response shape (uniform)

## Build / Lint / Test
- `npm test` → 142/142 pass (exit 0)
- `npm run lint` → 0 errors (exit 0)
- `npm run typecheck` → 0 errors (exit 0)
- `npm run build` → exit 0
```

## Related Skills

- **alloy-tdd** — provides RED+GREEN evidence that satisfies per-task verify
- **alloy-execute** — runs per-task verify between tasks
- **alloy-ship** (vendor: SuperPower finishing-a-development-branch) — final ship-readiness check
- **alloy-respond-review** (vendor: SuperPower receiving-code-review) — verify changes when responding to PR feedback

## The Bottom Line

**No shortcuts for verification.**

Run the command. Read the output. THEN claim the result.

This is non-negotiable.

## Attribution

Fuses:
- **obra/superpowers** verification-before-completion — Iron Law, Gate Function, Common Failures table, Red Flags, Rationalization Prevention, Key Patterns (MIT)
- **Alloy** — gate-check binding to `.alloy/state/{evidence,claims}.jsonl`, two-level verify (per-task + per-plan), `.alloy/plans/<id>/verification.md` artifact convention
