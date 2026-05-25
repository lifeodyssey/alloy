import json
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SETUP = ROOT / "setup.sh"
ALLOY = ROOT / "bin" / "alloy.mjs"


def run_setup(cwd: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["bash", str(SETUP), *args],
        cwd=cwd,
        text=True,
        capture_output=True,
        check=check,
    )


def run_alloy(cwd: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["node", str(ALLOY), *args],
        cwd=cwd,
        text=True,
        capture_output=True,
        check=check,
    )


def skill_names(cwd: Path) -> set[str]:
    skills = cwd / ".opencode" / "skills"
    return {path.name for path in skills.iterdir() if path.is_dir()}


def agent_names(cwd: Path) -> set[str]:
    agents = cwd / ".opencode" / "agents"
    return {path.stem for path in agents.iterdir() if path.suffix == ".md"}


def parse_json(stdout: str) -> dict:
    return json.loads(stdout)


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

        self.assertIn("OpenCode Alloy Setup", result.stdout)
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

        self.assertIn("frontend-ui-ux", frontend)
        self.assertIn("playwright-cli", frontend)
        self.assertNotIn("postgres", frontend)
        self.assertNotIn("terraform-skill", frontend)

        self.assertIn("postgres", backend)
        self.assertIn("kotlin-backend-jpa-entity-mapping", backend)
        self.assertNotIn("frontend-ui-ux", backend)
        self.assertNotIn("terraform-skill", backend)

        self.assertIn("terraform-skill", infra)
        self.assertNotIn("postgres", infra)
        self.assertNotIn("frontend-ui-ux", infra)

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
            safety_net_exists = (cwd / ".safety-net.json").exists()

        self.assertTrue(project["runtimes"]["bun"])
        self.assertEqual(agents, {"Orchestrator", "Explorer", "Architect", "Builder", "Fixer", "Reviewer", "Tester"})
        self.assertEqual(config["default_agent"], "Orchestrator")
        self.assertEqual(set(config["agent"].keys()), {"Orchestrator", "Explorer", "Architect", "Builder", "Fixer", "Reviewer", "Tester"})
        self.assertEqual(plugin_pkg["dependencies"]["@opencode-ai/plugin"], "1.15.10")
        self.assertEqual(plugin_pkg["dependencies"]["zod"], "4.4.3")
        self.assertTrue(plugin_exists)
        self.assertTrue(safety_net_exists)
        self.assertIn("cc-safety-net", config["plugin"])
        safety_net_rules = {(rule["subcommand"], tuple(rule["block_args"])) for rule in safety_net["rules"]}
        self.assertIn(("am", ("--no-verify",)), safety_net_rules)
        self.assertIn(("am", ("-n",)), safety_net_rules)

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

    def test_state_and_gate_block_then_pass_with_evidence(self):
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)
            run_setup(cwd, "--pack", "core", "--target", "local")
            task = parse_json(run_alloy(cwd, "state", "add-task", "--title", "Implement login", "--kind", "code").stdout)

            blocked = run_alloy(cwd, "gate", "check", "--task-id", task["id"], "--json", check=False)
            self.assertNotEqual(blocked.returncode, 0)
            blocked_json = parse_json(blocked.stdout)
            self.assertFalse(blocked_json["ok"])
            self.assertIn("tdd_gate", [item["name"] for item in blocked_json["checks"] if not item["ok"]])

            run_alloy(cwd, "state", "add-evidence", "--task-id", task["id"], "--kind", "tdd_red", "--summary", "Failing test added")
            run_alloy(cwd, "state", "add-evidence", "--task-id", task["id"], "--kind", "tdd_green", "--summary", "Test passes")
            run_alloy(cwd, "state", "add-evidence", "--task-id", task["id"], "--kind", "test", "--summary", "npm test passed")
            passed = run_alloy(cwd, "gate", "check", "--task-id", task["id"], "--json")

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

        self.assertIn("OpenCode Alloy Sync", result.stdout)
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
            self.assertEqual(config["agent"]["Architect"]["model"], "openai/gpt-5.4")

    def test_audit_only_does_not_install(self):
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)
            result = run_setup(cwd, "--audit-only", "--pack", "core", "--target", "local", check=False)

            self.assertNotEqual(result.returncode, 0)
            self.assertFalse((cwd / ".opencode").exists())

    def test_invalid_target_fails_fast(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = run_setup(Path(tmp), "--pack", "core", "--target", "glboal", check=False)

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("--target must be local or global", result.stderr)

if __name__ == "__main__":
    unittest.main()
