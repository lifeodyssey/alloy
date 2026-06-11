# Changelog

## [0.1.4] - 2026-06-11

### Rename And Model

- Renamed the project surface to Alloy.
- Reduced the shipped primary agent surface to `Planner` and `Builder`.
- Removed persistent specialist agent files.
- Kept subagents as one-shot native Task usage documented in prompts, commands, and skills.

### Markdown State

- Replaced legacy task state with `.alloy/tasks/<task-id>/` markdown artifacts.
- Fresh installs create `.alloy/tasks/` and `.alloy/.gitignore`.
- `.alloy/.gitignore` ignores `run/` and `*.lock`.
- Gate checks now read `progress.md` `## Gate` checkboxes.

### Commands And Plugin

- Rewrote `/discuss`, `/plan`, `/execute`, and `/verify` around the command-driven phase machine.
- Updated compatibility commands to use `.alloy/tasks/<id>/context.md`, `plan.md`, and `progress.md`.
- Removed preset hot-swap runtime.
- Removed generated `.opencode/presets.json`.
- Replaced old completion tools with `alloy_progress`, `alloy_state`, and `alloy_gate`.
- Plugin hook status injection now emits `<alloy-plan>` and `<alloy-progress>`.

### Skills

- Rewrote Alloy skills for v0.1.4:
  - thick durable artifacts
  - exact acceptance criteria, files, commands, gates, risks, counterexamples, and handoff
  - TDD/debug verification discipline
  - one-shot subagent policy

### Packs And Installer

- Pack atoms now install `Planner` and `Builder`.
- Installer no longer writes projections or preset files.
- Legacy `.alloy/specs` migration now targets `.alloy/tasks`.
- `package.json` version is `0.1.4`.

### Verification

- Updated installer, resolver, and plugin tests for the new task/gate contract.
- Added grep guards for removed preset and legacy state references.

## [0.1.2] - 2026-05-27

- Established the first public Alloy package layout and installer flow.
- Added pack resolution, manifest generation, scoped skills, and OpenCode template installation.
- This release has been superseded by the v0.1.4 two-agent markdown-state redesign.
