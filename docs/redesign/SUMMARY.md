# OpenCode Alloy v2 → v3 — Complete Change Summary

> Single-document reference for everything that changed in the v3 redesign. Generated 2026-05-25 at end of Q1-Q11 grill cycle. Pair with `task_plan.md` (decisions), `findings.md` (research), `progress.md` (session log), `config-overview.html` (visual).

## TL;DR

**Release tag for this redesign: `v0.1.0`** (reset from v2 numbering — this is the first OSS-ready release of the new architecture).

**Old (v2) was** a config distribution tool with 6 lifecycle agents, 7 first-party skills, 3 baseline MCPs, hard-coded version pins, no manifest concept, and orphan safety-net rules.

**v0.1.0 (this redesign) is** a fusion of the best ideas from SuperPower (cognitive discipline) + GSD (workflow phases) + OMO Slim (runtime hooks) + Matt Pocock (Vertical TDD + writing/handoff/grill) + gstack (QA methodology), wrapped in:
- **7 domain specialists** + **1 router**, not 6 lifecycle agents
- **3 central phases** (Plan → Execute → Verify) instead of free-form
- **11 first-party fusion skills** + **22+ vendored skills** + **8 MCPs** + **CLI recommendations**
- **2-tier physical install** + **manifest-driven visibility** (per-agent skill subset, zero-restart `alloy add`)
- **Container Use opt-in sandbox**
- **cc-safety-net** for dangerous command interception (replaces our orphan regex file)
- **Double-track semver** (CLI version independent from vendor skill versions)
- **MIT first-party + upstream-license vendored**
- **No telemetry**

## Goal triple (user-confirmed, Q1)

1. **#2** Multi-repo OpenCode config distribution
2. **#3** Standardize SDD-style workflow discipline across team repos
3. **#5** Be the OSS reference for OpenCode team config

**Explicitly NOT goals**: building a harness layer (#1) or pure token-cost optimization (#4). However, GSD's light-tech harness (artifacts + grep markers + bounded retry) comes free with our phase model — we get harness benefit without harness investment.

## Audience (Q2)

**Mode D — dogfood + OSS double-track.** Main branch is what our team eats. OSS users get tagged releases. Team-specific config lives in gitignored `.alloy/local/` overlay; public config has no team-specific assumptions.

## Architecture by question

| Q | Decision | Why |
|---|---|---|
| Q3 | OMO-style tiered routing | Orchestrator must be smart; what it routes to is opinion |
| Q4 | Central pipeline, phases dispatch specialists (Model B) | Harness centralizes in phase orchestrator; specialists stay domain-focused |
| Q5 | 3 phases (plan/execute/verify) + Manus-extended plan.md | SDD baseline that's not bureaucratic for small tasks |
| Q6 | 6 task-typed specialists + 1 router | Sweet spot — covers 95% of work, not GSD's 25-agent sprawl |
| Q7 | Markdown files for docs, JSONL for state, projections derived | Human + machine readable, file-friendly + queryable |
| Q8 | 2-tier physical install + manifest visibility filter + zero-restart add | OMO `filter-available-skills` hook is the unlock |
| Q9 | Container Use opt-in atom + using-sandboxes skill | Outsource sandbox to Dagger, don't reinvent |
| Q10 | 11 first-party fusion skills + 22 vendored + 8 MCPs | Selective fusion, vendor-when-good-as-is policy |
| Q11 | **v0.1.0** release + MIT + double-track semver + no telemetry + Renovate vendor sync | Fresh OSS surface, dual-version honesty, zero infra |

---

## Detailed before/after

### Agents

| | v2 (current) | v3 (planned) |
|---|---|---|
| Count | 6 | 7 (1 router + 6 specialists) |
| Model | Lifecycle stages (planner → executor → reviewer) | Task-typed specialists (Explorer / Architect / Builder / Fixer / Reviewer / Tester) routed per-phase |
| Default agent | alloy-orchestrator | Orchestrator (same name, OMO-style smart router) |
| Verifier | alloy-verifier | Tester (rename, broader responsibilities) |
| Planner | alloy-planner | Architect (rename, sharpened — owns plan.md authoring) |
| Executor | alloy-executor | Builder + Fixer (split; bug-fixing has different cognitive shape than new-code) |
| Debugger | alloy-debugger | Merged into Fixer |
| Reviewer | alloy-reviewer | Reviewer (unchanged role) |
| Explorer | — (no equivalent) | NEW (delegated codebase reads via sub-agent dispatch) |

Net change: +1 agent (+Explorer, +Builder/Fixer split, -Debugger merged). Each agent has clearer single responsibility.

### Skills

#### First-party (we author, MIT)

| Skill | v2 | v3 | Note |
|---|---|---|---|
| alloy-using | — | **140 lines** | NEW bootstrap |
| alloy-brainstorm | 29 lines | **194 lines** | Absorbed SuperPower brainstorming + HARD-GATE + spec self-review |
| alloy-plan | — | **181 lines** | NEW (absorbed SuperPower writing-plans + GSD source coverage audit) |
| alloy-execute | — | **167 lines + 199 ref lines** | NEW (absorbed SuperPower executing-plans + subagent-driven + 3 reviewer/implementer prompt templates as references) |
| alloy-tdd | 60 lines | **333 lines + 194 ref lines** | Absorbed SuperPower TDD (full) + Matt Pocock vertical slicing + team-tdd legacy + 5 Matt Pocock deep-reference files |
| alloy-debug | 23 lines | **304 lines + 627 ref lines** | Absorbed SuperPower systematic-debugging + GSD framing + 3 SuperPower deep-reference files + 2 helper scripts |
| alloy-verify | — | **216 lines** | NEW (absorbed SuperPower verification-before-completion + 30% Alloy extension) |
| alloy-review | — | n/a (use SuperPower vendor) | Decided to vendor `requesting-code-review` instead of writing first-party |
| alloy-respond-review | — | n/a (use SuperPower vendor) | Same — `receiving-code-review` vendored |
| alloy-ship | — | n/a (use SuperPower vendor) | Same — `finishing-a-development-branch` vendored |
| alloy-discuss | — | **205 lines** | NEW (absorbed GSD discuss-phase concept, fully rewritten — no GSD runtime) |
| alloy-map-codebase | — | **226 lines** | NEW (absorbed GSD codebase mapper concept, 3-artifact pattern, fully rewritten) |
| alloy-autopilot | — | **215 lines** | NEW (absorbed axledbetter/claude-autopilot pattern + Alloy 4-status-codes integration) |
| alloy-qa | — | **376 lines** | NEW (absorbed gstack qa methodology, stripped gstack runtime, uses playwright) |
| humanizer | kept | **kept** | Existing 437 lines (English AI-writing remover) |
| git-master | kept | **kept (refactor planned)** | 1116 lines → split into 3 sub-references in v3 implementation |
| frontend-ui-ux | kept | **kept** | Existing 91 lines |
| playwright-cli | kept | **kept (fix dead links)** | 266 lines, references/* placeholders need filling |
| using-sandboxes | — | **planned ~100 lines** | NEW first-party (teaches Container Use 13 tools) — TBW |

#### Vendor — frontend scope

| Skill | v2 | v3 | Note |
|---|---|---|---|
| vercel-react-best-practices | vendored | **vendored (unchanged)** | Already in vendor.lock.json |
| next-best-practices | — | **NEW vendored** | Vercel official, Next App Router |
| next-cache-components | — | **NEW vendored** | Vercel official, Next 15+ caching |
| qa (gstack) | — | n/a | Concept absorbed into alloy-qa instead (gstack runtime can't be vendored) |
| harden | — | **NEW vendored as concept** | gstack-derived production-readiness — re-author or skip TBD |
| haacked/create-pr | — | **NEW vendored** | Humanizer rules applied to PR/commit generation |

#### Vendor — backend scope

| Skill | v2 | v3 | Note |
|---|---|---|---|
| kotlin-backend-jpa-entity-mapping | vendored | **vendored (unchanged)** | |
| sivalabs/spring-boot | — | **NEW vendored** | Sivaprasad Reddy, Spring Boot 4.x (concepts apply to SB3) |
| jooq-best-practices | — | **NEW vendored** | jvm-skills/jvm-skills, 102 stars, covers Kotlin + jOOQ 3.20 + PG |
| postgres router | vendored | **vendored (unchanged, fix pack triple-shipping)** | |

#### Vendor — infra scope

| Skill | v2 | v3 | Note |
|---|---|---|---|
| terraform-skill | vendored | **vendored (unchanged)** | |
| hashicorp/terraform-style-guide | — | **NEW vendored** | HashiCorp official |
| aws-agent-skills/ecs | — | **NEW vendored** | itsmostafa/aws-agent-skills, 1.1k stars |
| aws-agent-skills/lambda | — | **NEW vendored** | Same source |
| aws-agent-skills/{iam,secrets,cloudwatch,rds,s3} | — | **NEW vendored** | Cherry-pick from same source |

#### Vendor — universal scope

| Skill | v2 | v3 | Note |
|---|---|---|---|
| superpowers/brainstorming | vendored | **DELETED** | Absorbed into alloy-brainstorm |
| superpowers/systematic-debugging | vendored | **DELETED** | Absorbed into alloy-debug |
| superpowers/test-driven-development | vendored | **DELETED** | Absorbed into alloy-tdd |
| superpowers/using-git-worktrees | — | **NEW vendored** | Independent skill, no overlap |
| superpowers/finishing-a-development-branch | — | **NEW vendored** | Replaces planned alloy-ship |
| superpowers/requesting-code-review | — | **NEW vendored** | Replaces planned alloy-review |
| superpowers/receiving-code-review | — | **NEW vendored** | Replaces planned alloy-respond-review |
| mattpocock/grill-me | — | **NEW vendored** | Matt Pocock |
| mattpocock/grill-with-docs | — | **NEW vendored** | Matt Pocock |
| mattpocock/handoff | — | **NEW vendored** | Cross-session context handoff |
| mattpocock/caveman | — | **NEW vendored** | Optional 75% token reduction |
| mattpocock/zoom-out | — | **NEW vendored** | Context-recovery primitive |
| mattpocock/to-prd | — | **NEW vendored (optional)** | If team uses issue tracker |
| mattpocock/to-issues | — | **NEW vendored (optional)** | Same |
| mattpocock/improve-codebase-architecture | — | **NEW vendored** | Architecture deepening |
| plannotator-review | — | **NEW vendored** | Interactive plan annotation |
| plannotator-annotate | — | **NEW vendored** | Any markdown annotation |
| planning-with-files | — | **NEW vendored** | We dogfood this, ship to users |
| refactoring (claude-official) | — | **NEW vendored** | Master skill, lazy-loads sub-skills |
| de-AI-writing | — | **NEW vendored (CN)** | Chinese AI-writing detector + corrector |

**Vendor total: ~25 skills**, all permissive licenses, tracked in `vendor.lock.json` with sha256 + Renovate regex managers for automated update PRs.

#### Decided to SKIP (was on table, removed)

| Skill | Why skip |
|---|---|
| Matt Pocock `tdd` | Generic RGR, alloy-tdd already absorbed SuperPower TDD + Matt Pocock vertical slicing (the unique value) |
| Matt Pocock `diagnose` | Overlaps alloy-debug |
| Matt Pocock `git-guardrails` | cc-safety-net covers this with semantic analysis |
| Matt Pocock `prototype` | Container Use sandbox covers this scenario |
| Matt Pocock `setup-pre-commit` | Per-project infrastructure, not skill-shaped |
| Matt Pocock `write-a-skill` | alloy-using teaches this in-line |
| All gstack skills EXCEPT qa-concept | Hard-fail without gstack runtime |
| SuperPower `using-superpowers` | Replaced by alloy-using |
| SuperPower 4 補充 (writing-plans / executing-plans / verification-before-completion / using-git-worktrees) | First 3 absorbed into alloy-*, only using-git-worktrees vendored |

### MCPs

| | v2 | v3 |
|---|---|---|
| Universal | context7, grep_app, exa | context7, grep_app, exa, **chrome-devtools-mcp**, **sequential-thinking** |
| Frontend opt-in | — | **Figma MCP** (official), **priyankark/a11y-mcp** |
| Backend | — | (skill-only, no MCP — user decision) |
| Infra | — | (skill-only, no MCP — user decision) |
| Sandbox opt-in | — | **container-use** (Dagger MCP) |

User explicitly decided **no AWS/Terraform/Postgres MCP** — skills over MCPs for tech-stack expertise.

### Plugin (templates/opencode/alloy-plugin.ts)

| | v2 | v3 |
|---|---|---|
| Hooks used | 6 | 11+ |
| New hooks | — | `config` (boot mutation), `experimental.chat.messages.transform` (per-agent skill filter — the killer feature), `experimental.chat.system.transform` (cleaner status injection), `experimental.session.compacting` (ledger summary survives compaction), `command.execute.before` (`/add /spec /plan` slash command interception) |
| Dangerous command guard | inline `isDangerousCommand` regex (hardcoded) | **cc-safety-net** plugin (semantic AST, bash wrapper detection, 13 built-in rules + our 5 no-verify rules as `.safety-net.json` project overlay) |
| OMO Slim ports | none | `filter-available-skills` (manifest-driven visibility), `json-error-recovery`, `delegate-task-retry`, `phase-reminder` (TBW) |
| Memory | none | `opencode-working-memory` plugin (zero-config, no API key) |
| Tools | `alloy_evidence`, `alloy_claim`, `alloy_state`, `alloy_gate` | Same + new tools as needed |

### CLI (bin/alloy.mjs)

| | v2 | v3 |
|---|---|---|
| Subcommands | install, doctor, state, gate, sync | + `outdated`, `upgrade [--self]`, `add <skill>`, `remove <skill>`, `list`, `search` |
| Install model | Pack-based (5 packs) | 2-tier (global + repo) + manifest.json visibility filter + atoms underneath presets |
| Vendor versioning | sha256 in vendor.lock.json | Independent semver per vendor in vendor.lock.json + Renovate auto-PR on upstream releases |
| Update detection | none | Plugin checks GitHub releases, warns in chat (24h cache), `alloy outdated` shows table |
| State files | `.alloy/state/*.jsonl` | + `~/.config/alloy/state.json` (machine-level), `.opencode/alloy.manifest.json` (repo-level with visible/managed/explicit fields) |
| Search | none | `alloy search <q>` (internal + transparent passthrough to `npx skills find` external) |

### Distribution & onboarding

| | v2 | v3 |
|---|---|---|
| First install | `bash setup.sh --pack core` | `curl install.sh \| bash` (one-line, installs CLI + global tier + state.json + shell completion) |
| Per-repo install | `bash setup.sh --pack frontend --target local` | `alloy install` (smart: detects global state, repo scope, idempotent) |
| Skill addition mid-repo | edit packs/, rerun install | `alloy add <name>` (zero restart via filter-available-skills hook) |
| Updates | re-run setup.sh | `alloy outdated` + `alloy upgrade [name|--self|--all-vendors]` |

### Artifacts in target repo

| | v2 | v3 |
|---|---|---|
| `.alloy/state/` | tasks.jsonl, evidence.jsonl, runs.jsonl | Same (machine state) |
| `.alloy/projections/` | status.md, current-plan.md | Same (generated views) |
| `.alloy/specs/<id>/` | not used | task_plan.md (with `## Spec` + `## Plan` sections — Manus pattern), findings.md, progress.md, verification.md, optional context.md |
| `.alloy/codebase/` | not used | architecture.md, modules.md, boundaries.md (from alloy-map-codebase) |
| `.alloy/policies/` | claims.md, tdd.md, review.md, debug.md | Possibly consolidated into one `CONSTITUTION.md` (TBD) |
| `.alloy/local/` | not used | gitignored per-dev overlay (Cursor model) |
| `.alloy/qa-reports/<ts>/` | not used | report.md, issues.md, baseline.json, screenshots/ (from alloy-qa) |
| `.alloy/state/autopilot.jsonl` | not used | Autopilot ledger for resume |
| `.opencode/alloy.manifest.json` | not used | visible/managed/explicit fields for skill filtering |

### Documentation

| | v2 | v3 |
|---|---|---|
| CLAUDE.md | exists | Updated for new architecture |
| README.md | exists | Restructured: install, quick-start, skill catalog, advanced |
| INSTALL.md | exists | Updated for one-line curl + manifest model |
| CREDITS.md | none | **NEW** — central attribution document |
| CHANGELOG.md | none | **NEW** — Keep a Changelog format |
| docs/redesign/ | none | task_plan.md, findings.md, progress.md, config-overview.html, SUMMARY.md (this) |
| docs/ROADMAP.md | none | **NEW (planned)** — quarterly themes |
| SECURITY.md | none | **NEW (planned)** — disclosure process |

### Safety & licensing

| | v2 | v3 |
|---|---|---|
| Dangerous command guard | inline regex (orphan `safety-net-rules.json` not wired) | cc-safety-net plugin + our 5 no-verify rules as `.safety-net.json` project overlay |
| License | MIT (LICENSE file exists) | Confirmed MIT first-party; vendored each keeps upstream license |
| Telemetry | none | Explicitly none (diverges intentionally from gstack) |
| Attribution discipline | partial (some skills attributed) | Universal — every absorbed-concept skill has Attribution section + CREDITS.md is central reference |

---

## What user explicitly rejected during grill

These were ON THE TABLE and explicitly NOT done, per user decision:

- **#1 harness as primary goal** (Q1) — we get GSD's light-tech harness for free, but no OpenHands-style critic + stop_hook + StuckDetector
- **#4 token cost optimization as primary** (Q1) — caveman vendored as opt-in, but no Status Line / token meter bundling (just README recommendation)
- **Persistent memory beyond opencode-working-memory** (post-research) — claude-mem / Mem0 / mcp-memory-service rejected as RAG demoware; existing JSONL ledger + AGENTS.md / task_plan.md / git is enough
- **gstack runtime replication** — too heavy for one skill (qa); replicate concept-only in alloy-qa
- **alloy-jpa-jooq-coexistence first-party skill** — user said skip; agent can read code patterns
- **humanizer skill** — user originally said skip, then reversed after de-AI-writing research; keep both
- **frontend-ui-ux skill** — user later said skip (we use other design tools)
- **Anthropic skill registry CLI as primary distribution** — vercel-labs/skills CLI is for ad-hoc user additions, not Alloy's curated set
- **AWS/Terraform/Postgres MCPs** — user prefers skill-only for tech-stack expertise

---

## What's NOT done yet (implementation roadmap)

This document covers the **design phase**. Implementation phases are tracked in `task_plan.md` under "Implementation Phases" but summarized here:

| Phase | Scope | Status |
|---|---|---|
| P0 | Bug cleanup (workflow.json removed, dedup, dead links) | **DONE** ✓ |
| P1 | 2-tier source restructure (universal/ + scopes/), atoms.json + manifest design, `alloy install/add/remove/list/search` CLI, state.json writer, `alloy outdated/upgrade` | TBW |
| P2 | Rewrite 6 agents → 7 (split executor, rename verifier→Tester, add Explorer) | TBW |
| P3 | Implement 3 phase commands (`/plan /execute /verify`) with Manus artifact pattern | TBW |
| P4 | Port OMO `filter-available-skills` hook + other OMO hooks | TBW |
| P5 | Container Use opt-in atom + container-use prereq check in `alloy add` | TBW |
| P6 | Vendor cleanup: delete `vendor/skills/superpowers/{brainstorming,systematic-debugging,test-driven-development}` (already absorbed) | TBW |
| P7 | Add Renovate config + revendor.mjs for ~22 vendor entries | TBW |
| P8 | OSS infra: CHANGELOG, SECURITY.md, ROADMAP.md, license headers, contribution guide | TBW |
| P9 | Install helper: install.sh, plugin magic detection, `/add` OpenCode slash command | TBW |
| P10 | First-party skill content is DONE (Q10 ✓) — 11 fusion skills + 1020 lines deep-references vendored ✓ | **DONE** ✓ |
| P11 | cc-safety-net integration replacing inline regex | TBW |

**Total implementation work remaining**: ~7-10 days of focused coding + testing.

---

## How to verify this design

For a curious team member or OSS user evaluating Alloy v3:

1. **Read `task_plan.md`** for the decision log behind each Q
2. **Read `findings.md`** for the research evidence
3. **Read `config-overview.html`** in browser for visual overview
4. **Read this SUMMARY.md** for the before/after diff (you're here)
5. **Browse `skills/alloy-*/SKILL.md`** for the 11 fusion skills with full Attribution
6. **Browse `CREDITS.md`** for who-deserves-what credit
7. **Browse `vendor.lock.json`** for what's vendored

To re-run the grill or extend the design:
1. Read `progress.md` for the Q1-Q11 sequence
2. Use `grill-me` skill to re-stress-test any decision
3. Open a GitHub Discussion citing the Q being revisited

---

## The 3 hardest decisions in this redesign (post-mortem)

1. **"Fuse vs vendor" policy crystalized late.** Early conversations conflated absorbing concepts (e.g., alloy-tdd from SuperPower TDD) with vendoring intact skills (e.g., grill-me from Matt Pocock). The crystallization rule — "vendor when we don't need to modify, absorb when we add Alloy-specific hooks" — only emerged in Q10. Going forward, this rule prevents the "ship two slightly-different brainstorm skills" bug we accidentally had in v2 (alloy-brainstorm + vendored superpowers/brainstorming both fired).

2. **"Manifest-driven visibility" was the unlock for distribution UX.** Original plan was install-time `--without` flag (hack). Real solution was pre-install everything + runtime filter via OMO's `filter-available-skills` hook. This single decision (Q8) made `alloy add` zero-restart, kept `.opencode/skills/` self-contained, and let one install serve a polyrepo with different scopes per directory.

3. **gstack / GSD runtime non-portability.** Research (post-Q10) discovered that gstack's 60 bin scripts and GSD's `gsd-sdk` CLI hard-fail without their runtimes. We had assumed "just vendor the skill MD" works — it doesn't for those two. We pivoted to absorb-concept-only for both, which is more work but yields cleaner runtime independence. The "vendor-safe vs runtime-required" classification (in findings.md) is now part of every vendoring decision.

---

## Numerical recap

| Metric | v2 | v3 (designed) | Delta |
|---|---|---|---|
| First-party skills | 7 (some empty stubs) | 15 (11 fusion + 4 kept) | +8, ~2,500 lines of substantive content authored |
| Vendor skills | 9 (3 from SuperPower + 6 framework) | ~22 (3 SuperPower removed, 19 NEW vendor entries) | +13 net |
| MCPs | 3 universal | 5 universal + 2 frontend opt-in + 1 sandbox opt-in | +5 |
| OpenCode hooks used in plugin | 6 | 11+ | +5 (key: filter-available-skills) |
| CLI subcommands | 5 | 11 | +6 (outdated, upgrade, add, remove, list, search) |
| Deep references vendored | 0 | 1,020 lines across 13 sub-files | +1,020 |
| Distribution tiers | 1 (`.opencode/` only) | 2 (`~/.config/opencode/` + `.opencode/`) | +1 |
| Sandbox capability | none | container-use opt-in | +1 |
| Telemetry | none | none (explicit) | 0 |
| License complexity | partial attribution | central CREDITS.md + per-skill Attribution | +discipline |

---

## End of summary

For questions:
- **Design rationale** → `task_plan.md`
- **Research evidence** → `findings.md`
- **Visual catalog** → `config-overview.html`
- **Session history** → `progress.md`
- **Attribution** → `/CREDITS.md`
- **OSS governance** → `task_plan.md` Q11 section

For changes:
- Open an issue at `lifeodyssey/opencode-team-config` describing the Q being revisited
- Run `grill-me` skill to stress-test the proposed change
- Reference this SUMMARY.md section to confirm the proposed change doesn't silently violate a prior decision
