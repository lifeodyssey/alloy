# alloy round 7 — install/state 机制澄清 + preset 是什么 + 工具实测数据

> 你 round 6 标注 8 条，大多是"机制层"的追问（install 能不能帮装、JSONL 谁读、preset 到底是啥、那些工具谁好）。这轮：
> - 又派 1 个 agent 实测了 OpenCode agent 能不能原生绑 skill（标注 8 的 preset 问题）→ **能，preset 可以砍**
> - 又派 1 个 agent 抓了 10 个 context 工具的真实 star/许可/OpenCode 兼容性（标注 7）
> - 纠正我 round 6 两个错：① 把信条 #3 用过头了（标注 5/6）② claude-dcp 对 OpenCode 没用（标注 7）
>
> 这轮把机制全说清，架构层基本就定了。下一份 round 8 就是 v0.1.4 真正的实施 plan。

---

## 1️⃣ deep-debugger 名字 ✓

你说"可以"。定了，叫 `deep-debugger`，不叫 Oracle。

---

## 2️⃣ debug skill 是"只要 debug 就用"，deep-debugger 只是那条 escalation

你说得对：

> "但是我们自己只要 Debug 就要用 debug skill 吧，skill 的编排我们待会儿再说"

我 round 6 把两件事搅在一起了，拆开：

- **debug skill = 只要开始 debug 就用**。这是"怎么 debug"的方法（系统化根因排查），任何 debug 场景都走它，不是只有卡住才用。
- **deep-debugger = 一条 circuit-breaker 规则**，比 debug skill 窄：它只在"同一个 bug 你已经用同类修法失败 2 次"时触发，做两件事——**停止再试同类修法** + **把模型从 sonnet 提到 opus** 重新深挖。

也就是说：debug skill 是常态，deep-debugger 是"失败 2 次后的熔断器"。两者不冲突——你一直在用 debug skill，熔断器只是在你原地打转时拍你一下"换个深度想，别再撞墙"。

**skill 的编排（什么时候哪个 skill 自动 fire）你说待会儿再说，我同意——那个留到后面专门一轮。** 这轮只确认 deep-debugger 这条规则的定位。

---

## 3️⃣ JSONL 谁读 —— 人不读 JSONL，人读 markdown 投影（你是对的，我 round 6 讲歪了）

你两个质疑：

> "人类也不会去读 jsonl 吧" + "两人 append 不同行这个场景我没懂"

**第一个你完全对，我得把分工讲清楚。** alloy 里有三种文件，谁读谁写是分开的：

| 文件 | 谁写 | 谁读 | 是什么 |
|---|---|---|---|
| `plan.md` / `progress.md` | agent/人（写散文） | **人** | 人话的计划、进度笔记、发现 |
| `status.md`（projection） | plugin 自动生成 | **人** | "当前状态"快照，从 events.jsonl 渲染出来 |
| `events.jsonl` | **plugin 自动 append** | **机器**（gate/audit），人不读 | 事件日志：谁在什么时候转了 phase、emit 了什么 evidence、commit 了什么 |

**所以人从头到尾读的是 markdown（plan/progress/status），从来不读 events.jsonl。** events.jsonl 是给机器看的审计流。你的直觉对——没人会去读 JSONL，也不该让人读。

**第二个（两人 append）——这个是我 round 6 瞎吹的，撤回。** alloy 是 solo 优先，"两人改同一个状态文件"根本不是你的场景，我拿一个不相干的多人 merge 好处来论证，反而把你搞糊涂了。对 solo 用户，append-only JSONL 的真实好处是**这三个**，跟多人无关：

1. **崩溃安全**：append 一行永远不会损坏已有数据。而"改写一个 markdown 状态文件"如果写一半崩了，整个文件可能毁了。
2. **git 历史干净**：每次 commit 显示"+3 行事件"，不是"整个状态文件被重写"。你能从 git log 看出"这次做了啥"。
3. **gate 能查**：`alloy gate check` 要回答"这个 commit 之前测试过了吗"，需要一个结构化、可查询的日志——这就是 events.jsonl。如果是散文 markdown，机器得解析人话，脆。

**最诚实的一句：events.jsonl 之所以存在，唯一理由是你 round 4 批准的那个"plugin 自动 emit evidence + gate 强制校验"（信条 #1）。** 那个功能需要一个机器可查的结构化日志。如果哪天不要 gate 了，JSONL 也就不需要了。既然你要 gate，JSONL 就留着——但**严格只当机器事件日志，对人不可见**。人的那一面永远是 markdown。

---

## 4️⃣ install 菜单只列 OpenCode 能用的（你对，我 round 6 列杂了）

你说"目前只做 open code，所以要不帮只列举 opencode"。对。我 round 6 那张表混进了 Claude-Code-only 的工具（claude-dcp、Cozempic、claude-mem 严格说是 CC 的）。

**这轮 agent 按 OpenCode 兼容性重新筛了**（star 数是 2026-05-31 live 抓的，比搜索准）。OpenCode 真能用的：

| 工具 | Star | 许可 | OpenCode 兼容 | 层 |
|---|---|---|---|---|
| **CodeGraph** | 34,192 | MIT | ✅ 明确支持 opencode (MCP) | Select |
| **RTK** | 56,494 | Apache-2.0 | ✅ 通用 shell hook | Compress (CLI 输出) |
| **lean-ctx** | 2,278 | Apache-2.0 | ✅ 通用 MCP | Compress (文件/MCP) |
| **Magic Context** | 748 | MIT | ✅ 原生 OpenCode plugin | Compress + 跨 session 记忆 |
| **DCP** | 3,087 | **AGPL-3.0** | ✅ 原生 OpenCode plugin（参考实现） | Compress (对话) |
| **Headroom** | 2,090 | Apache-2.0 | ✅ 通用 MCP/proxy | Compress (工具输出) |
| **Context Mode** | 16,022 | **Elastic-2.0** | ✅ 带 opencode 配置 | Select (沙箱 KB) |
| ~~claude-dcp~~ | 10 | MIT | ❌ **Claude-Code-only** | 排除 |
| ~~Cozempic~~ | 319 | MIT | ❌ **Claude-Code-only** | 排除 |
| ~~claude-mem~~ | 79,725 | MIT | △ 多平台但偏 CC | 看是否真支持 OpenCode |

**纠正我 round 6 的错**：我说"用 claude-dcp（MIT）替 AGPL 的 DCP"——**对 OpenCode 是错的**，claude-dcp 是 Claude Code 专用，OpenCode 用户装了没用。OpenCode 上想替 AGPL 的 DCP，正确答案是 **Magic Context（748 ⭐，MIT，原生 OpenCode plugin，而且压缩+记忆一体）** 或 **RTK（56k，Apache，CLI 输出压缩）**——这俩才是 OpenCode 能用的 MIT 替代。

---

## 5️⃣ + 6️⃣ ★ alloy 能不能帮用户装 —— 能，我把信条 #3 用过头了

这两条是同一个主题，我合起来答，因为它们戳中我一个反复犯的错。

**标注 5**：我写"打印安装命令，不替用户跑（信条 #3）"，你问"不能帮用户装了吗"。
**标注 6**：你问"如果我们只是用户点了想装之后帮用户装呢"。

**你对，我把信条 #3 用过头了。** 信条 #3 是"**不替用户做选择**"——管的是"别擅自把某个工具默认开启"。但**用户在菜单里主动勾选了，那已经是他的选择了**，帮他把勾选的装上，不是替他做选择，而是**执行**他的选择。我之前那套"只打印不执行"是教条主义，反而难用。

**所以纠正：alloy install 菜单里用户勾了的，alloy 直接帮装。** 流程变成：

```
$ alloy install
? Context 工具（Space 勾选）:
  [x] CodeGraph
  [x] RTK
  [ ] Magic Context
→ 用户勾完按 Enter
→ alloy 自动跑每个工具的安装（CodeGraph 装 MCP、RTK cargo/brew、Magic Context 加进 opencode.json plugins + bun install）
→ 装不了的（比如需要 sudo / 网络失败）才 fallback 打印手动命令
```

**关于 AGPL 那个（标注 6 的深层问题）：帮用户装 AGPL 的 DCP，会污染 alloy 吗？不会。**

agent 确认了 copyleft 的机制：alloy 帮用户跑 `安装 DCP` 命令时，DCP 的代码是**从 DCP 自己的 repo/registry 拉到用户机器**的——alloy 只是替用户执行了 `git clone` / `npm install`，**alloy 的分发包里没有 DCP 一行代码**。AGPL 的义务落在"谁分发 DCP 的代码"，而那是 DCP 作者（用户从他们那拉的），不是 alloy。

类比：Homebrew 帮你装一个 AGPL 工具，不会让 Homebrew 变成 AGPL；apt 装 GPL 软件不会让 apt 变 GPL。**包管理器替你拉第三方代码 ≠ 包管理器再分发那些代码。**

**所以唯一的红线就一条：alloy 不能把 DCP 的源码复制进 alloy 自己的 repo（vendor）。** 帮用户从 DCP 官方源装、在文档里推荐——全都安全。这下连 AGPL 的 DCP 都能进"帮你装"菜单了（只要是现拉现装，不 vendor）。

---

## 7️⃣ 这些工具的具体区别 / star / 社区评价

你要的硬数据，agent 全查了（上面表格是 star/许可，下面补区别 + 评价）：

**按层的最佳选择（OpenCode 兼容、社区支持好的）：**

- **Select（代码索引，少读废代码）**：**CodeGraph**（34k ⭐，MIT，明确支持 opencode）—— 清晰第一。tree-sitter 建 SQLite 知识图，agent 查图代替 grep/Read，号称"少 92% 工具调用"。你机器上已经装了。
- **Compress（压对话）**：两条路——
  - **DCP**（3.1k ⭐，AGPL，OpenCode 原生参考实现）：暴露一个 `compress` 工具 + 自动剪掉出错/陈旧的轮次。能力最对口，但 AGPL（现拉现装不污染，见上）。
  - **Magic Context**（748 ⭐，MIT，OpenCode 原生）：后台历史学家，cache-aware 压老轮次 + **跨 session 记忆 + TUI 侧栏**。压缩和记忆一体，MIT 干净。新但口碑好。
- **Compress（压 CLI 输出）**：**RTK**（56k ⭐，Apache，shell hook，runtime 无关）—— star 最高、博客热度最大的那个。压 `git/cargo/grep` 输出 60-90%。跟 DCP 互补（DCP 压对话，RTK 压命令输出），不冲突。你机器上也装了。
- **跨 session 记忆**：**claude-mem**（79.7k ⭐，MIT，star 最高的记忆工具）—— 但偏 Claude Code，要确认它 OpenCode 支持到什么程度。OpenCode 原生的话还是 **Magic Context**（记忆+压缩一体）。

**社区情绪小结**：RTK / CodeGraph / claude-mem 是各自领域的"默认热门"（star 量级压倒性）；Magic Context 是新秀里口碑好的（"压缩+记忆一体"野心）；DCP 是大家都在 port 的参考实现，AGPL 是唯一摩擦点；Context Mode 流行（16k）但 Elastic 许可（非 OSI，分发要小心）。

**我对 alloy 默认菜单的建议**（你最终拍）：默认勾上 **CodeGraph + RTK**（star 最高、MIT/Apache、你已在用、Select+Compress 各一），其余（Magic Context / DCP / lean-ctx / Headroom）列出来不默认勾，让用户按需选。

---

## 8️⃣ ★ preset 到底是什么 —— 解释清楚 + 为什么能砍

你说"没看懂，你能详细跟我讲讲什么是 preset 吗"。这是我的锅，我一直在讨论"要不要砍 preset"却没解释它是啥。

**preset 是什么（alloy 现在真有这段代码）：**

preset 是我从 OMO Slim 抄来的一个概念——**一个有名字的"模式包"，打包了{这个模式下用哪几个 agent、哪些 skill 可见、哪些 MCP 开启}**。设计意图是：

- `plan-mode` preset：只显示规划类 skill（alloy-plan/discuss），藏掉 alloy-tdd
- `execute-mode` preset：只显示 alloy-tdd/execute/debug，藏掉规划类
- `review-mode` preset：只显示 alloy-verify/qa

然后有个 `alloy_switch_preset` 工具，能在这些模式包之间**热切换**——切到 execute-mode，TDD skill 就冒出来，规划 skill 就藏起来。目的是"别让 agent 被一堆当前阶段用不上的 skill 干扰"。

这段是**真代码**，现在就在 `templates/opencode/alloy-plugin.ts`（762 行）里有 6 处：module 级 `activePreset` 状态、`loadPresets()`、`applyPreset()`、`getActivePreset()`、config hook 里预加载、`alloy_switch_preset` 工具；外加一个 `packs/presets.json` 定义那几个模式包。

**为什么能砍（我趁你标注时派 agent 实测了 OpenCode v1.15.10 源码）：**

OpenCode **原生**就支持每个 agent 在自己的 frontmatter 里声明能看见哪些 skill，用 glob：

```yaml
# .opencode/agents/Planner.md 的 frontmatter
permission:
  skill: { "*": "deny", "alloy-plan": "allow", "alloy-discuss": "allow" }
# .opencode/agents/Builder.md
permission:
  skill: { "*": "deny", "alloy-tdd": "allow", "alloy-execute": "allow", "alloy-debug": "allow" }
```

被 `deny` 的 skill 直接从系统提示词的 `<available_skills>` 块里删掉——**这跟 `alloy_switch_preset` 想干的事一模一样，但是原生、零代码。**

关键点：**alloy 的 phase 本来就对应不同 agent**（plan→Planner、execute→Builder、verify→Reviewer）。所以"换 phase 时换可见 skill" = "换 agent 时换可见 skill"，而后者 OpenCode 原生自动就做了——每个 agent 进来，它的 `skill` permission 自动决定它看见啥。**根本不需要 preset 这个中间层。**

**所以"砍 preset"具体是**：删掉 alloy-plugin.ts 那 6 处 + `packs/presets.json`，改成在 `agents/*.md` 的 frontmatter 加 `skill` permission glob。代码净减少。

**唯一原生不覆盖的两件事**（诚实标出）：① 同一个 agent 内部不换人、只热切 skill —— alloy 不需要（换 phase 就换 agent 了）；② 按 agent 切 MCP（`skill` permission 不管 MCP）—— 这个是小事，真要的话单独处理。所以对 alloy 的用法，preset 净是多余，砍。

---

## 收尾 —— 第 5 个"不用造"+ 架构层收敛完毕

这轮又确认一个"不用造"，加上前几轮的，alloy 的"别造"清单完整了：

| 我曾提议造 | 实际 | 结论 |
|---|---|---|
| subtask 工具 | OpenCode Task 原生隔离上下文 | 不造 |
| Oracle agent | 做成 Fixer 的 deep-debugger 规则 | 不造 |
| **preset 层** | **OpenCode agent `skill` permission 原生支持** | **砍掉现有代码** |
| agentRoster 配置 | 委派规则就能管 | 不造 |
| context 压缩工具 | 一堆现成的，帮用户装即可 | 不造，装 |

**这轮的纠正（我用过头/搞错的）：**
- 信条 #3 用过头 → 用户勾了就帮装（含 AGPL，现拉现装不污染）
- claude-dcp 对 OpenCode 没用 → OpenCode 上用 Magic Context / RTK
- JSONL 多人 merge 好处是瞎吹 → solo 真好处是崩溃安全 + git 干净 + gate 可查；人只读 markdown

**架构层到这基本定了。** alloy 的真实建造面就 Part-2（round 6）那四块：Write 层（状态+handoff）、薄编排（agent+状态机）、安装分发、plugin 胶水。其余全是编排现成的。

**下一份 round 8 = v0.1.4 逐文件实施 plan**：哪些文件改/删/加、哪些 hook、preset 那 6 处怎么删、agent frontmatter 怎么加 skill glob、install 菜单怎么写、工作量小时数。那份是写进 repo 准备开干的，不再是讨论稿。

如果上面哪条你还想拧，就在这轮标；没有的话，我直接写 round 8。
