# Changelog

## [0.1.2] - 2026-05-27

### Architecture & Vision (Task 1+2)
- Added 6 design beliefs to CLAUDE.md (最强约束 / plugin-first / 不替用户做选择 / vendor over rewrite / 状态外置但极简 / 零依赖运行时)
- Added "What Alloy is NOT" section (not chat UI / not agent / not SaaS / not framework)
- README repositioned: "The harness that lets one person run an AI agent team — with zero compromise on control"

### Phase Pipeline (Task 6)
- **BREAKING**: spec phase merged into plan phase
- `pending → spec → plan → execute → verify → done` (6 phases) → `pending → plan → execute → verify → done` (5 phases)
- `commands/spec.md` deleted; `/spec` now redirects/aliases to `/plan` if encountered in legacy code
- `commands/plan.md` rewritten to combine brainstorm + plan workflow
- `packs/atoms.json` `alloy-sdd-commands` atom: removed "spec" from commands array
- `templates/opencode/alloy-plugin.ts` COMMAND_SKILLS: removed `spec: alloy-plan` entry
- `.alloy/specs/` directory renamed to `.alloy/plans/`; `bin/alloy.mjs installCommand` auto-migrates on install
- `universal/skills/alloy-brainstorm/` deleted; content merged into `universal/skills/alloy-plan/SKILL.md`
- 7 agents/*.md: `/spec` → `/plan`, `alloy-brainstorm` → `alloy-plan` references updated
- `docs/alloy-overview.html` SDD pipeline diagram updated

### Phase Pipeline Documentation (Task 8)
- Added "## Phase Pipeline" section to all 7 v3 specialist agent .md files (Orchestrator/Explorer/Architect/Builder/Fixer/Reviewer/Tester)
- Documents 5-phase pipeline (plan/execute/verify/done) + required tool usage + capability isolation (v0.1.4+ enforcement noted)

### Skill restructure (Task 7)
- `alloy-tdd` SKILL.md grew 348 → ~1300 lines: inline 4 sources verbatim (per "字数 only more not less" + "能用原文就用原文" principle)
  - Section 1-2: obra/superpowers v5.1.0 test-driven-development (Iron Law + anti-rationalization)
  - Section 3-7: mattpocock/skills/engineering/tdd 5 references (tests/mocking/deep-modules/interface-design/refactoring)
  - Section 8: alloy team-tdd legacy (98 lines, recovered from git commit 60a9207) — code constraints + Stack Companions routing
  - Section 9: alloy v3 fusion + evidence ledger integration
- `alloy-qa` SKILL.md: rewritten and expanded to ~500 lines (NOT inline gstack — gstack runtime too heavy)
  - Kept: 11-phase workflow / 8-category rubric / WTF-likelihood / Phase 8e.5 regression discipline
  - Stripped: gstack-* binaries / $B browse / ~/.gstack/ / preamble / learnings / telemetry
  - Added: alloy_evidence integration / playwright-cli abstraction / .alloy/qa-reports/ paths / --report-only flag
  - Attribution: "inspired by gstack /qa, rewritten for alloy-portable"
- 9 other alloy-* skills: case-by-case (inline upstream where available + Attribution section)

### Multi-agent runtime orchestration (Task 9)
- NEW: `packs/presets.json` — 4 presets (default / plan-mode / execute-mode / review-mode)
- NEW: `alloy_switch_preset(name)` plugin tool — hot-swap preset without restarting session
- `templates/opencode/alloy-plugin.ts` grew ~150 LOC for preset state + filterByPreset + pre-load on boot
- `bin/alloy.mjs` `writePresets()` writes `.opencode/presets.json` on install
- Inspired by `alvinunreal/oh-my-opencode-slim` runtime preset tracking

### Vendor additions (Task 3+4+5)
- **Task 3**: Vendored `mattpocock/skills/productivity/handoff` (MIT) → `vendor/skills/external/mattpocock/<v>/handoff/`
  - New atom `mattpocock-handoff` added to packs/atoms.json
  - Added to core/frontend/backend/infra/all pack extends
  - Use case: cross-session conversation handoff (compact to /tmp + suggested skills)
- **Task 4**: NEW `packs/dcp.json` — OpenCode Dynamic Context Pruning as opt-in pack
  - Plugin: `@tarquinen/opencode-dcp`
  - Trade-off: 50-70% token saving BUT breaks prompt cache (use carefully)
- **Task 5**: NEW `core-infrastructure` atom (in atoms.json) pre-installs CodeGraph + RTK
  - CodeGraph: AST 索引 (zhenjia article Step 2 减少无效探索 推荐)
  - RTK: CLI 输出压缩 (zhenjia article Step 3 预防上下文膨胀 推荐)

### Documentation (Task 10)
- `docs/redesign/PLAN-v0.1.2-and-beyond.md` — full v0.1.2 implementation plan (752 insertions)
  - 3 rounds of plannotator review
  - Includes TDD 4-way comparison table (superpowers/mattpocock/team-tdd/alloy-tdd)
  - Includes gstack /qa real implementation deep-dive

### Versioning policy decision
- v0.2/v0.3 major version bumps **canceled** for this iteration
- All originally-planned v0.2 content folded into v0.1.x series (per plannotator round 1 feedback "这些都算 1.2")

### Migration notes for users upgrading from v0.1.1

1. `/spec` command no longer exists. Use `/plan` for the full brainstorm + plan workflow.
2. `.alloy/specs/` directory will be auto-renamed to `.alloy/plans/` on next `alloy install`.
3. `alloy-brainstorm` skill replaced by extended `alloy-plan` skill.
4. New preset system: try `alloy_switch_preset("plan-mode")` in chat for focused planning context.

---

All notable changes to Alloy will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows semantic versioning for the Alloy CLI separately from
vendored skill versions.

## [Unreleased]

### Changed

- Renamed the repository from `opencode-team-config` to `alloy`, with
  `opencode-alloy` used only as an interim migration name.
- Repositioned Alloy as a multi-runtime adapter: v0.1.x supports OpenCode,
  v0.2 plans Claude Code, and v0.3 plans Codex CLI.
- Updated repository URLs, install helper URLs, security links, and self-upgrade
  defaults to `lifeodyssey/alloy`.

### Notes

- The npm package name is `@lifeodyssey/alloy` because the unscoped `alloy`
  package name is already taken on npm.

## [0.1.0] - 2026-05-25

### Added

- Reset the public release line to `v0.1.0` for the first OSS-ready architecture,
  replacing the older v2 numbering.
- Added the 3-phase central pipeline: Plan → Execute → Verify.
- Added the 7-agent target model: 1 router plus 6 specialists.
- Added manifest-driven skill visibility for repo-scoped installs.
- Added the 2-tier install model: global OpenCode tier plus repo-local Alloy
  tier.
- Added JSONL-backed state and Markdown projections for specs, findings,
  progress, verification, evidence, claims, and runs.
- Added the first-party fusion skill set:
  - `alloy-using`
  - `alloy-brainstorm`
  - `alloy-plan`
  - `alloy-execute`
  - `alloy-tdd`
  - `alloy-debug`
  - `alloy-verify`
  - `alloy-discuss`
  - `alloy-map-codebase`
  - `alloy-autopilot`
  - `alloy-qa`
- Added the first-party kept skill set:
  - `humanizer`
  - `git-master`
  - `frontend-ui-ux`
  - `playwright-cli`
- Added the target vendor-skill direction: 22+ vendored skills with independent
  versions, upstream licenses, SHA tracking, and future Renovate PRs.
- Added the target MCP architecture: 8 MCP entries across universal, frontend
  opt-in, and sandbox opt-in tiers.
- Added planned CLI surface for `outdated`, `upgrade`, `add`, `remove`, `list`,
  and `search` in addition to the existing installer/state/gate/doctor/sync
  commands.
- Added the OpenCode plugin hook direction: 11+ hooks, including manifest skill
  filtering, compaction ledger summaries, command interception, and status
  injection.
- Added Container Use as an opt-in sandbox atom rather than a default runtime
  dependency.
- Added `cc-safety-net` as the planned dangerous-command interception layer.
- Added OSS governance decisions from Q11:
  - release as `v0.1.0`
  - keep first-party Alloy content under MIT
  - keep vendored content under upstream licenses
  - use double-track semver for Alloy CLI and vendor skills
  - ship with no telemetry
  - use Renovate for future vendor synchronization

### Changed

- Changed from 6 lifecycle agents to 7 total agents: Orchestrator, Explorer,
  Architect, Builder, Fixer, Reviewer, and Tester.
- Changed planning from free-form prompts to the Plan → Execute → Verify pipeline.
- Changed the install model from pack-first local copying to the v0.1.0
  two-tier model with manifest-controlled repo visibility.
- Changed vendor management from a single Alloy version assumption to independent
  vendor semver tracked in `vendor.lock.json`.
- Changed the architecture language from "v3 redesign" to the public `v0.1.0`
  release line.

### Removed

- Removed the old public v2 version line in favor of the `v0.1.0` OSS reset.
- Removed the need to keep vendored SuperPower skills that were absorbed into
  first-party Alloy fusion skills:
  - `superpowers/brainstorming`
  - `superpowers/systematic-debugging`
  - `superpowers/test-driven-development`
- Removed GSD and OMO runtime replication from the public architecture; Alloy
  absorbs selected ideas without shipping those runtimes.
- Removed backend and infra MCPs from the default target architecture; the
  redesign keeps those domains skill-first unless users opt in separately.

### Vendor Updates

- None yet.
- Future vendor synchronization is planned through Renovate-managed update PRs.

### Notes

- This version reset is intentional. The historical v2 line described an
  earlier internal distribution model; `v0.1.0` is the first OSS-ready baseline.
- The design sources for this release are `docs/redesign/SUMMARY.md` and
  `docs/redesign/config-overview.html`.
