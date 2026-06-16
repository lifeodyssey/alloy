# QA APM / QA Agent Flow Review

> 供 plannotator 标注。这里是本轮改后的目标逻辑，不是完整 prompt dump。

## 1. QA flow

```text
context.md
→ plan.md
→ plannotator annotate plan.md
→ [GATE: user approves plan]
→ QA agent runs ACs itself with playwright-cli / browser automation
   - not human clicking
   - not reusable spec first
   - independent AC paths may run in parallel via one-shot subagents
→ evidence.md
→ report.html + report-review.md
   - evidence is embedded directly under each AC/spec row
   - GIF first, video fallback, PNG checkpoint/fallback
   - includes exact elapsed time, exact token/cost when usage is available, or explicit unavailable reason
→ plannotator annotate report.html
→ plannotator annotate report-review.md
→ [GATE: user accepts QA]
→ optional final codegen/reusable Playwright spec
```

## 2. .env / credentials

`QA.md` treats `.env` as runtime config only:

- `APP_BASE_URL`, `APP_LOGIN_URL`
- `APP_USERNAME`, `APP_PASSWORD`
- `APP_USERNAME_OP_REF`, `APP_PASSWORD_OP_REF`, optional `APP_TOTP_OP_REF`
- `APP_USERNAME_SELECTOR`, `APP_PASSWORD_SELECTOR`, `APP_SUBMIT_SELECTOR`
- `FIGMA_TOKEN`

Credential priority:

1. If `OP_SERVICE_ACCOUNT_TOKEN` + `APP_*_OP_REF` exist, use `op read`.
2. If 1Password fails, stop. Do not silently fallback to plaintext.
3. If no 1Password refs exist, use plaintext `.env` username/password.
4. Never write credentials to markdown/html/log/screenshot filenames.

## 3. Azure DevOps logic

- If source is Azure DevOps URL or work item id, use `azure-devops-context`.
- That skill may call `az boards work-item show`.
- If `az` is missing or not logged in, stop and show the exact failing command.
- No blind retry.

## 4. Figma source selection

No hard-coded priority. QA agent detects available sources, explains each, then asks the user to choose.

| Source | What it is | Best for | Requirements |
|---|---|---|---|
| `FIGMA_TOKEN_REST` | Direct Figma Cloud REST API | background batch fetch, CI-like QA, node JSON + PNG assets | `FIGMA_TOKEN` env var |
| `figma-official MCP` | MCP tool server for Figma | interactive agent tool calls | MCP installed/authenticated |
| `silships/figma-cli` | local Figma Desktop control | local/offline Figma workflows, `verify --measure`, `spec --check`, export PNG/SVG/JSX/tokens/DESIGN.md | Figma Desktop open; safe mode needs FigCli plugin; yolo mode patches desktop |
| `iannuttall/figma-cli` | read-only `fig` CLI | inspect/export/text/styles/tree/search/diff | CLI auth |

Recommended wording:

- Choose `FIGMA_TOKEN_REST` for automated background QA.
- Choose `silships/figma-cli` when you want local Figma Desktop verification or design-system export.
- Choose `figma-official MCP` when MCP auth is already set up.
- If chosen source fails, stop and ask whether to switch source. Do not silently fallback.
- If user skips Figma, record `Figma: skipped` in `context.md`; do not block QA.

## 5. Evidence priority

Primary evidence is GIF-first:

1. GIF for short flows (`artifacts/gifs/`) — primary visual proof.
2. Raw video (`artifacts/videos/`) — fallback/source if GIF generation fails or loses detail.
3. PNG screenshots (`artifacts/screenshots/`) — only stable checkpoints or fallback.

Report layout should not hide evidence behind links. Put evidence inline under each AC/spec row:

```text
AC-1: User can submit form
  Result: Pass
  Evidence:
    [inline GIF]
    [video fallback link]
    [PNG checkpoint fallback]
  Notes:
    console/network/Figma delta
```

## 6. Run cost accounting

`report.html`, `report-review.md`, and `cost.md` include concrete time and cost accounting.

Mandatory exact fields:

- `started_at`
- `ended_at`
- `duration_seconds`
- human-readable duration

Token/cost fields:

- `usage_source`: runtime usage metadata / transcript / unavailable
- `input_tokens`
- `output_tokens`
- `total_tokens`
- `price_source`
- `model_cost`
- `external_tool_cost`
- `total_known_cost`

Rule: do not silently estimate. If OpenCode/GitHub Copilot/runtime does not expose per-run tokens, write `unavailable (provider did not expose per-run usage)`. If usage and price are known, compute the exact cost with:

```text
(input_tokens * input_price_per_mtok + output_tokens * output_price_per_mtok) / 1_000_000
```

External tool cost notes:

- `az`, `op`, and local `figma-cli` are normally no per-run marginal cost.
- Figma REST/API is account/subscription-level unless the provider exposes per-request billing.
- access tokens / credentials are never included.

## 7. Parallel subagents

QA agent may dispatch one-shot subagents when AC paths are independent.

Rules:

- one browser context per subagent
- artifact prefix per AC (`AC-<id>/...`)
- do not parallelize paths that mutate the same account state or shared fixture
- merge findings into `evidence.md` before report generation

## 8. APM package

`packages/apm-qa` installs QA with APM:

```bash
apm install /path/to/alloy/packages/apm-qa --target opencode
```

It installs:

- `.opencode/agents/qa.md`
- `.opencode/commands/qa.md`
- `.agents/skills/alloy-qa-e2e`
- `.agents/skills/azure-devops-context`
- `.agents/skills/playwright-cli` from upstream `microsoft/playwright-cli`, pinned by commit SHA in `packages/apm-qa/apm.yml`
- OpenCode MCP config for `context7` and `figma-official`

Smoke test passed in a temp repo:

```bash
apm install /Users/lumimamini/opencode-team-config/packages/apm-qa --target opencode
```

and verified upstream `playwright-cli` references are present, including `references/video-recording.md`.

## 9. Report annotation decision

Confirmed: do both.

- `report.html` is annotated with plannotator.
- `report-review.md` is also generated as the stable markdown annotation surface.
