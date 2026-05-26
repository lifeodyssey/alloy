# Alloy v3 Redesign — Task Plan

> Manus-style planning file. Auto-read before tool calls. Keep external content OUT — put research findings in `findings.md`.

## Goal (Q1 — decided)

Redesign alloy / Alloy as a fusion of GSD + OMO Slim + SuperPower **best ideas** (not as a wrapper for them).

**Three co-equal goals:**

1. **#2 多 repo 分发** — let multiple team repos share one curated OpenCode config baseline
2. **#3 标准化工作流** — encode SDD-style spec/plan/execute/verify discipline so teams stop reinventing
3. **#5 OSS 参考实现** — usable by any OpenCode team, not just ours

**Explicitly NOT goals** (decided exclusions):
- ❌ Heavy harness engineering (OpenHands-style critic/stop_hook/StuckDetector). GSD's light-tech harness is enough.
- ❌ Pure token-cost optimization as primary driver (#4 was rejected).

## Audience (Q2 — decided)

**Mode D — dogfood + OSS double-track**:
- Our internal team is the testbed (main branch is what we eat)
- OSS users get tagged releases from main
- Team-specific config lives in `.alloy/local/` (gitignored overlay)
- Public config in main repo must have NO team-specific assumptions

## Architecture (Q3-Q7 — decided)

### Q3: Workflow stance — OMO-style tiered routing

Alloy is opinionated about HAVING a smart router. The router decides which specialist + which model tier + which skills to activate per task. **Not opinionated about workflow content** — the workflow comes from which specialist is dispatched.

### Q4: How phases × specialists combine — Option B (central pipeline)

```
User request → Orchestrator → enters Phase pipeline
                                │
                                ▼
            ┌─────────┬────────┴────────┬──────────┐
            ▼         ▼                  ▼          ▼
          Plan     Execute            Verify        (each phase
          phase    phase              phase         dispatches to
            │       │                  │            relevant specialists)
            ▼       ▼                  ▼
        Explorer  Builder            Reviewer
        Architect Fixer              Tester
                  Tester
```

Harness lives in the central phase orchestrator (single source of gate logic). Specialists are domain workers, not gatekeepers.

### Q5: Phases — Option X (3 phases, merged plan with mandatory sections + Manus extension)

```
Plan phase  →  Execute phase  →  Verify phase
```

Plan-phase artifact follows **Manus pattern** (not single plan.md):

```
.alloy/plans/<id>/
  plan.md     ← MUST contain design, acceptance criteria, and ## Plan sections (gate-enforced)
  findings.md      ← discoveries made during planning/execution
  progress.md      ← checkbox tracking, survives /clear
  verification.md  ← Verify-phase artifact
```

**Small tasks**: design context can be 1 line. Gate enforces presence not length.

### Q6: Specialists — 6 task-typed + 1 router

```
Orchestrator   (router, not specialist)
├─ Explorer    (read existing code, understand architecture)
├─ Architect   (design decisions, writes ## Plan section)
├─ Builder     (write new code)
├─ Fixer       (debug + patch bugs; merges old debugger)
├─ Reviewer    (code review, critique)
└─ Tester      (write + run tests; replaces verifier)
```

Cross-phase dispatch:
- Plan phase: Explorer + Architect
- Execute phase: Builder OR Fixer + Tester (TDD)
- Verify phase: Reviewer + Tester

Migration from current 6 agents:
- Orchestrator → unchanged
- Planner → Architect (rename + sharpen)
- Executor → split into Builder + Fixer
- Debugger → merged into Fixer
- Reviewer → unchanged
- Verifier → Tester (rename + sharpen)
- + Explorer (new)

### Q7: Artifact storage — Option 3 (mixed: files for docs, JSONL for state)

```
.alloy/
  specs/<id>/                  ← Markdown files (human + agent friendly)
    plan.md
    findings.md
    progress.md
    verification.md
  state/                       ← JSONL ledgers (machine queries)
    tasks.jsonl                  task metadata (status, owner, risk)
    evidence.jsonl               every evidence record
    runs.jsonl                   tool call log
  projections/                 ← Generated views
    status.md                    derived from state/
    current-plan.md              derived from state/
  local/                       ← Gitignored, per-dev overlay (Cursor model)
```

## Q8 — Distribution model (decided)

**Two-tier physical install + manifest-driven visibility filter.**

### Tier model

```
Source: ONE central distribution repo (this one for OSS, team's fork for team scenario)
  Internal layout:
    universal/         ← installs to ~/.config/opencode/ (global tier)
    scopes/
      frontend/        ← installs to <repo>/.opencode/ if scope=frontend
      backend/
      infra/

Destinations (using OpenCode's native 2 levels):
  ~/.config/opencode/    ← one per dev machine (global)
  <repo>/.opencode/      ← one per target repo (committed)

NO third "team-private overlay" tier (YAGNI):
  Team scenario = use team's own central repo, same structure
```

### Physical install: pre-install everything in scope

`alloy install` puts ALL skills in the relevant tier on disk. NOT just the "active" ones. Disk cost ~1-2MB, but enables zero-restart `alloy add`.

### Runtime visibility: manifest filter

```
.opencode/alloy.manifest.json (Alloy's source of truth per repo)
{
  "version": "0.3.0",
  "scope": "frontend",
  "managed": ["alloy-tdd","alloy-plan","vercel-react",...],  ← Alloy installs/updates these
  "visible": ["alloy-tdd","alloy-plan"],                      ← agent sees these (subset of managed)
  "explicit": { "added": ["kotlin-jpa"] },                     ← user-added cross-scope, never auto-removed
  "excluded": ["vercel-react"]                                ← user-hidden, sticky across sync
}
```

Plugin's `experimental.chat.messages.transform` hook (ported from OMO `filter-available-skills`) rewrites `<available_skills>` block per manifest. Agent only sees `visible` set.

**Repo-owned skills** (the repo's own skill content not from Alloy) coexist: anything NOT in `manifest.managed` is owned by the repo, Alloy never touches it.

### CLI surface

| Command | Purpose |
|---|---|
| `alloy install` | Idempotent. Sync global (if needed) + sync repo (if in Alloy-aware repo). Smart about state. |
| `alloy add <skill>` | Add to manifest.visible. If not in manifest.managed, also add to manifest.explicit.added and physically install. |
| `alloy remove <skill>` | Remove from manifest.visible. Adds to manifest.excluded (sticky). |
| `alloy list` | Show available + visible per current location |
| `alloy search <term>` | Find skills by name/description/scope |
| `alloy doctor` | Check global+repo state, manifest validity, drift |

### State files (the "first time?" detector)

```
~/.config/alloy/state.json       ← machine-level: "did global install ever run?"
<repo>/.opencode/alloy.manifest.json  ← repo-level: "what's installed in this repo?"
```

4-case detection logic:
1. state.json missing → first time ever → run global install
2. state.json exists, .alloy/alloy.project.json missing → not an Alloy-aware repo → no-op
3. Both exist, manifest missing → first time in this repo → run repo install
4. Both exist, manifest.version < state.version → out of sync → run repo install

### Magic (M3): plugin startup detection

`alloy-plugin.ts` config hook reads state.json + manifest. If missing/stale, **prints warning, does NOT auto-install** (avoids unexpected side-effects on OpenCode launch).

Warning is actionable: suggests exact `alloy add` or `alloy install` command.

### In-OpenCode add flow (zero restart)

```
[user] /add vercel-react-best-practices
[plugin command.execute.before hook intercepts]
[runs `alloy add` via Bash tool]
[plugin updates in-memory manifest.visible]
[next user message: transform hook lets vercel-react through to agent]
```

Zero restart works because all skills are physically pre-installed; manifest change just expands the visible set.

### Onboarding flow

```bash
# First time on a machine (once ever)
curl -fsSL https://your-org/alloy/install.sh | bash
  # installs alloy CLI, runs `alloy install` for global tier, writes state.json

# First time in a repo
cd ~/code/my-repo
alloy install
  # detects scope from .alloy/alloy.project.json or auto-detect, installs scope tier

# Day-to-day: add/remove individual skills
alloy add postgres                # cross-scope skill
alloy remove git-master           # team uses Gerrit
```

## Q9 — Sandbox (decided)

**Ship Container Use as opt-in atom + `using-sandboxes` educational skill.** No bundled binary; user installs prereqs themselves.

### Design

- Default Alloy install: NO sandbox infra (plugin's existing `isDangerousCommand` regex + OpenCode permission system are enough for supervised work)
- `alloy add container-use` to enable:
  1. Check prereq: Docker/OrbStack/colima/Podman binary present
  2. Check prereq: `container-use` binary present
  3. If missing, print exact install commands and exit
  4. If both present, enable MCP in `.opencode/opencode.json` + add `using-sandboxes` skill to manifest.visible

### `using-sandboxes` skill content

Teaches agent:
- When to spawn an environment (risky deps, batch changes, unknown commands)
- When NOT to (single-file edits, pure reads — overhead not worth it)
- The 13 `environment_*` MCP tools and idiomatic usage
- The `cu apply` / `cu merge` handoff back to host repo
- Fallback behavior if container-use MCP is unavailable (surface to user, don't silently degrade)

### Cross-specialist mapping

| Specialist | When to use sandbox | Tool |
|---|---|---|
| Builder | new deps / large refactor | environment_create + run_cmd |
| Fixer | reproduce unfamiliar bug | environment_open + run_cmd |
| Explorer | exploratory dep install | environment_create + file_read |
| Tester | external test suites + DB | run_cmd + add_service |
| Reviewer / Architect | usually not needed | — |

### License footprint

- Container Use: Apache 2.0 (verify before shipping)
- Dagger Engine: Apache 2.0
- Docker Desktop has commercial license restrictions for large orgs — README recommends **colima** as primary (our team uses it; free MIT, lightweight, Apple Silicon native, no per-user fees). Fallbacks: OrbStack (macOS, paid for company) / Podman / Rancher Desktop.
- We ship no Container Use code, only integration + skill content — Alloy stays MIT

### Future roadmap (not now)

- **microsandbox / Firecracker microVM** integration for stronger isolation (when use case for fully-untrusted code execution emerges)
- Cloud-hosted sandbox providers (E2B, Modal, Daytona) as alternatives

## Open Decisions (Q10-Q11)

- [ ] **Q10**: First-party vs vendor — final skill list + update sync mechanism
## Q11 — OSS governance (decided)

### Version

**v0.1.0** — this redesign IS the first OSS-ready release. Reset from v2 numbering. Reason: wholesale redesign, fresh OSS surface, semver clarity.

### License

- **First-party Alloy content**: MIT
- **Vendored third-party content**: each keeps its upstream license (recorded in `vendor.lock.json` and `CREDITS.md`)
- **Reject copyleft (GPL/AGPL) for vendoring** — pollutes commercial-use story
- **License attribution** mandatory in every absorbed-concept skill's "Attribution" section + central `CREDITS.md`

### Versioning

**Double-track semver**:
- **Alloy CLI version** (`alloy@0.1.0` → ...) — bumps when CLI behavior, plugin contract, or first-party skill content changes
- **Vendor skill versions** — each tracked independently in `vendor.lock.json`; bumps follow upstream's own semver. Alloy CLI version DOES NOT bump for vendor updates.

Rules:
- **MAJOR** (0.x → 1.x): breaking change in CLI / plugin contract / manifest format / directory layout
- **MINOR** (0.1 → 0.2): new first-party skill, new CLI command, new hook
- **PATCH** (0.1.0 → 0.1.1): bug fix, doc update, vendor pin bump (vendor content changes tracked in vendor.lock.json, not CLI version)

Pre-1.0: minor versions may break. Document each break in CHANGELOG.

### CHANGELOG

- Format: [Keep a Changelog](https://keepachangelog.com)
- Sections per release: Added / Changed / Deprecated / Removed / Fixed / Security / Vendor Updates
- "Vendor Updates" section auto-populated by Renovate PRs
- File: `CHANGELOG.md` at repo root

### Contribution flow

**First-party Alloy changes**: fork → PR → tests + CHANGELOG + attribution → maintainer review → squash-merge with conventional commit.

**New vendor additions**: open issue first → discuss scope fit → if approved, PR with vendor.lock.json entry + content + Renovate regex + CREDITS.md attribution → permissive license only (MIT/Apache/BSD/MPL).

**New first-party skills**: open issue → discuss boundary with existing skills (no overlap) → PR with SKILL.md + references/ + `.alloy/state` integration + hand-off target declaration.

### Release cadence

- **Patch**: as needed
- **Minor**: ~monthly, batch new skills
- **Major**: when accumulated breaking changes warrant (rare; aim for once a year post-1.0)
- **Vendor updates**: continuous via Renovate, weekly scan, automerge minor/patch
- **No fixed schedule** before 1.0

### Public roadmap

- **GitHub Issues** labeled `roadmap` for next 3 months
- **GitHub Discussions** for design conversations
- **`docs/ROADMAP.md`** with quarterly themes

### Telemetry

**None.** Diverges intentionally from gstack. If future research need arises, opt-in only, separate decision.

### Security

- `SECURITY.md` with disclosure process
- Vulnerability reports → GitHub Security Advisories
- 90-day disclosure window standard
- Dependencies auto-scanned via Renovate + Dependabot

### v0.1.0 release prerequisites checklist

- [x] All 11 fusion skills written (Q10 done)
- [x] Sub-reference files vendored (1,020 lines across 13 files)
- [x] CREDITS.md central attribution
- [x] Q1-Q11 design decisions recorded
- [ ] `bin/alloy.mjs` updated for manifest + atoms + scope (P1)
- [ ] `alloy-plugin.ts` updated with 11 hooks (P4)
- [ ] cc-safety-net integration tested (P11)
- [ ] `install.sh` one-line onboarding works on macOS + Linux (P9)
- [ ] CI: Python e2e tests + Node unit tests + skill syntax validation pass
- [ ] CHANGELOG covers everything since reset
- [ ] README updated for new architecture
- [ ] At least 1 external team has dogfooded successfully

## Implementation Phases (planned, not started)

Once Q8-Q11 resolved:

- **P0**: Bug cleanup (already done — workflow.json removed, dedup, etc.)
- **P1**: 2-tier source restructure (`universal/` + `scopes/<type>/`) + manifest design + `alloy install`/`add`/`remove`/`list` CLI + state file writers
- **P2**: Rewrite 6 agents → 7 (split executor, rename verifier→Tester, add Explorer)
- **P3**: Write 3 phase commands (`/plan /execute /verify`) with Manus artifact pattern
- **P4**: Port OMO `filter-available-skills` hook → manifest-driven visibility (per-specialist + per-manifest filtering, enables zero-restart `alloy add`)
- **P5**: Container Use opt-in atom — prereq check in `alloy add container-use`, `using-sandboxes` skill teaching 13 environment_* tools + cu apply workflow. License attribution in README.
- **P6**: Migrate `vendor/skills/superpowers/` content into first-party `skills/alloy-*` with CREDITS (Q10 dependent)
- **P7**: Add Renovate config for remaining vendored framework skills
- **P8**: OSS release infrastructure — versioning, CHANGELOG, contributor docs
- **P9**: Install helper — `install.sh` one-line onboarding, `alloy doctor`, plugin M3 magic detection, `/add` slash command in OpenCode

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| (none yet — design phase only) | | |
