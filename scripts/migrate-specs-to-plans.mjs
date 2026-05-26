#!/usr/bin/env node
import { existsSync, mkdirSync, renameSync } from "node:fs"
import { dirname, resolve } from "node:path"

const specsDir = resolve(process.cwd(), ".alloy/specs")
const plansDir = resolve(process.cwd(), ".alloy/plans")

if (existsSync(specsDir) && !existsSync(plansDir)) {
  mkdirSync(dirname(plansDir), { recursive: true })
  renameSync(specsDir, plansDir)
  console.log("Migrated .alloy/specs to .alloy/plans")
}
