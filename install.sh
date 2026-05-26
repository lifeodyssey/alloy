#!/usr/bin/env bash
set -euo pipefail

ALLOY_REPO_URL="https://github.com/lifeodyssey/opencode-team-config"
ALLOY_REF="${ALLOY_INSTALL_REF:-main}"
ALLOY_PACK="${ALLOY_PACK:-core}"
DOWNLOAD_DIR=""
BIN_DIR="${HOME}/.local/bin"
INSTALL_ROOT="${HOME}/.local/share/alloy/opencode-team-config"
ALLOY_BIN="${BIN_DIR}/alloy"
ALLOY_CONFIG_DIR="${HOME}/.config/alloy"
STATE_PATH="${ALLOY_CONFIG_DIR}/state.json"

progress() {
  printf '==> %s\n' "$1"
}

die() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

cleanup() {
  if [[ -n "${DOWNLOAD_DIR}" && -d "${DOWNLOAD_DIR}" ]]; then
    rm -rf "${DOWNLOAD_DIR}"
  fi
}

trap cleanup EXIT

version_at_least() {
  local current="$1"
  local required="$2"
  node - "${current}" "${required}" <<'NODE'
const [current, required] = process.argv.slice(2)
const parse = (value) => String(value).replace(/^v/, "").split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0)
const left = parse(current)
const right = parse(required)
for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
  const a = left[i] || 0
  const b = right[i] || 0
  if (a > b) process.exit(0)
  if (a < b) process.exit(1)
}
process.exit(0)
NODE
}

check_version() {
  local name="$1"
  local current="$2"
  local required="$3"
  if ! version_at_least "${current}" "${required}"; then
    die "${name} ${required}+ is required; found ${current}"
  fi
}

check_prereqs() {
  progress "Checking prerequisites"
  for cli in node bun git curl; do
    command_exists "${cli}" || die "${cli} is required but was not found on PATH"
  done
  check_version "Node.js" "$(node --version)" "20.0.0"
  check_version "Bun" "$(bun --version)" "1.1.0"
}

download_repo() {
  progress "Downloading OpenCode Alloy"
  DOWNLOAD_DIR="$(mktemp -d "${TMPDIR:-/tmp}/alloy-install-XXXXXX")"
  if [[ -n "${ALLOY_INSTALL_SOURCE_DIR:-}" ]]; then
    local source_dir
    source_dir="$(cd "${ALLOY_INSTALL_SOURCE_DIR}" && pwd)"
    [[ -f "${source_dir}/bin/alloy.mjs" ]] || die "ALLOY_INSTALL_SOURCE_DIR must point at an Alloy repo"
    cp -R "${source_dir}/." "${DOWNLOAD_DIR}/"
    return
  fi
  git clone --depth 1 --branch "${ALLOY_REF}" "${ALLOY_REPO_URL}" "${DOWNLOAD_DIR}"
}

append_block_once() {
  local file="$1"
  local marker="$2"
  local block="$3"
  mkdir -p "$(dirname "${file}")"
  touch "${file}"
  if ! grep -Fqs "${marker}" "${file}"; then
    {
      printf '\n# %s\n' "${marker}"
      printf '%s\n' "${block}"
    } >> "${file}"
  fi
}

ensure_path() {
  local path_missing=0
  case ":${PATH:-}:" in
    *":${BIN_DIR}:"*) ;;
    *)
      path_missing=1
      export PATH="${BIN_DIR}:${PATH:-}"
      ;;
  esac

  if [[ ":${PATH:-}:" != *":${BIN_DIR}:"* ]]; then
    die "failed to add ${BIN_DIR} to PATH for this install session"
  fi

  if [[ "${path_missing}" -eq 1 ]]; then
    local path_block='export PATH="$HOME/.local/bin:$PATH"'
    append_block_once "${HOME}/.zshrc" "OpenCode Alloy PATH" "${path_block}"
    append_block_once "${HOME}/.bashrc" "OpenCode Alloy PATH" "${path_block}"
  fi
}

install_alloy_bin() {
  progress "Installing Alloy CLI"
  local staging="${INSTALL_ROOT}.next"
  mkdir -p "$(dirname "${INSTALL_ROOT}")" "${BIN_DIR}"
  rm -rf "${staging}"
  mkdir -p "${staging}"
  cp -R "${DOWNLOAD_DIR}/." "${staging}/"

  if [[ -f "${INSTALL_ROOT}/bin/alloy.mjs" ]] && cmp -s "${staging}/bin/alloy.mjs" "${INSTALL_ROOT}/bin/alloy.mjs"; then
    progress "Alloy CLI is already current; refreshing installed payload"
  fi

  chmod +x "${staging}/bin/alloy.mjs"
  rm -rf "${INSTALL_ROOT}"
  mv "${staging}" "${INSTALL_ROOT}"
  ln -sfn "${INSTALL_ROOT}/bin/alloy.mjs" "${ALLOY_BIN}"
  ensure_path
}

run_global_install() {
  progress "Installing global OpenCode Alloy config"
  (
    cd "${INSTALL_ROOT}"
    "${ALLOY_BIN}" install --target global --pack "${ALLOY_PACK}"
  )
}

write_state_json() {
  progress "Writing Alloy machine state"
  local version
  version="$("${ALLOY_BIN}" --version)"
  mkdir -p "${ALLOY_CONFIG_DIR}"
  node - "${STATE_PATH}" "${version}" "${INSTALL_ROOT}" "${ALLOY_BIN}" "${ALLOY_REPO_URL}" "${ALLOY_REF}" <<'NODE'
const fs = require("node:fs")
const path = require("node:path")

const [statePath, version, installRoot, alloyBin, repoUrl, ref] = process.argv.slice(2)
const state = {
  version,
  installedAt: new Date().toISOString(),
  installRoot,
  binary: alloyBin,
  source: { repoUrl, ref },
  opencodeConfig: path.join(process.env.HOME, ".config", "opencode"),
}
fs.mkdirSync(path.dirname(statePath), { recursive: true })
fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")
NODE
}

install_completion() {
  progress "Installing shell completion"
  local bash_dir="${HOME}/.bash_completion.d"
  local zsh_dir="${HOME}/.zsh/completions"
  local fish_dir="${HOME}/.config/fish/completions"

  mkdir -p "${bash_dir}" "${zsh_dir}" "${fish_dir}"
  "${ALLOY_BIN}" completion bash > "${bash_dir}/alloy"
  "${ALLOY_BIN}" completion zsh > "${zsh_dir}/_alloy"
  "${ALLOY_BIN}" completion fish > "${fish_dir}/alloy.fish"

  append_block_once "${HOME}/.bashrc" "OpenCode Alloy completion" '[ -f "$HOME/.bash_completion.d/alloy" ] && . "$HOME/.bash_completion.d/alloy"'
  append_block_once "${HOME}/.zshrc" "OpenCode Alloy completion" 'fpath=("$HOME/.zsh/completions" $fpath)
autoload -Uz compinit
compinit'
}

verify() {
  progress "Verifying install"
  command_exists alloy || die "alloy is not on PATH after install"
  alloy --version >/dev/null
  alloy list >/dev/null
  [[ -x "${ALLOY_BIN}" ]] || die "missing executable ${ALLOY_BIN}"
  [[ -f "${HOME}/.config/opencode/opencode.json" ]] || die "missing ${HOME}/.config/opencode/opencode.json"
  [[ -f "${STATE_PATH}" ]] || die "missing ${STATE_PATH}"
  progress "Alloy $(alloy --version) installed"
}

main() {
  check_prereqs
  download_repo
  install_alloy_bin
  run_global_install
  write_state_json
  install_completion
  verify
}

main "$@"
