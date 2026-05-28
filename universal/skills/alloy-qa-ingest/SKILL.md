---
name: alloy-qa-ingest
description: Use BEFORE alloy-qa execution to load Azure DevOps card + Figma assets + resolve account profile + 1Password secrets into a single source.json. Produces .alloy/test-cases/<task-id>/source.json.
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
---

# Alloy QA Ingest

## Overview

`/alloy-qa-ingest <ado-url-or-id> [--profile <profile-name>]`

Load an Azure DevOps work item, resolve credentials for the required test profile, pull Figma design assets, extract acceptance criteria, and write a canonical `source.json`. This is the first step in the team-grade QA skill chain.

**Announce:** "Using `alloy-qa-ingest` for ADO item [id] with profile [profile]"

**Produces:** `.alloy/test-cases/<task-id>/source.json` (schema: §E.2 in plan)

**Hand-off:** invoke `alloy-qa-derive` next to produce `cases.json` from the ACs in source.json.

## Inputs

| Param | Required | Notes |
|---|---|---|
| `<ado-url-or-id>` | yes | Full URL `https://dev.azure.com/org/project/_workitems/edit/1234` or bare ID `1234` |
| `--profile <name>` | yes | Profile name from `.alloy/profiles.json` (e.g. `acme-external`) |

## Phase 0a: Profile Resolution

Call the `alloy_load_profile` plugin tool with the profile name:

```
alloy_load_profile({ profile: "<profileName>", purpose: "qa-ingest" })
```

This shells `op read "op://..."` for each credential in `.alloy/profiles.json`, writes resolved values to `.alloy/run/<runId>/env` (chmod 600), and returns `{ envPath, storageStatePath, runId, ttl }`.

If `alloy_load_profile` fails:
- Profile not in `.alloy/profiles.json` → surface exact profile names available, ask user to run `alloy doctor qa` for setup guidance
- `OP_SERVICE_ACCOUNT_TOKEN` missing → instruct user: `export OP_SERVICE_ACCOUNT_TOKEN=<token>` or set in `.env` (NOT committed)
- `op` CLI missing → instruct user to install 1Password CLI: https://developer.1password.com/docs/cli/get-started/

Emit `alloy_evidence { kind: "qa_ingest_profile_loaded", summary: "runId=<id>, profile=<name>" }`.

## Phase 0b: ADO Card Fetch (LLM-driven az CLI)

Run these commands. Do NOT call any plugin tool — az is in PATH.

```bash
# 1. fetch raw JSON
az boards work-item show --id $TASK_ID --expand all --output json > /tmp/card.json || \
  { echo "az failed — run 'az login' or check PAT"; exit 1; }

# 2. extract title, description, iteration
jq '{id: .id, title: .fields."System.Title", desc: .fields."System.Description", iter: .fields."System.IterationPath"}' /tmp/card.json

# 3. extract figma URLs from HTML description (if pandoc available, prefer markdown)
jq -r '.fields."System.Description"' /tmp/card.json | \
  grep -oP 'https://(?:www\.)?figma\.com/file/[a-zA-Z0-9]+(?:/[^"\s)]+'
```

If `az boards work-item show` fails, **do not retry blindly** — surface the error to user with the exact command that failed. Common causes: not logged in, wrong organization default, missing PAT scope.

Extract from the work item:
- `id` — numeric work item ID (use as `taskId`)
- `title` — System.Title
- `description` — System.Description (sanitize HTML to markdown if pandoc available, else strip tags)
- `iterationPath` — System.IterationPath
- `state` — System.State
- `url` — construct from org/project/id
- `linkedItems` — Related work items (System.LinkTypes.RelatedCount > 0)
- `acceptanceCriteria` — parse from description (see Phase 0c)
- `attachments` — parse attachment file names from description links

Emit `alloy_evidence { kind: "qa_ingest_card_loaded", summary: "ADO item <id>: <title>" }`.

## Phase 0c: Acceptance Criteria Extraction

Parse the markdown description for acceptance criteria. Look for these patterns (in priority order):

1. Section headed `## Acceptance Criteria`, `### AC`, `### Acceptance Criteria`, or `**Acceptance Criteria**`
2. Numbered or bulleted list items beneath that heading
3. If no explicit section: look for lines starting with `Given`, `When`, `Then`, `And` (Gherkin fragments)

For each AC line, assign:
- `id`: `AC-N` (sequential)
- `text`: cleaned text
- `kind`: `"given"` | `"when"` | `"then"` | `"constraint"` (infer from prefix or content)

If no ACs found: emit a warning, set `acceptanceCriteria: []`, continue (derive will produce text-only cases).

## Phase 0d: Figma Asset Fetch (Figma MCP tool calls)

For each Figma URL from Phase 0b, call MCP tools directly:

1. Parse URL: `https://figma.com/file/<fileKey>/<name>?node-id=<nodeId>`
2. Call `download_figma_images({ fileKey, ids: [nodeId], format: "png", scale: 2 })` → returns image URL
3. Save PNG to `.alloy/test-cases/<taskId>/figma/<nodeId>.png`
4. Call `get_node({ fileKey, nodeId })` → returns layout JSON with text, components, constraints
5. Save JSON to `.alloy/test-cases/<taskId>/figma/<nodeId>.json`

Figma MCP token comes from `FIGMA_PERSONAL_ACCESS_TOKEN` env var (set up by user during alloy init, doctor verifies).

If Figma MCP unreachable: emit `qa_ingest_figma_skipped` evidence with reason, continue without visual contract (Phase 0.5 derive falls back to text-only).

Emit `alloy_evidence { kind: "qa_ingest_figma_pulled", summary: "N figma nodes fetched, M PNGs saved" }`.

## Phase 0e: Write source.json

Assemble and write `.alloy/test-cases/<taskId>/source.json`:

```json
{
  "id": "<taskId>",
  "title": "<title>",
  "url": "https://dev.azure.com/<org>/<project>/_workitems/edit/<id>",
  "state": "<state>",
  "iterationPath": "<iterationPath>",
  "fetchedAt": "<ISO timestamp>",
  "description": "<sanitized markdown>",
  "acceptanceCriteria": [ { "id": "AC-1", "text": "...", "kind": "given" } ],
  "assets": {
    "figma": [ { "url": "<figma-url>", "label": "<title>", "localPng": "figma/<nodeId>.png" } ],
    "attachments": []
  },
  "linkedItems": [],
  "profilesRequired": ["<profileName>"]
}
```

Validate: `id`, `title`, `fetchedAt`, `profilesRequired` must be non-empty strings/arrays. If validation fails, surface error and do not write.

Emit `alloy_evidence { kind: "qa_ingest_complete", summary: "source.json written to .alloy/test-cases/<taskId>/" }`.

## Failure Modes

| Failure | Action |
|---|---|
| Profile not found in profiles.json | Surface available profiles, stop |
| `OP_SERVICE_ACCOUNT_TOKEN` missing | Print setup instructions, stop |
| `az` not logged in | Print `az login` instructions, stop |
| ADO 401 / permission denied | Ask user to verify PAT has Work Items read scope |
| Figma MCP rate limit | Wait 30s, retry once; on second failure emit `qa_ingest_figma_skipped` and continue |
| No ACs found in description | Warn user, continue with empty ACs |

## Evidence Chain

| Phase | Evidence kind | Required payload |
|---|---|---|
| 0a | `qa_ingest_profile_loaded` | profile, runId |
| 0b | `qa_ingest_card_loaded` | ADO item id and title |
| 0c | (inline with card load) | — |
| 0d | `qa_ingest_figma_pulled` or `qa_ingest_figma_skipped` | node count or skip reason |
| 0e | `qa_ingest_complete` | output path |

If `alloy_evidence` tool is unavailable, append equivalent JSONL to `.alloy/state/evidence.jsonl`.

## Hand-off

After source.json is written, invoke `alloy-qa-derive` to produce `cases.json`:

```
/alloy-qa-derive .alloy/test-cases/<taskId>/source.json
```

Or instruct the user: "source.json is ready — run `/qa-derive` to generate test cases."
