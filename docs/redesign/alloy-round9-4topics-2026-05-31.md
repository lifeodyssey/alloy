# alloy round 9 — 你期望但我跳过的 4 个题目 + Wave 3 收回 v0.1.4

> 你 round 8 标了 2 条：(1) 我没讨论 **skill 编排 / MCP deny 注入 / agent prompt / 第三方 skill 融合**——这些你期望讨论；(2) **Wave 3 要做**（不推迟）。
> 这轮逐题给方案。现状我用一个跑成功的 Explore agent（skill 编排）+ 直接读 vendor.lock.json（融合）摸清了，不脑补。
> （另两个 survey agent 撞了 session 限额 5:50am 重置，但拿到的够了。）

---

## 题目 1 — skill 编排（什么时候哪个 skill fire）

### 现状（Explore agent 读 plugin.ts 确认）

- **COMMAND_SKILLS map**（plugin.ts:59-63）：`/plan→alloy-plan`、`/execute→alloy-execute`、`/verify→alloy-verify`、`/autopilot→alloy-autopilot`、`/discuss→alloy-discuss`、`/ralph-loop→ralph-loop`
- **3 个注入 hook**：
  - `command.execute.before`（661）：你敲 `/plan` → plugin 注入一句"Route /plan through the alloy-plan skill and record phase evidence"
  - `chat.messages.transform`（651）：过滤 `<available_skills>` 块（这里有 preset 过滤，r7 已决定砍）
  - `chat.system.transform`（655）：把 `.alloy/projections/status.md` 状态拼进系统提示词
- **关键现状**：所有 skill **都是 agent 手动 invoke**——plugin 只是注入"该用 alloy-plan"的提示，agent 自己读了去调。orchestrator.md 里有"什么活用什么 skill"的路由规则（小改→alloy-tdd / bug→alloy-debug / 设计→alloy-brainstorm / 复杂→alloy-plan）。

### 设计：skill 分 3 层，不同 fire 机制

你 r6 那句"只要 Debug 就要用 debug skill"点出了核心矛盾——**有些 skill 该强制 fire，不能靠 agent 自觉**。所以分 3 层：

| 层 | 哪些 skill | fire 机制 | 强制度 |
|---|---|---|---|
| **1. 命令绑定**（确定性） | /plan→alloy-plan 等 | COMMAND_SKILLS map，敲命令就路由 | 命令即触发 |
| **2. 强制触发**（信条 #1，gate 兜底） | execute→alloy-tdd、debug→alloy-debug、verify→alloy-verify | **gate 卡住**：progress.md 的 `## Gate` 没有 tdd_red/green checkbox 就不让 close execute | 跳不过 |
| **3. 菜单**（agent 自选） | alloy-map-codebase、humanizer、git-master 等 | permission 限定可见 + prompt 判断 | agent 自由裁量 |

**第 2 层是回答你"auto-fire"问题的核心**：不是用 prompt 求 agent"记得用 tdd skill"（会忘），而是**用 gate 强制**——gate 本来就查 tdd_red/green/review（立场C 读的代码），那本质就是"你到底用没用 tdd skill + review"。**skill 用没用 = gate 查 evidence**。debug 同理：Fixer 想 close 一个 bug task，gate 检查 progress.md 有没有 debug evidence，没有就打回"先走 alloy-debug"。

这样"什么时候哪个 skill auto-fire"就**不是 prompt 建议，是 gate 强制**——完全合信条 #1。

**reconcile round 8**：`chat.system.transform` 现在注入 `projections/status.md`——但 r8 决定删 projections/。改成**直接拼 PROJECT.md 任务表 + 当前 task 的 progress.md**（state 本身就是 markdown，没有要 project 的源了）。

---

## 题目 2 — MCP 的 deny 注入

### 机制（"注入"是什么意思）

r7 确认 OpenCode 原生 `permission` glob 管 MCP（`servername_*: deny`）。"注入"= alloy 把这些 deny 规则**写进 `agents/*.md` 的 frontmatter 源文件**，installer 原样 copy。不是 runtime 动态注入——是静态 frontmatter（deny-only blocklist，你 r7 定的）。

### 每 agent 的 MCP deny 矩阵（deny-only，只挡明显不该有的）

baseline MCP：`context7`（文档）、`grep_app`（代码搜索）、`exa`（网络搜索）。

| Agent | 留 | deny | 理由 |
|---|---|---|---|
| Orchestrator | 全部 | — | 它要路由，啥都可能看 |
| Explorer | context7, grep_app | **exa** | 代码发现，不是网络调研 |
| Planner | context7, exa | — | 设计要文档 + 网络调研 |
| Builder | context7 | **exa, grep_app** | 写代码要 API 文档，不要网络/广搜分心 |
| Fixer | context7, grep_app | **exa** | debug 要文档 + 找类似，不要网络 |
| Reviewer | context7 | **exa, grep_app** | review 只要文档 |
| Tester | context7（+ figma QA） | **exa, grep_app** | QA 要文档 + figma（v0.1.3） |

**诚实提醒**：per-agent MCP deny 收益是**轻**的（少几个工具 = 少噪音少 token），成本也低（就几行 frontmatter）。真正价值就一条——**别让 Builder 写代码写一半跑去 exa 网络搜索**。所以核心就 deny exa（最分心的），context7 哪都留（文档总有用）。要不要连 grep_app 都 deny 看你——我倾向只 deny exa，保守。

---

## 题目 3 — agent prompt（7 个 agent 提示词）

### 现状结构（Explore agent + Builder.md）

每个 agent .md：frontmatter（mode/permission/model）+ Responsibility + skill 引导 + permission 表。orchestrator.md 已有"什么活用什么 skill"路由规则。

### 每 agent prompt 的关键改动（不全文重写，只列要加/改的）

| Agent | prompt 关键改动 |
|---|---|
| **Orchestrator** | 加 **7-agent 委派规则表**（照 OMO "Delegate when / Don't delegate when" 形式，r6 你说照抄）+ 题目 1 的 3 层 skill 编排说明 |
| **Architect→Planner**（rename） | 吸收"架构 review"（OMO oracle 的架构那半归 Planner）；frontmatter 加 deny-only skill glob（藏 alloy-tdd/execute 等执行类） |
| **Builder** | "新代码**强制** alloy-tdd"（题目 1 第 2 层）；deny exa+grep_app；藏规划类 skill |
| **Fixer** | "debug **强制** alloy-debug"（不是可选）；加 **deep-debugger escalation**（同 bug 卡 2 次 → alloy-debug 深挖 + 提 opus）；deny exa |
| **Explorer** | 广扫；配 **Haiku**（Isolate 省钱）；deny exa |
| **Reviewer** | verify gate 入口；deny exa+grep_app |
| **Tester** | QA chain（v0.1.3 的 alloy-qa-ingest/derive/report）；deny exa+grep_app |

委派规则表样例（Orchestrator.md 里，照 OMO 形式）：
```markdown
## Delegation Rules
### @Planner (opus, ~2x cost)
Delegate when: 中大 feature / 多文件 / 跨模块 / 需 stress-test design
Don't: 单行 hotfix / config / typo
### @Fixer (sonnet)
Delegate when: bug 已复现 + 根因清楚 / 多文件 fix
Don't: <20 行小修已知根因 / 还没复现
### @Explorer (haiku, ~0.3x)
Delegate when: 广扫代码库 / 找 conventions / 找入口
Don't: 单点 grep
...（7 个全列）
```

具体每个 agent 的全文我开 Wave 2 时写（那是执行），这轮先把**结构 + 关键内容**跟你对齐。

---

## 题目 4 — 第三方 skill 融合

### 现状（直接读 vendor.lock.json）

11 条**静态 vendoring**，schema 是 `name/kind/source/version/upstreamPath/license/sha256/paths/vendoredAt`。**没有 fusionType、没有 sources[]、没有 autoUpdate、没有任何 sync 机制**——全手动。

vendor 的源：superpowers×3（brainstorming/debugging/tdd）、vercel-react、kotlin、postgres×3、terraform、ralph-loop、mattpocock-handoff。

### 设计：fusionType + sources[] + vendor-sync workflow

**1. vendor.lock.json 加字段**（标"alloy 怎么把上游揉进自己的 skill"）：

| fusionType | 含义 | 例子 |
|---|---|---|
| `verbatim` | 原样 copy，一字不改 | handoff、ralph-loop、scope skills（vercel/kotlin/pg/terraform）|
| `inline-append` | alloy 融合上游 + 追加自己的 | alloy-tdd（superpowers+mattpocock+team-tdd+alloy evidence）|
| `rewrite` | alloy 重写，只标 attribution | alloy-qa（gstack 太重，r6 你说"能重写"）|
| `concept-only` | 不 vendor，只借思想 | GSD 的 phase 模式 |

**2. 加 `sources[]`**：标一个 alloy skill 融了哪几个上游。例：
```json
{ "name": "alloy-tdd", "fusionType": "inline-append",
  "sources": ["superpowers-tdd@5.1.0", "mattpocock-tdd@main", "alloy-team-tdd-legacy@60a9207"] }
```

**3. 每 skill 融合策略表**：

| alloy skill | 上游 | fusionType |
|---|---|---|
| alloy-tdd | superpowers-tdd + mattpocock + team-tdd-legacy | inline-append |
| alloy-debug | superpowers-systematic-debugging | inline-append |
| alloy-plan/brainstorm | superpowers-brainstorming + writing-plans | inline-append |
| alloy-qa | gstack /qa | rewrite |
| handoff | mattpocock | verbatim |
| scope skills | 各自 | verbatim |
| ralph-loop | anthropics | verbatim |

**4. vendor-sync GitHub Actions**（Wave 3，按 fusionType 4-tier 分流）：daily cron + claude-code-action 检测上游 sha 变化：
- `verbatim` 变了 → **自动 PR**（重 copy + 更 sha，无脑合）
- `inline-append` 变了 → **draft PR**（保住 alloy 追加段，只更新上游段，人 review 合）
- `rewrite` 变了 → **开 issue**（人判断 alloy 重写要不要跟）
- `concept-only` → 不追踪

**5. 这些融合的 skill 住 `alloy-skills` 独立 repo**（Wave 3 拆分），vendor-sync 跑在那个 repo 上。

---

## Wave 3 收回 v0.1.4（你标注 2）

你说"我觉得要做"。收到，**Wave 3 不推迟，留在 v0.1.4**。更新版本映射：

**v0.1.4 = 全部 3 个 Wave**：
- Wave 1：状态层（markdown-only + git hygiene + phase 状态机 + gate→checkbox）
- Wave 2：薄编排（砍 preset + agent frontmatter deny-only + 委派规则 + deep-debugger + Planner rename + 题目 2/3 的 MCP deny + agent prompt）
- Wave 3：安装分发（interactive install + context 工具菜单协调 + alloy-skills 拆 repo + 题目 4 的 vendor-sync + 企业 fork/create-hub + handoff vendor）

工作量大（三 Wave 合一），但你要一起做就一起做。开干顺序还是 1→2→3，跑通了 tag v0.1.4。

---

## 这轮新增进 v0.1.4 的（题目 1-4 的产物）

| 题目 | 进哪个 Wave | 具体 |
|---|---|---|
| 1 skill 编排 | Wave 1+2 | gate 强制第 2 层 skill（tdd/debug/verify）；status 注入改 markdown |
| 2 MCP deny | Wave 2 | agent frontmatter 写 deny-only MCP glob（核心 deny exa）|
| 3 agent prompt | Wave 2 | 7 agent prompt 改（委派表 + 强制 skill + escalation + 配模型）|
| 4 第三方融合 | Wave 3 | vendor.lock 加 fusionType/sources + vendor-sync 4-tier workflow |

---

## 还想跟你确认的（这 4 题里我拿不准的）

1. **题目 1**：用 gate 强制 tdd/debug/verify skill（跳不过）——你认这个"skill 用没用 = gate 查 evidence"的等价吗？还是有些 skill 你想留弹性别强制？
2. **题目 2**：MCP deny 只 deny exa（保守）还是连 grep_app 也按表 deny（激进点）？
3. **题目 4**：fusionType 4 类够吗？alloy-qa 走 rewrite 你 r6 已认；其余按上表分你认吗？

你标完这 3 点（或直接说 OK），我就更新 round 8 的实施 plan 把这 4 题合进去，然后开 Wave 1。
