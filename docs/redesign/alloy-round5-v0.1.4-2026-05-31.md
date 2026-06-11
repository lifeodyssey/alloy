# alloy round 5 — 回答你 round 4 的 13 条标注

> 这轮我又派了 4 个 agent 去查 4 件真东西，不脑补：
> 1. mattpocock 的 handoff skill 原版到底推荐写哪
> 2. OpenCode 左下角那个 agent 显示，到底是怎么切的
> 3. JSONL / SQLite / 纯 Markdown / Postgres 这四种存状态，在 alloy 这个体量下到底哪个好
> 4. 你给的 zhenjia 那篇文章里，DCP 和 handoff 到底怎么配合
>
> 下面 13 条标注，我按"你在问什么"分了组，每条尽量给到：查到的事实 → 我的判断 → 还能怎么选。
> 另外标注 10 你说我"你认吗"那套不像人话——这轮我把那种 checklist 删了，改成正常说话。

---

## 第一组：你问"这是干嘛的" —— 3 个概念我没讲清楚

### 1️⃣ Oracle 是干嘛的（标注 1）

Oracle 这个名字是从 OMO Slim 抄来的。OMO 的 7 个 agent 里有一个 `@oracle`，它的委派规则原文是：

> `@oracle: Delegate when: "problems persisting 2+ times", Don't delegate when: "first fix attempt"`

翻译过来就是：**它是个"卡住了才升级"的深度推理 agent**。普通 bug 让 Fixer 修；但同一个问题修了两次还没好，说明不是 Fixer 能力的问题，是这个问题本身需要更强的模型坐下来从根因重新想——这时候才升级到 Oracle（配 Opus 这种高推理模型）。

**我的判断：alloy 不需要单独加 Oracle，这是过度设计。**

理由：
- alloy 已经有 7 个 agent 了，再加 Oracle 是第 8 个，违背"轻量"。
- "卡住两次升级"这个行为，不需要一个新 agent，用**模型升级**就能做到——Fixer 修两次失败，Orchestrator 的规则可以写"第三次把 Fixer 的模型从 sonnet 临时提到 opus"，或者直接 invoke `alloy-debug`（systematic-debugging skill）走根因排查流程。
- 我 round 4 写"加 Oracle 备用"是顺手抄 OMO，没想清楚 alloy 是不是真需要。**这条我收回**。

如果你觉得"卡两次升级"这个模式有价值，我倾向把它写成 **Fixer 的一条 escalation 规则**（修两次失败 → 强制 invoke debug skill + 提模型），而不是新开一个 agent。

---

### 2️⃣ alloy_dispatch_subtask 加了是干嘛的（标注 5）

这个也是从 OMO Slim 抄的。OMO 的 Orchestrator 派活时是这么调的：

```typescript
subtask({
  agent: 'fixer',
  prompt: 'Fix the auth token bug in src/auth.ts',
  files: ['src/auth.ts:42-67'],   // ← 只传相关那几行，不传整个对话
})
```

**它解决的核心问题是"成本隔离"。** 重点在最后那个 `files` 参数：

Orchestrator 聊到一半上下文可能已经几万 token 了（读了一堆文件、讨论了一堆方案）。如果直接让 Fixer "接着干"，Fixer 会**继承 Orchestrator 的整个上下文**——但 Fixer 修个 auth bug 根本不需要知道前面那些。`subtask` 的作用就是：给 Fixer 开一个**干净的小上下文**，只塞 `src/auth.ts:42-67` 这几行，Fixer 修完返回结果。这就是 zhenjia 文章 Step 4 "Isolate" 说的——把重活路由到便宜模型 + 干净上下文，探索成本能降 15 倍。

**但这里有个我必须诚实说的疑点：OpenCode 原生可能已经有这个能力了。**

OpenCode 本身就有 agent 系统，`@Fixer` 这种 mention 或者 Task 工具派子任务时，**到底传不传完整上下文**，我现在不能 100% 确定。如果 OpenCode 原生 `@agent` 委派已经是隔离上下文的，那 `alloy_dispatch_subtask` 就是重复造轮子，不该加。

所以这条的真问题不是"要不要加这个 tool"，而是**"OpenCode 原生委派传不传完整上下文"**——这个我需要再派一个 agent 实测，或者你直接告诉我（你天天用 OpenCode，比我清楚：你 `@别的 agent` 的时候，那个 agent 是从零开始，还是带着你前面的对话？）。

---

### 3️⃣ agentRoster 到底解决什么问题（标注 11）

你说"有点没看懂你要解决什么问题"——**说明这条大概率是我自己造的伪需求，我先把"我以为的问题"摊开，你看是不是真问题。**

我以为的问题是：solo 开发者一个人干活，用不上 Tester（QA 那套是团队/PR review 场景才有意义的）。装了 7 个 agent，但 Tester 永远不被调用，白白占系统提示词的 token + 每次 Orchestrator "Delegation Check" 时多扫一个无用选项。所以我想让用户 install 时选"我要哪几个 agent"——这就是 agentRoster。

**但你看不懂，我重新想，发现这确实是过度设计：**

- agent 就是几段提示词，装 7 个还是 6 个，token 差异极小。
- "solo 不用 Tester"这个逻辑，**用 Orchestrator 的委派规则就能表达**——规则里写一句"Tester: 只在 team-mode / PR review 时派，solo 时 Reviewer 自测"，LLM 自己就不会瞎派 Tester。不需要用户配任何东西。

所以两个方案摆这：

| 方案 | 怎么做 | 代价 |
|---|---|---|
| **A. agentRoster 配置**（我 round 4 提的） | 用户 install 时选 6 还是 7 个 agent | 多一个配置项，多一个要解释的概念 |
| **B. 永远装 7 个 + 委派规则管**（我现在倾向） | 全装，规则里写"solo 别派 Tester" | 零配置，用户啥都不用想 |

**我倾向 B**。它更符合"不替用户做选择"——因为根本没选择可做，规则自动处理。agentRoster 这个概念可以砍掉。

（如果未来真发现 agent 多到拖慢 routing，再加 roster 也不迟——那是 v0.2+ 的优化，不是现在的问题。）

---

## 第二组：你问"上游原本是不是这样" —— 2 个事实核对

### 4️⃣ OMO Slim 真的是 prompt-driven routing 吗（标注 2）

**是。这个我 round 4 派 agent 读过 `src/agents/orchestrator.ts` 源码，确认了。**

OMO 的 orchestrator 提示词里没有任何 `if (taskSize > X)` 这种算法判断。它就是一段提示词，里面有张"Delegate when / Don't delegate when"的表，然后写：

```markdown
## 3. Delegation Check
**STOP. Review specialists before acting.**
!!! Review available agents and delegation rules. Decide whether to delegate
or do it yourself. !!!
```

**LLM 自己读这张表、自己决定派谁。** 没有代码层面的路由逻辑。

这对 alloy 的意义：我们的 Orchestrator 也走这个模式——`agents/Orchestrator.md` 里放一张 alloy 7 个 agent 的委派规则表，LLM 看表自己判断。不写路由算法。你标注 3 说"这个可以照抄"，就是照抄这张表的形式。✓

---

### 5️⃣ mattpocock handoff 原本推荐写哪（标注 7）

**查清楚了，而且我 round 4 写错了，得认。**

mattpocock 原版 handoff skill 的原文是：

> "Save to the temporary directory of the user's OS - **not the current workspace**."

也就是说**原版明确推荐写到操作系统临时目录，不写进项目里**。触发是用户显式 `/handoff`，格式 Markdown，内容包括对话总结、建议下个 session 用哪些 skill、对现有 artifact（PRD/plan/commit）的引用而非复制、敏感信息脱敏。

**我 round 4 写的是"输出到 `.alloy/handoffs/<session>.md`（项目里，git 追踪）"——这跟原版相反了。**

为什么会有这个分歧，值得说清楚，因为它牵涉一个真实的取舍：

| 写哪 | 好处 | 坏处 |
|---|---|---|
| **OS 临时目录**（原版） | 干净，不污染项目；handoff 本来就是一次性草稿，用完即弃 | 重启/清临时目录就没了；没有"这个项目交接过几次"的历史 |
| **项目里 `.alloy/handoffs/`**（我 round 4） | git 留痕，能回看交接历史，团队能共享 | 污染 repo；handoff 本质是临时的，留着是噪音 |

**我现在倾向：默认跟原版一样写 OS 临时目录，但给一个 `--persist` 选项让需要留痕的人写进 `.alloy/handoffs/`。** 大多数时候 handoff 就是"换个 session 接着干"的草稿，不需要进 git；但如果是正式的跨人交接（比如你下班了同事接），`--persist` 留个档。

这样既尊重原版设计，又给团队场景留了口子。你觉得呢？

---

## 第三组：你提的关键修正 —— 3 个需要重新想

### 6️⃣ ★最重要：信条不是硬约束，DB 我重新比了（标注 6）

你原话：

> "不一定哦，我们需要讨论各个方案的优点和缺点。最终大家决定的是方案本身，而不是说了信条就一定是遵从那个信条，懂吗？"

**这条我完全接受，而且这是这轮最重要的方法论修正。** 我之前一句"信条 #5 不上数据库，所以 Chorus 的 DB 方案不抄"——这是拿教条挡讨论，是偷懒。所以我专门派了个 agent，把四种存状态的方案**按 alloy 的真实场景**摆开比，不预设结论。

alloy 要存的东西：任务生命周期（plan/execute/verify）、evidence 事件（工具调用、commit、测试结果）、session 交接、迭代历史。真实约束：solo 开发者为主、单项目几十到几百个任务、evidence 几百条、要在 git repo 里跑、LLM agent 要能读、Node CLI 零依赖（.mjs + zod）、无 build step、无 server。

下面是 agent 给的完整对比（我没删它任何一栏，你自己看）：

| 维度 | 纯 Markdown | JSONL append-only | SQLite | Postgres/Prisma |
|---|---|---|---|---|
| **简单度** | 高（读文件+模板） | 高（append + JSON.parse） | 中（要 better-sqlite3 原生模块） | 低（要起 server、连接配置、migration） |
| **LLM 可读性** | **最好**（agent 直接读，零解析） | 好（一行一 JSON，量大时噪音，需 projection 层） | **差**（二进制，agent 读不了，要 CLI 查询层） | **差**（要跑 query，agent 读不了文件） |
| **git 友好** | **极好**（行级 diff，好 merge） | **很好**（append-only，diff 永远是尾部加行，冲突罕见且好解） | **差**（二进制 blob，git diff 没用，WAL/journal 还污染 gitignore） | N/A（DB 在 repo 外） |
| **查询能力** | 弱（只能 grep/regex，跨文件 join 要自己写 parser，量大就崩） | 中（全量扫描，几百条够用，几万条变慢） | **强**（SQL 索引/join/聚合，百万行没问题） | **最强**（完整关系能力+并发） |
| **可移植** | **完美**（任何编辑器任何系统） | 近完美（任何懂 JSON 的语言） | 中（二进制要 SQLite 库才能开） | **差**（要目标机器跑 Postgres） |
| **依赖成本** | **零** | **零**（Node fs+JSON 内置） | 一个原生 addon（~2MB，破"零依赖"，每平台要 rebuild） | 重（pg 驱动+Prisma+Postgres server） |

agent 的结论原文：

> **核心取舍轴**：LLM 可读性和 git 友好把你推向文本文件；查询能力把你推向数据库。问题是数据量落在哪。
>
> 对 alloy 这个场景——solo 开发者、单项目几十到几百任务、evidence 几百条——JSONL 全量扫描足够快（典型量级亚毫秒）。能逼出 SQLite 的那个查询天花板，基本碰不到。
>
> **推荐：JSONL append-only（现状）+ Markdown projection。**

**所以结论是：JSONL + Markdown 赢，但赢的理由不是"信条说不上 DB"，而是按 alloy 的真实约束逐项比，它确实最优：**

- **SQLite 被淘汰**：不是因为信条，是因为二进制文件在 git 里 diff 没用（每次改动整个文件替换）、破零依赖、每平台要 rebuild 原生模块。
- **Postgres 被淘汰**：不是因为信条，是因为要起 server、不可移植、太重——一个 solo 开发者为了在自己 repo 里记几百条任务状态，去跑个 Postgres，不成比例。
- **纯 Markdown 诱人但不够**：LLM 读着最爽，但你想查"任务 X 的所有 evidence"就得自己写 parser，等于重新实现一遍结构化数据本来免费给你的东西。
- **JSONL + Markdown projection 是两全**：JSONL 是机器可读的真理源（append-only，git diff 干净）；projection 层（现有的 `updateProjections` 生成 `status.md`/`current-plan.md`）把它渲染成人/LLM 能读的视图。机器要结构、人要可读，各拿各的。

**信条 #5 应该被理解成"这个推理过程的一句话总结"，而不是推理的理由本身。** 你的方法论是对的：先比方案，比完发现 JSONL 赢，于是"不上 DB"成立——而不是反过来拿"不上 DB"挡掉比较。

**什么时候这个结论会翻？** 我也诚实标出来——如果 alloy 哪天要做这三件事之一，DB 就重新上桌：
1. 要做 **web UI**（多人实时看板，需要并发读写 + SSE 推送，像 Chorus 那样）
2. 要 **跨机器同步**状态（一个人多台机器，或团队共享一个中心状态）
3. 单项目任务量级到 **几万+**（JSONL 全量扫描开始拖慢）

这三个现在都不是 alloy 的需求。但如果未来是了，到时候上 SQLite（轻量场景）或 Postgres（web/多人场景）是对的，不该被信条挡。**信条服务于方案，不是方案服从信条。**

---

### 7️⃣ 照抄 GSD 太重了 —— 这是减肥版 + 怎么 init（标注 9）

你的担心完全对。我 round 4 给的 per-task 文件清单是直接抄 GSD 的：

```
.alloy/tasks/<task-id>/
  PLAN.md
  CONTEXT.md
  PROGRESS.md
  FINDINGS.md
  VERIFICATION.md
  ITERATIONS.md
+ .alloy/sessions/<session-uuid>/events.jsonl
+ .alloy/handoffs/<session-uuid>.md
```

**一个任务 6 个 markdown 文件，这确实太重了。** GSD 之所以这么多文件，是因为 GSD 是个重型的、30+ 个 slash command 驱动的、phase-gated 系统——它每个 phase 都要正式产出物。alloy 不是那个定位，alloy 要轻。

**减肥版：一个任务 2 个文件 + 全局 1 个 jsonl。**

```
.alloy/
  PROJECT.md                      ← 项目级，一个文件，愿景+当前进度（类 GSD ROADMAP 但合并）
  events.jsonl                    ← 全局一个，plugin 自动 append，机器读
  tasks/<task-id>/
    plan.md                       ← 计划 + 验收标准 + context 全写一个文件里
    progress.md                   ← 干活时 agent 往里 append（findings/verification/iterations 都是这里面的小节，不单独开文件）
  handoffs/                       ← 仅 /handoff 时按需生成（默认还是 OS 临时目录，见标注 7）
```

对比：

| | GSD 模式（我 round 4） | 减肥版（现在） |
|---|---|---|
| 每任务文件数 | 6 个 md | **2 个 md** |
| 全局 | 多个 PROJECT/STATE/ROADMAP + per-session events 目录 | **1 个 PROJECT.md + 1 个 events.jsonl** |
| FINDINGS/VERIFICATION/ITERATIONS | 各自独立文件 | **折进 progress.md 的小节** |
| session 目录 | `.alloy/sessions/<uuid>/events.jsonl`（每 session 一个） | **全局单个 events.jsonl**（用 sessionId 字段区分） |

**怎么 init（你问的第二半）：**

1. **`alloy install` 时**：只 seed 一个空骨架——建 `.alloy/` 目录 + 空的 `events.jsonl` + 一个 `PROJECT.md` 模板（让用户填项目愿景，或者首次 `/plan` 时 agent 帮填）。**不预建任何 task 目录。**

2. **per-task 目录懒创建**：用户在 chat 里说"我开始做 #AB-1234"，plugin 的 `session.start` 或绑卡那一刻，才创建 `.alloy/tasks/AB-1234/plan.md` 的空 stub。**没绑卡就没目录，repo 不会一堆空文件夹。**

3. **progress.md 也是懒创建**：第一次 execute 阶段往里写东西时才建。

这样 install 完 `.alloy/` 就 3 样东西（目录 + events.jsonl + PROJECT.md），干活过程中按需长出 task 目录。**比 GSD 轻一个数量级。**

XML 那个 `<task>` block 我也重新想了——GSD 用 XML 是因为"结构消除歧义让 Claude 直接 parse"。但对 alloy 的减肥版，plan.md 里用 markdown 的验收标准 checklist（`- [ ] AC-1: ...`）就够了，**不一定要上 XML**。XML 是 GSD 重型流程的产物，alloy 可以不抄。这点你 round 4 也问了"还是不用 XML 全 markdown"——我现在倾向**全 markdown，不上 XML**，更轻更好读。

---

### 8️⃣ OpenCode 左下角 agent 显示 ≠ alloy preset 切换（标注 4）

你观察到的现象很准：

> "当 Orchestrator 切换了那个 agent 之后，它左下面（Open code 左下角）会显示你当时在用的那个 agent，那个东西也会随之切换。那个东西就是通过这个方式来切换的嘛？"

**我派 agent 读了 alloy-plugin.ts，答案是：不是同一个机制，这里有两套独立的东西，之前被我混在一起了。**

**机制 A — OpenCode 原生的 agent 指示器（左下角那个）：**
这是 OpenCode 自己的功能。你用 `@Builder` 或切换 primary agent 时，OpenCode 把左下角显示改成 "Builder"。**这是 OpenCode runtime 原生行为，alloy 没碰它，也碰不到。** alloy 的 plugin 里没有任何 hook 在 agent 之间委派时去改这个显示。

**机制 B — alloy 的 preset 切换（`alloy_switch_preset`）：**
这是 alloy 自己加的。`alloy_switch_preset("execute-mode")` 改的是**哪些 skill/MCP 对当前 agent 可见**（通过 `experimental.chat.messages.transform` hook 过滤），它**不动左下角的 agent 显示**。而且它是**手动触发**的（slash command 或 tool 调用），不是委派时自动切。

所以两套东西的对照：

| | 左下角 agent 显示（机制 A） | alloy preset（机制 B） |
|---|---|---|
| 谁控制 | OpenCode 原生 | alloy plugin |
| 切什么 | 显示的 agent 名 | 可见的 skill/MCP 集合 |
| 怎么触发 | `@agent` mention / 切 primary agent | `alloy_switch_preset` tool / slash command |
| 委派时自动切吗 | OpenCode 自己的逻辑（你看到它切，说明 OpenCode 委派时会改显示） | **不会**，preset 是手动的 |

**这个区分对设计很关键，因为它逼出一个真问题：alloy 到底要不要 preset？**

你的观察其实暗示了一个更简单的可能：**如果 OpenCode 原生的 agent 切换（机制 A）已经能驱动左下角显示，那 alloy 可能根本不需要 preset 这套（机制 B）。** 我们可以让 phase 切换直接走 OpenCode 原生 agent 切换——plan 阶段 = Planner agent active（左下角显示 Planner），execute = Builder active，verify = Reviewer active。skill 可见性跟着 agent 走（每个 agent 的 frontmatter 里声明它能用哪些 skill），就不用 alloy 单独维护 preset 了。

也就是说，**preset 可能是我多发明的一层**。OpenCode 原生的"agent 切换 + agent 绑定 skill"也许已经够了。这个我倾向砍掉 preset，直接用 OpenCode 原生 agent 机制——但需要确认 OpenCode 的 agent frontmatter 能不能声明"我这个 agent 只能看见这几个 skill"。这又是一个需要实测 OpenCode 能力的点。

---

## 第四组：★核心综合 —— DCP / handoff / subtask 怎么配（标注 8）

你的问题：

> "我们如果用了类似 dcp 的方案，可以参考这个文章（zhenjia.dev）要怎么进行协调"

我把那篇 2 万字的文章让 agent 读完了，**它正好给了一个统一框架，能把我们之前散着讨论的 DCP、handoff、subtask、CodeGraph 全串起来。这是这轮我觉得最有价值的部分。**

### 框架：token 优化的 4 个正交方向（来自 LangChain，zhenjia 整理）

| 方向 | 干什么 | 具体工具 |
|---|---|---|
| **Select**（选） | 把对的代码弄进上下文 | CodeGraph/AST 索引、Grep、LSP、CLAUDE.md 业务地图、MCP/Skill 延迟加载 |
| **Compress**（压） | 压缩已有上下文（session 内） | **DCP**、lean-ctx、RTK、Context Mode |
| **Isolate**（隔） | 拆任务、换便宜模型 | **subtask**、子 agent 跑 Haiku、worktree 并行 |
| **Write**（外置） | 写到文件系统 | **handoff**、planning-with-files、SPEC.md |

**关键洞察：这 4 个方向是正交的——你不是"选一个"，而是 4 层一起上。而 alloy 在每一层的角色不一样：**

| 方向 | alloy 的角色 | 为什么 |
|---|---|---|
| **Select** | **推荐/集成现成工具，不自己造** | CodeGraph + RTK + lean-ctx 都已经是成熟工具，alloy 在 CLAUDE.md 里推荐用户装（你机器上已经装了） |
| **Compress** | **引用 DCP，不 vendor** | 见下面的 license 问题 |
| **Isolate** | **alloy 自己建**（这是核心） | `alloy_dispatch_subtask` + 给 Explorer 配 Haiku，这是 alloy 编排层的本职 |
| **Write** | **alloy 自己建**（这是核心） | handoff skill + `.alloy/` 状态文件，这是 alloy 状态管理的本职 |

也就是说，**alloy 是把这 4 个方向编排到一起的那一层，但不重新实现 Select 和 Compress——那两层有现成的，alloy 接进来就行。alloy 自己干的是 Isolate 和 Write。**

### DCP 和 handoff 到底怎么协调（你问的核心）

先说清楚它俩是**不同层、不冲突**的：

- **DCP = session 内的 Compress。** 它在 API payload 层面工作：你在一个 session 里读了同一个文件 3 次，DCP 自动只留最后一次（前两次换成占位符，零 LLM 成本）；一段调查（比如修 bug 的 20 轮排查）结束了，agent 调 DCP 的 `compress` tool 把那段换成技术总结。**原始 session 文件不动，只压 API 发出去的那份，cache 命中率靠 shadow-copy 保持 ~85%。**
- **handoff = 跨 session 的 Write。** 它在 session 边界工作：当前 session 要结束了（或上下文到 70%），把对话压缩成 5-10%，写到文件，然后 `/clear`，新 session 读那个文件从头开始。

**所以协调关系是：DCP 让单个 session 撑得更久（压缩），handoff 在 session 真的要换的时候桥接（外置）。** 你先用 DCP 把一个 session 的水分挤干，挤到不能再挤了（比如 phase 做完了，或者 context 到 60%），再用 handoff 跳到下一个干净 session。两者一前一后，不打架。

文章里有句话点透了 handoff 的本质：

> "好的 handoff 不是'把上下文传给下个 session'，而是'压缩到 5-10% 再传'。"

### ★ 最大的设计收获：alloy 的 phase 状态机本身就是 handoff 边界

文章提到一个 HumanLayer 的模式叫 **ACE-FCA**：Research → Plan → Implement 三个阶段，**每个阶段之间完全 context reset**，只传 ~1500 token 的结构化 handoff 文档，目标是把上下文一直保持在 40-60%。GSD 也是这个思路（每个 phase 开 fresh 200K 窗口）。

**这跟 alloy 的 plan → execute → verify 状态机是同一件事！**

alloy 的 phase 转换点（plan 做完进 execute、execute 做完进 verify）**天然就是 ACE-FCA 的 context-reset 边界**。所以 alloy 应该：

> **每次 phase 转换时，自动写一个压缩的 handoff 到 `.alloy/tasks/<id>/progress.md`，下个 phase 从干净上下文开始，只读那个 handoff（加 plan.md），不继承上个 phase 的满屏对话。**

这一下把两件本来分开的事统一了：

- 之前我们把"状态机"（plan/execute/verify）和"token 优化"（handoff/DCP）当成两个独立话题在讨论。
- 实际上 **phase 转换 = context reset = handoff 触发点**。状态机的每一步前进，本身就是一次"压缩 + 外置 + 重置"。
- 这正好是 GSD"每 phase fresh context" + ACE-FCA"阶段间只传 1500 token" + mattpocock"handoff 压到 5-10%"三家的交汇点。

**alloy 的完整 token 故事就变成一句话：**

> 用 CodeGraph/RTK（Select）少读废代码，用 DCP（Compress）让单 phase 撑久，phase 切换时自动 handoff（Write）+ 重置，重活用 subtask 派给 Haiku（Isolate）。状态机的每次前进 = 一次上下文重置。

### DCP 的 license 坑（必须标）

DCP（OpenCode 那个 plugin）是 **AGPL-3.0**。alloy 如果把它 vendor 进来（复制源码），就是 AGPL 污染——跟 v0.1.3 我们否决 Skyvern 一模一样的理由。

好在有个 MIT 的 Claude Code 移植版叫 `claude-dcp`。所以 alloy 的做法是：**引用/推荐 DCP（在文档里告诉用户"装这个能省 token"），不把它的代码抄进 alloy。** 跟 Select 层的 CodeGraph/RTK 一样——推荐，不内置。

---

## 第五组：你认可的 —— 确认 + 落地（标注 3、12、13）

### 9️⃣ agent 委派规则表照抄（标注 3）✓

你说"这个我觉得可以照抄"。确认照抄 OMO 的"Delegate when / Don't delegate when"表格形式，内容换成 alloy 的 7 个 agent。这张表放进 `agents/Orchestrator.md`，LLM 看表自己决定派谁（就是标注 2 确认的 prompt-driven 模式）。

具体哪条规则准不准，等整个方向定了我写进 v0.1.4 plan 时再逐条给你看——现在先不陷进 agent 级细节（你说过别太早钻细节）。

### 🔟 alloy-skills 拆独立 repo（标注 12）✓

你说"我觉得这是个好的方案诶"。确认，排进 v0.1.4。这是抄 SuperPower v5 的架构：

- `lifeodyssey/alloy` = plugin + CLI + agents + commands + atoms + packs（"怎么加载"）
- `lifeodyssey/alloy-skills` = universal skills + scope skills（"加载什么"）
- CLI 加 `--skills-source <url>` flag，指向用户自己的 fork
- 好处：用户 fork `alloy-skills` 自己改 skill / 加私有 skill，**plugin 升级和 skill 升级完全脱耦**——alloy 出新版不会覆盖你改的 skill。

这同时也解决了你之前问的"企业内部怎么用我们的库当第三方 skill 分发"——企业 fork `alloy-skills`，加内部 skill，dev 用 `--skills-source https://github.corp.com/corp/alloy-skills` 拉。

### 1️⃣1️⃣ 为什么 plugin 自动 emit evidence（标注 13）

你问"为什么"——为什么要 plugin 自动检测 + emit，而不是让 agent 自己写 evidence。

**核心理由是信条 #1（最强约束靠 code 不靠 prompt）：**

如果靠 agent"记得"去 emit evidence，那就是 prompt 建议——agent 会忘。忘了 evidence 就缺，缺了 evidence 后面的 verify gate 就没法校验"这个任务真的测过/真的 commit 过"。这就是"prompt 不可靠"的典型。

GSD 的做法是：plugin hook 检测到 `git commit` 跑了 → **自动**记一行 evidence。agent 不需要记得，用户也不需要手动写。**确定性，跳不过去。** 类比就是 git pre-commit hook 强制跑测试 vs"记得手动跑测试"——前者强制，后者靠自觉。

对比另一个方案（Chorus 模式）：agent 必须显式调 API 来 transition 状态。**但这恰恰是我们想避免的"靠 agent 自觉"。** 所以 alloy 照 GSD，不照 Chorus。

**但我要诚实补一个 round 4 没说的代价：** 自动 emit 意味着 plugin 要拦截工具调用，会有噪音。不能每个 `Read` 都记一行 evidence（那 events.jsonl 会爆）。所以实际做法是**混合**：

- **高信号事件自动 emit**：`git commit`、测试运行（exit code）、PR 创建、写 src 文件 —— plugin 自动记，跳不过。
- **语义事件 agent 可选 emit**：比如"做了个架构决策"、"发现根因" —— agent 主动调 `alloy_evidence` 记，作为补充。

自动的保底（强制），agent 的补充（丰富）。两者叠加，既有"跳不过的最强约束"，又不丢语义信息。

---

## 第六组：我的表达问题（标注 10）

你说：

> "你这个'你认吗'像是人话吗？"

**收到，这轮已经改了。** 我之前每段结尾甩一串：

```
[ ] X 你认吗?
[ ] Y 你认吗?
[ ] subtask 加新 plugin tool alloy_dispatch_subtask 你认吗?
```

这是机器味的 checklist，读着累、还显得我在走流程而不是真在跟你讨论。这轮我把每条都写成正常的问句、给完取舍让你接话，不再列"你认吗"清单。后面所有轮都这样。

---

## 收尾：这轮锁了什么，还剩什么要定

**我收回 / 修正的（你提的对）：**

| # | 之前 | 现在 |
|---|---|---|
| 1 | 加 Oracle 第 8 个 agent | 砍掉，改成 Fixer 的 escalation 规则 |
| 6 | "信条说不上 DB 所以不抄" | 按真实场景比较，JSONL 赢在 merit，信条是结论的总结不是理由 |
| 7 | handoff 写 `.alloy/handoffs/` | 默认写 OS 临时目录（跟原版），`--persist` 才进 repo |
| 9 | 每任务 6 个 md（抄 GSD） | 减肥到每任务 2 个 md + 全局 1 个 jsonl，懒创建，不上 XML |
| 11 | agentRoster 配置 | 大概率砍掉，全装 7 个 agent + 委派规则管 solo/team |
| 10 | "你认吗" checklist | 改成正常说话 |

**这轮新的核心收获：**
- token 优化的 4 方向框架（Select/Compress/Isolate/Write），alloy 在 Isolate+Write 自建、Select+Compress 接现成的。
- **alloy 的 phase 状态机 = ACE-FCA 的 context reset 边界**。phase 切换自动 handoff + 重置。状态机和 token 优化是同一件事。
- DCP 是 AGPL，引用不 vendor（用 MIT 的 claude-dcp）。

**你认可、直接进 v0.1.4 的：**
- agent 委派规则表照抄 OMO 形式（标注 3）
- alloy-skills 拆独立 repo（标注 12）
- plugin 自动 emit evidence，混合模式（标注 13）

**还需要你拍 / 或我再实测 OpenCode 的（3 个真不确定的点，不脑补）：**

1. **OpenCode 原生 `@agent` 委派传不传完整上下文？** 决定 `alloy_dispatch_subtask` 要不要自建（标注 5）。你天天用，可能你一句话就答了。
2. **preset 这层要不要砍？** 如果 OpenCode 原生 agent 切换（左下角那个）+ agent frontmatter 绑 skill 就够了，preset 可以删（标注 4）。需要确认 OpenCode agent frontmatter 能不能声明 skill 可见性。
3. **handoff 默认位置** —— OS 临时目录（跟原版）还是 `.alloy/`？我倾向前者 + `--persist` 选项（标注 7）。

**这三个一定，加上你对上面修正的确认，我就写 round 6 = v0.1.4 真正的实施 plan**（wave 切分 + 逐文件改动 + 工作量），那一份是写进 repo 准备开干的，不再是讨论稿。

---

*（这轮 4 个 agent 的原始报告：mattpocock handoff 原版位置、OpenCode agent 显示机制、4 种存储方案对比、zhenjia 文章 5 步+4 方向框架——都在我上面引用了，需要哪条的完整原文我再贴。）*
