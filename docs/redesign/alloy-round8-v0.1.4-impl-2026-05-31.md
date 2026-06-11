# alloy round 8 — v0.1.4 实施 plan（逐文件，准备开干）

> 这是讨论的收口。rounds 5-7 把架构吵定了，这份不再讨论方向，而是**逐文件列改动 + wave 切分 + 工作量**。
> 写进 repo 准备开干。你在哪个 wave / 文件有异议就标，没有的话照这个执行。

---

## 0. 锁定的决定（rounds 5-7 + 今天两个新的）

**架构（rounds 5-7 已定）：**

| # | 决定 | 来源 |
|---|---|---|
| 1 | **5 个"不用造"**：subtask 工具 / Oracle agent / preset 层 / agentRoster / context 压缩工具 —— 全用现成或原生 | r6/r7 调研 |
| 2 | alloy 真实建造面 = **Write 层 + 薄编排 + 安装分发 + plugin 胶水**4 块 | r6 |
| 3 | Orchestrator **prompt-driven 委派**（照 OMO 形式，LLM 看规则表自己派） | r4/r6 |
| 4 | OpenCode 原生 Task 已隔离上下文 → **不造 subtask 工具** | r6 源码确认 |
| 5 | OpenCode 原生 `permission` glob 管 skill + MCP 可见性 → **砍 preset** | r7 源码确认 |
| 6 | deep-debugger = **Fixer escalation 规则**（卡 2 次 → alloy-debug + 提 opus），不是新 agent | r6 |
| 7 | Architect **rename Planner** | r4 |
| 8 | handoff vendor mattpocock，**默认 OS 临时目录** + `--persist`；phase 边界自动触发 | r5/r7 |
| 9 | **alloy-skills 拆独立 repo** + `--skills-source`（照 SuperPower v5） | r4/r6 |
| 10 | install **interactive**（pack + context 工具菜单），用户勾了**帮装帮 init** | r6/r7 |

**今天两个新决定：**

| # | 决定 | 理由 |
|---|---|---|
| 11 | **JSONL 全砍，纯 markdown**（方案 A）：gate evidence → progress.md checkbox，task → markdown 表，claim → `.lock` 文件 | 立场C 读代码证明 gate 只需单 task 范围；你的"为什么不能用 md"直觉成立 |
| 12 | **context 工具协调**：OpenCode 里 lean-ctx 是 MCP（不抢 bash 管子），RTK 是 plugin，天然共存；alloy 检测+调各自安装器+多个自动压缩器才警告 | 今天实测 OpenCode 配置 |

**deny-only（blocklist）**：agent frontmatter 只列要藏的 skill/MCP（`{ "alloy-tdd": "deny" }`），其余默认可见（你 r7 定的）。

---

## 1. ★ 状态层新设计（markdown-only，最大的改动）

这是 v0.1.4 的核心，先单独说清楚，因为它推翻现有的 `.alloy/state/*.jsonl`。

### 1.1 现状（要拆掉的）

```
.alloy/state/
  tasks.jsonl      claims.jsonl      evidence.jsonl      runs.jsonl
.alloy/projections/
  status.md        current-plan.md   (从 jsonl 渲染)
```
- gate（`alloy.mjs:1414-1453`）读 evidence.jsonl 按 taskId 过滤查 kind
- plugin（`alloy-plugin.ts:632`）`tool.execute.after` 往 evidence.jsonl append

### 1.2 新结构（纯 markdown）

```
.alloy/
  .gitignore              ← NEW（之前根本没有，secret 都没挡）
  PROJECT.md              ← commit：项目愿景 + 任务表（替 tasks.jsonl）
  workflow.md             ← commit：保留
  policies/*.md           ← commit：保留（claims/tdd/review/debug 政策）
  tasks/<task-id>/
    plan.md               ← commit：计划 + 验收标准 checkbox
    progress.md           ← commit：## Gate / ## Iterations / ## Findings / ## Handoff 小节
    .lock                 ← gitignore：owner session-uuid + 时间（替 claims.jsonl）
  run/<id>/env            ← gitignore：secret
```

**projections/ 整个删掉** —— 之前它把 jsonl 渲染成人话 markdown；现在 state 本身就是 markdown，没有要 project 的源了。少一层。

### 1.3 gate 怎么变（evidence.jsonl → progress.md checkbox）

progress.md 里一块结构化区：
```markdown
## Gate (本 task)
- [x] tdd_red    — 失败测试已写
- [x] green      — 测试通过
- [ ] review     — 待 Reviewer
```
- gate check 读这块 checkbox（替 jsonl 查询）
- plugin `tool.execute.after` 检测到 git commit / 测试 exit 0 → **自动勾对应 box**（信条 #1 自动 emit 保留，只是写 markdown 不写 jsonl）
- 这就是你接受的"markdown read-modify-write 略脆但状态量小扛得住"那个 tradeoff

### 1.4 git commit 边界（4 立场 agent team 裁决）

| 路径 | 处置 |
|---|---|
| `PROJECT.md` / `tasks/<id>/plan.md` / `progress.md` / `workflow.md` / `policies/` | **commit**（人的产出，随 repo 走） |
| `.lock` / `run/<id>/env` | **gitignore**（ephemeral / secret） |
| `projections/` | **删除**（不再存在） |

team 结论：3:1 倒向"人写的 markdown 进 git，机器噪音不进"；立场C 用代码证明 gate 不需要持久/防篡改的 jsonl（防篡改是 CI 的活）。

---

## 2. 建造面 = 4 块（r6 收敛）

| 块 | alloy 干什么 | 不干什么 |
|---|---|---|
| **Write 层** | `.alloy/` markdown 状态 + handoff + phase 边界自动 handoff | 不上 DB / 不上 JSONL |
| **薄编排** | phase 状态机 + agent frontmatter（deny-only skill+MCP）+ 委派规则表 + Fixer escalation + 配模型 | 不造 subtask（原生）/ 不造 preset（原生）/ 不造 agentRoster |
| **安装分发** | interactive install + context 工具菜单（检测+调各自安装器+协调）+ alloy-skills 拆 repo + vendor sync + 企业 fork | 不重写各工具的安装逻辑 |
| **plugin 胶水** | auto-emit（git commit→勾 progress.md）+ runtime-detect OMO 共存 | filter skill 交给原生 permission |

Select/Compress/Isolate 三层全用现成（CodeGraph/RTK/lean-ctx/Magic Context + OpenCode 原生 Task）；alloy 只自建 **Write + 编排**。

---

## 3. 三个 Wave（逐文件 + 工作量）

> 建议版本映射：**Wave 1+2 = v0.1.4**（状态层 + 编排，是核心）；**Wave 3 = v0.1.5**（安装分发，工程量大可独立）。你可调。

### Wave 1 — 状态层重构（markdown-only + git hygiene + phase 状态机）

最重，是地基。

| 文件 | 改动 |
|---|---|
| `templates/alloy/.gitignore` | **NEW**：ignore `run/`、`*.lock`、（删 `projections/`） |
| `templates/alloy/` 结构 | 删 `projections/`；`tasks/<id>/` 用 plan.md + progress.md |
| `bin/alloy.mjs` gate check (1414-1453) | 重写：读 progress.md `## Gate` checkbox，不读 evidence.jsonl |
| `bin/alloy.mjs` `state` 子命令 | 重写 add-task/add-evidence/add-claim/list：读写 markdown（PROJECT.md 表 / progress.md / .lock），不写 jsonl |
| `bin/alloy.mjs` install | 写 `.alloy/.gitignore`；`MANAGED_NAMES` 去掉 state jsonl |
| `templates/opencode/alloy-plugin.ts` (632) | `tool.execute.after`：检测 git commit/测试 → 勾 progress.md `## Gate`，不 append jsonl |
| `templates/opencode/alloy-plugin.ts` | **NEW**：phase 状态机 hook（plan→execute→verify 转换强制）|
| `templates/opencode/alloy-plugin.ts` | **NEW**：phase 边界自动 handoff（转 phase 时压缩写 progress.md `## Handoff`）|
| `scripts/test_*.py` / `test_resolver.mjs` | 改断言：jsonl → markdown |

**工作量**：~大（state 模型 + gate + plugin hook 全改，测试跟着改）。这块是 v0.1.4 的肉。

### Wave 2 — 薄编排（砍 preset + agent frontmatter + 委派 + Planner rename）

| 文件 | 改动 |
|---|---|
| `templates/opencode/alloy-plugin.ts` (38/98-115/588/683) | **删 preset**：activePreset 状态 / loadPresets / applyPreset / getActivePreset / config 预加载 / alloy_switch_preset 工具 |
| `packs/presets.json` | **删除** |
| `agents/Architect.md` → `agents/Planner.md` | rename + 更新引用（atoms.json / plugin COMMAND_SKILLS / 其他 agent 提到 Architect 处）|
| `agents/*.md` frontmatter（7 个） | `skill: allow` → deny-only glob（`{ "<要藏的>": "deny" }`）+ MCP glob（`{ "<mcp>_*": "deny" }`）|
| `agents/Orchestrator.md` | 加 7-agent 委派规则表（照 OMO "Delegate when/Don't delegate when" 形式）|
| `agents/Fixer.md` | 加 deep-debugger escalation 规则（卡 2 次 → alloy-debug + 提 opus）|
| `models/*.json` 或 agent frontmatter | 配模型：Explorer→Haiku（Isolate 省钱）|
| `packs/atoms.json` | Architect→Planner；去掉 presets 引用（如有）|

**工作量**：~中（主要是 prompt/config 编辑 + 删代码，逻辑不复杂）。

### Wave 3 — 安装分发（interactive install + context 工具 + skills 拆 repo + vendor sync + 企业）

| 文件 | 改动 |
|---|---|
| `bin/alloy.mjs` install | interactive（`prompts` 库）：pack 选 + context 工具勾选菜单 |
| `bin/alloy.mjs` | context 工具 wiring：检测 opencode.json 已装 → 对勾选缺失的调各自安装器（`rtk init -g --opencode` / magic-context setup / codegraph init）+ 多个自动压缩器警告 |
| `bin/alloy.mjs` | `--skills-source <url>` flag |
| 新 repo `lifeodyssey/alloy-skills` | 把 universal/skills + scope skills 拆出去 |
| `.github/workflows/vendor-sync.yml` | **NEW**：daily cron + claude-code-action + fusionType 4-tier 分流 |
| `vendor.lock.json` | 加 fusionType / sources[] / autoUpdate 字段 |
| `bin/alloy.mjs` | `alloy create-hub` + `alloy hub-sync`（企业 Case B）|
| `vendor/skills/.../handoff/` | vendor mattpocock handoff（OS 临时目录 + `--persist`）|
| 文档 | 企业 Case A（fork）+ Case B（create-hub）说明 |

**工作量**：~大（CLI + CI + repo 拆分 + 企业），建议拆成 v0.1.5 独立做，甚至再分 5a/5b。

---

## 4. 验证（v0.1.4 = Wave 1+2 ship 标准）

```bash
# 1. 单元 + e2e（断言已从 jsonl 改 markdown）
npm test
node --check bin/alloy.mjs
python3 scripts/audit_prompt_dependencies.py

# 2. 状态层：install 后 .alloy/ 是纯 markdown + .gitignore 挡了 secret
bash setup.sh --pack core --target local
ls .alloy/.gitignore                          # 存在
grep -q "run/" .alloy/.gitignore              # secret 挡了
test ! -d .alloy/state                        # 没有 jsonl 目录
test ! -d .alloy/projections                  # projections 删了

# 3. gate 走 markdown checkbox
#    在 OpenCode session 跑 plan→execute→verify，progress.md 的 ## Gate 被自动勾

# 4. preset 砍干净
grep -rq "alloy_switch_preset\|presets.json" templates/ packs/ && echo "FAIL: preset 残留" || echo "OK"

# 5. agent 可见性走原生 permission
grep -q "deny" agents/Planner.md              # frontmatter 有 deny glob

# 6. Architect 改名干净
test ! -f agents/Architect.md && test -f agents/Planner.md
```

---

## 5. 明确不在 v0.1.4（推迟）

- **Wave 3 全部**（install 菜单 / skills 拆 repo / vendor sync / 企业）→ v0.1.5
- **skill 编排细节**（什么时候哪个 skill 自动 fire）→ 你 r6 说"待会儿再说"，单独一轮
- **Magic Context / DCP 深度集成** → v0.1.5 装上后再调
- **多 runtime（Claude Code / Codex adapter）** → v0.3+（alloy 现在 OpenCode-only）
- **rate limit auto-resume / daemon / chain hash** → v0.3+

---

## 6. 复用的现有东西（不重写）

- `bin/alloy.mjs` `loadPack()` / `resolveConfig()` / `installCommand()` —— pack 解析不动
- `templates/opencode/alloy-plugin.ts` 现有 hook 框架 —— 加 phase 状态机，删 preset
- OpenCode 原生 `permission` glob —— 替 preset 做 skill/MCP 可见性
- OpenCode 原生 Task 工具 —— 替 subtask 做上下文隔离
- 现成 context 工具（CodeGraph/RTK/lean-ctx/Magic Context）—— 装不造
- `scripts/test_alloy_installer.py` fixture —— 改断言复用

---

## 7. 开干顺序建议

1. **先 Wave 1**（状态层）——其它都依赖状态模型，先把 jsonl→markdown 立稳
2. **再 Wave 2**（编排）——砍 preset + agent frontmatter，依赖 Wave 1 的状态机
3. Wave 1+2 跑通 + 测试绿 → **tag v0.1.4**
4. Wave 3 另起 v0.1.5

要不要我现在就开 Wave 1？还是你先标这份 plan。
