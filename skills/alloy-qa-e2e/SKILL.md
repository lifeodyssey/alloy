---
name: alloy-qa-e2e
description: Automated end-to-end QA — read acceptance criteria (Azure DevOps or manual), generate Playwright test plan, execute with screenshots/video/GIF, produce acceptance report. Uses Playwright CLI for deterministic, reportable execution.
---

# Alloy QA E2E

Trigger this skill when you want to QA-test a feature against its acceptance criteria. The skill spawns a QA Agent that runs the full pipeline: context → plan → generate → execute → report — with two approval gates where you review and annotate before proceeding.

## Trigger

- "qa ADO-12345"
- "QA test this card"
- "e2e test the feature at https://..."
- "run acceptance tests for ..."
- Any request to QA-test a web application with acceptance criteria

## Inputs

You will be asked for:
1. **Acceptance Criteria** — Azure DevOps work item URL/ID, or paste markdown AC
2. **Base URL** — the deployed app URL to test against (e.g. `https://app.example.com`)
3. **Figma (optional)** — a Figma frame link for design comparison

## Prerequisites

### Required
- `.env` with `APP_BASE_URL`, `APP_USERNAME`, `APP_PASSWORD` — OR — `OP_SERVICE_ACCOUNT_TOKEN` with 1Password CLI
- Playwright installed: `npx playwright install chromium`

### Optional
- `FIGMA_TOKEN` — for Figma design comparison
- Azure CLI (`az`) logged in — for Azure DevOps work item fetch
- `ffmpeg` — for GIF generation from video

## Pipeline

```
AC → context.md → plan.md → [GATE: your approval] → Playwright spec → execute → report.html → [GATE: your review] → done
```

## ⚠️ 1Password Security (READ BEFORE USE)

If using the 1Password credential provider:

> 1. **Token 只显示一次。** `op service-account create` 输出的 token 只会在终端打印一次。请立即把 token 复制到一个安全的地方（密码管理器），绝不要放进 `.env`、git repo、或任何文件里。设置方式：`export OP_SERVICE_ACCOUNT_TOKEN=<token>`。
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
>
> 4. **速率限制：** Business 每小时 10,000 次读；Teams 每小时 1,000 次。
>
> 5. **没有桌面 App 也能跑。**

## Output

All artifacts land under `.alloy/tasks/<task-id>/qa/`:

```
.alloy/tasks/<task-id>/qa/
  context.md          # Normalized AC + Figma context
  plan.md             # Test plan (review this!)
  gates.md            # Gate checkboxes
  report.html         # Acceptance report
  report-review.md    # Review & annotate this
  healer.md           # Healer fix log
  artifacts/
    screenshots/
    videos/
    gifs/
    figma/
    traces/
  playwright-report/
    index.html        # Native Playwright report (deep debug)
```

Reusable test spec:
```
tests/e2e/azure-<work-item-id>-<slug>.spec.ts
```

## .env Convention

```bash
APP_BASE_URL=https://app.example.com

# Credentials (plaintext — gitignored)
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
AZURE_DEVOPS_ORG=
AZURE_DEVOPS_PROJECT=
FIGMA_TOKEN=
```
