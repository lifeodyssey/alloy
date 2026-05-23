#!/usr/bin/env python3
"""OpenCode Alloy project-local/profile installer."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
GSD_VERSION = "1.38.5"
GSD_VENDOR = REPO_ROOT / "vendor" / "gsd-opencode" / GSD_VERSION

MCP_CONFIGS: dict[str, dict[str, Any]] = {
    "context7": {
        "type": "remote",
        "url": "https://mcp.context7.com/mcp",
        "enabled": True,
    },
    "grep_app": {
        "type": "remote",
        "url": "https://mcp.grep.app",
        "enabled": True,
    },
    "exa": {
        "type": "remote",
        "url": "https://mcp.exa.ai/mcp",
        "enabled": True,
    },
}

ROLE_TO_AGENT = {
    "planner": ("alloy-orchestrator", "alloy-planner"),
    "executor": ("alloy-executor",),
    "reviewer": ("alloy-reviewer",),
    "debugger": ("alloy-debugger",),
    "verifier": ("alloy-verifier",),
}

MANAGED_NAMES = [
    "opencode.json",
    "agents",
    "commands",
    "skills",
    "vendor",
    "get-shit-done",
    "bin",
    "oh-my-opencode-slim.json",
]

DEPRECATED_SKILLS = ["team-tdd", "frontend-tdd", "backend-tdd", "tdd"]
DEPRECATED_AGENTS = ["orchestrator_append", "librarian_append", "code-reviewer", "plan-reviewer", "executor"]


@dataclass
class Installer:
    args: argparse.Namespace
    profile: dict[str, Any]
    models: dict[str, Any]

    @property
    def target_dir(self) -> Path:
        if self.args.target == "global":
            return Path.home() / ".config" / "opencode"
        return Path.cwd() / ".opencode"

    def log(self, message: str = "") -> None:
        print(message)

    def action(self, message: str) -> None:
        prefix = "DRY-RUN: " if self.args.dry_run else ""
        self.log(f"{prefix}{message}")

    def ensure_dir(self, path: Path) -> None:
        if self.args.dry_run:
            self.action(f"mkdir -p {path}")
        else:
            path.mkdir(parents=True, exist_ok=True)

    def remove_path(self, path: Path) -> None:
        if not path.exists() and not path.is_symlink():
            return
        if self.args.dry_run:
            self.action(f"rm -rf {path}")
            return
        if path.is_dir() and not path.is_symlink():
            shutil.rmtree(path)
        else:
            path.unlink()

    def copy_file(self, source: Path, dest: Path, mode: int | None = None) -> None:
        if not source.is_file():
            raise FileNotFoundError(f"Missing source file: {source}")
        if self.args.dry_run:
            self.action(f"copy {source.relative_to(REPO_ROOT)} -> {dest}")
            return
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, dest)
        if mode is not None:
            dest.chmod(mode)

    def copy_dir(self, source: Path, dest: Path) -> None:
        if not source.is_dir():
            raise FileNotFoundError(f"Missing source directory: {source}")
        if self.args.dry_run:
            self.action(f"copy tree {source.relative_to(REPO_ROOT)} -> {dest}")
            return
        if dest.exists():
            shutil.rmtree(dest)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(source, dest)

    def write_text(self, path: Path, content: str, mode: int | None = None) -> None:
        if self.args.dry_run:
            self.action(f"write {path}")
            return
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        if mode is not None:
            path.chmod(mode)

    def backup(self) -> None:
        if self.args.dry_run:
            self.action(f"backup managed files under {self.target_dir}")
            return
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        backup_dir = self.target_dir / "backups" / stamp
        copied = False
        for name in MANAGED_NAMES:
            source = self.target_dir / name
            if not source.exists() and not source.is_symlink():
                continue
            dest = backup_dir / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            if source.is_dir() and not source.is_symlink():
                shutil.copytree(source, dest)
            else:
                shutil.copy2(source, dest)
            copied = True
        if copied:
            self.log(f"Backup: {backup_dir}")
        else:
            self.log("Backup: no existing Alloy-managed files found")

    def restore(self, target: str) -> int:
        backup = Path(target)
        if target == "latest":
            root = self.target_dir / "backups"
            candidates = sorted(p for p in root.iterdir() if p.is_dir()) if root.exists() else []
            if not candidates:
                print(f"ERROR: no backups found under {root}", file=sys.stderr)
                return 1
            backup = candidates[-1]
        if not backup.is_dir():
            print(f"ERROR: backup does not exist: {backup}", file=sys.stderr)
            return 1
        self.log("OpenCode Alloy Rollback")
        for name in MANAGED_NAMES:
            source = backup / name
            if not source.exists():
                continue
            dest = self.target_dir / name
            self.remove_path(dest)
            if source.is_dir():
                self.copy_dir(source, dest)
            else:
                self.copy_file(source, dest)
        return 0

    def install(self) -> int:
        self.log("OpenCode Alloy Setup")
        self.log(f"Profile: {self.profile['id']}")
        self.log(f"Target: {self.args.target} ({self.target_dir})")
        self.log(f"Models: {self.args.models}")
        self.log("")

        if self.args.refresh_vendor:
            print("ERROR: --refresh-vendor is intentionally explicit, but no network refresh script is shipped yet.", file=sys.stderr)
            print("Update vendor/ manually, then refresh vendor.lock.json with the documented hash audit.", file=sys.stderr)
            return 2

        self.preflight()
        self.backup()
        self.ensure_dir(self.target_dir)
        self.install_core()
        if self.profile.get("includeGsd"):
            self.install_gsd()
        else:
            self.remove_gsd_when_managed()
        if self.profile.get("includeExperimentalOmo"):
            self.install_omo()
        else:
            self.remove_omo_when_managed()
        self.write_opencode_json()
        self.cleanup_deprecated()

        if self.args.dry_run:
            if self.profile["id"] == "core":
                self.log("Alloy core profile installed (dry-run plan only)")
            self.log("Dry run complete; no files were written.")
            return 0

        self.log("Alloy core profile installed" if self.profile["id"] == "core" else "OpenCode Alloy profile installed")
        return self.audit()

    def preflight(self) -> None:
        self.log("Preflight")
        if shutil.which("opencode"):
            version = run_capture(["opencode", "--version"]) or "unknown"
            self.log(f"- opencode: {version}")
        else:
            self.log("- opencode: not found (install before using the generated config)")
        if shutil.which("node"):
            self.log(f"- node: {run_capture(['node', '--version']) or 'unknown'}")
        elif self.profile.get("includeGsd"):
            self.log("- node: not found; GSD query shim needs Node.js")
        for cli, purpose in (("gh", "GitHub"), ("az", "Azure DevOps"), ("psql", "Postgres")):
            if shutil.which(cli) is None:
                self.log(f"- optional {cli}: not found ({purpose} workflows use CLI fallback)")
        self.log("")

    def install_core(self) -> None:
        self.log("Core files")
        for agent in self.profile.get("agents", []):
            self.copy_file(REPO_ROOT / "agents" / f"{agent}.md", self.target_dir / "agents" / f"{agent}.md")
        for command in self.profile.get("commands", []):
            self.copy_file(REPO_ROOT / "commands" / f"{command}.md", self.target_dir / "commands" / f"{command}.md")
        for skill in self.profile.get("skills", []):
            self.copy_skill(skill)
        self.log("")

    def copy_skill(self, skill: str) -> None:
        source = REPO_ROOT / "skills" / skill
        if not source.is_dir():
            source = REPO_ROOT / "vendor" / "skills" / "external" / skill
        self.copy_dir(source, self.target_dir / "skills" / skill)

    def install_gsd(self) -> None:
        self.log("GSD workflow snapshot")
        self.action(f"Copy vendored GSD snapshot gsd-opencode@{GSD_VERSION}")
        self.copy_dir(GSD_VENDOR / "commands", self.target_dir / "commands" / "gsd")
        for agent_file in sorted((GSD_VENDOR / "agents").glob("*.md")):
            self.copy_file(agent_file, self.target_dir / "agents" / agent_file.name)
        for skill_dir in sorted((GSD_VENDOR / "skills").iterdir()):
            if skill_dir.is_dir():
                self.copy_dir(skill_dir, self.target_dir / "skills" / skill_dir.name)
        self.copy_dir(GSD_VENDOR / "get-shit-done", self.target_dir / "get-shit-done")
        self.copy_dir(GSD_VENDOR / "sdk", self.target_dir / "vendor" / "gsd-opencode" / GSD_VERSION / "sdk")
        self.write_gsd_wrappers()
        self.apply_gsd_overlays()
        self.log("")

    def write_gsd_wrappers(self) -> None:
        bin_dir = self.target_dir / "bin"
        shim_dest = bin_dir / "gsd-sdk-query-shim.mjs"
        self.copy_file(REPO_ROOT / "overlays" / "gsd" / "bin" / "gsd-sdk-query-shim.mjs", shim_dest, mode=0o755)
        wrapper = """#!/usr/bin/env bash
set -euo pipefail
OPENCODE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ALLOY_GSD_SDK_DIST="$OPENCODE_DIR/vendor/gsd-opencode/1.38.5/sdk/dist"
export ALLOY_GSD_TOOLS="$OPENCODE_DIR/get-shit-done/bin/gsd-tools.cjs"
exec node "$OPENCODE_DIR/bin/gsd-sdk-query-shim.mjs" "$@"
"""
        tools = """#!/usr/bin/env bash
set -euo pipefail
OPENCODE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec node "$OPENCODE_DIR/get-shit-done/bin/gsd-tools.cjs" "$@"
"""
        oc_tools = """#!/usr/bin/env bash
set -euo pipefail
OPENCODE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec node "$OPENCODE_DIR/get-shit-done/bin/gsd-oc-tools.cjs" "$@"
"""
        self.write_text(bin_dir / "gsd-sdk", wrapper, mode=0o755)
        self.write_text(bin_dir / "gsd-tools", tools, mode=0o755)
        self.write_text(bin_dir / "gsd-oc-tools", oc_tools, mode=0o755)

    def apply_gsd_overlays(self) -> None:
        self.action("Apply overlays/gsd")
        if self.args.dry_run:
            return
        target_abs = self.target_dir.resolve().as_posix()
        gsd_ref = f"{target_abs}/get-shit-done"
        sdk_bin = f"{target_abs}/bin/gsd-sdk"
        replacements = {
            "@$HOME/.config/opencode/get-shit-done": f"@{gsd_ref}",
            "$HOME/.config/opencode/get-shit-done": gsd_ref,
            "$HOME/.config/opencode/gsd-local-patches": f"{target_abs}/gsd-local-patches",
            "gsd-sdk": sdk_bin,
        }
        for base in (self.target_dir / "commands" / "gsd", self.target_dir / "agents"):
            for path in base.rglob("*.md"):
                text = path.read_text(encoding="utf-8")
                for old, new in replacements.items():
                    text = text.replace(old, new)
                path.write_text(text, encoding="utf-8")
        addendum = (REPO_ROOT / "overlays" / "gsd" / "agent-addendum.md").read_text(encoding="utf-8")
        marker = "<!-- ALLOY_GSD_OVERLAY -->"
        for path in (self.target_dir / "agents").glob("gsd-*.md"):
            text = path.read_text(encoding="utf-8")
            if marker not in text:
                path.write_text(f"{text.rstrip()}\n\n{marker}\n{addendum.rstrip()}\n", encoding="utf-8")
        rules_src = REPO_ROOT / "overlays" / "gsd" / "rules"
        if rules_src.is_dir():
            self.copy_dir(rules_src, self.target_dir / "rules")

    def remove_gsd_when_managed(self) -> None:
        self.remove_path(self.target_dir / "commands" / "gsd")
        self.remove_path(self.target_dir / "get-shit-done")
        self.remove_path(self.target_dir / "vendor" / "gsd-opencode")
        self.remove_path(self.target_dir / "rules")
        agents_dir = self.target_dir / "agents"
        if agents_dir.is_dir():
            for path in sorted(agents_dir.glob("gsd-*.md")):
                self.remove_path(path)
        skills_dir = self.target_dir / "skills"
        if skills_dir.is_dir():
            for path in sorted(skills_dir.glob("gsd-*")):
                self.remove_path(path)
        for name in ("gsd-sdk", "gsd-tools", "gsd-oc-tools", "gsd-sdk-query-shim.mjs"):
            self.remove_path(self.target_dir / "bin" / name)

    def install_omo(self) -> None:
        self.log("Experimental OMO Slim")
        self.copy_file(
            REPO_ROOT / "experimental" / "omo-slim" / "oh-my-opencode-slim.json",
            self.target_dir / "oh-my-opencode-slim.json",
        )
        self.log("")

    def remove_omo_when_managed(self) -> None:
        self.remove_path(self.target_dir / "oh-my-opencode-slim.json")

    def cleanup_deprecated(self) -> None:
        self.log("Cleanup")
        for skill in DEPRECATED_SKILLS:
            self.remove_path(self.target_dir / "skills" / skill)
        for agent in DEPRECATED_AGENTS:
            self.remove_path(self.target_dir / "agents" / f"{agent}.md")
        self.log("")

    def write_opencode_json(self) -> None:
        config: dict[str, Any] = {
            "$schema": "https://opencode.ai/config.json",
            "autoupdate": False,
            "default_agent": "alloy-orchestrator",
            "agent": self.agent_model_config(),
            "mcp": {name: MCP_CONFIGS[name] for name in self.profile.get("mcp", []) if name in MCP_CONFIGS},
        }
        if self.profile.get("includeExperimentalOmo"):
            config["plugin"] = ["oh-my-opencode-slim@1.1.1"]
        self.write_text(self.target_dir / "opencode.json", json.dumps(config, indent=2, ensure_ascii=False) + "\n")

    def agent_model_config(self) -> dict[str, Any]:
        agent_config: dict[str, Any] = {}
        for role, agents in ROLE_TO_AGENT.items():
            role_model = self.models.get(role)
            if not role_model:
                continue
            for agent in agents:
                agent_config[agent] = {k: v for k, v in role_model.items() if k in {"model", "variant", "fallback"}}
        return agent_config

    def audit(self) -> int:
        result = subprocess.run(
            [
                sys.executable,
                str(REPO_ROOT / "scripts" / "audit_prompt_dependencies.py"),
                "--root",
                str(REPO_ROOT),
                "--opencode-dir",
                str(self.target_dir),
            ],
            cwd=REPO_ROOT,
            check=False,
        )
        return result.returncode

    def doctor(self) -> int:
        self.log("OpenCode Alloy Doctor")
        failures: list[str] = []
        failures.extend(validate_profile_refs(self.profile))
        failures.extend(validate_profiles_schema())
        failures.extend(validate_models_schema())
        failures.extend(validate_vendor_lock())
        failures.extend(scan_for_wildcard_skills())
        failures.extend(self.validate_target_files())
        target_config = load_json(self.target_dir / "opencode.json") if (self.target_dir / "opencode.json").exists() else {}
        plugins = target_config.get("plugin", []) if isinstance(target_config, dict) else []
        if not self.profile.get("includeExperimentalOmo") and any("oh-my-opencode-slim" in str(plugin) for plugin in plugins):
            failures.append("Default target config contains OMO Slim plugin")
        if self.profile.get("includeGsd"):
            for required in (
                self.target_dir / "commands" / "gsd" / "gsd-plan-phase.md",
                self.target_dir / "get-shit-done" / "workflows" / "plan-phase.md",
                self.target_dir / "bin" / "gsd-sdk",
            ):
                if not required.exists():
                    failures.append(f"Missing GSD runtime file: {required}")
        audit_result = subprocess.run(
            [
                sys.executable,
                str(REPO_ROOT / "scripts" / "audit_prompt_dependencies.py"),
                "--root",
                str(REPO_ROOT),
                "--opencode-dir",
                str(self.target_dir),
                "--no-write",
            ],
            cwd=REPO_ROOT,
            check=False,
            stdout=subprocess.DEVNULL,
        )
        if audit_result.returncode != 0:
            failures.append("Prompt dependency audit failed")
        if failures:
            for failure in failures:
                print(f"FAIL: {failure}", file=sys.stderr)
            return 1
        self.log("OK: profiles, vendor lock, target config, and prompt audit passed")
        return 0

    def validate_target_files(self) -> list[str]:
        failures: list[str] = []
        for agent in self.profile.get("agents", []):
            if not (self.target_dir / "agents" / f"{agent}.md").is_file():
                failures.append(f"Target missing agent: {agent}")
        for command in self.profile.get("commands", []):
            if not (self.target_dir / "commands" / f"{command}.md").is_file():
                failures.append(f"Target missing command: {command}")
        for skill in self.profile.get("skills", []):
            if not (self.target_dir / "skills" / skill / "SKILL.md").is_file():
                failures.append(f"Target missing skill: {skill}")
        if not (self.target_dir / "opencode.json").is_file():
            failures.append(f"Target missing opencode.json: {self.target_dir / 'opencode.json'}")
        return failures


def run_capture(cmd: list[str]) -> str:
    try:
        return subprocess.run(cmd, check=False, text=True, capture_output=True).stdout.strip()
    except OSError:
        return ""


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def load_profile(profile_id: str) -> dict[str, Any]:
    aliases = {"default": "core", "team": "workflow-gsd", "gsd": "workflow-gsd"}
    profile_id = aliases.get(profile_id, profile_id)
    path = REPO_ROOT / "profiles" / f"{profile_id}.json"
    if not path.is_file():
        raise FileNotFoundError(f"Unknown profile: {profile_id}")
    return load_json(path)


def merge_profile(base: dict[str, Any], extra: dict[str, Any]) -> dict[str, Any]:
    merged = dict(base)
    for key in ("skills", "agents", "commands", "mcp", "modelRoles"):
        values: list[Any] = []
        for item in [*base.get(key, []), *extra.get(key, [])]:
            if item not in values:
                values.append(item)
        merged[key] = values
    merged["includeGsd"] = bool(base.get("includeGsd") or extra.get("includeGsd"))
    merged["includeExperimentalOmo"] = bool(base.get("includeExperimentalOmo") or extra.get("includeExperimentalOmo"))
    merged["description"] = f"{base.get('description', '')} + {extra.get('id', 'extra')}"
    return merged


def build_profile(profile_id: str, with_items: list[str], without_items: list[str]) -> dict[str, Any]:
    profile = load_profile(profile_id)
    extra_aliases = {
        "frontend": "frontend",
        "backend": "backend",
        "kotlin": "backend",
        "postgres": "backend",
        "infra": "infra",
        "terraform": "infra",
        "gsd": "workflow-gsd",
        "workflow-gsd": "workflow-gsd",
        "all": "all",
    }
    for item in with_items:
        if item == "omo":
            profile["includeExperimentalOmo"] = True
            continue
        if item not in extra_aliases:
            raise ValueError(f"Unknown --with item: {item}")
        profile = merge_profile(profile, load_profile(extra_aliases[item]))
    for item in without_items:
        if item == "omo":
            profile["includeExperimentalOmo"] = False
        elif item in ("gsd", "workflow-gsd"):
            profile["includeGsd"] = False
        else:
            raise ValueError(f"Unknown --without item: {item}")
    return profile


def parse_csv(values: list[str]) -> list[str]:
    result: list[str] = []
    for value in values:
        for item in value.split(","):
            item = item.strip()
            if item:
                result.append(item)
    return result


def validate_profile_refs(profile: dict[str, Any]) -> list[str]:
    failures: list[str] = []
    for agent in profile.get("agents", []):
        if not (REPO_ROOT / "agents" / f"{agent}.md").is_file():
            failures.append(f"profile {profile['id']} references missing agent: {agent}")
    for command in profile.get("commands", []):
        if not (REPO_ROOT / "commands" / f"{command}.md").is_file():
            failures.append(f"profile {profile['id']} references missing command: {command}")
    for skill in profile.get("skills", []):
        if not ((REPO_ROOT / "skills" / skill / "SKILL.md").is_file() or (REPO_ROOT / "vendor" / "skills" / "external" / skill / "SKILL.md").is_file()):
            failures.append(f"profile {profile['id']} references missing skill: {skill}")
    for mcp in profile.get("mcp", []):
        if mcp not in MCP_CONFIGS:
            failures.append(f"profile {profile['id']} references unknown MCP: {mcp}")
    return failures


def validate_profiles_schema() -> list[str]:
    required = {"id", "description", "target", "skills", "agents", "commands", "mcp", "includeGsd", "includeExperimentalOmo", "modelRoles"}
    failures: list[str] = []
    for path in sorted((REPO_ROOT / "profiles").glob("*.json")):
        data = load_json(path)
        missing = required.difference(data)
        extra = set(data).difference(required)
        if missing:
            failures.append(f"{path.relative_to(REPO_ROOT)} missing fields: {', '.join(sorted(missing))}")
        if extra:
            failures.append(f"{path.relative_to(REPO_ROOT)} has unsupported fields: {', '.join(sorted(extra))}")
        failures.extend(validate_profile_refs(data))
    return failures


def validate_models_schema() -> list[str]:
    required = {"planner", "executor", "reviewer", "debugger", "verifier"}
    failures: list[str] = []
    for path in sorted((REPO_ROOT / "models").glob("*.json")):
        data = load_json(path)
        missing = required.difference(data)
        extra = set(data).difference(required)
        if missing:
            failures.append(f"{path.relative_to(REPO_ROOT)} missing model roles: {', '.join(sorted(missing))}")
        if extra:
            failures.append(f"{path.relative_to(REPO_ROOT)} has unsupported model roles: {', '.join(sorted(extra))}")
        for role, value in data.items():
            if not isinstance(value, dict) or "model" not in value:
                failures.append(f"{path.relative_to(REPO_ROOT)} role {role} must contain model")
    return failures


def scan_for_wildcard_skills() -> list[str]:
    failures: list[str] = []
    for base in ("profiles", "experimental", "."):
        root = REPO_ROOT / base
        if not root.exists():
            continue
        paths = root.glob("*.json") if root.is_dir() else []
        if base == "experimental":
            paths = root.rglob("*.json")
        for path in paths:
            try:
                text = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            if '"skills":["*"]' in "".join(text.split()):
                failures.append(f"Wildcard skills are not allowed: {path.relative_to(REPO_ROOT)}")
    return failures


def hash_path(path: Path) -> str:
    digest = hashlib.sha256()
    if path.is_dir():
        for file_path in sorted(p for p in path.rglob("*") if p.is_file()):
            rel = file_path.relative_to(path).as_posix()
            digest.update(rel.encode("utf-8"))
            digest.update(b"\0")
            digest.update(file_path.read_bytes())
            digest.update(b"\0")
    else:
        digest.update(path.read_bytes())
    return digest.hexdigest()


def hash_lock_paths(paths: list[str]) -> str:
    digest = hashlib.sha256()
    for rel in paths:
        path = REPO_ROOT / rel
        digest.update(rel.encode("utf-8"))
        digest.update(b"\0")
        digest.update(hash_path(path).encode("utf-8"))
        digest.update(b"\0")
    return digest.hexdigest()


def validate_vendor_lock() -> list[str]:
    failures: list[str] = []
    path = REPO_ROOT / "vendor.lock.json"
    if not path.is_file():
        return ["vendor.lock.json is missing"]
    entries = load_json(path)
    required = {"name", "kind", "source", "version", "license", "sha256", "paths", "vendoredAt"}
    for index, entry in enumerate(entries):
        missing = required.difference(entry)
        extra = set(entry).difference(required)
        label = entry.get("name", f"entry #{index}")
        if missing:
            failures.append(f"vendor.lock.json {label} missing fields: {', '.join(sorted(missing))}")
        if extra:
            failures.append(f"vendor.lock.json {label} has unsupported fields: {', '.join(sorted(extra))}")
        for rel in entry.get("paths", []):
            if not (REPO_ROOT / rel).exists():
                failures.append(f"vendor.lock.json {label} missing path: {rel}")
        if entry.get("paths") and entry.get("sha256") != hash_lock_paths(entry["paths"]):
            failures.append(f"vendor.lock.json hash mismatch: {label}")
    return failures


def refresh_vendor_lock_hashes() -> None:
    path = REPO_ROOT / "vendor.lock.json"
    entries = load_json(path)
    today = datetime.now(timezone.utc).date().isoformat()
    for entry in entries:
        entry["sha256"] = hash_lock_paths(entry["paths"])
        entry.setdefault("vendoredAt", today)
    path.write_text(json.dumps(entries, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="OpenCode Alloy Setup")
    parser.add_argument("--profile", default="core", help="core, frontend, backend, infra, workflow-gsd, all")
    parser.add_argument("--target", choices=("local", "global"), default="local")
    parser.add_argument("--models", default="github-copilot", help="github-copilot, openai, or local")
    parser.add_argument("--with", dest="with_items", action="append", default=[], help="Comma-separated extras: frontend,backend,infra,gsd,omo")
    parser.add_argument("--without", dest="without_items", action="append", default=[], help="Comma-separated exclusions: gsd,omo")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--doctor", action="store_true")
    parser.add_argument("--audit-only", action="store_true")
    parser.add_argument("--rollback")
    parser.add_argument("--refresh-vendor", action="store_true")
    parser.add_argument("--refresh-lock", action="store_true", help=argparse.SUPPRESS)
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    if args.refresh_lock:
        refresh_vendor_lock_hashes()
        return 0
    try:
        profile = build_profile(args.profile, parse_csv(args.with_items), parse_csv(args.without_items))
        model_path = REPO_ROOT / "models" / f"{args.models}.json"
        if not model_path.is_file():
            raise FileNotFoundError(f"Unknown model map: {args.models}")
        models = load_json(model_path)
    except (FileNotFoundError, ValueError, json.JSONDecodeError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2

    installer = Installer(args=args, profile=profile, models=models)
    if args.rollback:
        return installer.restore(args.rollback)
    if args.doctor:
        return installer.doctor()
    if args.audit_only:
        return installer.audit()
    return installer.install()


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
