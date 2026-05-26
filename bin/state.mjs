import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { ALLOY_VERSION, managedFromResolved } from "./manifest.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, "..")

export function vendorLockPath() {
  return process.env.ALLOY_VENDOR_LOCK_PATH || join(REPO_ROOT, "vendor.lock.json")
}

export function vendorLockSha256(path = vendorLockPath()) {
  if (!existsSync(path)) throw new Error(`Missing vendor lock: ${path}`)
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

export function createGlobalState(resolved, installedAt = new Date().toISOString()) {
  return {
    version: ALLOY_VERSION,
    installedAt,
    pack: resolved.pack.id,
    managed: managedFromResolved(resolved),
    lastSyncedVendorLock: vendorLockSha256(),
  }
}

export function globalStatePath(home = process.env.HOME) {
  if (!home) throw new Error("HOME is required to write Alloy global state")
  return join(home, ".config", "alloy", "state.json")
}

export function writeGlobalState(state, path = globalStatePath()) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, "utf8")
}
