import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, "..")
const PACKAGE = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8"))

export const ALLOY_VERSION = PACKAGE.version

export function managedFromResolved(resolved) {
  return {
    skills: [...(resolved.skills ?? [])],
    agents: [...(resolved.agents ?? [])],
    commands: [...(resolved.commands ?? [])],
    mcp: Object.keys(resolved.mcp ?? {}),
  }
}

export function createManifest(resolved, installedAt = new Date().toISOString()) {
  const managed = managedFromResolved(resolved)
  return {
    version: ALLOY_VERSION,
    installedAt,
    pack: resolved.pack.id,
    models: resolved.modelName,
    managed,
    visible: {
      skills: [...managed.skills],
      agents: [...managed.agents],
    },
    explicit: {
      added: [],
      removed: [],
    },
  }
}

export function manifestPathFor(projectDir) {
  return join(projectDir, ".opencode", "alloy.manifest.json")
}

export function manifestPathForTarget(targetDir) {
  return join(targetDir, "alloy.manifest.json")
}

export function readManifest(projectDir) {
  const path = manifestPathFor(projectDir)
  if (!existsSync(path)) throw new Error(`Missing Alloy manifest: ${path}. Run alloy install first.`)
  return normalizeManifest(JSON.parse(readFileSync(path, "utf8")))
}

export function writeManifest(projectDir, manifest) {
  const path = manifestPathFor(projectDir)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(normalizeManifest(manifest), null, 2)}\n`, "utf8")
}

export function normalizeManifest(manifest) {
  return {
    version: manifest.version ?? ALLOY_VERSION,
    installedAt: manifest.installedAt,
    pack: manifest.pack,
    models: manifest.models,
    managed: {
      skills: unique(manifest.managed?.skills ?? []),
      agents: unique(manifest.managed?.agents ?? []),
      commands: unique(manifest.managed?.commands ?? []),
      mcp: unique(manifest.managed?.mcp ?? []),
    },
    visible: {
      skills: unique(manifest.visible?.skills ?? []),
      agents: unique(manifest.visible?.agents ?? []),
    },
    explicit: {
      added: unique(manifest.explicit?.added ?? []),
      removed: unique(manifest.explicit?.removed ?? manifest.explicit?.excluded ?? []),
    },
  }
}

export function addVisibleItem(manifest, kind, name, options = {}) {
  const normalized = normalizeManifest(manifest)
  if (!["skills", "agents"].includes(kind)) throw new Error(`Unsupported visible kind: ${kind}`)
  normalized.managed[kind] = unique([...normalized.managed[kind], name])
  normalized.visible[kind] = unique([...normalized.visible[kind], name])
  normalized.explicit.removed = normalized.explicit.removed.filter((item) => item !== name)
  if (options.explicit) normalized.explicit.added = unique([...normalized.explicit.added, name])
  Object.assign(manifest, normalized)
  return manifest
}

export function removeVisibleItem(manifest, kind, name) {
  const normalized = normalizeManifest(manifest)
  if (!["skills", "agents"].includes(kind)) throw new Error(`Unsupported visible kind: ${kind}`)
  normalized.visible[kind] = normalized.visible[kind].filter((item) => item !== name)
  normalized.explicit.removed = unique([...normalized.explicit.removed, name])
  normalized.explicit.added = normalized.explicit.added.filter((item) => item !== name)
  Object.assign(manifest, normalized)
  return manifest
}

export function addManagedMcp(manifest, name, options = {}) {
  const normalized = normalizeManifest(manifest)
  normalized.managed.mcp = unique([...normalized.managed.mcp, name])
  normalized.explicit.removed = normalized.explicit.removed.filter((item) => item !== name)
  if (options.explicit) normalized.explicit.added = unique([...normalized.explicit.added, name])
  Object.assign(manifest, normalized)
  return manifest
}

function unique(items) {
  return [...new Set(items.filter(Boolean))]
}
