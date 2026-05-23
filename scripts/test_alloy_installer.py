import json
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SETUP = ROOT / "setup.sh"


def run_setup(cwd: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["bash", str(SETUP), *args],
        cwd=cwd,
        text=True,
        capture_output=True,
        check=True,
    )


def skill_names(cwd: Path) -> set[str]:
    skills = cwd / ".opencode" / "skills"
    return {path.name for path in skills.iterdir() if path.is_dir()}


class AlloyInstallerTest(unittest.TestCase):
    def test_core_dry_run_is_offline_and_project_local(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = run_setup(
                Path(tmp),
                "--dry-run",
                "--profile",
                "core",
                "--target",
                "local",
                "--models",
                "github-copilot",
            )

        self.assertIn("OpenCode Alloy Setup", result.stdout)
        self.assertIn(".opencode/agents", result.stdout)
        self.assertIn(".opencode/skills", result.stdout)
        self.assertIn(".opencode/opencode.json", result.stdout)
        self.assertNotIn("npx skills add", result.stdout)
        self.assertNotIn("bunx oh-my-opencode-slim install", result.stdout)

    def test_profiles_install_only_their_expected_skill_sets(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for profile in ("frontend", "backend", "infra"):
                (root / profile).mkdir()
                run_setup(root / profile, "--profile", profile, "--target", "local")

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

    def test_workflow_gsd_is_project_local_and_query_shim_works(self):
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)
            run_setup(cwd, "--profile", "workflow-gsd", "--target", "local")
            result = subprocess.run(
                [str(cwd / ".opencode" / "bin" / "gsd-sdk"), "query", "generate-slug", "Alloy Smoke"],
                cwd=cwd,
                text=True,
                capture_output=True,
                check=True,
            )
            plan_phase = (cwd / ".opencode" / "commands" / "gsd" / "gsd-plan-phase.md").read_text()
            config = json.loads((cwd / ".opencode" / "opencode.json").read_text())

        self.assertEqual(json.loads(result.stdout), {"slug": "alloy-smoke"})
        self.assertIn(".opencode/get-shit-done/workflows/plan-phase.md", plan_phase)
        self.assertNotIn("$HOME/.config/opencode", plan_phase)
        self.assertNotIn("plugin", config)

    def test_omo_is_experimental_opt_in_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path(tmp)
            run_setup(cwd, "--profile", "core", "--target", "local")
            base_config = json.loads((cwd / ".opencode" / "opencode.json").read_text())
            self.assertNotIn("plugin", base_config)
            self.assertFalse((cwd / ".opencode" / "oh-my-opencode-slim.json").exists())

            run_setup(cwd, "--profile", "core", "--target", "local", "--with", "omo")
            omo_config = json.loads((cwd / ".opencode" / "opencode.json").read_text())

        self.assertIn("oh-my-opencode-slim@1.1.1", omo_config["plugin"])


if __name__ == "__main__":
    unittest.main()
