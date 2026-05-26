import { type Plugin, tool } from "@opencode-ai/plugin"
import { z } from "zod"
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs"
import { join, resolve } from "node:path"
import { createHash, randomUUID } from "node:crypto"

interface AlloyManifest {
  version: string
  installedAt: string
  pack: string
  models: string
  managed: { skills: string[]; agents: string[]; commands: string[]; mcp: string[] }
  visible: { skills: string[]; agents: string[] }
  explicit: { added: string[] }
  excluded: string[]
}

type TextPart = {
  type: "text"
  text: string
}

type JsonRecord = Record<string, unknown>

interface PresetSpec {
  agents: string[]
  skills_visible: string[] | "all"
  mcps_enabled: string[] | "all"
}

interface PresetsDef {
  presets: Record<string, PresetSpec>
}

const DEFAULT_AGENT = "Orchestrator"

// === OMO preset hot-swap (Task 9) ===
let activePreset = "default"
let presetsDef: PresetsDef | null = null

const FALLBACK_PRESETS: PresetsDef = {
  presets: {
    default: { agents: [], skills_visible: "all", mcps_enabled: "all" },
  },
}

const DEFAULT_MCP: Record<string, JsonRecord> = {
  context7: { type: "remote", url: "https://mcp.context7.com/mcp", enabled: true },
  grep_app: { type: "remote", url: "https://mcp.grep.app", enabled: true },
  exa: { type: "remote", url: "https://mcp.exa.ai/mcp", enabled: true },
  "chrome-devtools": { type: "remote", url: "https://mcp.chrome-devtools.dev/mcp", enabled: false },
  "sequential-thinking": { type: "remote", url: "https://mcp.sequential-thinking.dev/mcp", enabled: false },
  "figma-official": { type: "remote", url: "https://mcp.figma.com/mcp", enabled: false },
  "a11y-mcp": { type: "remote", url: "https://mcp.a11y.dev/mcp", enabled: false },
  "container-use": { type: "remote", url: "https://mcp.container-use.dev/mcp", enabled: false },
}

const COMMAND_SKILLS: Record<string, string> = {
  plan: "alloy-plan",
  execute: "alloy-execute",
  verify: "alloy-verify",
  autopilot: "alloy-autopilot",
  "ralph-loop": "ralph-loop",
}

const recordSchema = z.object({
  taskId: z.string().optional(),
  kind: z.string().default("note"),
  source: z.string().default("plugin"),
  summary: z.string().default(""),
  command: z.string().optional(),
  exitCode: z.number().optional(),
  paths: z.array(z.string()).default([]),
})

function alloyDir(directory: string) {
  return join(directory, ".alloy")
}

function statePath(directory: string, name: string) {
  return join(alloyDir(directory), "state", `${name}.jsonl`)
}

function manifestPath(directory: string) {
  return join(directory, ".opencode", "alloy.manifest.json")
}

function opencodeConfigPath(directory: string) {
  return join(directory, ".opencode", "opencode.json")
}

function appendJsonl(directory: string, name: string, record: Record<string, unknown>) {
  const path = statePath(directory, name)
  mkdirSync(join(alloyDir(directory), "state"), { recursive: true })
  appendFileSync(path, `${JSON.stringify(record)}\n`, "utf8")
}

function loadPresets(directory: string): PresetsDef {
  if (presetsDef) return presetsDef
  const path = join(directory, ".opencode", "presets.json")
  if (!existsSync(path)) return FALLBACK_PRESETS
  presetsDef = JSON.parse(readFileSync(path, "utf8")) as PresetsDef
  return presetsDef
}

function getActivePreset(directory: string): PresetSpec {
  const defs = loadPresets(directory)
  return defs.presets[activePreset] ?? defs.presets.default ?? FALLBACK_PRESETS.presets.default
}

function applyPreset(directory: string, name: string): boolean {
  const defs = loadPresets(directory)
  if (!defs.presets[name]) return false
  const prev = activePreset
  activePreset = name
  appendJsonl(directory, "preset", {
    id: randomUUID(),
    event: "preset_changed",
    from: prev,
    to: name,
    ts: new Date().toISOString(),
  })
  return true
}

function readStatus(directory: string) {
  const path = join(alloyDir(directory), "projections", "status.md")
  if (!existsSync(path)) return "Alloy status is not initialized."
  return readFileSync(path, "utf8").slice(0, 4000)
}

function readCurrentPlan(directory: string) {
  const path = join(alloyDir(directory), "projections", "current-plan.md")
  if (!existsSync(path)) return ""
  return readFileSync(path, "utf8").slice(0, 2400).trim()
}

function activeTaskId(directory: string) {
  const path = join(alloyDir(directory), "state", "tasks.jsonl")
  if (!existsSync(path)) return undefined
  const lines = readFileSync(path, "utf8").trim().split(/\r?\n/).filter(Boolean)
  for (const line of lines.reverse()) {
    try {
      const task = JSON.parse(line)
      if (!["closed", "done"].includes(task.status)) return task.id
    } catch {
      // Ignore malformed ledger rows rather than breaking tool execution.
    }
  }
  return undefined
}

function safeEvent(event: any) {
  return {
    type: String(event?.type ?? "unknown"),
    sessionID: event?.properties?.sessionID ?? event?.sessionID,
    messageID: event?.properties?.messageID ?? event?.messageID,
    tool: event?.properties?.tool ?? event?.tool,
  }
}

async function readJsonFile<T>(path: string): Promise<T | undefined> {
  if (!existsSync(path)) return undefined
  try {
    const bun = (globalThis as any).Bun
    if (bun?.file) return (await bun.file(path).json()) as T
    return JSON.parse(readFileSync(path, "utf8")) as T
  } catch {
    return undefined
  }
}

async function readManifest(directory: string) {
  return readJsonFile<AlloyManifest>(manifestPath(directory))
}

function homeDir() {
  return process.env.HOME || process.env.USERPROFILE || ""
}

function globalStatePath() {
  return join(homeDir(), ".config", "alloy", "state.json")
}

function vendorLockPath(directory: string) {
  const path = join(directory, "vendor.lock.json")
  if (existsSync(path)) return path
  return undefined
}

function sha256File(path: string) {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

async function detectMagicWarnings(directory: string) {
  const warnings: string[] = []
  const manifest = await readManifest(directory)
  const vendorLock = vendorLockPath(directory)

  if (!manifest && existsSync(opencodeConfigPath(directory))) {
    warnings.push("Alloy warning: Run alloy install to create manifest.")
  }

  if (manifest && vendorLock) {
    const installedAt = Date.parse(manifest.installedAt)
    const vendorMtime = statSync(vendorLock).mtimeMs
    if (!Number.isNaN(installedAt) && vendorMtime > installedAt) {
      warnings.push("Alloy warning: manifest stale, run alloy upgrade.")
    }
  }

  const state = await readJsonFile<{ lastSyncedVendorLock?: string }>(globalStatePath())
  if (state?.lastSyncedVendorLock && vendorLock) {
    const currentSha = sha256File(vendorLock)
    if (state.lastSyncedVendorLock !== currentSha) {
      warnings.push("Alloy warning: global state stale, run alloy install --target global.")
    }
  }

  return warnings
}

function injectConfigDefaults(config: any) {
  config.default_agent ||= DEFAULT_AGENT
  config.mcp ||= {}
  for (const [name, value] of Object.entries(DEFAULT_MCP)) {
    config.mcp[name] ||= { ...value }
  }
}

function textPart(text: string): TextPart {
  return { type: "text", text }
}

function messageText(message: any) {
  if (!message) return ""
  if (typeof message === "string") return message
  if (typeof message.content === "string") return message.content
  if (typeof message.text === "string") return message.text
  if (Array.isArray(message.parts)) {
    return message.parts.map((part: any) => part?.text ?? part?.content ?? "").join("\n")
  }
  return ""
}

function maybeDelegateTaskRetry(input: any, output: { parts: any[] }) {
  const text = `${messageText(input?.message)}\n${messageText(output?.message)}`.toLowerCase()
  if (!text.includes("delegate")) return
  if (!/(retry|again|failed|failure|timeout|timed out|stuck|exhausted|twice|second attempt)/.test(text)) return
  output.parts.push(
    textPart(
      [
        "## Alloy Delegate Fallback",
        "The delegated task appears to be in a retry loop. Fall back to a smaller local task, capture the blocker in evidence, or ask for a narrower handoff before retrying delegation.",
      ].join("\n"),
    ),
  )
}

function maybePhaseReminder(directory: string, output: { parts: any[] }, count: number) {
  if (count % 3 !== 1) return
  const currentPlan = readCurrentPlan(directory)
  if (!currentPlan) return
  output.parts.push(textPart(`## Alloy Phase Reminder\n${currentPlan}`))
}

function stripJsonFence(text: string) {
  const trimmed = text.trim()
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return match ? match[1].trim() : trimmed
}

function balancedJsonCandidate(text: string) {
  let candidate = stripJsonFence(text)
  const firstObject = candidate.search(/[\[{]/)
  if (firstObject > 0) candidate = candidate.slice(firstObject)
  candidate = candidate.replace(/,\s*([}\]])/g, "$1").trim()

  const stack: string[] = []
  let inString = false
  let escaped = false
  for (const char of candidate) {
    if (escaped) {
      escaped = false
      continue
    }
    if (char === "\\") {
      escaped = true
      continue
    }
    if (char === "\"") {
      inString = !inString
      continue
    }
    if (inString) continue
    if (char === "{") stack.push("}")
    if (char === "[") stack.push("]")
    if ((char === "}" || char === "]") && stack.at(-1) === char) stack.pop()
  }
  if (inString) candidate += "\""
  return candidate + stack.reverse().join("")
}

function recoverMalformedJson(text: string) {
  if (!text.trim()) return undefined
  try {
    JSON.parse(text)
    return undefined
  } catch {
    // Continue into repair.
  }

  const candidate = balancedJsonCandidate(text)
  try {
    JSON.parse(candidate)
    return candidate
  } catch {
    return undefined
  }
}

function maybeRecoverToolJson(output: any) {
  if (typeof output?.output !== "string") return
  const repaired = recoverMalformedJson(output.output)
  if (repaired) {
    output.output = repaired
    output.metadata ||= {}
    output.metadata.alloyJsonRecovered = true
  }
}

function parseJsonlLine(line: string) {
  try {
    return JSON.parse(line)
  } catch {
    return undefined
  }
}

function readJsonl(directory: string, name: string, limit = 5) {
  const path = statePath(directory, name)
  if (!existsSync(path)) return []
  return readFileSync(path, "utf8")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map(parseJsonlLine)
    .filter(Boolean)
    .slice(-limit)
}

function readAllJsonl(directory: string, name: string) {
  const path = statePath(directory, name)
  if (!existsSync(path)) return []
  return readFileSync(path, "utf8")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map(parseJsonlLine)
    .filter(Boolean)
}

function getIterationCount(directory: string, taskId: string) {
  return readAllJsonl(directory, "iteration").filter((row: any) => row.taskId === taskId).length
}

function recordIteration(directory: string, taskId?: string) {
  if (!taskId) return undefined
  const record = {
    taskId,
    iter: getIterationCount(directory, taskId) + 1,
    ts: new Date().toISOString(),
  }
  appendJsonl(directory, "iteration", record)
  return record
}

function summarizeRecord(record: any) {
  const id = record.id ? `[${record.id}] ` : ""
  const status = record.status ? ` (${record.status})` : ""
  const summary = record.title ?? record.summary ?? record.text ?? record.kind ?? "record"
  return `- ${id}${summary}${status}`
}

function ledgerSummary(directory: string) {
  const sections: string[] = []
  const currentPlan = readCurrentPlan(directory)
  if (currentPlan) sections.push(`### Current Plan\n${currentPlan}`)

  const activeTasks = readJsonl(directory, "tasks", 8).filter((task: any) => !["closed", "done"].includes(task.status))
  if (activeTasks.length) sections.push(`### Active Tasks\n${activeTasks.map(summarizeRecord).join("\n")}`)

  const evidence = readJsonl(directory, "evidence", 8)
  if (evidence.length) sections.push(`### Recent Evidence\n${evidence.map(summarizeRecord).join("\n")}`)

  const claims = readJsonl(directory, "claims", 8)
  if (claims.length) sections.push(`### Recent Claims\n${claims.map(summarizeRecord).join("\n")}`)

  return sections.length ? `## Alloy Ledger Summary\n${sections.join("\n\n")}` : ""
}

function normalizeCommand(command: string) {
  return command.trim().replace(/^\//, "").toLowerCase()
}

function shellQuote(value: string) {
  if (/^[A-Za-z0-9_./:@+-]+$/.test(value)) return value
  return `'${value.replace(/'/g, "'\\''")}'`
}

function taskIdFromText(text: string) {
  const match = text.match(/(?:--task-id\s+|taskId\s*[:=]\s*)([A-Za-z0-9_.:-]+)/i)
  return match?.[1]
}

function taskIdFromHookInput(input: any, directory: string) {
  return (
    input?.taskId ??
    input?.args?.taskId ??
    input?.properties?.taskId ??
    taskIdFromText(String(input?.arguments ?? input?.args?.command ?? input?.args?.input ?? "")) ??
    activeTaskId(directory)
  )
}

function isIterationEvent(event: any) {
  return String(event?.type ?? "").toLowerCase().includes("iteration")
}

function isRalphLoopToolExecution(input: any, output: any) {
  const haystack = [
    input?.tool,
    input?.args?.skill,
    input?.args?.name,
    input?.args?.command,
    input?.args?.input,
    output?.title,
    output?.output,
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase()
  return haystack.includes("ralph-loop")
}

function routeCommand(input: { command: string; arguments?: string }, output: { parts: any[] }, directory: string) {
  const command = normalizeCommand(input.command)
  const args = String(input.arguments ?? "").trim()
  if (command === "add") {
    const alloyCommand = ["alloy", "add", ...args.split(/\s+/).filter(Boolean).map(shellQuote)].join(" ")
    output.parts.push(
      textPart(
        [
          "## Alloy Command Intercept",
          "Run this through the Bash tool, then continue with the refreshed manifest on the next message:",
          "",
          "```bash",
          alloyCommand,
          "```",
        ].join("\n"),
      ),
    )
    return
  }

  const skill = COMMAND_SKILLS[command]
  if (!skill) return
  if (command === "ralph-loop") recordIteration(directory, taskIdFromHookInput(input, directory))
  output.parts.push(
    textPart(
      [
        "## Alloy Command Intercept",
        `Route /${command} through the ${skill} skill and record phase evidence before closing the task.`,
        command === "ralph-loop" ? "Ralph Loop iteration recorded in .alloy/state/iteration.jsonl." : "",
        args ? `Request: ${args}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  )
}

function skillNameFromLine(line: string) {
  const trimmed = line.trim()
  const nameAttr = trimmed.match(/\bname=["']([^"']+)["']/i)
  if (nameAttr) return nameAttr[1]
  const bullet = trimmed.match(/^[-*]\s*`?([A-Za-z0-9_.-]+)`?(?:\s*[:(-]|$)/)
  if (bullet) return bullet[1]
  const heading = trimmed.match(/^#+\s*`?([A-Za-z0-9_.-]+)`?(?:\s*[:(-]|$)/)
  if (heading) return heading[1]
  const keyed = trimmed.match(/^`?([A-Za-z0-9_.-]+)`?\s*:/)
  if (keyed) return keyed[1]
  return undefined
}

function shouldKeepSkillLine(line: string, visibleSkills: Set<string>, managedSkills: Set<string>) {
  const name = skillNameFromLine(line)
  if (!name) return true
  if (visibleSkills.has(name)) return true
  if (managedSkills.has(name)) return false
  return true
}

function shouldKeepPresetSkillLine(line: string, presetSkills: Set<string>) {
  const name = skillNameFromLine(line)
  if (!name) return true
  return presetSkills.has(name)
}

function filterAvailableSkillsBlock(text: string, manifest: AlloyManifest, agent?: string) {
  const visibleAgents = new Set(manifest.visible?.agents ?? [])
  const agentCanSeeSkills = !agent || visibleAgents.size === 0 || visibleAgents.has(agent)
  const visibleSkills = new Set(agentCanSeeSkills ? manifest.visible?.skills ?? [] : [])
  const managedSkills = new Set(manifest.managed?.skills ?? [])
  if (managedSkills.size === 0) return text

  return text.replace(/<available_skills>([\s\S]*?)<\/available_skills>/gi, (_match, body: string) => {
    const lines = body.split(/\r?\n/)
    const filtered = lines.filter((line) => shouldKeepSkillLine(line, visibleSkills, managedSkills))
    return `<available_skills>${filtered.join("\n")}</available_skills>`
  })
}

function filterPresetSkillsBlock(text: string, preset: PresetSpec) {
  if (preset.skills_visible === "all") return text
  const presetSkills = new Set(preset.skills_visible)

  return text.replace(/<available_skills>([\s\S]*?)<\/available_skills>/gi, (_match, body: string) => {
    const lines = body.split(/\r?\n/)
    const filtered = lines.filter((line) => shouldKeepPresetSkillLine(line, presetSkills))
    return `<available_skills>${filtered.join("\n")}</available_skills>`
  })
}

function mutateTextParts(target: any, transform: (text: string) => string) {
  if (typeof target?.text === "string") target.text = transform(target.text)
  if (typeof target?.content === "string") target.content = transform(target.content)
  if (!Array.isArray(target?.parts)) return
  for (const part of target.parts) {
    if (part?.type === "text" && typeof part.text === "string") part.text = transform(part.text)
  }
}

async function filterAvailableSkills(directory: string, input: any, output: { messages: any[] }) {
  const manifest = await readManifest(directory)
  if (!manifest) return
  for (const message of output.messages ?? []) {
    mutateTextParts(message, (text) => filterAvailableSkillsBlock(text, manifest, input?.agent))
  }
}

function filterByPreset(directory: string, _input: any, output: { messages: any[] }) {
  const preset = getActivePreset(directory)
  if (preset.skills_visible === "all") return
  for (const message of output.messages ?? []) {
    if (message?.role !== "system") continue
    mutateTextParts(message, (text) => filterPresetSkillsBlock(text, preset))
  }
}

function rewriteToolDefinition(input: { toolID: string }, output: { description: string }) {
  const toolID = input.toolID.toLowerCase()
  if (!["bash", "write", "edit"].includes(toolID)) return
  const hint =
    toolID === "bash"
      ? " Alloy gate: record meaningful commands as evidence and avoid bypassing project safety gates."
      : " Alloy gate: update evidence/claims for task-relevant file changes and respect manifest-managed files."
  if (!output.description.includes("Alloy gate")) output.description = `${output.description}${hint}`
}

export const AlloyPlugin: Plugin = async ({ directory }) => {
  const projectDir = resolve(directory)
  let bootWarnings: string[] = []
  let bootWarningsChecked = false
  let bootWarningsEmitted = false
  let phaseReminderCount = 0

  async function ensureBootWarnings() {
    if (bootWarningsChecked) return
    bootWarnings = await detectMagicWarnings(projectDir)
    bootWarningsChecked = true
  }

  return {
    config: async (config) => {
      if (!config) return
      injectConfigDefaults(config)
      loadPresets(projectDir)
      bootWarnings = await detectMagicWarnings(projectDir)
      bootWarningsChecked = true
      bootWarningsEmitted = false
    },

    "shell.env": async (_input, output) => {
      output.env.ALLOY_PROJECT_DIR = projectDir
      output.env.ALLOY_RUN_ID ||= randomUUID()
      output.env.ALLOY_TASK_ID ||= ""
    },

    "chat.message": async (input, output) => {
      await ensureBootWarnings()
      if (bootWarnings.length && !bootWarningsEmitted) {
        output.parts.push(textPart(`## Alloy Startup Warnings\n${bootWarnings.map((warning) => `- ${warning}`).join("\n")}`))
        bootWarningsEmitted = true
      }
      const context = `\n\n## Alloy Workflow Status\n${readStatus(projectDir)}`
      output.parts.push({ type: "text", text: context } as any)
      maybeDelegateTaskRetry({ ...input, message: output.message }, output)
      phaseReminderCount += 1
      maybePhaseReminder(projectDir, output, phaseReminderCount)
    },

    "permission.ask": async (input) => {
      appendJsonl(projectDir, "runs", {
        id: randomUUID(),
        event: "permission.ask",
        payload: input,
        createdAt: new Date().toISOString(),
      })
    },

    "tool.execute.before": async (input, output) => {
      const args = output.args ?? {}
      // Dangerous-command interception delegated to cc-safety-net plugin (kenryu42/claude-code-safety-net, MIT)
      if ((input.tool === "read" || input.tool === "edit") && String(args.filePath ?? "").includes(".env")) {
        throw new Error("Alloy blocks direct .env file access")
      }
    },

    "tool.execute.after": async (input, output) => {
      maybeRecoverToolJson(output)
      appendJsonl(projectDir, "evidence", {
        id: randomUUID(),
        taskId: activeTaskId(projectDir),
        kind: input.tool === "bash" ? "command" : "tool",
        source: "opencode-plugin",
        summary: `${input.tool} executed`,
        command: input.args?.command,
        exitCode: output?.metadata?.exitCode,
        paths: [],
        createdAt: new Date().toISOString(),
      })
      if (isRalphLoopToolExecution(input, output)) recordIteration(projectDir, taskIdFromHookInput(input, projectDir))
    },

    event: async ({ event }) => {
      appendJsonl(projectDir, "runs", {
        id: randomUUID(),
        event: event.type,
        payload: safeEvent(event),
        createdAt: new Date().toISOString(),
      })
      if (isIterationEvent(event)) recordIteration(projectDir, taskIdFromHookInput(event, projectDir))
    },

    "experimental.chat.messages.transform": async (input, output) => {
      if (!output || !Array.isArray(output.messages)) return
      await filterAvailableSkills(projectDir, input, output)
      filterByPreset(projectDir, input, output)
    },

    "experimental.chat.system.transform": async (_input, output) => {
      if (!output || !Array.isArray(output.system)) return
      output.system.push(`## Alloy Workflow Status\n${readStatus(projectDir)}`)
    },

    "experimental.session.compacting": async (_input, output) => {
      if (!output || !Array.isArray(output.context)) return
      const summary = ledgerSummary(projectDir)
      if (summary) output.context.push(summary)
    },

    "command.execute.before": async (input, output) => {
      if (!input?.command || !output || !Array.isArray(output.parts)) return
      routeCommand(input, output, projectDir)
    },

    "tool.definition": async (input, output) => {
      rewriteToolDefinition(input, output)
    },

    tool: {
      alloy_switch_preset: tool({
        description: "Switch the active Alloy preset (plan-mode / execute-mode / review-mode / default) without restarting session.",
        args: {
          preset: tool.schema.string(),
        },
        async execute(args) {
          const ok = applyPreset(projectDir, args.preset)
          return ok
            ? `Preset switched to ${args.preset}. Skills/agents/MCPs hot-reloaded.`
            : `Unknown preset: ${args.preset}. Available: ${Object.keys(loadPresets(projectDir).presets).join(", ")}`
        },
      }),

      alloy_evidence: tool({
        description: "Record Alloy workflow evidence for the current task.",
        args: {
          taskId: tool.schema.string().optional(),
          kind: tool.schema.string(),
          summary: tool.schema.string(),
          command: tool.schema.string().optional(),
        },
        async execute(args) {
          const parsed = recordSchema.parse(args)
          const record = { id: randomUUID(), ...parsed, createdAt: new Date().toISOString() }
          appendJsonl(projectDir, "evidence", record)
          return JSON.stringify(record)
        },
      }),

      alloy_claim: tool({
        description: "Record an Alloy completion claim.",
        args: {
          taskId: tool.schema.string(),
          text: tool.schema.string(),
          evidenceIds: tool.schema.array(tool.schema.string()).optional(),
        },
        async execute(args) {
          const record = {
            id: randomUUID(),
            taskId: args.taskId,
            text: args.text,
            status: args.evidenceIds?.length ? "verified" : "unverified",
            evidenceIds: args.evidenceIds ?? [],
            createdAt: new Date().toISOString(),
          }
          appendJsonl(projectDir, "claims", record)
          return JSON.stringify(record)
        },
      }),

      alloy_state: tool({
        description: "Read the compact Alloy workflow status.",
        args: {},
        async execute() {
          return readStatus(projectDir)
        },
      }),

      alloy_gate: tool({
        description: "Ask Alloy to check whether the current task can close.",
        args: {
          taskId: tool.schema.string(),
        },
        async execute(args) {
          const iterations = getIterationCount(projectDir, args.taskId)
          const capHint = iterations >= 5 ? "Ralph Loop iteration cap reached; escalate before retrying." : `Ralph Loop iterations: ${iterations}/5`
          return `Run: alloy gate check --task-id ${args.taskId} --json\n${capHint}`
        },
      }),
    },

    alloy: {
      getIterationCount(taskId: string) {
        return getIterationCount(projectDir, taskId)
      },
    },
  }
}

export default AlloyPlugin
