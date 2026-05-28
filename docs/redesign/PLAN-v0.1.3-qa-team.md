# Plan: Alloy v0.1.3 — team-grade QA skill chain

> 写于 2026-05-29, after 3 Explore subagents (业内 QA tool survey / 1pwd-az-figma feasibility / test-case-writer + report patterns) + 1 Plan subagent (implementation blueprint) + 4 user decisions via AskUserQuestion.
> Final destination: `/Users/lumimamini/opencode-team-config/docs/redesign/PLAN-v0.1.3-qa-team.md`

---

## A. Context — 为什么要这个 plan

v0.1.2 ship 完后，`alloy-qa` (507 行) 仍是 single-user 浅 QA 形态，团队场景三大缺：

1. **账号 + OTP**：测试要切多 Profile（External / Internal / Admin），现在 password / TOTP 都靠 user 手粘贴
2. **任务驱动**：QA 入口是"我给你一个 ADO 卡片链接 + Figma 设计稿"，alloy-qa 现在不会读卡也不会看设计
3. **证据网页化**：现在 evidence 散在 `.alloy/qa-reports/<ts>/screenshots/*.png` + `issues.md`，跨部门分享差

v0.1.3 把这三块补齐。原 11-phase / 8-rubric / WTF-likelihood / Phase 8e.5 regression / `--report-only` contract **一字不动**。新增 Phase 0 (ingest) + Phase 0.5 (derive)，修改 Phase 1/3/4/5/10，其他 phase 不碰。

## B. User decisions (Phase 4 AskUserQuestion 已 pin)

| 决策点 | 选择 | 含义 |
|---|---|---|
| Skill 切分 | **4-skill chain** | alloy-qa-ingest + alloy-qa-derive + alloy-qa (modified) + alloy-qa-report。每个 200-280 行。 |
| 1Password 路径 | **op CLI + Service Account 直走** | doctor 检查 op CLI + OP_SERVICE_ACCOUNT_TOKEN env，无则 fallback 到 .env + 警告 |
| Figma MCP | **官方直接默认** | `https://mcp.figma.com/mcp` URL-based，用户须有 Dev seat |
| Wave 4 顺序 | **playwright-cli 继续用，az 在 skill prompt 教 LLM 调** | 不切 Playwright MCP，不做 alloy_load_card / alloy_load_figma plugin tool wrap |

**含义**：原 Plan agent 推荐的 5 个 plugin tool 砍到 3 个（`alloy_load_profile` / `alloy_resolve_otp` / `alloy_generate_qa_report`）。ADO + Figma 都靠 skill prompt 里教 LLM 直接调 CLI 或 MCP tool，不走 plugin wrap。

## C. File tree

```
universal/skills/
  alloy-qa/SKILL.md                       # 507 → ~620 行: Phase 0/0.5 hand-off + Phase 1/3/4/5/10 改; Phase 2/6/7/8/9/11 不动
  alloy-qa-ingest/                        # NEW
    SKILL.md                              # ~280 行: az CLI + Figma MCP + op CLI orchestration prompt
    templates/profile.example.json        # ~50 行: 2 profile example
  alloy-qa-derive/                        # NEW
    SKILL.md                              # ~220 行: 5-block AC→case prompt template + schema
    templates/case.schema.json            # ~60 行: JSON schema for cases.json
    templates/case-derivation.prompt.md   # ~70 行: 系统提示模板
  alloy-qa-report/                        # NEW
    SKILL.md                              # ~180 行: bundling instructions
    templates/index.html.tpl              # ~90 行: handlebars-style HTML 模板
    templates/report.css                  # ~70 行: vanilla CSS grid

templates/opencode/
  alloy-plugin.ts                         # 762 → ~950 行: +3 tools, +1 hook (env file cleanup), +loadProfiles 函数

packs/
  atoms.json                              # +1 atom "alloy-qa-team-chain", 改 alloy-workflow-extras 不再 include alloy-qa
  qa-team.json                            # NEW: pack = baseline-5 + qa-team-chain + frontend-skills

agents/
  Tester.md                               # +20 行: skill guidance 加 4 个新 skill 引用

bin/alloy.mjs                             # +120 行: doctor qa subcommand + alloy qa-report <ts> wrapper

vendor.lock.json                          # +2 entries (figma-mcp official URL, @1password/op-js npm pkg ref-only)

.alloy/                                   # 用户 runtime state (NOT in repo)
  profiles.json                           # 用户首次配 (alloy init --qa-profiles 半模板生成)
  test-cases/<task-id>/{source.json, cases.json, README.md, figma/}     # 新目录树
  qa-reports/<ts>/{index.html, manifest.json, screenshots/, videos/, traces/}  # schema 扩展
  run/<runId>/env                         # 临时 secret 文件, session.end hook 删
```

## D. Skill 详细设计

### D.1 alloy-qa-ingest (~280 行)

**Frontmatter**:
```yaml
---
name: alloy-qa-ingest
description: Use BEFORE alloy-qa execution to load Azure DevOps card + Figma assets + resolve account profile + 1Password secrets into a single source.json. Produces .alloy/test-cases/<task-id>/source.json.
allowed-tools: [Read, Write, Bash, Glob]
---
```

**Sections** (order):
1. Overview (one-line use case + announcement)
2. Inputs (ADO URL or work item id; profile name from profiles.json)
3. Phase 0a: Profile resolution → 调 `alloy_load_profile(profileName)` plugin tool, writes `.alloy/run/<runId>/env`
4. Phase 0b: ADO card fetch → **LLM 在 prompt 教里直接调 az**:
   ```bash
   az boards work-item show --id $ID --expand all --output json > /tmp/card.json
   jq -r '.fields."System.Description"' /tmp/card.json | pandoc -f html -t markdown > /tmp/desc.md
   grep -oP 'figma\.com/file/\K[^/]+' /tmp/desc.md  # extract figma file ids
   ```
5. Phase 0c: AC extraction → LLM 解析 markdown description 里 `## Acceptance Criteria` 或 `### AC` 段，输出 D.4 schema
6. Phase 0d: Figma fetch → 调 Figma MCP tool `download_figma_images({fileKey, nodeIds, format: "png", scale: 2})` 存到 `.alloy/test-cases/<id>/figma/`
7. Phase 0e: Write source.json (schema 见 §E.2)
8. Evidence emit: `qa_ingest_start` / `qa_ingest_profile_loaded` / `qa_ingest_card_loaded` / `qa_ingest_figma_pulled` / `qa_ingest_complete`
9. Failure modes: profile not found / op token missing / az not logged in / Figma rate limit / ADO 401
10. Hand-off: invoke `alloy-qa-derive` next

### D.2 alloy-qa-derive (~220 行)

**Frontmatter**:
```yaml
---
name: alloy-qa-derive
description: Derive executable test cases (Gherkin + JSON assertions) from a source.json. Outputs cases.json + human-readable README.md. One AC → 3 cases (happy + edge + error).
allowed-tools: [Read, Write, Glob]
---
```

**Sections**:
1. Overview
2. Preconditions (source.json must exist + validate against §E.2 schema)
3. **5-block derivation prompt template**:
   - BLOCK 1 — Feature description (from source.json `title` + `description`)
   - BLOCK 2 — Single AC text (one at a time, NOT batch)
   - BLOCK 3 — Visual contract (from Figma node JSON: required text, CTA labels, error states)
   - BLOCK 4 — Profile + preconditions (which login, what data state from source.json `profilesRequired`)
   - BLOCK 5 — Coverage directive: `{ happy: 1, edge: 1-2, error: 1 }`
4. Output schema (cases.json §E.3)
5. Quality bar (each case must have: gherkin steps ≥ 3 / assertions ≥ 1 / figmaAnchor present if applicable)
6. Markdown sidecar (README.md mapping table for PM-readable view)
7. Evidence: `qa_derive_start` / `qa_derive_case` (per case emitted) / `qa_derive_complete`
8. Hand-off to alloy-qa execution

### D.3 alloy-qa (modified, 507 → ~620 行)

**追加 Phase 0/0.5 hand-off section** 在 Workflow Phases 段顶部：
```markdown
## Phase 0: Task Ingestion (delegated)
If task derives from an ADO card, invoke `alloy-qa-ingest` first.
Skip if user passes raw URL (legacy mode).

## Phase 0.5: Case Derivation (delegated)
If source.json exists, invoke `alloy-qa-derive` to produce cases.json.
Skip if user passes `--cases <path>` explicitly.
```

**修改的 Phase**：
- Phase 1 Initialize (+12 行): 加载 cases.json 如有；bind `ALLOY_PROFILE_ENV` 到 .alloy/run/<runId>/env；run.json 记 figma node 数
- Phase 3 Orient (+15 行): 用 profile storage state 跳过 login；记录每路由 + 与 figma node 的对应
- Phase 4 Explore (+20 行): cases.json 存在时**执行 assertions** 而非 exploratory clicking; profiles required 时切 storage state
- Phase 5 Document (+8 行): bug 模板加 `derivedFromCase: <caseId>` field 当 bug 源于 derived case 失败
- Phase 10 Report (+15 行): 调 `alloy_generate_qa_report(ts)` plugin tool 自动渲染 HTML

**Phase 2/6/7/8/9/11 一字不动**。WTF-likelihood / 8-rubric / Phase 8e.5 / 15 important-rules 一字不动。

### D.4 alloy-qa-report (~180 行)

**Frontmatter**:
```yaml
---
name: alloy-qa-report
description: Bundle a .alloy/qa-reports/<ts>/ directory into navigable index.html with screenshots grid + video embeds + case-pass/fail matrix. Standalone runnable.
allowed-tools: [Read, Write, Bash, Glob]
---
```

**Sections**:
1. Overview (independently triggerable; Phase 10 auto-invokes via plugin tool)
2. Inputs (`<ts>` directory + optional template override path)
3. Read manifest.json (schema §E.4) + screenshots/ + videos/ + traces/ + issues.md
4. Render `index.html.tpl` with handlebars-like substitution (zero JS dep, vanilla `.replace`)
5. Output: `.alloy/qa-reports/<ts>/index.html` + relative path 引用 `screenshots/*.png` 和 `videos/*.webm`
6. Optional `--inline` flag: base64 embed everything (single-file, 限 < 10MB total artifacts)
7. Evidence: `qa_report_start` / `qa_report_complete` with path summary
8. CLI 平行入口: `node bin/alloy.mjs qa-report <ts>` 走同一 renderer

## E. Schemas

### E.1 .alloy/profiles.json

```json
{
  "version": 1,
  "profiles": {
    "acme-external": {
      "label": "Acme Tenant A (external user)",
      "tenant": "acme.com",
      "loginUrl": "https://app.acme.com/login",
      "credentials": {
        "username": "op://Work/AcmeExternalQA/username",
        "password": "op://Work/AcmeExternalQA/password",
        "totp":     "op://Work/AcmeExternalQA/one-time-password"
      },
      "storageStatePath": ".alloy/profiles/storage/acme-external.json",
      "preFlight": ["accept-cookie-banner", "dismiss-onboarding"]
    },
    "acme-internal-admin": {
      "label": "Acme Internal Admin",
      "loginUrl": "https://admin.acme.com/sso",
      "credentials": {
        "username": "op://Work/AcmeAdmin/username",
        "password": "op://Work/AcmeAdmin/password",
        "totp":     "op://Work/AcmeAdmin/one-time-password"
      },
      "storageStatePath": ".alloy/profiles/storage/acme-internal-admin.json"
    }
  }
}
```

### E.2 .alloy/test-cases/<task-id>/source.json

```json
{
  "id": "AB-1234",
  "title": "External user can self-serve password reset",
  "url": "https://dev.azure.com/acme/Project/_workitems/edit/1234",
  "state": "Active",
  "iterationPath": "Project\\Sprint 42",
  "fetchedAt": "2026-05-29T01:30:00Z",
  "description": "<sanitized markdown>",
  "acceptanceCriteria": [
    { "id": "AC-1", "text": "User clicks 'Forgot password' on login page", "kind": "given" },
    { "id": "AC-2", "text": "User receives reset email within 60s", "kind": "then" },
    { "id": "AC-3", "text": "Reset link expires after 15min", "kind": "constraint" }
  ],
  "assets": {
    "figma": [{ "url": "https://figma.com/file/abc/Reset?node-id=12-34", "label": "Reset desktop", "localPng": "figma/12-34.png" }],
    "attachments": ["mockup.png"]
  },
  "linkedItems": ["AB-1100"],
  "profilesRequired": ["acme-external"]
}
```

### E.3 .alloy/test-cases/<task-id>/cases.json

```json
{
  "taskId": "AB-1234",
  "generatedAt": "2026-05-29T01:32:00Z",
  "model": "claude-opus-4-7",
  "cases": [
    {
      "id": "AB-1234-TC-001",
      "ac": "AC-1", "kind": "happy",
      "title": "External user resets password via email link",
      "profile": "acme-external",
      "gherkin": [
        "Given I am on the login page",
        "When I click 'Forgot password'",
        "And I enter my registered email",
        "Then I should see 'Reset link sent' within 5 seconds"
      ],
      "assertions": [
        { "kind": "text-visible", "selector": "[data-testid=reset-confirmation]", "expected": "Reset link sent" },
        { "kind": "url-match", "expected": "/login/reset-sent" }
      ],
      "figmaAnchor": "node-12-34",
      "estimatedDuration": 30
    }
  ]
}
```

### E.4 .alloy/qa-reports/<ts>/manifest.json

```json
{
  "version": 1, "ts": "2026-05-29T01-30-00Z", "taskId": "AB-1234",
  "tier": "standard", "profile": "acme-external",
  "health": { "baseline": 76, "final": 94, "delta": 18 },
  "cases": [
    { "id": "AB-1234-TC-001", "status": "passed", "duration": 28,
      "screenshots": ["screenshots/tc-001-before.png", "screenshots/tc-001-after.png"],
      "video": "videos/tc-001.webm", "trace": "traces/tc-001.zip" }
  ],
  "issues": [{ "id": "ISSUE-007", "severity": "high", "status": "verified", "commit": "abc123" }]
}
```

## F. Plugin tools (3 个, 都新增)

### F.1 alloy_load_profile

```ts
alloy_load_profile: tool({
  description: "Resolve a profile from .alloy/profiles.json: shell `op read` each op:// ref, write env file (chmod 600), return env path + storageState path.",
  args: { profile: tool.schema.string(), purpose: tool.schema.string().optional() },
  async execute({ profile, purpose }) {
    const cfg = loadProfiles(projectDir)  // 新 helper
    const p = cfg.profiles[profile]
    if (!p) throw new Error(`Unknown profile: ${profile}`)
    const resolved = {}
    for (const [k, v] of Object.entries(p.credentials)) {
      if (v.startsWith("op://")) resolved[k] = execSync(`op read "${v}"`, {env: {OP_SERVICE_ACCOUNT_TOKEN: process.env.OP_SERVICE_ACCOUNT_TOKEN, ...}}).toString().trim()
    }
    const runId = randomUUID().slice(0, 8)
    const envPath = `.alloy/run/${runId}/env`
    writeFileSync(envPath, JSON.stringify(resolved), { mode: 0o600 })
    appendJsonl(projectDir, "evidence", { kind: "qa_profile_loaded", profile, purpose, runId, ts: new Date().toISOString() })
    return JSON.stringify({ envPath, storageStatePath: p.storageStatePath, runId, ttl: 900 })
  },
})
```

### F.2 alloy_resolve_otp

```ts
alloy_resolve_otp: tool({
  description: "Pull a fresh TOTP for a 1Password reference. Returns masked code in chat surface, plaintext to caller.",
  args: { opRef: tool.schema.string() },
  async execute({ opRef }) {
    const code = execSync(`op read "${opRef}"`).toString().trim()  // op auto-detects OTP if ref points to one-time-password field
    appendJsonl(projectDir, "evidence", { kind: "qa_otp_resolved", refMasked: opRef.replace(/[^/]+$/, "***"), ts: new Date().toISOString() })
    return JSON.stringify({ code, codeMaskedForChat: "******", validUntil: new Date(Date.now() + 30000).toISOString() })
  },
})
```

**Plugin hook 改动**: `tool.execute.before` 加 chat-surface mask — 如果工具返回 JSON 含 `codeMaskedForChat` field，chat history 只显示 mask 版本，full code 仅给调用 agent。

### F.3 alloy_generate_qa_report

```ts
alloy_generate_qa_report: tool({
  description: "Render .alloy/qa-reports/<ts>/index.html from manifest.json + templates/index.html.tpl. Phase 10 auto-invoke; CLI parallel: `alloy qa-report <ts>`.",
  args: { ts: tool.schema.string(), inline: tool.schema.boolean().optional() },
  async execute({ ts, inline = false }) {
    const dir = `.alloy/qa-reports/${ts}`
    const manifest = JSON.parse(readFileSync(`${dir}/manifest.json`, "utf8"))
    const tpl = readFileSync(`${alloyHome}/skills/alloy-qa-report/templates/index.html.tpl`, "utf8")
    const html = renderTemplate(tpl, manifest, { inline, baseDir: dir })  // 简易 {{var}} + {{#each}} 实现
    writeFileSync(`${dir}/index.html`, html)
    appendJsonl(projectDir, "evidence", { kind: "qa_report_generated", path: `${dir}/index.html`, caseCount: manifest.cases.length })
    return `Report: ${dir}/index.html`
  },
})
```

**Plugin hook 改动**: `session.end` hook 删 `.alloy/run/<runId>/env` 文件（即使 profile 没显式 unload 也清掉 secret 文件）。

## G. ADO + Figma skill prompt 教 LLM 调 (no plugin wrap)

### G.1 ADO 教法 (alloy-qa-ingest SKILL.md Phase 0b)

```markdown
## Phase 0b: ADO card fetch (LLM-driven az CLI)

Run these commands. Do NOT call any plugin tool — az is in PATH.

\`\`\`bash
# 1. fetch raw JSON
az boards work-item show --id $TASK_ID --expand all --output json > /tmp/card.json || \
  { echo "az failed — run 'az login' or check PAT"; exit 1; }

# 2. extract title, description, iteration
jq '{id: .id, title: .fields."System.Title", desc: .fields."System.Description", iter: .fields."System.IterationPath"}' /tmp/card.json

# 3. extract figma URLs from HTML description (if pandoc available, prefer markdown)
jq -r '.fields."System.Description"' /tmp/card.json | \
  grep -oP 'https://(?:www\.)?figma\.com/file/[a-zA-Z0-9]+(?:/[^"\s)]+)?'
\`\`\`

If `az boards work-item show` fails, **do not retry blindly** — surface the error to user with the exact command that failed. Common causes: not logged in, wrong organization default, missing PAT scope.
```

### G.2 Figma 教法 (alloy-qa-ingest SKILL.md Phase 0d)

```markdown
## Phase 0d: Figma asset fetch (Figma MCP tool calls)

For each Figma URL from Phase 0b, call MCP tools directly:

1. Parse URL: `https://figma.com/file/<fileKey>/<name>?node-id=<nodeId>`
2. Call `download_figma_images({ fileKey, ids: [nodeId], format: "png", scale: 2 })` → returns image URL
3. Save PNG to `.alloy/test-cases/<taskId>/figma/<nodeId>.png`
4. Call `get_node({ fileKey, nodeId })` → returns layout JSON with text, components, constraints
5. Save JSON to `.alloy/test-cases/<taskId>/figma/<nodeId>.json`

Figma MCP token comes from `FIGMA_PERSONAL_ACCESS_TOKEN` env var (set up by user during alloy init, doctor verifies).

If Figma MCP unreachable: emit `qa_ingest_figma_skipped` evidence with reason, continue without visual contract (Phase 0.5 derive falls back to text-only).
```

## H. Install / pack / vendor / doctor

### H.1 packs/atoms.json 改动

**新 atom**:
```json
"alloy-qa-team-chain": {
  "skills": ["alloy-qa", "alloy-qa-ingest", "alloy-qa-derive", "alloy-qa-report"]
}
```

**改 alloy-workflow-extras**: 删 `"alloy-qa"`（移到新 atom）。

**新 pack `packs/qa-team.json`**:
```json
{
  "id": "qa-team",
  "extends": ["alloy-baseline-5", "alloy-workflow-extras", "alloy-qa-team-chain", "alloy-v3-agents", "alloy-v3-modelRoles", "alloy-sdd-commands", "ralph-loop-skills", "ralph-loop-commands", "mcp-baseline", "frontend-skills"]
}
```

### H.2 vendor.lock.json 加 2 条

```json
{ "name": "figma-mcp-official", "kind": "mcp", "source": "https://mcp.figma.com/mcp", "version": "url-based", "license": "Proprietary (Figma Dev seat required)", "paths": [] },
{ "name": "1password-op-js", "kind": "npm-ref", "source": "https://www.npmjs.com/package/@1password/op-js", "version": "0.1.x", "license": "MIT", "paths": [], "note": "Referenced for documentation; alloy plugin shells op CLI directly, not via npm." }
```

### H.3 `alloy doctor qa` 新 subcommand (~80 行)

检查项（exit non-zero on missing required）:
- [REQ] `op --version` ≥ 2.0
- [REQ] `OP_SERVICE_ACCOUNT_TOKEN` env var set (or warn fallback to .env)
- [REQ] `.alloy/profiles.json` exists + validates schema
- [REQ] `az --version` present
- [WARN] `az account show` 成功（不强制，user 第一次跑会 az login）
- [REQ] `FIGMA_PERSONAL_ACCESS_TOKEN` env var set
- [WARN] Figma MCP `https://mcp.figma.com/mcp` 可达
- [REQ] playwright-cli skill installed (现有)
- [WARN] Node 20+ / Bun 1.1+

### H.4 install 时 `alloy init --qa-profiles`

新 init mode: 写一个 half-template `profiles.json`（含 2 个 placeholder profile + 注释），不替用户决定 vault 名 / op:// path —— user 编辑后跑 `alloy doctor qa` 校验。

## I. agents/Tester.md 改动 (+20 行)

skill guidance 加：
```markdown
- Use `alloy-qa-ingest` BEFORE `alloy-qa` when QA work derives from an ADO card.
- Use `alloy-qa-derive` when AC list needs systematic test case generation.
- Use `alloy-qa-report` to bundle evidence into HTML at the end of any QA run.
```

## J. Wave 切分 (3 wave, ~2.5 weeks total)

### Wave 1 — Foundation: profile + 1Password + ingest skill skeleton (5-7 天)

Scope:
- Build `alloy-qa-ingest` SKILL.md skeleton with Phase 0a (profile) + Phase 0b (az CLI) — skip figma + derive
- Add `alloy_load_profile` + `alloy_resolve_otp` plugin tools (~150 LOC in alloy-plugin.ts)
- Add `session.end` hook env cleanup
- Vendor.lock 加 1password-op-js ref-only entry
- `.alloy/profiles.json` schema + `alloy init --qa-profiles` mode
- `alloy doctor qa` subcommand (~80 LOC in bin/alloy.mjs)
- Tests: `scripts/test_alloy_installer.py` 加 profile + doctor 验证

Acceptance: chat 里说 "load profile acme-external"，agent 调 `alloy_load_profile`，返回 env path；env 文件 chmod 600 存在；session.end 后该文件消失。`alloy doctor qa` 输出可读 checklist。

### Wave 2 — Figma + AC derive (4-6 天)

Scope:
- Extend `alloy-qa-ingest` Phase 0d (Figma MCP calls) + Phase 0e (source.json write)
- Build `alloy-qa-derive` SKILL.md + 5-block prompt template + schemas
- Vendor.lock 加 figma-mcp-official entry
- DEFAULT_MCP 加 Figma 官方 MCP（enabled: true）
- Tests: source.json schema validation; 1 AC → 3 cases derivation 跑通

Acceptance: 给定真实 ADO card URL，`/qa-ingest AB-1234` 产出符合 §E.2 schema 的 source.json；接着 `/qa-derive` 产出符合 §E.3 schema 的 cases.json，含 happy/edge/error 各 1 个。

### Wave 3 — Execution mods + HTML report (4-6 天)

Scope:
- 修改 alloy-qa Phase 1/3/4/5/10（按 §D.3 列表）
- Build `alloy-qa-report` skill + index.html.tpl + report.css
- Add `alloy_generate_qa_report` plugin tool
- Add `alloy qa-report <ts>` CLI wrapper in bin/alloy.mjs
- Tests: end-to-end `/qa AB-1234` 跑通；HTML 报告在 browser 打开 OK

Acceptance: 端到端 `/qa AB-1234` 流程跑完，产出 `.alloy/qa-reports/<ts>/index.html` 内嵌 screenshots grid + 视频 + 案例 pass/fail 矩阵；`--report-only` 模式仍 respect（不跑 Phase 8 fix loop）。

## K. Verification (end-to-end test for v0.1.3 ship)

```bash
# 1. 单元 + e2e tests
npm test                              # 39 unit + 34 e2e 全过, 新增 ~5 个 e2e
node --check bin/alloy.mjs
python3 scripts/audit_prompt_dependencies.py

# 2. doctor qa
bash setup.sh --pack qa-team --target local --models github-copilot
alloy doctor qa                       # 输出 checklist, no [REQ] missing

# 3. End-to-end (需 1 个真实 ADO card + Figma Dev seat)
# 在 alloy install 的 target repo 跑 OpenCode session, 输入:
#   "QA card https://dev.azure.com/acme/Project/_workitems/edit/1234 with profile acme-external"
# 预期:
#   - Orchestrator 调 alloy-qa-ingest → source.json 写入
#   - alloy-qa-derive → cases.json 3 个 case
#   - alloy-qa Phase 1-10 跑完
#   - alloy-qa-report → .alloy/qa-reports/<ts>/index.html
#   - .alloy/run/<runId>/env 在 session 结束后消失
#   - .alloy/state/evidence.jsonl 含 qa_ingest_* / qa_derive_* / qa_* / qa_report_* 事件链

# 4. Tag + push
git tag v0.1.3
git push origin v0.1.3
gh release create v0.1.3 --notes-file docs/redesign/PLAN-v0.1.3-qa-team.md
```

## L. Critical files for implementation (paths to modify or create)

```
NEW universal/skills/alloy-qa-ingest/SKILL.md
NEW universal/skills/alloy-qa-ingest/templates/profile.example.json
NEW universal/skills/alloy-qa-derive/SKILL.md
NEW universal/skills/alloy-qa-derive/templates/case.schema.json
NEW universal/skills/alloy-qa-derive/templates/case-derivation.prompt.md
NEW universal/skills/alloy-qa-report/SKILL.md
NEW universal/skills/alloy-qa-report/templates/index.html.tpl
NEW universal/skills/alloy-qa-report/templates/report.css
NEW packs/qa-team.json
MOD universal/skills/alloy-qa/SKILL.md              (507 → ~620)
MOD templates/opencode/alloy-plugin.ts              (762 → ~950)
MOD packs/atoms.json                                (+1 atom, modify alloy-workflow-extras)
MOD vendor.lock.json                                (+2 entries)
MOD agents/Tester.md                                (+20 行 skill guidance)
MOD bin/alloy.mjs                                   (+120 行 doctor qa + qa-report subcommand + loadProfiles helper)
MOD scripts/test_alloy_installer.py                 (+5 e2e tests)
NEW docs/redesign/PLAN-v0.1.3-qa-team.md            (本 plan 文件的项目内拷贝)
```

## M. Existing functions/utilities to reuse

- `bin/alloy.mjs` `loadPack()` / `resolveConfig()` / `installCommand()` — pack expand 不动，新 atom 自动被 extends 解析
- `templates/opencode/alloy-plugin.ts` `appendJsonl()` (line 92) / `readJsonl()` (line 340) — 新 evidence kind 直接复用
- `templates/opencode/alloy-plugin.ts` `applyPreset()` (line 111) — 不动，preset 不参与 QA 流程
- `templates/opencode/alloy-plugin.ts` `tool({...})` 现有 5 个工具样板（line 683-751）— 新 3 个工具 follow 同 pattern
- `scripts/test_alloy_installer.py` 现有 fixture (tempdir-based) — 新 e2e tests 复用
- `vendor.lock.json` schema — 现有 entry 格式 follow 同 schema
- 现有 `alloy-qa` Phase 2/6/7/8/9/11 + WTF + 8-rubric + 15 important-rules + Phase 8e.5 — **一字不动**

## N. Open questions (need user decision pre-implement Wave 1)

### N.1 `alloy init --qa-profiles` 模板要不要含 1 个工作 example?

倾向 yes — 写 1 个 placeholder profile "example-tenant" 含全部字段注释，user 改 vault 名即可。

### N.2 OTP refresh interval

`alloy_resolve_otp` 每次调都拉新 code。LLM agent 可能在一个 30s 窗口里调多次。要不要加 cache (30s TTL)?

倾向 no cache —  alloy 信条"状态外置但极简"，且 op CLI 每次调成本极低。

### N.3 Figma MCP 失败时 derive 阶段降级策略

倾向 text-only — Phase 0d failed → emit `qa_ingest_figma_skipped` → alloy-qa-derive Phase 5 BLOCK 3 (visual contract) 跳过，case 只基于 AC 文本派生。质量降级明确告知 user。

## O. Notes on what's NOT in this plan

- **Playwright MCP 切换** — Wave 4 决策推迟，alloy-qa execution 继续 playwright-cli skill
- **Skyvern TOTP 模块借用** — 否决（AGPL 污染风险 + alloy 自己 op CLI 已够）
- **Allure 报告** — 否决（JVM 依赖违反信条 #6 零依赖），自己写 HTML template
- **Cross-machine profile sync** — alloy 不上 cloud / DB
- **Mabl/Functionize 集成** — 不集成 SaaS，借鉴 UX pattern only

End of v0.1.3 plan.
