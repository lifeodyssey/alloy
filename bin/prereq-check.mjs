import { constants, accessSync } from "node:fs"
import { join } from "node:path"

const RUNTIME_BINARIES = ["docker", "colima", "podman", "orb"]

export function checkContainerUsePrereqs(options = {}) {
  const pathEnv = options.pathEnv ?? process.env.PATH ?? ""
  const runtime = RUNTIME_BINARIES.find((name) => which(name, pathEnv))
  const hasContainerUse = Boolean(which("container-use", pathEnv))
  const missing = []
  if (!runtime) missing.push("docker-compatible runtime")
  if (!hasContainerUse) missing.push("container-use")
  return {
    ok: missing.length === 0,
    runtime,
    containerUse: hasContainerUse ? which("container-use", pathEnv) : "",
    missing,
    installHint: [
      "Install a Docker-compatible runtime, for example:",
      "  brew install --cask docker",
      "  brew install colima",
      "  brew install podman",
      "Install Container Use:",
      "  brew install container-use",
    ].join("\n"),
  }
}

export function which(command, pathEnv = process.env.PATH ?? "") {
  for (const dir of pathEnv.split(":").filter(Boolean)) {
    const candidate = join(dir, command)
    try {
      accessSync(candidate, constants.X_OK)
      return candidate
    } catch {
      // Keep scanning PATH.
    }
  }
  return ""
}
