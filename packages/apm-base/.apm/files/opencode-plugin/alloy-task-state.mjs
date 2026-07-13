import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { join, relative } from "node:path"

const DEFAULT_LOCK_STALE_MS = 30 * 60 * 1000

export function alloyDir(directory) {
  return join(directory, ".alloy")
}

export function taskDir(directory, taskId) {
  return join(alloyDir(directory), "tasks", taskId)
}

export function progressPath(directory, taskId) {
  return join(taskDir(directory, taskId), "progress.md")
}

export function cleanProgressText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
}

export function ensureTaskProgress(directory, taskId) {
  const path = progressPath(directory, taskId)
  mkdirSync(taskDir(directory, taskId), { recursive: true })
  if (!existsSync(path)) {
    writeFileSync(
      path,
      [
        `# ${taskId}: Progress`,
        "",
        "## Gate",
        "",
        "- [ ] tdd_red",
        "- [ ] debug",
        "- [ ] green",
        "- [ ] review",
        "- [ ] verified",
        "",
        "## Iterations",
        "",
        "## Findings",
        "",
        "## Handoff",
        "",
      ].join("\n"),
      "utf8",
    )
  }
  return path
}

export function ensureAlloyMarkdownRoot(directory) {
  const dir = alloyDir(directory)
  mkdirSync(join(dir, "tasks"), { recursive: true })
  const ignorePath = join(dir, ".gitignore")
  if (!existsSync(ignorePath)) writeFileSync(ignorePath, "run/\n*.lock\ntasks/*/scratch.md\n", "utf8")
  return dir
}

export function ensureMarkdownSection(content, section) {
  const pattern = new RegExp(`^## ${escapeRegExp(section)}\\s*$`, "m")
  if (pattern.test(content)) return content
  return `${content.trimEnd()}\n\n## ${section}\n`
}

export function appendToMarkdownSection(content, section, text) {
  const withSection = ensureMarkdownSection(content, section)
  const lines = withSection.split(/\r?\n/)
  const heading = `## ${section}`
  const start = lines.findIndex((line) => line.trim() === heading)
  if (start === -1) return `${withSection.trimEnd()}\n\n${heading}\n${text.trimEnd()}\n`
  const next = lines.findIndex((line, index) => index > start && line.startsWith("## "))
  const end = next === -1 ? lines.length : next
  const before = lines.slice(0, end)
  const after = lines.slice(end)
  return [...before, text.trimEnd(), ...after].join("\n").trimEnd() + "\n"
}

export function appendProgressNote(directory, taskId, section, lines) {
  const path = ensureTaskProgress(directory, taskId)
  const body = [`### ${section} - ${new Date().toISOString()}`, ...lines.filter(Boolean).map(cleanProgressText)].join("\n")
  if (!body) return path
  const content = readFileSync(path, "utf8")
  writeFileSync(path, appendToMarkdownSection(content, section, body), "utf8")
  return path
}

export function markProgressGate(directory, taskId, gate, note, checked = true) {
  const path = ensureTaskProgress(directory, taskId)
  const mark = checked ? "x" : " "
  const gateName = cleanProgressText(gate)
  const line = `- [${mark}] ${gateName} - ${new Date().toISOString()} | ${cleanProgressText(note)}`
  const content = ensureMarkdownSection(readFileSync(path, "utf8"), "Gate")
  const lines = content.split(/\r?\n/)
  const gateIndex = lines.findIndex((item) => item.trim() === "## Gate")
  const nextHeading = lines.findIndex((item, index) => index > gateIndex && item.startsWith("## "))
  const end = nextHeading === -1 ? lines.length : nextHeading
  const existing = lines.findIndex((item, index) => index > gateIndex && index < end && new RegExp(`^- \\[[ xX]\\] ${escapeRegExp(gateName)}(?:\\b.*)?$`).test(item))
  if (existing !== -1) lines[existing] = line
  else lines.splice(end, 0, line)
  writeFileSync(path, lines.join("\n"), "utf8")
  return path
}

export function activeTaskId(directory, envTaskId = process.env.ALLOY_TASK_ID) {
  const envTask = envTaskId?.trim()
  if (envTask) return envTask
  const dir = join(alloyDir(directory), "tasks")
  if (!existsSync(dir)) return undefined
  const candidates = readdirSync(dir)
    .filter((name) => !name.startsWith("."))
    .map((name) => {
      const dirPath = join(dir, name)
      const hasArtifact = existsSync(join(dirPath, "plan.md")) || existsSync(join(dirPath, "progress.md"))
      if (!hasArtifact) return undefined
      return { name, mtime: statSync(dirPath).mtimeMs }
    })
    .filter(Boolean)
  candidates.sort((a, b) => b.mtime - a.mtime || a.name.localeCompare(b.name))
  return candidates[0]?.name
}

export function readTaskArtifact(directory, taskId, file, limit = Number.POSITIVE_INFINITY) {
  const path = join(taskDir(directory, taskId), file)
  if (!existsSync(path)) return ""
  return readFileSync(path, "utf8").slice(0, limit).trim()
}

export function readCurrentPlan(directory) {
  const taskId = activeTaskId(directory)
  if (!taskId) return ""
  return readTaskArtifact(directory, taskId, "plan.md", 2400).trim()
}

export function readStatus(directory) {
  const taskId = activeTaskId(directory)
  if (!taskId) return "No active Alloy task. Pass taskId or create `.alloy/tasks/<id>`."
  const plan = readTaskArtifact(directory, taskId, "plan.md", 3000)
  const progress = readTaskArtifact(directory, taskId, "progress.md", 3000)
  return [
    `Active task: ${taskId}`,
    plan ? `<alloy-plan>\n${plan}\n</alloy-plan>` : "No plan.md found for active task.",
    progress ? `<alloy-progress>\n${progress}\n</alloy-progress>` : "No progress.md found for active task.",
  ].join("\n\n")
}

export function getIterationCount(directory, taskId = activeTaskId(directory)) {
  if (!taskId) return 0
  const progress = readTaskArtifact(directory, taskId, "progress.md", 20000)
  return (progress.match(/(?:^- Iteration \d+\b|Ralph Loop iteration:)/gm) ?? []).length
}

export function recordIteration(directory, taskId = activeTaskId(directory)) {
  if (!taskId) return { taskId, iter: 0 }
  const iter = getIterationCount(directory, taskId) + 1
  appendProgressNote(directory, taskId, "Iterations", [`- Iteration ${iter}: ralph-loop continuation`])
  return { taskId, iter }
}

export function listMarkdownTasks(directory) {
  const tasksDir = join(alloyDir(directory), "tasks")
  if (!existsSync(tasksDir)) return []
  return readdirSync(tasksDir)
    .filter((name) => !name.startsWith("."))
    .filter((name) => existsSync(join(tasksDir, name)))
    .sort()
}

export function checkGate(directory, taskId) {
  const path = progressPath(directory, taskId)
  if (!existsSync(path)) {
    return {
      ok: false,
      taskId,
      progressPath: relative(directory, path),
      blockedBy: ["progress.md"],
      checks: [{ name: "progress", ok: false, message: `Missing progress.md for task: ${taskId}` }],
    }
  }

  const content = readFileSync(path, "utf8")
  const gateHeading = content.match(/^## Gate\s*$/m)
  if (!gateHeading) {
    return {
      ok: false,
      taskId,
      progressPath: relative(directory, path),
      blockedBy: ["Gate"],
      checks: [{ name: "Gate", ok: false, message: "progress.md must contain a ## Gate section" }],
    }
  }

  const afterGate = content.slice(gateHeading.index + gateHeading[0].length)
  const nextHeading = afterGate.search(/\n## /)
  const gateBlock = nextHeading === -1 ? afterGate : afterGate.slice(0, nextHeading)
  const checks = gateBlock
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*-\s+\[([ xX])\]\s+(.+?)\s*$/))
    .filter(Boolean)
    .map((match) => {
      const name = normalizeGateName(match[2])
      const ok = match[1].toLowerCase() === "x"
      return {
        name,
        ok,
        message: ok ? `${name} checked` : `${name} is unchecked`,
      }
    })

  if (!checks.length) {
    return {
      ok: false,
      taskId,
      progressPath: relative(directory, path),
      blockedBy: ["Gate"],
      checks: [{ name: "Gate", ok: false, message: "## Gate must contain markdown checkbox items" }],
    }
  }

  const blockedBy = checks.filter((item) => !item.ok).map((item) => item.name)
  return {
    ok: blockedBy.length === 0,
    taskId,
    progressPath: relative(directory, path),
    blockedBy,
    checks,
  }
}

export function taskLockPath(directory, taskId) {
  return join(taskDir(directory, taskId), ".lock")
}

export function readPlanApproval(directory, taskId = activeTaskId(directory)) {
  if (!taskId) return { taskId: undefined, hasPlan: false, approved: false }
  const plan = readTaskArtifact(directory, taskId, "plan.md", 8000)
  return { taskId, hasPlan: Boolean(plan), approved: /^approved:\s*true\s*$/im.test(plan) }
}

export function claimTaskLock(directory, taskId, sessionId, staleMs = DEFAULT_LOCK_STALE_MS) {
  if (!taskId || !sessionId) return { ok: true, owner: sessionId }
  const path = taskLockPath(directory, taskId)
  mkdirSync(taskDir(directory, taskId), { recursive: true })
  if (existsSync(path)) {
    const raw = readFileSync(path, "utf8")
    const owner = raw.match(/owner:\s*(.+)/)?.[1]?.trim()
    const at = Date.parse(raw.match(/at:\s*(.+)/)?.[1]?.trim() ?? "")
    const ageMs = Number.isNaN(at) ? Number.POSITIVE_INFINITY : Date.now() - at
    if (owner && owner !== sessionId && ageMs < staleMs) {
      return { ok: false, owner, ageMs }
    }
  }
  writeFileSync(path, `owner: ${sessionId}\nat: ${new Date().toISOString()}\n`, "utf8")
  return { ok: true, owner: sessionId, ageMs: 0 }
}

export function releaseTaskLock(directory, taskId, sessionId) {
  if (!taskId) return false
  const path = taskLockPath(directory, taskId)
  if (!existsSync(path)) return false
  const owner = readFileSync(path, "utf8").match(/owner:\s*(.+)/)?.[1]?.trim()
  if (owner && sessionId && owner !== sessionId) return false
  rmSync(path, { force: true })
  return true
}

export function clearRunSecrets(directory, runId) {
  if (!runId) return false
  const dir = join(alloyDir(directory), "run", runId)
  if (!existsSync(dir)) return false
  rmSync(dir, { recursive: true, force: true })
  return true
}

export function normalizeGateName(text) {
  return text
    .replace(/\s+[—|-]\s+.*$/, "")
    .replace(/`/g, "")
    .trim()
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
