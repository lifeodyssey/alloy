#!/usr/bin/env node
// scripts/revendor.mjs — re-pull vendored skills from upstream, recompute sha256, apply local patches
//
// Subcommands:
//   --check <name>        Show current pinned version vs latest GitHub release
//   --check-all           Same for every entry in vendor.lock.json
//   --apply <name>        Re-clone source repo at latest tag, copy upstreamPath to paths[0],
//                         apply vendor/patches/<name>/*.patch if present, recompute sha256,
//                         update vendor.lock.json
//   --regenerate-hashes   Recompute sha256 for existing vendored paths in vendor.lock.json
//   --help                Print this usage

import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, readdirSync, statSync, mkdirSync, cpSync } from "node:fs"
import { join, basename, dirname, resolve, relative, sep } from "node:path"
import { tmpdir } from "node:os"
import { execSync, spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, "..")
const LOCK_PATH = join(REPO_ROOT, "vendor.lock.json")
const PATCHES_DIR = join(REPO_ROOT, "vendor", "patches")

function usage() {
  console.log(`Usage:
  node scripts/revendor.mjs --check <name>
  node scripts/revendor.mjs --check-all
  node scripts/revendor.mjs --apply <name>
  node scripts/revendor.mjs --regenerate-hashes
  node scripts/revendor.mjs --help

Reads vendor.lock.json, optionally checks GitHub releases for newer versions,
and re-vendors skill content from upstream (shallow clone, copy upstreamPath
from the source repo to paths[0], apply local patches under vendor/patches/<name>/,
then recompute sha256).

--apply requires each upstream-backed vendor.lock.json entry to define
upstreamPath, the path inside the upstream repo (for example "skills/brainstorming").`)
}

function readLock() {
  return JSON.parse(readFileSync(LOCK_PATH, "utf8"))
}

function writeLock(entries) {
  writeFileSync(LOCK_PATH, JSON.stringify(entries, null, 2) + "\n", "utf8")
}

function parseRepoFromSource(source) {
  const m = source.match(/^https?:\/\/github\.com\/([^/]+)\/([^/.]+)/)
  if (!m) return null
  return { owner: m[1], repo: m[2] }
}

async function fetchLatestRelease(owner, repo) {
  const headers = { "User-Agent": "alloy-revendor", "Accept": "application/vnd.github+json" }
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  const url = `https://api.github.com/repos/${owner}/${repo}/releases/latest`
  const res = await fetch(url, { headers })
  if (res.status === 404) {
    // Some repos use tags not releases — fall back
    const tagsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/tags`, { headers })
    if (!tagsRes.ok) throw new Error(`GitHub tags API returned ${tagsRes.status}`)
    const tags = await tagsRes.json()
    return tags[0]?.name ?? null
  }
  if (!res.ok) throw new Error(`GitHub releases API returned ${res.status}`)
  const json = await res.json()
  return json.tag_name ?? json.name ?? null
}

async function check(name) {
  const entries = readLock()
  const entry = entries.find((e) => e.name === name)
  if (!entry) {
    console.error(`No vendor.lock.json entry named: ${name}`)
    process.exit(2)
  }
  if (entry.source === "vendored-local" || entry.version === "vendored-local") {
    console.log(`${name}: vendored-local (no upstream to check)`)
    return
  }
  const repoInfo = parseRepoFromSource(entry.source)
  if (!repoInfo) {
    console.log(`${name}: non-GitHub source (${entry.source}), skipped`)
    return
  }
  let latest
  try {
    latest = await fetchLatestRelease(repoInfo.owner, repoInfo.repo)
  } catch (e) {
    console.log(`${name}: could not query upstream (reason: ${e.message})`)
    return
  }
  if (!latest) {
    console.log(`${name}: could not query upstream (reason: no release or tag found)`)
    return
  }
  const current = entry.version
  const status = latest === current ? "up to date" : "OUT OF DATE"
  console.log(`${name.padEnd(40)} current=${current.padEnd(15)} latest=${latest.padEnd(15)} ${status}`)
}

async function checkAll() {
  const entries = readLock()
  console.log(`Checking ${entries.length} vendor entries...\n`)
  console.log("name".padEnd(40) + "current".padEnd(20) + "latest".padEnd(20) + "status")
  console.log("-".repeat(96))
  for (const entry of entries) {
    await check(entry.name)
  }
}

function sha256OfDir(dir) {
  return sha256OfFiles(collectFiles(dir))
}

function collectFiles(root, relPrefix = "") {
  const files = []
  function walk(p) {
    for (const e of readdirSync(p)) {
      const full = join(p, e)
      const st = statSync(full)
      if (st.isDirectory()) walk(full)
      else {
        const rel = relative(root, full).split(sep).join("/")
        files.push({ full, rel: relPrefix ? `${relPrefix}/${rel}` : rel })
      }
    }
  }
  const st = statSync(root)
  if (st.isDirectory()) walk(root)
  else files.push({ full: root, rel: relPrefix || basename(root) })
  return files
}

function sha256OfFiles(files) {
  files.sort((a, b) => a.rel.localeCompare(b.rel))
  const hash = createHash("sha256")
  for (const { full, rel } of files) {
    hash.update(rel + "\n")
    hash.update(readFileSync(full))
  }
  return hash.digest("hex")
}

function sha256OfEntryPaths(paths) {
  if (paths.length === 1) return sha256OfDir(join(REPO_ROOT, paths[0]))
  return sha256OfFiles(paths.flatMap((p) => collectFiles(join(REPO_ROOT, p), p)))
}

function localPathsForEntry(entry) {
  if (!Array.isArray(entry.paths) || entry.paths.length === 0) return []
  return entry.paths
}

function requireSingleLocalPath(name, entry) {
  const paths = localPathsForEntry(entry)
  if (paths.length === 0) {
    console.error(`${name}: missing paths in vendor.lock.json; add a local vendored path before running --apply`)
    process.exit(2)
  }
  if (paths.length > 1) {
    console.error(`${name}: --apply requires exactly one local path in vendor.lock.json, found ${paths.length}`)
    process.exit(2)
  }
  return paths[0]
}

function requireUpstreamPath(name, entry) {
  if (!entry.upstreamPath) {
    console.error(`${name}: missing upstreamPath in vendor.lock.json. Add the path inside the upstream repo before running --apply (for example "skills/brainstorming").`)
    process.exit(2)
  }
  return entry.upstreamPath
}

function applyPatches(name, targetDir) {
  const patchDir = join(PATCHES_DIR, name)
  if (!existsSync(patchDir)) return []
  const patches = readdirSync(patchDir).filter((f) => f.endsWith(".patch")).sort()
  const applied = []
  for (const p of patches) {
    const patchPath = join(patchDir, p)
    const r = spawnSync("git", ["apply", "--directory", targetDir, patchPath], {
      stdio: "inherit",
      cwd: REPO_ROOT,
    })
    if (r.status !== 0) {
      console.error(`Patch failed: ${p}. Stop. Fix patch or skip.`)
      process.exit(3)
    }
    applied.push(p)
  }
  return applied
}

async function apply(name) {
  const entries = readLock()
  const entry = entries.find((e) => e.name === name)
  if (!entry) {
    console.error(`No vendor.lock.json entry named: ${name}`)
    process.exit(2)
  }
  if (entry.source === "vendored-local" || entry.version === "vendored-local") {
    console.error(`${name} is vendored-local (no upstream); cannot --apply`)
    process.exit(2)
  }
  const repoInfo = parseRepoFromSource(entry.source)
  if (!repoInfo) {
    console.error(`${name}: non-GitHub source (${entry.source}); --apply only supports GitHub for now`)
    process.exit(2)
  }
  const upstreamPath = requireUpstreamPath(name, entry)
  const localPath = requireSingleLocalPath(name, entry)
  let latest
  try {
    latest = await fetchLatestRelease(repoInfo.owner, repoInfo.repo)
  } catch (e) {
    console.error(`${name}: could not query upstream (reason: ${e.message})`)
    process.exit(3)
  }
  if (!latest) {
    console.error(`${name}: could not query upstream (reason: no release or tag found)`)
    process.exit(3)
  }
  console.log(`Pulling ${repoInfo.owner}/${repoInfo.repo}@${latest}`)
  const tmpDir = mkdtempSync(join(tmpdir(), "alloy-revendor-"))
  try {
    execSync(
      `git clone --depth=1 --branch=${latest} --no-tags --filter=blob:limit=1m https://github.com/${repoInfo.owner}/${repoInfo.repo}.git ${tmpDir}/src`,
      { stdio: "inherit" }
    )
    const srcDir = join(tmpDir, "src", upstreamPath)
    if (!existsSync(srcDir)) {
      console.error(`Source path not found in upstream: ${upstreamPath}`)
      process.exit(3)
    }
    const destDir = join(REPO_ROOT, localPath)
    if (existsSync(destDir)) rmSync(destDir, { recursive: true, force: true })
    mkdirSync(dirname(destDir), { recursive: true })
    cpSync(srcDir, destDir, { recursive: true })
    const oldHash = entry.sha256
    const patches = applyPatches(name, destDir)
    const newHash = sha256OfDir(destDir)
    entry.version = latest
    entry.sha256 = newHash
    entry.vendoredAt = new Date().toISOString().split("T")[0]
    if (patches.length) entry.patches = patches
    writeLock(entries)
    console.log(`\nUpdated ${name}: ${entry.version} (sha256 ${oldHash.slice(0, 8)} → ${newHash.slice(0, 8)})`)
    if (patches.length) console.log(`  Applied ${patches.length} patches`)
  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
}

function regenerateHashes() {
  const entries = readLock()
  const updated = []
  const unchanged = []
  const skipped = []
  for (const entry of entries) {
    const paths = localPathsForEntry(entry)
    if (paths.length === 0) {
      skipped.push(`${entry.name}: no paths`)
      continue
    }
    const missing = paths.filter((p) => !existsSync(join(REPO_ROOT, p)))
    if (missing.length > 0) {
      skipped.push(`${entry.name}: missing ${missing.join(", ")}`)
      continue
    }
    const newHash = sha256OfEntryPaths(paths)
    if (entry.sha256 === newHash) {
      unchanged.push(entry.name)
      continue
    }
    const oldHash = entry.sha256
    entry.sha256 = newHash
    updated.push(`${entry.name}: ${oldHash.slice(0, 8)} -> ${newHash.slice(0, 8)}`)
  }
  if (updated.length > 0) writeLock(entries)
  console.log(`Regenerated vendor hashes: ${updated.length} updated, ${unchanged.length} unchanged, ${skipped.length} skipped`)
  for (const line of updated) console.log(`  updated ${line}`)
  for (const line of skipped) console.log(`  skipped ${line}`)
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    usage()
    process.exit(args.length === 0 ? 1 : 0)
  }
  const cmd = args[0]
  if (cmd === "--check") {
    if (!args[1]) { console.error("--check requires a name"); process.exit(1) }
    await check(args[1])
  } else if (cmd === "--check-all") {
    await checkAll()
  } else if (cmd === "--apply") {
    if (!args[1]) { console.error("--apply requires a name"); process.exit(1) }
    await apply(args[1])
  } else if (cmd === "--regenerate-hashes") {
    regenerateHashes()
  } else {
    console.error(`Unknown command: ${cmd}`)
    usage()
    process.exit(1)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
