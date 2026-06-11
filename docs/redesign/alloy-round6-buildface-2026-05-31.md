# alloy round 6 — 7 条标注的调研结果 + 一个大收敛

> 你 round 5 标注 7 条，明确说"那你倒是去研究一下啊"。所以这轮我又派了 4 个 agent 实查：
> 1. OMO 的 escalation/oracle 规则到底怎么写的 + 有没有更好的名字
> 2. OpenCode 原生委派传不传完整上下文（读了 v1.15.10 源码）
> 3. SQLite-in-Node 到底行不行（node:sqlite 内置了吗 + git 故事）
> 4. AGPL 到底怎么了 + 有哪些别的 context 工具能用
>
> 查完发现一件事，比单条回答更重要——**我之前提议要造的东西，有一半 OpenCode 原生或现成工具已经做了，alloy 不该重复造。** 这轮先逐条给调研结果（Part 1），再讲这个收敛（Part 2），最后如果你认这个范围，给 v0.1.4 的高层切分（Part 3）。

---

## Part 1 — 7 条标注，逐条调研结果

### 1️⃣ escalation（原来叫 Oracle）—— 不新开 agent，做成 Fixer 的一条规则

你说"那还挺有价值的吧，但有没有更好理解的名字，以及 omo 怎么做的，深度研究一下"。

**OMO 怎么做的（agent 读了源码）：** 那条"卡 2 次升级"的规则，**纯粹是 orchestrator 提示词里的一行文字**（`src/agents/orchestrator.ts:51` 的 `@oracle` 描述块），原文：

> **Delegate when:** Major architectural decisions • **Problems persisting after 2+ fix attempts** • High-risk multi-system refactors
> **Don't delegate when:** Routine decisions • **First bug fix attempt** • Straightforward trade-offs
> **Rule of thumb:** Need senior architect review? → @oracle

`oracle.ts`（oracle 自己的定义）里**没有任何计数器、没有阈值**，只有一句"标准方法失败时指导调试"。所谓"2+"完全是 **LLM 自己判断**的。而且 agent 确认：OMO **没有**"修不好就升模型"这种机制——它唯一的运行时模型切换是 rate-limit（429）failover，跟"修不好"无关。

**名字：** "Oracle"是神话黑话，用户看不懂。Agent 给了 3 个更直白的：
- `deep-debugger` —— 点明用途（卡住的根因深挖）
- `escalation` —— 点明这是个触发规则不是人设
- `second-opinion` —— 顾问/复审定位

**我的方案：alloy 不新开第 8 个 agent，把它做成 Fixer 的一条 escalation 规则。** 因为 alloy 已经有 `alloy-debug`（systematic-debugging skill）了，那个本身就是"深度推理升级"。规则写在 `agents/Fixer.md` 里：

> 同一个 bug 你已经尝试修了 2 次还没好 → 停。不要再试第 3 次同类修法。强制 invoke `alloy-debug` skill 走系统化根因排查，并把本次推理的模型从 sonnet 提到 opus。

这样"卡 2 次升级"的价值留住了（你说有价值），但不增加 agent 数量，复用现成 skill。**如果你还是想要一个能独立 `@` 调用的东西**，那就叫 `deep-debugger`，别叫 oracle。

OMO 那条规则我也注意到它其实管两件事：「重大架构决策」+「卡 2 次」。前半"架构决策"在 alloy 里**已经是 Planner 的活**了，所以 alloy 这边只需要接住后半"卡 2 次"。

---

### 2️⃣ ★ subtask tool —— 不造。OpenCode 原生已经隔离上下文了

你说"那你倒是去研究一下啊"。研究了，而且是这轮**最确定**的一条。

Agent 读了你机器上装的 OpenCode **v1.15.10 的源码** `packages/opencode/src/tool/task.ts`，结论无歧义：

**OpenCode 原生委派已经是隔离上下文的。** 当一个 agent 通过 `@mention` 或 Task 工具派子任务时（`task.ts:154-169`）：

```ts
const nextSession = yield* sessions.create({
  parentID: ctx.sessionID,            // ← 只是结构上的父子链接
  title: params.description + ` (@${next.name} subagent)`,
})
```

然后喂给这个新 session 的（`task.ts:195-203`）**只有任务 prompt 本身**：

```ts
const parts = yield* ops.resolvePromptParts(params.prompt)
const result = yield* ops.prompt({
  sessionID: nextSession.id,          // 全新的 child session
  parts,                              // == params.prompt，仅此而已
})
```

`parentID` 纯粹是导航用的结构链接，**不会把父对话的历史加载进子上下文**。agent grep 了整个文件，没有任何 `messages`/`history`/`copy`-from-parent 的路径。

也就是说：你跟 Orchestrator 聊了 50k token，它 `@Fixer`，**Fixer 是从零开始的**——只拿到任务描述 + 你指定的文件，不继承那 50k。

**所以 `alloy_dispatch_subtask` 是重复造轮子，砍掉。** alloy 不需要自己实现隔离——OpenCode 原生 Task 工具已经给了。这是 round 5 我那个"诚实的疑点"的答案：疑点成立，工具不该加。

（验证方法 agent 也给了，你想自己确认的话：主 session 里说"暗号是 BANANA"，然后 `@Fixer` 问"暗号是什么"——隔离的话它答不出来。）

---

### 3️⃣ handoff 何时触发 —— 两种触发，DCP 只削兜底那种

你的问题很关键：

> "我们的路径其实是 Agent 接着干。典型路径是上下文快满了换下一个 Agent。但如果用了 DCP 或 MagicContext，上下文可能维持在均衡状态。那这个 skill 应该什么时候被触发？"

**答案：handoff 有两种触发，DCP/MagicContext 只削弱其中一种。**

| 触发类型 | 什么时候 | DCP 的影响 |
|---|---|---|
| **phase 边界触发（主）** | plan→execute→verify 每次转换 | **不受影响**——不管上下文满不满，换 phase 就触发 |
| **token 阈值触发（兜底）** | 单个 phase 跑太长、撞到 ~70% | **DCP 主要削这个**——让你在单 phase 内不容易撞到 70% |

关键理解：**phase 边界那种触发，本来就跟"上下文满不满"无关。** 就算 DCP 把你的上下文压得很均衡、永远不撞 70%，你做完 plan 还是要进 execute——那个转换点本身就是你**想要** fresh reasoning 的地方（plan 阶段的探讨对 execute 阶段是噪音）。所以 DCP 让你少触发兜底的那种，但消不掉主要的 phase 边界那种。两者不打架，是不同层。

**关于 Magic Context（你提到的另一个）：** agent 查到它是"后台历史学家：cache-aware 压缩 + 跨 session 记忆"，MIT 许可。它其实**同时做压缩和跨 session 记忆**——所以它跟 handoff 有重叠。区别在：

- **mattpocock handoff** = 显式、phase/用户触发、结构化文档（**有纪律、确定性**——你控制每个 phase gate 产出什么摘要）
- **Magic Context** = 自动、后台、环境记忆（**方便，但你不精确控制它抓了什么**）

对 alloy 来说，**phase 边界的显式 handoff 才是符合信条 #1（最强约束）的那个**——它在每个 phase gate 强制产出一份干净摘要，确定性的。Magic Context 是个好用的环境安全网，但不能替代有纪律的 phase handoff。所以：alloy 自己建 phase-boundary handoff（vendor mattpocock skill），Magic Context 作为可选的环境增强（安装时推荐，见标注 6）。

---

### 4️⃣ + 5️⃣ SQLite —— 你质疑得对，我的理由错了，收敛成一个干净的

你两条：「agent 读 sqlite 不难，可以写 skill」+「没懂那个理由」。两条都对，我 round 5 讲砸了。

**Agent 实测纠正了我两个错：**

**错误一：我说"破零依赖、每平台 rebuild"——错。** `node:sqlite` 是 Node **内置**的（v22.5 加入，现在是 release candidate）。agent 在你这台机器（Node v22.16）实测 `import { DatabaseSync } from 'node:sqlite'` 直接能用，**零安装、不用编译、不用 node-gyp、不用每平台 rebuild**。我把 `better-sqlite3`（那个才是要编译的 C++ 原生模块）的缺点安到内置 sqlite 头上了。这条理由撤回。

**错误二：我说"agent 读不了 sqlite"——你对，能读。** 写个 skill 跑 `sqlite3 db "SELECT..."` 就读了。可读性不是障碍，我高估了。

**纠正后，SQLite 只剩一个真问题：git。**

agent 查清楚了：`.db` 是二进制 blob。commit 后改了几行：
- `git diff` 只显示 `Binary files differ`——**你看不到"加了哪个任务"**
- history 膨胀——每次改动近乎整文件重存（B-tree 页面重排，delta 压不动）
- 想让它在 git 里可读，得加 `gitsqlite` 这种 clean/smudge 过滤器（把 `.sql` dump 当 commit 内容）——**多个活动部件**，而且两个人改同一个 db 的 **merge 还是会在重叠行冲突**

对比 JSONL：append 一行 → git 显示那一行 → 两人 append 不同行**自动干净合并**，零工具。

**所以结论（JSONL）不变，但理由从我 round 5 那三个糊的（破依赖/rebuild/读不了，全错或夸大），收敛成一个干净准确的：git 可追踪 + 可合并。** 这才是真正把 JSONL 和 SQLite 区分开的点。

而且这呼应你 round 4 那条方法论——**不是"信条说不上 DB 所以不用 SQLite"，而是逐项比完，发现 SQLite 在 git 这点实打实地输，JSONL 实打实地赢。** SQLite 技术上完全可行（零安装），只是它跟"git 可追踪可合并"这个需求对着干。如果哪天 alloy 不需要 git 追踪状态了（比如状态移到 web 后端），SQLite 立刻重新可选。

---

### 6️⃣ 安装时让用户选装 context 工具 —— 可以，而且全是安全许可

你说"能不能我们在安装的时候推荐来让用户来选择要装什么"。可以，这正好接上 v0.1.2 已经计划的 interactive install。

**做成 `alloy install` 的一段勾选菜单**（像 npx skills）：

```
$ alloy install
? Context 工具（Space 勾选，都是可选，alloy 不替你装死）:
  [x] CodeGraph    — AST 代码索引, 少读废代码          (Select 层, MIT)
  [x] RTK          — CLI 输出压缩, 不破 cache           (Compress 层, MIT)
  [ ] lean-ctx     — 文件读取/MCP 返回压缩              (Compress 层, MIT)
  [ ] claude-dcp   — 动态上下文压缩 (DCP 的 MIT 移植)    (Compress 层, MIT)
  [ ] Magic Context— 后台跨 session 记忆 + 压缩          (Compress+Write, MIT)
  [ ] Headroom     — 工具输出/日志压缩, AST-aware        (Compress 层, Apache-2.0)
```

**机制上有个现实约束我得说清楚**（这些是外部工具，装法各不同——RTK 是 rust binary，CodeGraph 是 binary，claude-dcp 是 plugin）：alloy **不能**统一 `npm install` 它们。所以"安装"实际是三步：
1. **检测**已经装了哪些（doctor 风格）
2. 对**勾选但缺失**的，打印各自的安装命令（不替用户跑，信条 #3）
3. 把**配置**写进 `.opencode/opencode.json`（比如勾了 claude-dcp 就加进 plugins 列表）

这样既"推荐 + 让用户选"，又不越界替用户装。

---

### 7️⃣ AGPL 怎么了 + 别的 context 工具

你两问：「这个 license 怎么了」+「我们不是还有别的 context 管理的」。

**license 怎么了（agent 给的精确版）：** AGPL-3.0 比 GPL 多一条 **§13 网络条款**。普通 GPL 只在"分发二进制"时要求公开源码（SaaS 钻了空子）；AGPL 把这个洞堵了——**只要用户能通过网络跟软件交互，就算"分发"，必须向所有远程用户提供完整源码**。后果：

- 如果 alloy **把 DCP 源码 vendor（复制）进来**并分发 → alloy 整个变成 AGPL，MIT 的宽松没了，连企业内部跑个 SaaS 碰到这代码都可能触发源码公开。**企业法务基本一律禁 AGPL**（derivative 边界模糊、审计贵、下行风险不值）。
- 如果 alloy **只是推荐用户自己单独装** DCP（alloy 不抄它代码，用户作为独立程序自己装）→ **完全没污染**。copyleft 只管"复制/分发/修改"，不管"文档里提到它"。

**别的 context 工具（你问的，agent 列了一张表，全查了 license）：**

| 工具 | 干什么 | License | 能 vendor 吗 |
|---|---|---|---|
| claude-dcp | DCP 的 Claude Code 移植 | **MIT** | ✅ 用这个替 AGPL 的 DCP |
| Magic Context | 后台跨 session 记忆 + 压缩 | **MIT** | ✅ |
| Headroom | 工具输出/日志压缩, AST-aware | **Apache-2.0** | ✅ |
| Cozempic | 清理臃肿的 JSONL session | **MIT** | ✅ |
| claude-mem | 跨 session 捕获/压缩/再注入 | **Apache-2.0** | ✅ |
| RTK / lean-ctx / CodeGraph | （Select/Compress） | **MIT** | ✅ |
| **DCP（OpenCode 原版）** | session 内压缩 | **AGPL-3.0** | ❌ 只推荐，不抄 |
| Context Mode | 沙箱工具输出 + FTS5 | **Elastic License 2.0** | ⚠️ source-available 非 OSS，只推荐 |

**结论：alloy 根本不需要碰那个 AGPL 的 DCP。** 要 DCP 的能力就用 claude-dcp（MIT）或 Magic Context（MIT）。安装菜单里全放宽松许可的，AGPL 那个最多在文档里写一句"想用原版自己装"。（agent 还发现你的 CREDITS.md 已经把 DCP 标成"AGPL，referenced not vendored"了，跟这个决定一致。）

---

## Part 2 — ★ 这轮的大收敛：alloy 该造的比我以为的少

把上面 7 条连起来看，浮现一个我之前没看清的东西：**我提议要 alloy 自己造的，有一批是多余的——OpenCode 原生或现成工具已经做了。**

**我这轮收回的"别造"清单：**

| 我之前提议造 | 实际情况 | 结论 |
|---|---|---|
| `alloy_dispatch_subtask` 工具 | OpenCode 原生 Task 已隔离上下文（v1.15.10 源码确认） | **不造**，用原生 |
| Oracle 第 8 个 agent | "卡 2 次"是 prompt 规则，alloy 已有 alloy-debug skill | **不造**，做成 Fixer 规则 |
| preset 切换层（round 5 标注 4） | OpenCode 原生 agent 切换 + agent 绑 skill 可能已够 | **大概率不造**（待确认 agent frontmatter 能否声明 skill 可见性） |
| agentRoster 配置（round 5 标注 11） | 委派规则就能管 solo/team，不需要配置 | **不造**，全装 + 规则管 |
| DCP / 各种 context 压缩 | 现成工具一堆（MIT） | **不造**，安装时推荐 |

**用 zhenjia 那个 4 方向框架来对齐，alloy 的真实建造面一下就清楚了：**

| 方向 | 谁来做 | alloy 的角色 |
|---|---|---|
| **Select**（选对代码进上下文） | CodeGraph / RTK / lean-ctx（外部 MIT） | **推荐**（安装菜单），不造 |
| **Compress**（压缩当前上下文） | claude-dcp / Magic Context / Headroom（外部 MIT/Apache） | **推荐**（安装菜单），不造 |
| **Isolate**（隔离/换便宜模型） | OpenCode 原生 Task 工具（已隔离） | **配置**（给 Explorer 配 Haiku + Orchestrator 委派规则），不造机制 |
| **Write**（外置到文件系统） | handoff skill + `.alloy/` 状态 | **alloy 自己造** ← 真正的本职 |

**所以 alloy 的真实建造面收窄成这 4 块（其它全是编排/推荐/配置）：**

1. **Write 层（状态 + 交接）**：`.alloy/` 状态（JSONL 真理源 + Markdown projection）、phase 边界自动 handoff、vendor mattpocock handoff skill
2. **编排（agent + 状态机）**：7 个 agent 的 prompt-driven 委派规则表、Fixer 的 escalation 规则、plan→execute→verify 状态机、给各 agent 配模型
3. **安装 + 分发**：interactive install（含 context 工具勾选菜单）、拆 `alloy-skills` 独立 repo、vendor sync（GitHub Actions）、企业 fork
4. **plugin 胶水**：auto-emit evidence（git commit hook 触发）、filter-skills（每个 agent 看见不同 skill）、runtime-detect OMO 共存

**这是个好消息——alloy 越薄越好。** 它的价值不在重新实现隔离/压缩，而在**把这些现成的层编排成一套有纪律的 plan→execute→verify 工作流**，加上状态外置和分发。信条 #2"plugin-first / CLI-minimal"和这个收敛完全一致：alloy 是缝合层，不是什么都自己造的框架。

---

## Part 3 — 如果你认这个范围，v0.1.4 的高层切分

（先不钻文件级细节——你提醒过别太早钻。这里只给系统级的 wave 划分，让你看方向对不对。认了我再写 round 7 = 逐文件的实施 plan。）

**v0.1.4 = "状态机 + 状态外置 + 薄编排"，3 个 wave：**

**Wave 1 — 状态机 + Write 层**（核心，最先做）
- plan→execute→verify 状态机：用 plugin hook 强制 phase 转换（信条 #1，code 强制不靠 prompt）
- `.alloy/` 减肥版状态：全局 `PROJECT.md` + `events.jsonl`，per-task `plan.md` + `progress.md`（懒创建，不上 XML）
- phase 边界自动 handoff：每次转 phase，plugin 自动把当前 phase 压成摘要写进 `progress.md`，下个 phase fresh 开始
- auto-emit evidence：plugin hook 检测 git commit/test → 自动记 events.jsonl（高信号自动 + agent 可补语义事件）

**Wave 2 — 薄编排（agent + 委派）**
- 7 agent 委派规则表（照 OMO 形式，写进 Orchestrator.md）
- Fixer escalation 规则（卡 2 次 → alloy-debug + 升模型）
- 给 agent 配模型（Explorer→Haiku 走 Isolate）
- 确认/砍 preset 层（取决于 OpenCode agent frontmatter 能否绑 skill 可见性——这个还要实测一次）

**Wave 3 — 安装 + 分发**
- interactive install（pack 选择 + context 工具勾选菜单）
- 拆 `alloy-skills` 独立 repo + `--skills-source` flag
- vendor sync GitHub Actions（fusionType 4-tier）
- 企业 fork（Case A）+ `alloy create-hub`（Case B）

**工作量直觉**：Wave 1 最重（状态机 + hook 是 plugin 核心改动），Wave 2 中等（主要是 prompt + 配置），Wave 3 偏工程（CLI + repo 拆分 + CI）。具体小时数等 round 7 逐文件估。

---

## 收尾 — 这轮锁了什么，还剩什么

**调研确定的（有源码/license 证据）：**
- subtask 工具不造（OpenCode 原生 v1.15.10 已隔离）
- Oracle 不造，做 Fixer 规则（OMO 那条也只是 prompt 规则）
- SQLite 输在 git（不是输在依赖/可读性——那俩我错了），JSONL 继续
- AGPL 只推荐不 vendor，用 claude-dcp/Magic Context（MIT）替代
- 安装菜单全放宽松许可工具

**收敛的大方向：alloy 越薄越好，只造 Write 层 + 薄编排 + 分发，Select/Compress/Isolate 全用现成的。**

**还剩 1 个需要再实测 OpenCode 的点**：preset 层要不要砍，取决于 OpenCode 的 agent frontmatter 能不能声明"这个 agent 只看见这几个 skill"。如果能，preset 就砍了用原生；如果不能，preset 保留。这个我可以再派一个 agent 读 OpenCode agent 配置的 schema 确认——你说一声我就去。

**如果你认 Part 2 的"真实建造面"和 Part 3 的 3-wave 切分，下一份 round 7 就是 v0.1.4 的逐文件实施 plan**（改哪些文件、加哪些 hook、工作量小时数），那份是写进 repo 准备开干的。
