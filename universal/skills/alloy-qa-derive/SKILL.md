---
name: alloy-qa-derive
description: Derive executable test cases (Gherkin + JSON assertions) from a source.json. Outputs cases.json + human-readable README.md. One AC → 3 cases (happy + edge + error).
allowed-tools:
  - Read
  - Write
  - Glob
---

# Alloy QA Derive

## Overview

`/alloy-qa-derive <source-json-path>`

Systematically derive executable test cases from a `source.json` produced by `alloy-qa-ingest`. One acceptance criterion produces 3 cases: happy path, edge case, and error case. Output is `cases.json` (machine-readable for `alloy-qa` Phase 4) and `README.md` (PM-readable summary).

**Announce:** "Using `alloy-qa-derive` for [taskId]: [N] ACs → [N×3] cases"

**Preconditions:**
- `source.json` must exist at the given path
- `source.json` must satisfy the E.2 schema: `id`, `title`, `fetchedAt`, `profilesRequired` must be non-empty
- If validation fails, surface the schema error and stop — do not produce partial cases

**Produces:**
- `.alloy/test-cases/<taskId>/cases.json`
- `.alloy/test-cases/<taskId>/README.md`

## 5-Block Derivation Prompt Template

For each AC in `source.json.acceptanceCriteria`, apply this template:

---

**BLOCK 1 — Feature description**

Feature: `{source.title}`
Context: `{source.description}` (first 500 chars)

**BLOCK 2 — Single AC**

Acceptance Criterion ID: `{ac.id}`
Text: `{ac.text}`
Kind: `{ac.kind}` (given | when | then | constraint)

**BLOCK 3 — Visual contract** (skip if no figma assets)

Figma nodes for this feature:
- For each `source.assets.figma` item: load `figma/<nodeId>.json`, extract: required text labels, CTA button labels, error state messages, empty state copy.
- If figma JSON unavailable: skip this block, note `figmaAnchor: null` in output.

**BLOCK 4 — Profile and preconditions**

Profile(s) required: `{source.profilesRequired}`
Data preconditions: infer from AC text (e.g. "user has existing account", "cart is empty")

**BLOCK 5 — Coverage directive**

Produce exactly:
- 1 happy-path case: the AC succeeds as described
- 1–2 edge cases: boundary conditions, near-miss inputs, timing constraints
- 1 error case: failure path (wrong input, server error, permission denied)

---

Process ACs sequentially, not in batch. Complete all 3 cases for AC-1 before moving to AC-2.

## Output Schema (cases.json)

Each case in the `cases` array must contain:

```json
{
  "id": "<taskId>-TC-<NNN>",
  "ac": "<ac.id>",
  "kind": "happy | edge | error",
  "title": "<one-line description>",
  "profile": "<profileName from source.profilesRequired[0]>",
  "gherkin": [
    "Given ...",
    "When ...",
    "Then ..."
  ],
  "assertions": [
    { "kind": "text-visible | url-match | element-exists | element-absent | console-clean", "selector": "<optional>", "expected": "<value>" }
  ],
  "figmaAnchor": "<nodeId or null>",
  "estimatedDuration": 30
}
```

Full file structure:

```json
{
  "taskId": "<source.id>",
  "generatedAt": "<ISO timestamp>",
  "model": "<model used for derivation>",
  "cases": [ ... ]
}
```

## Quality Bar

Each case MUST have:
- `gherkin` steps ≥ 3 (Given + When + Then minimum)
- `assertions` array ≥ 1 (at least one verifiable assertion)
- `figmaAnchor` present if Figma assets exist for the feature (use `null` only if no figma data)
- `estimatedDuration` ≥ 10 (seconds; 30 is a reasonable default)
- `kind` must be exactly `"happy"`, `"edge"`, or `"error"`
- `profile` must match one of `source.profilesRequired`

If a case cannot meet the quality bar (e.g. AC is too vague to write assertions), note it in README.md as `needs-human` and omit from cases.json rather than producing a low-quality case.

## Markdown Sidecar (README.md)

Write `.alloy/test-cases/<taskId>/README.md` as a PM-readable summary:

```markdown
# Test Cases: <taskId> — <title>

Generated: <timestamp> | Source: source.json | Cases: <total>

## Coverage Matrix

| AC | AC Text | Happy | Edge | Error |
|---|---|---|---|---|
| AC-1 | User clicks Forgot password | TC-001 ✅ | TC-002 ✅ | TC-003 ✅ |
| AC-2 | User receives reset email | TC-004 ✅ | TC-005 ✅ | TC-006 ✅ |

## Needs-Human Cases

<list any ACs that could not produce quality cases, with reason>

## How to Execute

Run: `/alloy-qa <url> --cases .alloy/test-cases/<taskId>/cases.json --profile <profileName>`
```

## Evidence Chain

| Event | kind | payload |
|---|---|---|
| Start | `qa_derive_start` | taskId, AC count |
| Per case | `qa_derive_case` | caseId, acId, kind |
| Complete | `qa_derive_complete` | taskId, total cases, output path |

If `alloy_evidence` tool unavailable, append to `.alloy/state/evidence.jsonl`.

## Hand-off

After `cases.json` is written:

```
/alloy-qa <url> --cases .alloy/test-cases/<taskId>/cases.json --profile <profileName>
```

Or instruct the user: "cases.json ready — run `/qa <url>` to execute the derived test suite."
