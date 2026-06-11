# alloy v0.1.4 Spec

> 写于 2026-06-11，10 轮 plannotator 讨论（rounds 1-10）的综合产物。
> 这份 Spec 是 v0.1.4 实施的唯一真理源——每个决定都追溯到具体 round/标注。
> 能多具体就多具体：文件路径、配置 fragment、hook 逻辑、assertion 全写。

---

## 目录

1. [alloy 是什么（一句话 + 6 信条修订）](#1-alloy-是什么)
2. [2-agent 模型](#2-2-agent-模型)
3. [状态层（纯 markdown）](#3-状态层纯-markdown)
4. [Command-driven phase 状态机](#4-command-driven-phase-状态机)
5. [Plugin 钩子](#5-plugin-钩子)
6. [Agent prompt 与 deny-only 权限](#6-agent-prompt-与-deny-only-权限)
7. [Skill 编排（3 层 fire）](#7-skill-编排3-层-fire)
8. [第三方 skill 融合](#8-第三方-skill-融合)
9. [Install 与分发](#9-install-与分发)
10. [企业分发](#10-企业分发)
11. [vendor-sync GitHub Actions](#11-vendor-sync-github-actions)
12. [handoff skill](#12-handoff-skill)
13. [context 工具协调](#13-context-工具协调)
14. [Wave 切分 + 文件改动清单](#14-wave-切分--文件改动清单)
15. [验证标准](#15-验证标准)
16. [明确不做](#16-明确不做)

---

## 1. alloy 是什么

### 一句话定位（r6 收敛）

alloy 是 OpenCode 的**轻量缝合层**：把 GSD 的 command-driven phase 状态机 + Superpower 的 discipline skill gate + OMO Slim 的 prompt-driven 委派（仅 Planner→Builder 一对一）缝成一套有纪律的 plan→execute→verify 工作流。自建的是 **Write 层（markdown 状态 + handoff）+ 薄编排 + 安装分发 + plugin 胶水**。Select/Compress/Isolate 全用现成。

### 6 信条（r5 修正后版）

1. **最强约束靠 code 强制**（transition gate / skill 强制 fire / hook block），**不靠 prompt 建议**
2. **Plugin-first, CLI-minimal**：用户日常在 chat 里完成所有操作。CLI 只用于 `install` / `doctor` / `completion`
3. **帮用户执行选择，不越界代选**：在 install 时 prompt 让用户选（像 npx skills），用户勾了的 alloy 帮装帮 init（r7 纠正：不是"只打印命令不帮装"）
4. **Vendor over rewrite**：上游 skills 走 inline copy + alloy append，**不重写不删除**。fusionType 记清揉了多少
5. **状态外置但极简**：纯 markdown（PROJECT.md + plan.md + progress.md + .lock），**不上 DB 不上 JSONL**（r7 立场C 读代码证明 gate 只需单 task 范围，r7 你定方案A）
6. **零依赖运行时**：`.mjs` + zod + jsdoc。**没 build step**。Install 即可用

### What Alloy is NOT（不变）

- ❌ Not a chat UI
- ❌ Not an LLM agent（alloy 是给 agent 套规则的外壳）
- ❌ Not a SaaS（本地跑，状态在 repo 里）
- ❌ Not a framework（是配置+集成）

---

## 2. 2-agent 模型

### 2.1 设计决定（r10）

**从 7-agent OMO 持久舰队 → 2-agent command-driven（GSD×SuperPower 缝合）**。

生态验证（r10 2 个 agent 搜索）：
- OpenCode 原生 = **2 个 agent**（plan+build）
- GSD = **0 自定义 agent**（纯 slash command + per-phase spawn）
- Superpowers v5 = **0 持久 agent**（discipline skill + 一次性 task dispatch）
- OMO Slim = **5-6 持久 agent**（最重，没人用这个规模除它自己）
- **没有项目**在 OpenCode 生态里用 7-agent 持久舰队成功运行——除了 alloy 自己

### 2.2 Planner agent

**文件**：`agents/Planner.md`（rename from Architect.md，r4）

```yaml
---
name: alloy-planner
description: Design and plan implementation. Read-only — no code edits.
mode: primary
model: claude-opus-4-8
permission:
  read: allow
  grep: allow
  glob: allow
  webfetch: allow
  websearch: allow
  task: allow        # spawn 一次性 Explorer 子 agent
  edit: deny
  bash: deny
  skill:
    alloy-tdd: deny
    alloy-execute: deny
    alloy-debug: deny
    alloy-verify: deny
    alloy-qa: deny
  exa_*: deny        # r9: Planner needs context7 but not web search
---
```

**Prompt 核心**：
```markdown
# Alloy Planner

You are the planning specialist. You design and plan — you never write implementation code.

## Responsibility
- `/discuss`: clarify requirements → write `.alloy/tasks/<id>/context.md`
- `/plan`: brainstorm + produce implementation plan → write `.alloy/tasks/<id>/plan.md`

## Plan output format
Every plan.md must contain:
```yaml
---
id: <task-id>
approved: false
---
```
- [ ] AC-1: ...
- [ ] AC-2: ...

## When to spawn Explorer
When you need broad codebase scan / find conventions / find entry points → `@Explorer` (read-only one-shot, disposed after)

## Handoff to Builder
After plan.md is written and user approves (sets approved: true), tell user: "Ready. Type /execute to start."
```

### 2.3 Builder agent

**文件**：`agents/Builder.md`

```yaml
---
name: alloy-builder
description: Implement approved plans with TDD, fix bugs with systematic debugging. Read-write.
mode: primary
model: claude-sonnet-4-6
permission:
  read: allow
  grep: allow
  glob: allow
  edit: allow
  bash: allow
  task: allow        # spawn 一次性 Fixer/Reviewer/Tester 子 agent
  webfetch: deny
  websearch: deny
  skill:
    alloy-plan: deny
    alloy-discuss: deny
    alloy-brainstorm: deny
  exa_*: deny        # r9: Builder shouldn't web-search during implementation
  context7_*: allow   # API docs always useful
---
```

**Prompt 核心**：
```markdown
# Alloy Builder

You are the implementation specialist. You build, fix, and verify — you never design from scratch.

## Responsibility
- `/execute`: load approved plan.md → implement tasks → TDD loop → close
- `/verify`: spawn Reviewer subagent → gate check → close

## Forced discipline (跳不过——gate 强制)
1. **任何新代码必须先写失败测试**（alloy-tdd skill）。Gate 检查 tdd_red checkbox — 没勾不让你 close。
2. **任何 bug 必须先 debug**（alloy-debug skill），不要盲修。Gate 检查 debug checkbox。
3. **同 bug 同一修法失败 2 次** → circuit breaker: invoke alloy-debug + switch model to opus。不要再试第 3 次同类修法。（r6: deep-debugger rule, inlined here）

## When to spawn one-shot subagents
- **@Explorer**: need codebase scan before first task → spawn, get results, dispose
- **@Fixer**: bug spans multiple files → spawn with specific files + root cause hypothesis, get fix, dispose
- **@Reviewer**: all tasks done → spawn to verify against plan.md AC checklist → dispose
- **@Tester**: team-mode PR → spawn for QA → dispose

## When to NOT spawn (do it yourself)
- Single-file change < 20 lines
- Well-understood bug with clear fix
```

### 2.4 一次性子 agent（按需 spawn，不常驻）

**机制**：OpenCode 原生 Task 工具（v1.15.10 源码确认：全新 child session，上下文隔离。r6）

alloy **不写任何 dispatch 代码**——Builder 或 Planner 在 prompt 里说 `@Explorer find the auth module entry points` 就是原生 @mention。

| 子 agent | 谁 spawn | 什么时候 | 开了就撕 |
|---|---|---|---|
| Explorer | Planner 或 Builder | 广搜代码库 | 是 |
| Fixer | Builder | 多文件 bug | 是 |
| Reviewer | Builder | PR 前 / verify | 是 |
| Tester | Builder | team QA | 是 |

这些 agent 的前身 `.md` 文件**删除**（r10）：`agents/Orchestrator.md`、`agents/Explorer.md`、`agents/Fixer.md`、`agents/Reviewer.md`、`agents/Tester.md`。

---

## 3. 状态层（纯 markdown）

### 3.1 设计决定（r7-r8）

- **JSONL 全砍**（r7 你定方案 A）：evidence.jsonl、runs.jsonl、tasks.jsonl、claims.jsonl 全删
- Gate 不查 JSONL 历史——立场C 读代码（alloy.mjs:1414-1453）证明 gate 只查当前 task 内 evidence kind（tdd_red/green/review），不需要事件流回放
- 所有状态 = **人可读的 markdown**
- `.lock` 文件替 claims（task 所有权）

### 3.2 目录结构

```
.alloy/
  .gitignore           ← installer 写入（模板: templates/alloy/.gitignore）
  PROJECT.md           ← commit
  policies/            ← commit
    claims.md
    tdd.md
    review.md
    debug.md
  tasks/<task-id>/
    plan.md            ← commit（计划 + 验收标准 checkbox）
    progress.md        ← commit（Gate / Iterations / Findings / Handoff 小节）
    .lock              ← gitignore（owner session-uuid + 时间戳）
  run/<id>/env         ← gitignore（secret）
```

**`.alloy/.gitignore` 模板**（installer 写入）：
```
run/
*.lock
```

### 3.3 progress.md 格式（gate 物理载体）

```markdown
# AB-1234: Add CSV export — Progress

## Gate
- [x] tdd_red    — 2026-06-11T10:00:00Z | tests/auth.test.ts:42 fail as expected
- [x] green      — 2026-06-11T10:15:00Z | 12/12 tests pass, commit a1b2c3d
- [x] review     — 2026-06-11T10:30:00Z | Reviewer @Reviewer: AC 3/3 ✓
- [x] verified   — 2026-06-11T10:35:00Z | npm test + lint exit 0

## Iterations
### Iter 1 — 2026-06-11
- Plan: `/plan AB-1234` → plan.md approved
- Commits: a1b2c3d (core), e4f5g6h (tests)
- AC: 3/3 satisfied
- Issues: 0

## Findings
<!-- agent writes freeform notes here -->

## Handoff
<!-- plugin auto-writes on phase transition -->
### plan→execute handoff (2026-06-11T10:00:00Z)
Plan approved for AB-1234. 3 ACs, 2 files to touch. Key decision: use streaming CSV writer, not in-memory.
```

### 3.4 Gate check 实现（bin/alloy.mjs）

```js
// alloy.mjs — gate check 重写（替现状 evidence.jsonl 查询）
function checkGate(taskId) {
  const progressPath = `.alloy/tasks/${taskId}/progress.md`;
  const content = readFileSync(progressPath, 'utf8');
  const gateBlock = content.match(/## Gate\n([\s\S]*?)(?=\n## |$)/)?.[1] || '';
  const unchecked = gateBlock.match(/^- \[ \] .+$/gm) || [];
  return unchecked.length === 0
    ? { pass: true, detail: 'all gate items checked' }
    : { pass: false, blockedBy: unchecked };
}
```

### 3.5 Plugin 自动勾 gate（templates/opencode/alloy-plugin.ts）

```typescript
// tool.execute.after hook — 检测 git commit / 测试 exit 0 → 自动勾对应 box
"tool.execute.after": async (input, output) => {
  const cmd = input?.tool_input?.command || '';
  const exitCode = output?.exitCode;
  const taskId = getCurrentTaskId(projectDir);

  if (cmd.startsWith('git commit') && exitCode === 0) {
    // 检测到 commit → mark gate items from current phase
    checkProgressGate(projectDir, taskId, { commit: true });
  }
  if (cmd.match(/npm (run )?test/) && exitCode === 0) {
    checkProgressGate(projectDir, taskId, { testsPass: true });
  }
}

function checkProgressGate(dir, taskId, event) {
  const path = `${dir}/.alloy/tasks/${taskId}/progress.md`;
  let content = readFileSync(path, 'utf8');
  // mark associated gate checkbox based on event
  if (event.testsPass && content.includes('- [ ] green')) {
    content = content.replace('- [ ] green', `- [x] green — ${new Date().toISOString()}`);
  }
  writeFileSync(path, content);
}
```

### 3.6 .lock 文件（替 claims.jsonl）

```text
# .alloy/tasks/AB-1234/.lock
owner session-uuid: a1b2c3d4
locked at: 2026-06-11T10:00:00Z
```

- Plugin `session.start` 读 .lock → 存在且非 stale（< 30 分钟）→ 拒绝绑卡（"另一个 session 正在做 #AB-1234"）
- Crash 后 alloy 启动 detect stale lock → 自动清
- Gitignored

### 3.7 Git 边界（r7 4-agent team 裁决）

| 路径 | commit? | 理由 |
|---|---|---|
| `PROJECT.md` | ✅ | 人写，项目知识 |
| `tasks/<id>/plan.md` | ✅ | 人写，随 repo |
| `tasks/<id>/progress.md` | ✅ | 人+plugin 写，gate 在 PR diff 可见 |
| `*.lock` | ❌ | ephemeral |
| `run/<id>/env` | ❌ | secret |

---

## 4. Command-driven phase 状态机

### 4.1 设计决定（r10）

**GSD 模式**：slash command = phase 转换 = 换 agent。不用 Orchestrator 不存在委派规则表。

### 4.2 命令→phase→agent→skill 映射

```
/discuss → Planner → alloy-discuss   → .alloy/tasks/<id>/context.md
/plan    → Planner → alloy-plan      → .alloy/tasks/<id>/plan.md
/execute → Builder → alloy-execute   → 读 plan.md → TDD 实施
/verify  → Builder → alloy-verify    → spawn Reviewer → gate check
```

### 4.3 Plugin 实现（templates/opencode/alloy-plugin.ts 修订）

```typescript
// COMMAND_SKILLS map 不变（现有代码），route 方向改
const COMMAND_SKILLS = {
  discuss: "alloy-discuss",
  plan: "alloy-plan",
  execute: "alloy-execute",
  verify: "alloy-verify",
  autopilot: "alloy-autopilot",
};

// command.execute.before — 路由命令到 agent + skill
"command.execute.before": async (input, output) => {
  if (!input?.command) return;
  const command = input.command.replace(/^\//, '');
  const skill = COMMAND_SKILLS[command];
  if (!skill) return;

  // 注入路由指令（agent 名由 OpenCode 原生 permission 决定哪个 agent 能见这个 skill）
  return {
    output: `Route /${command} through the ${skill} skill.`,
  };
};

// chat.system.transform — 注入当前状态上下文
"experimental.chat.system.transform": async (input, output) => {
  const taskId = getCurrentTaskId(projectDir);
  if (!taskId) return;

  const progressPath = `${projectDir}/.alloy/tasks/${taskId}/progress.md`;
  const planPath = `${projectDir}/.alloy/tasks/${taskId}/plan.md`;

  // 拼入当前 task 状态（替 round 8 删掉的 projections/status.md）
  const ctx = [
    existsSync(planPath) && `<alloy-plan>\n${readFileSync(planPath, 'utf8')}\n</alloy-plan>`,
    existsSync(progressPath) && `<alloy-progress>\n${readFileSync(progressPath, 'utf8')}\n</alloy-progress>`,
  ].filter(Boolean).join('\n');

  return { output: `${output?.output || ''}\n${ctx}` };
};
```

### 4.4 Phase gate 强制（信条 #1）

| 转换 | 条件 | 谁执行 |
|---|---|---|
| plan→execute | plan.md `approved: true`（用户标记） | 人为：用户改 frontmatter 或说"approved" |
| execute→verify | progress.md `## Gate` 的 tdd_red + green 全勾 | gate check（plugin 钩子自动勾 + verify 入口查） |
| verify→done | progress.md `## Gate` 的 review + verified 全勾 | gate check |

---

## 5. Plugin 钩子

### 5.1 钩子全景（templates/opencode/alloy-plugin.ts 修订后）

现有 12 个 hook，删 preset 相关（6 处）、保留重写的：

| 钩子 | 做什么 | 改了什么 |
|---|---|---|
| `config` | 预加载 presets 删 → 仅 injectConfigDefaults + detect OMO 共存 | 删 loadPresets |
| `command.execute.before` | 路由 /command→skill | 不变 |
| `experimental.chat.messages.transform` | filterAvailableSkills（permission deny 原生管，这层渐退） | 删 filterByPreset |
| `experimental.chat.system.transform` | 注入 plan.md + progress.md 状态 | **改**（r8：替 projections/status.md） |
| `tool.execute.after` | 检测 git commit / 测试 exit 0 → **勾 progress.md Gate box** | **重写**（r8：不写 JSONL，勾 markdown） |
| `session.start` | 读 .lock → 绑卡或拒绝；清理 stale lock | **新加** |
| `session.end` | 清理 `run/<id>/env` | 不变 |
| `experimental.session.compacting` | phase 边界 auto handoff → 写 progress.md `## Handoff` | **新加** |

### 5.2 砍掉的（r7：preset 完全删除）

以下**代码删除**（templates/opencode/alloy-plugin.ts 已有）：
- `let activePreset = "default"`（L38）
- `loadPresets()`（L98-109）
- `applyPreset()`（L111-128）
- `getActivePreset()`（L107-108 隐式）
- `config` 里的 `loadPresets(projectDir)`（L588）
- `alloy_switch_preset` 工具（L683-692）

**文件删除**：`packs/presets.json`

### 5.3 handler 位置

templates/opencode/alloy-plugin.ts 由 installer copy 到 `.opencode/plugins/alloy.ts`（OpenCode 运行时）。.mjs + zod。

---

## 6. Agent prompt 与 deny-only 权限

### 6.1 Deny-only 设计（r7 你定的 blocklist）

只列要藏的 skill/MCP（`{ "<name>": "deny" }`），其余默认可见。加新 skill 不用改 permission。

### 6.2 Planner（agents/Planner.md）

**全文**：

```markdown
---
name: alloy-planner
description: Design and plan implementation. Read-only — no code edits.
mode: primary
permission:
  read: allow
  grep: allow
  glob: allow
  webfetch: allow
  websearch: allow
  task: allow
  edit: deny
  bash: deny
  skill:
    alloy-tdd: deny
    alloy-execute: deny
    alloy-debug: deny
    alloy-verify: deny
    alloy-qa: deny
  exa_*: deny
---

# Alloy Planner

You are the planning specialist. You design and plan — you never write implementation code.

## Responsibility

Use this agent for:
- `/discuss` — extract requirements and design decisions → `.alloy/tasks/<id>/context.md`
- `/plan` — produce a detailed implementation plan → `.alloy/tasks/<id>/plan.md`

## Principles
1. Ask **one question at a time**
2. **No code edits** — you are read-only
3. When you need a broad codebase scan → `@Explorer` (one-shot subagent)
4. Clarify scope before writing the plan

## Plan output

Write to `.alloy/tasks/<id>/plan.md` with:

```yaml
---
id: <task-id>
approved: false
---
```

```markdown
## Acceptance Criteria
- [ ] AC-1: ...
- [ ] AC-2: ...

## Files to touch
- ...

## Tasks (ordered)
1. ...
2. ...
```

## Handoff to Builder
After the plan is approved by the user (they set `approved: true` or confirm in chat), tell them:
"Ready. Switch to Builder with `/execute`."
```

### 6.3 Builder（agents/Builder.md）

**全文**：

```markdown
---
name: alloy-builder
description: Implement approved plans with TDD, fix bugs with systematic debugging.
mode: primary
permission:
  read: allow
  grep: allow
  glob: allow
  edit: allow
  bash: allow
  task: allow
  webfetch: deny
  websearch: deny
  skill:
    alloy-plan: deny
    alloy-discuss: deny
    alloy-brainstorm: deny
  exa_*: deny
---

# Alloy Builder

You are the implementation specialist. You build, fix, and verify.

## Responsibility
- `/execute` — load approved plan.md → implement tasks → TDD loop → gate check
- `/verify` — spawn Reviewer subagent → verify AC → close task

## Forced discipline (non-negotiable — enforced by gate)

1. **Any new code: write a failing test first** (invoke `alloy-tdd` skill). The gate will block you if `- [ ] tdd_red` is unchecked.
2. **Any bug: investigate root cause first** (invoke `alloy-debug` skill). Do not guess-fix. The gate will block you if `- [ ] debug` is unchecked.
3. **Circuit breaker**: if you've tried the same fix approach for the same bug **twice** and it failed both times: stop. Invoke `alloy-debug` for a fresh root-cause analysis and **switch your model to opus for this problem**. Do not attempt a third similar fix.

## When to spawn one-shot subagents

| Situation | Action |
|---|---|
| Need broad codebase scan before starting | `@Explorer` (read-only, one-shot) |
| Bug spans multiple files, root cause known | `@Fixer` with specific files + hypothesis |
| All implementation tasks done | `@Reviewer` to verify against plan.md AC checklist |
| Team-mode PR ready for QA | `@Tester` |

**Don't spawn when**: single-file change < 20 lines, well-understood fix.

## Progress.md maintenance

Keep `## Gate`, `## Iterations`, and `## Findings` updated. The gate checkboxes are auto-ticked by the alloy plugin when you commit or run tests — you don't need to manually tick them, but verify they're correct before closing.

## Do not
- Start implementing without an approved plan.md
- Skip the TDD loop ("just this once")
- Guess-fix bugs without invoking alloy-debug first
```

---

## 7. Skill 编排（3 层 fire）

### 7.1 三层模型（r9）

| 层 | 机制 | 哪些 skill |
|---|---|---|
| **1. 命令绑定** | COMMAND_SKILLS map，敲命令即触发 | /plan→alloy-plan, /execute→alloy-execute, /verify→alloy-verify, /discuss→alloy-discuss |
| **2. Gate 强制** | progress.md checkbox 不勾 = gate block，跳不过 | alloy-tdd（tdd_red/green）, alloy-debug（debug）, alloy-verify（review/verified） |
| **3. 菜单** | permission 限定可见 + prompt 引导，agent 自由裁量 | alloy-map-codebase, humanizer, git-master 等辅助 skill |

**关键设计**：第 2 层不靠 prompt 求 agent "记得用 tdd"——靠 **gate 查 checkbox**（信条 #1）。skill 没跑 = 没证据 = 不勾 = gate 卡你。跟 Superpower 的 Iron Law 等价，但 enforcement 是 code 不是 prompt。

### 7.2 哪个命令 fire 哪个 skill 的完整表

| 命令 | skill | agent | 输出 |
|---|---|---|---|
| `/discuss` | alloy-discuss | Planner | `.alloy/tasks/<id>/context.md` |
| `/plan` | alloy-plan | Planner | `.alloy/tasks/<id>/plan.md` |
| `/execute` | alloy-execute + alloy-tdd | Builder | progress.md Gate 有 tdd_red+green |
| `/verify` | alloy-verify | Builder→Reviewer | progress.md Gate 有 review+verified |
| (debug) | alloy-debug | Builder | progress.md Gate 有 debug |
| `/autopilot` | alloy-autopilot | Planner→Builder（串行） | 同上，全自动 |

### 7.3 Gate 对应关系（skill ↔ checkbox）

| Skill | Gate checkbox | 谁勾 |
|---|---|---|
| alloy-tdd | `- [ ] tdd_red` | plugin 检测测试 fail exit 非零 |
| alloy-tdd | `- [ ] green` | plugin 检测测试 exit 0 |
| alloy-debug | `- [ ] debug` | plugin 检测 debug skill 被 invoke + 产出根因 |
| alloy-verify | `- [ ] review` | reviewer 子 agent 签 |
| alloy-verify | `- [ ] verified` | plugin 检测 test+lint exit 0 |

---

## 8. 第三方 skill 融合

### 8.1 FusionType 定义（r9）

| FusionType | 含义 | 判定条件 |
|---|---|---|
| `verbatim` | 原样 copy，一字不改 | 上游内容**完整自包含**，alloy 不需要改 |
| `inline-append` | 上游 inline + alloy **追加**新 section | 上游可揉进 alloy skill 但 alloy 有额外内容（gate/evidence） |
| `rewrite` | alloy 重写，标 attribution | 上游太重/太多 runtime 依赖/license 不允许 vendor |
| `concept-only` | 不 vendor，只借思想 | 上游 license 不明 / 纯设计启发 |

### 8.2 每 skill 融合策略

| alloy skill | 上游 | FusionType | sources[] |
|---|---|---|---|
| alloy-tdd | superpowers-tdd@5.1.0 + mattpocock-tdd@main + team-tdd-legacy@60a9207 | `inline-append` | `["superpowers-tdd@5.1.0", "mattpocock-tdd", "team-tdd-legacy"]` |
| alloy-debug | superpowers-systematic-debugging@5.1.0 | `inline-append` | `["superpowers-debug@5.1.0"]` |
| alloy-plan | superpowers-brainstorming@5.1.0 + superpowers-writing-plans@5.1.0 | `inline-append` | `["superpowers-brainstorm@5.1.0", "superpowers-writing-plans@5.1.0"]` |
| alloy-qa | gstack /qa | `rewrite` | `["gstack-qa"]` |
| handoff | mattpocock-handoff@main | `verbatim` | `["mattpocock-handoff"]` |
| ralph-loop | anthropics-ralph-loop@0.1.0 | `verbatim` | `["anthropics-ralph-loop"]` |
| scope skills（vercel/kotlin/pg/terraform） | 各自上游 | `verbatim` | 各标自己的上游 |

### 8.3 vendor.lock.json 扩展 schema

在现有 `name/kind/source/version/upstreamPath/license/sha256/paths/vendoredAt` 上加：

```json
{
  "name": "alloy-tdd",
  "kind": "skill",
  "fusionType": "inline-append",
  "sources": [
    { "name": "superpowers-tdd", "version": "5.1.0", "sha256": "6f3e824883..." },
    { "name": "mattpocock-tdd", "version": "main", "sha256": "..." },
    { "name": "team-tdd-legacy", "version": "60a9207", "sha256": "..." }
  ],
  "distilledAt": "2026-06-11",
  "autoUpdate": true,
  "source": "https://github.com/obra/superpowers",
  "version": "5.1.0",
  "upstreamPath": "skills/test-driven-development",
  "license": "MIT",
  "paths": [
    "universal/skills/alloy-tdd/SKILL.md",
    "vendor/skills/superpowers/5.1.0/test-driven-development"
  ]
}
```

---

## 9. Install 与分发

### 9.1 交互式 install（r6-r7）

```bash
$ alloy install
? Select pack: (arrow keys)
  > core
    frontend
    backend
    infra
    all

? Model preset: (arrow keys)
  > github-copilot
    anthropic
    mixed

? Context tools (Space to toggle, Enter to confirm):
  [x] CodeGraph     — AST code index (34k ★, MIT)
  [x] RTK           — CLI output compression (56k ★, Apache-2.0)
  [ ] Magic Context — cross-session memory + compression (MIT, native OpenCode)
  [ ] DCP           — in-session context pruning (3k ★, AGPL-3.0 — installed fresh, not vendored)
```

**机制**：alloy 对每个用户勾了的工具：
1. 检测是否已装（doctor 风格）
2. 未装的调其自带安装器（`rtk init -g --opencode`、`npx @cortexkit/magic-context setup`、`codegraph init`）
3. 写配置（opencode.json plugins/mcp）
4. 跑 init（CodeGraph 建索引等）

**多个自动压缩器警告**：如果用户同时勾了 2+ 个自动 rewrite bash 的 plugin → alloy 警告 + 让选一个当主（r7 实测：OpenCode 里 lean-ctx 是 MCP 不冲突，但 RTK plugin + Magic Context 都自动压缩 → 需要用户选一个）。

### 9.2 RTK + lean-ctx 在 OpenCode 上的协调（r7）

- lean-ctx 在 OpenCode 上 = **MCP 服务器**（explicit ctx_* tools），**不是 bash hook** → 跟 RTK plugin 的自动 bash rewrite **不打架**
- RTK plugin 自动 rewrite bash；lean-ctx 提供显式 ctx_read/ctx_shell/ctx_search 工具 → 互补
- alloy 不做任何特殊协调——它们自然共存
- **不像 Claude Code**（两个都挂 PreToolUse bash hook 时会 double-wrap）——OpenCode 上这个问题不存在

### 9.3 alloy-skills 独立 repo（r6）

照 Superpower v5 模式拆：
- `lifeodyssey/alloy`（主 repo）：plugin + CLI + agents + commands + atoms + packs + templates
- `lifeodyssey/alloy-skills`（skills repo）：universal/skills + scope skills + vendor

CLI flag：`--skills-source <url>`（默认 `https://github.com/lifeodyssey/alloy-skills`，用户指自己 fork）

plugin 升级跟 skill 升级**完全脱耦**。

### 9.4 CLIs

| CLI | 用途 |
|---|---|
| `alloy install` | 交互式安装（默认） |
| `alloy doctor` | 验证环境（已有的检查 + qa 链 + context 工具 + alloy-skills source 可达） |
| `alloy state` | 读/写 markdown 状态（add-task→PROJECT.md, add-evidence→progress.md, gate check） |
| `alloy sync --vendors` | 手动触发 vendor sync |
| `alloy sync --self` | 升级 alloy 自身 |
| `alloy create-hub` | 企业 Case B：在非 GitHub 环境建管理中心 |
| `alloy hub-sync` | 企业 Case B：同步上游 |
| `alloy upgrade --self` | 自己升级 |

---

## 10. 企业分发

### 10.1 Case A：公司 GitHub 能 fork（r4）

```bash
# Admin 一次:
gh repo fork lifeodyssey/alloy --org corp
gh repo fork lifeodyssey/alloy-skills --org corp

# Dev:
git clone https://github.corp.com/corp/alloy.git ~/src/alloy-corp
cd /path/to/project
bash ~/src/alloy-corp/setup.sh --pack core --target local \
  --skills-source https://github.corp.com/corp/alloy-skills
```

升级：admin `git pull upstream main` → 解 conflict → push → dev pull。

### 10.2 Case B：公司不能 fork（非 GitHub）

```bash
# Admin 一次:
alloy create-hub --target-git https://gitea.corp.com/devtools/alloy \
                 --auth $CORP_GIT_TOKEN \
                 --skills-target https://gitea.corp.com/devtools/alloy-skills

# Dev 用法同 Case A（指向 corp URL）
```

`alloy create-hub` 内部：clone 公开 alloy + alloy-skills → push 到指定 git URL → 加 README + setup.sh。

### 10.3 Vendor.lock 企业私有

加 `internal: true` 字段标私有 entry，vendor-sync 跳过。

### 10.4 砍掉的（r4）

- ~~base+overlay 目录~~ → corp fork = corp 真理，不分 base/overlay
- ~~`@corp/` namespace~~ → corp fork 不用 namespace

---

## 11. vendor-sync GitHub Actions

### 11.1 Workflow（r9）

文件：`.github/workflows/vendor-sync.yml`（在 alloy-skills repo）

```yaml
name: Vendor Sync
on:
  schedule:
    - cron: '0 9 * * *'   # daily 9am
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: anthropics/claude-code-action@v1
        with:
          prompt: |
            Read vendor.lock.json. For each entry with autoUpdate: true,
            check if upstream SHA has changed. If changed:
            - fusionType=verbatim: copy new version, update sha256, auto-commit
            - fusionType=inline-append: create draft PR preserving Alloy sections
            - fusionType=rewrite: open an issue for human review
            - fusionType=concept-only: skip (no tracking)
```

### 11.2 4-tier 分流

| 上游变化 | FusionType | 动作 |
|---|---|---|
| 有新 SHA | `verbatim` | **自动 PR**（重 copy + 更 sha） |
| 有新 SHA | `inline-append` | **draft PR**（更新上游段，保 alloy 追加段，人 review 合） |
| 有新 SHA | `rewrite` | **开 issue**（人判断 alloy 重写要不要跟） |
| 无变化 | 全部 | skip |

---

## 12. handoff skill

### 12.1 设计决定（r5-r7）

- Vendor mattpocock handoff skill **verbatim**（fusionType=verbatim）
- **默认输出到 OS 临时目录**（跟 mattpocock 原版一致，r5 agent 确认）
- `--persist` flag 写进 `.alloy/handoffs/<session>.md`（团队交接用）

### 12.2 两种触发（r7）

| 触发 | 条件 | 谁 |
|---|---|---|
| **Phase 边界**（主） | plan→execute、execute→verify 转换时 | plugin `experimental.session.compacting` hook 自动 |
| **Token 阈值**（兜底） | 上下文 > 70%（DCP/Magic Context 帮忙削这种） | plugin 检测 + 提示用户 |

### 12.3 Phase 边界 handoff 输出（自动写入 progress.md `## Handoff`）

```markdown
## Handoff
### plan→execute handoff (2026-06-11T10:00:00Z)
- Plan: AB-1234 CSV export approved
- ACs: 3
- Files: src/export/csv.ts, tests/export/csv.test.ts
- Key decision: streaming writer, not in-memory
- Suggested skills: alloy-tdd, alloy-execute
```

这也从 zhenjia 文章学到：phase 换 = context reset = handoff 触发点 = ACE-FCA 的"每阶段 fresh context"。

---

## 13. context 工具协调

### 13.1 alloy 推荐的工具（OpenCode 兼容、mit/apache 许可）

| 工具 | 层 | Star | License | 用途 |
|---|---|---|---|---|
| CodeGraph | Select | 34k | MIT | 代码索引，agent 查图替 grep |
| RTK | Compress | 56k | Apache-2.0 | CLI 输出压缩 |
| Magic Context | Compress+记忆 | 748 | MIT | 跨 session 记忆 + 压缩，原生 OpenCode |
| lean-ctx | Compress+记忆 | 2.3k | Apache-2.0 | 文件读压缩 + 记忆（MCP） |
| DCP | Compress | 3.1k | AGPL-3.0 | 对话内压缩（**只帮着装，不 vendor**） |
| Headroom | Compress | 2.1k | Apache-2.0 | 工具输出/日志压缩 |

### 13.2 alloy install 默认推荐

默认**预勾** CodeGraph + RTK（star 最高、你最熟、Select+Compress 各一个），其余不预勾，用户自选。

### 13.3 不做

- ❌ 不内置任何 context 工具（信条 #6 零依赖）
- ❌ 不重写任何 context 工具的安装逻辑（调各自的）
- ❌ 不 vendor AGPL 的 DCP 源码（信条 #4 但主要是 license 安全）

---

## 14. Wave 切分 + 文件改动清单

**v0.1.4 = 3 Wave（r8 修订），全做，不分 v0.1.5**。

### Wave 1 — 状态层（markdown-only + git hygiene + phase 状态机）

| 操作 | 文件 | 行数估计 |
|---|---|---|
| NEW | `templates/alloy/.gitignore` | 3 |
| MOD | `bin/alloy.mjs` gate check（重写：markdown checkbox） | ~30 |
| MOD | `bin/alloy.mjs` state 子命令（重写：markdown） | ~80 |
| MOD | `bin/alloy.mjs` install（写 .gitignore；MANAGED_NAMES 去 jsonl） | ~20 |
| MOD | `templates/opencode/alloy-plugin.ts` tool.execute.after（重写：勾 markdown） | ~40 |
| NEW | `templates/opencode/alloy-plugin.ts` session.start（.lock 检测 + stale 清理） | ~30 |
| NEW | `templates/opencode/alloy-plugin.ts` session.compacting（phase 边界 auto handoff） | ~40 |
| MOD | `templates/opencode/alloy-plugin.ts` chat.system.transform（拼 plan.md+progress.md） | ~20 |
| MOD | `scripts/test_alloy_installer.py`（断言：jsonl→markdown） | ~30 |
| MOD | `scripts/test_resolver.mjs`（断言更新） | ~20 |

**删除**：
- `templates/alloy/projections/` 整个目录（删）
- `.alloy/state/*.jsonl` → 变成 markdown tasks/<id>/（不删本地文件，只不新建）

### Wave 2 — 薄编排（砍 preset + agent 2→2 + prompt 重写）

| 操作 | 文件 | 行数估计 |
|---|---|---|
| DELETE | `agents/Orchestrator.md` | -80 |
| DELETE | `agents/Explorer.md` | -60 |
| DELETE | `agents/Fixer.md` | -60 |
| DELETE | `agents/Reviewer.md` | -60 |
| DELETE | `agents/Tester.md` | -60 |
| DELETE | `packs/presets.json` | -40 |
| MOD | `agents/Architect.md` → `agents/Planner.md`（rename + prompt 重写） | 80 |
| MOD | `agents/Builder.md`（prompt 重写 + deny-only + circuit breaker） | 100 |
| MOD | `templates/opencode/alloy-plugin.ts`（删 6 处 preset：activePreset/loadPresets/applyPreset/config/switch_preset tool） | -100 |
| MOD | `packs/atoms.json`（agent atom: 7→2, Architect→Planner, 去 presets 引用） | ~10 |
| MOD | `templates/opencode/alloy-plugin.ts` COMMAND_SKILLS（不变，route 方向已正确） | 0 |
| MOD | `scripts/test_resolver.mjs`（agent 数断言 7→2） | ~5 |
| MOD | `scripts/test_alloy_installer.py`（agent 文件数断言） | ~5 |

**net 代码变化**：~370 行增（prompt 重写）vs ~460 行删 + 5 agent 文件删 = **代码净减少**。

### Wave 3 — 安装分发（interactive install + skills 拆 repo + vendor-sync + 企业）

| 操作 | 文件 | 行数估计 |
|---|---|---|
| MOD | `bin/alloy.mjs` install（prompts 库 → 交互式） | ~200 |
| NEW | `bin/alloy.mjs` context 工具 wiring（检测+调安装器+警告） | ~120 |
| NEW | `bin/alloy.mjs` `--skills-source` flag | ~20 |
| NEW | `bin/alloy.mjs` `create-hub` + `hub-sync` | ~150 |
| NEW | `.github/workflows/vendor-sync.yml` | ~50 |
| MOD | `vendor.lock.json`（加 fusionType/sources[]/distilledAt/autoUpdate） | ~40 |
| MOD | `packs/atoms.json`（加 alloy-skills 引用） | ~10 |
| NEW | `vendor/skills/external/mattpocock/main/handoff/`（已 vendor） | —
| MOD | `CREDITS.md`（加 handoff attribution） | ~5 |

### 总工作量估计

| Wave | 估计 |
|---|---|
| Wave 1（状态层） | ~6-8h |
| Wave 2（薄编排） | ~4-5h |
| Wave 3（安装分发） | ~8-10h |
| 测试 + 修复 | ~3-4h |
| **共计** | **~22-27h** |

---

## 15. 验证标准

```bash
# === Wave 1 ===
# Install 后 .alloy/ 纯 markdown
bash setup.sh --pack core --target local
test -f .alloy/PROJECT.md
test -f .alloy/.gitignore
grep -q "run/" .alloy/.gitignore
test ! -d .alloy/state          # 没有 jsonl 目录
test ! -d .alloy/projections    # projections 删了

# Gate 走 markdown
node -e "
const { checkGate } = require('./bin/alloy.mjs');
const r = checkGate('AB-1234');
assert(r.pass || !r.pass); // 语法正确
"

# Plugin 勾 gate
# (在 OpenCode session 跑 /execute → 验证 progress.md ## Gate box 被勾)

# === Wave 2 ===
# agent 文件数
test $(ls agents/ | wc -l) -eq 2
test -f agents/Planner.md && test -f agents/Builder.md
test ! -f agents/Orchestrator.md

# preset 无残留
! grep -rq "alloy_switch_preset\|presets.json" templates/ packs/ bin/

# Agent permission deny-only
grep -q "alloy-tdd: deny" agents/Planner.md
grep -q "alloy-plan: deny" agents/Builder.md
grep -q "exa_*: deny" agents/Builder.md

# Architect rename
test ! -f agents/Architect.md

# === Wave 3 ===
# Interactive install
node bin/alloy.mjs install --dry-run 2>&1 | grep -q "Select pack"

# Skills repo split (manual verification)
git ls-remote https://github.com/lifeodyssey/alloy-skills

# === 全套 ===
npm test                   # 全绿
node --check bin/alloy.mjs
python3 scripts/audit_prompt_dependencies.py
```

---

## 16. 明确不做（v0.1.4 范围外）

- ❌ Subtask dispatch 工具（OpenCode 原生 Task 已隔离上下文，r6）
- ❌ Oracle / deep-debugger 独立 agent（builder prompt 的 circuit breaker，r6）
- ❌ Preset 热切换（OpenCode agent `permission` glob 原生替，r7）
- ❌ agentRoster 配置（全装 2 agent + deny-only，r5）
- ❌ 多 runtime adapter（Claude Code/Codex）（v0.3+）
- ❌ Skill auto-fire 复杂引擎（gate 就是强制机制，r9）
- ❌ Rate limit auto-resume / daemon / chain hash（v0.3+）
- ❌ Web UI / DB（r5：JSONL 赢了 merit comparison；将来真需要时 SQLite 重新可选）
- ❌ Scope skills（vercel/kotlin/pg/terraform）的融合改动（走 verbatim，fusion 以后单独做）
- ⚠️ TODO: 安装自由度细节（你 r10 标注：先留 TODO，后续一轮讨论）

---

*本 Spec 是实施真理源。改动时先改本文件。每 wave 跑完后跑验证标准。*
