# Alloy v3 Redesign — Findings

> Consolidated insights from 14+ sub-agent research dispatches across 5 rounds. Per planning-with-files security rules, external content lives HERE not in task_plan.md.

## F1: Three-layer fusion thesis

GSD + OMO Slim + SuperPower are NOT competing — they solve different layers:

```
L3  COGNITIVE DISCIPLINE  ── SuperPower contributes
    HARD-GATE / Iron Law / Red-Flag tables / hand-off chain

L2  WORKFLOW PHASE STRUCTURE  ── GSD contributes
    spec/plan/execute/verify phases + artifacts + bounded retry

L1  RUNTIME PLUMBING  ── OMO Slim contributes
    filter-available-skills, json-error-recovery, etc.

L0  OPENCODE PLUGIN API  ── the ground we already stand on
```

This is why "fuse" beats "integrate" — each upstream serves a different need; their concerns don't overlap if absorbed cleanly.

## F2: Our alloy-* skills are thinned versions of SuperPower's

Sub-agent compared SKILL.md files line-by-line:

- `alloy-tdd` (60 LOC) ≈ `superpowers/test-driven-development` (371 LOC) **minus** rationalizations table, example code, "human partner" cues; **plus** Stack Companions routing + Evidence-To-Report block. Verdict: derived-but-diverged.
- `alloy-debug` (23 LOC) ≈ `superpowers/systematic-debugging` (296 LOC) minus root-cause-tracing/defense-in-depth/3-failed-fix rule. Verdict: thinned.
- `alloy-brainstorm` (29 LOC) ≈ `superpowers/brainstorming` (164 LOC) minus HARD-GATE, visual companion, spec self-review. Verdict: thinned.

**Critical bug**: `all.json` ships BOTH versions, causing trigger collision (OpenCode non-deterministically picks one). `vendor/skills/superpowers/brainstorming` references `writing-plans` skill we don't ship — broken chain.

Implication for redesign: absorb the dropped value back into alloy-* (HARD-GATE, root-cause-tracing, etc.), then delete `vendor/skills/superpowers/`.

## F3: Industry has converged on spec → plan → tasks → implement

- GitHub Spec Kit, AWS Kiro, Tessl, Claude Code SDD — nearly identical shape
- 3-4 Markdown artifacts (spec/plan/tasks ± constitution) in versioned folder
- Review gates between phases
- This is real signal, not hype — adopt or be alien

## F4: Anthropic publicly pushing "skills > subagents"

Recent guidance: prefer many lazy-loaded skills over many always-on agents. Token economics + cognitive load. Validates Q6 decision to cap specialists at 6.

## F5: Glob-scoped Markdown rules + YAML frontmatter is the universal pattern

- Cursor `.cursor/rules/*.mdc` (description, globs, alwaysApply, 4 activation modes)
- GitHub Copilot `.github/instructions/*.instructions.md` (applyTo frontmatter)
- Cline `.clinerules/` directory with paths glob
- aider `.aider.conf.yml` + `CONVENTIONS.md` cascade
- Anything not following this shape will feel alien to onboarding users

Our skills/*/SKILL.md should adopt this frontmatter contract.

## F6: OpenCode plugin API surface — we use 6 of 19 hooks

Verified from `@opencode-ai/plugin@1.15.10` .d.ts:

19 hooks total. We use: `shell.env`, `chat.message`, `permission.ask`, `tool.execute.before`, `tool.execute.after`, `event`.

**Key unused hooks for redesign**:
- `config` — boot-time config mutation (OMO's whole architecture relies on this)
- `experimental.chat.messages.transform` — needed for `filter-available-skills` port
- `experimental.chat.system.transform` — cleaner status injection than chat.message
- `experimental.session.compacting` — inject ledger summary to survive compaction
- `command.execute.before` — intercept `/spec /plan` etc. for Alloy-specific routing
- `tool.definition` — rewrite tool descriptions to remind about gates

Does NOT exist: `session.start`, `session.end`, `model.invoke.*`, `error.recover`. OMO simulates these via `event` hook.

## F7: OMO's `filter-available-skills` is ~70 LOC, pure code

Per-agent skill visibility rules. Same install, different `<available_skills>` injected based on which agent is active. Verified pure string/regex (zero native deps). Directly solves "per-repo on-demand" at runtime layer — better than `--with`/`--without` at install layer.

Source: `src/hooks/filter-available-skills/index.ts` in alvinunreal/oh-my-opencode-slim.

## F8: GSD's harness is low-tech but works — "phase artifacts + grep markers + bounded retry"

Crucial realization (made by user pushback): we don't need OpenHands-style critic/stop_hook infrastructure. GSD achieves harness via:
- Structured artifacts as evidence (spec.md / plan.md / summary.md must exist)
- Grep-able completion markers (`## VERIFICATION PASSED` vs `## ISSUES FOUND`)
- Max 3 review iterations + stall detection (issue count not decreasing → escalate)
- Closed-phase gate (replanning closed phase requires --force; no --force for --reviews)

This is the harness we're building — light-tech, encoded in phase orchestrator prompts.

## F9: Factory uses Git as handoff medium, not JSON contracts

Quote (Missions blog): "coordinates handoffs through git… Git is the source of truth." Branches/diffs/PR comments are durable, auditable, human-readable. We had been planning JSON contracts between agents — this is wrong.

## F10: OpenHands harness architecture (reference, not blueprint)

For learning, not copying (we're #2/#3/#5 not #1):
- `AgentFinishedCritic` scores 0 if git_patch empty
- `stop_hook` can veto FINISHED transition and inject feedback
- `_truncate_at_finish` discards same-batch tool calls after FinishTool
- `StuckDetector` (5 patterns × 20-event window): repeating action+observation, repeating action+error, monologue, ABAB alternation, context-window-error loop
- `SecretRegistry` scans bash for key-name substring, injects only matched env vars per command
- `EventLog` is append-only; restart = reread

Adopt if we later expand into #1 territory. Not now.

## F11: Cursor's verification gap is real differentiation space

Cursor explicitly punts verification: "Use typed languages, configure linters, write tests" (best-practices blog). Review pass is optional/separate; Bugbot runs at PR time. **Even the market leader hasn't productized "claim + evidence + gate"** — this is real moat space for us IF we expand to #1 later.

Cursor strengths to learn from:
- Composer trained for self-summarization at 40k/80k tokens (~1k summary vs 5k baseline) — trained-in, not bolted-on
- /multitask with shared upfront contract between parallel subagents
- Plan Mode as canonical decomposition (Shift+Tab)
- sandbox-exec for local agents (Seatbelt/Landlock/seccomp), default-deny

## F12: git worktree is NOT a sandbox — Crystal/Claude Squad confused this

Both ship `--dangerously-skip-permissions` by default. Worktree only avoids file collision between parallel agents — agent still has full host filesystem, ~/.ssh, ~/.aws, etc. For real isolation: Container Use (Dagger), Cursor sandbox-exec, OpenHands DockerWorkspace.

Implication for Q9: if we want true sandbox, ship `container-use` atom; if we accept "isolation = file collision avoidance", git worktree is enough.

## F13: Container Use is the right Q4 (sandbox) outsource

- MCP server (works via OpenCode's MCP discovery — no fork needed)
- Each agent gets Dagger container + fork-repo worktree at `~/.config/container-use/repos/`
- Secrets via `dag.Secret` — never in logs/prompt
- Network egress unrestricted (caveat)
- ~50-line integration: MCP entry in defaults.json + 1 skill teaching the 13 tools
- **Container runtime choice**: our team uses **colima** (MIT, free, Apple-Silicon native, no per-user fee). README primary recommendation; OrbStack/Podman/Rancher Desktop as alternatives. Docker Desktop NOT recommended due to commercial license restrictions for large orgs.

## F14: GSD's 25 agents are 4 archetypes repeated

Verification class (~30%): plan-checker, doc-verifier, spec-verifier, nyquist-auditor, coverage-auditor...
Writing class (~25%): doc-classifier, doc-synthesizer, summary-writer...
Research/read class (~25%): codebase-mapper, pattern-mapper, phase-researcher, user-profiler...
Execution class (~20%): planner, executor, debugger...

Each phase-or-task got its own agent instead of reusing existing ones with different skills. Anti-pattern. Reinforces our Q6 decision: 6 specialists + N skills > 25 specialized agents.

## F15: Per-task token/dollar budget cap is industry-wide blind spot

Cursor has Pro $20 plan cap + overage disable (org-wide). OpenHands has `max_iteration=500`. Factory has rolling rate limits per period. **None have per-task budget enforcement.** Factory admits 16-day missions run uncontrolled.

Not a Q1 issue for us (we excluded #1) but worth flagging — adding per-task budget gate to Alloy's verify phase would be distinctive.

## F16: Conductor's missing layer = exactly what we're building

Conductor (Mac app, YC-backed, parallel Claude Code workspaces) has NO plugin/extension model, NO team-config layer, NO shared/versioned config pack. They isolate via git worktree but don't help teams share OpenCode config. This is precisely the gap we fill — different category, complementary.

---

## Skill ownership decision input (for Q10)

| Skill | Source | Verdict |
|---|---|---|
| alloy-tdd | first-party (thinned superpowers/tdd) | absorb superpowers content + delete vendor copy |
| alloy-debug | first-party (thinned superpowers/sys-debug) | absorb + delete vendor copy |
| alloy-brainstorm | first-party (thinned superpowers/brainstorm) | absorb + delete vendor copy |
| (new) alloy-plan | absorb superpowers/writing-plans | first-party, fixes broken chain |
| (new) alloy-execute | absorb superpowers/executing-plans | first-party |
| (new) alloy-verify | absorb superpowers/verification-before-completion | first-party |
| git-master | first-party (1116 LOC mega-prompt) | split into commit/rebase/history references |
| humanizer | first-party | keep |
| frontend-ui-ux | first-party | keep, frontend pack only |
| playwright-cli | first-party | fix broken references first |
| vercel-react-best-practices | vendor (Vercel labs) | keep vendored — framework-specific |
| kotlin-backend-jpa-entity-mapping | vendor (Kotlin team) | keep vendored — framework-specific |
| postgres + design + pgvector | vendor (Timescale) | keep router pattern; fix backend pack triple-shipping |
| terraform-skill | vendor | keep |

**Principle**: vendor only what we genuinely can't write — framework-specific skills maintained by framework experts. Absorb all "generic workflow discipline" content into first-party.
