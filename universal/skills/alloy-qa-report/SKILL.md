---
name: alloy-qa-report
description: Bundle a .alloy/qa-reports/<ts>/ directory into navigable index.html with screenshots grid + video embeds + case pass/fail matrix. Standalone runnable or auto-invoked from alloy-qa Phase 10.
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
---

# Alloy QA Report

## Overview

`/alloy-qa-report <ts> [--inline]`

Bundle a completed QA run directory into a standalone `index.html`. Auto-invoked by `alloy-qa` Phase 10 via `alloy_generate_qa_report` plugin tool. Also directly runnable from CLI: `node bin/alloy.mjs qa-report <ts>`.

**Announce:** "Using `alloy-qa-report` for QA run [ts]"

**Inputs:**
- `<ts>` — timestamp directory under `.alloy/qa-reports/` (e.g. `2026-05-29T01-30-00Z`)
- `--inline` — base64-embed all PNGs and WebM videos as data URIs (single-file mode, limit 10MB total)

**Output:** `.alloy/qa-reports/<ts>/index.html`

**CLI parallel entry:** `node bin/alloy.mjs qa-report <ts>` invokes the same renderer.

## Inputs

Reads from `.alloy/qa-reports/<ts>/`:

| File | Required | Purpose |
|---|---|---|
| `manifest.json` | yes | Schema §E.4: cases, health, issues |
| `issues.md` | no | Raw issue descriptions (embedded in report) |
| `screenshots/*.png` | no | Per-case screenshots |
| `videos/*.webm` | no | Per-case video recordings |
| `traces/*.zip` | no | Playwright trace archives |
| `report.md` | no | Text summary (Phase 10 writes this before calling report skill) |

## Read manifest.json

Parse `manifest.json`. Required fields:
- `version`, `ts`, `taskId`
- `health` with `baseline`, `final`, `delta`
- `cases[]` with `id`, `status`, `screenshots[]`
- `issues[]` with `id`, `severity`, `status`

If `manifest.json` missing or malformed: surface error with path and stop.

## Render index.html.tpl

Call `alloy_generate_qa_report({ ts: "<ts>", inline: false })` plugin tool.

The plugin tool:
1. Reads `manifest.json`
2. Reads `index.html.tpl` from the installed skill's templates directory
3. Performs `{{var}}` and `{{#each cases}}...{{/each}}` substitution
4. Writes `index.html`

If the plugin tool is unavailable (non-OpenCode environment), render manually:
1. Read template from `universal/skills/alloy-qa-report/templates/index.html.tpl`
2. Replace `{{taskId}}`, `{{ts}}`, `{{healthBaseline}}`, `{{healthFinal}}`, `{{healthDelta}}` with manifest values
3. For each case in `manifest.cases`, generate the case row HTML
4. Write the assembled HTML to `index.html`

## Output

`.alloy/qa-reports/<ts>/index.html` references:
- `screenshots/*.png` with relative paths (works offline from the directory)
- `videos/*.webm` as `<video>` elements with `src="videos/..."` 
- `traces/*.zip` as download links

In `--inline` mode:
- Base64-embed each PNG and WebM as data URIs
- Check total artifact size first: if > 10MB, warn user and skip inline, write path-referenced HTML instead
- Inline PNGs: `<img src="data:image/png;base64,..."/>`
- Inline WebMs: `<video><source src="data:video/webm;base64,..."/></video>`

## Evidence Chain

| Event | kind | payload |
|---|---|---|
| Start | `qa_report_start` | ts, caseCount |
| Complete | `qa_report_complete` | path to index.html |

## CLI Parallel Entry

The report can also be rendered without an OpenCode session:

```bash
node bin/alloy.mjs qa-report 2026-05-29T01-30-00Z
```

This invokes the same template renderer and writes `index.html` to the report directory.

## Report Structure

The generated `index.html` contains:

1. **Header** — task ID, timestamp, health score delta (baseline → final → delta with color)
2. **Health Score Table** — per-category before/after/delta
3. **Cases Matrix** — case ID, title, kind (happy/edge/error), status (passed/failed/skipped), duration, links to screenshots and video
4. **Issues Table** — ISSUE-NNN, severity, category, status (fixed/deferred/open), commit SHA if fixed
5. **Screenshots Grid** — thumbnail grid of all screenshots, clickable for full size
6. **Video Section** — embedded `<video>` players for each `.webm` in `videos/`
7. **Ship Readiness** — summary line derived from final health score

## Related Skills

- **alloy-qa** — Phase 10 auto-invokes this skill via `alloy_generate_qa_report`
- **alloy-qa-ingest** — provides source.json that becomes `manifest.taskId`
- **alloy-qa-derive** — provides cases that appear in the Cases Matrix
