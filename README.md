# OpenCode Alloy

OpenCode Alloy v0.1.0 — config distribution for multi-repo teams

OpenCode Alloy is an OpenCode-native distribution layer for teams that want the
same agent workflow, skills, commands, MCP baseline, and verification discipline
across many repositories.

This release resets the old v2 numbering to `v0.1.0`. The reset marks the first
OSS-ready architecture: a smaller public surface, clear license boundaries, and a
documented Plan → Execute → Verify pipeline.

## Quick Start

Clone this repo, then run the installer from each target repository:

```bash
git clone https://github.com/lifeodyssey/opencode-team-config.git ~/src/opencode-team-config
cd /path/to/target-repo
bash ~/src/opencode-team-config/setup.sh --pack core --target local --models github-copilot
```

Re-run the same command inside any repository that should receive Alloy:

```bash
cd /path/to/target-repo
bash ~/src/opencode-team-config/setup.sh --pack core --target local --models github-copilot
```

The installer is designed around two tiers:

- a global tier under `~/.config/opencode/` for shared Alloy runtime content
- a repo tier under `<target>/.opencode/` for project-scoped visibility
- an Alloy state tier under `<target>/.alloy/` for specs, JSONL ledgers, and projections

## What It Does

- Installs a curated OpenCode team configuration into target repos without making
  each repo hand-copy agents, skills, commands, plugins, and MCP settings.
- Enforces a central Plan → Execute → Verify workflow with explicit artifacts,
  evidence, and phase gates.
- Separates Alloy first-party content from vendored upstream skills so teams can
  update Alloy and vendor skills honestly.

## Why Alloy Exists

Multi-repo teams usually drift in three places:

- every repo accumulates a slightly different agent prompt set
- every person has a different idea of when planning or verification is required
- vendored workflow ideas get copied without attribution, version tracking, or
  a sane upgrade path

Alloy makes those choices explicit. It is not a replacement for OpenCode.
OpenCode remains the runtime, agent host, tool host, MCP host, and plugin host.
Alloy resolves, installs, filters, and records the team workflow that OpenCode
uses.

## The 3-Phase Pipeline

Alloy v0.1.0 standardizes work into three central phases:

```text
User request
    |
    v
+--------+       +----------+       +--------+
| Plan   | ----> | Execute  | ----> | Verify |
+--------+       +----------+       +--------+
    |                 |                 |
    v                 v                 v
Spec + plan      Code + tests      Review + gates
```

The phase model is intentionally small:

- `Plan` routes to Explorer and Architect work.
- `Execute` routes to Builder, Fixer, and Tester work.
- `Verify` routes to Reviewer and Tester work.

The expected artifact shape is based on the redesign docs:

```text
.alloy/specs/<id>/
  task_plan.md       # required Spec + Plan sections
  findings.md        # research and codebase notes
  progress.md        # execution log
  verification.md    # final evidence and gate result
```

This gives agents a durable place to resume after compaction and gives humans a
plain Markdown trail for decisions.

## Agent Model

The redesign moves from 6 lifecycle agents to 7 agents total:

- `Orchestrator`: router for task type, complexity, phase, specialist, and model
- `Explorer`: reads existing code and maps dependencies
- `Architect`: writes the plan and owns technical design
- `Builder`: implements new code paths
- `Fixer`: reproduces, minimizes, and fixes bugs
- `Reviewer`: reviews code and plans with severity labels
- `Tester`: writes and runs tests in Execute and Verify

The key shift is from lifecycle handoffs to task-typed specialists. The phase
orchestrator keeps the pipeline central; specialists stay focused.

## Skill Catalog

The full visual catalog is in
[docs/redesign/config-overview.html](docs/redesign/config-overview.html).

That catalog documents the first public target shape:

- 15 first-party skills total
- 11 first-party fusion skills
- 4 kept first-party skills
- 22+ vendored skills tracked independently
- 8 MCP entries across universal, frontend opt-in, and sandbox opt-in tiers

The 11 fusion skills named in the redesign summary are:

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

The kept first-party skills are:

- `humanizer`
- `git-master`
- `frontend-ui-ux`
- `playwright-cli`

Vendored skills keep their upstream license and independent vendor version.
Alloy first-party content is MIT.

## Architecture Overview

The complete v0.1.0 architecture summary lives in
[docs/redesign/SUMMARY.md](docs/redesign/SUMMARY.md).

At a high level, Alloy has four layers:

```text
Repository sources
  packs / defaults / models / skills / vendor / agents / commands / templates
        |
        v
Alloy CLI
  install / add / remove / list / search / state / gate / doctor / sync
        |
        v
Installed files
  ~/.config/opencode + target .opencode + target .alloy
        |
        v
OpenCode runtime
  plugin hooks + agents + MCPs + skills + Alloy JSONL ledgers
```

The most important design choice is manifest-driven visibility. Alloy can install
more skill content on disk than an agent sees in a given repo, then expose skills
through `alloy add` and the runtime visibility filter.

## CLI Shape

The v0.1.0 design centers on these commands:

```bash
alloy install
alloy add <skill>
alloy remove <skill>
alloy list
alloy search <query>
alloy outdated
alloy upgrade [name|--self|--all-vendors]
alloy state add-task --title "..."
alloy gate check --task-id <id>
alloy doctor
alloy sync --workspace alloy.workspace.json
```

The old pack-oriented `setup.sh` flow remains part of the repository history, but
the OSS-ready direction is the `alloy` CLI plus a one-line install helper.

## Runtime Boundaries

Alloy is intentionally not a harness runtime.

- The Alloy CLI resolves config, installs files, checks drift, and writes state.
- The Alloy plugin adapts OpenCode hooks into evidence, claim, gate, and status
  records.
- Agents read skills, call tools, write code, and follow phase artifacts.
- OpenCode remains responsible for the agent loop, tool execution, MCP hosting,
  and plugin loading.

This split keeps the project small enough to be maintained as a config
distribution while still standardizing team behavior.

## State And Artifacts

Target repositories receive two kinds of local state:

```text
.opencode/
  alloy.manifest.json
  agents/
  commands/
  plugins/
  skills/

.alloy/
  specs/
  state/
  projections/
  codebase/
  qa-reports/
  local/
```

`.opencode/` is runtime configuration for OpenCode. `.alloy/` is workflow state
for humans, agents, and lightweight CLI gates. JSONL files are the machine source
of truth; Markdown files are the human-readable working surface.

## Safety Model

The redesign replaces the older inline dangerous-command regex with a planned
`cc-safety-net` integration and project overlay rules. The safety direction is:

- intercept dangerous shell patterns before execution
- record fresh evidence before marking work done
- keep target-repo state local and inspectable
- avoid telemetry
- avoid project-specific cloud MCP defaults

For security reporting, see [SECURITY.md](SECURITY.md).

## Documentation

- [Architecture summary](docs/redesign/SUMMARY.md)
- [Visual skill and architecture catalog](docs/redesign/config-overview.html)
- [Roadmap](docs/ROADMAP.md)
- [Changelog](CHANGELOG.md)
- [Security policy](SECURITY.md)
- [Credits](CREDITS.md)

## Contributing

This repository does not require a separate contribution guide to get started.
Use the following baseline for OSS contributions:

- keep first-party Alloy changes under MIT-compatible terms
- preserve upstream attribution for vendored skills
- update `CHANGELOG.md` for user-visible changes
- update `docs/redesign/SUMMARY.md` or roadmap docs when architecture changes
- run `npm test` before opening a pull request
- avoid adding telemetry, project-specific secrets, or team-private defaults

For larger changes, open an issue or discussion first and reference the design
question being revisited.

## Credits

Alloy combines first-party workflow design with ideas and vendored content from
SuperPower, GSD, OMO Slim, Matt Pocock skills, gstack methodology, and framework
skill authors. See [CREDITS.md](CREDITS.md) for attribution details.

## License

Alloy first-party content is released under the [MIT License](LICENSE). Vendored
skills keep their upstream licenses and are tracked separately.
