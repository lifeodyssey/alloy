# Alloy v3 Redesign — Progress

> Session log. Q1-Q11 checklist + decisions audit trail.

## Q-checklist

- [x] **Q1**: Highest goal — **2+3+5** (distribution + workflow standardization + OSS reference)
- [x] **Q2**: Audience — **D** (dogfood + OSS double-track)
- [x] **Q3**: Workflow stance — **OMO-style tiered routing** (router is mandated; what gets routed is opinion)
- [x] **Q4**: Phases × specialists combo — **B** (central pipeline, each phase dispatches specialists)
- [x] **Q5**: Phase count + artifact shape — **X** (3 phases: plan/execute/verify; plan artifact follows Manus pattern with design, acceptance criteria, and Plan tasks enforced)
- [x] **Q6**: Specialist catalog — **6 task-typed + 1 router** (Explorer / Architect / Builder / Fixer / Reviewer / Tester + Orchestrator)
- [x] **Q7**: Artifact storage — **Option 3** (Markdown for human-readable docs in `.alloy/plans/<id>/`; JSONL for machine state in `.alloy/state/`; generated projections in `.alloy/projections/`)
- [x] **Q8**: Distribution model — **2-tier physical install + manifest-driven visibility filter** (pre-install all, filter at runtime via OMO hook; `alloy install`/`add`/`remove`/`list`; state.json + manifest as truth; M3 magic warns not auto-installs; `/add` slash command zero-restart)
- [x] **Q9**: Sandbox — **Container Use opt-in atom + `using-sandboxes` educational skill**, prereq-checked (Docker/OrbStack/colima/Podman + container-use binary). microsandbox/Firecracker moved to future roadmap.
- [ ] **Q10**: First-party vs vendor split — which skills we author, which we vendor + update sync
- [x] **Q11**: OSS governance — MIT first-party / upstream license vendored / double-track semver (CLI vs vendor independent) / KeepAChangelog / contribution flow / no telemetry / public roadmap in Issues+Discussions+ROADMAP.md / v1.0 prerequisites checklist

## Q10 最终拆分（用户决定 2026-05-25）

### VENDOR (22 个，原版好，跟上游)
- Matt Pocock: grill-me, grill-with-docs, handoff, caveman, zoom-out, to-prd, to-issues, improve-codebase-architecture
- plannotator-review, plannotator-annotate, planning-with-files, refactoring
- using-git-worktrees, finishing-a-development-branch, requesting-code-review, receiving-code-review (SuperPower)
- qa (gstack)
- vercel-react, next-best-practices, next-cache-components, kotlin-jpa, sivalabs-spring, jooq-best-practices, postgres router, terraform, terraform-style-guide, aws-ecs, aws-lambda
- harden (gstack, frontend scope) — NEW per user

### FUSE 自己写 10 个
1. alloy-using (bootstrap)
2. alloy-tdd (3-way: SuperPower + Matt Pocock + team-tdd legacy)
3. alloy-debug (SuperPower + GSD framing + 3-fix gate)
4. alloy-plan (SuperPower + alloy spec output)
5. alloy-plan (SuperPower writing-plans + alloy plan.md format)
6. alloy-execute (SuperPower executing-plans + alloy evidence)
7. alloy-verify (SuperPower verification + alloy gate)
8. alloy-discuss (GSD + alloy artifact)
9. alloy-map-codebase (GSD + alloy state)
10. alloy-autopilot (axledbetter + alloy 3-phase)

### 跳过
- humanizer (用户 skip per 2026-05-25)
- frontend-ui-ux (用户 skip)
- alloy-jpa-jooq-coexistence (用户 skip)
- using-sandboxes (用户怀疑——见研究结果再定)

### 保留现状
- playwright-cli (frontend scope，先修死链)
- git-master (refactor 拆 3 reference)

### Plugin 设计
- 用 cc-safety-net (kenryu42) 替代自写危险命令拦截
- 我们 7 条 no-verify 规则作为 .safety-net.json 项目级补充

### MCPs
- context7, grep_app, exa, chrome-devtools, sequential-thinking
- Figma 官方 (opt-in)
- container-use MCP (opt-in via alloy add)
- 不装 AWS / Terraform / PG MCP (用 skill 不用 MCP)

### 用户决定的工作流
- 方案 3 outline first 改为：直接写完所有 fusion skill，提供 review
- 后续每个 batch 给 review summary（行数/字数/抄/新增比例）

## Session log

### 2026-05-24 (this session, in progress)

**Round 1 — initial grilling**
- Set up grill-me to systematize decisions
- User picked goals 2+3+5; explicitly rejected 1 (harness build) and 4 (cost optimization) as primary
- User picked audience D (dogfood + OSS)
- User clarified OMO tiered routing is the appeal

**Round 2 — phase/specialist architecture**
- Settled B model: central phases + specialists as workers
- Settled 3-phase pipeline with merged plan.md
- Settled 6 task-typed specialists + 1 router

**Round 3 — corrections and refinements**
- User corrected my misread: GSD's harness IS valuable, just low-tech (we want that, not OpenHands-style)
- User extended Q7 with Manus three-file pattern (task_plan/findings/progress per spec)
- Switched to planning-with-files skill for tracking this design

**Round 4** — initial planning files created

**Round 6 — Q9 sandbox**
- Almost skipped Q9 ("not in our scope #2/#3/#5") then user pushed back: sandbox is intellectually interesting + #5 differentiator
- Compared Container Use vs microsandbox vs git worktree as 3 sandbox layers
- User chose: Container Use only (microsandbox → roadmap), keep it simple
- Final: ship as opt-in atom with prereq detection; for company users, README recommends OrbStack/colima/Podman over Docker Desktop (commercial license)

**Round 5 — Q8 distribution model**
- User pushed back hard on my over-engineered 3-tier proposal — clarified actual model is 1 central source + N target repos
- Identified the real UX problem: 2-tier install means dev installs twice
- Solved with: `alloy install` is idempotent + smart (single command does what's needed)
- User suggested `npx skills add`-style single-skill UX → designed `alloy add/remove/list/search`
- Then asked about in-OpenCode trigger → discovered the killer combo:
  - Pre-install ALL skills physically (cheap, ~1-2MB)
  - Manifest-driven visibility filter via OMO `filter-available-skills` hook
  - `/add` slash command runs alloy via Bash tool, plugin updates in-memory manifest
  - **Zero restart needed** — next message, agent sees new skill

### Next session checkpoints

When resuming:
1. **First read `HANDOFF.md`** — full resume state from 2026-05-26 handoff
2. Read `plan.md` for current state of decisions
3. Read `findings.md` for research basis
4. Read `iteration-v0.1.0-plan.md` for Wave 1-5 implementation plan
5. Continue per HANDOFF.md "Resume plan" section

## Files created/modified this session

- `docs/redesign/plan.md` — Goal + Q1-Q7 decisions + Q8-Q11 open + planned implementation phases
- `docs/redesign/findings.md` — 16 consolidated findings from 14+ sub-agent dispatches
- `docs/redesign/progress.md` — this file

No code changes yet — design phase only.

## Errors / blockers

None. Design is converging.
