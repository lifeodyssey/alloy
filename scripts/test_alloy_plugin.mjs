import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { copyFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const PLUGIN_TEMPLATE = join(ROOT, "templates", "opencode", "alloy-plugin.ts")
const TASK_STATE_MODULE = join(ROOT, "lib", "task-state.mjs")

async function runPluginScenario(source) {
  const tmp = mkdtempSync(join(tmpdir(), "alloy-plugin-test-"))
  const projectDir = join(tmp, "project")
  const homeDir = join(tmp, "home")
  const pluginPath = join(projectDir, ".opencode", "plugins", "alloy.ts")
  const taskStatePath = join(projectDir, ".opencode", "lib", "alloy-task-state.mjs")
  const runnerPath = join(tmp, "scenario.mjs")

  mkdirSync(projectDir, { recursive: true })
  mkdirSync(homeDir, { recursive: true })
  mkdirSync(dirname(pluginPath), { recursive: true })
  mkdirSync(dirname(taskStatePath), { recursive: true })
  await copyFile(PLUGIN_TEMPLATE, pluginPath)
  await copyFile(TASK_STATE_MODULE, taskStatePath)
  writeStubModules(tmp)
  writeFileSync(
    runnerPath,
    `
import assert from "node:assert/strict"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

process.env.HOME = ${JSON.stringify(homeDir)}
const projectDir = ${JSON.stringify(projectDir)}
const taskStatePath = ${JSON.stringify(taskStatePath)}
const { default: AlloyPlugin } = await import(${JSON.stringify(pluginPath)})
const { checkGate } = await import(taskStatePath)
const hooks = await AlloyPlugin({ directory: projectDir, worktree: projectDir, $: {} })

${source}
`,
    "utf8",
  )

  const result = spawnSync("bun", [runnerPath], {
    cwd: tmp,
    env: { ...process.env, HOME: homeDir },
    encoding: "utf8",
  })
  await rm(tmp, { recursive: true, force: true })
    assert.equal(result.status, 0, result.stderr || result.stdout)
  return result.stdout.trim()
}

function writeStubModules(tmp) {
  const pluginDir = join(tmp, "node_modules", "@opencode-ai", "plugin")
  const zodDir = join(tmp, "node_modules", "zod")
  mkdirSync(pluginDir, { recursive: true })
  mkdirSync(zodDir, { recursive: true })
  writeFileSync(join(pluginDir, "package.json"), JSON.stringify({ type: "module", main: "index.ts" }), "utf8")
  writeFileSync(
    join(pluginDir, "index.ts"),
    `
function schema(kind) {
  return {
    kind,
    optional() { this.isOptional = true; return this },
    default(value) { this.defaultValue = value; return this },
  }
}
export function tool(definition) {
  return definition
}
tool.schema = {
  string: () => schema("string"),
  number: () => schema("number"),
  array: (inner) => ({ ...schema("array"), inner }),
}
`,
    "utf8",
  )
  writeFileSync(join(zodDir, "package.json"), JSON.stringify({ type: "module", main: "index.ts" }), "utf8")
  writeFileSync(
    join(zodDir, "index.ts"),
    `
function schema(kind) {
  return {
    kind,
    optional() { this.isOptional = true; return this },
    default(value) { this.defaultValue = value; return this },
  }
}
export const z = {
  string: () => schema("string"),
  number: () => schema("number"),
  array: (inner) => ({ ...schema("array"), inner }),
  object: (shape) => ({
    parse(input) {
      const parsed = { ...input }
      for (const [key, spec] of Object.entries(shape)) {
        if (parsed[key] === undefined && Object.hasOwn(spec, "defaultValue")) parsed[key] = spec.defaultValue
      }
      return parsed
    },
  }),
}
`,
    "utf8",
  )
}

test("alloy plugin registers the full hook surface and preserves existing tools", async () => {
  await runPluginScenario(`
const expectedHooks = [
  "config",
  "shell.env",
  "chat.message",
  "permission.ask",
  "tool.execute.before",
  "tool.execute.after",
  "event",
  "experimental.chat.messages.transform",
  "experimental.chat.system.transform",
  "experimental.session.compacting",
  "command.execute.before",
  "tool.definition",
]
for (const hook of expectedHooks) assert.equal(typeof hooks[hook], "function", hook)
for (const name of ["alloy_progress", "alloy_state", "alloy_gate"]) {
  assert.equal(typeof hooks.tool[name].execute, "function", name)
}

mkdirSync(join(projectDir, ".alloy", "tasks", "T1"), { recursive: true })
writeFileSync(join(projectDir, ".alloy", "tasks", "T1", "plan.md"), "# T1 Plan\\nImplement plugin hooks", "utf8")
writeFileSync(join(projectDir, ".alloy", "tasks", "T1", "progress.md"), "# T1 Progress\\n\\n## Gate\\n\\n- [ ] tdd_red\\n- [ ] debug\\n- [ ] green\\n- [ ] review\\n- [ ] verified", "utf8")

const envOut = { env: {} }
await hooks["shell.env"]({ cwd: projectDir, sessionID: "s1" }, envOut)
assert.equal(envOut.env.ALLOY_PROJECT_DIR, projectDir)
assert.ok(envOut.env.ALLOY_RUN_ID)

const msgOut = { message: {}, parts: [] }
await hooks["chat.message"]({ sessionID: "s1", agent: "Builder" }, msgOut)
assert.match(msgOut.parts.at(-1).text, /Implement plugin hooks/)

await assert.rejects(
  hooks["tool.execute.before"]({ tool: "read", sessionID: "s1", callID: "c1" }, { args: { filePath: ".env" } }),
  /blocks direct \\.env file access/,
)

await hooks["permission.ask"]({ id: "p1", sessionID: "s1" }, { status: "ask" })
const toolOut = { title: "bash", output: '{"ok": true', metadata: { exitCode: 0 } }
await hooks["tool.execute.after"]({ tool: "bash", sessionID: "s1", callID: "c2", args: { command: "npm test" } }, toolOut)
assert.equal(JSON.parse(toolOut.output).ok, true)
const gateAfterVerify = checkGate(projectDir, "T1")
assert.equal(gateAfterVerify.ok, false)
assert.ok(gateAfterVerify.blockedBy.includes("review"))
await hooks.event({ event: { type: "session.start", properties: { sessionID: "s1" } } })

const progress = await hooks.tool.alloy_progress.execute({ taskId: "T1", gate: "review", summary: "AC review passed" })
assert.match(progress, /\\[x\\] review/)
assert.match(progress, /AC review passed/)
assert.match(await hooks.tool.alloy_state.execute({}), /Implement plugin hooks/)
assert.match(await hooks.tool.alloy_gate.execute({ taskId: "T1" }), /alloy gate check --task-id T1 --json/)
`)
})

test("filter-available-skills removes manifest-hidden skills from system messages", async () => {
  await runPluginScenario(`
mkdirSync(join(projectDir, ".opencode"), { recursive: true })
writeFileSync(join(projectDir, ".opencode", "alloy.manifest.json"), JSON.stringify({
  version: "0.1.0",
  installedAt: new Date().toISOString(),
  pack: "core",
  models: "github-copilot",
  managed: { skills: ["alloy-tdd", "humanizer"], agents: [], commands: [], mcp: [] },
  visible: { skills: ["alloy-tdd"], agents: [] },
  explicit: { added: [] },
  excluded: ["humanizer"],
}), "utf8")

const output = {
  messages: [{
    info: { role: "system" },
    parts: [{ type: "text", text: "Before\\n<available_skills>\\n- alloy-tdd: run TDD\\n- humanizer: rewrite prose\\n</available_skills>\\nAfter" }],
  }],
}
await hooks["experimental.chat.messages.transform"]({ sessionID: "s1", agent: "Builder" }, output)
const text = output.messages[0].parts[0].text
assert.match(text, /alloy-tdd/)
assert.doesNotMatch(text, /humanizer/)
assert.match(text, /<available_skills>/)
`)
})

test("new plugin hooks ignore missing host payload fields", async () => {
  await runPluginScenario(`
await assert.doesNotReject(async () => hooks.config(undefined))
await assert.doesNotReject(async () => hooks["experimental.chat.messages.transform"]({ sessionID: "s1" }, {}))
await assert.doesNotReject(async () => hooks["experimental.chat.system.transform"]({ sessionID: "s1" }, {}))
await assert.doesNotReject(async () => hooks["experimental.session.compacting"]({ sessionID: "s1" }, {}))
await assert.doesNotReject(async () => hooks["command.execute.before"]({}, {}))
`)
})

test("magic detection warns when opencode config exists without manifest", async () => {
  await runPluginScenario(`
mkdirSync(join(projectDir, ".opencode"), { recursive: true })
writeFileSync(join(projectDir, ".opencode", "opencode.json"), JSON.stringify({ plugin: ["alloy"] }), "utf8")

await hooks.config({})
const chatOut = { message: {}, parts: [] }
await hooks["chat.message"]({ sessionID: "s1", agent: "Builder" }, chatOut)
const chatText = chatOut.parts.map((part) => part.text).join("\\n")
assert.match(chatText, /Run alloy install to create manifest/)
`)
})

test("magic detection, command routing, system injection, compaction, and definition hints work", async () => {
  await runPluginScenario(`
mkdirSync(join(projectDir, ".opencode"), { recursive: true })
mkdirSync(join(projectDir, ".alloy", "state"), { recursive: true })
mkdirSync(join(projectDir, ".alloy", "tasks", "T1"), { recursive: true })
mkdirSync(join(process.env.HOME, ".config", "alloy"), { recursive: true })
writeFileSync(join(projectDir, "vendor.lock.json"), JSON.stringify({ lock: true }), "utf8")
writeFileSync(join(projectDir, ".opencode", "alloy.manifest.json"), JSON.stringify({
  version: "0.1.0",
  installedAt: "2020-01-01T00:00:00.000Z",
  pack: "core",
  models: "github-copilot",
  managed: { skills: ["alloy-tdd"], agents: ["Builder"], commands: [], mcp: [] },
  visible: { skills: ["alloy-tdd"], agents: ["Builder"] },
  explicit: { added: [] },
  excluded: [],
}), "utf8")
writeFileSync(join(process.env.HOME, ".config", "alloy", "state.json"), JSON.stringify({ lastSyncedVendorLock: "wrong-sha" }), "utf8")
writeFileSync(join(projectDir, ".alloy", "tasks", "T1", "plan.md"), "# Current Plan\\nImplement plugin hooks", "utf8")
writeFileSync(join(projectDir, ".alloy", "tasks", "T1", "progress.md"), "# T1 Progress\\n\\n## Gate\\n\\n- [ ] verified", "utf8")

const config = { mcp: {} }
await hooks.config(config)
assert.equal(config.default_agent, "Planner")
assert.equal(config.mcp.context7.enabled, true)

const chatOut = { message: {}, parts: [] }
await hooks["chat.message"]({ sessionID: "s1", agent: "Builder" }, chatOut)
const chatText = chatOut.parts.map((part) => part.text).join("\\n")
assert.match(chatText, /manifest stale, run alloy upgrade/)
assert.match(chatText, /global state stale, run alloy install --target global/)
assert.match(chatText, /Implement plugin hooks/)

const delegateOut = { message: { parts: [{ type: "text", text: "Please delegate this again after retry failed twice" }] }, parts: [] }
await hooks["chat.message"]({ sessionID: "s1", agent: "Planner" }, delegateOut)
assert.match(delegateOut.parts.map((part) => part.text).join("\\n"), /delegate fallback/i)

const systemOut = { system: [] }
await hooks["experimental.chat.system.transform"]({ sessionID: "s1", model: {} }, systemOut)
assert.match(systemOut.system.join("\\n"), /<alloy-plan>/)
assert.match(systemOut.system.join("\\n"), /<alloy-progress>/)

const compactOut = { context: [] }
await hooks["experimental.session.compacting"]({ sessionID: "s1" }, compactOut)
assert.match(compactOut.context.join("\\n"), /Implement plugin hooks/)
assert.match(compactOut.context.join("\\n"), /T1 Progress/)

const addOut = { parts: [] }
await hooks["command.execute.before"]({ command: "add", sessionID: "s1", arguments: "humanizer" }, addOut)
assert.match(addOut.parts.map((part) => part.text).join("\\n"), /alloy add humanizer/)
const planOut = { parts: [] }
await hooks["command.execute.before"]({ command: "plan", sessionID: "s1", arguments: "reset password" }, planOut)
assert.match(planOut.parts.map((part) => part.text).join("\\n"), /alloy-plan/)

const definition = { description: "Run shell commands", parameters: {} }
await hooks["tool.definition"]({ toolID: "bash" }, definition)
assert.match(definition.description, /Alloy gate/)
`)
})

test("gate enforcement blocks unapproved execute and incomplete verify, ticks tdd_red on failure, and claims task lock", async () => {
  await runPluginScenario(`
mkdirSync(join(projectDir, ".alloy", "tasks", "T1"), { recursive: true })
writeFileSync(join(projectDir, ".alloy", "tasks", "T1", "plan.md"), "---\\nid: T1\\napproved: false\\n---\\n# Plan", "utf8")
writeFileSync(join(projectDir, ".alloy", "tasks", "T1", "progress.md"), "# T1\\n\\n## Gate\\n\\n- [ ] tdd_red\\n- [ ] debug\\n- [ ] green\\n- [ ] review\\n- [ ] verified\\n\\n## Findings\\n", "utf8")

// /execute is blocked while the plan is unapproved (code-enforced, not advisory).
await assert.rejects(
  hooks["command.execute.before"]({ command: "execute", sessionID: "s1" }, { parts: [] }),
  /not approved/,
)

// /verify is blocked while tdd_red + green are unchecked.
await assert.rejects(
  hooks["command.execute.before"]({ command: "verify", sessionID: "s1" }, { parts: [] }),
  /cannot verify/,
)

// Approve the plan -> /execute routes normally.
writeFileSync(join(projectDir, ".alloy", "tasks", "T1", "plan.md"), "---\\nid: T1\\napproved: true\\n---\\n# Plan", "utf8")
const execOut = { parts: [] }
await hooks["command.execute.before"]({ command: "execute", sessionID: "s1", arguments: "go" }, execOut)
assert.match(execOut.parts.map((part) => part.text).join("\\n"), /alloy-execute/)

// A FAILED verification command records tdd_red (red half of red-green).
await hooks["tool.execute.after"]({ tool: "bash", sessionID: "s1", callID: "c1", args: { command: "npm test" } }, { title: "bash", output: "fail", metadata: { exitCode: 1 } })
assert.match(readFileSync(join(projectDir, ".alloy", "tasks", "T1", "progress.md"), "utf8"), /\\[x\\] tdd_red/)

// session.start claims the task lock; a competing session is reported as a conflict.
await hooks.event({ event: { type: "session.start", properties: { sessionID: "s1" } } })
assert.ok(existsSync(join(projectDir, ".alloy", "tasks", "T1", ".lock")))
await hooks.event({ event: { type: "session.start", properties: { sessionID: "s2" } } })
assert.match(readFileSync(join(projectDir, ".alloy", "tasks", "T1", "progress.md"), "utf8"), /Lock conflict/)
`)
})

test("ralph-loop records iterations and exposes count for gate checks", async () => {
  await runPluginScenario(`
mkdirSync(join(projectDir, ".alloy", "state"), { recursive: true })

const first = { parts: [] }
await hooks["command.execute.before"]({ command: "ralph-loop", sessionID: "s1", arguments: "--task-id T1" }, first)
assert.match(first.parts.map((part) => part.text).join("\\n"), /ralph-loop/)

const second = { parts: [] }
await hooks["command.execute.before"]({ command: "ralph-loop", sessionID: "s1", arguments: "--task-id T1" }, second)

const progress = readFileSync(join(projectDir, ".alloy", "tasks", "T1", "progress.md"), "utf8")
const rows = progress.match(/^- Iteration \\d+/gm) ?? []
assert.equal(rows.length, 2)
assert.match(progress, /ralph-loop continuation/)
assert.equal(hooks.alloy.getIterationCount("T1"), 2)
assert.ok((await hooks.tool.alloy_gate.execute({ taskId: "T1" })).includes("Ralph Loop iterations: 2/5"))
`)
})
