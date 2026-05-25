import test from "node:test"
import assert from "node:assert/strict"

import {
  DEFAULTS,
  parseArgs,
  loadPack,
  mergePack,
  defaultProjectConfig,
  detectMcpConflicts,
} from "../bin/alloy.mjs"

test("defaults.json exposes the pinned plugin and MCP shape", () => {
  assert.equal(typeof DEFAULTS.plugin["@opencode-ai/plugin"], "string")
  assert.equal(typeof DEFAULTS.plugin.zod, "string")
  assert.ok(DEFAULTS.mcp.context7?.url?.startsWith("https://"))
  assert.ok(DEFAULTS.mcp.grep_app?.url?.startsWith("https://"))
  assert.ok(DEFAULTS.mcp.exa?.url?.startsWith("https://"))
})

test("parseArgs defaults to install/core/local", () => {
  const opts = parseArgs([])
  assert.equal(opts.command, "install")
  assert.equal(opts.pack, "core")
  assert.equal(opts.target, "local")
})

test("parseArgs accepts --profile as a deprecated alias for --pack", () => {
  const opts = parseArgs(["--profile", "frontend"])
  assert.equal(opts.pack, "frontend")
  assert.equal(opts.usedProfileAlias, true)
})

test("parseArgs rejects removed --with/--without flags", () => {
  assert.throws(() => parseArgs(["--with", "gsd"]), /removed in Alloy v2/)
  assert.throws(() => parseArgs(["--without", "omo"]), /removed in Alloy v2/)
})

test("parseArgs rejects invalid target", () => {
  assert.throws(() => parseArgs(["--target", "nope"]), /target must be local or global/)
})

test("loadPack: 'profile' alias resolves to core", () => {
  const pack = loadPack("profile")
  assert.equal(pack.id, "core")
})

test("loadPack: 'default' alias resolves to core", () => {
  const pack = loadPack("default")
  assert.equal(pack.id, "core")
})

test("loadPack: unknown pack throws", () => {
  assert.throws(() => loadPack("nonexistent-pack"), /Unknown pack/)
})

test("loadPack: deleted workflow pack no longer resolves", () => {
  assert.throws(() => loadPack("workflow"), /Unknown pack/)
})

test("mergePack unions arrays and deduplicates", () => {
  const a = { id: "a", skills: ["s1"], agents: ["x"], commands: [], mcp: ["m1"], modelRoles: ["planner"] }
  const b = { id: "b", skills: ["s2", "s1"], agents: ["y"], commands: ["c1"], mcp: ["m1", "m2"], modelRoles: ["executor"] }
  const merged = mergePack(a, b)
  assert.deepEqual(merged.skills, ["s1", "s2"])
  assert.deepEqual(merged.agents, ["x", "y"])
  assert.deepEqual(merged.commands, ["c1"])
  assert.deepEqual(merged.mcp, ["m1", "m2"])
  assert.deepEqual(merged.modelRoles, ["planner", "executor"])
  assert.match(merged.description, /\+ b/)
})

test("mergePack tolerates missing fields", () => {
  const merged = mergePack({ id: "x" }, { id: "y" })
  assert.deepEqual(merged.skills, [])
  assert.deepEqual(merged.agents, [])
})

test("defaultProjectConfig infers frontend by default", () => {
  const cfg = defaultProjectConfig({ id: "core" }, "github-copilot")
  assert.equal(cfg.repoKind, "frontend")
  assert.deepEqual(cfg.packs, ["core"])
  assert.equal(cfg.models, "github-copilot")
  assert.deepEqual(cfg.mcp.baseline, ["context7", "grep_app", "exa"])
})

test("defaultProjectConfig infers backend from backend pack", () => {
  const cfg = defaultProjectConfig({ id: "backend" }, "openai")
  assert.equal(cfg.repoKind, "backend")
  assert.equal(cfg.models, "openai")
})

test("defaultProjectConfig infers infra from infra pack", () => {
  const cfg = defaultProjectConfig({ id: "infra" }, "github-copilot")
  assert.equal(cfg.repoKind, "infra")
})

test("defaultProjectConfig disables npx and enables bun by default", () => {
  const cfg = defaultProjectConfig({ id: "core" }, "github-copilot")
  assert.equal(cfg.runtimes.npx, false)
  assert.equal(cfg.runtimes.bun, true)
  assert.equal(cfg.runtimes.node, true)
})

test("detectMcpConflicts warns when disabled MCP is not in baseline", () => {
  const project = { mcp: { baseline: ["context7"], disabled: ["typo-name"] } }
  const warnings = detectMcpConflicts(project, [])
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /typo-name/)
  assert.match(warnings[0], /no-op/)
})

test("detectMcpConflicts warns when baseline contains an MCP not in defaults.json", () => {
  const project = { mcp: { baseline: ["context7", "ghost-mcp"], disabled: [] } }
  const warnings = detectMcpConflicts(project, [])
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /ghost-mcp/)
  assert.match(warnings[0], /defaults\.json/)
})

test("detectMcpConflicts is silent when configuration is consistent", () => {
  const project = { mcp: { baseline: ["context7", "grep_app"], disabled: ["context7"] } }
  const warnings = detectMcpConflicts(project, [])
  assert.deepEqual(warnings, [])
})

test("real packs only reference MCPs declared in defaults.json", () => {
  const knownMcp = new Set(Object.keys(DEFAULTS.mcp))
  for (const id of ["core", "frontend", "backend", "infra", "all"]) {
    const pack = loadPack(id)
    for (const name of pack.mcp ?? []) {
      assert.ok(knownMcp.has(name), `pack ${id} references unknown MCP: ${name}`)
    }
  }
})
