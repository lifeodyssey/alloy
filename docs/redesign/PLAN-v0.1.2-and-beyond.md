# Alloy 完整 Plan — v0.1.2 to v0.3+

> 写于 2026-05-26 evening session  
> 收敛今天 grill-me 讨论所有结论  
> Status: **DRAFT, awaiting plannotator review**

---

## 0. Executive Summary

**Alloy 是什么**：一个给"一个人带 AI agent 团队"的人用的 harness——在 OpenCode/Claude Code 里给 agents 装好规则、流程、上下文管理，让 agent 走最强约束、不替用户做选择。

**给谁用**：自用 + 一小撮认同 harness engineering 的 OSS 朋友。**不是商业产品**。"未来面试看你带 agent 团队"是核心 use case。

**今天讨论决定的事**（按落地版本）：

- **v0.1.2 patch**（1-2 天）：MD 文档更新 + skill inline copy 原版 + spec/plan 合并 + 加 mattpocock handoff + OpenCode DCP optional pack
- **v0.2 重构**（1-2 周）：plugin-first 心智落地（砍 CLI 命令）+ state machine + execute context pruning + zhenjia token 优化 6 步
- **v0.3+ 远期**：rate limit auto-resume + audit grade chain hash + daemon mode + Claude Code/Codex adapter + skill learning loop

---

## 1. Vision: alloy 想要成为什么

### 一句话定位

> "**The harness that lets one person run an AI agent team — with zero compromise on control.**"

### 价值主张

- **不是 chat UI**：alloy 不发明聊天界面，用户在 OpenCode/Claude Code 现有 UI 里工作
- **不是 agent**：alloy 不是 LLM agent，是给 agent 套规则的外壳
- **不是 SaaS**：alloy 在你自己电脑上跑，状态在你自己 repo 里
- **不是 framework**：alloy 不强迫你重写代码，它是配置 + 集成

### 关键信念（六信条）

| # | 信条 | 含义 |
|---|---|---|
| 1 | **最强约束** | 关键流程靠 code 强制走对，**不靠 prompt 建议**。LLM 只能在 SDK 允许的工具集里操作 |
| 2 | **Plugin-first, CLI-minimal** | 用户在 chat 里完成 99% 操作，CLI 只用于一次性 install + 偶尔 doctor |
| 3 | **不替用户做选择** | 用户装了 GitHub or GitLab、Linear or Jira，alloy 不替你判，全 visible |
| 4 | **Vendor over rewrite** | Skills 走 inline copy 原版 + append alloy 段路径，**不重写不删除** |
| 5 | **状态外置但极简** | JSONL append-only ledger + state machine guard，**不上数据库** |
| 6 | **零依赖运行时** | `.mjs` + zod + jsdoc，没 build step，install 即可用 |

---

## 2. 当前状态（v0.1.1，已 ship）

### 已有

- ✅ Pack distribution + atoms+extends 架构（v0.1.0 Card 3）
- ✅ 12 OpenCode plugin hooks（v0.1.0 Card 8+9+10）
- ✅ 7 v3 specialist agents（Orchestrator / Explorer / Architect / Builder / Fixer / Reviewer / Tester）
- ✅ 11 alloy-* fusion skills + 2 baseline + scoped + vendored
- ✅ 15 CLI subcommands（install / add / remove / list / search / outdated / upgrade / doctor / completion / state / gate / 等）
- ✅ install.sh one-liner + alloy completion (bash/zsh/fish)
- ✅ 33 tests passing
- ✅ docs/alloy-overview.html (2002 行 product walkthrough)

### 不足（待 v0.1.2/v0.2 解）

- ⚠️ **CLI-centric 心智**：很多 CLI 命令其实该是 plugin tool，让用户在 chat 里调
- ⚠️ **Skills 是 fusion 重写**：违反"照抄原版"原则，上游更新难 sync
- ⚠️ **状态管理无 transition table**：agent 可以乱走 phase
- ⚠️ **OpenCode DCP 没集成**：token 优化大杀器没用上
- ⚠️ **Mattpocock handoff skill 没 vendor**：session handoff 痛点没解
- ⚠️ **spec + plan 分两个 phase**：流程冗余

---

## 3. v0.1.2 Patch — 文档纠偏 + 关键 skill 补齐 + spec/plan 合并

### 目的

把今天讨论的认知里**不需要大重构**的部分先落到 v0.1.1 上。**1-2 天工作量**。

### 完整 task 清单（按依赖顺序）

#### Task 1: README 重定位（30 min）

修改 `README.md`：
- 把"OpenCode pack distributor"重述为"个人 harness"
- 加 vision 章节（"The harness that lets one person run an AI agent team"）
- 加六信条
- 加 use case section（"我用 alloy 干什么"）

#### Task 2: CLAUDE.md 加六信条（30 min）

修改 `CLAUDE.md`：
- 头部加 "## Design Beliefs" section
- 六信条原文写进去
- 加一段 "What Alloy is NOT"（不是 chat UI / agent / SaaS / framework）

#### Task 3: Vendor mattpocock handoff skill（1 hour）

```bash
# 操作
cd vendor/skills/external/  # 新建子目录给 mattpocock
mkdir -p mattpocock/<latest-version>/handoff/
# 下载 mattpocock/skills repo handoff 内容 inline 复制进来
```

更新 `vendor.lock.json`：
```json
{
  "name": "handoff",
  "kind": "skill",
  "source": "https://github.com/mattpocock/skills",
  "upstreamPath": "skills/handoff",
  "version": "<latest>",
  "license": "MIT",
  "sha256": "<computed>",
  "paths": ["vendor/skills/external/mattpocock/<v>/handoff"],
  "vendoredAt": "2026-05-26"
}
```

更新 `packs/atoms.json`：
```json
"mattpocock-handoff": { "skills": ["handoff"] }
```

加进 `packs/core.json` extends 列表。

CREDITS.md 加一段 attribution。

#### Task 4: 加 OpenCode DCP 作 optional pack（30 min）

新建 `packs/dcp.json`:
```json
{
  "id": "dcp",
  "description": "OpenCode Dynamic Context Pruning — 50-70% token saving (会破 prompt cache，权衡使用)",
  "extends": ["mcp-baseline"],
  "plugins": ["@tarquinen/opencode-dcp"]
}
```

`defaults.json` 加 plugin pin。

文档说明：`alloy install --pack core+dcp` opt-in。

#### Task 5: 11 个 alloy-* SKILL.md 改为"inline copy 原版 + append" 模式（4 hours）

**这是 v0.1.2 最大工作量**。

**原则**：每个 alloy-* skill 选一个**单一 base 原版**，inline 复制 base 完整内容**不删不改**，然后 append "## Alloy Integration" section 加 alloy 特定内容。

**操作方式**（per skill）：

```
universal/skills/alloy-tdd/
├── SKILL.md                  ← 主入口
└── upstream/
    ├── superpowers-tdd.md    ← obra/superpowers 原文 inline 完整
    └── mattpocock-tdd.md     ← mattpocock 相关 inline 完整
```

或更激进版（顶层模式）：

```
universal/skills/alloy-tdd/SKILL.md
─────────────────────────────────
[obra/superpowers v5.1.0 test-driven-development/SKILL.md 完整原文 inline]
[mattpocock TDD 相关原文 inline]
─────────────────────────────────
## Alloy Integration (我们追加)
- TDD before code 强制走 alloy_evidence tool
- 95% coverage floor via alloy_gate
- evidence 写入 .alloy/state/evidence.jsonl
─────────────────────────────────
## Attribution
- obra/superpowers (MIT)
- mattpocock/skills (MIT)
- alloy first-party (MIT)
```

**11 个 skill 处理清单**：

| Skill | Inline base | Alloy 追加段 |
|---|---|---|
| `alloy-tdd` | obra/superpowers test-driven-development/SKILL.md + mattpocock/skills tdd | evidence 写入 / 95% coverage / Builder agent 集成 |
| `alloy-brainstorm` | obra/superpowers brainstorming/SKILL.md | 写到 .alloy/specs/<id>/spec.md (## Spec section) |
| `alloy-debug` | obra/superpowers systematic-debugging/SKILL.md（含 references/） | regression test 强制 + alloy_evidence 集成 |
| `alloy-plan` | obra/superpowers subagent-driven-development/SKILL.md（部分） | 写到 spec.md (## Plan section) — **v0.1.2 合进 alloy-brainstorm** |
| `alloy-execute` | obra/superpowers subagent-driven-development/SKILL.md | Builder/Fixer 集成 / wave execution |
| `alloy-verify` | obra/superpowers verification-before-completion/SKILL.md | alloy_claim with evidenceIds / alloy_gate |
| `alloy-discuss` | GSD gray-area extraction (源待确认 license) | 写到 .alloy/specs/<id>/context.md |
| `alloy-using` | (Alloy 原创) | session-start orientation |
| `alloy-autopilot` | axledbetter/claude-autopilot | ralph-loop 5-iter cap 集成 |
| `alloy-map-codebase` | GSD brownfield mapper (源待确认) | Explorer agent 集成 |
| `alloy-qa` | gstack /qa 内容 (MIT, 待 inline) | (无大改) |

**Open question (plannotator review)**：单 source vs 多 source inline 哪个？我倾向**多 source inline**（一个 SKILL.md 文件里 inline 多个 base + alloy 段），这样每个 alloy-* 仍是单 skill 文件，不需要 sub-skill。

#### Task 6: spec + plan phase 合并（2 hours）

**改动**：

1. `commands/plan.md` **删除**（或留个 stub: `# DEPRECATED. Use /spec`）
2. `commands/spec.md` 扩展内容：现在 spec 做完整 spec + plan 工作流
3. `packs/atoms.json` `alloy-sdd-commands` atom 去掉 "plan"：
   ```json
   "alloy-sdd-commands": {
     "commands": ["autopilot", "discuss", "execute", "spec", "verify"]
   }
   ```
4. `alloy-brainstorm` + `alloy-plan` skill **合并**为 `alloy-brainstorm`（plan skill 内容追加进 brainstorm）
   - 或者保留两个 skill 都被 /spec 命令 invoke
5. 7 agent `.md` 文件里引用 plan command/skill 的地方更新
6. `docs/alloy-overview.html` 更新 SDD pipeline 图

**新 phase pipeline**：
```
pending → spec (含 brainstorm + plan + planning-with-files + plannotator-review)
       ↓ (user approve via plannotator UI)
       execute
       ↓
       verify
       ↓
       done
```

#### Task 7: 7 个 agent .md 加 phase pipeline 说明（1 hour）

修改 `agents/Orchestrator.md` + 6 specialist：
- 加 "## Phase Pipeline" section
- 说明每个 phase 走哪个 skill / 强制 invoke 哪些 tool
- 不变动现有 routing matrix

#### Task 8: 写 docs/redesign/PLAN-v0.1.2-and-beyond.md（30 min）

就是这份文档的正式版本。

#### Task 9: 加 CHANGELOG 条目 + bump version 到 0.1.2（15 min）

- `package.json`: `"version": "0.1.2"`
- `defaults.json`: `version: "0.1.2"` (if has)
- `CHANGELOG.md`: 完整列出 9 个 task 改动

#### Task 10: 跑全套测试 + ship（30 min）

- `npm test` 全过
- `bash setup.sh --doctor --pack core` 全过
- `python3 scripts/audit_prompt_dependencies.py` 干净
- commit + push + tag v0.1.2

### v0.1.2 总工作量

| Task | 时间 |
|---|---|
| 1 README | 30 min |
| 2 CLAUDE.md | 30 min |
| 3 mattpocock handoff vendor | 1h |
| 4 OpenCode DCP pack | 30 min |
| 5 11 skill inline copy | 4h |
| 6 spec+plan 合并 | 2h |
| 7 agent .md phase pipeline | 1h |
| 8 PLAN.md 落盘 | 30 min |
| 9 CHANGELOG + version | 15 min |
| 10 test + ship | 30 min |
| **总计** | **~10-11 hours** |

**1 个晚上 + 1 个上午**能做完。

---

## 4. v0.2 — Plugin-first 大重构（1-2 周）

### 目的

把 alloy 从 CLI-centric 改为 plugin-centric。落地"最强约束"。集成 zhenjia token 优化 6 步。

### 五个大块

#### Block 1: Plugin-first 重构

**砍命令**（用户日常 chat 里完成）：
- ❌ `alloy add` / `remove` / `list` / `search` / `outdated` / `upgrade`
- ❌ `alloy init` / `resolve` / `state` / `gate`

**改成 plugin tools**（agent 在 chat 里调）：
- `alloy_add` / `alloy_remove` / `alloy_list` / `alloy_search` / `alloy_outdated` / `alloy_upgrade`
- `alloy_state_add_task` / `alloy_state_add_evidence` / `alloy_state_add_claim`
- `alloy_gate_check`
- `alloy_phase_advance(from, to)`

**保留 CLI**：
- ✅ `alloy install` — 一次性 setup
- ✅ `alloy doctor` — 偶尔诊断
- ✅ `alloy completion` — shell completion 生成

**新增 plugin hook 自动行为**：
- `config` hook 启动时 detect userOverlay（用户加的 skill/MCP），写 manifest.userOverlay
- 检测到 → `chat.message` hook 注入提示 "Detected my-custom-skill. Use it?"
- 用户回答 → agent 调 `alloy_adopt_overlay` 或 `alloy_exclude_overlay` tool

#### Block 2: State machine guard + Append-only ledger

**新文件**：
- `bin/state-machine.mjs` (~80 LOC)：`TASK_TRANSITIONS` table + `transition_task(id, to)` guard
- `bin/ledger.mjs` (~100 LOC)：`appendEvent(type, payload)` + `proper-lockfile` 文件锁

**规则**：
- 所有 state mutation 必须走 ledger.mjs（agent / plugin / hook 都不能直接写 jsonl）
- 非法 transition → `IllegalTransitionError`
- Append-only，**no chain hash yet**（v0.3 加）

**Phase transition table**：
```js
const TASK_TRANSITIONS = {
  pending:   ['spec'],
  spec:      ['execute', 'abandoned'],     // 注: spec 已含 plan
  execute:   ['verify', 'blocked'],
  verify:    ['done', 'execute'],
  blocked:   ['execute', 'abandoned'],
  done:      [],
  abandoned: [],
}
```

#### Block 3: Execute phase context pruning

**机制**：`alloy_phase_advance(spec → execute)` 时：

1. 读 `.alloy/specs/<id>/spec.md` frontmatter
2. 提取 `required_skills` / `required_mcps` / `required_agents`
3. **临时 manifest override**：
   - 把 `manifest.visible.skills` 改成 `required_skills`
   - `opencode.json` 里只暴露 `required_mcps`
   - sub-agent 派出去时只携带 visible skills
4. Phase 结束（verify → done）后恢复原 manifest

**为什么**：每次 execute 只装载真正需要的 skill/MCP，system prompt 变小，cache hit 率提升。

#### Block 4: Zhenjia token 优化 6 步集成

**Step 0 观测**：加 `alloy usage` 命令（聚合 runs.jsonl 的 token 数据）。**不集成 ccusage**，文档推荐用户自己装。

**Step 1 缓存纪律**（最高 ROI）：
- 固定 system prompt 前缀顺序：CLAUDE.md → agents/<role>.md → skills/<skill>.md（字母序）
- 写入 opencode.json 固化
- 新增 `alloy doctor --cache` 检查前缀稳定性 + MCP schema 变更

**Step 2 减少无效探索**：
- CLAUDE.md template 加注释 `<!-- KEEP UNDER 200 LINES -->`
- 推荐 LSP（universal/skills/using-lsp/ vendor cclsp）
- codegraph 作 optional pack

**Step 3 预防上下文膨胀**：
- alloy plugin `tool.execute.after` hook 自动截断超长 tool output（>10KB → `[truncated, see .alloy/state/tool-output-<id>.txt]`）
- 用 OpenCode DCP（v0.1.2 已加 optional pack）

**Step 4 隔离 + 模型分级**（alloy 已有底子）：
- `models/github-copilot.json` 写死推荐分级：
  ```json
  {
    "explorer": "claude-haiku-4-5",
    "planner": "claude-sonnet-4-6",
    "architect": "claude-opus-4-7",
    "executor": "claude-sonnet-4-6",
    "reviewer": "claude-sonnet-4-6",
    "verifier": "claude-haiku-4-5"
  }
  ```
- 注意：顺序任务**不要强拆 multi-agent**（arXiv 2512.08296：退化 39-70%）

**Step 5 Write**：
- spec.md 模式已有
- 新增 `/clear-and-execute` 命令（写完 spec 后 clear session 重新开 execute）

**Step 6 输出控制**：
- skill body 加约束："Output stays minimal. No emoji. No restating user input."
- 新增 `alloy_set_effort(low|medium|high)` tool

#### Block 5: 强制约束三层防御落地

**Layer 1: Capability isolation**
- 每个 phase 给 agent 不同 tool 集合
- spec phase: 没 write-code / run-tests / git-commit tool
- execute phase: 没 edit-spec / edit-plan / git-commit-to-main tool
- verify phase: 没 write-code / edit-anything tool（只能 read + run + claim）

**Layer 2: Tool gating**
- phase advance 必须调 `alloy_phase_advance` tool（agent 不能 free-form 写 jsonl）
- 重派 interrupted sub-agent 必须调 `alloy_resume_subagents` tool

**Layer 3: Hook block**
- `Stop` hook 检测 invariants:
  - spec phase 没写完 ## Spec section → block
  - execute phase 没 evidence 就想结束 → block
  - verify phase 有未处理 interrupted sub-agents → block

### v0.2 总工作量

约 **30-50 小时** 工程，**1-2 周** ship。

---

## 5. v0.3+ 远期路线

| 主题 | 内容 | 触发条件 |
|---|---|---|
| **Rate limit auto-resume** | 推荐用 `claude-auto-retry` (tmux send-keys) + alloy plugin SubagentStop hook contain sub-agent rate limit | v0.2 ship 后 |
| **Audit grade** | chain hash (SHA256) + repair tool + force-transition + `alloy state graph` (mermaid) | 第一次发现 ledger 损坏或需审计 |
| **Compaction + archive** | jsonl 50MB+ 或 6 个月使用后 archive | 用满 6 个月 |
| **Schema migration** | `alloy state migrate --from N --to N+1` | 第一次需要 breaking change |
| **Daemon mode** | 借 reins daemon pattern + tracker (GH Issues) 集成 | v0.4+ |
| **Claude Code adapter** | Layer 1 第二 runtime | v0.5 |
| **Codex adapter** | Layer 1 第三 runtime | v0.6 |
| **Skill ledger learning loop** | bandit router 选历史成功率最高 skill | v0.5+ |

---

## 6. 配置怎么处理（关键设计 — 不替用户做选择）

### 项目级配置：`.alloy/alloy.project.json`

**v0.2 简化后只保留最小信息**：
```json
{
  "pack": "core",                  // 或 frontend / backend / infra / all
  "models": "github-copilot"       // 或 anthropic / mixed / 用户自定义
}
```

**不再有**：
- ❌ `agentOverrides` (per-agent skill 列表)
- ❌ `integrations` (vcs / issues / ci 预设)

### 用户加的 skill/MCP 处理

**Discovery**：plugin `config` hook 启动自动 detect
**Adoption**：通过 chat 跟 agent 说"adopt my-custom-skill"，plugin 写 manifest.userOverlay
**Visibility**：userOverlay 默认全 visible（不替用户挑）
**Exclusion**：只在用户明确说"去掉 X"才进 manifest.excluded

### Atoms.json 砍掉的预设

**砍**：vcs-github / vcs-gitlab / vcs-azure / issues-linear / issues-jira / issues-github / ci-* atoms

**留**：基础 alloy atoms（baseline-5 / workflow-extras / v3-agents / v3-modelRoles / SDD-commands / legacy-commands / mcp-baseline / ralph-loop / mattpocock-handoff / frontend-skills / backend-skills / infra-skills）

---

## 7. 跟今天讨论的所有点对照表

| 讨论点 | 落到哪个版本 |
|---|---|
| 自用 + OSS 定位 | v0.1.2 README |
| Plugin-first 心智 | v0.1.2 CLAUDE.md / v0.2 实际改 |
| 最强约束三层防御 | v0.2 |
| Skill inline copy 原版 + append | v0.1.2 Task 5 |
| Mattpocock handoff vendor | v0.1.2 Task 3 |
| OpenCode DCP optional pack | v0.1.2 Task 4 |
| Spec + plan 合并 | v0.1.2 Task 6 |
| Execute context pruning | v0.2 Block 3 |
| State machine + JSONL ledger | v0.2 Block 2 |
| Zhenjia token 优化 6 步 | v0.2 Block 4 |
| 不替用户做选择 | v0.2 Block 1 |
| 保留 frontend/backend/infra/all pack | v0.1.2+ 永久 |
| 砍 vcs/issues atoms | v0.2 |
| Rate limit auto-resume | v0.3 |
| Sub-agent contain | v0.3 |
| Audit chain hash | v0.3 |
| Daemon + tracker | v0.4+ |
| Claude Code adapter | v0.5 |
| Codex adapter | v0.6 |
| Skill learning loop | v0.5+ |
| 不要数据库 | 永远 |
| 用 .mjs (不上 ts) | 永远 |

---

## 8. 立即执行（v0.1.2 第一步）

按 ROI 顺序：

1. **Task 8 写这份 PLAN 到 docs/redesign/**（已完成）→ commit push
2. **Task 1 README 重定位**（30 min）
3. **Task 2 CLAUDE.md 加六信条**（30 min）
4. **Task 6 spec+plan 合并**（2h，user 优先要这个）
5. **Task 3 mattpocock handoff vendor**（1h）
6. **Task 4 OpenCode DCP pack**（30 min）
7. **Task 7 agent .md phase pipeline**（1h）
8. **Task 5 11 skill inline copy 改造**（4h，最大块，最后做）
9. **Task 9-10 version bump + test + ship**

---

## 9. Open Questions — 需要 plannotator review 时拍

1. **Skill inline copy 模式**：单 base 还是多 base inline 到同一 SKILL.md？我倾向多 base inline（11 alloy-* skill 文件数不变），但 base 选择需要 case by case 拍：
   - `alloy-tdd`: obra/superpowers 为主 base？mattpocock 作为 append 段？
   - `alloy-discuss`: GSD 内容 license 待确认
   - `alloy-map-codebase`: GSD 内容 license 待确认
   - `alloy-qa`: gstack 内容 inline 完整吗？

2. **`alloy-plan` skill 命运**：
   - 选项 A: 合并进 `alloy-brainstorm`（删掉 alloy-plan 目录）
   - 选项 B: 保留 alloy-plan skill，但 /spec 命令同时 invoke alloy-brainstorm + alloy-plan
   - 倾向 A（更简单）

3. **OpenCode DCP 默认装吗**：
   - 选项 A: 不默认装（破 cache，trade-off 大）
   - 选项 B: default 装但 conservatives 设置（少 prune）
   - 倾向 A

4. **userOverlay detect 自动 adopt 还是问用户**：
   - 选项 A: detect 后 chat.message 问用户 yes/no
   - 选项 B: 自动 adopt 进 visible
   - 倾向 A（不替用户做选择，但要主动告知）

5. **七个 specialist agent .md 改多深**：
   - 选项 A: 只加 phase pipeline 说明 section
   - 选项 B: 重写 routing matrix
   - 倾向 A（v0.1.2 patch 不大动）

6. **v0.1.2 vs v0.2 cutoff**：是不是有些 v0.2 内容（比如 state machine）可以提前到 v0.1.x 系列？还是严格守住"v0.1.x patch only"原则？

---

## 10. 验收标准（v0.1.2 ship-ready 标志）

- ✅ npm test 33 + 新增 tests 全过
- ✅ `bash setup.sh --pack core --target local --models github-copilot` 在 temp dir 成功
- ✅ `python3 scripts/audit_prompt_dependencies.py` exits 0
- ✅ 11 alloy-* SKILL.md 包含 inline 原版完整内容（grep 验证）
- ✅ packs/atoms.json 含 mattpocock-handoff atom
- ✅ packs/dcp.json 存在
- ✅ commands/plan.md 已删除（或标 DEPRECATED）
- ✅ Git tag v0.1.2 push 到 origin
- ✅ CHANGELOG.md 含完整变更
- ✅ docs/alloy-overview.html SDD pipeline 图更新

---

End of plan.
