import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  DEFAULTS,
  parseArgs,
  loadAtoms,
  loadPack,
  mergePack,
  defaultProjectConfig,
  detectMcpConflicts,
  resolveConfig,
} from "../bin/alloy.mjs"
import {
  addVisibleItem,
  createManifest,
  manifestPathFor,
  normalizeManifest,
  removeVisibleItem,
} from "../bin/manifest.mjs"
import {
  createGlobalState,
  vendorLockSha256,
} from "../bin/state.mjs"
import {
  checkContainerUsePrereqs,
} from "../bin/prereq-check.mjs"

test("defaults.json exposes the pinned plugin and MCP shape", () => {
  assert.equal(typeof DEFAULTS.plugin["@opencode-ai/plugin"], "string")
  assert.equal(typeof DEFAULTS.plugin.zod, "string")
  assert.ok(DEFAULTS.mcp.context7?.url?.startsWith("https://"))
  assert.ok(DEFAULTS.mcp.grep_app?.url?.startsWith("https://"))
  assert.ok(DEFAULTS.mcp.exa?.url?.startsWith("https://"))
  for (const name of ["chrome-devtools", "sequential-thinking", "figma-official", "a11y-mcp", "container-use"]) {
    assert.ok(DEFAULTS.mcp[name]?.url?.startsWith("https://"))
    assert.equal(DEFAULTS.mcp[name].enabled, false)
  }
})

test("parseArgs defaults to install/core/local", () => {
  const opts = parseArgs([])
  assert.equal(opts.command, "install")
  assert.equal(opts.pack, "core")
  assert.equal(opts.target, "local")
})

test("parseArgs recognizes CLI v3 subcommands and flags", () => {
  assert.equal(parseArgs(["add", "frontend-ui-ux"]).command, "add")
  assert.equal(parseArgs(["remove", "frontend-ui-ux"]).positionals[0], "frontend-ui-ux")
  assert.equal(parseArgs(["list", "--installed"]).installed, true)
  assert.equal(parseArgs(["search", "react"]).positionals[0], "react")
  assert.equal(parseArgs(["outdated"]).command, "outdated")
  assert.equal(parseArgs(["upgrade", "vercel-react"]).positionals[0], "vercel-react")
  assert.equal(parseArgs(["upgrade", "--self"]).self, true)
  assert.equal(parseArgs(["upgrade", "--all-vendors"]).allVendors, true)
})

test("parseArgs accepts positional pack names for install", () => {
  const explicit = parseArgs(["install", "frontend"])
  assert.equal(explicit.command, "install")
  assert.equal(explicit.pack, "frontend")
  assert.equal(explicit.explicitPack, true)

  const defaultCommand = parseArgs(["backend"])
  assert.equal(defaultCommand.command, "install")
  assert.equal(defaultCommand.pack, "backend")
  assert.equal(defaultCommand.explicitPack, true)
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

test("loadAtoms exposes atomic pack building blocks", () => {
  const atoms = loadAtoms()
  assert.deepEqual(atoms["alloy-baseline-5"].skills, ["alloy-tdd", "alloy-brainstorm", "alloy-debug", "git-master", "humanizer"])
  assert.ok(atoms["alloy-workflow-extras"].skills.includes("alloy-plan"))
  assert.deepEqual(atoms["mcp-baseline"].mcp, ["context7", "grep_app", "exa"])
  assert.ok(atoms["frontend-skills"].skills.includes("frontend-ui-ux"))
})

test("loadPack expands extends into concrete arrays", () => {
  const frontend = loadPack("frontend")
  assert.ok(frontend.skills.includes("alloy-tdd"))
  assert.ok(!frontend.skills.includes("alloy-plan"))
  assert.ok(frontend.skills.includes("frontend-ui-ux"))
  assert.deepEqual(frontend.mcp, ["context7", "grep_app", "exa"])
  assert.equal(frontend.extends, undefined)
})

test("loadPack reports unknown atoms used in extends", () => {
  assert.throws(
    () => mergePack({ id: "synthetic-pack", extends: ["nonexistent-atom"] }, { id: "extra" }),
    /Unknown atom "nonexistent-atom" in pack synthetic-pack/,
  )
})

test("mergePack loads empty extends as empty inventories", () => {
  const merged = mergePack({ id: "empty-pack", extends: [] }, { id: "extra-pack", extends: [] })
  assert.deepEqual(merged.skills, [])
  assert.deepEqual(merged.agents, [])
  assert.deepEqual(merged.commands, [])
  assert.deepEqual(merged.mcp, [])
  assert.deepEqual(merged.modelRoles, [])
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

test("mergePack expands extends while preserving inline pack compatibility", () => {
  const a = { id: "a", extends: ["mcp-baseline"], skills: ["inline-skill"], agents: ["InlineAgent"] }
  const b = { id: "b", extends: ["frontend-skills"], skills: ["frontend-ui-ux"], commands: ["inline-command"] }
  const merged = mergePack(a, b)
  assert.deepEqual(merged.mcp, ["context7", "grep_app", "exa"])
  assert.deepEqual(merged.skills, ["inline-skill", "frontend-ui-ux", "playwright-cli", "vercel-react-best-practices"])
  assert.deepEqual(merged.agents, ["InlineAgent"])
  assert.deepEqual(merged.commands, ["inline-command"])
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

test("resolveConfig maps skills to universal and scoped source directories", () => {
  const resolved = resolveConfig({ pack: "frontend", target: "local", explicitPack: true })
  assert.match(resolved.skillSources["alloy-tdd"], /universal\/skills\/alloy-tdd$/)
  assert.match(resolved.skillSources["frontend-ui-ux"], /scopes\/frontend\/skills\/frontend-ui-ux$/)
  assert.match(resolved.skillSources["vercel-react-best-practices"], /vendor\/skills\/scopes\/frontend\/vercel-react-best-practices$/)
})

test("createManifest records managed inventory, visible inventory, and explicit choices", () => {
  const resolved = resolveConfig({ pack: "core", target: "local", models: "github-copilot", explicitPack: true })
  const manifest = createManifest(resolved, "2026-05-26T00:00:00.000Z")

  assert.equal(manifest.version, "0.1.0")
  assert.equal(manifest.installedAt, "2026-05-26T00:00:00.000Z")
  assert.equal(manifest.pack, "core")
  assert.equal(manifest.models, "github-copilot")
  assert.deepEqual(manifest.managed.skills, resolved.skills)
  assert.deepEqual(manifest.managed.agents, resolved.agents)
  assert.deepEqual(manifest.managed.commands, resolved.commands)
  assert.deepEqual(manifest.managed.mcp, ["context7", "grep_app", "exa"])
  assert.deepEqual(manifest.visible.skills, resolved.skills)
  assert.deepEqual(manifest.visible.agents, resolved.agents)
  assert.deepEqual(manifest.explicit, { added: [] })
  assert.deepEqual(manifest.excluded, [])
})

test("manifestPathFor points to the target .opencode manifest", () => {
  assert.equal(manifestPathFor("/tmp/example"), "/tmp/example/.opencode/alloy.manifest.json")
})

test("addVisibleItem and removeVisibleItem preserve explicit intent", () => {
  const manifest = {
    version: "0.1.0",
    installedAt: "2026-05-26T00:00:00.000Z",
    pack: "core",
    models: "github-copilot",
    managed: { skills: ["alloy-tdd"], agents: ["Orchestrator"], commands: [], mcp: [] },
    visible: { skills: ["alloy-tdd"], agents: ["Orchestrator"] },
    explicit: { added: [], removed: [] },
  }

  addVisibleItem(manifest, "skills", "frontend-ui-ux", { explicit: true })
  assert.deepEqual(manifest.managed.skills, ["alloy-tdd", "frontend-ui-ux"])
  assert.deepEqual(manifest.visible.skills, ["alloy-tdd", "frontend-ui-ux"])
  assert.deepEqual(manifest.explicit.added, ["frontend-ui-ux"])
  assert.deepEqual(manifest.excluded, [])
  assert.equal("removed" in manifest.explicit, false)

  removeVisibleItem(manifest, "skills", "alloy-tdd")
  assert.deepEqual(manifest.visible.skills, ["frontend-ui-ux"])
  assert.deepEqual(manifest.excluded, ["alloy-tdd"])
  assert.equal("removed" in manifest.explicit, false)
})

test("normalizeManifest migrates legacy explicit.removed into top-level excluded", () => {
  const manifest = normalizeManifest({
    version: "0.1.0",
    installedAt: "2026-05-26T00:00:00.000Z",
    pack: "core",
    models: "github-copilot",
    managed: { skills: ["alloy-tdd"], agents: ["Orchestrator"], commands: [], mcp: [] },
    visible: { skills: [], agents: ["Orchestrator"] },
    explicit: { added: ["humanizer"], removed: ["alloy-tdd"] },
  })

  assert.deepEqual(manifest.explicit, { added: ["humanizer"] })
  assert.deepEqual(manifest.excluded, ["alloy-tdd"])
})

test("createGlobalState records global install state and vendor lock hash", () => {
  const resolved = resolveConfig({ pack: "core", target: "global", models: "github-copilot", explicitPack: true })
  const state = createGlobalState(resolved, "2026-05-26T00:00:00.000Z")

  assert.equal(state.version, "0.1.0")
  assert.equal(state.installedAt, "2026-05-26T00:00:00.000Z")
  assert.equal(state.pack, "core")
  assert.deepEqual(state.managed.skills, resolved.skills)
  assert.equal(state.lastSyncedVendorLock, vendorLockSha256())
  assert.match(state.lastSyncedVendorLock, /^[a-f0-9]{64}$/)
})

test("checkContainerUsePrereqs requires a Docker-compatible runtime and container-use binary", () => {
  const tmp = mkdtempSync(join(tmpdir(), "alloy-path-"))
  try {
    const missing = checkContainerUsePrereqs({ pathEnv: tmp })
    assert.equal(missing.ok, false)
    assert.deepEqual(missing.missing, ["docker-compatible runtime", "container-use"])
    assert.match(missing.installHint, /brew install container-use/)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
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
