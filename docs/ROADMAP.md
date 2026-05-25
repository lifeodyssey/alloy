# Roadmap

This roadmap tracks quarterly themes for the OpenCode Alloy v0.1.x to v1.0
path. It intentionally avoids per-commit or per-issue detail.

The source architecture for the current plan is
`docs/redesign/SUMMARY.md`.

## Principles

- Keep Alloy a config distribution, not a replacement runtime for OpenCode.
- Keep the central workflow small: Plan → Execute → Verify.
- Keep repo-local state inspectable in `.alloy/`.
- Keep skill visibility manifest-driven.
- Keep first-party Alloy content MIT.
- Keep vendored skills under upstream licenses.
- Keep vendor versions independent from the Alloy CLI version.
- Keep telemetry out of the baseline.

## Q3 2026: v0.1.x Foundation And Internal Dogfood

Theme: finish the v0.1.x implementation phases and dogfood the new shape inside
the team before treating the OSS surface as stable.

Planned phase themes:

- `P1`: implement the 2-tier source restructure, atom model, manifest design,
  repo visibility, new CLI commands, state writer, and update checks.
- `P2`: rewrite the agent set from 6 lifecycle agents to 7 total agents with 1
  router and 6 specialists.
- `P3`: implement `/plan`, `/execute`, and `/verify` around the Manus-style
  artifact pattern.
- `P4`: port the OMO-style manifest skill filter and supporting runtime hooks.
- `P5`: add the Container Use opt-in atom and sandbox prerequisite checks.
- `P6`: clean up vendored SuperPower skills that were absorbed into Alloy
  first-party fusion skills.
- `P7`: add Renovate and revendor support for the vendor skill set.
- `P8`: complete OSS infrastructure docs and release hygiene.
- `P9`: ship the install helper, OpenCode plugin detection, and `/add` command
  flow.
- `P10`: keep the completed first-party fusion skill content aligned with the
  implementation.
- `P11`: integrate `cc-safety-net` in place of inline dangerous-command regexes.

Dogfood focus:

- install into several active internal repositories
- verify that `alloy install` is idempotent
- verify that manifest visibility keeps agent context small
- verify that phase artifacts survive long tasks and compaction
- verify that the new 7-agent model is easier to route than the old lifecycle
  model
- verify that `npm test` remains a practical contributor gate

Exit criteria:

- v0.1.x docs match the implemented CLI behavior
- internal repos can install and update without manual file copying
- the skill catalog and manifest behavior are understandable to a new user
- known v2 migration hazards are documented
- security and attribution docs are present for OSS review

## Q4 2026: First External Team Dogfood

Theme: put Alloy in front of the first external team and prioritize real install,
upgrade, and workflow bugs over new surface area.

Focus areas:

- onboarding clarity for a team that did not participate in the redesign
- install helper reliability on fresh developer machines
- repo-scope detection accuracy for frontend, backend, infra, and mixed repos
- manifest visibility ergonomics after several weeks of real use
- vendor update review quality
- security reporting process validation
- docs gaps found by external users
- migration notes for teams coming from hand-copied OpenCode configs

Expected output:

- patch releases in the v0.1.x line
- bug-fix focused changelog entries
- sharper docs for common install and doctor failures
- clearer guidance for when to vendor, absorb, or skip a skill
- a short external dogfood report that feeds v0.2.x planning

Non-goals:

- no broad plugin API promise yet
- no telemetry
- no default cloud-provider MCP expansion
- no large harness runtime expansion

## Q1 2027: v0.2.x Improvements From Dogfood Feedback

Theme: fold dogfood evidence into a narrower, better v0.2.x instead of expanding
the project sideways.

Likely improvement themes:

- simplify CLI help and failure messages
- improve `alloy doctor` diagnostics
- improve manifest diff output
- improve `alloy outdated` and vendor upgrade explanations
- refine default visible skills per repo scope
- refine phase gate messages when evidence is missing
- improve generated projections for human review
- improve docs for multi-repo workspace sync
- improve examples for team-local `.alloy/local/` overlays
- strengthen migration guidance from v2-era layouts

Quality themes:

- keep tests fast enough for contributors
- keep docs aligned with actual command behavior
- keep vendored attribution visible
- keep security scope precise
- keep public examples team-neutral

## Mid 2027: v1.0 Preparation

Theme: prepare the first stable contract only after the CLI, plugin hooks, and
manifest model have survived real team use.

v1.0 readiness themes:

- stable CLI command names and flags
- stable manifest schema
- stable generated file layout
- stable plugin v1 API expectations
- stable vendor lock format
- stable upgrade path from v0.1.x and v0.2.x
- documented compatibility policy
- documented deprecation policy
- tested install and upgrade path on clean machines
- tested behavior across multiple repo scopes

Release posture:

- treat v1.0 as a contract release, not a feature dump
- preserve the Plan → Execute → Verify core
- preserve OpenCode as the runtime boundary
- preserve no-telemetry governance
- preserve upstream-license discipline for vendor content
