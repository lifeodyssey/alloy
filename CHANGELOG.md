# Changelog

All notable changes to OpenCode Alloy will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows semantic versioning for the Alloy CLI separately from
vendored skill versions.

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
