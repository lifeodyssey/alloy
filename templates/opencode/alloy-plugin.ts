import { type Plugin, tool } from "@opencode-ai/plugin"
import { z } from "zod"
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { randomUUID } from "node:crypto"

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

function appendJsonl(directory: string, name: string, record: Record<string, unknown>) {
  const path = statePath(directory, name)
  mkdirSync(join(alloyDir(directory), "state"), { recursive: true })
  appendFileSync(path, `${JSON.stringify(record)}\n`, "utf8")
}

function readStatus(directory: string) {
  const path = join(alloyDir(directory), "projections", "status.md")
  if (!existsSync(path)) return "Alloy status is not initialized."
  return readFileSync(path, "utf8").slice(0, 4000)
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

export const AlloyPlugin: Plugin = async ({ directory }) => {
  const projectDir = resolve(directory)

  return {
    "shell.env": async (_input, output) => {
      output.env.ALLOY_PROJECT_DIR = projectDir
      output.env.ALLOY_RUN_ID ||= randomUUID()
      output.env.ALLOY_TASK_ID ||= ""
    },

    "chat.message": async (_input, output) => {
      const context = `\n\n## Alloy Workflow Status\n${readStatus(projectDir)}`
      output.parts.push({ type: "text", text: context } as any)
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
    },

    event: async ({ event }) => {
      appendJsonl(projectDir, "runs", {
        id: randomUUID(),
        event: event.type,
        payload: safeEvent(event),
        createdAt: new Date().toISOString(),
      })
    },

    tool: {
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
          return `Run: alloy gate check --task-id ${args.taskId} --json`
        },
      }),
    },
  }
}

export default AlloyPlugin
