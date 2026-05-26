# Iteration v0.1.0 — Implementation Plan

> Coordinator (me) → Executor (codex via `codex exec`) → Reviewer (codex review + coderabbit) → Tester (claude in worktree)
>
> All work in isolated git worktrees under `.worktrees/`. Each card = 1 PR. Parallel within wave, serial across waves.
>
> **STATUS:** Awaiting user approval (plannotator review) before Phase 1 worktree setup.

## Iteration Config

```yaml
iteration: v0.1.0
spec_source: docs/redesign/{SUMMARY,task_plan,findings,progress}.md
executor_model: gpt-5.5 (via `codex exec`)
reviewer_model: gpt-5.5 (via `codex review`) + claude-opus-4-7 (via coderabbit)
tester_model: claude-opus-4-7 (via Claude Code subagent)
loop_mechanism: ralph-loop (max 5 iterations per card before escalating)
worktree_isolation: superpowers:using-git-worktrees
pinned_at: 2026-05-25
```

## Cards (10 total across 5 waves)

---

### Card 1: Vendor cleanup — delete absorbed SuperPower skills

- **Scope:** Remove vendored skills that have been absorbed into first-party alloy-*
- **Files changed:**
  - `vendor/skills/superpowers/5.1.0/brainstorming/` (delete)
  - `vendor/skills/superpowers/5.1.0/systematic-debugging/` (delete)
  - `vendor/skills/superpowers/5.1.0/test-driven-development/` (delete)
  - `vendor.lock.json` (remove the 3 entries)
  - `CREDITS.md` (verify attribution preserved)
- **AC:**
  - [ ] 3 vendor directories gone → `git status` clean → `find vendor/skills/superpowers -type d`
  - [ ] `vendor.lock.json` no longer references them → `npm test` (audit) passes
  - [ ] CREDITS.md still credits obra/superpowers for absorbed concepts
- **Dependencies:** None
- **Wave:** 1
- **Branch:** `iter1/vendor-cleanup-superpowers`
- **Review mode:** light (deletion + minor JSON edit)

---

### Card 2: cc-safety-net plugin integration

- **Scope:** Wire kenryu42/claude-code-safety-net as our dangerous-command guard, replacing inline `isDangerousCommand` regex
- **Files changed:**
  - `opencode.json` (add `plugin: ["cc-safety-net"]`)
  - `templates/opencode/safety-net-rules-template.json` (NEW, our 7 no-verify rules as project overlay)
  - `INSTALL.md` (note Node 18+ prereq, `npx cc-safety-net doctor` step)
  - `templates/opencode/alloy-plugin.ts` (remove `isDangerousCommand` — cc-safety-net handles it)
  - `safety-net-rules.json` (deprecate / move to template location)
- **AC:**
  - [ ] `cc-safety-net` listed in opencode.json plugins → manual verification via OpenCode launch
  - [ ] `.safety-net.json` template ships our 7 no-verify rules → `cat templates/opencode/safety-net-rules-template.json`
  - [ ] `isDangerousCommand` regex removed from alloy-plugin.ts
  - [ ] `npx cc-safety-net doctor` passes in installed target → manual test
- **Dependencies:** None
- **Wave:** 1
- **Branch:** `iter1/cc-safety-net-integration`
- **Review mode:** full (touches plugin)

---

### Card 4: 7 agents rewrite (Orchestrator + 6 specialists)

- **Scope:** Replace 6 lifecycle agents with 1 router + 6 task-typed specialists per Q6
- **Files changed:**
  - `agents/Orchestrator.md` (NEW — OMO-style smart router)
  - `agents/Explorer.md` (NEW — read codebase, return summaries)
  - `agents/Architect.md` (NEW — write `## Plan` section)
  - `agents/Builder.md` (NEW — new code via alloy-tdd)
  - `agents/Fixer.md` (NEW — debug + patch bugs)
  - `agents/Reviewer.md` (RENAME from alloy-reviewer.md, sharpen)
  - `agents/Tester.md` (RENAME from alloy-verifier.md, sharpen)
  - `agents/alloy-orchestrator.md` → delete (replaced by Orchestrator)
  - `agents/alloy-planner.md` → delete
  - `agents/alloy-executor.md` → delete
  - `agents/alloy-debugger.md` → delete
  - `agents/alloy-verifier.md` → delete
  - `bin/alloy.mjs` `ROLE_TO_AGENT` constant: update mapping to new names
  - `scripts/test_alloy_installer.py` update assertions
- **AC:**
  - [ ] 7 new agents exist with frontmatter (permission/mode/description) → `ls agents/`
  - [ ] Old agent files deleted → `git status` clean
  - [ ] Each new agent prompt aligns with its Specialist responsibility per Q6 design (Explorer reads, Architect plans, Builder builds, Fixer fixes, Reviewer reviews, Tester tests)
  - [ ] `npm test` passes → e2e installer creates new agents in target
  - [ ] No reference to `alloy-{orchestrator,planner,executor,debugger,verifier}` remains → `grep -r "alloy-orchestrator\|alloy-planner\|alloy-executor\|alloy-debugger\|alloy-verifier" --exclude-dir=docs --exclude-dir=vendor`
- **Dependencies:** None
- **Wave:** 1
- **Branch:** `iter1/agents-7-specialists`
- **Review mode:** full (agent prompts are load-bearing)

---

### Card 11: 3 phase commands (`/plan /execute /verify`)

- **Scope:** Add SDD-style phase slash commands that delegate to corresponding alloy-* skills
- **Files changed:**
  - `commands/plan.md` (NEW — invoke alloy-plan, write to `.alloy/plans/<id>/plan.md`)
  - `commands/execute.md` (NEW — invoke alloy-execute, dispatch per-task subagents, 4 status codes)
  - `commands/verify.md` (NEW — invoke alloy-verify, write verification.md)
  - `commands/plan.md` (NEW — invoke alloy-plan to write design context and implementation tasks)
  - `commands/discuss.md` (NEW — invoke alloy-discuss for context.md, optional pre-spec)
  - `commands/autopilot.md` (NEW — invoke alloy-autopilot, chain phases unattended)
  - Old commands: `commands/ultrawork.md`, `start-work.md`, `refactor.md`, `handoff.md`, `init-deep.md`, `stop-continuation.md`, `ulw-loop.md` — keep for backward compat but mark deprecated in header
- **AC:**
  - [ ] 6 new commands exist with frontmatter (description, agent)
  - [ ] Each command's body invokes the right alloy-* skill
  - [ ] Each command writes outputs to `.alloy/plans/<id>/` (per Q5 Manus pattern)
  - [ ] `bash setup.sh --pack core --target local` then `ls .opencode/commands/` shows new commands
- **Dependencies:** None
- **Wave:** 1
- **Branch:** `iter1/commands-sdd-pipeline`
- **Review mode:** full

---

### Card 14: Docs initialization (README + CHANGELOG + SECURITY + ROADMAP)

- **Scope:** OSS-ready documentation per Q11
- **Files changed:**
  - `README.md` (REWRITE — reflects v0.1.0 architecture: 7 agents, 15 first-party skills, 22 vendor skills, 8 MCPs, install.sh one-liner, 3-phase pipeline)
  - `CHANGELOG.md` (NEW — Keep a Changelog format, v0.1.0 as first entry, lists everything from the redesign)
  - `SECURITY.md` (NEW — 90-day disclosure, GitHub Security Advisories)
  - `docs/ROADMAP.md` (NEW — quarterly themes: Q3 2026 implementation, Q4 2026 dogfooding, Q1 2027 v1.0 prep)
- **AC:**
  - [ ] All 4 files exist, no TBDs
  - [ ] README has: install (curl one-liner), quick start, skill catalog link, contribution link
  - [ ] CHANGELOG v0.1.0 entry covers: Added (skills + commands + hooks + MCPs), Changed (agents 6→7), Removed (3 superpowers vendor)
  - [ ] SECURITY.md has disclosure email/process
  - [ ] ROADMAP.md has quarterly themes, no commit-detail
- **Dependencies:** None
- **Wave:** 1
- **Branch:** `iter1/docs-init`
- **Review mode:** light (doc-only, no behavior change)

---

### Card 15: Renovate config + revendor.mjs

- **Scope:** Automated vendor update tracking
- **Files changed:**
  - `renovate.json` (NEW — regex managers for vendor.lock.json + dependabot for plugin's Bun deps)
  - `scripts/revendor.mjs` (NEW — borrows vercel-labs/skills `git.ts` clone algorithm)
  - `vendor.lock.json` (add `renovate` field per entry: github-releases / github-tags)
  - `.github/workflows/revendor-check.yml` (NEW — weekly cron: `node scripts/revendor.mjs --check-all`)
- **AC:**
  - [ ] `node scripts/revendor.mjs --help` works
  - [ ] `node scripts/revendor.mjs --check vercel-labs/agent-skills` returns "latest=X, ours=Y"
  - [ ] `node scripts/revendor.mjs --apply <name>` re-pulls + re-hashes + applies `vendor/patches/<name>/*.patch` if present
  - [ ] renovate.json passes `renovate-config-validator`
- **Dependencies:** None
- **Wave:** 1
- **Branch:** `iter1/renovate-revendor`
- **Review mode:** full

---

### Card 3 (merged 3+5): defaults.json + atoms.json + scope restructure + CLI baseline updates

- **Scope:** Reorganize source layout from `packs/` to `universal/` + `scopes/{frontend,backend,infra}/`; add atoms.json; expand defaults.json with new MCPs; update bin/alloy.mjs to read new layout
- **Files changed:**
  - `defaults.json` (add 5 new MCP entries: chrome-devtools / sequential-thinking / figma-official / a11y-mcp; container-use stays opt-in)
  - `packs/atoms.json` (NEW — atomic skill/agent/command/mcp groupings)
  - `packs/{core,frontend,backend,infra,all}.json` (REFACTOR — become `{ extends: [...atoms] }`)
  - New: `universal/skills/*` (move all universal-tier skills here)
  - New: `scopes/frontend/skills/*` (move frontend-only skills)
  - New: `scopes/backend/skills/*`
  - New: `scopes/infra/skills/*`
  - `bin/alloy.mjs` (refactor `resolveConfig` to walk universal/ + scopes/<type>/ instead of packs/*.json directly)
  - `scripts/test_alloy_installer.py` (update path assertions)
- **AC:**
  - [ ] New scope dirs exist with skill content moved
  - [ ] Old `packs/*.json` still load (backward compat via `extends`)
  - [ ] `bash setup.sh --pack frontend --target local --models github-copilot` works end-to-end
  - [ ] `defaults.json` has all 5 new MCP entries
  - [ ] `npm test` all 19 unit + 13 e2e pass
- **Dependencies:** None (but conflicts with Cards 6 and 7 on bin/alloy.mjs, hence serial)
- **Wave:** 2
- **Branch:** `iter1/atoms-scopes-restructure`
- **Review mode:** full (large refactor, high regression risk)

---

### Card 6+7+12 (merged): manifest + alloy install/add/remove/list/search + state.json + outdated/upgrade + container-use prereq

- **Scope:** The complete CLI v3 surface — manifest-driven visibility, two state files, all new commands
- **Files changed:**
  - `bin/alloy.mjs` (large rewrite of install command + new subcommands: add, remove, list, search, outdated, upgrade)
  - New helpers: `manifest.mjs`, `state.mjs`, `prereq-check.mjs` (or inline if <100 LOC each)
  - `scripts/test_alloy_installer.py` (add ~10 new test cases)
  - `scripts/test_resolver.mjs` (add Node tests for manifest ops)
- **AC:**
  - [ ] `alloy install` writes `.opencode/alloy.manifest.json` with visible/managed/explicit fields
  - [ ] `alloy install` writes `~/.config/alloy/state.json` on global tier
  - [ ] `alloy add <skill>` updates manifest.visible + writes to alloy.manifest.json
  - [ ] `alloy remove <skill>` updates manifest, adds to excluded
  - [ ] `alloy list` shows installed + visible
  - [ ] `alloy list --installed` works
  - [ ] `alloy search react` shows internal + transparent passthrough to `npx skills find` (if installed)
  - [ ] `alloy outdated` queries GitHub releases per vendor.lock.json entry, returns table
  - [ ] `alloy upgrade vercel-react` re-pulls one vendor
  - [ ] `alloy upgrade --self` upgrades CLI via curl install.sh
  - [ ] `alloy upgrade --all-vendors` upgrades all out-of-date vendors
  - [ ] `alloy add container-use` checks prereqs (docker/colima/podman + container-use binary), prints install command if missing
  - [ ] All new tests pass + existing tests don't regress
- **Dependencies:** Card 3 (atoms structure must exist)
- **Wave:** 3
- **Branch:** `iter1/cli-manifest-add-state-outdated`
- **Review mode:** full (big, load-bearing)

---

### Card 8+9+10 (merged): alloy-plugin.ts complete rewrite — 11 hooks

- **Scope:** Plugin file goes from 186 lines to ~500 lines with all OpenCode hooks we want
- **Files changed:**
  - `templates/opencode/alloy-plugin.ts` (large rewrite)
- **AC:**
  - [ ] All 6 existing hooks still work: `shell.env`, `chat.message`, `permission.ask`, `tool.execute.before`, `tool.execute.after`, `event`
  - [ ] NEW: `config` — boot-time MCP/agent defaults injection
  - [ ] NEW: `experimental.chat.messages.transform` — `filter-available-skills` port from OMO. Reads `alloy.manifest.json` and filters `<available_skills>` block per agent + manifest.visible
  - [ ] NEW: `experimental.chat.system.transform` — inject `.alloy/projections/status.md` cleaner than chat.message text part
  - [ ] NEW: `experimental.session.compacting` — inject ledger summary so memory survives compaction
  - [ ] NEW: `command.execute.before` — intercept `/add`, `/plan`, `/plan`, `/execute`, `/verify`, `/autopilot` slash commands; for `/add` invoke alloy via Bash tool
  - [ ] NEW: `tool.definition` (optional) — rewrite bash/write descriptions to remind about gates
  - [ ] Magic detection: on `config` hook, check state.json + manifest staleness, surface warnings via chat.message
  - [ ] Port OMO `json-error-recovery` (~40 lines, pure string ops)
  - [ ] Port OMO `delegate-task-retry` (~50 lines, pure string match)
  - [ ] Port OMO `phase-reminder` (~50 lines, pure message mutation)
  - [ ] Plugin loads without error in OpenCode 1.15.10
  - [ ] All 4 existing tools work (alloy_evidence/claim/state/gate)
- **Dependencies:** Card 3 (atoms restructure) — plugin reads manifest from new locations. Card 6 (manifest model) — must exist.
- **Wave:** 4
- **Branch:** `iter1/plugin-11-hooks-omo-ports`
- **Review mode:** full (plugin is the runtime; bugs here are silent + bad)

---

### Card 16: ralph-loop integration (NEW, per user 2026-05-25)

- **Scope:** Ship `ralph-loop` as part of Alloy's curated set. Two purposes:
  - **Internal (already in use this iteration)**: bounded retry loop in executor↔reviewer↔tester per-card flow
  - **External (user-facing skill)**: `/ralph-loop` slash command for users to start recurring/looped work in their own sessions
- **Files changed:**
  - `vendor.lock.json` (add entry: ralph-loop @ claude-plugins-official, MIT)
  - `vendor/skills/external/ralph-loop/` (NEW, vendor SKILL.md + cancel-ralph + help)
  - `packs/atoms.json` (add `ralph-loop` atom to universal scope)
  - `templates/opencode/alloy-plugin.ts` (add iteration counter helper that ralph-loop reads from `.alloy/state/iteration.jsonl`)
  - `CREDITS.md` (add attribution)
  - `commands/ralph-loop.md` (NEW — alloy slash command that delegates to ralph-loop skill)
- **AC:**
  - [ ] `alloy install` ships ralph-loop into target `.opencode/skills/ralph-loop/`
  - [ ] `/ralph-loop` slash command starts the loop in OpenCode session
  - [ ] `/cancel-ralph` works
  - [ ] `.alloy/state/iteration.jsonl` records loop iterations for `alloy gate check` integration
  - [ ] `alloy-execute` skill's retry loop documented as using ralph-loop pattern (link in SKILL.md)
  - [ ] CREDITS.md attributes to anthropics/claude-plugins-official (MIT)
- **Dependencies:** Card 6+7+12 (vendor.lock.json schema), Card 8+9+10 (plugin extends iteration counter)
- **Wave:** 4 (alongside plugin rewrite, since both touch plugin file)
- **Branch:** `iter1/ralph-loop-integration`
- **Review mode:** full

---

### Card 13: install.sh one-line onboarding

- **Scope:** `curl install.sh | bash` does all of: install CLI binary, run `alloy install --target global`, write state.json, install shell completion
- **Files changed:**
  - `install.sh` (NEW — bash script, ~150 lines)
  - `bin/alloy.mjs` (add `alloy completion bash|zsh|fish` subcommand for completion)
  - `setup.sh` (deprecate — keep as backward-compat shim that calls alloy install)
  - `INSTALL.md` (rewrite for curl one-liner)
- **AC:**
  - [ ] `curl install.sh | bash` on clean macOS works: alloy CLI on PATH, ~/.config/opencode/ populated, ~/.config/alloy/state.json written
  - [ ] Same on Ubuntu 22.04 in container
  - [ ] Shell completion installs for bash + zsh (fish best effort)
  - [ ] `setup.sh --pack core --target local` still works (backward compat)
  - [ ] INSTALL.md has the one-liner + per-shell completion command + troubleshooting
- **Dependencies:** Card 6+7+12 (CLI v3 must exist)
- **Wave:** 5
- **Branch:** `iter1/install-sh-onboarding`
- **Review mode:** full (security-sensitive: bash curl piped install)

---

## Wave Graph

```
Wave 1 (parallel — 6 cards, no file overlap):
  ├─ Card 1   (vendor cleanup)         [Light]
  ├─ Card 2   (cc-safety-net)          [Full]
  ├─ Card 4   (7 agents rewrite)       [Full]
  ├─ Card 11  (6 phase/SDD commands)   [Full]
  ├─ Card 14  (docs init)              [Light]
  └─ Card 15  (Renovate + revendor)    [Full]

──── all Wave 1 merged ────

Wave 2 (1 card — bin/alloy.mjs + defaults.json conflicts force serial):
  └─ Card 3   (atoms + scopes restructure + CLI baseline) [Full]

──── merged ────

Wave 3 (1 card — bin/alloy.mjs conflict):
  └─ Card 6+7+12 (CLI v3 surface: manifest + add/remove/list/search + state + outdated/upgrade + container-use prereq) [Full]

──── merged ────

Wave 4 (2 cards — plugin work + ralph-loop):
  ├─ Card 8+9+10 (plugin 11 hooks + OMO ports) [Full]
  └─ Card 16    (ralph-loop integration)       [Full]
  (Card 16 depends on Card 8+9+10 finishing the plugin first → serialize within wave: 8+9+10 then 16)

──── merged ────

Wave 5 (1 card):
  └─ Card 13  (install.sh + completion + INSTALL.md) [Full]

──── DONE — tag v0.1.0 ────
```

## Estimated Throughput

| Wave | Cards | Parallel? | Estimate (codex-paced) |
|---|---|---|---|
| 1 | 6 | Yes (all 6 in parallel) | ~2–3 hours (longest card dictates) |
| 2 | 1 | n/a | ~1.5 hours (refactor + tests) |
| 3 | 1 | n/a | ~3 hours (big CLI surface + tests) |
| 4 | 2 (serial: plugin first, ralph-loop after) | n/a | ~3.5 hours (plugin + OMO ports + ralph-loop) |
| 5 | 1 | n/a | ~1 hour |
| **Total** | **11** | | **~11–13 hours** of focused codex time |

Plus per-card Reviewer + Tester loop (~30 min each in full mode, less for light). So **~15–18 hours total wall clock** if dispatched well.

## Per-Card Workflow (executor → reviewer → tester)

Each Full-mode card flows through:

```
1. Coordinator (me) creates worktree:
   git worktree add .worktrees/<card-name> -b iter1/<card-name> main

2. Executor (codex via codex exec):
   - Read card content + AC
   - Follow TDD if code: write failing test → minimal code → green → refactor
   - Run `npm test` + targeted lints before commit
   - Atomic commit per RGR cycle (or per logical chunk for non-code cards)
   - git push + gh pr create

3. CI gates on PR

4. Reviewer (codex review + coderabbit):
   - Read PR diff
   - Run coderabbit code-review
   - Check Quality Ratchet (each AC has matching test in diff)
   - Verdict: approve / request_changes
   - If request_changes: ralph-loop dispatches Executor again with findings JSON (max 5)

5. Tester (claude in worktree):
   - cd .worktrees/<card-name>
   - Start app if applicable, run integration tests
   - Browser test browser-touching AC (if any)
   - Generate edge cases beyond AC
   - Post evidence as PR comment
   - Verdict: approve / request_changes
   - If request_changes: minor → ralph-loop Executor; complex → escalate

6. Coordinator merges:
   gh pr merge <pr> --squash
   Wait for main CI green
   Pull main, rebase remaining worktrees in this wave

7. After all in wave merged: advance to next wave
```

For Light-mode cards (1, 14): skip steps 4–5, just CI → coordinator merges.

## Ralph-Loop Integration

Within Step 4–5 of each card, the executor↔reviewer↔tester loop is bounded by max 5 iterations. Ralph-loop drives the retry mechanism:

- Iteration counter per card in `.alloy/state/iteration.jsonl`
- On request_changes: ralph-loop dispatches Executor with findings
- On 5th retry without approval: ralph-loop escalates to user via plannotator inline ("Card N stuck after 5 iterations — read findings, decide skip / fix manually / abandon")

## Risk Register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Card 4 (agents rewrite) breaks existing user workflows | Medium | Keep old agent files as deprecated, log "old name X used; use new name Y" warning in plugin |
| Card 3 (scope restructure) breaks test_alloy_installer | High | Update tests in same PR, add backward-compat for old `packs/` lookups |
| Card 6+7+12 too large, hard to review | Medium | Split into Sub-PRs if codex generates >800 LOC change |
| Card 8+9+10 plugin rewrite breaks OpenCode runtime | High | Test in `.worktrees/test-opencode-launch/` worktree before merge |
| Card 13 install.sh on Windows fails | Low | Document Windows uses WSL/MSYS2 (out of MVP scope) |
| GitHub releases API rate limit during Card 15 / Card 6+7+12 | Low | Cache results, use GITHUB_TOKEN for higher limits |

## Approval Gate (STOP HERE)

**Coordinator stops Phase 0 now. Awaiting user approval before Phase 1 (worktree setup + Executor dispatch).**

Options for user:
1. **Approve as-is** → proceed to Wave 1 dispatch
2. **Approve with edits** → list changes (e.g., "merge Card 14 with Card 1", "make Card 4 split into 2 cards by agent count")
3. **Reject + redo** → provide direction
4. **Annotate via plannotator** → open this file in plannotator UI for inline comments

After approval, Coordinator will:
1. Create Wave 1 worktrees (6 parallel)
2. Dispatch 6 Executors (codex exec) in ONE message
3. Watch for status returns
4. Per-card Reviewer + Tester loops
5. Sequential merges within wave
6. Advance to Wave 2
