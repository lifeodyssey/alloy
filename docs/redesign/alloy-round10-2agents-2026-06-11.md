# alloy round 10 — 精简 agent：从 7 降到 2

> 你 round 9 标注说 OMO Slim 太重。派了 2 个 agent 搜了整个 OpenCode 生态，结论：**你是对的**。没有人在 7-agent 上跑成功的先例（除了 OMO 和 alloy）。生态趋势是越少 agent、越强 gate、越低认知负担。
>
> 这轮给精简方案：从 7→2，command-driven（GSD 模式）+ discipline skill gate（Superpower 模式）。不再讨论方向——这是最后一轮架构设计，认了直接进 v0.1.4。

---

## 0. 生态验证（2 个 agent 搜的，不脑补）

| 项目 | 自定义 agent 数 | 模式 |
|---|---|---|
| **OMO Slim** | 5-6 持久 agent | 最重，prompt-driven routing（alloy 抄的那个） |
| **GSD** | **0** 自定义 agent | 纯 slash command + phase 状态机，每 phase 一次性 spawn 子 agent，撕掉 |
| **Superpowers v5** | **0** 持久 agent | 14 个 discipline skill + 一次性 task dispatch |
| **OpenCode 原生** | **2**（plan+build） | sst/opencode 自带，就是这个 |
| **OpenCode Ensemble** | **2-3**（Scout→Builder→Reviewer） | 最接近的轻量社区实现，明确推荐"从 2-3 开始" |
| **alloy 现状** | **7** 持久 agent | 最重，没有之一 |

**一句话**：GSD 证明 0 个自定义 agent 能跑完 plan→execute→verify 全套。Superpower 证明 discipline 靠 skill gate 不靠 agent 数量。alloy 不需要发明 7-agent 舰队——**把 GSD 的 command-driven phase 机 + Superpower 的 gate 缝进 OpenCode 原生 2-agent 模型就够了**。

---

## 1. 新模型：2 agent + command-driven + gate

| 之前（OMO 模式，扔掉） | 之后（GSD×SuperPower 缝合） |
|---|---|
| 7 个持久 agent，LLM 看委派表自己派 | **2 个 agent**（Planner + Builder），slash command 路由，per-task 一次性子 agent |
| preset 热切换 skill 可见性 | agent frontmatter `permission` deny-only（你 r7 定的，保留） |
| Orchestrator 委派规则表 | **COMMAND_SKILLS map**：敲 `/plan`→alloy-plan skill→Planner agent；敲 `/execute`→alloy-execute skill→Builder agent |
| deep-debugger = Fixer escalation 规则 | Builder agent prompt 里的 circuit-breaker 规则（同 bug 卡 2 次→alloy-debug+提 opus），**不独立成 agent** |

### 1.1 两个 agent 长啥样

**Planner**（alias 原 Architect）：
- Mode: `primary`
- 能力：**只读**（read/grep/glob/webfetch/websearch）、可画图、可 brainstorm、可写 `.alloy/tasks/<id>/plan.md`
- 配模型：Opus（设计要深度推理）
- Deny：alloy-tdd/execute/debug 等执行类 skill + bash/edit
- Phase 对应：/discuss、/plan

**Builder**（alias 原 Builder）：
- Mode: `primary`
- 能力：**读写**（read/edit/bash）、force alloy-tdd、force alloy-debug（= gate 强制）
- 配模型：Sonnet（写代码够快）
- Deny：alloy-plan/discuss/brainstorm 等设计类 skill + exa（设计阶段才要网络调研）
- Phase 对应：/execute
- 含 deep-debugger circuit breaker（同 bug 2 次→alloy-debug+opus）

### 1.2 那 Explorer/Reviewer/Fixer/Tester 呢

**不是持久 agent，是按需的一次性子 agent**（GSD 模式 + OpenCode Ensemble 的"per-task one-shot"）：

| 角色 | 什么时候 spawn | 谁 spawn |
|---|---|---|
| **Explorer** | 需要广搜代码库 / 找 conventions / 找入口点 | Planner（/plan 阶段）或 Builder（execute 开始时）|
| **Fixer** | 单个 bug 已复现、需要修 | Builder 自己修（少于 20 行）或 Builder spawn 一次性 Fixer 子 agent（多文件）|
| **Reviewer** | PR 之前 / verify phase 入口 | Builder spawn，或 `/verify` 命令触发 |
| **Tester** | team mode QA / 正式 review 后 | Reviewer spawn 或 `/qa` 命令触发 |

机制：**OpenCode 原生 `@agent` Task 工具**（v1.15.10 源码确认：开全新 child session，上下文隔离）。alloy 不写任何 dispatch 代码。

**对比**：

| | 之前（7-agent fleet） | 之后（2+ 一次性） |
|---|---|---|
| 每次 session 装的 agent | 7 个全装 | **2 个常驻** |
| Explorer 在路由规则里 | 总在，Orchestrator 要判断 | Planner/Builder **需要时才 spawn**，用完撕掉 |
| Reviewer 什么时候出现 | 常驻，噪音 | Builder 干完活 spawn 一次，review 完就没了 |
| 认知负担（你的体感） | 7 个 agent 每个都要"Delegate when/Don't" | **只有 2 个 agent**，没有委派规则表 |

---

## 2. 那 Command-driven 怎么驱动（GSD 模式）

你已经有 COMMAND_SKILLS map：

```
/discuss → alloy-discuss → Planner
/plan    → alloy-plan    → Planner
/execute → alloy-execute → Builder
/verify  → alloy-verify  → Builder spawn Reviewer 子 agent
```

**你敲 `/plan` → hook 路由 skill→Planner agent 读 skill→出 plan.md→Planner 退出**。你敲 `/execute` → 切换到 Builder agent→读 plan.md→Builder 开干→Builder spawn 一次性 Explorer/Fixer/Reviewer 按需。

**这跟 GSD 一模一样**：slash command = phase 转换 = 换个 agent = 换 context。

跟 alloy 现在 COMMAND_SKILLS map 的对齐——你**已经有这个机制了**（plugin.ts:59-63），只是现在每个命令都 route 到 **同一个 Orchestrator agent**。改成 `/plan` route 到 Planner、`/execute` route 到 Builder。

---

## 3. 那 Gate 怎么强制（Superpower 模式）

Gate 不变（你 r8 已定）：progress.md 的 `## Gate` checkbox，plugin 自动勾（信条 #1，code 强制）。

discipline skill 绑定 phase gate：
- **/execute 入口**：Builder agent prompt 写"你负责 implement。**任何代码必须先写失败测试**（alloy-tdd）。任何 bug **必须先 debug**（alloy-debug）"。这不是 prompt 建议——是 gate 卡你（tdd_red checkbox 不勾就不让 close execute）。
- **/verify 入口**：Builder spawn Reviewer 子 agent，Reviewer 读 plan.md AC checklist→对每项验收→gate 查 review checkbox。

这就是 **Superpower 的"discipline skill gate"**，但不用 Superpower 的 14 个 skill——只用 alloy 的 3 个核心（alloy-plan/alloy-tdd/alloy-debug + alloy-verify）。其余 skill 按需挂（QA/scope/utility）。

---

## 4. 7→2 之后的 v0.1.4 改动对比

| 原 plan（round 8，7-agent） | 精简后（2-agent） |
|---|---|
| 7 个 agent 全保留，rename Architect→Planner | **砍 5 个 agent**（Orchestrator/Explorer/Fixer/Reviewer/Tester 不再常驻） |
| Orchestrator 加 7-agent 委派规则表 | **不写委派表**（命令路由 agent，不需要 LLM 判断派谁） |
| 每个 agent 的 deny-only skill/MCP | Planner（读，deny execute）+ Builder（写，deny plan/exa）——**只写 2 个** |
| deep-debugger = Fixer 规则 | **Builder prompt 里的 circuit breaker** |
| Wave 2 改 7 个 agent prompt | **改 2 个 agent prompt** |

**不变的部分**（gate/Wave1/Wave3 不动）：progress.md checkbox gate、markdown-only 状态、install 菜单、alloy-skills 拆 repo、vendor-sync、context 工具协调。

---

## 5. 文件层面——哪些要删、哪些要改

**删除（= net negative，代码净减少）：**

| 文件 | 原因 |
|---|---|
| `agents/Orchestrator.md` | 不持久，命令路由 agent |
| `agents/Explorer.md` | 按需 spawn 一次性 |
| `agents/Fixer.md` | Builder 自己 fix 或 spawn 一次性 |
| `agents/Reviewer.md` | 按需 spawn 一次性 |
| `agents/Tester.md` | 按需 spawn 一次性 |
| `packs/presets.json` | 之前 r7 已定砍 |

**修改：**

| 文件 | 改什么 |
|---|---|
| `agents/Architect.md` → `agents/Planner.md` | rename + frontmatter deny-only（deny edit/bash/alloy-tdd/alloy-execute/alloy-debug）+ prompt 重写（设计+计划，只读） |
| `agents/Builder.md` | frontmatter deny-only（deny alloy-plan/discuss/brainstorm/exa）+ prompt 重写（force tdd+debug+circuit breaker） |
| `templates/opencode/alloy-plugin.ts` | COMMAND_SKILLS 路由改：/plan→Planner，/execute→Builder，/verify→Builder |
| `packs/atoms.json` | agent atom 从 7→2；Architect→Planner |
| `bin/alloy.mjs` / `scripts/test_*.py` | 断言更新（agent 数从 7→2） |

**不变（保留）：**

| 文件 | 原因 |
|---|---|
| `commands/*.md`（/plan /execute /verify /discuss /autopilot） | 你已有这个 GSD-style 机制 |
| `universal/skills/alloy-*` | skill 不动——只是从 7 个 agent 共享变成 2 个 agent + 一次性子 agent 用 |
| Wave 1 全部（状态层 markdown-only） | 不动 |
| Wave 3 全部（安装分发） | 不动 |

---

## 6. 回答你 round 7 那条关于"subtask 工具"的结论

**现在更清楚了**：7→2 后，Builder spawn 一次性子 agent（Explorer/Fixer/Reviewer/Tester）**完全走 OpenCode 原生 Task 工具**，alloy 不用造任何 subtask 机制。跟 round 6 的结论一致，但更轻：不是 7 个常驻 agent 之间的委派，而是 2 个常驻 agent + 按需 spawn。

---

## 7. 工作量影响

砍 5 个 agent = Wave 2 工作量**减半**（少写 5 个 prompt、少维护 5 套 deny-only、不写委派规则表）。net 代码净减少 5 个文件 + 1 个 presets.json。

---

## 你认这 3 点就行

1. **2 agent（Planner + Builder）+ command-driven**（GSD 模式）替 7-agent fleet（OMO 模式）——你认吗？
2. **一次性子 agent**（Explorer/Fixer/Reviewer/Tester）按需 spawn，走 OpenCode 原生 Task，不常驻——你认吗？
3. **Gate 强制 discipline skill**（tdd/debug/verify 跳不过）= Superpower 模式的精髓——你认吗？

认了我就把 round 8 实施 plan 更新成 2-agent 版本，不再讨论架构，直接开 Wave 1。
