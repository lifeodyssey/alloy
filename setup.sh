#!/bin/bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARGS=("$@")

printf 'setup.sh is deprecated, use install.sh for fresh install or `alloy install` for re-install\n' >&2
exec node "${REPO_DIR}/bin/alloy.mjs" install "${ARGS[@]}"
