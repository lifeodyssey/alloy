#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

exec node "$REPO_DIR/bin/alloy.mjs" install "$@"
