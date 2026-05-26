#!/usr/bin/env node
import { randomUUID } from "node:crypto"
import { constants, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, copyFileSync, chmodSync, appendFileSync, accessSync, realpathSync, renameSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import {
  addManagedMcp,
  addVisibleItem,
  createManifest,
  manifestPathForTarget,
  normalizeManifest,
  readManifest,
  removeVisibleItem,
  writeManifest as writeProjectManifest,
} from "./manifest.mjs"
import {
  createGlobalState,
  globalStatePath,
  vendorLockPath,
} from "./state.mjs"
import {
  checkContainerUsePrereqs,
} from "./prereq-check.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, "..")
const PACKAGE = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8"))
const DEFAULTS_PATH = join(REPO_ROOT, "defaults.json")
export const DEFAULTS = loadDefaults()
const OPENCODE_PLUGIN_VERSION = DEFAULTS.plugin["@opencode-ai/plugin"]
const ZOD_VERSION = DEFAULTS.plugin.zod
const MCP_CONFIGS = DEFAULTS.mcp
const PACK_FIELDS = ["skills", "agents", "commands", "mcp", "modelRoles"]
const SCOPE_KINDS = ["frontend", "backend", "infra"]
const COMPLETION_COMMANDS = ["install", "add", "remove", "list", "search", "outdated", "upgrade", "version", "doctor", "completion"]
const COMPLETION_PACKS = ["core", "frontend", "backend", "infra", "all"]
const COMPLETION_TARGETS = ["local", "global"]
const COMPLETION_SHELLS = ["bash", "zsh", "fish"]
let atomsCache
let vendorSkillPathsCache

const ROLE_TO_AGENT = {
  orchestrator: ["Orchestrator"],
  planner: ["Architect"],
  executor: ["Builder", "Fixer"],
  reviewer: ["Reviewer"],
  verifier: ["Tester"],
  explorer: ["Explorer"],
}

const MANAGED_NAMES = [
  "opencode.json",
  "package.json",
  "plugins",
  "alloy-runtime",
  "alloy.manifest.json",
  "presets.json",
  "agents",
  "commands",
  "skills",
]

const DEPRECATED_SKILLS = ["team-tdd", "frontend-tdd", "backend-tdd", "tdd"]
const DEPRECATED_AGENTS = ["orchestrator_append", "librarian_append", "code-reviewer", "plan-reviewer", "executor"]
const RETIRED_ALLOY_AGENT_NAMES = ["orchestrator", "planner", "executor", "debugger", "reviewer", "verifier"].map((name) => `alloy-${name}`)
const PACK_ALIASES = {
  default: "core",
  team: "core",
  profile: "core",
}
const DEFAULT_PROJECT_CONFIG = ".alloy/alloy.project.json"

function loadDefaults() {
  try {
    return JSON.parse(readFileSync(DEFAULTS_PATH, "utf8"))
  } catch (error) {
    if (error?.code === "ENOENT") {
      console.error(`ERROR: Missing defaults.json at ${DEFAULTS_PATH}. Ensure you are running alloy from the repo root.`)
      process.exit(1)
    }
    throw error
  }
}

function usage() {
  return `Alloy

Usage:
  alloy init [--pack core] [--models github-copilot] [--target local]
  alloy resolve [--pack core] [--json]
  alloy install [pack] [--pack core] [--target local] [--models github-copilot] [--dry-run]
  alloy add <skill-or-agent>
  alloy remove <skill-or-agent>
  alloy list [--installed]
  alloy search <query>
  alloy outdated
  alloy upgrade <vendor-name>
  alloy upgrade --self
  alloy upgrade --all-vendors
  alloy version
  alloy doctor [--pack core] [--target local]
  alloy completion bash|zsh|fish
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

export function parseArgs(argv) {
  const commands = new Set(["init", "resolve", "install", "add", "remove", "list", "search", "outdated", "upgrade", "version", "doctor", "completion", "state", "gate", "sync", "help"])
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
      case "version":
      case "doctor":
      case "auditOnly":
      case "refreshVendor":
      case "installed":
      case "self":
      case "allVendors":
        options[key] = true
        break
      default:
        throw new Error(`Unknown option: --${rawKey}`)
    }
  }
  options.positionals = positionals
  if (!["local", "global"].includes(options.target)) throw new Error("--target must be local or global")
  applyPositionalPack(options)
  if (options.version) options.command = "version"
  if (options.doctor && options.command === "install") options.command = "doctor"
  if (options.help || options.command === "help") options.command = "help"
  return options
}

function applyPositionalPack(options) {
  if (!["init", "resolve", "install", "doctor"].includes(options.command)) return
  if (options.explicitPack || !options.positionals.length) return
  const [pack] = options.positionals
  if (!COMPLETION_PACKS.includes(pack)) return
  options.pack = pack
  options.explicitPack = true
  options.positionals = options.positionals.slice(1)
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

export function loadAtoms() {
  if (atomsCache) return atomsCache
  const atomsPath = join(REPO_ROOT, "packs", "atoms.json")
  if (!pathExists(atomsPath)) {
    atomsCache = {}
    return atomsCache
  }
  const data = readJson(atomsPath)
  atomsCache = data.atoms ?? {}
  return atomsCache
}

export function loadPack(id) {
  const normalized = PACK_ALIASES[id] ?? id
  const packPath = join(REPO_ROOT, "packs", `${normalized}.json`)
  if (pathExists(packPath)) return expandPack(readJson(packPath))
  throw new Error(`Unknown pack: ${id}`)
}

export function mergePack(base, extra) {
  const left = expandPack(base)
  const right = expandPack(extra)
  const merged = mergePackFields(left, right)
  merged.id = left.id ?? right.id
  merged.target = left.target ?? right.target
  merged.description = `${left.description ?? ""} + ${right.id}`
  return merged
}

function expandPack(pack, atoms = loadAtoms()) {
  const { extends: atomNames = [], ...inlineFields } = pack
  let expanded = { ...inlineFields }
  for (const key of PACK_FIELDS) delete expanded[key]
  for (const atomName of atomNames) {
    const atom = atoms[atomName]
    if (!atom) throw new Error(`Unknown atom "${atomName}" in pack ${pack.id ?? "<inline>"}`)
    expanded = mergePackFields(expanded, atom)
  }
  return mergePackFields(expanded, inlineFields)
}

function mergePackFields(base, extra) {
  const merged = { ...base }
  for (const key of PACK_FIELDS) {
    merged[key] = unique([...(base[key] ?? []), ...(extra[key] ?? [])])
  }
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

export function defaultProjectConfig(pack, modelName) {
  const repoKind = defaultRepoKindForPack(pack)
  return {
    repoKind,
    packs: [pack.id],
    models: modelName,
    mcp: { baseline: ["context7", "grep_app", "exa"], disabled: [] },
    workflow: { mode: "standard", tdd: "required_for_code", claims: true, review: "standard" },
    runtimes: { node: true, bun: true, npx: false },
  }
}

function defaultRepoKindForPack(pack) {
  return pack.id === "backend" ? "backend" : pack.id === "infra" ? "infra" : "frontend"
}

function resolveSkillSources(skills, repoKind) {
  return Object.fromEntries(
    skills
      .map((skill) => [skill, findSkillSourcePath(skill, repoKind)])
      .filter(([, source]) => Boolean(source)),
  )
}

function findSkillSourcePath(skill, repoKind) {
  for (const candidate of skillSourceCandidates(skill, repoKind)) {
    if (pathExists(join(candidate, "SKILL.md"))) return candidate
  }
  return null
}

function skillSourceCandidates(skill, repoKind) {
  const scopeKinds = unique([repoKind, ...SCOPE_KINDS].filter(Boolean))
  return [
    join(REPO_ROOT, "universal", "skills", skill),
    ...scopeKinds.map((kind) => join(REPO_ROOT, "scopes", kind, "skills", skill)),
    join(REPO_ROOT, "skills", skill),
    ...scopeKinds.map((kind) => join(REPO_ROOT, "vendor", "skills", "scopes", kind, skill)),
    join(REPO_ROOT, "vendor", "skills", "external", skill),
    ...vendorSkillPathsFor(skill),
  ]
}

function vendorSkillPathsFor(skill) {
  if (!vendorSkillPathsCache) vendorSkillPathsCache = loadVendorSkillPaths()
  return vendorSkillPathsCache.get(skill) ?? []
}

function loadVendorSkillPaths() {
  const lockPath = join(REPO_ROOT, "vendor.lock.json")
  const paths = new Map()
  if (!pathExists(lockPath)) return paths
  for (const entry of readJson(lockPath)) {
    if (entry.kind !== "skill" || !entry.name) continue
    paths.set(entry.name, (entry.paths ?? []).map((rel) => join(REPO_ROOT, rel)))
  }
  return paths
}

export function detectMcpConflicts(project, packMcp) {
  const baseline = new Set(unique(project?.mcp?.baseline ?? packMcp ?? []))
  const warnings = []
  for (const name of project?.mcp?.disabled ?? []) {
    if (!baseline.has(name)) warnings.push(`mcp.disabled lists "${name}" but it is not in mcp.baseline or the pack's MCP list — no-op`)
  }
  for (const name of project?.mcp?.baseline ?? []) {
    if (!MCP_CONFIGS[name]) warnings.push(`mcp.baseline lists "${name}" which is not declared in defaults.json — will be dropped`)
  }
  return warnings
}

export function resolveConfig(options, projectDir = process.cwd()) {
  const { pack, project } = buildPack(options, projectDir)
  const modelName = options.models ?? project?.models ?? "github-copilot"
  const models = loadModelMap(modelName)
  const resolvedProject = project ?? defaultProjectConfig(pack, modelName)
  const targetDir = options.target === "global" ? join(process.env.HOME, ".config", "opencode") : join(projectDir, ".opencode")
  const disabledMcp = new Set(project?.mcp?.disabled ?? [])
  const mcpNames = unique(project?.mcp?.baseline ?? pack.mcp ?? []).filter((name) => !disabledMcp.has(name))
  for (const warning of detectMcpConflicts(project, pack.mcp)) console.warn(`WARN: ${warning}`)
  const skills = pack.skills ?? []
  const resolved = {
    project: resolvedProject,
    pack,
    models,
    modelName,
    target: options.target,
    targetDir,
    agents: pack.agents ?? [],
    skills,
    skillSources: resolveSkillSources(skills, resolvedProject.repoKind),
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
  const installedAt = new Date().toISOString()
  console.log("Alloy Setup")
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
  migrateSpecsToPlans(projectDir, options.dryRun)
  ensureAlloyProject(projectDir, resolved, options.dryRun, options.config)
  backupManaged(resolved.targetDir, options.dryRun)
  installCoreFiles(resolved, options.dryRun)
  installPlugin(resolved, projectDir, options.dryRun)
  writeOpenCodeConfig(resolved, options.dryRun)
  writePresets(resolved.targetDir, options.dryRun)
  writeInstallManifest(resolved, installedAt, options.dryRun)
  if (options.target === "global") writeGlobalInstallState(resolved, installedAt, options.dryRun)
  cleanupDeprecated(resolved.targetDir, options.dryRun)
  if (options.dryRun) {
    console.log(resolved.pack.id === "core" ? "Alloy core pack installed (dry-run plan only)" : "Alloy pack installed (dry-run plan only)")
    console.log("Dry run complete; no files were written.")
    return 0
  }
  updateProjections(projectDir)
  console.log(resolved.pack.id === "core" ? "Alloy core pack installed" : "Alloy pack installed")
  return auditTarget(resolved, projectDir)
}

function migrateSpecsToPlans(projectDir, dryRun = false) {
  const specsDir = join(projectDir, ".alloy", "specs")
  const plansDir = join(projectDir, ".alloy", "plans")
  if (!existsSync(specsDir) || existsSync(plansDir)) return
  if (dryRun) {
    logAction(`migrate ${relative(projectDir, specsDir)} to ${relative(projectDir, plansDir)}`, true)
    return
  }
  mkdirSync(dirname(plansDir), { recursive: true })
  renameSync(specsDir, plansDir)
  console.log("Migrated .alloy/specs to .alloy/plans")
}

function writeInstallManifest(resolved, installedAt, dryRun = false) {
  const manifest = createManifest(resolved, installedAt)
  writeJson(manifestPathForTarget(resolved.targetDir), manifest, dryRun)
}

function writeGlobalInstallState(resolved, installedAt, dryRun = false) {
  const state = createGlobalState(resolved, installedAt)
  writeJson(globalStatePath(), state, dryRun)
}

function installCoreFiles(resolved, dryRun = false) {
  console.log("Core files")
  for (const agent of resolved.agents) copyFile(join(REPO_ROOT, "agents", `${agent}.md`), join(resolved.targetDir, "agents", `${agent}.md`), dryRun)
  for (const command of resolved.commands) copyFile(join(REPO_ROOT, "commands", `${command}.md`), join(resolved.targetDir, "commands", `${command}.md`), dryRun)
  for (const skill of resolved.skills) {
    const source = resolved.skillSources[skill]
    if (!source) throw new Error(`Missing source directory for skill: ${skill}`)
    copyDir(source, join(resolved.targetDir, "skills", skill), dryRun)
  }
  console.log("")
}

function installPlugin(resolved, projectDir, dryRun = false) {
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
  copyFile(join(REPO_ROOT, "templates", "opencode", "safety-net-rules-template.json"), join(projectDir, ".safety-net.json"), dryRun)
  writeText(join(resolved.targetDir, "alloy-runtime", "README.md"), "OpenCode loads the Alloy plugin from ../plugins/alloy.ts. Bun installs package.json dependencies.\n", dryRun)
  console.log("")
}

function cleanupDeprecated(targetDir, dryRun = false) {
  console.log("Cleanup")
  for (const skill of DEPRECATED_SKILLS) removePath(join(targetDir, "skills", skill), dryRun)
  for (const agent of [...DEPRECATED_AGENTS, ...RETIRED_ALLOY_AGENT_NAMES]) removePath(join(targetDir, "agents", `${agent}.md`), dryRun)
  console.log("")
}

function writeOpenCodeConfig(resolved, dryRun = false) {
  const configPath = join(resolved.targetDir, "opencode.json")
  const generated = {
    "$schema": "https://opencode.ai/config.json",
    autoupdate: false,
    default_agent: "Orchestrator",
    plugin: ["cc-safety-net"],
    agent: agentModelConfig(resolved.models),
    mcp: resolved.mcp,
  }
  const config = resolved.target === "global" && pathExists(configPath)
    ? mergeOpenCodeConfig(readJson(configPath), generated)
    : generated
  writeJson(configPath, config, dryRun)
}

function writePresets(targetDir, dryRun = false) {
  const sourcePath = join(REPO_ROOT, "packs", "presets.json")
  if (!pathExists(sourcePath)) return
  copyFile(sourcePath, join(targetDir, "presets.json"), dryRun)
}

function mergeOpenCodeConfig(existing, generated) {
  const merged = mergeConfigValue(generated, existing)
  merged.plugin = unique([...(Array.isArray(existing.plugin) ? existing.plugin : []), ...(Array.isArray(generated.plugin) ? generated.plugin : [])])
  merged.mcp = { ...(generated.mcp ?? {}), ...(existing.mcp ?? {}) }
  return merged
}

function mergeConfigValue(generated, existing) {
  if (isPlainObject(generated) && isPlainObject(existing)) {
    const merged = {}
    for (const key of unique([...Object.keys(generated), ...Object.keys(existing)])) {
      merged[key] = mergeConfigValue(generated[key], existing[key])
    }
    return merged
  }
  if (existing !== undefined) return existing
  return generated
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
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
  const failures = validatePackRefs(resolved.pack, resolved.project.repoKind)
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

function validatePackRefs(pack, repoKind = defaultRepoKindForPack(pack)) {
  const failures = []
  for (const agent of pack.agents ?? []) if (!pathExists(join(REPO_ROOT, "agents", `${agent}.md`))) failures.push(`pack ${pack.id} references missing agent: ${agent}`)
  for (const command of pack.commands ?? []) if (!pathExists(join(REPO_ROOT, "commands", `${command}.md`))) failures.push(`pack ${pack.id} references missing command: ${command}`)
  for (const skill of pack.skills ?? []) {
    if (!findSkillSourcePath(skill, repoKind)) {
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
  for (const rel of ["opencode.json", "package.json", "plugins/alloy.ts", "alloy.manifest.json", "presets.json"]) if (!pathExists(join(resolved.targetDir, rel))) failures.push(`Target missing ${rel}`)
  return failures
}

function doctorCommand(options, projectDir = process.cwd()) {
  console.log("Alloy Doctor")
  const resolved = resolveConfig(options, projectDir)
  const failures = []
  const warnings = []
  failures.push(...validatePackRefs(resolved.pack, resolved.project.repoKind))
  failures.push(...validateVendorLock())
  failures.push(...validateRootOpencodeConfig())
  if (!pathExists(resolved.targetDir)) {
    if (failures.length) {
      for (const failure of failures) console.error(`FAIL: ${failure}`)
      return 1
    }
    console.log("OK: packs, defaults, and vendor lock passed")
    console.log("Run alloy install first for full doctor")
    return 0
  }
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
  failures.push(...validateTargetFiles(resolved))
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

function validateRootOpencodeConfig() {
  const path = join(REPO_ROOT, "opencode.json")
  if (!pathExists(path)) return []
  const config = readJson(path)
  const failures = []
  for (const [name, expected] of Object.entries(MCP_CONFIGS)) {
    const actual = config.mcp?.[name]
    if (!actual) {
      failures.push(`opencode.json missing MCP "${name}" (declared in defaults.json)`)
      continue
    }
    for (const key of ["type", "url"]) {
      if (actual[key] !== expected[key]) failures.push(`opencode.json MCP "${name}.${key}" is "${actual[key]}" but defaults.json says "${expected[key]}"`)
    }
  }
  return failures
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

function addCommand(options, projectDir = process.cwd()) {
  const [name] = options.positionals
  if (!name) throw new Error("Usage: alloy add <skill-or-agent>")
  if (name === "container-use") return addContainerUseCommand(projectDir)

  const manifest = readManifest(projectDir)
  const targetDir = join(projectDir, ".opencode")
  const item = findInstallableItem(name, targetDir)
  if (!item) throw new Error(`No Alloy skill or agent named "${name}" was found`)

  const wasManaged = manifest.managed[item.kind]?.includes(item.name)
  if (item.kind === "skills") installSkill(item.name, targetDir)
  else installAgent(item.name, targetDir)
  addVisibleItem(manifest, item.kind, item.name, { explicit: !wasManaged })
  writeProjectManifest(projectDir, manifest)
  console.log(`Added ${item.type}: ${item.name}`)
  return 0
}

function removeCommand(options, projectDir = process.cwd()) {
  const [name] = options.positionals
  if (!name) throw new Error("Usage: alloy remove <skill-or-agent>")
  const manifest = readManifest(projectDir)
  if (name === "container-use") return removeContainerUseCommand(projectDir, manifest)
  const item = findManifestItem(manifest, name) ?? findInstallableItem(name, join(projectDir, ".opencode"))
  if (!item || !["skills", "agents"].includes(item.kind)) throw new Error(`No visible Alloy skill or agent named "${name}" was found`)
  removeVisibleItem(manifest, item.kind, item.name)
  writeProjectManifest(projectDir, manifest)
  console.log(`Removed ${item.type}: ${item.name}`)
  return 0
}

function listCommand(options, projectDir = process.cwd()) {
  const manifest = readManifest(projectDir)
  const lines = [
    `Alloy manifest: ${manifest.pack} (${manifest.version})`,
    `Models: ${manifest.models}`,
    `Managed skills: ${manifest.managed.skills.join(", ") || "(none)"}`,
    `Visible skills: ${manifest.visible.skills.join(", ") || "(none)"}`,
    `Managed agents: ${manifest.managed.agents.join(", ") || "(none)"}`,
    `Visible agents: ${manifest.visible.agents.join(", ") || "(none)"}`,
    `Managed commands: ${manifest.managed.commands.join(", ") || "(none)"}`,
    `Managed MCP: ${manifest.managed.mcp.join(", ") || "(none)"}`,
    `Explicit added: ${manifest.explicit.added.join(", ") || "(none)"}`,
    `Excluded: ${manifest.excluded.join(", ") || "(none)"}`,
  ]
  console.log(lines.join("\n"))
  return 0
}

function searchCommand(options) {
  const [query] = options.positionals
  if (!query) throw new Error("Usage: alloy search <query>")
  const normalized = query.toLowerCase()
  const matches = internalInventory().filter((item) => `${item.name} ${item.kind} ${item.source ?? ""}`.toLowerCase().includes(normalized))
  console.log("Internal inventory")
  if (matches.length) {
    for (const item of matches) console.log(`- ${item.kind}: ${item.name}${item.source ? ` (${item.source})` : ""}`)
  } else {
    console.log("- no internal matches")
  }
  const npxPath = which("npx")
  if (!npxPath) return 0
  console.log("")
  console.log("External skills search (npx skills find)")
  const result = spawnSync("npx", ["skills", "find", query], { encoding: "utf8" })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  if (result.error) console.error(`WARN: npx skills find failed: ${result.error.message}`)
  return 0
}

function addContainerUseCommand(projectDir) {
  const prereqs = checkContainerUsePrereqs()
  if (!prereqs.ok) {
    console.error(`Missing container-use prerequisites: ${prereqs.missing.join(", ")}`)
    console.error(prereqs.installHint)
    return 1
  }

  const manifest = readManifest(projectDir)
  const targetDir = join(projectDir, ".opencode")
  installSkill("using-sandboxes", targetDir)
  addVisibleItem(manifest, "skills", "using-sandboxes", { explicit: true })
  addManagedMcp(manifest, "container-use", { explicit: true })
  writeProjectManifest(projectDir, manifest)
  enableMcpInOpenCodeConfig(targetDir, "container-use")
  console.log("Added container-use MCP and using-sandboxes skill")
  return 0
}

function removeContainerUseCommand(projectDir, manifest) {
  removeVisibleItem(manifest, "skills", "using-sandboxes")
  manifest.managed.mcp = manifest.managed.mcp.filter((item) => item !== "container-use")
  manifest.excluded = unique([...manifest.excluded, "container-use"])
  manifest.explicit.added = manifest.explicit.added.filter((item) => item !== "container-use")
  writeProjectManifest(projectDir, manifest)
  const targetDir = join(projectDir, ".opencode")
  const configPath = join(targetDir, "opencode.json")
  if (pathExists(configPath)) {
    const config = readJson(configPath)
    if (config.mcp?.["container-use"]) config.mcp["container-use"].enabled = false
    writeJson(configPath, config)
  }
  console.log("Removed container-use MCP visibility")
  return 0
}

function enableMcpInOpenCodeConfig(targetDir, name) {
  const configPath = join(targetDir, "opencode.json")
  if (!pathExists(configPath)) throw new Error(`Missing OpenCode config: ${configPath}. Run alloy install first.`)
  const config = readJson(configPath)
  config.mcp ??= {}
  if (!MCP_CONFIGS[name]) throw new Error(`Unknown MCP: ${name}`)
  config.mcp[name] = { ...MCP_CONFIGS[name], enabled: true }
  writeJson(configPath, config)
}

function findManifestItem(manifest, name) {
  const normalized = normalizeManifest(manifest)
  for (const kind of ["skills", "agents"]) {
    const found = [...normalized.managed[kind], ...normalized.visible[kind]].find((item) => item === name)
    if (found) return { kind, type: kind.slice(0, -1), name: found }
  }
  return null
}

function findInstallableItem(name, targetDir) {
  const inventory = internalInventory()
  const exact = inventory.find((item) => ["skill", "agent"].includes(item.kind) && item.name === name)
  const item = exact ?? findUniquePrefix(inventory.filter((entry) => ["skill", "agent"].includes(entry.kind)), name)
  if (item) return { kind: `${item.kind}s`, type: item.kind, name: item.name }
  if (pathExists(join(targetDir, "skills", name, "SKILL.md"))) return { kind: "skills", type: "skill", name }
  if (pathExists(join(targetDir, "agents", `${name}.md`))) return { kind: "agents", type: "agent", name }
  return null
}

function findUniquePrefix(items, query) {
  const matches = items.filter((item) => item.name.startsWith(query))
  return matches.length === 1 ? matches[0] : null
}

function installSkill(name, targetDir) {
  if (pathExists(join(targetDir, "skills", name, "SKILL.md"))) return
  const source = findSkillSourcePath(name, "frontend")
  if (!source) throw new Error(`Missing source directory for skill: ${name}`)
  copyDir(source, join(targetDir, "skills", name))
}

function installAgent(name, targetDir) {
  const dest = join(targetDir, "agents", `${name}.md`)
  if (pathExists(dest)) return
  copyFile(join(REPO_ROOT, "agents", `${name}.md`), dest)
}

function internalInventory() {
  const items = new Map()
  const add = (kind, name, source) => {
    if (!name) return
    const key = `${kind}:${name}`
    if (!items.has(key)) items.set(key, { kind, name, source })
  }
  for (const packId of ["core", "frontend", "backend", "infra", "all"]) {
    const pack = loadPack(packId)
    for (const skill of pack.skills ?? []) add("skill", skill, `pack:${packId}`)
    for (const agent of pack.agents ?? []) add("agent", agent, `pack:${packId}`)
    for (const command of pack.commands ?? []) add("command", command, `pack:${packId}`)
    for (const mcp of pack.mcp ?? []) add("mcp", mcp, `pack:${packId}`)
  }
  for (const skill of scanSkillNames()) add("skill", skill, "source")
  for (const agent of scanAgentNames()) add("agent", agent, "source")
  for (const command of scanCommandNames()) add("command", command, "source")
  for (const mcp of Object.keys(MCP_CONFIGS)) add("mcp", mcp, "defaults")
  return [...items.values()].sort((a, b) => `${a.kind}:${a.name}`.localeCompare(`${b.kind}:${b.name}`))
}

function scanSkillNames() {
  const names = []
  const roots = [
    join(REPO_ROOT, "universal", "skills"),
    ...SCOPE_KINDS.map((kind) => join(REPO_ROOT, "scopes", kind, "skills")),
    join(REPO_ROOT, "skills"),
    ...SCOPE_KINDS.map((kind) => join(REPO_ROOT, "vendor", "skills", "scopes", kind)),
    join(REPO_ROOT, "vendor", "skills", "external"),
  ]
  for (const root of roots) {
    if (!pathExists(root)) continue
    for (const entry of readdirSync(root)) {
      if (pathExists(join(root, entry, "SKILL.md"))) names.push(entry)
    }
  }
  const lockPath = vendorLockPath()
  if (pathExists(lockPath)) {
    for (const entry of readJson(lockPath)) {
      if (entry.kind === "skill" && entry.name) names.push(entry.name)
    }
  }
  return unique(names)
}

function scanAgentNames() {
  const dir = join(REPO_ROOT, "agents")
  if (!pathExists(dir)) return []
  return readdirSync(dir).filter((name) => name.endsWith(".md")).map((name) => name.slice(0, -3))
}

function scanCommandNames() {
  const dir = join(REPO_ROOT, "commands")
  if (!pathExists(dir)) return []
  return readdirSync(dir).filter((name) => name.endsWith(".md")).map((name) => name.slice(0, -3))
}

async function outdatedCommand() {
  const rows = await collectVendorOutdatedRows()
  printVendorTable(rows)
  return 0
}

async function upgradeCommand(options) {
  if (options.self) return upgradeSelf()
  if (options.allVendors) {
    const rows = await collectVendorOutdatedRows()
    printVendorTable(rows)
    const outdated = rows.filter((row) => row.status === "outdated")
    if (!outdated.length) {
      console.log("No out-of-date vendors found")
      return 0
    }
    for (const row of outdated) {
      const entry = resolveVendorEntry(row.name)
      const code = upgradeVendorEntry(entry)
      if (code !== 0) return code
    }
    return 0
  }
  const [query] = options.positionals
  if (!query) throw new Error("Usage: alloy upgrade <vendor-name>|--self|--all-vendors")
  const entry = resolveVendorEntry(query)
  return upgradeVendorEntry(entry)
}

async function collectVendorOutdatedRows() {
  const entries = readVendorLock()
  const rows = []
  for (const entry of entries) rows.push(await vendorOutdatedRow(entry))
  return rows
}

function readVendorLock() {
  const path = vendorLockPath()
  if (!pathExists(path)) throw new Error(`Missing vendor.lock.json: ${path}`)
  return readJson(path)
}

async function vendorOutdatedRow(entry) {
  const repo = parseGitHubRepo(entry.source ?? "")
  const installed = entry.version ?? "-"
  if (!repo) return { name: entry.name, installed, latest: "-", status: "skipped" }
  try {
    const latest = await fetchLatestRelease(repo.owner, repo.repo)
    const status = installed === "vendored-local" ? "local" : sameVersion(installed, latest) ? "current" : "outdated"
    return { name: entry.name, installed, latest: latest ?? "-", status }
  } catch (error) {
    return { name: entry.name, installed, latest: "-", status: `error: ${error.message}` }
  }
}

function parseGitHubRepo(source) {
  const match = source.match(/^https?:\/\/github\.com\/([^/]+)\/([^/.#?]+)/)
  if (!match) return null
  return { owner: match[1], repo: match[2] }
}

async function fetchLatestRelease(owner, repo) {
  const mocked = mockedRelease(owner, repo)
  if (mocked !== undefined) return mocked
  const base = (process.env.ALLOY_GITHUB_API_BASE || "https://api.github.com").replace(/\/$/, "")
  const headers = { "User-Agent": "alloy", "Accept": "application/vnd.github+json" }
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  const release = await fetch(`${base}/repos/${owner}/${repo}/releases/latest`, { headers, signal: fetchTimeoutSignal() })
  if (release.status === 404) return fetchLatestTag(base, owner, repo, headers)
  if (!release.ok) throw new Error(`GitHub releases API returned ${release.status}`)
  const json = await release.json()
  return json.tag_name ?? json.name ?? null
}

function mockedRelease(owner, repo) {
  if (!process.env.ALLOY_GITHUB_RELEASES_JSON) return undefined
  const releases = JSON.parse(process.env.ALLOY_GITHUB_RELEASES_JSON)
  return Object.hasOwn(releases, `${owner}/${repo}`) ? releases[`${owner}/${repo}`] : null
}

async function fetchLatestTag(base, owner, repo, headers) {
  const tags = await fetch(`${base}/repos/${owner}/${repo}/tags`, { headers, signal: fetchTimeoutSignal() })
  if (!tags.ok) throw new Error(`GitHub tags API returned ${tags.status}`)
  const json = await tags.json()
  return json[0]?.name ?? null
}

function fetchTimeoutSignal() {
  return AbortSignal.timeout(Number(process.env.ALLOY_FETCH_TIMEOUT_MS ?? 8000))
}

function sameVersion(left, right) {
  return normalizeVersion(left) === normalizeVersion(right)
}

function normalizeVersion(version) {
  return String(version ?? "").replace(/^v/, "")
}

function printVendorTable(rows) {
  const allRows = [{ name: "name", installed: "installed", latest: "latest", status: "status" }, ...rows]
  const widths = ["name", "installed", "latest", "status"].map((key) => Math.max(...allRows.map((row) => String(row[key] ?? "").length)))
  for (const [index, row] of allRows.entries()) {
    const line = ["name", "installed", "latest", "status"].map((key, i) => String(row[key] ?? "").padEnd(widths[i])).join(" | ")
    console.log(line)
    if (index === 0) console.log(widths.map((width) => "-".repeat(width)).join("-|-"))
  }
}

function resolveVendorName(query) {
  return resolveVendorEntry(query).name
}

function resolveVendorEntry(query) {
  const entries = readVendorLock()
  const exact = entries.find((entry) => entry.name === query)
  if (exact) return exact
  const matches = entries.filter((entry) => entry.name?.startsWith(query))
  if (matches.length === 1) return matches[0]
  if (matches.length > 1) throw new Error(`Vendor name "${query}" is ambiguous: ${matches.map((entry) => entry.name).join(", ")}`)
  throw new Error(`No vendor.lock.json entry named: ${query}`)
}

function upgradeVendorEntry(entry) {
  if (isVendoredLocalEntry(entry)) return verifyVendoredLocalEntry(entry)
  return runRevendor(entry.name)
}

function isVendoredLocalEntry(entry) {
  return entry.version === "vendored-local" || entry.source === "vendored-local" || entry.vendorKind === "vendored-local"
}

function verifyVendoredLocalEntry(entry) {
  const missing = (entry.paths ?? []).filter((rel) => !pathExists(join(REPO_ROOT, rel)))
  if (missing.length) {
    console.error(`vendored-local ${entry.name} is missing locked paths:`)
    for (const rel of missing) console.error(`- ${rel}`)
    return 2
  }
  console.log(`vendored-local ${entry.name}: verified ${entry.paths?.length ?? 0} path(s); skipping revendor --apply`)
  return 0
}

function runRevendor(name) {
  const script = process.env.ALLOY_REVENDOR_SCRIPT || join(REPO_ROOT, "scripts", "revendor.mjs")
  console.log(`Revendor: ${name}`)
  const result = spawnSync(process.execPath, [script, "--apply", name], { cwd: REPO_ROOT, stdio: "inherit", env: process.env })
  return result.status ?? 1
}

function upgradeSelf() {
  const url = process.env.ALLOY_SELF_UPGRADE_URL || "https://raw.githubusercontent.com/lifeodyssey/alloy/main/install.sh"
  console.log(`Running Alloy self-upgrade from ${url}`)
  const result = spawnSync("/bin/bash", ["-c", `curl -fsSL ${shellQuote(url)} | bash`], { stdio: "inherit", env: process.env })
  return result.status ?? 1
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`
}

function versionCommand() {
  console.log(PACKAGE.version)
  return 0
}

function completionCommand(options) {
  const [shell] = options.positionals
  if (!COMPLETION_SHELLS.includes(shell)) throw new Error("Usage: alloy completion bash|zsh|fish")
  console.log(completionScript(shell))
  return 0
}

function completionScript(shell) {
  if (shell === "bash") return bashCompletionScript()
  if (shell === "zsh") return zshCompletionScript()
  return fishCompletionScript()
}

function bashCompletionScript() {
  const commands = COMPLETION_COMMANDS.join(" ")
  const packs = COMPLETION_PACKS.join(" ")
  const targets = COMPLETION_TARGETS.join(" ")
  const shells = COMPLETION_SHELLS.join(" ")
  return [
    "#!/usr/bin/env bash",
    "",
    "_alloy_complete() {",
    "  local cur prev commands packs targets shells opts",
    `  commands="${commands}"`,
    `  packs="${packs}"`,
    `  targets="${targets}"`,
    `  shells="${shells}"`,
    '  opts="--pack --profile --target --models --dry-run --json --help --doctor --audit-only --config"',
    '  cur="${COMP_WORDS[COMP_CWORD]}"',
    '  prev="${COMP_WORDS[COMP_CWORD-1]}"',
    "",
    '  case "${prev}" in',
    '    --pack|--profile) COMPREPLY=( $(compgen -W "${packs}" -- "${cur}") ); return 0 ;;',
    '    --target) COMPREPLY=( $(compgen -W "${targets}" -- "${cur}") ); return 0 ;;',
    "  esac",
    "",
    '  if [[ "${COMP_CWORD}" -eq 1 ]]; then',
    '    COMPREPLY=( $(compgen -W "${commands}" -- "${cur}") )',
    "    return 0",
    "  fi",
    "",
    '  case "${COMP_WORDS[1]}" in',
    '    completion) COMPREPLY=( $(compgen -W "${shells}" -- "${cur}") ) ;;',
    '    install|doctor) COMPREPLY=( $(compgen -W "${opts} ${packs}" -- "${cur}") ) ;;',
    '    list) COMPREPLY=( $(compgen -W "${opts}" -- "${cur}") ) ;;',
    '    *) COMPREPLY=( $(compgen -W "${opts}" -- "${cur}") ) ;;',
    "  esac",
    "}",
    "",
    "complete -F _alloy_complete alloy",
  ].join("\n")
}

function zshCompletionScript() {
  return [
    "#compdef alloy",
    "",
    "_alloy() {",
    "  if (( CURRENT == 2 )); then",
    `    _values 'command' ${COMPLETION_COMMANDS.join(" ")}`,
    "    return",
    "  fi",
    "",
    '  case "$words[2]" in',
    "    completion)",
    `      _values 'shell' ${COMPLETION_SHELLS.join(" ")}`,
    "      ;;",
    "    install|doctor|list)",
    "      _arguments \\",
    "        '--pack[pack id]:pack:(core frontend backend infra all)' \\",
    "        '--profile[deprecated alias for --pack]:pack:(core frontend backend infra all)' \\",
    "        '--target[install target]:target:(local global)' \\",
    "        '--models[model map]' \\",
    "        '--dry-run[print install plan without writing]' \\",
    "        '--json[print JSON output]' \\",
    "        '--help[show help]'",
    "      ;;",
    "    *)",
    "      _arguments '--help[show help]'",
    "      ;;",
    "  esac",
    "}",
    "",
    "_alloy \"$@\"",
  ].join("\n")
}

function fishCompletionScript() {
  return [
    "complete -c alloy -f",
    `complete -c alloy -n "__fish_use_subcommand" -a "${COMPLETION_COMMANDS.join(" ")}" -d "Alloy command"`,
    `complete -c alloy -n "__fish_seen_subcommand_from completion" -a "${COMPLETION_SHELLS.join(" ")}"`,
    `complete -c alloy -n "__fish_seen_subcommand_from install doctor list" -l pack -r -a "${COMPLETION_PACKS.join(" ")}"`,
    `complete -c alloy -n "__fish_seen_subcommand_from install doctor list" -l profile -r -a "${COMPLETION_PACKS.join(" ")}" -d "Deprecated alias for --pack"`,
    `complete -c alloy -n "__fish_seen_subcommand_from install doctor list" -l target -r -a "${COMPLETION_TARGETS.join(" ")}"`,
    "complete -c alloy -n \"__fish_seen_subcommand_from install doctor list\" -l models -r",
    "complete -c alloy -n \"__fish_seen_subcommand_from install doctor list\" -l dry-run",
    "complete -c alloy -n \"__fish_seen_subcommand_from install doctor list\" -l json",
    "complete -c alloy -l help",
  ].join("\n")
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
  console.log("Alloy Sync")
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
    if (options.command === "version") return versionCommand()
    if (options.command === "init") return initCommand(options)
    if (options.command === "resolve") return resolveCommand(options)
    if (options.command === "install") return installCommand(options)
    if (options.command === "add") return addCommand(options)
    if (options.command === "remove") return removeCommand(options)
    if (options.command === "list") return listCommand(options)
    if (options.command === "search") return searchCommand(options)
    if (options.command === "outdated") return await outdatedCommand(options)
    if (options.command === "upgrade") return await upgradeCommand(options)
    if (options.command === "completion") return completionCommand(options)
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

function isCliEntryPoint(argvPath, modulePath) {
  if (!argvPath) return false

  const resolvedArgvPath = resolve(argvPath)
  if (resolvedArgvPath === modulePath) return true

  try {
    return realpathSync(resolvedArgvPath) === realpathSync(modulePath)
  } catch {
    return resolvedArgvPath === modulePath
  }
}

const isEntryPoint = isCliEntryPoint(process.argv[1], fileURLToPath(import.meta.url))
if (isEntryPoint) {
  process.exitCode = await main(process.argv.slice(2))
}
