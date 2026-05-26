import tempfile
import unittest
from pathlib import Path

from scripts import audit_prompt_dependencies as audit


class AuditPromptDependenciesTest(unittest.TestCase):
    def test_detects_removed_workflow_and_skill_references(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "agents").mkdir()
            (root / "agents" / "Orchestrator.md").write_text(
                'Use .sisyphus/boulder.json, team-tdd, frontend-tdd, pg-aiguide, '
                'github MCP, @Oracle, @plannotator/opencode, and "skills": ["*"].',
                encoding="utf-8",
            )

            findings = audit.audit_repository(root)
            names = {finding.reference for finding in findings}

        self.assertIn(".sisyphus", names)
        self.assertIn("boulder.json", names)
        self.assertIn("team-tdd", names)
        self.assertIn("frontend-tdd", names)
        self.assertIn("pg-aiguide", names)
        self.assertIn("github MCP", names)
        self.assertIn("@Oracle", names)
        self.assertIn("@plannotator/opencode", names)
        self.assertIn('skills:["*"]', names)

    def test_builds_dependency_matrix_for_approved_references(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            opencode = root / "opencode"
            (root / "agents").mkdir()
            (root / "agents" / "Orchestrator.md").write_text(
                "Invoke alloy-tdd, alloy-plan, alloy-debug, @Architect, "
                "use context7, and use exa.",
                encoding="utf-8",
            )
            (opencode / "skills" / "alloy-tdd").mkdir(parents=True)
            (opencode / "skills" / "alloy-tdd" / "SKILL.md").write_text("# Alloy TDD")
            (opencode / "skills" / "alloy-plan").mkdir(parents=True)
            (opencode / "skills" / "alloy-plan" / "SKILL.md").write_text("# Alloy Plan")
            (opencode / "skills" / "alloy-debug").mkdir(parents=True)
            (opencode / "skills" / "alloy-debug" / "SKILL.md").write_text("# Alloy Debug")
            (opencode / "agents").mkdir(parents=True)
            (opencode / "agents" / "Architect.md").write_text("# Alloy Architect")
            (opencode / "opencode.json").write_text(
                '{"mcp":{"context7":{"enabled":true},"exa":{"enabled":true}},"plugin":[]}',
                encoding="utf-8",
            )

            rows = audit.build_dependency_matrix(root, opencode)
            by_ref = {row.reference: row for row in rows}

        self.assertEqual(by_ref["alloy-tdd"].actual_name, "alloy-tdd")
        self.assertTrue(by_ref["alloy-tdd"].opencode_visible)
        self.assertTrue(by_ref["alloy-plan"].opencode_visible)
        self.assertTrue(by_ref["alloy-debug"].opencode_visible)
        self.assertTrue(by_ref["@Architect"].opencode_visible)
        self.assertTrue(by_ref["context7"].opencode_visible)
        self.assertTrue(by_ref["exa"].opencode_visible)


if __name__ == "__main__":
    unittest.main()
