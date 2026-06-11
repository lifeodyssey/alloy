from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PACKAGE_VERSION = json.loads((ROOT / "package.json").read_text())["version"]
SETUP = ROOT / "setup.sh"
ALLOY = ROOT / "bin" / "alloy.mjs"
BASH = shutil.which("bash") or "bash"
NODE = shutil.which("node") or "node"


def run_setup(cwd: Path, *args: str, check: bool = True, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [BASH, str(SETUP), *args],
        cwd=cwd,
        text=True,
        capture_output=True,
        check=check,
        env={**os.environ, **(env or {})},
    )


def run_alloy(cwd: Path, *args: str, check: bool = True, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [NODE, str(ALLOY), *args],
        cwd=cwd,
        text=True,
        capture_output=True,
        check=check,
        env={**os.environ, **(env or {})},
    )


def skill_names(cwd: Path) -> set[str]:
    skills = cwd / ".opencode" / "skills"
    return {path.name for path in skills.iterdir() if path.is_dir()}


def agent_names(cwd: Path) -> set[str]:
    agents = cwd / ".opencode" / "agents"
    return {path.stem for path in agents.iterdir() if path.suffix == ".md"}


def parse_json(stdout: str) -> dict:
    return json.loads(stdout)


def read_manifest(cwd: Path) -> dict:
    return json.loads((cwd / ".opencode" / "alloy.manifest.json").read_text())


def make_executable(path: Path, text: str) -> None:
    path.write_text(text)
    path.chmod(0o755)


class AlloyInstallerTest(unittest.TestCase):
    def test_core_dry_run_is_offline_project_local_and_bun_enabled(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = run_setup(
                Path(tmp),
                "--dry-run",
                "--pack",
                "core",
                "--target",
                "local",
                "--models",
                "github-copilot",
            )

        self.assertIn("Alloy Setup", result.stdout)
        self.assertIn(".alloy/alloy.project.json", result.stdout)
        self.assertIn(".opencode/agents", result.stdout)
        self.assertIn(".opencode/skills", result.stdout)
        self.assertIn(".opencode/plugins/alloy.ts", result.stdout)
        self.assertIn(".opencode/package.json", result.stdout)
        self.assertIn(".opencode/opencode.json", result.stdout)
        self.assertNotIn("npx skills add", result.stdout)
        self.assertNotIn("bunx oh-my-opencode-slim install", result.stdout)

    def test_profile_alias_remains_compatible(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = run_setup(Path(tmp), "--dry-run", "--profile", "core", "--target", "local")

        self.assertIn("Profile alias: deprecated", result.stdout)

    def test_packs_install_only_their_expected_skill_sets(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for pack in ("frontend", "backend", "infra"):
                (root / pack).mkdir()
                run_setup(root / pack, "--pack", pack, "--target", "local")

            frontend = skill_names(root / "frontend")
            backend = skill_names(root / "backend")
            infra = skill_names(root / "infra")

        baseline = {"alloy-tdd", "alloy-plan", "alloy-debug", "git-master", "humanizer"}
        workflow_extras = {
            "alloy-discuss",
            "alloy-execute",
            "alloy-verify",
            "alloy-using",
            "alloy-autopilot",
            "alloy-map-codebase",
            "alloy-qa",
        }
        self.assertEqual(
            frontend,
            baseline | workflow_extras | {"frontend-ui-ux", "playwright-cli", "vercel-react-best-practices"},
        )
        self.assertEqual(
            backend,
            baseline
            | workflow_extras
            | {"kotlin-backend-jpa-entity-mapping", "postgres", "design-postgres-tables", "pgvector-semantic-search"},
        )
        self.assertEqual(infra, baseline | workflow_extras | {"terraform-skill"})

    def test_install_generates_alloy_project_and_plugin_dependencies(self):
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)
            run_setup(cwd, "--pack", "core", "--target", "local")
            project = json.loads((cwd / ".alloy" / "alloy.project.json").read_text())
            plugin_pkg = json.loads((cwd / ".opencode" / "package.json").read_text())
            config = json.loads((cwd / ".opencode" / "opencode.json").read_text())
            agents = agent_names(cwd)
            safety_net = json.loads((cwd / ".safety-net.json").read_text())
            plugin_exists = (cwd / ".opencode" / "plugins" / "alloy.ts").exists()
            plugin_files = sorted(path.name for path in (cwd / ".opencode" / "plugins").iterdir())
            plugin_helper_exists = (cwd / ".opencode" / "lib" / "alloy-task-state.mjs").exists()
            safety_net_exists = (cwd / ".safety-net.json").exists()

            self.assertTrue(project["runtimes"]["bun"])
            self.assertTrue((cwd / ".alloy" / ".gitignore").exists())
            self.assertTrue((cwd / ".alloy" / "tasks").is_dir())
            self.assertFalse((cwd / ".alloy" / "state").exists())
            self.assertFalse((cwd / ".alloy" / "projections").exists())
            self.assertEqual(agents, {"Planner", "Builder"})
            self.assertEqual(config["default_agent"], "Planner")
            self.assertEqual(set(config["agent"].keys()), {"Planner", "Builder"})
            self.assertEqual(plugin_pkg["dependencies"]["@opencode-ai/plugin"], "1.15.10")
            self.assertEqual(plugin_pkg["dependencies"]["zod"], "4.4.3")
            self.assertTrue(plugin_exists)
            self.assertTrue(plugin_helper_exists)
            self.assertEqual(plugin_files, ["alloy.ts"])
            self.assertTrue(safety_net_exists)
            self.assertIn("cc-safety-net", config["plugin"])
            safety_net_rules = {(rule["subcommand"], tuple(rule["block_args"])) for rule in safety_net["rules"]}
            self.assertIn(("am", ("--no-verify",)), safety_net_rules)
            self.assertIn(("am", ("-n",)), safety_net_rules)

    def test_install_migrates_legacy_specs_dir_to_tasks_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)
            legacy_dir = cwd / ".alloy" / "specs" / "demo"
            legacy_dir.mkdir(parents=True)
            (legacy_dir / "plan.md").write_text("# Demo\n", encoding="utf-8")

            run_setup(cwd, "--pack", "core", "--target", "local")

            self.assertFalse((cwd / ".alloy" / "specs").exists())
            self.assertTrue((cwd / ".alloy" / "tasks" / "demo" / "plan.md").exists())

    def test_state_command_writes_markdown_task_artifacts(self):
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)

            add_task = run_alloy(cwd, "state", "add-task", "--task-id", "T1", "--title", "Markdown state", "--kind", "docs")
            self.assertIn("T1", add_task.stdout)

            progress = cwd / ".alloy" / "tasks" / "T1" / "progress.md"
            project = cwd / ".alloy" / "PROJECT.md"
            self.assertTrue(project.exists())
            self.assertTrue(progress.exists())
            self.assertIn("| T1 | Markdown state | open | docs | normal |", project.read_text())

            run_alloy(
                cwd,
                "state",
                "add-evidence",
                "--task-id",
                "T1",
                "--kind",
                "green",
                "--summary",
                "focused check passed",
                "--cmd",
                "npm test",
            )

            progress_text = progress.read_text()
            self.assertIn("- [x] green", progress_text)
            self.assertIn("focused check passed", progress_text)
            gate = run_alloy(cwd, "gate", "check", "--task-id", "T1", "--json", check=False)
            partial_gate = json.loads(gate.stdout)
            self.assertFalse(partial_gate["ok"])
            self.assertIn("review", partial_gate["blockedBy"])

            for kind in ["tdd_red", "debug", "review", "verified"]:
                run_alloy(cwd, "state", "add-evidence", "--task-id", "T1", "--kind", kind, "--summary", f"{kind} proof")

            gate = run_alloy(cwd, "gate", "check", "--task-id", "T1", "--json")
            self.assertTrue(json.loads(gate.stdout)["ok"])
            self.assertFalse((cwd / ".alloy" / "state").exists())
            self.assertFalse((cwd / ".alloy" / "projections").exists())

    def test_install_does_not_write_presets_json(self):
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)
            run_setup(cwd, "--pack", "core", "--target", "local")

            self.assertFalse((cwd / ".opencode" / "presets.json").exists())

    def test_install_writes_manifest_with_managed_visible_and_explicit_sections(self):
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)
            run_alloy(cwd, "install", "--pack", "core", "--target", "local")
            manifest = read_manifest(cwd)

        self.assertEqual(manifest["version"], PACKAGE_VERSION)
        self.assertEqual(manifest["pack"], "core")
        self.assertEqual(manifest["models"], "github-copilot")
        self.assertIn("alloy-tdd", manifest["managed"]["skills"])
        self.assertEqual(manifest["managed"]["agents"], ["Planner", "Builder"])
        self.assertIn("plan", manifest["managed"]["commands"])
        self.assertEqual(manifest["managed"]["mcp"], ["context7", "grep_app", "exa"])
        self.assertEqual(manifest["visible"]["skills"], manifest["managed"]["skills"])
        self.assertEqual(manifest["visible"]["agents"], manifest["managed"]["agents"])
        self.assertEqual(manifest["explicit"], {"added": []})
        self.assertEqual(manifest["excluded"], [])

    def test_positional_install_pack_selects_frontend_for_cli_and_setup(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            cli = root / "cli"
            setup = root / "setup"
            cli.mkdir()
            setup.mkdir()

            run_alloy(cli, "install", "frontend")
            run_setup(setup, "frontend", "--target", "local")
            cli_manifest = read_manifest(cli)
            setup_manifest = read_manifest(setup)

        self.assertEqual(cli_manifest["pack"], "frontend")
        self.assertEqual(setup_manifest["pack"], "frontend")
        self.assertIn("frontend-ui-ux", cli_manifest["managed"]["skills"])
        self.assertIn("frontend-ui-ux", setup_manifest["managed"]["skills"])

    def test_global_install_writes_alloy_state_under_home(self):
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp) / "repo"
            home = Path(tmp) / "home"
            cwd.mkdir()
            run_alloy(cwd, "install", "--pack", "core", "--target", "global", env={"HOME": str(home)})
            state = json.loads((home / ".config" / "alloy" / "state.json").read_text())

        self.assertEqual(state["version"], PACKAGE_VERSION)
        self.assertEqual(state["pack"], "core")
        self.assertIn("alloy-tdd", state["managed"]["skills"])
        self.assertRegex(state["lastSyncedVendorLock"], r"^[a-f0-9]{64}$")

    def test_add_installs_cross_scope_skill_and_updates_manifest_visibility(self):
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)
            run_alloy(cwd, "install", "--pack", "core")
            run_alloy(cwd, "add", "frontend-ui-ux")
            manifest = read_manifest(cwd)

            self.assertTrue((cwd / ".opencode" / "skills" / "frontend-ui-ux" / "SKILL.md").is_file())
            self.assertIn("frontend-ui-ux", manifest["managed"]["skills"])
            self.assertIn("frontend-ui-ux", manifest["visible"]["skills"])
            self.assertIn("frontend-ui-ux", manifest["explicit"]["added"])

    def test_remove_hides_skill_and_records_excluded_choice(self):
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)
            run_alloy(cwd, "install", "--pack", "core")
            run_alloy(cwd, "remove", "alloy-tdd")
            manifest = read_manifest(cwd)

        self.assertIn("alloy-tdd", manifest["managed"]["skills"])
        self.assertNotIn("alloy-tdd", manifest["visible"]["skills"])
        self.assertIn("alloy-tdd", manifest["excluded"])
        self.assertNotIn("removed", manifest["explicit"])

    def test_add_migrates_legacy_removed_manifest_to_excluded(self):
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)
            run_alloy(cwd, "install", "--pack", "core")
            manifest_path = cwd / ".opencode" / "alloy.manifest.json"
            manifest = json.loads(manifest_path.read_text())
            manifest["visible"]["skills"] = [item for item in manifest["visible"]["skills"] if item != "alloy-tdd"]
            manifest["explicit"]["removed"] = ["alloy-tdd"]
            manifest.pop("excluded", None)
            manifest_path.write_text(json.dumps(manifest))

            run_alloy(cwd, "add", "alloy-tdd")
            updated = read_manifest(cwd)

        self.assertIn("alloy-tdd", updated["visible"]["skills"])
        self.assertEqual(updated["excluded"], [])
        self.assertNotIn("removed", updated["explicit"])

    def test_list_and_installed_alias_show_manifest_inventory(self):
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)
            run_alloy(cwd, "install", "--pack", "core")
            plain = run_alloy(cwd, "list")
            alias = run_alloy(cwd, "list", "--installed")

        self.assertIn("Managed skills", plain.stdout)
        self.assertIn("Visible skills", plain.stdout)
        self.assertIn("alloy-tdd", plain.stdout)
        self.assertEqual(plain.stdout, alias.stdout)

    def test_search_prints_internal_results_and_npx_passthrough(self):
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)
            fake_bin = cwd / "bin"
            fake_bin.mkdir()
            make_executable(fake_bin / "npx", "#!/bin/sh\necho external:$*\n")
            result = run_alloy(cwd, "search", "react", env={"PATH": f"{fake_bin}:{os.environ['PATH']}"})

        self.assertIn("Internal inventory", result.stdout)
        self.assertIn("vercel-react-best-practices", result.stdout)
        self.assertIn("external:skills find react", result.stdout)

    def test_outdated_queries_release_api_and_prints_table(self):
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)
            lock = cwd / "vendor.lock.json"
            lock.write_text(json.dumps([
                {"name": "demo-skill", "kind": "skill", "source": "https://github.com/acme/demo", "version": "v1.0.0"}
            ]))
            result = run_alloy(
                cwd,
                "outdated",
                env={
                    "ALLOY_VENDOR_LOCK_PATH": str(lock),
                    "ALLOY_GITHUB_RELEASES_JSON": json.dumps({"acme/demo": "v2.0.0"}),
                },
            )

        self.assertIn("name", result.stdout)
        self.assertIn("installed", result.stdout)
        self.assertIn("latest", result.stdout)
        self.assertIn("demo-skill", result.stdout)
        self.assertIn("v1.0.0", result.stdout)
        self.assertIn("v2.0.0", result.stdout)
        self.assertIn("outdated", result.stdout)

    def test_upgrade_upstream_name_invokes_revendor_apply_with_resolved_vendor_name(self):
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)
            lock = cwd / "vendor.lock.json"
            log = cwd / "revendor.log"
            fake = cwd / "fake-revendor.mjs"
            lock.write_text(json.dumps([
                {"name": "demo-skill", "kind": "skill", "source": "https://github.com/acme/demo", "version": "v1.0.0", "paths": []}
            ]))
            fake.write_text("import { appendFileSync } from 'node:fs'; appendFileSync(process.env.ALLOY_REVENDOR_LOG, process.argv.slice(2).join(' ') + '\\n');\n")
            run_alloy(
                cwd,
                "upgrade",
                "demo",
                env={
                    "ALLOY_VENDOR_LOCK_PATH": str(lock),
                    "ALLOY_REVENDOR_SCRIPT": str(fake),
                    "ALLOY_REVENDOR_LOG": str(log),
                },
            )
            log_text = log.read_text()

        self.assertIn("--apply demo-skill", log_text)

    def test_upgrade_vendored_local_name_skips_revendor_and_verifies_paths(self):
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)
            log = cwd / "revendor.log"
            fake = cwd / "fake-revendor.mjs"
            fake.write_text("import { appendFileSync } from 'node:fs'; appendFileSync(process.env.ALLOY_REVENDOR_LOG, process.argv.slice(2).join(' ') + '\\n');\n")
            result = run_alloy(
                cwd,
                "upgrade",
                "vercel-react",
                env={"ALLOY_REVENDOR_SCRIPT": str(fake), "ALLOY_REVENDOR_LOG": str(log)},
            )

        self.assertFalse(log.exists())
        self.assertIn("vendored-local", result.stdout)
        self.assertIn("verified", result.stdout)

    def test_upgrade_self_runs_curl_install_script(self):
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)
            fake_bin = cwd / "bin"
            fake_bin.mkdir()
            make_executable(fake_bin / "curl", "#!/bin/sh\necho 'echo self-upgrade-script-ran'\n")
            result = run_alloy(cwd, "upgrade", "--self", env={"PATH": f"{fake_bin}:{os.environ['PATH']}"})

        self.assertIn("self-upgrade-script-ran", result.stdout)

    def test_upgrade_all_vendors_revendors_outdated_entries(self):
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)
            lock = cwd / "vendor.lock.json"
            log = cwd / "revendor.log"
            fake = cwd / "fake-revendor.mjs"
            lock.write_text(json.dumps([
                {"name": "demo-skill", "kind": "skill", "source": "https://github.com/acme/demo", "version": "v1.0.0"}
            ]))
            fake.write_text("import { appendFileSync } from 'node:fs'; appendFileSync(process.env.ALLOY_REVENDOR_LOG, process.argv.slice(2).join(' ') + '\\n');\n")
            run_alloy(
                cwd,
                "upgrade",
                "--all-vendors",
                env={
                    "ALLOY_VENDOR_LOCK_PATH": str(lock),
                    "ALLOY_GITHUB_RELEASES_JSON": json.dumps({"acme/demo": "v2.0.0"}),
                    "ALLOY_REVENDOR_SCRIPT": str(fake),
                    "ALLOY_REVENDOR_LOG": str(log),
                },
            )
            log_text = log.read_text()

        self.assertIn("--apply demo-skill", log_text)

    def test_add_container_use_reports_missing_prereqs(self):
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)
            fake_bin = cwd / "empty-bin"
            fake_bin.mkdir()
            run_alloy(cwd, "install", "--pack", "core")
            result = run_alloy(cwd, "add", "container-use", check=False, env={"PATH": str(fake_bin)})

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Missing container-use prerequisites", result.stderr)
        self.assertIn("brew install container-use", result.stderr)

    def test_add_container_use_enables_mcp_when_prereqs_exist(self):
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)
            fake_bin = cwd / "bin"
            fake_bin.mkdir()
            make_executable(fake_bin / "docker", "#!/bin/sh\nexit 0\n")
            make_executable(fake_bin / "container-use", "#!/bin/sh\nexit 0\n")
            run_alloy(cwd, "install", "--pack", "core")
            run_alloy(cwd, "add", "container-use", env={"PATH": str(fake_bin)})
            manifest = read_manifest(cwd)
            config = json.loads((cwd / ".opencode" / "opencode.json").read_text())

        self.assertIn("container-use", manifest["managed"]["mcp"])
        self.assertIn("using-sandboxes", manifest["visible"]["skills"])
        self.assertTrue(config["mcp"]["container-use"]["enabled"])

    def test_resolve_uses_project_config_when_pack_and_models_are_omitted(self):
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)
            alloy_dir = cwd / ".alloy"
            alloy_dir.mkdir()
            (alloy_dir / "alloy.project.json").write_text(
                json.dumps(
                    {
                        "repoKind": "backend",
                        "packs": ["backend"],
                        "models": "openai",
                        "mcp": {"baseline": ["context7"], "disabled": []},
                        "workflow": {"mode": "standard", "tdd": "required_for_code", "claims": True, "review": "standard"},
                        "runtimes": {"node": True, "bun": True, "npx": False},
                    }
                )
            )
            resolved = parse_json(run_alloy(cwd, "resolve", "--json").stdout)

        self.assertEqual(resolved["pack"]["id"], "backend")
        self.assertEqual(resolved["modelName"], "openai")
        self.assertEqual(list(resolved["mcp"].keys()), ["context7"])

    def test_extends_merges_atoms(self):
        with tempfile.TemporaryDirectory() as tmp:
            resolved = parse_json(run_alloy(Path(tmp), "resolve", "--pack", "frontend", "--json").stdout)

        inline_equivalent_skills = [
            "alloy-tdd",
            "alloy-plan",
            "alloy-debug",
            "git-master",
            "humanizer",
            "alloy-discuss",
            "alloy-execute",
            "alloy-verify",
            "alloy-using",
            "alloy-autopilot",
            "alloy-map-codebase",
            "alloy-qa",
            "frontend-ui-ux",
            "playwright-cli",
            "vercel-react-best-practices",
        ]
        inline_equivalent_agents = ["Planner", "Builder"]
        inline_equivalent_commands = [
            "autopilot",
            "discuss",
            "execute",
            "plan",
            "verify",
            "handoff",
            "init-deep",
            "refactor",
            "start-work",
            "stop-continuation",
            "ultrawork",
            "ulw-loop",
        ]

        self.assertEqual(resolved["pack"]["skills"], inline_equivalent_skills)
        self.assertEqual(resolved["pack"]["agents"], inline_equivalent_agents)
        self.assertEqual(resolved["pack"]["commands"], inline_equivalent_commands)
        self.assertEqual(resolved["pack"]["mcp"], ["context7", "grep_app", "exa"])

    def test_global_install_preserves_existing_user_config_entries(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            home = root / "home"
            cwd = root / "project"
            target = home / ".config" / "opencode"
            target.mkdir(parents=True)
            cwd.mkdir()
            existing = {
                "$schema": "https://opencode.ai/config.json",
                "theme": "user-theme",
                "plugin": ["user-plugin"],
                "mcp": {
                    "context7": {"type": "remote", "url": "https://user.example/context7"},
                    "custom-mcp": {"type": "remote", "url": "https://user.example/custom"},
                },
                "agent": {"UserAgent": {"model": "user/model"}},
            }
            (target / "opencode.json").write_text(json.dumps(existing))
            env = {**os.environ, "HOME": str(home)}

            run_alloy(cwd, "install", "--pack", "core", "--target", "global", env=env)
            config = json.loads((target / "opencode.json").read_text())

        self.assertEqual(config["theme"], "user-theme")
        self.assertIn("user-plugin", config["plugin"])
        self.assertIn("cc-safety-net", config["plugin"])
        self.assertEqual(config["mcp"]["context7"]["url"], "https://user.example/context7")
        self.assertEqual(config["mcp"]["custom-mcp"]["url"], "https://user.example/custom")
        self.assertIn("grep_app", config["mcp"])
        self.assertIn("UserAgent", config["agent"])
        self.assertIn("Planner", config["agent"])

    def test_scope_skills_load_from_new_dirs(self):
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)
            resolved = parse_json(run_alloy(cwd, "resolve", "--pack", "frontend", "--json").stdout)
            run_setup(cwd, "--pack", "frontend", "--target", "local")

            frontend_source = Path(resolved["skillSources"]["frontend-ui-ux"])
            vercel_source = Path(resolved["skillSources"]["vercel-react-best-practices"])
            self.assertTrue(frontend_source.as_posix().endswith("scopes/frontend/skills/frontend-ui-ux"))
            self.assertTrue(vercel_source.as_posix().endswith("vendor/skills/scopes/frontend/vercel-react-best-practices"))
            self.assertTrue((frontend_source / "SKILL.md").is_file())
            self.assertTrue((vercel_source / "SKILL.md").is_file())
            self.assertTrue((cwd / ".opencode" / "skills" / "frontend-ui-ux" / "SKILL.md").is_file())
            self.assertTrue((cwd / ".opencode" / "skills" / "vercel-react-best-practices" / "SKILL.md").is_file())

    def test_removed_gsd_and_omo_paths_fail_fast(self):
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)
            with_gsd = run_setup(cwd, "--pack", "core", "--target", "local", "--with", "gsd", check=False)
            with_omo = run_setup(cwd, "--pack", "core", "--target", "local", "--with", "omo", check=False)
            workflow_gsd = run_setup(cwd, "--pack", "workflow-gsd", "--target", "local", check=False)

        self.assertNotEqual(with_gsd.returncode, 0)
        self.assertIn("--with/--without were removed", with_gsd.stderr)
        self.assertNotEqual(with_omo.returncode, 0)
        self.assertIn("--with/--without were removed", with_omo.stderr)
        self.assertNotEqual(workflow_gsd.returncode, 0)
        self.assertIn("Unknown pack: workflow-gsd", workflow_gsd.stderr)

    def test_all_pack_does_not_install_legacy_gsd_by_default(self):
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)
            run_setup(cwd, "--pack", "all", "--target", "local")

            self.assertFalse((cwd / ".opencode" / "commands" / "gsd").exists())
            self.assertFalse((cwd / ".opencode" / "bin" / "gsd-sdk").exists())

    def test_no_omo_plugin_or_gsd_commands_are_installed(self):
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)
            run_setup(cwd, "--pack", "core", "--target", "local")
            config = json.loads((cwd / ".opencode" / "opencode.json").read_text())

        self.assertNotIn("oh-my-opencode-slim", config.get("plugin", []))
        self.assertFalse((cwd / ".opencode" / "oh-my-opencode-slim.json").exists())
        self.assertFalse((cwd / ".opencode" / "commands" / "gsd").exists())
        self.assertFalse((cwd / ".opencode" / "bin" / "gsd-sdk").exists())

    def test_markdown_progress_gate_blocks_then_passes(self):
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)
            run_setup(cwd, "--pack", "core", "--target", "local")
            task_id = "AB-1234"
            task_dir = cwd / ".alloy" / "tasks" / task_id
            task_dir.mkdir(parents=True)
            progress = task_dir / "progress.md"
            progress.write_text(
                "# AB-1234: Implement login — Progress\n\n"
                "## Gate\n\n"
                "- [x] tdd_red — failing login test added\n"
                "- [ ] green\n"
                "- [ ] review\n"
                "- [ ] verified\n"
            )

            blocked = run_alloy(cwd, "gate", "check", "--task-id", task_id, "--json", check=False)
            self.assertNotEqual(blocked.returncode, 0)
            blocked_json = parse_json(blocked.stdout)
            self.assertFalse(blocked_json["ok"])
            self.assertEqual(blocked_json["blockedBy"], ["green", "review", "verified"])

            progress.write_text(progress.read_text().replace("- [ ] green", "- [x] green — tests pass"))
            progress.write_text(progress.read_text().replace("- [ ] review", "- [x] review — Reviewer AC 4/4"))
            progress.write_text(progress.read_text().replace("- [ ] verified", "- [x] verified — npm test"))
            passed = run_alloy(cwd, "gate", "check", "--task-id", task_id, "--json")

            self.assertTrue(parse_json(passed.stdout)["ok"])

    def test_sync_dry_run_is_project_local(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for name in ("web", "api"):
                (root / name).mkdir()
            workspace = root / "alloy.workspace.json"
            workspace.write_text(
                json.dumps(
                    {
                        "projects": [
                            {"path": "web", "config": ".alloy/alloy.project.json"},
                            {"path": "api", "config": ".alloy/alloy.project.json"},
                        ]
                    }
                )
            )
            result = run_alloy(root, "sync", "--workspace", str(workspace), "--dry-run")

        self.assertIn("Alloy Sync", result.stdout)
        self.assertIn("sync project", result.stdout)
        self.assertIn(".opencode/opencode.json", result.stdout)
        self.assertNotIn(str(Path.home() / ".config" / "opencode"), result.stdout)

    def test_sync_uses_custom_workspace_config_path(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "web").mkdir()
            (root / "configs").mkdir()
            (root / "configs" / "web.alloy.json").write_text(
                json.dumps(
                    {
                        "repoKind": "frontend",
                        "packs": ["frontend"],
                        "models": "openai",
                        "mcp": {"baseline": ["context7"], "disabled": []},
                        "workflow": {"mode": "standard", "tdd": "required_for_code", "claims": True, "review": "standard"},
                        "runtimes": {"node": True, "bun": True, "npx": False},
                    }
                )
            )
            workspace = root / "alloy.workspace.json"
            workspace.write_text(json.dumps({"projects": [{"path": "web", "config": "../configs/web.alloy.json"}]}))
            run_alloy(root, "sync", "--workspace", str(workspace))
            config = json.loads((root / "web" / ".opencode" / "opencode.json").read_text())

            self.assertIn("frontend-ui-ux", skill_names(root / "web"))
            self.assertEqual(config["agent"]["Planner"]["model"], "openai/gpt-5.4")

    def test_audit_only_does_not_install(self):
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)
            result = run_setup(cwd, "--audit-only", "--pack", "core", "--target", "local", check=False)

            self.assertNotEqual(result.returncode, 0)
            self.assertFalse((cwd / ".opencode").exists())

    def test_doctor_preinstall_succeeds_without_opencode_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)
            result = run_alloy(cwd, "doctor", "--pack", "core", "--target", "local")

        self.assertIn("Alloy Doctor", result.stdout)
        self.assertIn("Run alloy install first for full doctor", result.stdout)

    def test_missing_defaults_json_fails_without_node_stack(self):
        backup = ROOT / "defaults.json.testbak"
        defaults = ROOT / "defaults.json"
        defaults.rename(backup)
        try:
            with tempfile.TemporaryDirectory() as tmp:
                result = run_alloy(Path(tmp), "resolve", "--pack", "core", check=False)
        finally:
            backup.rename(defaults)

        self.assertEqual(result.returncode, 1)
        self.assertIn(f"ERROR: Missing defaults.json at {defaults}", result.stderr)
        self.assertIn("Ensure you are running alloy from the repo root.", result.stderr)
        self.assertNotIn("ENOENT", result.stderr)
        self.assertNotIn("at Object", result.stderr)

    def test_invalid_target_fails_fast(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = run_setup(Path(tmp), "--pack", "core", "--target", "glboal", check=False)

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("--target must be local or global", result.stderr)

    def test_revendor_sync_plan_routes_fusion_types(self):
        result = subprocess.run(
            [NODE, str(ROOT / "scripts" / "revendor.mjs"), "--sync-plan", "--json"],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=True,
        )
        rows = {row["name"]: row for row in json.loads(result.stdout)}

        self.assertEqual(rows["superpowers-brainstorming"]["fusionType"], "verbatim")
        self.assertEqual(rows["superpowers-brainstorming"]["action"], "auto-pr")
        self.assertTrue(rows["alloy-tdd"]["internal"])
        self.assertEqual(rows["alloy-tdd"]["action"], "skip-internal")

if __name__ == "__main__":
    unittest.main()
