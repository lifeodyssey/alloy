import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = resolve(__dirname, "..")
const DEFAULTS_PATH = join(REPO_ROOT, "defaults.json")
const DEFAULT_PROJECT_CONFIG = ".alloy/alloy.project.json"
const PACK_ALIASES = {
  default: "core",
  team: "core",
  profile: "core",
}
const PACK_FIELDS = ["skills", "agents", "commands", "mcp", "modelRoles"]
const SCOPE_KINDS = ["frontend", "backend", "infra"]

let atomsCache
let vendorSkillPathsCache

export const DEFAULTS = loadDefaults()
export const OPENCODE_PLUGIN_VERSION = DEFAULTS.plugin["@opencode-ai/plugin"]
export const ZOD_VERSION = DEFAULTS.plugin.zod
export const MCP_CONFIGS = DEFAULTS.mcp

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

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"))
}

function pathExists(path) {
  return existsSync(path)
}

function unique(items) {
  return [...new Set(items.filter(Boolean))]
}

export function loadAtoms() {
  if (atomsCache) return atomsCache
  const atomsPath = join(REPO_ROOT, "packs", "atoms.json")
  if (!pathExists(atomsPath)) throw new Error(`Missing atoms file: ${atomsPath}`)
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
  let expanded = {}
  for (const key of PACK_FIELDS) delete expanded[key]
  for (const atomName of atomNames) {
    const atom = atoms[atomName]
    if (!atom) throw new Error(`Unknown atom "${atomName}" in pack ${pack.id ?? "<inline>"}`)
    expanded = mergePackFields(expanded, atom)
  }
  return { ...pack, ...mergePackFields(expanded, inlineFields), extends: undefined }
}

function mergePackFields(base, extra) {
  const merged = { ...base, ...extra }
  for (const key of PACK_FIELDS) {
    merged[key] = unique([...(base[key] ?? []), ...(extra[key] ?? [])])
  }
  return merged
}

function buildPack(options, projectDir = process.cwd()) {
  let project = undefined
  if (options.config || !options.explicitPack) project = loadProjectConfig(projectDir, false, options.config)
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
    return undefined
  }
  return readJson(path)
}

export function projectConfigPath(projectDir, configPath) {
  return configPath ? resolve(projectDir, configPath) : join(projectDir, DEFAULT_PROJECT_CONFIG)
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

export function findSkillSourcePath(skill, repoKind) {
  return skillSourceCandidates(skill, repoKind).find((candidate) => pathExists(join(candidate, "SKILL.md")))
}

function skillSourceCandidates(skill, repoKind) {
  const scopeKinds = unique([repoKind, ...SCOPE_KINDS].filter(Boolean))
  return [
    join(REPO_ROOT, "universal", "skills", skill),
    ...scopeKinds.map((kind) => join(REPO_ROOT, "scopes", kind, "skills", skill)),
    join(REPO_ROOT, "vendor", "skills", "universal", skill),
    ...scopeKinds.map((kind) => join(REPO_ROOT, "vendor", "skills", "scopes", kind, skill)),
    ...(vendorSkillPathsFor(skill) ?? []),
  ]
}

function vendorSkillPathsFor(skill) {
  if (!vendorSkillPathsCache) vendorSkillPathsCache = loadVendorSkillPaths()
  return vendorSkillPathsCache.get(skill)
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
    if (!baseline.has(name)) warnings.push(`mcp.disabled lists "${name}" but it is not in mcp.baseline or the pack's MCP list - no-op`)
  }
  for (const name of project?.mcp?.baseline ?? []) {
    if (!MCP_CONFIGS[name]) warnings.push(`mcp.baseline lists "${name}" not declared in defaults.json - will be dropped`)
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
  return {
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
}
