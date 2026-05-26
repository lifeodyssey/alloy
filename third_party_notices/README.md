# Third-Party Notices

OpenCode Alloy vendors a small, reviewable subset of upstream skill files so installation can run without interactive package-manager flows.

The authoritative source, version, license, hash, and vendored paths for each snapshot are recorded in `vendor.lock.json`.

Policy:

- Do not edit files under `vendor/` directly.
- Put Alloy changes in `agents/`, `commands/`, `universal/skills/`, `scopes/<kind>/skills/`, `packs/`, `models/`, or templates.
- Refresh vendored content only through a deliberate vendor refresh workflow.
- If a dependency has unclear redistribution terms, do not add it to default packs until the license is verified.
