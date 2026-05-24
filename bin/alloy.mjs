#!/usr/bin/env node
import { randomUUID } from "node:crypto"
import { constants, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, copyFileSync, chmodSync, appendFileSync, accessSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, "..")
const OPENCODE_PLUGIN_VERSION = "1.15.10"
const ZOD_VERSION = "4.4.3"

const MCP_CONFIGS = {
  context7: { type: "remote", url: "https://mcp.context7.com/mcp", enabled: true },
  grep_app: { type: "remote", url: "https://mcp.grep.app", enabled: true },
  exa: { type: "remote", url: "https://mcp.exa.ai/mcp", enabled: true },
}

const ROLE_TO_AGENT = {
  planner: ["alloy-orchestrator", "alloy-planner"],
  executor: ["alloy-executor"],
  reviewer: ["alloy-reviewer"],
  debugger: ["alloy-debugger"],
  verifier: ["alloy-verifier"],
}

const MANAGED_NAMES = [
  "opencode.json",
  "package.json",
  "plugins",
  "alloy-runtime",
  "agents",
  "commands",
  "skills",
]

const DEPRECATED_SKILLS = ["team-tdd", "frontend-tdd", "backend-tdd", "tdd"]
const DEPRECATED_AGENTS = ["orchestrator_append", "librarian_append", "code-reviewer", "plan-reviewer", "executor"]
const PACK_ALIASES = {
  default: "core",
  team: "core",
  profile: "core",
}
const DEFAULT_PROJECT_CONFIG = ".alloy/alloy.project.json"

function usage() {
  return `OpenCode Alloy

Usage:
  alloy init [--pack core] [--models github-copilot] [--target local]
  alloy resolve [--pack core] [--json]
  alloy install [--pack core] [--target local] [--models github-copilot] [--dry-run]
  alloy doctor [--pack core] [--target local]
  alloy state add-task --title TITLE [--kind code]
  alloy state add-evidence --task-id ID --kind test --summary TEXT
  alloy state add-claim --task-id ID --text TEXT [--evidence-id ID]
  alloy state list tasks|claims|evidence|runs
  alloy gate check --task-id ID [--json]
  alloy sync --workspace alloy.workspace.json [--dry-run]

Aliases:
  --profile remains as a deprecated alias for --pack.
`
}

function parseArgs(argv) {
  const commands = new Set(["init", "resolve", "install", "doctor", "state", "gate", "sync", "help"])
  let command = commands.has(argv[0]) ? argv.shift() : "install"
  const positionals = []
  const options = {
    command,
    pack: "core",
    target: "local",
    models: undefined,
    dryRun: false,
    json: false,
    workspace: "alloy.workspace.json",
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith("--")) {
      positionals.push(arg)
      continue
    }
    const [rawKey, rawValue] = arg.slice(2).split("=", 2)
    const key = rawKey.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    const value = rawValue ?? argv[i + 1]
    const consumeValue = rawValue === undefined
    switch (key) {
      case "pack":
        options.pack = value
        options.explicitPack = true
        if (consumeValue) i += 1
        break
      case "profile":
        options.pack = value
        options.explicitPack = true
        options.usedProfileAlias = true
        if (consumeValue) i += 1
        break
      case "target":
      case "models":
      case "workspace":
      case "taskId":
      case "title":
      case "kind":
      case "status":
      case "risk":
      case "summary":
      case "command":
      case "text":
      case "exitCode":
        options[key] = value
        if (consumeValue) i += 1
        break
      case "config":
        options.config = value
        if (consumeValue) i += 1
        break
      case "with":
      case "without":
        throw new Error("--with/--without were removed in Alloy v2; choose a pack or edit .alloy/alloy.project.json")
      case "evidenceId":
        options.evidenceIds ??= []
        options.evidenceIds.push(value)
        if (consumeValue) i += 1
        break
      case "path":
        options.paths ??= []
        options.paths.push(value)
        if (consumeValue) i += 1
        break
      case "dryRun":
      case "json":
      case "help":
      case "doctor":
      case "auditOnly":
      case "refreshVendor":
        options[key] = true
        break
      default:
        throw new Error(`Unknown option: --${rawKey}`)
    }
  }
  options.positionals = positionals
  if (!["local", "global"].includes(options.target)) throw new Error("--target must be local or global")
  if (options.doctor && options.command === "install") options.command = "doctor"
  if (options.help || options.command === "help") options.command = "help"
  return options
}

function splitCsv(value = "") {
  return String(value).split(",").map((item) => item.trim()).filter(Boolean)
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"))
}

function writeJson(path, value, dryRun = false) {
  writeText(path, `${JSON.stringify(value, null, 2)}\n`, dryRun)
}

function writeText(path, text, dryRun = false, mode) {
  if (dryRun) {
    logAction(`write ${path}`, true)
    return
  }
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text, "utf8")
  if (mode !== undefined) chmodSync(path, mode)
}

function logAction(message, dryRun = false) {
  console.log(`${dryRun ? "DRY-RUN: " : ""}${message}`)
}

function pathExists(path) {
  return existsSync(path)
}

function copyFile(source, dest, dryRun = false, mode) {
  if (!pathExists(source)) throw new Error(`Missing source file: ${source}`)
  if (dryRun) {
    logAction(`copy ${relative(REPO_ROOT, source)} -> ${dest}`, true)
    return
  }
  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(source, dest)
  if (mode !== undefined) chmodSync(dest, mode)
}

function copyDir(source, dest, dryRun = false) {
  if (!pathExists(source)) throw new Error(`Missing source directory: ${source}`)
  if (dryRun) {
    logAction(`copy tree ${relative(REPO_ROOT, source)} -> ${dest}`, true)
    return
  }
  rmSync(dest, { recursive: true, force: true })
  mkdirSync(dest, { recursive: true })
  for (const entry of readdirSync(source)) {
    const from = join(source, entry)
    const to = join(dest, entry)
    if (statSync(from).isDirectory()) copyDir(from, to, false)
    else copyFile(from, to, false)
  }
}

function removePath(path, dryRun = false) {
  if (!pathExists(path)) return
  if (dryRun) {
    logAction(`rm -rf ${path}`, true)
    return
  }
  rmSync(path, { recursive: true, force: true })
}

function listFiles(base) {
  if (!pathExists(base)) return []
  const files = []
  for (const entry of readdirSync(base)) {
    const path = join(base, entry)
    if (statSync(path).isDirectory()) files.push(...listFiles(path))
    else files.push(path)
  }
  return files
}

function loadPack(id) {
  const normalized = PACK_ALIASES[id] ?? id
  const packPath = join(REPO_ROOT, "packs", `${normalized}.json`)
  if (pathExists(packPath)) return readJson(packPath)
  throw new Error(`Unknown pack: ${id}`)
}

function mergePack(base, extra) {
  const merged = { ...base }
  for (const key of ["skills", "agents", "commands", "mcp", "modelRoles"]) {
    merged[key] = unique([...(base[key] ?? []), ...(extra[key] ?? [])])
  }
  merged.description = `${base.description ?? ""} + ${extra.id}`
  return merged
}

function unique(items) {
  return [...new Set(items)]
}

function buildPack(options, projectDir = process.cwd()) {
  let project = loadProjectConfig(projectDir, false, options.config)
  let packIds = options.explicitPack ? [options.pack] : project?.packs ?? [options.pack]
  if (!packIds.length) packIds = ["core"]
  let pack = loadPack(packIds[0])
  for (const extra of packIds.slice(1)) pack = mergePack(pack, loadPack(extra))
  return { pack, project }
}

function loadModelMap(modelName) {
  const path = join(REPO_ROOT, "models", `${modelName}.json`)
  if (!pathExists(path)) throw new Error(`Unknown model map: ${modelName}`)
  return readJson(path)
}

function loadProjectConfig(projectDir, required = true, configPath) {
  const path = projectConfigPath(projectDir, configPath)
  if (!pathExists(path)) {
    if (required) throw new Error(`Missing Alloy project config: ${path}`)
    return null
  }
  return readJson(path)
}

function projectConfigPath(projectDir, configPath) {
  if (!configPath || configPath === DEFAULT_PROJECT_CONFIG) return join(projectDir, DEFAULT_PROJECT_CONFIG)
  return resolve(projectDir, configPath)
}

function defaultProjectConfig(pack, modelName) {
  const repoKind = pack.id === "backend" ? "backend" : pack.id === "infra" ? "infra" : "frontend"
  return {
    repoKind,
    packs: [pack.id],
    models: modelName,
    mcp: { baseline: ["context7", "grep_app", "exa"], disabled: [] },
    workflow: { mode: "standard", tdd: "required_for_code", claims: true, review: "standard" },
    runtimes: { node: true, bun: true, npx: false },
  }
}

function resolveConfig(options, projectDir = process.cwd()) {
  const { pack, project } = buildPack(options, projectDir)
  const modelName = options.models ?? project?.models ?? "github-copilot"
  const models = loadModelMap(modelName)
  const targetDir = options.target === "global" ? join(process.env.HOME, ".config", "opencode") : join(projectDir, ".opencode")
  const disabledMcp = new Set(project?.mcp?.disabled ?? [])
  const mcpNames = unique(project?.mcp?.baseline ?? pack.mcp ?? []).filter((name) => !disabledMcp.has(name))
  const resolved = {
    project: project ?? defaultProjectConfig(pack, modelName),
    pack,
    models,
    modelName,
    target: options.target,
    targetDir,
    agents: pack.agents ?? [],
    skills: pack.skills ?? [],
    commands: pack.commands ?? [],
    mcp: Object.fromEntries(mcpNames.filter((name) => MCP_CONFIGS[name]).map((name) => [name, MCP_CONFIGS[name]])),
    runtimes: project?.runtimes ?? { node: true, bun: true, npx: false },
    configPath: options.config ?? DEFAULT_PROJECT_CONFIG,
  }
  return resolved
}

function ensureAlloyProject(projectDir, resolved, dryRun = false, configPath) {
  const alloyDir = join(projectDir, ".alloy")
  const resolvedConfigPath = projectConfigPath(projectDir, configPath)
  if (!pathExists(resolvedConfigPath)) {
    writeJson(resolvedConfigPath, resolved.project, dryRun)
  }
  copyTemplateIfMissing("workflow.md", join(alloyDir, "workflow.md"), dryRun)
  for (const policy of ["claims.md", "tdd.md", "review.md", "debug.md"]) {
    copyTemplateIfMissing(join("policies", policy), join(alloyDir, "policies", policy), dryRun)
  }
  for (const name of ["tasks", "claims", "evidence", "runs"]) {
    const path = join(alloyDir, "state", `${name}.jsonl`)
    if (!pathExists(path)) writeText(path, "", dryRun)
  }
  for (const projection of ["status.md", "current-plan.md"]) {
    copyTemplateIfMissing(join("projections", projection), join(alloyDir, "projections", projection), dryRun)
  }
}

function copyTemplateIfMissing(rel, dest, dryRun = false) {
  if (pathExists(dest)) return
  copyFile(join(REPO_ROOT, "templates", "alloy", rel), dest, dryRun)
}

function backupManaged(targetDir, dryRun = false) {
  if (dryRun) {
    logAction(`backup managed files under ${targetDir}`, true)
    return
  }
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)
  const backupDir = join(targetDir, "backups", stamp)
  let copied = false
  for (const name of MANAGED_NAMES) {
    const source = join(targetDir, name)
    if (!pathExists(source)) continue
    const dest = join(backupDir, name)
    if (statSync(source).isDirectory()) copyDir(source, dest)
    else copyFile(source, dest)
    copied = true
  }
  console.log(copied ? `Backup: ${backupDir}` : "Backup: no existing Alloy-managed files found")
}

function preflight(resolved) {
  console.log("Preflight")
  console.log(which("opencode") ? `- opencode: ${runCapture(["opencode", "--version"]) || "unknown"}` : "- opencode: not found (install before using the generated config)")
  console.log(which("node") ? `- node: ${runCapture(["node", "--version"]) || "unknown"}` : "- node: not found (required for Alloy SDK)")
  console.log(which("bun") ? `- bun: ${runCapture(["bun", "--version"]) || "unknown"}` : "- bun: not found (required for Alloy OpenCode plugin dependencies)")
  for (const [cli, purpose] of [["gh", "GitHub"], ["az", "Azure DevOps"], ["psql", "Postgres"]]) {
    if (!which(cli)) console.log(`- optional ${cli}: not found (${purpose} workflows use CLI fallback)`)
  }
  if (!resolved.runtimes.bun) console.log("- bun runtime disabled in project config")
  console.log("")
}

function which(command) {
  for (const dir of (process.env.PATH ?? "").split(":")) {
    const candidate = join(dir, command)
    try {
      accessSync(candidate, constants.X_OK)
      return candidate
    } catch {
      // Try the next PATH entry.
    }
  }
  return ""
}

function runCapture(cmd) {
  const result = spawnSync(cmd[0], cmd.slice(1), { encoding: "utf8" })
  return result.status === 0 ? result.stdout.trim() : ""
}

function installCommand(options, projectDir = process.cwd()) {
  const resolved = resolveConfig(options, projectDir)
  if (options.auditOnly) return auditTarget(resolved, projectDir)
  console.log("OpenCode Alloy Setup")
  console.log(`Pack: ${resolved.pack.id}`)
  if (options.usedProfileAlias) console.log("Profile alias: deprecated; use --pack going forward")
  console.log(`Target: ${options.target} (${resolved.targetDir})`)
  console.log(`Models: ${resolved.modelName}`)
  console.log("")
  if (options.refreshVendor) {
    console.error("ERROR: --refresh-vendor is not implemented for Alloy v2. Update vendor snapshots manually and refresh vendor.lock.json.")
    return 2
  }
  preflight(resolved)
  ensureAlloyProject(projectDir, resolved, options.dryRun, options.config)
  backupManaged(resolved.targetDir, options.dryRun)
  installCoreFiles(resolved, options.dryRun)
  installPlugin(resolved, options.dryRun)
  writeOpenCodeConfig(resolved, options.dryRun)
  cleanupDeprecated(resolved.targetDir, options.dryRun)
  if (options.dryRun) {
    console.log(resolved.pack.id === "core" ? "Alloy core pack installed (dry-run plan only)" : "OpenCode Alloy pack installed (dry-run plan only)")
    console.log("Dry run complete; no files were written.")
    return 0
  }
  updateProjections(projectDir)
  console.log(resolved.pack.id === "core" ? "Alloy core pack installed" : "OpenCode Alloy pack installed")
  return auditTarget(resolved, projectDir)
}

function installCoreFiles(resolved, dryRun = false) {
  console.log("Core files")
  for (const agent of resolved.agents) copyFile(join(REPO_ROOT, "agents", `${agent}.md`), join(resolved.targetDir, "agents", `${agent}.md`), dryRun)
  for (const command of resolved.commands) copyFile(join(REPO_ROOT, "commands", `${command}.md`), join(resolved.targetDir, "commands", `${command}.md`), dryRun)
  for (const skill of resolved.skills) {
    const local = join(REPO_ROOT, "skills", skill)
    const external = join(REPO_ROOT, "vendor", "skills", "external", skill)
    copyDir(pathExists(local) ? local : external, join(resolved.targetDir, "skills", skill), dryRun)
  }
  console.log("")
}

function installPlugin(resolved, dryRun = false) {
  console.log("Alloy OpenCode plugin")
  const pkg = {
    private: true,
    type: "module",
    dependencies: {
      "@opencode-ai/plugin": OPENCODE_PLUGIN_VERSION,
      zod: ZOD_VERSION,
    },
  }
  writeJson(join(resolved.targetDir, "package.json"), pkg, dryRun)
  copyFile(join(REPO_ROOT, "templates", "opencode", "alloy-plugin.ts"), join(resolved.targetDir, "plugins", "alloy.ts"), dryRun)
  writeText(join(resolved.targetDir, "alloy-runtime", "README.md"), "OpenCode loads the Alloy plugin from ../plugins/alloy.ts. Bun installs package.json dependencies.\n", dryRun)
  console.log("")
}

function cleanupDeprecated(targetDir, dryRun = false) {
  console.log("Cleanup")
  for (const skill of DEPRECATED_SKILLS) removePath(join(targetDir, "skills", skill), dryRun)
  for (const agent of DEPRECATED_AGENTS) removePath(join(targetDir, "agents", `${agent}.md`), dryRun)
  console.log("")
}

function writeOpenCodeConfig(resolved, dryRun = false) {
  const config = {
    "$schema": "https://opencode.ai/config.json",
    autoupdate: false,
    default_agent: "alloy-orchestrator",
    agent: agentModelConfig(resolved.models),
    mcp: resolved.mcp,
  }
  writeJson(join(resolved.targetDir, "opencode.json"), config, dryRun)
}

function agentModelConfig(models) {
  const config = {}
  for (const [role, agents] of Object.entries(ROLE_TO_AGENT)) {
    if (!models[role]) continue
    for (const agent of agents) {
      config[agent] = Object.fromEntries(Object.entries(models[role]).filter(([key]) => ["model", "variant", "fallback"].includes(key)))
    }
  }
  return config
}

function auditTarget(resolved, projectDir) {
  const failures = validatePackRefs(resolved.pack)
  failures.push(...validateTargetFiles(resolved))
  const configPath = join(resolved.targetDir, "opencode.json")
  const config = pathExists(configPath) ? readJson(configPath) : {}
  if (JSON.stringify(config.plugin ?? []).includes("oh-my-opencode-slim")) failures.push("Alloy installs must not include OMO Slim plugin")
  if (!pathExists(projectConfigPath(projectDir, resolved.configPath))) failures.push(`Missing ${resolved.configPath}`)
  if (failures.length) {
    for (const failure of failures) console.error(`FAIL: ${failure}`)
    return 1
  }
  return 0
}

function validatePackRefs(pack) {
  const failures = []
  for (const agent of pack.agents ?? []) if (!pathExists(join(REPO_ROOT, "agents", `${agent}.md`))) failures.push(`pack ${pack.id} references missing agent: ${agent}`)
  for (const command of pack.commands ?? []) if (!pathExists(join(REPO_ROOT, "commands", `${command}.md`))) failures.push(`pack ${pack.id} references missing command: ${command}`)
  for (const skill of pack.skills ?? []) {
    if (!pathExists(join(REPO_ROOT, "skills", skill, "SKILL.md")) && !pathExists(join(REPO_ROOT, "vendor", "skills", "external", skill, "SKILL.md"))) {
      failures.push(`pack ${pack.id} references missing skill: ${skill}`)
    }
  }
  for (const mcp of pack.mcp ?? []) if (!MCP_CONFIGS[mcp]) failures.push(`pack ${pack.id} references unknown MCP: ${mcp}`)
  return failures
}

function validateTargetFiles(resolved) {
  const failures = []
  for (const agent of resolved.agents) if (!pathExists(join(resolved.targetDir, "agents", `${agent}.md`))) failures.push(`Target missing agent: ${agent}`)
  for (const command of resolved.commands) if (!pathExists(join(resolved.targetDir, "commands", `${command}.md`))) failures.push(`Target missing command: ${command}`)
  for (const skill of resolved.skills) if (!pathExists(join(resolved.targetDir, "skills", skill, "SKILL.md"))) failures.push(`Target missing skill: ${skill}`)
  for (const rel of ["opencode.json", "package.json", "plugins/alloy.ts"]) if (!pathExists(join(resolved.targetDir, rel))) failures.push(`Target missing ${rel}`)
  return failures
}

function doctorCommand(options, projectDir = process.cwd()) {
  console.log("OpenCode Alloy Doctor")
  const resolved = resolveConfig(options, projectDir)
  const failures = []
  const warnings = []
  failures.push(...validatePackRefs(resolved.pack))
  if (resolved.runtimes.node && !which("node")) failures.push("Node.js is required for Alloy SDK")
  if (resolved.runtimes.bun && !which("bun")) failures.push("Bun is required for Alloy OpenCode plugin dependencies")
  if (!which("opencode")) warnings.push("opencode is not on PATH; install OpenCode before using generated configs")
  const pluginVersion = installedPackageVersion(resolved.targetDir, "@opencode-ai/plugin")
  const zodVersion = installedPackageVersion(resolved.targetDir, "zod")
  if (!pluginVersion) {
    warnings.push(`OpenCode plugin dependencies are not installed yet. Start OpenCode once or run: cd ${resolved.targetDir} && bun install`)
  } else if (pluginVersion !== OPENCODE_PLUGIN_VERSION) {
    failures.push(`Installed @opencode-ai/plugin version ${pluginVersion} does not match pinned ${OPENCODE_PLUGIN_VERSION}`)
  }
  if (zodVersion && zodVersion !== ZOD_VERSION) {
    failures.push(`Installed zod version ${zodVersion} does not match pinned ${ZOD_VERSION}`)
  }
  if (pathExists(resolved.targetDir)) failures.push(...validateTargetFiles(resolved))
  else failures.push(`Target directory does not exist: ${resolved.targetDir}`)
  failures.push(...validateVendorLock())
  if (failures.length) {
    for (const failure of failures) console.error(`FAIL: ${failure}`)
    for (const warning of warnings) console.error(`WARN: ${warning}`)
    return 1
  }
  for (const warning of warnings) console.log(`WARN: ${warning}`)
  console.log("OK: packs, project config, Bun runtime, target config, and vendor lock passed")
  return 0
}

function installedPackageVersion(targetDir, packageName) {
  const pkgPath = join(targetDir, "node_modules", ...packageName.split("/"), "package.json")
  if (!pathExists(pkgPath)) return null
  try {
    return readJson(pkgPath).version ?? null
  } catch {
    return null
  }
}

function validateVendorLock() {
  const path = join(REPO_ROOT, "vendor.lock.json")
  if (!pathExists(path)) return ["vendor.lock.json is missing"]
  const entries = readJson(path)
  const failures = []
  const required = new Set(["name", "kind", "source", "version", "license", "sha256", "paths", "vendoredAt"])
  for (const [index, entry] of entries.entries()) {
    const label = entry.name ?? `entry #${index}`
    for (const key of required) if (!(key in entry)) failures.push(`vendor.lock.json ${label} missing field: ${key}`)
    for (const rel of entry.paths ?? []) if (!pathExists(join(REPO_ROOT, rel))) failures.push(`vendor.lock.json ${label} missing path: ${rel}`)
  }
  return failures
}

function initCommand(options, projectDir = process.cwd()) {
  const resolved = resolveConfig(options, projectDir)
  ensureAlloyProject(projectDir, resolved, options.dryRun)
  return installCommand(options, projectDir)
}

function resolveCommand(options, projectDir = process.cwd()) {
  const resolved = resolveConfig(options, projectDir)
  if (options.json) console.log(JSON.stringify(resolved, null, 2))
  else {
    console.log(`Pack: ${resolved.pack.id}`)
    console.log(`Agents: ${resolved.agents.join(", ")}`)
    console.log(`Skills: ${resolved.skills.join(", ")}`)
    console.log(`Commands: ${resolved.commands.join(", ")}`)
    console.log(`MCP: ${Object.keys(resolved.mcp).join(", ")}`)
    console.log(`Runtimes: node=${resolved.runtimes.node} bun=${resolved.runtimes.bun} npx=${resolved.runtimes.npx}`)
  }
  return 0
}

function appendRecord(projectDir, name, record) {
  const dir = join(projectDir, ".alloy", "state")
  mkdirSync(dir, { recursive: true })
  appendFileSync(join(dir, `${name}.jsonl`), `${JSON.stringify(record)}\n`, "utf8")
  updateProjections(projectDir)
}

function readJsonl(projectDir, name) {
  const path = join(projectDir, ".alloy", "state", `${name}.jsonl`)
  if (!pathExists(path)) return []
  return readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
}

function stateCommand(options, projectDir = process.cwd()) {
  const [action, noun] = options.positionals
  const now = new Date().toISOString()
  if (action === "add-task") {
    if (!options.title) throw new Error("--title is required")
    const record = { id: randomUUID(), title: options.title, kind: options.kind ?? "code", status: options.status ?? "open", risk: options.risk ?? "normal", createdAt: now, updatedAt: now }
    appendRecord(projectDir, "tasks", record)
    console.log(JSON.stringify(record, null, 2))
    return 0
  }
  if (action === "add-evidence") {
    if (!options.taskId || !options.kind || !options.summary) throw new Error("--task-id, --kind, and --summary are required")
    const record = { id: randomUUID(), taskId: options.taskId, kind: options.kind, source: "alloy-cli", summary: options.summary, command: options.command, exitCode: options.exitCode === undefined ? undefined : Number(options.exitCode), paths: options.paths ?? [], createdAt: now }
    appendRecord(projectDir, "evidence", pruneUndefined(record))
    console.log(JSON.stringify(pruneUndefined(record), null, 2))
    return 0
  }
  if (action === "add-claim") {
    if (!options.taskId || !options.text) throw new Error("--task-id and --text are required")
    const evidenceIds = options.evidenceIds ?? []
    const record = { id: randomUUID(), taskId: options.taskId, text: options.text, status: evidenceIds.length ? "verified" : "unverified", evidenceIds, createdAt: now }
    appendRecord(projectDir, "claims", record)
    console.log(JSON.stringify(record, null, 2))
    return 0
  }
  if (action === "list") {
    const map = { tasks: "tasks", claims: "claims", evidence: "evidence", runs: "runs" }
    const name = map[noun]
    if (!name) throw new Error("Usage: alloy state list tasks|claims|evidence|runs")
    console.log(JSON.stringify(readJsonl(projectDir, name), null, 2))
    return 0
  }
  throw new Error("Usage: alloy state add-task|add-evidence|add-claim|list")
}

function pruneUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined))
}

function updateProjections(projectDir) {
  const alloyDir = join(projectDir, ".alloy")
  if (!pathExists(alloyDir)) return
  const tasks = readJsonl(projectDir, "tasks")
  const claims = readJsonl(projectDir, "claims")
  const evidence = readJsonl(projectDir, "evidence")
  mkdirSync(join(alloyDir, "projections"), { recursive: true })
  const active = tasks.filter((task) => !["closed", "done"].includes(task.status))
  const status = [
    "# Alloy Status",
    "",
    `Tasks: ${tasks.length}`,
    `Open tasks: ${active.length}`,
    `Claims: ${claims.length}`,
    `Evidence: ${evidence.length}`,
    "",
    ...active.map((task) => `- ${task.id}: ${task.title} (${task.kind}, ${task.status})`),
    "",
  ].join("\n")
  const plan = [
    "# Current Plan",
    "",
    active.length ? "Active tasks:" : "No active plan yet.",
    ...active.map((task, index) => `${index + 1}. ${task.id}: ${task.title}`),
    "",
  ].join("\n")
  writeFileSync(join(alloyDir, "projections", "status.md"), status, "utf8")
  writeFileSync(join(alloyDir, "projections", "current-plan.md"), plan, "utf8")
}

function gateCommand(options, projectDir = process.cwd()) {
  const [action] = options.positionals
  if (action !== "check") throw new Error("Usage: alloy gate check --task-id ID [--json]")
  if (!options.taskId) throw new Error("--task-id is required")
  const result = checkGate(projectDir, options.taskId)
  if (options.json) console.log(JSON.stringify(result, null, 2))
  else {
    console.log(result.ok ? "Alloy gates passed" : "Alloy gates blocked")
    for (const item of result.checks) console.log(`${item.ok ? "OK" : "FAIL"}: ${item.name} - ${item.message}`)
  }
  return result.ok ? 0 : 1
}

function checkGate(projectDir, taskId) {
  const project = loadProjectConfig(projectDir)
  const task = readJsonl(projectDir, "tasks").find((item) => item.id === taskId)
  if (!task) return { ok: false, taskId, checks: [{ name: "task", ok: false, message: `Task not found: ${taskId}` }] }
  const evidence = readJsonl(projectDir, "evidence").filter((item) => item.taskId === taskId)
  const claims = readJsonl(projectDir, "claims").filter((item) => item.taskId === taskId)
  const currentPlan = join(projectDir, ".alloy", "projections", "current-plan.md")
  const planText = pathExists(currentPlan) ? readFileSync(currentPlan, "utf8") : ""
  const kinds = new Set(evidence.map((item) => item.kind))
  const checks = []
  const codeTask = task.kind === "code"
  checks.push({
    name: "plan_gate",
    ok: !codeTask || planText.includes(taskId),
    message: !codeTask || planText.includes(taskId) ? "current plan references this task" : "code tasks need current-plan.md to reference the task",
  })
  const tddRequired = project.workflow?.tdd === "required_for_code" && codeTask
  const hasTdd = (kinds.has("tdd_red") || kinds.has("red")) && (kinds.has("tdd_green") || kinds.has("green") || kinds.has("test"))
  checks.push({
    name: "tdd_gate",
    ok: !tddRequired || hasTdd || kinds.has("tdd_skip"),
    message: !tddRequired || hasTdd || kinds.has("tdd_skip") ? "TDD evidence satisfied or skipped" : "code tasks need RED and GREEN/test evidence or tdd_skip",
  })
  const invalidClaims = claims.filter((claim) => ["completed", "verified"].includes(claim.status) && !(claim.evidenceIds ?? []).length)
  checks.push({
    name: "claims_gate",
    ok: invalidClaims.length === 0,
    message: invalidClaims.length === 0 ? "completed claims bind evidence" : "completed claims must include evidenceIds",
  })
  checks.push({
    name: "review_gate",
    ok: task.risk !== "high" || kinds.has("review"),
    message: task.risk !== "high" || kinds.has("review") ? "review policy satisfied" : "high-risk tasks need review evidence",
  })
  const verifyKinds = ["test", "lint", "manual_verification", "verification", "tdd_green", "green"]
  checks.push({
    name: "verify_gate",
    ok: verifyKinds.some((kind) => kinds.has(kind)),
    message: verifyKinds.some((kind) => kinds.has(kind)) ? "verification evidence present" : "task close needs test, lint, manual verification, or equivalent evidence",
  })
  return { ok: checks.every((item) => item.ok), taskId, checks }
}

function syncCommand(options, projectDir = process.cwd()) {
  const workspacePath = resolve(projectDir, options.workspace)
  if (!pathExists(workspacePath)) throw new Error(`Missing workspace file: ${workspacePath}`)
  const workspace = readJson(workspacePath)
  if (!Array.isArray(workspace.projects)) throw new Error("alloy.workspace.json must contain projects[]")
  console.log("OpenCode Alloy Sync")
  for (const project of workspace.projects) {
    const target = resolve(dirname(workspacePath), project.path)
    console.log(`${options.dryRun ? "DRY-RUN: " : ""}sync project ${target}`)
    const config = project.config ?? DEFAULT_PROJECT_CONFIG
    const projectOptions = { ...options, target: "local", explicitPack: false, dryRun: options.dryRun, config }
    if (!pathExists(projectConfigPath(target, config))) {
      console.log(`${options.dryRun ? "DRY-RUN: " : ""}project config missing, using defaults for ${target}`)
    }
    const code = installCommand(projectOptions, target)
    if (code !== 0) return code
  }
  return 0
}

async function main(argv) {
  try {
    const options = parseArgs([...argv])
    if (options.command === "help") {
      console.log(usage())
      return 0
    }
    if (options.command === "init") return initCommand(options)
    if (options.command === "resolve") return resolveCommand(options)
    if (options.command === "install") return installCommand(options)
    if (options.command === "doctor") return doctorCommand(options)
    if (options.command === "state") return stateCommand(options)
    if (options.command === "gate") return gateCommand(options)
    if (options.command === "sync") return syncCommand(options)
    throw new Error(`Unknown command: ${options.command}`)
  } catch (error) {
    console.error(`ERROR: ${error.message}`)
    return 2
  }
}

process.exitCode = await main(process.argv.slice(2))
