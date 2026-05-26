#!/usr/bin/env python3
"""Compatibility wrapper for the Alloy Node CLI."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    command = ["node", str(ROOT / "bin" / "alloy.mjs"), "install", *sys.argv[1:]]
    return subprocess.run(command, cwd=Path.cwd()).returncode


if __name__ == "__main__":
    raise SystemExit(main())
