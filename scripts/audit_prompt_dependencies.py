#!/usr/bin/env python3
"""Audit OpenCode Alloy prompts for installable dependency references."""

from __future__ import annotations

import argparse
import json
import shutil
from dataclasses import dataclass
from pathlib import Path


SCAN_FILES = (
    "README.md",
    "INSTALL.md",
    ".env.example",
    "opencode.json",
    "update.sh",
    "templates/AGENTS.md",
)
SCAN_DIRS = (
    "agents",
    "commands",
    "skills",
    "profiles",
    "models",
    "overlays",
    "experimental",
)


@dataclass(frozen=True)
class Rule:
    reference: str
    category: str
    source: str
    recommendation: str
    fail: bool = True


@dataclass(frozen=True)
class Finding:
    reference: str
    category: str
    source: str
    path: Path
    line: int
    recommendation: str
    fail: bool


@dataclass(frozen=True)
class Dependency:
    reference: str
    actual_name: str
    category: str
    source: str
    visibility: str
    recommendation: str
    patterns: tuple[str, ...] = ()


@dataclass(frozen=True)
class DependencyRow:
    reference: str
    actual_name: str
    category: str
    source: str
    opencode_visible: bool
    recommendation: str
    locations: tuple[str, ...]


RULES = (
    Rule(".sisyphus", "workflow", "legacy Sisyphus state", "Replace with GSD .planning state."),
    Rule("boulder.json", "workflow", "legacy Sisyphus state", "Replace with GSD .planning state."),
    Rule("call_omo_agent", "tool", "OMO-only tool API", "Use native OpenCode agents or GSD commands."),
    Rule("@Oracle", "agent", "old OMO built-in alias", "Use @alloy-planner or GSD plan review."),
    Rule("@Fixer", "agent", "old OMO built-in alias", "Use @alloy-executor or GSD execute phase."),
    Rule("agent: Orchestrator", "agent", "missing legacy command agent", "Use agent: alloy-orchestrator."),
    Rule("@plannotator/opencode", "plugin", "removed plugin", "Use GSD plan review artifacts instead."),
    Rule("opencode-ralph-loop", "plugin", "removed plugin", "Use GSD verify/review loops."),
    Rule("/ralph", "command", "removed command", "Use GSD verify/review loops."),
    Rule("team-tdd", "skill", "renamed TDD skill", "Use alloy-tdd only."),
    Rule("frontend-tdd", "skill", "merged TDD skill", "Use alloy-tdd only."),
    Rule("backend-tdd", "skill", "merged TDD skill", "Use alloy-tdd only."),
    Rule("superpowers:test-driven-development", "skill", "merged TDD entrypoint", "Use alloy-tdd only."),
    Rule("kotlin-agent-skills", "skill-bundle", "bundle name", "Reference concrete Kotlin skills only."),
    Rule("pg-aiguide", "skill-bundle", "bundle name", "Reference concrete Postgres skills only."),
    Rule("github MCP", "mcp", "removed MCP", "Use gh CLI."),
    Rule("azure-devops MCP", "mcp", "removed MCP", "Use az devops CLI."),
    Rule("postgres MCP", "mcp", "removed MCP", "Use psql CLI."),
    Rule("Postgres MCP", "mcp", "removed MCP", "Use psql CLI."),
)


DEPENDENCIES = (
    Dependency("alloy-tdd", "alloy-tdd", "skill", "repo", "skill", "keep: Alloy TDD entrypoint"),
    Dependency("alloy-brainstorm", "alloy-brainstorm", "skill", "repo", "skill", "keep: Alloy brainstorming entrypoint"),
    Dependency("alloy-debug", "alloy-debug", "skill", "repo", "skill", "keep: Alloy systematic debugging entrypoint"),
    Dependency("frontend-ui-ux", "frontend-ui-ux", "skill", "repo", "skill", "keep: UI implementation guidance"),
    Dependency("git-master", "git-master", "skill", "repo", "skill", "keep: git workflow reference"),
    Dependency("playwright-cli", "playwright-cli", "skill", "repo", "skill", "keep: CLI browser testing reference"),
    Dependency("humanizer", "humanizer", "skill", "repo", "skill", "keep: writing cleanup"),
    Dependency(
        "vercel-react-best-practices",
        "vercel-react-best-practices",
        "skill",
        "vercel-labs/agent-skills",
        "skill",
        "optional: install with --with frontend",
    ),
    Dependency(
        "next-best-practices",
        "next-best-practices",
        "skill",
        "vercel-labs/next-skills",
        "skill",
        "optional: install with --with frontend",
    ),
    Dependency("kotlin-springboot", "kotlin-springboot", "skill", "Kotlin/kotlin-agent-skills", "skill", "optional: install with --with kotlin"),
    Dependency(
        "kotlin-backend-jpa-entity-mapping",
        "kotlin-backend-jpa-entity-mapping",
        "skill",
        "Kotlin/kotlin-agent-skills",
        "skill",
        "optional: install with --with kotlin",
    ),
    Dependency("postgres", "postgres", "skill", "timescale/pg-aiguide", "skill", "optional: install with --with postgres", ("`postgres`",)),
    Dependency(
        "design-postgres-tables",
        "design-postgres-tables",
        "skill",
        "timescale/pg-aiguide",
        "skill",
        "optional: install with --with postgres",
    ),
    Dependency(
        "pgvector-semantic-search",
        "pgvector-semantic-search",
        "skill",
        "timescale/pg-aiguide",
        "skill",
        "optional: install with --with postgres",
    ),
    Dependency("terraform-skill", "terraform-skill", "skill", "antonbabenko/terraform-skill", "skill", "optional: install with --with terraform"),
    Dependency("context7", "context7", "mcp", "opencode.json", "mcp", "keep: default documentation MCP"),
    Dependency("grep_app", "grep_app", "mcp", "opencode.json", "mcp", "keep: default public code search MCP"),
    Dependency("exa", "exa", "mcp", "opencode.json", "mcp", "keep: default web search MCP"),
    Dependency("/gsd-discuss-phase", "gsd-discuss-phase", "command", "GSD", "command", "keep: GSD requirements discussion"),
    Dependency("/gsd-plan-phase", "gsd-plan-phase", "command", "GSD", "command", "keep: GSD planning"),
    Dependency("/gsd-execute-phase", "gsd-execute-phase", "command", "GSD", "command", "keep: GSD execution"),
    Dependency("/gsd-code-review", "gsd-code-review", "command", "GSD", "command", "keep: canonical code review"),
    Dependency("/gsd-code-review-fix", "gsd-code-review-fix", "command", "GSD", "command", "keep: review fix loop"),
    Dependency("/gsd-verify-work", "gsd-verify-work", "command", "GSD", "command", "keep: final verification"),
    Dependency("/gsd-ui-phase", "gsd-ui-phase", "command", "GSD", "command", "keep: UI design phase"),
    Dependency("/gsd-ui-review", "gsd-ui-review", "command", "GSD", "command", "keep: UI review"),
    Dependency("/gsd-debug", "gsd-debug", "command", "GSD", "command", "keep: stateful debugging"),
    Dependency("@alloy-orchestrator", "alloy-orchestrator", "agent", "repo", "agent", "keep: Alloy routing agent"),
    Dependency("@alloy-planner", "alloy-planner", "agent", "repo", "agent", "keep: Alloy planning agent"),
    Dependency("@alloy-executor", "alloy-executor", "agent", "repo", "agent", "keep: Alloy execution agent"),
    Dependency("@alloy-reviewer", "alloy-reviewer", "agent", "repo", "agent", "keep: Alloy review agent"),
    Dependency("@alloy-debugger", "alloy-debugger", "agent", "repo", "agent", "keep: Alloy debugging agent"),
    Dependency("@alloy-verifier", "alloy-verifier", "agent", "repo", "agent", "keep: Alloy verification agent"),
    Dependency("gh", "gh", "cli", "system", "cli", "keep: GitHub CLI replacement for GitHub MCP", ("`gh`", "gh CLI")),
    Dependency("az devops", "az", "cli", "system", "cli", "keep: Azure DevOps CLI replacement for Azure MCP", ("`az devops`", "az devops")),
    Dependency("psql", "psql", "cli", "system", "cli", "keep: Postgres CLI replacement for Postgres MCP", ("`psql`", "psql")),
    Dependency("gsd-sdk", "gsd-sdk", "cli", "GSD", "cli", "keep: GSD SDK shim"),
    Dependency("gsd-tools", "gsd-tools", "cli", "GSD", "cli", "keep: GSD tools shim"),
    Dependency("gsd-oc-tools", "gsd-oc-tools", "cli", "GSD", "cli", "keep: GSD OpenCode tools shim"),
)


def iter_scan_paths(root: Path) -> list[Path]:
    paths: list[Path] = []
    for rel in SCAN_FILES:
        path = root / rel
        if path.exists():
            paths.append(path)
    for rel in SCAN_DIRS:
        base = root / rel
        if not base.exists():
            continue
        paths.extend(sorted(p for p in base.rglob("*") if p.is_file()))
    return sorted(paths)


def audit_repository(root: Path) -> list[Finding]:
    findings: list[Finding] = []
    for path in iter_scan_paths(root):
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for number, line in enumerate(text.splitlines(), start=1):
            for rule in RULES:
                if rule.reference in line:
                    findings.append(
                        Finding(
                            reference=rule.reference,
                            category=rule.category,
                            source=rule.source,
                            path=path.relative_to(root),
                            line=number,
                            recommendation=rule.recommendation,
                            fail=rule.fail,
                        )
                    )
            compact = "".join(line.split())
            if '"skills":["*"]' in compact:
                findings.append(
                    Finding(
                        reference='skills:["*"]',
                        category="skill",
                        source="wildcard skill pool",
                        path=path.relative_to(root),
                        line=number,
                        recommendation="List profile skills explicitly; do not pierce repo isolation.",
                        fail=True,
                    )
                )
    return findings


def reference_locations(root: Path, patterns: tuple[str, ...]) -> tuple[str, ...]:
    locations: list[str] = []
    for path in iter_scan_paths(root):
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for number, line in enumerate(text.splitlines(), start=1):
            if any(pattern in line for pattern in patterns):
                locations.append(f"{path.relative_to(root)}:{number}")
                if len(locations) >= 4:
                    return tuple(locations)
    return tuple(locations)


def installed_skill_names(opencode_dir: Path) -> set[str]:
    skills_dir = opencode_dir / "skills"
    if not skills_dir.exists():
        return set()
    return {
        skill_dir.name
        for skill_dir in skills_dir.iterdir()
        if (skill_dir / "SKILL.md").is_file()
    }


def load_opencode_config(opencode_dir: Path) -> dict:
    config_path = opencode_dir / "opencode.json"
    if not config_path.exists():
        return {}
    try:
        return json.loads(config_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def is_dependency_visible(dep: Dependency, opencode_dir: Path, config: dict, skill_names: set[str]) -> bool:
    if dep.visibility == "skill":
        return dep.actual_name in skill_names
    if dep.visibility == "mcp":
        mcp_config = config.get("mcp", {}).get(dep.actual_name)
        return bool(mcp_config) and mcp_config.get("enabled", True) is not False
    if dep.visibility == "plugin":
        plugins = config.get("plugin", [])
        return any(plugin == dep.actual_name or plugin.startswith(f"{dep.actual_name}@") for plugin in plugins)
    if dep.visibility == "command":
        return (
            (opencode_dir / "commands" / f"{dep.actual_name}.md").is_file()
            or (opencode_dir / "commands" / "gsd" / f"{dep.actual_name}.md").is_file()
        )
    if dep.visibility == "agent":
        return (opencode_dir / "agents" / f"{dep.actual_name}.md").is_file()
    if dep.visibility == "cli":
        return shutil.which(dep.actual_name) is not None
    return False


def build_dependency_matrix(root: Path, opencode_dir: Path) -> list[DependencyRow]:
    config = load_opencode_config(opencode_dir)
    skill_names = installed_skill_names(opencode_dir)
    rows: list[DependencyRow] = []
    for dep in DEPENDENCIES:
        patterns = dep.patterns or (dep.reference,)
        locations = reference_locations(root, patterns)
        if not locations:
            continue
        rows.append(
            DependencyRow(
                reference=dep.reference,
                actual_name=dep.actual_name,
                category=dep.category,
                source=dep.source,
                opencode_visible=is_dependency_visible(dep, opencode_dir, config, skill_names),
                recommendation=dep.recommendation,
                locations=locations,
            )
        )
    return rows


def render_report(
    root: Path,
    findings: list[Finding],
    skill_names: set[str],
    matrix: list[DependencyRow],
) -> str:
    lines = [
        "# OpenCode Alloy Prompt Dependency Audit",
        "",
        "Generated by `scripts/audit_prompt_dependencies.py`.",
        "",
        "## OpenCode-Visible Skills",
        "",
    ]
    if skill_names:
        for name in sorted(skill_names):
            lines.append(f"- `{name}`")
    else:
        lines.append("- No OpenCode-visible skills found or directory not present.")

    lines.extend(["", "## Dependency Matrix", ""])
    if not matrix:
        lines.append("No approved dependency references found in scanned files.")
    else:
        lines.extend(
            [
                "| Prompt reference | Actual install name | Kind | Source | OpenCode visible | Recommendation | Referenced in |",
                "|---|---|---|---|---:|---|---|",
            ]
        )
        for row in matrix:
            visible = "yes" if row.opencode_visible else "no"
            locations = "<br>".join(f"`{location}`" for location in row.locations)
            lines.append(
                "| "
                + " | ".join(
                    [
                        f"`{row.reference}`",
                        f"`{row.actual_name}`",
                        row.category,
                        row.source,
                        visible,
                        row.recommendation,
                        locations,
                    ]
                )
                + " |"
            )

    lines.extend(["", "## Findings", ""])
    if not findings:
        lines.append("No blocked dependency references found.")
    else:
        lines.extend(
            [
                "| Reference | Category | Source | Location | Recommendation |",
                "|---|---|---|---|---|",
            ]
        )
        for finding in findings:
            location = f"{finding.path}:{finding.line}"
            lines.append(
                "| "
                + " | ".join(
                    [
                        f"`{finding.reference}`",
                        finding.category,
                        finding.source,
                        f"`{location}`",
                        finding.recommendation,
                    ]
                )
                + " |"
            )

    lines.extend(
        [
            "",
            "## Policy",
            "",
            "- `alloy-tdd`, `alloy-brainstorm`, and `alloy-debug` are Alloy-owned entrypoints.",
            "- GSD is project-local and installed only through the `workflow-gsd` or `all` profile.",
            "- OMO Slim is experimental only; default configs must not include the plugin or wildcard skill pools.",
            "- GitHub, Azure DevOps, and Postgres workflows use `gh`, `az devops`, and `psql`.",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument(
        "--opencode-dir",
        type=Path,
        default=Path.home() / ".config" / "opencode",
    )
    parser.add_argument(
        "--report",
        type=Path,
        default=Path("docs/opencode-skill-dependency-audit.md"),
    )
    parser.add_argument("--no-write", action="store_true")
    args = parser.parse_args()

    root = args.root.resolve()
    findings = audit_repository(root)
    skill_names = installed_skill_names(args.opencode_dir)
    matrix = build_dependency_matrix(root, args.opencode_dir)
    report = render_report(root, findings, skill_names, matrix)

    if args.no_write:
        print(report)
    else:
        report_path = root / args.report
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(report, encoding="utf-8")
        print(f"Wrote {report_path.relative_to(root)}")

    blocking = [finding for finding in findings if finding.fail]
    if blocking:
        print(f"Found {len(blocking)} blocked dependency reference(s).")
        return 1
    print("No blocked dependency references found.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
