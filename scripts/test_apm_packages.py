import json
import os
import shutil
import subprocess
import unittest
from pathlib import Path

try:
    import yaml
except ImportError:
    yaml = None

REPO = Path(__file__).resolve().parent.parent
PACKAGES = ["apm-base", "apm-frontend", "apm-backend", "apm-infra", "apm-qa"]


class ApmPackagesTest(unittest.TestCase):
    def manifest(self, package):
        path = REPO / "packages" / package / "apm.yml"
        self.assertTrue(path.exists(), f"missing {path}")
        if yaml:
            return yaml.safe_load(path.read_text())
        return None

    def test_base_manifest_shape(self):
        data = self.manifest("apm-base")
        if data is None:
            self.skipTest("pyyaml not installed")
        self.assertEqual(data["name"], "alloy-base")
        self.assertEqual(data["target"], "opencode")
        for include in data["includes"]:
            self.assertTrue((REPO / "packages" / "apm-base" / include).exists(), include)

    def test_base_carries_shared_content(self):
        base = REPO / "packages" / "apm-base" / ".apm"
        for path in [
            "agents/planner.agent.md",
            "agents/builder.agent.md",
            "prompts/execute.prompt.md",
            "skills/alloy-tdd/SKILL.md",
            "files/opencode-plugin/alloy.ts",
            "files/opencode-plugin/alloy-task-state.mjs",
        ]:
            self.assertTrue((base / path).exists(), path)

    def test_base_apm_install_smoke(self):
        import tempfile

        apm = shutil.which("apm")
        if not apm:
            self.skipTest("apm CLI not installed")

        try:
            token_result = subprocess.run(
                ["gh", "auth", "token"], capture_output=True, text=True,
            )
        except FileNotFoundError:
            self.skipTest("GitHub token unavailable: gh CLI not installed")

        token = token_result.stdout.strip() if token_result.returncode == 0 else ""
        if not token:
            reason = token_result.stderr.strip() or "gh auth token returned no token"
            self.skipTest(f"GitHub token unavailable: {reason}")

        with tempfile.TemporaryDirectory() as tmp:
            result = subprocess.run(
                [apm, "install", str(REPO / "packages" / "apm-base"), "--target", "opencode"],
                cwd=tmp, capture_output=True, text=True,
                env={**os.environ, "GITHUB_TOKEN": token, "GH_TOKEN": token},
            )
            self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
