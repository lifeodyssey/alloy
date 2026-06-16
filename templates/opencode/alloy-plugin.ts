import { type Plugin, tool } from "@opencode-ai/plugin"
import { z } from "zod"
import { appendFileSync, existsSync, readFileSync, statSync } from "node:fs"
import { join, resolve } from "node:path"
import { createHash, randomUUID } from "node:crypto"
import {
  activeTaskId,
  appendProgressNote,
  checkGate,
  claimTaskLock,
  cleanProgressText,
  clearRunSecrets,
  getIterationCount,
  markProgressGate,
  readCurrentPlan,
  readPlanApproval,
  readStatus,
  readTaskArtifact,
  recordIteration,
  releaseTaskLock,
} from "../lib/alloy-task-state.mjs"

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

const DEFAULT_AGENT = "Planner"

const DEFAULT_MCP: Record<string, JsonRecord> = {
  context7: { type: "remote", url: "https://mcp.context7.com/mcp", enabled: true },
  grep_app: { type: "remote", url: "https://mcp.grep.app", enabled: true },
  exa: { type: "remote", url: "https://mcp.exa.ai/mcp", enabled: true },
  "chrome-devtools": { type: "remote", url: "https://mcp.chrome-devtools.dev/mcp", enabled: false },
  "sequential-thinking": { type: "remote", url: "https://mcp.sequential-thinking.dev/mcp", enabled: true },
  "figma-official": { type: "remote", url: "https://mcp.figma.com/mcp", enabled: true },
  "a11y-mcp": { type: "remote", url: "https://mcp.a11y.dev/mcp", enabled: false },
  "container-use": { type: "remote", url: "https://mcp.container-use.dev/mcp", enabled: false },
}

const COMMAND_SKILLS: Record<string, string> = {
  discuss: "superpowers:brainstorming",
  plan: "alloy-plan",
  execute: "superpowers:subagent-driven-development",
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

function manifestPath(directory: string) {
  return join(directory, ".opencode", "alloy.manifest.json")
}

function opencodeConfigPath(directory: string) {
  return join(directory, ".opencode", "opencode.json")
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
          "The delegated task appears to be in a retry loop. Fall back to a smaller local task, capture the blocker in progress.md, or ask for a narrower handoff before retrying delegation.",
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

function ledgerSummary(directory: string) {
  const status = readStatus(directory)
  return status ? `## Alloy Task Summary\n${status}` : ""
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
        `Route /${command} through the ${skill} skill and update progress.md before closing the task.`,
        command === "ralph-loop" ? "Ralph Loop iteration recorded in the active task progress.md." : "",
        args ? `Request: ${args}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  )
}

function enforceCommandGate(command: string, directory: string) {
  const normalized = normalizeCommand(command)
  if (normalized === "execute") {
    const { taskId, hasPlan, approved } = readPlanApproval(directory)
    if (taskId && hasPlan && !approved) {
      throw new Error(
        `Alloy gate: plan for ${taskId} is not approved. Set 'approved: true' in .alloy/tasks/${taskId}/plan.md (or rerun /plan) before /execute.`,
      )
    }
  }
  if (normalized === "verify") {
    const taskId = activeTaskId(directory)
    if (!taskId) return
    const gate = checkGate(directory, taskId)
    const missing = ["tdd_red", "green"].filter((name) => gate.blockedBy?.includes(name))
    if (missing.length) {
      throw new Error(
        `Alloy gate: ${taskId} cannot verify — ${missing.join(", ")} still unchecked in progress.md. Complete the red→green TDD loop first.`,
      )
    }
  }
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

function rewriteToolDefinition(input: { toolID: string }, output: { description: string }) {
  const toolID = input.toolID.toLowerCase()
  if (!["bash", "write", "edit"].includes(toolID)) return
  const hint =
    toolID === "bash"
      ? " Alloy gate: record meaningful commands in .alloy/tasks/<id>/progress.md and avoid bypassing project safety gates."
      : " Alloy gate: update progress.md for task-relevant file changes and respect manifest-managed files."
  if (!output.description.includes("Alloy gate")) output.description = `${output.description}${hint}`
}

function commandExitCode(output: any) {
  const raw = output?.metadata?.exitCode ?? output?.exitCode
  return typeof raw === "number" ? raw : undefined
}

function isSuccessfulVerificationCommand(command: string) {
  return /\b(test|typecheck|lint|check|pytest|cargo test|go test|bun test|npm test|pnpm test|yarn test)\b/i.test(command)
}

function recordToolExecution(directory: string, input: any, output: any) {
  const taskId = taskIdFromHookInput(input, directory)
  if (!taskId) return

  const toolName = cleanProgressText(input?.tool ?? "tool")
  const command = cleanProgressText(input?.args?.command)
  const exitCode = commandExitCode(output)
  const status = typeof exitCode === "number" ? `exit ${exitCode}` : "exit unknown"

  if (command || ["bash", "edit", "write"].includes(toolName)) {
    appendProgressNote(directory, taskId, "Findings", [
      `- Tool: ${toolName}`,
      command ? `- Command: \`${command}\`` : "",
      `- Result: ${status}`,
    ])
  }

  // RED proof: a verification command that FAILS records tdd_red (red half of red-green).
  if (command && isSuccessfulVerificationCommand(command) && typeof exitCode === "number" && exitCode !== 0) {
    markProgressGate(directory, taskId, "tdd_red", command)
  }

  if (exitCode !== 0 || !command) return
  if (/^git\s+commit\b/i.test(command)) markProgressGate(directory, taskId, "commit", command)
  if (isSuccessfulVerificationCommand(command)) {
    markProgressGate(directory, taskId, "green", command)
    markProgressGate(directory, taskId, "verified", command)
  }
}

export const AlloyPlugin: Plugin = async ({ directory }) => {
  const projectDir = resolve(directory)
  let bootWarnings: string[] = []
  let bootWarningsChecked = false
  let bootWarningsEmitted = false
  let phaseReminderCount = 0
  // Per-session run id captured in shell.env so session.end can clear the right secret dir
  // without depending on process.env (which the plugin process may not inherit).
  const runIdBySession = new Map<string, string>()

  async function ensureBootWarnings() {
    if (bootWarningsChecked) return
    bootWarnings = await detectMagicWarnings(projectDir)
    bootWarningsChecked = true
  }

  return {
    config: async (config) => {
      if (!config) return
      injectConfigDefaults(config)
      bootWarnings = await detectMagicWarnings(projectDir)
      bootWarningsChecked = true
      bootWarningsEmitted = false
    },

    "shell.env": async (input, output) => {
      output.env.ALLOY_PROJECT_DIR = projectDir
      const sessionId = (input as any)?.sessionID
      const runId = (sessionId && runIdBySession.get(String(sessionId))) || output.env.ALLOY_RUN_ID || randomUUID()
      output.env.ALLOY_RUN_ID = runId
      if (sessionId) runIdBySession.set(String(sessionId), runId)
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
      const taskId = taskIdFromHookInput(input, projectDir)
      if (!taskId) return
      appendProgressNote(projectDir, taskId, "Findings", [`- Permission requested: ${cleanProgressText(input?.id ?? input?.tool ?? "unknown")}`])
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
      recordToolExecution(projectDir, input, output)
      if (isRalphLoopToolExecution(input, output)) recordIteration(projectDir, taskIdFromHookInput(input, projectDir))
    },

    event: async ({ event }) => {
      const type = String(event?.type ?? "").toLowerCase()
      const taskId = activeTaskId(projectDir)
      if (type.includes("session")) {
        const sessionId = safeEvent(event).sessionID
        if ((type.includes("start") || type.includes("created")) && taskId && sessionId) {
          const claim = claimTaskLock(projectDir, taskId, String(sessionId))
          if (!claim.ok) {
            appendProgressNote(projectDir, taskId, "Findings", [
              `- Lock conflict: session ${claim.owner} already owns ${taskId} (age ${Math.round((claim.ageMs ?? 0) / 1000)}s). Close it or switch task.`,
            ])
          }
        }
        if (type.includes("end") || type.includes("idle") || type.includes("delete")) {
          const runId = (sessionId && runIdBySession.get(String(sessionId))) || process.env.ALLOY_RUN_ID
          clearRunSecrets(projectDir, runId)
          if (sessionId) runIdBySession.delete(String(sessionId))
          if (taskId && sessionId) releaseTaskLock(projectDir, taskId, String(sessionId))
        }
        return
      }
      if (!taskId || !type.includes("phase")) return
      appendProgressNote(projectDir, taskId, "Handoff", [`- Event: ${cleanProgressText(safeEvent(event).type)}`])
    },

    "experimental.chat.messages.transform": async (input, output) => {
      if (!output || !Array.isArray(output.messages)) return
      await filterAvailableSkills(projectDir, input, output)
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
      enforceCommandGate(input.command, projectDir)
      routeCommand(input, output, projectDir)
    },

    "tool.definition": async (input, output) => {
      rewriteToolDefinition(input, output)
    },

    tool: {
      alloy_progress: tool({
        description: "Append a note or gate update to .alloy/tasks/<id>/progress.md.",
        args: {
          taskId: tool.schema.string().optional(),
          section: tool.schema.string().optional(),
          gate: tool.schema.string().optional(),
          status: tool.schema.string().optional(),
          summary: tool.schema.string(),
          detail: tool.schema.string().optional(),
          command: tool.schema.string().optional(),
        },
        async execute(args) {
          const taskId = args.taskId ?? activeTaskId(projectDir)
          if (!taskId) throw new Error("No active Alloy task. Pass taskId or create .alloy/tasks/<id> first.")
          const summary = cleanProgressText(args.summary)
          const detail = cleanProgressText(args.detail)
          const command = cleanProgressText(args.command)
          if (args.gate) {
            markProgressGate(projectDir, taskId, cleanProgressText(args.gate), [summary, detail, command].filter(Boolean).join(" | "), args.status !== "unchecked")
          } else {
            appendProgressNote(projectDir, taskId, args.section ?? "Findings", [
              `- Summary: ${summary}`,
              detail ? `- Detail: ${detail}` : "",
              command ? `- Command: \`${command}\`` : "",
            ])
          }
          return readTaskArtifact(projectDir, taskId, "progress.md", 6000)
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
