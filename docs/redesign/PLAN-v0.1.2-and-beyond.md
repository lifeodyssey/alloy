# Plan: Alloy v0.1.2 — concrete code changes (not roadmap)

> 写于 2026-05-26 evening, after plannotator session br4uo24aj + Explore deep-dive  
> v0.1.3+ 远期内容 strip 掉，本 plan 只 focus **v0.1.2 next concrete actions**  
> Final destination: `/Users/lumimamini/opencode-team-config/docs/redesign/PLAN-v0.1.2-and-beyond.md`

---

## A. 用户深 question 的 ground truth 答案 (TDD/QA 三家差异)

Explore agent 深读后真实差异（不再是抽象 "vertical slicing"）：

### TDD 四家区别（含 alloy 自己的 team-tdd 前身）

**重要**：alloy-tdd 是 **3-way fusion + team-tdd legacy** (4 sources)。team-tdd 不是 vendor 上游，是 **alloy 自己 v0.1.0 之前的早期版本**（git 历史 commit `60a9207:skills/team-tdd/SKILL.md` 98 行），含 **alloy 原创的 code constraints 和 Stack Companions routing**。

| 维度 | obra/superpowers v5.1.0 | mattpocock/skills | **team-tdd (alloy 前身)** | alloy-tdd (现状 348 行) |
|---|---|---|---|---|
| **核心 dogma** | "NO PRODUCTION CODE WITHOUT FAILING TEST FIRST" | "Integration-style only, never test implementation" | 借 Iron Law + 加 vertical slicing | 4-way 全融合 |
| **态度** | Punitive (8 项 anti-rationalization table) | Philosophical (test pain = design feedback) | 简洁 enforce | 严厉 + 智慧 + enforce |
| **Cycle 重点** | RGR 严格 + 看 test fail 是 proof | Design emerges from test difficulty | 短 RGR cycle + atomic commit | 全部继承 |
| **Vertical slicing** | — | ✅ 原创 (one test → one impl → repeat) | ✅ 借用 mattpocock (含 horizontal vs vertical 对比图) | 继承 |
| **Mocking 规则** | (一般) | ✅ Only at system boundaries (网络/DB/time), **绝不** mock 自己的 class | (借鉴 mattpocock 但只一行) | mattpocock 完整规则保留 |
| **Deep modules** | — | ✅ Small interface, deep implementation | — | mattpocock 概念保留 |
| **Code constraints (硬约束)** | — | — | ✅ **alloy 原创**: functions ≤10 行 / classes ≤50-100 行 / files ≤300 行 / ≤2 indentation / ≤3 params | **继承 team-tdd 原创** |
| **Stack Companions routing** | — | — | ✅ **alloy 原创**: React/TS → vercel-react-best-practices + next-best-practices + frontend-tdd; Kotlin/Spring → kotlin-agent-skills + dr-jskill; Terraform → terraform-skill; AWS → awslabs; Postgres → pg-aiguide | **继承 + 扩展** |
| **Anti-rationalization** | ✅ 8 项 excuse+反驳 table | — | — | 继承 superpowers |
| **References** | 1 内嵌 (testing-anti-patterns.md) | 5 vendored (tests/mocking/deep-modules/interface-design/refactoring) | 0 (98 行 single file) | 已 vendored 5 mattpocock + 引用 superpowers + 隐式继承 team-tdd |
| **Evidence ledger** | — | — | — | ✅ **alloy v3 新加** |
| **字数** | ~500 行 | ~? | **98 行** | 348 行 |

**alloy-tdd 一句话**: "Iron Law (superpowers) + integration-style/deep modules (mattpocock) + code constraints + Stack Companions routing (**team-tdd alloy 原创**) + evidence ledger (alloy v3 新加)"。

**关键 insight 给 Task 7** (反转之前的拆包决定)：

**用户决定**: "tdd 都融合一下，最终字数和行数都要多，能用原文就用原文"

→ **alloy-tdd 走 inline 模式** (不拆包):
- 把 4 source 全部 inline 进 SKILL.md
- 字数 only more not less
- 能用上游原文 verbatim 就用
- **超过 Anthropic 500 行 best practice 也接受**（用户明确决定）

预计最终大小: ~1300-1500 行（superpowers ~500 + mattpocock 5 ref ~300 + team-tdd ~98 + alloy 现有 fusion 348 + alloy-integration 段 ~100）。

**Case-by-case 原则**（区分 TDD vs QA）:

| Skill | 策略 | 理由 |
|---|---|---|
| **alloy-tdd** | inline 全部 4 source | 上游内容**轻量自包含**，能直接用 |
| **alloy-qa** | **重写**（不 vendor 上游） | gstack runtime 太重（gstack-* binaries / $B browse / ~/.gstack/），剥离后剩余内容**alloy 自己重写**更干净 |
| 其他 9 个 alloy-* skill | case-by-case 判断 | 看上游是否能直接 inline |

### gstack /qa 实现底层 (Explore agent 真挖到)

| 维度 | 真实情况 |
|---|---|
| **实现位置** | `garrytan/gstack/qa/SKILL.md` (**单文件 1647 行**, preamble tier 4) |
| **形态** | SKILL.md (不是 slash command 不是 bash script)，但内嵌全部 runtime 调用 |
| **11 phases** | Initialize / Authenticate / Orient / Explore / Document / Wrap Up / Triage / Fix Loop (8a-8f 含 **8e.5 mandatory regression test 含 codepath tracing + attribution + auto-increment filename**) / Final QA / Report / TODOS Update |
| **健康 rubric (8 类)** | console 15% / functional 20% / UX 15% / a11y 15% / links 10% / visual 10% / performance 10% / content 5% |
| **WTF-likelihood self-regulator** | Reverts +15% / multi-file +5% each / fix>15 +1%/每个 / low-severity +10% / unrelated +20% / **>20% stop, hard cap 50 fixes** |
| **gstack 重依赖** | `~/.claude/skills/gstack/bin/gstack-*` (update-check/config/slug/learnings-search/learnings-log/question-preference/timeline-log) + `$B` browse binary (Rust+Playwright) + `~/.gstack/` (learnings.jsonl/analytics/projects/) + test bootstrap Phase B (200+ 行) + telemetry |

### alloy-qa vs gstack /qa: 保留/剥离/替换 (alloy-qa 现状 377 行)

| 类别 | 内容 |
|---|---|
| ✅ **保留** | 11-phase workflow / 8-类 rubric (权重一致) / WTF-likelihood (20% 阈值 / 50-fix cap) / Phase 8e.5 regression / 框架-specific hints (Next/Rails/WordPress/SPA) / diff-aware mode / atomic commits |
| ❌ **剥离** | gstack preamble (100+ 行: update check/sessions/learnings/config/telemetry) / `gstack-*` binaries / `$B` browse / `~/.gstack/` 目录 / test bootstrap Phase B / learnings 系统 / question tuning / telemetry / project-scoped 路径 |
| 🔄 **替换** | `alloy_evidence` tool 替 `~/.gstack/analytics/` / `playwright-cli` skill abstraction 替 `$B` syntax / `.alloy/qa-reports/` 替 `~/.gstack/projects/` / 加 `--report-only` flag |

**一句话**: alloy-qa = gstack 的 workflow + discipline，剥离 runtime 依赖，用 evidence ledger + playwright-cli 抽象做 portable harness。

---

---

## 1. Context

### 为什么有这个 plan

今天 grill-me session 把 alloy roadmap 拍清后写了 v1 plan (`PLAN-v0.1.2-and-beyond.md`, 540 行)，推到 GitHub `8db7e62`。用户在 plannotator 里 review 给了 5 条反馈，**5 条都改变了 v1 plan 的方向**。这个 plan 文件存的是**修订后的方案**，下一步 ExitPlanMode 拿到用户批准后用 Edit 覆盖原 v1 plan。

### 5 条反馈 verbatim

1. **General**: "另外预装 source graph 和 rtk"
2. **On 版本号**: "这些都算 1.2"（指 v0.2 重构内容算 v0.1.2 系列）
3. **On install**: "我们能不能在 Install 的时候给用户选要装啥... 就像 npx skills 时一样"
4. **On skill inline**: "这个倒是可以融合一下 不过融合之后的字数只准多不准少"  
   后续追问: "这个还符合最佳实践吗？另外我好像没看到 qa skill，也没看到 omo slim 相关的缝合"
5. **On phase 命名**: "都叫 plan 吧"（spec phase → plan phase）

### OMO Slim 缝合真正目标（澄清后）

用户在 grill 中明确："filter-available-skills + **agent 的编排**，gsd 也做了 agent 的编排"。

通过 claude-mem 找到关键 observations：

- **ID 3904**: OMO Slim plugin 启动时加载 **9 agents + 11 hook managers + 6 tools + 3 MCPs + 10 hook points**。runtime preset tracking 是模块级 state。
- **ID 3901**: 架构对比 — GSD 是 `.planning/` state machine（disk-based, 30+ slash commands 驱动 phase），OMO Slim 是 plugin-level event-driven（runtime preset + health checks）。alloy 是 install-time pack distribution + JSONL ledger。
- **ID 2421**: alloy 旧版（v0.1.0 之前）曾经用过 OMO Slim 3-agent setup（plan-reviewer/executor/code-reviewer），后来 Card 4 重写成 7 v3 specialists。
- **ID 4446**: 用户曾明确说"prefer external state machine (OGSD-style) over SDK-managed state"。

**结论**：用户期待 alloy v0.1.x 把 OMO Slim 的 **plugin-level multi-agent orchestration** 和 GSD 的 **slash-command-driven phase progression** 两套思想都缝合到 alloy 当前的 atoms+pack+ledger 架构上。

具体能力清单（缝合目标）：

| 来源 | 能力 | 现状 |
|---|---|---|
| OMO Slim | 9 agents plugin-level 加载 | alloy 7 specialists 已是这种，但 install-time 不是 runtime |
| OMO Slim | Runtime preset 切换 | 没有，alloy 是 install-time |
| OMO Slim | Health check (agent/tool/MCP loaded?) | 部分有 (alloy doctor)，但不在 plugin 启动 |
| OMO Slim | filter-available-skills hook | ✅ 已 port (v0.1.0 Wave 4a) |
| OMO Slim | preset-manager (`/pack <name>` 热切) | 没有 |
| GSD | `.planning/` disk-based state machine | alloy 有 `.alloy/state/*.jsonl` 但无 transition guard |
| GSD | 30+ slash commands 驱动 phase | alloy 有 spec/plan/execute/verify SDD commands，部分对齐 |
| GSD | profile selection (simple/smart/genius → model) | alloy `models/*.json` 有 role→model 映射，跟 GSD 类似 |
| GSD | XML-structured phase plan files | alloy 用 markdown YAML frontmatter，不同形态但同思想 |

---

## 2. 5 条反馈对应的具体修订

### #1 加 CodeGraph + RTK 预装

**修订**：v0.1.2 在 `packs/atoms.json` 加 `core-infrastructure` atom，default 装 CodeGraph + RTK。

- **CodeGraph**：AST 索引工具，用户已在用 (.codegraph/ 目录已存在)。作为 select 工具基础设施。zhenjia 文章 Step 2 "减少无效探索" 推荐。
- **RTK**：CLI 输出压缩工具，zhenjia 文章 Step 3 "预防上下文膨胀" 推荐。

**不冲突"不替用户做选择"** — 这是基础设施 token 优化，不是项目集成偏好（vcs/issues）。

### #2 版本号: v0.2 全部 fold 进 v0.1.x 系列

**修订**：取消 v0.2 大版本号。所有 v0.2 内容拆成 v0.1.x 渐进 ship。**v0.1.6 三层防御砍掉**。

新版本树（用户已确认 v0.1.6 砍）：

```
v0.1.2 (~10-12h)  Skill inline + plan phase 合并 + handoff + DCP + CodeGraph + RTK + agent 编排 OMO/GSD 缝合
v0.1.3 (~12h)     Plugin-first 重构 (砍 CLI, 改 plugin tools, install interactive)
v0.1.4 (~10h)     State machine + JSONL ledger guard (含 transition table + capability isolation)
v0.1.5 (~10h)     Execute context pruning + zhenjia 6 步 token 优化
─────
[v0.1.6 砍掉 — capability isolation 和 hook block 已 fold 进 v0.1.4 ledger guard]
[v0.2 取消 — v0.3 远期内容继续叫 v0.3+]
```

### #3 Install interactive 像 npx skills

**修订**：`alloy install` 默认 interactive：

```bash
$ alloy install
? Pack: (Use arrow keys)
  > core
    frontend
    backend
    infra
    all

? Model preset: (Use arrow keys)
  > github-copilot
    anthropic
    mixed
    custom

? Optional add-ons (toggle Space, Enter to confirm):
  [x] CodeGraph     - AST 索引 (推荐)
  [x] RTK           - CLI 输出压缩 (推荐)
  [ ] OpenCode DCP  - Token 优化但会破 cache
  [ ] mattpocock handoff - Session handoff skill
```

**保留** CLI flag (`--pack core --models github-copilot --addons codegraph,rtk`) 给 install.sh 脚本化用。

实现：用 `prompts` npm package（轻量 ~50KB），单文件 ESM。

### #4 Skill 融合"字数只准多不准少" + 是否符合最佳实践

**用户的质疑是对的** — 全文双 base inline 会让 SKILL.md 上千行，**LLM 加载时浪费 token，不符合最佳实践**。

**Anthropic 官方推荐** (claude.com Skill authoring best practices)：
- SKILL.md **body < 500 行**，**1500-2000 字**
- 超过就用 **progressive disclosure** 拆到 reference 文件
- "SKILL.md serves as an overview that points Claude to detailed materials as needed, like a table of contents"
- Startup 只把 frontmatter (name + description) load 进 system prompt，body 是 on-demand 读

**修订: Vendor 完整原文 + SKILL.md 是 router**（符合 Anthropic 官方 progressive disclosure 模式）：

```
universal/skills/alloy-tdd/
├── SKILL.md              ← <500 行 (Anthropic 官方上限): alloy router overview + 引用原版位置
├── upstream/
│   ├── superpowers/
│   │   └── tdd.md        ← obra/superpowers v5.1.0 完整原文 (~500 行) 一字不删
│   └── mattpocock/
│       └── tdd.md        ← mattpocock 相关完整原文 (~300 行) 一字不删
└── alloy-integration.md  ← <500 行: alloy ledger / evidence / agent 集成 (on-demand read)
```

**规则**：
- ✅ 上游原文**完整 vendor**到 `upstream/` 子目录，**一字不删**
- ✅ 用户/LLM 想要全文 → 读 `upstream/<source>/*.md`
- ✅ SKILL.md 自己作"地图"：列出 alloy-tdd 包含哪些上游，alloy 自己怎么用
- ✅ "只准多不准少" 字数原则**满足**：上游原文一字不少，alloy 自己加的 alloy-integration.md 是纯增量
- ✅ LLM 加载 SKILL.md 时不爆 token，按需深入读 upstream/

**这是 mattpocock 自己的 skill 推荐模式** — references 模式比 inline 大块更合最佳实践。

### #5 Phase 名叫 plan（不是 spec）

**修订**：所有命名统一 plan：
- Phase: `pending → plan → execute → verify → done`
- Command: `/plan` (`/spec` 删除)
- Skill: `alloy-plan` (吸收 `alloy-brainstorm` 内容，brainstorm skill 删除)
- File: `.alloy/plans/<id>/plan.md` (dir 从 `specs/` 改 `plans/`)
- atoms.json: `alloy-sdd-commands` 改成 `commands: [autopilot, discuss, execute, plan, verify]` (去掉 spec)

---

## 3. v0.1.2 完整 task 清单（最终修订版）

按 ROI 排序，**~14-16 小时工作量**（含 Task 9 OMO preset 实现 +5h）：

| # | Task | 时间 | Files |
|---|---|---|---|
| 1 | README 重定位 + 6 信条 | 30m | README.md |
| 2 | CLAUDE.md 加 6 信条 + "What Alloy is NOT" | 30m | CLAUDE.md |
| 3 | Vendor mattpocock handoff skill (一字不改) | 1h | vendor/skills/external/mattpocock/<v>/handoff/ + vendor.lock.json + atoms.json + CREDITS.md |
| 4 | OpenCode DCP optional pack | 30m | packs/dcp.json + defaults.json |
| 5 | CodeGraph + RTK 加 `core-infrastructure` atom | 30m | packs/atoms.json + packs/core.json + vendor.lock.json |
| 6 | **plan phase 合并**（用户优先要） — 见 §D 具体到代码 | 2h | commands/plan.md (改写), commands/spec.md (删), atoms.json, alloy-plugin.ts COMMAND_SKILLS map, agents/*.md 引用更新 |
| 7 | **11 alloy-* skill 改 vendor reference 模式** — 见 §B 具体到代码 | 4h | universal/skills/alloy-*/{SKILL.md (保留), upstream/, alloy-integration.md (新建)} |
| 8 | 7 agent .md 加 phase pipeline section | 1h | agents/*.md |
| 9 | **OMO Slim runtime preset 热切换** — 见 §C 具体到代码 | 5h | templates/opencode/alloy-plugin.ts + packs/atoms.json + bin/alloy.mjs + tests |
| 10 | 把这份 plan 写成 docs/redesign/PLAN-v0.1.2-and-beyond.md (覆盖 v1) | 30m | docs/redesign/PLAN-v0.1.2-and-beyond.md |
| 11 | CHANGELOG + version bump | 15m | CHANGELOG.md + package.json |
| 12 | npm test + audit + ship + tag v0.1.2 | 30m | (no edit) |

---

## 4. v0.1.3+ 远期

**Strip 掉**（用户："plan 应该是下一阶段做什么 plan，roadmap 单独"）。

v0.1.3+ 路线另写到 `docs/redesign/ROADMAP-v0.1.3-and-beyond.md`，本 plan 不展开。
高层框架（仅 ref）:
- v0.1.3: plugin-first 重构 / userOverlay auto-detect / install interactive
- v0.1.4: state machine + ledger guard (含 capability isolation)
- v0.1.5: execute context pruning + zhenjia 6 步 token 优化
- v0.3+: rate limit auto-resume / chain hash / daemon / Claude Code+Codex adapter / skill ledger learning

---

## B. Task 7 具体到代码: 11 skill 拆包 file-by-file

### B.1 alloy-tdd (348 → ~1300+ inline 融合)

**改前**:
```
universal/skills/alloy-tdd/
├── SKILL.md (348 行, fusion 已写)
└── references/
    ├── tests.md            (mattpocock vendored)
    ├── mocking.md
    ├── deep-modules.md
    ├── interface-design.md
    └── refactoring.md
```

**改后** (用户决定: inline 全部, 不拆包):
```
universal/skills/alloy-tdd/
├── SKILL.md (~1300-1500 行 — inline 全部 4 source)
└── references/  (保留, mattpocock 5 个 file 仍在; 但 SKILL.md 已 inline 全文, references/ 作历史源 backup)
```

**SKILL.md 新结构** (建议章节顺序):
```markdown
# Alloy TDD (inline-fused, 4 sources verbatim)

## Section 1: Iron Law (from obra/superpowers v5.1.0, verbatim)
[obra/superpowers test-driven-development/SKILL.md 全文 inline ~500 行]

## Section 2: testing-anti-patterns (from superpowers, verbatim)
[testing-anti-patterns.md 全文 inline]

## Section 3: Integration-style philosophy (from mattpocock, verbatim)
[mattpocock skills/engineering/tdd/tests.md 全文 inline]

## Section 4: Mocking discipline (from mattpocock, verbatim)
[mattpocock skills/engineering/tdd/mocking.md 全文 inline]

## Section 5: Deep modules (from mattpocock, verbatim)
[mattpocock skills/engineering/tdd/deep-modules.md 全文 inline]

## Section 6: Interface design (from mattpocock, verbatim)
[mattpocock skills/engineering/tdd/interface-design.md 全文 inline]

## Section 7: Refactoring (from mattpocock, verbatim)
[mattpocock skills/engineering/tdd/refactoring.md 全文 inline]

## Section 8: Code constraints + Stack Companions routing (from team-tdd legacy, verbatim)
[git show 60a9207:skills/team-tdd/SKILL.md 全文 inline 98 行]

## Section 9: alloy v3 fusion + integration
[现有 alloy-tdd SKILL.md 348 行核心融合论述 + evidence ledger 集成段]
```

**总字数**: 字数 + 行数 only more not less。每个 section 上游内容 verbatim，alloy 自己只**追加** Section 9 不修改前 8 个 section。

**Vendor 命令** (用 gh api fetch 全文):
```bash
# Section 1-2: superpowers
gh api repos/obra/superpowers/contents/skills/test-driven-development/SKILL.md --jq '.content' | base64 -d
gh api repos/obra/superpowers/contents/skills/test-driven-development/testing-anti-patterns.md --jq '.content' | base64 -d

# Section 3-7: mattpocock
gh api repos/mattpocock/skills/contents/skills/engineering/tdd/tests.md --jq '.content' | base64 -d
gh api repos/mattpocock/skills/contents/skills/engineering/tdd/mocking.md --jq '.content' | base64 -d
gh api repos/mattpocock/skills/contents/skills/engineering/tdd/deep-modules.md --jq '.content' | base64 -d
gh api repos/mattpocock/skills/contents/skills/engineering/tdd/interface-design.md --jq '.content' | base64 -d
gh api repos/mattpocock/skills/contents/skills/engineering/tdd/refactoring.md --jq '.content' | base64 -d

# Section 8: team-tdd (alloy 自家从 git history)
git show 60a9207:skills/team-tdd/SKILL.md  # in alloy repo

# Section 9: 现有 alloy-tdd SKILL.md 当前 348 行 + 追加 alloy-integration 内容
```

**Trade-off (用户已接受)**:
- ✅ "字数只准多不准少" 原则 100% 满足
- ✅ "能用原文就用原文" 满足
- ✅ 一个 SKILL.md 全在，无需多文件跳转
- ⚠️ 违反 Anthropic 500 行 best practice (实际 ~1300-1500 行)
- ⚠️ LLM 每次加载吃更多 token (但 Anthropic 说 SKILL.md startup 只 load frontmatter，body 是 on-demand 读，**所以实际不会每次都吃 token**——只在 LLM 主动 invoke skill 时 read)

**Note on Anthropic best practice**: SKILL.md body 是 on-demand load 不是 always-loaded，所以 1500 行只在 invoke 时吃 token。startup 只看 frontmatter (name + description)。所以 inline 长 SKILL.md 实际**不破 cache discipline**，跟 zhenjia 文章 Step 1 缓存纪律不冲突。

**Migration script** (`scripts/restructure-skills.mjs` 新建):
```js
// for each alloy-* skill:
//   1. create upstream/<source>-<version>/ dirs
//   2. vendor upstream files via gh api ... base64 -d
//   3. compute sha256, update vendor.lock.json
//   4. move existing references/ files to upstream/mattpocock-<v>/
//   5. generate alloy-integration.md from template
```

### B.2 alloy-integration.md 模板 (每个 skill 1 份)

```markdown
# Alloy Integration — alloy-tdd

## 4 Sources fused

1. `upstream/superpowers-v5.1.0/SKILL.md` — Iron Law (NO CODE WITHOUT FAILING TEST) / RGR cycle / 8-项 anti-rationalization table
2. `upstream/mattpocock-<v>/tdd-*.md` — Integration-style / deep modules / mocking discipline / interface design / refactoring
3. `upstream/alloy-team-tdd-legacy/SKILL.md` — **alloy 自家**早期 (v0.1.0 前) team-tdd 98 行原文, 含:
   - Code constraints (functions ≤10 / classes ≤50-100 / files ≤300 / indent ≤2 / params ≤3) — **alloy 原创**
   - Stack Companions routing (React/TS → vercel-react + next-best + frontend-tdd; Kotlin/Spring → kotlin-agent-skills + dr-jskill; Terraform → terraform-skill; AWS → awslabs; Postgres → pg-aiguide) — **alloy 原创**
4. (v3 新加) Evidence ledger integration

## What each source contributed (具体到 sentence-level)

| 来自 | 内容 |
|---|---|
| superpowers | "NO PRODUCTION CODE WITHOUT FAILING TEST FIRST" + "Code written before tests → delete it" + anti-rationalization 8-项 |
| mattpocock | "Vertical slicing not horizontal" + "Mock only at system boundaries" + Deep modules / interface-design / refactoring 5 references |
| team-tdd (alloy 前世) | Code constraints (functions ≤10 行 etc.) + Stack Companions routing 列表 + atomic commit per RGR + early return / 3-param rule |
| **alloy v3 新加** | `alloy_evidence` tool 调用要求 + `alloy_gate` 95% coverage floor |

## Why this 4-way fusion

- superpowers 单用: 严厉但缺 design feedback loop
- mattpocock 单用: 智慧但缺 enforce mechanism
- team-tdd 单用: 太简 (98 行), 缺 anti-rationalization 和 deep modules
- 4-way: 严厉 + 智慧 + alloy 原创硬约束 + ledger 集成

## Reading order

1. SKILL.md (router + 高层 workflow)
2. alloy-integration.md (this file)
3. upstream/superpowers-v5.1.0/SKILL.md (Iron Law 细节)
4. upstream/mattpocock-<v>/*.md (specific topic 深入)
5. upstream/alloy-team-tdd-legacy/SKILL.md (溯源 alloy 原创点)
```

### B.3 alloy-qa (用户决定: 重写, 不 vendor 上游)

**改前**:
```
universal/skills/alloy-qa/
└── SKILL.md (377 行)
```

**改后** (用户决定: "我们能重写吗" = yes):
```
universal/skills/alloy-qa/
└── SKILL.md (377 行 → 可能扩到 ~500 行, alloy 自己重写完整版)
```

**理由 (case-by-case 原则)**:
- gstack /qa 上游 1647 行**绝大部分是 runtime 调用** (`gstack-*` binaries / `$B` browse / `~/.gstack/`)
- 剥离 runtime 后剩**纯思想**部分 = 11 phases / rubric / WTF-likelihood / regression discipline
- 这些思想 alloy-qa 当前 377 行**已经吸收并 alloy-portable 化**
- **不需要 inline gstack 全文** (1300+ 行 runtime 代码对 alloy 用户无意义)

**alloy-qa SKILL.md 重写策略** (扩展现有 377 行到 ~500):
1. 保留 11-phase workflow (基于 gstack 思想，alloy 重写)
2. 保留 8-类 rubric (权重一致 + alloy 自己重写描述)
3. 保留 WTF-likelihood 规则 (20% 阈值 / 50-fix cap)
4. 保留 Phase 8e.5 regression discipline (强化为强制)
5. **新加**: `playwright-cli` skill 集成命令表 (替 `$B` syntax)
6. **新加**: `alloy_evidence` 调用要求 (替 telemetry)
7. **新加**: `.alloy/qa-reports/` 路径约定
8. **新加**: `--report-only` flag

**Attribution** (在 SKILL.md 底部加):
```markdown
## Attribution

This skill is **inspired by** gstack `/qa` (garrytan/gstack, MIT) but **rewritten** to remove gstack runtime dependencies (gstack-* binaries, $B browse, ~/.gstack/). Core concepts adopted: 11-phase workflow / 8-category health rubric / WTF-likelihood self-regulator / Phase 8e.5 regression discipline. alloy adds: evidence ledger integration / playwright-cli abstraction / --report-only mode.

See CREDITS.md for full attribution chain.
```

**不在 universal/skills/alloy-qa/ 加 upstream/ 子目录**（因为我们不 vendor gstack runtime）。

**对比 alloy-tdd vs alloy-qa 处理**:

| 维度 | alloy-tdd | alloy-qa |
|---|---|---|
| **策略** | inline 4 source 全文 (~1300 行) | 重写 (~500 行) |
| **上游内容能否用** | ✅ 轻量、自包含 | ❌ 重 runtime 依赖 |
| **upstream/ 目录** | 保留 references/ (mattpocock) | 没有 |
| **Attribution** | 4 section 各自标 source | 底部 "inspired by gstack, rewritten" |
| **字数变化** | 348 → ~1300+ (增 ~4x) | 377 → ~500 (增 ~30%) |
| **Anthropic 500 行 best practice** | 违反 (用户决定接受) | 满足 |

### B.4 其他 9 个 alloy-* skill 同样 pattern

每个 skill 文件夹结构一致:
```
universal/skills/alloy-<name>/
├── SKILL.md (现有内容不动)
├── upstream/<source>-<version>/  (vendor 上游原文)
└── alloy-integration.md (新写)
```

具体 mapping:

| Skill | 上游 source + 路径 | Vendor 命令 |
|---|---|---|
| alloy-brainstorm | obra/superpowers v5.1.0 skills/brainstorming/SKILL.md | (待 fetch) |
| alloy-debug | obra/superpowers v5.1.0 skills/systematic-debugging/ + 5 references | 已有 references/ → 移到 upstream/ |
| alloy-execute | obra/superpowers v5.1.0 skills/subagent-driven-development/ + 3 prompts | 已有 references/ → 移到 upstream/ |
| alloy-verify | obra/superpowers v5.1.0 skills/verification-before-completion/SKILL.md | (待 fetch) |
| alloy-discuss | GSD repo (license 待确认) discuss-phase 内容 | 跳过 vendor 上游 (license 不明)，仅 alloy-integration.md |
| alloy-plan | obra/superpowers writing-plans/SKILL.md + GSD plan-phase | (mixed, vendor superpowers 那份) |
| alloy-autopilot | axledbetter/claude-autopilot README + skill | (vendor README + skill) |
| alloy-map-codebase | GSD brownfield mapper (license 待确认) | 跳过 vendor，仅 alloy-integration.md |
| alloy-using | (Alloy 原创) | 无 upstream/，只 alloy-integration.md |

### B.5 工作量明细

| 操作 | 时间 |
|---|---|
| 写 `scripts/restructure-skills.mjs` migration script | 1h |
| 跑 script 自动 vendor + 生成 upstream/ 结构 | 30m |
| 手写 11 个 `alloy-integration.md` (各 ~100 行) | 2h |
| 更新 vendor.lock.json (11 个新 source 入条目) | 30m |
| 跑 npm test + audit 验证 | 30m |
| **Task 7 总** | **4-5h** |

---

## C. Task 9 具体到代码: OMO preset runtime hot-swap

### C.1 现状 (templates/opencode/alloy-plugin.ts)

L25: `const DEFAULT_AGENT = "Orchestrator"` — hardcoded
L38-45: `COMMAND_SKILLS` map (spec/plan/execute/verify/autopilot/ralph-loop)
L177-180 附近: `injectConfigDefaults` 在 `config` hook 注 default_agent + mcp

**没有 preset 概念**。要加。

### C.2 改后设计

**新文件**: `packs/presets.json` (atoms.json 的姊妹文件)
```json
{
  "presets": {
    "default": {
      "agents": ["Orchestrator", "Explorer", "Architect", "Builder", "Fixer", "Reviewer", "Tester"],
      "skills_visible": "all",
      "mcps_enabled": "all"
    },
    "plan-mode": {
      "agents": ["Orchestrator", "Explorer", "Architect"],
      "skills_visible": ["alloy-plan", "alloy-discuss", "alloy-brainstorm", "alloy-map-codebase"],
      "mcps_enabled": ["context7", "grep_app"]
    },
    "execute-mode": {
      "agents": ["Builder", "Fixer"],
      "skills_visible": ["alloy-tdd", "alloy-execute", "alloy-debug"],
      "mcps_enabled": ["context7"]
    },
    "review-mode": {
      "agents": ["Reviewer", "Tester"],
      "skills_visible": ["alloy-verify", "alloy-qa"],
      "mcps_enabled": ["context7", "exa"]
    }
  }
}
```

**templates/opencode/alloy-plugin.ts** 加 section (~150 LOC):

```typescript
// Module-level preset state (OMO 模式)
let activePreset: string = "default"
let presetsDef: PresetsDef | null = null

function loadPresets(directory: string): PresetsDef {
  if (presetsDef) return presetsDef
  const path = join(directory, ".opencode", "presets.json")
  if (!existsSync(path)) return { presets: { default: { ... } } }
  presetsDef = JSON.parse(readFileSync(path, "utf8"))
  return presetsDef!
}

function getActivePreset(directory: string): PresetSpec {
  const defs = loadPresets(directory)
  return defs.presets[activePreset] ?? defs.presets.default
}

function applyPreset(directory: string, name: string): boolean {
  const defs = loadPresets(directory)
  if (!defs.presets[name]) return false
  activePreset = name
  // 写到 .alloy/state/preset.jsonl (audit trail)
  appendJsonl(directory, "preset", {
    id: randomUUID(),
    event: "preset_changed",
    from: activePreset,
    to: name,
    ts: new Date().toISOString(),
  })
  return true
}

// 新 plugin tool (LLM 在 chat 里调)
const presetSwitchTool = tool({
  description: "Switch the active Alloy preset (plan-mode / execute-mode / review-mode / default).",
  args: {
    preset: z.string().describe("Preset name from .opencode/presets.json"),
  },
  async execute(args) {
    const ok = applyPreset(projectDir, args.preset)
    return ok
      ? `Preset switched to ${args.preset}. Skills/agents/MCPs hot-reloaded.`
      : `Unknown preset: ${args.preset}`
  },
})

// Existing experimental.chat.messages.transform hook 加入 preset filter:
"experimental.chat.messages.transform": async (input, output) => {
  if (!output || !Array.isArray(output.messages)) return
  await filterAvailableSkills(projectDir, input, output)
  // NEW: 也按 preset 过滤 skills
  await filterByPreset(projectDir, input, output)
},

// Health check (boot 时验证 preset 加载)
config: async (config) => {
  if (!config) return
  injectConfigDefaults(config)
  loadPresets(projectDir) // ← 启动预加载 + 验证
  bootWarnings = await detectMagicWarnings(projectDir)
  ...
},
```

**plugin export** 加 tool: `alloy_switch_preset` 注册到 `tool: {...}` block (alloy-plugin.ts L607 附近).

### C.3 bin/alloy.mjs 改动

```js
// 新增 stateFunction (alloy install 时 materialize)
function writePresets(resolvedConfig, targetDir) {
  const path = join(targetDir, ".opencode", "presets.json")
  // 默认 4 个 preset (default + plan-mode + execute-mode + review-mode)
  const defaults = require("../packs/presets.json")
  writeJson(path, defaults, false)
}

// 在 installCommand 内调用
function installCommand(options) {
  ...
  writeOpenCodeConfig(resolved)
  writePresets(resolved, resolved.targetDir)  // ← NEW
  ...
}
```

### C.4 Tests 加 (scripts/test_alloy_installer.py)

```python
def test_install_writes_presets_json(self):
    with tempfile.TemporaryDirectory() as tmp:
        cwd = Path(tmp)
        run_setup(cwd, "--pack", "core", "--target", "local")
        presets = json.loads((cwd / ".opencode" / "presets.json").read_text())
        self.assertIn("default", presets["presets"])
        self.assertIn("plan-mode", presets["presets"])
        self.assertIn("execute-mode", presets["presets"])
        self.assertIn("review-mode", presets["presets"])
```

### C.5 用户体感

```
User: /plan some-feature
  → Plugin chat.message hook 注入: "Now in plan-mode preset"
  → alloy-plan + alloy-discuss visible，alloy-tdd 隐藏
  → only Orchestrator/Explorer/Architect agents available

User: /execute
  → Plugin command.execute.before 自动调 alloy_switch_preset("execute-mode")
  → 切到 Builder/Fixer，alloy-tdd visible

User in chat: "switch to review mode"
  → Orchestrator agent 调 alloy_switch_preset("review-mode") tool
  → 热加载，session 不重启
```

---

## D. Task 6 具体到代码: plan phase 合并

### D.1 commands/spec.md → DELETE

```bash
git rm commands/spec.md
```

### D.2 commands/plan.md 重写 (合并 spec + plan)

**改前** (commands/plan.md, 20 行):
```yaml
---
description: Convert an Alloy spec into an implementation plan
agent: alloy-orchestrator
---
# /plan
Append the implementation-ready `## Plan` section to an Alloy task plan.
## Workflow
1. Invoke the `alloy-plan` skill.
2. Identify the requested `.alloy/specs/<id>/task_plan.md`.
3. Confirm the `## Spec` section exists ...
```

**改后** (commands/plan.md, ~30 行):
```yaml
---
description: Brainstorm + plan an implementation in one phase (合并 spec + plan)
agent: alloy-orchestrator
---
# /plan
Brainstorm the user request + produce an implementation-ready plan in one pass.
This phase replaces the old separate /spec and /plan commands.

## Workflow
1. Invoke `alloy-plan` skill (which now also handles brainstorm via merged content).
2. Identify or create a stable plan id for `.alloy/plans/<id>/`.
3. Read `.alloy/plans/<id>/context.md` if `/discuss` already captured decisions.
4. Brainstorm + clarify scope (was /spec).
5. Produce bite-sized implementation tasks with exact files, commands, verification steps.
6. Write to `.alloy/plans/<id>/plan.md` with frontmatter:
   ```yaml
   ---
   id: <id>
   approved: false  # user must approve before /execute
   required_skills: [...]
   required_mcps: [...]
   required_agents: [...]
   files_to_touch: [...]
   acceptance_criteria: [...]
   ---
   ```
7. Stop here, wait for user approval (set approved: true) before /execute.

## User Task
$ARGUMENTS
```

### D.3 packs/atoms.json 改动

```diff
"alloy-sdd-commands": {
-   "commands": ["autopilot", "discuss", "execute", "plan", "spec", "verify"]
+   "commands": ["autopilot", "discuss", "execute", "plan", "verify"]
}
```

### D.4 templates/opencode/alloy-plugin.ts COMMAND_SKILLS 改动 (L38-45)

```diff
const COMMAND_SKILLS: Record<string, string> = {
-   spec: "alloy-plan",
    plan: "alloy-plan",
    execute: "alloy-execute",
    verify: "alloy-verify",
    autopilot: "alloy-autopilot",
    "ralph-loop": "ralph-loop",
}
```

### D.5 .alloy/specs/ → .alloy/plans/ migration

`scripts/migrate-specs-to-plans.mjs` (新建):
```js
import { existsSync, renameSync } from "node:fs"
import { resolve } from "node:path"

const specsDir = resolve(process.cwd(), ".alloy/specs")
const plansDir = resolve(process.cwd(), ".alloy/plans")

if (existsSync(specsDir) && !existsSync(plansDir)) {
  renameSync(specsDir, plansDir)
  console.log("Migrated .alloy/specs → .alloy/plans")
}
```

集成到 `bin/alloy.mjs install` 流程:
```js
// installCommand 开头加
if (existsSync(join(targetDir, ".alloy/specs")) && !existsSync(join(targetDir, ".alloy/plans"))) {
  renameSync(join(targetDir, ".alloy/specs"), join(targetDir, ".alloy/plans"))
}
```

### D.6 alloy-plan SKILL.md 改动 (合并 brainstorm 内容)

universal/skills/alloy-plan/SKILL.md 当前 180 行。alloy-brainstorm SKILL.md 当前 200 行。

合并策略:
- alloy-plan/SKILL.md **前半** 从 alloy-brainstorm/SKILL.md 复制 "natural collaborative dialogue + ask one question at a time + HARD-GATE" 部分
- alloy-plan/SKILL.md **后半** 保留现有 "bite-sized TDD plan + source coverage audit" 部分
- 总长度 ~280 行 (仍 < 500 行最佳实践)

**universal/skills/alloy-brainstorm/ → DELETE 整个目录**

### D.7 agent .md 引用更新

7 个 agent .md 文件全文 search-replace:
```
/spec → /plan
.alloy/specs/ → .alloy/plans/
"alloy-brainstorm" → "alloy-plan"
"Invoke alloy-brainstorm" → "Invoke alloy-plan"
"Use alloy-brainstorm" → "Use alloy-plan"
```

### D.8 docs/alloy-overview.html SDD pipeline 图更新

修改 §4 Agents Workflow 的 mermaid/HTML 图:
```diff
- pending → spec → plan → execute → verify → done
+ pending → plan → execute → verify → done
```

---

## 5. Critical files to be modified (v0.1.2)

```
README.md                                                  Task 1
CLAUDE.md                                                  Task 2
CHANGELOG.md                                               Task 11
package.json                                               Task 11
vendor.lock.json                                           Task 3, 5
packs/atoms.json                                           Task 3, 5, 6
packs/core.json (+ frontend/backend/infra/all)             Task 5, 6
packs/dcp.json (NEW)                                       Task 4
defaults.json                                              Task 4
vendor/skills/external/mattpocock/<v>/handoff/ (NEW)       Task 3
vendor/skills/codegraph/ (NEW vendor)                      Task 5
vendor/skills/rtk/ (NEW vendor)                            Task 5
CREDITS.md                                                 Task 3, 5, 9
commands/plan.md (扩展, 接管 spec)                          Task 6
commands/spec.md (DELETE)                                  Task 6
agents/Orchestrator.md (+6 specialists)                    Task 8
.alloy/specs/ → .alloy/plans/ (rename, scripts/migration)  Task 6
universal/skills/alloy-tdd/ + 10 others/                   Task 7
  ├── SKILL.md (重写为 router)
  ├── upstream/ (NEW dir, vendor 原文)
  └── alloy-integration.md (NEW)
universal/skills/alloy-brainstorm/ (DELETE — 并入 alloy-plan) Task 6
templates/opencode/alloy-plugin.ts (注释加 OMO 缝合记录)    Task 9
docs/redesign/PLAN-v0.1.2-and-beyond.md (覆盖)              Task 10
docs/alloy-overview.html (SDD pipeline 图更新)             Task 8
```

---

## 6. Existing functions/utilities to reuse

- `bin/alloy.mjs` `loadPack()` / `loadAtoms()` / `resolveConfig()` — 已存在，pack expand 不动
- `bin/alloy.mjs` `installPlugin()` / `installSkills()` — vendor 新 skill 复用
- `templates/opencode/alloy-plugin.ts` — 已有 12 hooks，Task 9 只加注释不动逻辑
- `scripts/revendor.mjs` — vendor mattpocock handoff 时复用
- `scripts/audit_prompt_dependencies.py` — 验证新 skill 引用
- `scripts/test_alloy_installer.py` — 加 v0.1.2 新 e2e cases
- `npm test` (33 tests) — 不破坏现有

---

## 7. Verification (end-to-end test for v0.1.2 ship)

```bash
# 1. 全套 tests
npm test                  # 33+ unit + e2e all pass
node --check bin/alloy.mjs
python3 scripts/audit_prompt_dependencies.py

# 2. Vendor 完整性
ls universal/skills/alloy-tdd/upstream/superpowers/tdd.md       # 上游原文 exist
ls universal/skills/alloy-tdd/upstream/mattpocock/tdd.md
diff vendor/skills/external/mattpocock/<v>/handoff/SKILL.md \
     <(curl -s https://raw.githubusercontent.com/mattpocock/skills/.../skills/handoff/SKILL.md)
# 应该一字不差

# 3. End-to-end install (temp dir)
tmp=$(mktemp -d)
cd "$tmp"
bash /Users/lumimamini/opencode-team-config/setup.sh --pack core --target local --models github-copilot
# 验证:
ls .opencode/skills/handoff/                  # mattpocock handoff installed
ls .opencode/skills/alloy-tdd/upstream/       # vendor 原文 propagate 进 install
cat .opencode/opencode.json | jq .plugin      # CodeGraph + RTK 装上
cat .opencode/alloy.manifest.json | jq .managed.skills  # 13+ skills

# 4. Plan phase 合并验证
node bin/alloy.mjs                            # 不应该有 /spec command
# 用户在 OpenCode session 跑 /plan 应该走完整 brainstorm+plan 流程

# 5. Tag + push
git tag v0.1.2
git push origin v0.1.2
gh release create v0.1.2 --notes-from-tag
```

---

## 8. User decisions confirmed (post-grill)

- ✅ **Q (skill 文件)**: Anthropic 官方推荐 SKILL.md ≤500 行 + progressive disclosure → 用拆包模式（主 SKILL.md router + upstream/ 完整原文 + alloy-integration.md）
- ✅ **Q (OMO 缝合)**: v0.1.2 **直接加** runtime preset 热切换 (+5h 工作量)
- ✅ **Q (install 体验)**: 完全像 `npx skills` —— install 时全部 interactive prompt，alloy 不替用户判 default-on / opt-in

## Open questions (need user decision before ship)

### Q1: skill upstream/ 子目录的命名

`universal/skills/alloy-tdd/upstream/<source-name>/<file>.md` 还是 `universal/skills/alloy-tdd/upstream/<source-name>-<version>/<file>.md` (含版本号)？

倾向后者，方便 Renovate 跟版本。

### Q2: alloy-brainstorm skill 是否合并进 alloy-plan

倾向 **合并**（删 alloy-brainstorm，内容并入 alloy-plan），因为 plan phase 合并了 spec + plan。

### Q3: ~~default-on / opt-in 分类~~ → 全部 interactive prompt（用户决定）

`alloy install` 像 `npx skills` 那样 prompt 全部 add-on（handoff / CodeGraph / RTK / DCP / OMO preset 等），用户自己 Y/n 选。alloy 不替用户判。

### Q4: install.sh 怎么挂 interactive prompts

`alloy install` 默认 interactive。但 `install.sh` (curl one-liner) 怎么办？
- 选项 A: install.sh 跑 `alloy install --pack core --target global --models github-copilot --yes` 全 default，用户后续在 chat 里改
- 选项 B: install.sh 进入 interactive mode 让用户在 terminal 选
- 倾向 A（一行装完，后续 chat 调整）

---

## 9. Notes on what's NOT in this plan

- **v0.1.6 强制三层防御** — 用户明确说不做，capability isolation 和 Stop hook block fold 进 v0.1.4 ledger guard
- **v0.2 大版本** — 取消，所有内容渐进 ship 进 v0.1.x
- **Daemon mode / rate limit auto-resume / Claude Code adapter / Codex adapter / chain hash / compaction** — 全部 v0.3+ 远期
- **Multi-runtime (CC/Codex)** — v0.3+ 才考虑
- **Database** — 永远不做（除非未来真要 web UI）
- **TypeScript 迁移** — 永远保持 `.mjs` + zod + jsdoc

End of plan.
