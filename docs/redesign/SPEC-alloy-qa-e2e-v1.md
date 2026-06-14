# alloy-qa-e2e — Specification

## Metadata

- **Status:** Draft — pending user review
- **Date:** 2026-06-14
- **Scope:** QA Skill v1 + QA Agent
- **Target runtime:** OpenCode (Alloy v0.1.4+)
- **Naming:** `alloy-qa-e2e` skill + `QA` agent (distinct from existing `alloy-qa` which handles manual/regression QA coordination without browser automation)

## What This Solves

Turn a card's acceptance criteria (from Azure DevOps or pasted inline) into a deterministic, evidence-backed acceptance report with minimal manual clicking.

---

## 1. Why a Dedicated QA Agent

The flow crosses multiple stages with human-in-the-loop gates:

```text
AC → Context → Plan → [gate: approve] → Generate specs → Execute → [gate: review report] → Done
```

Each stage may take minutes and the entire run may take 10-30 minutes. Running this inside the main OpenCode session would block the user. A dedicated **QA Agent** owns the full pipeline end-to-end, with the main session only intervening at two approval gates:

1. **Plan gate** — user reviews `plan.md` (via plannotator) before Generator runs
2. **Report gate** — user reviews `report.html` + `report-review.md` before QA is marked accepted

The `alloy-qa-e2e` skill is the entry point (light); it spawns the QA Agent.

---

## 2. Architecture Overview

```text
┌──────────────────┐
│ Entry            │  Manual AC text / Azure DevOps Work Item (az CLI wrapped)
│ Credentials      │  OP_SERVICE_ACCOUNT_TOKEN → 1Password CLI, else .env
│ Figma (optional) │  FIGMA_TOKEN → REST API, else ask-user, else MCP, else skip
└──────┬───────────┘
       ↓
┌──────────────────┐
│ context.md       │  Normalized AC + Figma context
└──────┬───────────┘
       ↓
┌──────────────────┐
│ QA Planner       │ → plan.md (test scenarios, paths, checkpoints)
│ gate ⎈           │ → plannotator annotate → approve or revise
│ QA Generator     │ → executable Playwright spec (tests/e2e/...spec.ts)
│                  │   codegen as fallback for unstable locators
└──────┬───────────┘
       ↓
┌──────────────────┐
│ Playwright CLI   │ npx playwright test → screenshots, .webm video, traces
│ ffmpeg (opt)     │ .webm → .gif
│ Figma diff (opt) │ reference frame PNG vs live screenshot (side-by-side)
└──────┬───────────┘
       ↓
┌──────────────────┐
│ report.html      │ Custom single-page acceptance report
│ report-review.md │ plannotator-annotatable review → Healer or Re-plan
│ cost.md (opt)    │ Wall-clock, tokens, estimated cost
│ gate ⎈           │ Report reviewed → QA Accepted
└──────┬───────────┘
       ↓
┌──────────────────┐
│ QA Healer        │ locator broken → fix spec & re-run
│                  │ product behavior mismatch → flag, do NOT fix
│                  │ annotation triggers → re-plan / re-generate / re-execute
└──────────────────┘
```

---

## 3. Design Sections

### 3.1 Entry & Context

#### AC Sources (v1)

| Source | How | Notes |
|--------|-----|-------|
| Manual AC | Pasted markdown/text in chat | MVP, zero integration |
| Azure DevOps Work Item | `az boards work-item show --id <id>` wrapped via `azure-devops-context` provider | v1 only tracker |

The `azure-devops-context` provider wraps Azure CLI and returns a normalized structure:

```json
{
  "id": 12345,
  "title": "...",
  "description": "...",
  "acceptanceCriteria": "...",
  "comments": [],
  "links": [],
  "attachments": []
}
```

QA Agent only consumes this normalized shape — it never calls `az` directly. This keeps the QA pipeline tracker-agnostic.

#### Figma Context (optional)

Priority cascade:

```text
1. FIGMA_TOKEN env var present → FIGMA REST API
   GET /v1/files/:key/nodes?ids=<node-id>
   GET /v1/images/:key?ids=<node-id>&format=png&scale=2
2. No token → ask user "Can you provide a Figma token?"
3. User declines → try figma-official MCP (if available)
4. MCP unavailable → skip Figma; QA based on AC text only
```

#### Output: context.md

```text
.alloy/tasks/<task-id>/qa/context.md
```

Records source, AC, Figma reference, base URL; ready for Planner.

---

### 3.2 Credentials & Login

#### Provider Detection

```text
OP_SERVICE_ACCOUNT_TOKEN present?
  YES → 1Password CLI provider
  NO  → .env provider
  NEITHER → stop, tell user to configure credentials
```

#### ⚠️ 1Password — MANDATORY READ BEFORE USE

> **以下注意事项必须在 SKILL.md 中醒目标注，用户在首次使用 1Password 凭据提供者前必须阅读：**
>
> 1. **Token 只显示一次。** `op service-account create` 输出的 token 只会在终端打印一次。请立即把 token 复制到一个安全的地方（密码管理器），绝不要放进 `.env`、git repo、或任何文件里。丢了只能重建 service account。设置方式：`export OP_SERVICE_ACCOUNT_TOKEN=<token>`。
>
> 2. **权限是 vault 级，不是 item 级。** 1Password 不支持将 service account 限制到单条 item。你必须为这条测试登录创建一个**专用 vault**（如 `qa-test-creds`），并将 service account 只 scope 到该 vault，才能做到最小权限。不要把测试凭据放进你的 Personal / Private / Shared vault——service account 无法访问这些 vault。
>
> 3. **专用 vault 设置步骤：**
>    ```bash
>    op vault create qa-test-creds
>    op item create --category login --vault qa-test-creds --title test-login \
>      username=qa@example.com password='the-password'
>    op service-account create "qa-skill" --expires-in 90d --vault qa-test-creds:read_items
>    ```
>    上述 `qa-skill` service account **只能读** `qa-test-creds` vault 里的条目，**不能读写**其他任何 vault。
>
> 4. **速率限制：** Business 账户每小时 10,000 次读；Teams 每小时 1,000 次；Families 每小时 1,000 次。一次 QA 流程只读 2 个字段（username + password），不会触发限流。如果你在短时间内跑几十次 QA，才需要注意。
>
> 5. **没有桌面 App 也能跑。** 只要设了 `OP_SERVICE_ACCOUNT_TOKEN`，`op read` 不需要 `op signin`、不需要桌面 App、不需要生物识别——headless / CI 均可用。

#### .env Convention

```bash
APP_BASE_URL=https://app.example.com

# Plaintext (uses .env provider, not 1Password)
APP_USERNAME=qa@example.com
APP_PASSWORD=...

# 1Password references (used when OP_SERVICE_ACCOUNT_TOKEN is set)
APP_USERNAME_OP_REF=op://qa-test-creds/test-login/username
APP_PASSWORD_OP_REF=op://qa-test-creds/test-login/password

# Optional
APP_LOGIN_URL=
APP_USERNAME_SELECTOR=
APP_PASSWORD_SELECTOR=
APP_SUBMIT_SELECTOR=

# Optional tracker context
AZURE_DEVOPS_ORG=
AZURE_DEVOPS_PROJECT=

# Optional Figma
FIGMA_TOKEN=
```

**Rules:**
- `.env` MUST be in `.gitignore`, `.alloy/.gitignore`, and the repo root `.gitignore`
- `.env` values MUST NEVER appear in reports, screenshot filenames, logs, or report HTML
- If both plaintext and `_OP_REF` fields are set for the same credential, 1Password wins
- If `APP_PASSWORD` starts with `op://`, treat as unrecognized and warn (likely a copy-paste error)

#### Login Flow

1. Navigate to `APP_LOGIN_URL` (fallback: `APP_BASE_URL`)
2. Auto-detect username/password/submit elements
3. If detection fails → use explicit selectors from `.env`
4. If still fails → generate diagnostic screenshot, ask user for selector override, or suggest `codegen`
5. On success → save Playwright `storageState` to `.playwright/.auth/qa.json`

#### Login Failure Taxonomy

| Failure | Action |
|---------|--------|
| Selector not found | Diagnostic screenshot; ask for override or run codegen |
| Wrong credentials (1Password) | Stop immediately (credential origin is authoritative; no typo possible) |
| Wrong credentials (.env) | 1 retry with user confirmation, then stop if still failing |
| MFA / SSO / CAPTCHA | Stop; suggest manual storageState capture path (v2) |

`.playwright/.auth/` MUST be in `.gitignore`.

---

### 3.3 Plan / Gate / Generate / Heal

#### Planner → plan.md

Input: `context.md`

Output: `.alloy/tasks/<task-id>/qa/plan.md`

```markdown
# QA Test Plan

## Source
- Azure DevOps Work Item: ADO-12345
- Figma: REST (frame node 1:23 from file abc123)
- Base URL: https://app.example.com

## Acceptance Criteria Coverage

| AC | Scenario | Priority | Evidence |
|---|---|---|---|
| AC1: Submit succeeds | Happy path | P0 | Screenshot after submit |
| AC2: Validation errors | Empty required fields | P1 | Screenshot per error |

## User Paths

### Path 1: Happy path (AC1)
1. Login
2. Navigate to feature page
3. Fill form
4. Submit → Screenshot checkpoint
5. Assert success message

### Path 2: Validation (AC2)
1. Login
2. Navigate to feature page
3. Submit empty → Screenshot checkpoint
4. Assert error visibility per field

## Screenshot Checkpoints
- ac1-after-submit
- ac2-validation-errors

## Video / GIF
- Path 1 full flow → video + GIF

## Out of Scope
- Performance testing
- Mobile layout (v2)
- Dark mode

## Assumptions
- Test user has write permission
- Feature page URL is /feature

## Risks
- Third-party payment flow not mockable → manual verification needed
```

#### Plan Gate (HARD gate)

1. `plan.md` written
2. User annotates via plannotator → annotations saved to `plan-annotations.md`
3. If annotations request changes → Planner revises `plan.md` → back to step 2
4. If approved → gate checkbox `[x] Plan approved` set in `gates.md`
5. **Generator MUST read `gates.md` and check `[x] Plan approved` before running; if not set, refuse and prompt user.**

**Gate file relationship:**
- `gates.md` — machine-readable checkbox registry (the hard gate). Generated by the QA Agent at the start of each phase, checked by the Generator/Healer before proceeding.
- `plan-annotations.md` — human-authored plannotator output (the user's review). Drives the Planner revision loop. On approval, the QA Agent stamps `[x] Plan approved` into `gates.md`.

```markdown
# QA Gates

- [x] Context collected
- [x] Plan generated
- [ ] Plan approved        ← Generator checks this
- [ ] Specs generated
- [ ] Tests executed
- [ ] Report generated
- [ ] Report reviewed
- [ ] QA Accepted
```

#### Generator → Reusable Playwright Spec

Input: `plan.md` (approved) + `context.md`

Output: `tests/e2e/azure-<work-item-id>-<slug>.spec.ts`

Generator behavior:
1. Reuse `storageState` from login phase
2. Walk each path from `plan.md`
3. Write Playwright code that exercises the real page
4. Add `test.step()` at each checkpoint
5. Add `page.screenshot()` at marked checkpoints
6. Map AC to `test.describe` / `test` titles
7. Use stable locators (role, label, test-id preferred over CSS/XPath)
8. If locator stability is doubtful → note in spec comments

Example output:

```ts
import { test, expect } from '@playwright/test';

test.describe('ADO-12345: Card title', () => {
  test.use({ storageState: '.playwright/.auth/qa.json' });

  test('AC1 — Happy path submits successfully', async ({ page }) => {
    await test.step('Navigate to feature', async () => {
      await page.goto('/feature');
      await page.screenshot({ path: qaArtifact('screenshots/ac1-nav.png'), fullPage: true });
    });

    await test.step('Fill form', async () => {
      await page.getByLabel('Name').fill('Test');
      await page.getByLabel('Email').fill('test@example.com');
    });

    await test.step('Submit', async () => {
      await page.getByRole('button', { name: 'Submit' }).click();
      await page.screenshot({ path: qaArtifact('screenshots/ac1-after-submit.png'), fullPage: true });
    });

    await expect(page.getByText('Success')).toBeVisible();
  });

  test('AC2 — Shows validation errors for empty fields', async ({ page }) => {
    // ...
  });
});
```

**`qaArtifact()` helper definition:** The Generator injects this utility at spec creation time so screenshots land in the right per-task directory, using Playwright's built-in `testInfo`:

```ts
import { test, expect } from '@playwright/test';
import path from 'path';

// REACTIVATED_QA_ARTIFACT_DIR is injected by Generator at spec creation time
const QA_ARTIFACT_DIR = process.env.QA_ARTIFACT_DIR || '.alloy/tasks/unknown/qa/artifacts';

function qaArtifact(subpath: string): string {
  return path.join(QA_ARTIFACT_DIR, subpath);
}
```

Alternative (no env-var injection needed): use `test.info().outputPath()` which Playwright resolves per-test to a unique output directory. The Generator picks whichever yields cleaner path control for the report template.

Playwright's default `test-results/` directory from `outputDir`/automatic capture should be symlinked or copied into `artifacts/traces/` as part of the report assembly phase.

#### codegen Integration

`codegen` is a **generator fallback**, not a main path. Triggered when:
- Generator has failed to find a stable locator 3+ times
- User explicitly requests codegen for a complex flow
- Login/navigation path involves non-standard UI

```bash
npx playwright codegen "$APP_BASE_URL" --output .alloy/tasks/<task-id>/qa/codegen/path-raw.spec.ts
```

Generator then refactors the raw codegen output into the canonical spec.

#### Healer

Triggered by: test failure, or user annotations on `report-review.md`.

Healer rules:

| Failure type | Action |
|---|---|
| Locator broken | Re-explore page, update locator, re-run affected test |
| Timing / async | Add appropriate wait / retry, re-run |
| Session expired mid-run | Re-login, re-save `storageState`, re-run affected tests |
| Product behavior mismatch with AC | Do NOT modify spec; flag as product issue in report |
| Figma visual mismatch | Do NOT modify spec; flag visual diff in report |
| Login failure | Escalate to credential diagnostic |
| User annotation: re-plan | Return control to Planner |
| User annotation: accepted-with-notes | Close QA as accepted |

Healer runs as a sub-loop within the Report Gate phase. After repairing test issues and re-executing:

```markdown
- [ ] Healer run complete       ← set after healer finishes a cycle; report regenerated
```

If Healer fails to resolve after maximum retries (default 3), escalate to user. The Healer does not have its own approval gate — it is a tool the QA Agent uses to converge toward a green report, which the user then reviews.

Healer output: `.alloy/tasks/<task-id>/qa/healer.md` recording what was changed, what was not, and why.

#### Playwright Official Test Agents (optional enhancement)

QA Agent will detect if Playwright Test Agents have been initialized (presence of `.playwright/agents/` directory or equivalent marker left by `npx playwright init-agents`). When available, QA Agent may delegate Planner/Generator sub-tasks to those agents. If not available, the QA Agent uses its own prompt contracts — there is no hard dependency on the official Test Agents.

---

### 3.4 Execution & Evidence

#### Playwright Config

If the target repo does not yet have a `playwright.config.ts`, the QA Agent creates one at the project root. If a config already exists, the QA Agent writes a temporary override config at `.alloy/tasks/<task-id>/qa/playwright.config.override.ts` and runs with `npx playwright test --config=<override-path>`, so the project's existing config is not modified.

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120_000,          // per-test: 2 min (default)
  use: {
    screenshot: 'on',
    video: 'on',
    trace: 'on',
    storageState: '.playwright/.auth/qa.json',
  },
  reporter: [['html'], ['line']],
});
```

Note: QA Agent can override `outputDir` and `testDir` per-run to target `.alloy/tasks/<task-id>/qa/artifacts/` so Playwright's automatic outputs land in the right per-task directory. Explicit checkpoint screenshots use `qaArtifact()` (defined in Generator section above). Automatic failure capture from Playwright should also be collected into the same artifact tree (via `outputDir` override or post-run symlink/copy).

#### Timeout & Watchdog Policy

| Scope | Default | Configurable via | Behavior on expiry |
|---|---|---|---|
| Per-test | 120s | `playwright.config.ts` `timeout` | Test marked failed; Healer triages |
| Per-test step | 30s | `test.step({ timeout: 30_000 })` | Step fails; test proceeds if non-fatal |
| Per-phase (Planner / Generator / Healer) | 10 min | Skill invocation flag | Phase aborted; control returns to QA Agent |
| Global QA run | 45 min | Skill invocation flag | QA Agent writes partial report + timeout notice; user decides retry or accept partial |
| Healer retry cycles | 3 max | Hard-coded (can be extended in v2) | After 3 cycles with unresolved failures, escalate to user with `healer.md` summary |

This is the mechanism for Design Belief 1 enforcement at the time dimension — no prompt-based "please don't hang" but a hard phase timeout with fallback behavior.

QA Agent can temporarily override config for a specific run (e.g. `retain-on-failure` instead of `on` for all).

#### Artifact Output

```text
.alloy/tasks/<task-id>/qa/artifacts/
  screenshots/
    ac1-nav.png
    ac1-after-submit.png
    ac2-validation-errors.png
  videos/
    ac1-flow.webm
  gifs/
    ac1-flow.gif                          # ffmpeg post-process (optional)
  figma/
    reference-frame.png                   # from FIGMA_TOKEN / REST API
    design-context.json                   # raw response from /v1/files/:key/nodes
  traces/
    trace-ac1.zip                         # Playwright trace archives
```

#### GIF Generation

```bash
PALETTE="/tmp/qa-gif-palette-$$.png"

ffmpeg -i video.webm \
  -vf "fps=10,scale=960:-1:flags=lanczos,palettegen" "$PALETTE"

ffmpeg -i video.webm -i "$PALETTE" \
  -lavfi "fps=10,scale=960:-1:flags=lanczos[x];[x][1:v]paletteuse" out.gif

rm "$PALETTE"
```

If `ffmpeg` is absent: skip GIF generation, link to `.webm` instead, note in doctor output.

#### Figma Comparison

If Figma context is available:
- Place reference frame PNG side-by-side with live screenshot in `report.html`
- Agent writes a text summary of differences (not pixel-perfect diffing in v1)
- Side-by-side images labeled "Figma reference" / "Live (Playwright)"

Future v2: Playwright `toHaveScreenshot()`, pixelmatch, Argos, Lost Pixel.

---

### 3.5 Reports

#### Custom Acceptance Report: report.html

```text
.alloy/tasks/<task-id>/qa/report.html
```

Self-contained static HTML. No server, no database. Structure:

| Section | Content |
|---------|---------|
| Summary | Work Item ID, URL, status, run metadata |
| AC Coverage | Table: AC → scenario → result → evidence link |
| User Paths | Per-path: status, checkpoints, screenshots inline, GIF/video embeds, trace link |
| Figma | Side-by-side reference vs live, agent notes |
| Failures/Risks | Unresolved failures, flagged product issues, notes |
| Links | Playwright native report, trace files, report-review.md |

#### Playwright Native Report (debug)

```text
.alloy/tasks/<task-id>/qa/playwright-report/index.html
```

Kept for deep debugging: trace viewer, console, network, action-by-action DOM snapshots.

#### Report Review: report-review.md

```text
.alloy/tasks/<task-id>/qa/report-review.md
```

Structure:

```markdown
# QA Report Review

## Overall
- [ ] Accepted
- [ ] Needs test fix
- [ ] Needs product fix
- [ ] Needs re-plan

## Per AC

### AC1: Submit succeeds
> [Screenshot](artifacts/screenshots/ac1-after-submit.png)
> [Video](artifacts/videos/ac1-flow.webm)
- Result: Pass
- Comment:
- Decision:                    # Accepted | Needs Fix | Needs Re-plan | Product Issue (pick one)

### AC2: Validation errors
> [Screenshot](artifacts/screenshots/ac2-validation-errors.png)
- Result: Pass
- Comment:
- Decision:                    # Accepted | Needs Fix | Needs Re-plan | Product Issue (pick one)
```

User annotates this via plannotator. Annotations drive Healer actions or trigger re-plan.

#### Cost Card: cost.md (optional)

```text
.alloy/tasks/<task-id>/qa/cost.md
```

Controlled by `QA_COST_TRACKING=on` env var. Off by default.

```markdown
# QA Cost

## Run Info
- Started: 2026-06-14 19:30 CST
- Ended:   2026-06-14 19:38 CST
- Duration: 8m 12s
- Model: claude-opus-4-8

## Token Breakdown
| Phase      | Input  | Output | Cost   |
|------------|--------|--------|--------|
| Planner    | 12,300 |  4,500 | $0.24  |
| Generator  | 18,000 |  6,200 | $0.35  |
| Healer     |  5,000 |  1,800 | $0.10  |
| Report     |  8,000 | 12,000 | $0.28  |
| **Total**  |**43,300**|**24,500**|**$0.97**|

## Pricing Reference
> ⚠️ Placeholder: the dollar amounts below are illustrative. Actual pricing depends on the model configured in the OpenCode runtime at QA run time. The wall-clock time and token counts are the useful real metrics; dollar amounts exist as a reference template.
- Example model pricing: $15/1M input tokens, $75/1M output tokens (update per your actual model)
- If the runtime does not expose per-phase token breakdowns, report only wall-clock time and total tokens.
```

#### Report Gate (HARD gate)

1. `report.html` and `report-review.md` generated
2. User reviews and annotates `report-review.md`
3. If annotations ask for fixes → Healer runs, re-executes, regenerates report → user reviews again
4. If annotations ask for re-plan → back to Planner gate
5. If accepted → `gates.md` updated: `[x] Report reviewed`, `[x] QA Accepted`

---

### 3.6 File Layout

```text
# Reusable assets (committed)
tests/e2e/
  azure-<work-item-id>-<slug>.spec.ts

# Per-run artifacts (.alloy/)
.alloy/tasks/<task-id>/qa/
  context.md
  plan.md
  plan-annotations.md
  gates.md
  healer.md
  report.html
  report-review.md
  cost.md                          # optional (QA_COST_TRACKING=on)
  artifacts/
    screenshots/
    videos/
    gifs/
    figma/
    traces/
  codegen/
    path-login.spec.ts
    path-complex-navigation.spec.ts
  playwright-report/
    index.html

# Credentials (never committed)
.env                               # optional credential file
.playwright/.auth/
  qa.json                          # storageState (gitignored)
```

#### Gitignore Requirements

```
.env
.playwright/.auth/
```

These MUST be added to both repo root `.gitignore` and `.alloy/.gitignore`.

---

### 3.7 Alloy Pack Registration

#### New Skill

```text
universal/skills/alloy-qa-e2e/SKILL.md    # entry skill
universal/skills/azure-devops-context/SKILL.md  # Azure DevOps wrapper (sub-skill)
```

#### New Agent

```text
agents/QA.md                              # QA Agent prompt
```

#### Atoms Registration

In `packs/atoms.json`, add to the existing `"atoms"` object (do NOT nest another `"atoms"` key):

```json
// Inside packs/atoms.json — add to the existing "atoms" object:
"alloy-qa-e2e": {
  "skills": ["alloy-qa-e2e", "azure-devops-context"],
  "agents": ["QA"]
}
```

Note: the atom ID uses the `alloy-` prefix convention consistent with existing atoms (`alloy-baseline-5`, `alloy-workflow-extras`).

#### Pack Extends

Add `"alloy-qa-e2e"` to the `extends` array of the target pack(s). The actual atom IDs in `packs/core.json` follow a different convention than shown here — the spec atom ID is `alloy-qa-e2e`, so the extends entry is:

```json
// Inside packs/core.json — add to the existing "extends" array:
"extends": ["alloy-baseline-5", "alloy-workflow-extras", "alloy-primary-agents", "alloy-commands", "mcp-baseline", "alloy-qa-e2e"]
```

(The existing atom IDs in core vary; the implementer should match the current file. This example is schematic — the key change is appending `"alloy-qa-e2e"`.)

---

### 3.8 Dependencies (doctor checks)

| Dependency | Required | Note |
|---|---|---|
| Node 20+ | ✅ Required | |
| Bun 1.1+ | ✅ Required | OpenCode plugin deps |
| Playwright (`npx playwright --version`) | ✅ Required | Core execution engine |
| Chromium browser | ✅ Required | `npx playwright install chromium` |
| Azure CLI (`az --version`) | Optional | For Azure DevOps work item fetch |
| `azure-devops-context` skill | Optional | Wraps Azure CLI; only needed for Azure DevOps work items |
| 1Password CLI (`op --version`) | Optional | For 1Password credential provider |
| `OP_SERVICE_ACCOUNT_TOKEN` | Optional | Enables 1Password provider |
| FIGMA_TOKEN | Optional | Enables Figma REST API |
| ffmpeg | Optional | For GIF generation |
| Doctor: `.gitignore` compliance | ✅ Required | `.env`, `.playwright/.auth/` must be in gitignore (checked by doctor) |
| Playwright Test Agents | Optional | `npx playwright init-agents` (detected via `.playwright/agents/` directory marker) |

---

### 3.9 Agent Lifecycle

```text
User invokes alloy-qa-e2e skill
  ↓
Skill spawns QA Agent (async)
  ↓
QA Agent runs context → plan
  ↓
QA Agent pauses at plan gate → notifies user
  ↓
User annotates plan → continue
  ↓
QA Agent runs generator → execution → report
  ↓
QA Agent pauses at report gate → notifies user
  ↓
User annotates report → continue
  ↓
QA Agent runs healer (if needed) → finalizes
  ↓
QA Agent exits with summary
```

Agent isolation: each QA run is an independent agent invocation. No shared mutable state between runs except the committed spec files in `tests/e2e/` and the `.alloy/tasks/<task-id>/qa/` artifacts.

---


### 3.10 Security & Credential Safety

#### Credential Leak Prevention (Code Enforcement)

Design Belief 1 requires code-level enforcement of credential-safety rules, not prompt-based guidance. The following mechanisms are MANDATORY:

1. **Post-execution secret scan:** Before finalizing `report.html`, the QA Agent MUST grep all artifact files (screenshots filenames, report HTML, context.md, plan.md, healer.md) for any value from `.env` (`APP_USERNAME`, `APP_PASSWORD`, `APP_BASE_URL` substrings). If found, redact the value and log the redaction in `gates.md`:
   ```markdown
   - [x] Secret scan passed
   - [ ] Secret scan found leakage — redacted (see healer.md)
   ```

2. **Screenshot content safety:** If a screenshot filename or DOM snapshot contains a URL with query parameters that look like tokens (`?token=...`, `?access_token=...`), the QA Agent MUST NOT attach that screenshot to the report — link a placeholder noting "redacted for credential safety."

3. **Trace file isolation:** Playwright `.zip` trace archives contain full DOM snapshots, network requests, and console output — including potential secrets from POST bodies, response headers, or console logs. `.alloy/tasks/` traces MUST be gitignored. The report should include a note: "⚠️ Playwright trace files contain full page state and may include credentials. Review before sharing."

4. **Agent credential hygiene:** When the QA Agent reads credentials via `op read` or `.env`, it MUST inject them directly into the Playwright login flow (process memory only). Credentials MUST NEVER be written to `context.md`, `plan.md`, `report-review.md`, or any markdown artifact. If the OpenCode runtime logs agent tool calls, credentials may appear in session logs — the 1Password Security Note below must be displayed to the user at skill activation time.

#### 1Password Security Note

> ⚠️ When using the 1Password credential provider: `OP_SERVICE_ACCOUNT_TOKEN` is itself a credential. Never hardcode it in skill configs, prompt files, or repo artifacts. Export it as a shell env var before starting OpenCode: `export OP_SERVICE_ACCOUNT_TOKEN=<token>`. The token should be scoped read-only to a dedicated vault. If compromised, immediately rotate via `op service-account create --vault qa-test-creds:read_items` (which invalidates the old token).

#### .gitignore Audit

`alloy doctor` MUST check that the following paths are gitignored in both repo root and `.alloy/.gitignore`:
```text
.env
.playwright/.auth/
```
Additionally, `.alloy/tasks/*/qa/artifacts/traces/` MUST be gitignored (Playwright trace archives may contain full DOM snapshots with credentials). Add to `.alloy/.gitignore`:
```text
tasks/*/qa/artifacts/traces/
```
If any of these are missing, `alloy doctor` reports an error (not a warning — this is a credential leak risk).

## 4. What v1 Does NOT Cover

- Jira / Linear / GitHub Issue tracker integration (only Azure DevOps)
- Mobile viewport testing
- Performance / Lighthouse audit (can add later)
- Visual regression pixel-diffing (side-by-side human review only)
- SSO / MFA login automation (manual storageState workaround only)
- `op run` no-plaintext mode (1Password credential provider only, not env template)
- Dark mode testing
- Multi-browser testing (Chromium only)
- Recurring scheduled QA (one-off invocation only)
- Multi-user / persona flows

## 5. Success Criteria

1. User types "qa ADO-12345" → QA Agent spawns, fetches work item from Azure DevOps, produces `context.md`
2. After plan approval, `tests/e2e/azure-12345-<slug>.spec.ts` exists and passes `npx playwright test`
3. `.alloy/tasks/<task-id>/qa/report.html` opens in a browser and shows AC→results with screenshots inline
4. User can annotate `report-review.md` and QA Agent responds with healer/re-plan
5. With `OP_SERVICE_ACCOUNT_TOKEN` set, QA Agent fetches credentials from 1Password without prompting
6. With `QA_COST_TRACKING=on`, `cost.md` contains token/time/cost breakdown for the run
7. Running QA against the same work item twice produces consistent behavior (spec is re-usable)
