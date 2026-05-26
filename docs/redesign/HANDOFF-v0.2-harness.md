# Session Handoff — 2026-05-26 evening

> 下一会话恢复读这一份。今日 session 完成 v0.1.0 + v0.1.1 + repo rename + 文档站点，并开启 v0.2+ 路线讨论（外置 state machine + 三项目综合）。

## TL;DR

**今天做完的事**（spec 全部 task ✅）：

1. **v0.1.0 release** — 5 waves / 11 cards / 14 PRs 全部 sub-agent driven by codex 跑完，wall clock ~3-4 小时
2. **v0.1.1 follow-up** — 5 reviewer/tester findings 修复 + repo rename `opencode-team-config` → `alloy` + brand reposition 为 multi-runtime adapter
3. **docs/alloy-overview.html** — 2002 行单页 product walkthrough，覆盖 12 hooks / SDK / 7 agents / skills inventory + diff / agent MD / packs+atoms / install flow / 时间线 / roadmap

**开启的新讨论方向**：

- 用户提出当前 Alloy 状态管理是 **SDK in-process** 模式（plugin hooks 写 JSONL ledger），希望转向 **外置 state machine** 模式（类似 GSD 的 .planning markdown 或 Symphony 的 tracker-as-state-machine）
- 用户提到这是 "Harness" 范畴，Alloy 算 Harness 一部分
- 提出要把 **alloy + reins + codeflow** 三个项目综合
- 下一会话焦点：路线讨论（不写代码）

## 当前 Alloy 状态（main HEAD `618a48e`）

- **Repo**: `lifeodyssey/alloy`（已从 `opencode-team-config` rename，GitHub 自动 301 redirect 老 URL）
- **npm package**: `@lifeodyssey/alloy`（scoped，因 unscoped `alloy` 被占）
- **Tags**: `v0.1.0` + `v0.1.1`
- **main HEAD**: `618a48e` (docs HTML) → `73f69ef` (v0.1.1 merge) → `8ac504e` (v0.1.0 release)
- **Tests**: 33/33 (25 node unit + 18 e2e + 1 audit) all passing
- **PR #2** (codex/team-distribution-config → main): MERGED

### v0.1.0/v0.1.1 交付物清单

| Wave | Card | PR | 内容 |
|---|---|---|---|
| 1 | Card 1 vendor cleanup | #6 (closed, 内容已在 base) | 删 21 个 SuperPower 旧 skill |
| 1 | Card 2 cc-safety-net | #3 | dangerous-command guard plugin 集成 |
| 1 | Card 4 v3 agents | #7 | 6 alloy-* agents → 7 PascalCase specialists |
| 1 | Card 11 SDD commands | #4 | spec/plan/execute/verify/discuss/autopilot |
| 1 | Card 14 docs init | #5 | README/CHANGELOG/SECURITY/ROADMAP |
| 1 | Card 15 Renovate | #8 | renovate.json + scripts/revendor.mjs |
| 2 | Card 3 atoms restructure | #9 | atoms.json + universal/scopes/ + 5 packs extends 重构 |
| 3 | Card 6+7+12 CLI v3 | #10 | manifest.json + add/remove/list/search/outdated/upgrade + container-use prereq |
| 4a | Card 8+9+10 plugin 11 hooks | #11 | alloy-plugin.ts 186→674 行 + 11 hooks + 4 tools + 3 OMO ports |
| 4b | Card 16 ralph-loop | #13 | ralph-loop vendor + slash commands |
| 5 | Card 13 install.sh | #12 | curl one-liner + alloy completion + setup.sh shim |
| v0.1.1 | follow-up + rename | #14 | 5 bug fixes + brand reposition |

## 当前架构关键事实（讨论 v0.2 路线的 baseline）

### 状态管理（Q1 的答案）

**SDK 自管 + plugin in-process，没有 daemon。** 三个写入路径：

1. **Plugin hook 自动写**（`tool.execute.after` / `event` / `permission.ask` in `templates/opencode/alloy-plugin.ts`）→ `.alloy/state/{evidence,runs,iteration}.jsonl`
2. **LLM 通过 4 个 custom tool 主动写**（`alloy_evidence/claim/state/gate`）→ `.alloy/state/{evidence,claims,tasks}.jsonl`
3. **CLI 命令式**（`alloy state add-task/add-evidence/add-claim/list` in `bin/alloy.mjs`）→ 同上

**存储**: append-only JSONL ledger（5 个），`.alloy/projections/*.md` 是从 jsonl 生成的人读视图。`bin/state.mjs` 单管全局 `~/.config/alloy/state.json`（仅 magic detection 用）。

**关键缺失**:
- ❌ 没 long-running daemon / reconciliation loop / supervisor
- ❌ 没 tracker integration（不知道 GitHub/Linear/Azure 有 issue）
- ❌ 没 per-issue workspace 隔离（任务共享 repo state）
- ❌ orchestration policy 散在 11+ markdown，没 single source

### OMO Slim 和 SuperPower 在哪（Q2 的答案）

- **SuperPower** (`obra/superpowers` v5.1.0)：仅 vendor 3 个 SKILL.md 原文到 `vendor/skills/superpowers/5.1.0/{brainstorming,systematic-debugging,test-driven-development}/` 作 reference，不被任何 pack include。概念被 `alloy-tdd/alloy-plan/alloy-debug` 吸收重写。
- **OMO Slim** (`alvinunreal/oh-my-opencode-slim`)：**完全没 vendor 代码**，只 port 3 个 hook 概念到 `alloy-plugin.ts`：`maybeRecoverToolJson` (json-error-recovery) / `maybeDelegateTaskRetry` (delegate-task-retry) / `maybePhaseReminder` (phase-reminder)。

## 三种 paradigm 对比（已研究）

| | **Alloy 当前** | **GSD** | **Symphony** (OpenAI) |
|---|---|---|---|
| **状态位置** | `.alloy/state/*.jsonl` | `.planning/*.md` | Linear ticket state（无 DB） |
| **运行模式** | in-process OpenCode plugin | in-session Claude Code agent | **long-running daemon** |
| **并发** | 单 session | 单 session | per-issue workspace + bounded concurrency |
| **崩溃恢复** | 文件还在但没人重启 | 重开 session 读 md | daemon 重启扫 board 拾起 "In Progress" |
| **Policy** | 散在 plugin/agents/skills | `.planning/REQUIREMENTS.md` 等 | 单 `WORKFLOW.md` (front matter + prompt) |
| **入口** | OpenCode chat | Claude Code chat | tracker 创 ticket 自动 pick |
| **解耦** | plugin/SDK 耦合 | agent 直接读写 md | orchestrator vs executor 严格分离 |

### Symphony SPEC.md 关键设计（draft v1, MIT, github.com/openai/symphony）

1. **6 层架构**：Policy (WORKFLOW.md) / Config / Coordination (orchestrator) / Execution (workspace+agent subprocess) / Integration (Linear adapter) / Observability
2. **Symphony 只读 tracker 不写**——状态转移由 workspace 里 agent 用工具改 ticket。orchestrator vs executor 解耦
3. **Per-issue workspace**：每 ticket 一个 dir，agent 只能在自己 workspace 操作
4. **WORKFLOW.md** = YAML front matter (config) + Markdown body (prompt template)，repo 里版本化
5. **不要持久化 DB**：daemon 重启扫 tracker + filesystem workspace 恢复
6. **Elixir/BEAM** 参考实现（OTP supervision），但 SPEC.md language-agnostic

## 用户提出的下一步：综合 alloy + reins + codeflow

用户在 `lifeodyssey` GitHub 还有两个相关 repo（**下一会话需要 inspect**）：

| Repo | 描述（GitHub 上的） | 推测角色 |
|---|---|---|
| **alloy** | OpenCode team config: plugins, MCPs, and custom skills | 已知 — pack distribution + plugin |
| **reins** | Multi-agent sprint orchestrator plugin for Claude Code | 可能是用户说的"外置 state machine"项目 |
| **codeflow** | (没 description, TypeScript) | 可能是用户说的 "CloudFlow"（推测大小写差异） |

下一会话要：
1. `gh repo view lifeodyssey/reins` + 读 README/核心代码，理解它的 state machine 设计
2. `gh repo view lifeodyssey/codeflow` + 读 README/核心代码，理解它跟 Alloy 的边界
3. 跟用户讨论三个项目的综合方案——可能的方向：
   - Alloy = pack distribution + plugin (现有)
   - reins = sprint orchestrator (外置 state machine, 跟 Symphony 类似？)
   - codeflow = ?(待 inspect)
   - 综合方案 = 三者各负责一层

## 关于"Harness"概念

用户：「反正也是 Harness 相关的，我觉得我们这个东西算是 Harness 的一个部分了」。

Harness 在 AI agent 语境 = 给 LLM 提供约束/工具/流程的"外壳"。Claude Code / OpenCode 本身是 Harness。**Alloy 在它们之上是 meta-Harness**——把多个 Harness 用 atoms+packs 标准化、可移植。

三层 harness 假设：

```
┌─────────────────────────────────────────────────────────┐
│ Layer 3: Orchestration (reins / Symphony / codeflow?)   │  ← tracker-driven daemon
│   - 谁该做什么 task，按 ticket state 拾起               │
│   - per-issue workspace + bounded concurrency           │
├─────────────────────────────────────────────────────────┤
│ Layer 2: Pack Distribution (alloy)                      │  ← what tools agent has
│   - atoms + packs + extends                             │
│   - install 到任何 runtime (.opencode/.claude/.codex/)  │
├─────────────────────────────────────────────────────────┤
│ Layer 1: Runtime (OpenCode / Claude Code / Codex)       │  ← chat loop + tool execution
│   - 12 hooks + 4 custom tools                           │
│   - skills/agents/commands materialized to local dirs   │
└─────────────────────────────────────────────────────────┘
```

### 关于状态管理（我给的初步建议，待用户讨论）

**两种状态共存可能合理**：

- **Orchestration state** (Layer 3, tracker / external): 谁 active / done / blocked → Symphony 模型
- **Execution evidence** (Layer 1/2, JSONL ledger): 任务内部 evidence chain → 当前 alloy 模型

这样两种都不需要砍——分层做事。

## 还没决的事（下一会话讨论清单）

1. **reins 是不是已经实现了 Symphony 模式的 orchestrator？** 还是另一种 paradigm？
2. **codeflow 定位是什么？** 跟 Alloy 是 overlap 还是 complement？
3. **如果综合三个项目，最终产品形态是什么？** Mono-repo？多个相互依赖的 npm package？meta-package?
4. **状态管理改造路径**：
   - (a) **保留 JSONL ledger，加一层 daemon 包它**——daemon 读 tracker，dispatch 到 OpenCode session，session 里 plugin 仍写 JSONL
   - (b) **完全替换为 GSD 模式**——杀掉 JSONL，所有状态在 `.planning/*.md` 一类的 markdown 里
   - (c) **完全替换为 Symphony 模式**——杀掉 JSONL 和本地 md，所有状态在 tracker（Linear/GitHub Issues/Azure DevOps）
   - (d) **三态共存**：orchestration 在 tracker + execution evidence 在 JSONL + decision context 在 markdown
5. **从 Alloy v0.2 开始还是单独立项 v1.0?** 三项目综合是 alloy 的 v0.5，还是新项目？

## Repo 信息（下一会话需要的 quick refs）

```bash
# 当前 alloy
cd /Users/lumimamini/opencode-team-config   # 本地路径还是老的
git remote -v                                 # origin → lifeodyssey/alloy
git log --oneline origin/main | head -3
# 618a48e docs HTML
# 73f69ef v0.1.1 merge
# 8ac504e v0.1.0 release

# 两个待 inspect 的 repo
gh repo view lifeodyssey/reins
gh repo view lifeodyssey/codeflow

# Symphony 参考
gh api repos/openai/symphony/contents/SPEC.md --jq '.content' | base64 -d
```

## Session 经验教训（sub-agent driven 模式）

实施 v0.1.0/v0.1.1 时积累的几个 codex 协作经验，下个项目用得上：

1. **codex 经常完成实施但不 commit/push** — Card 3 / Wave 3 / Wave 4a / Wave 5 都出现过；标准对策是 git-state 等待脚本（poll worktree HEAD + status + remote）而不是 poll codex task 状态
2. **codex-companion task state 按 cwd hash 索引** — 同样 task ID 在不同目录查会"不存在"；wait script 必须 cd 进 worktree
3. **codex 在 "verifying" 阶段 hang 是常态** — Card 3 fixer / Wave 4a 都 hang 过；cancel + coordinator 接力是合理 fallback
4. **codex 通过 gh CLI 创 PR 常失败** — Wave 4b 经历过，coordinator 手工 `gh pr create` 兜底
5. **激进并行多个 codex（8 个同时跑）codex-companion 有 ~2 个并发上限**，超出 queue；总耗时不变但调度自动化
6. **prompt-as-contract 模式**：把 manifest schema 在 prompt 里定义，并发派的 codex 各自按 schema 写代码，coordinator merge 时校验一致——避免等前置完成才能开始后续

End of handoff.
