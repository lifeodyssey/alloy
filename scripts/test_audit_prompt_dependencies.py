import tempfile
import unittest
from pathlib import Path

from scripts import audit_prompt_dependencies as audit


class AuditPromptDependenciesTest(unittest.TestCase):
    def test_detects_removed_workflow_and_skill_references(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "agents").mkdir()
            (root / "agents" / "alloy-orchestrator.md").write_text(
                'Use .sisyphus/boulder.json, team-tdd, frontend-tdd, pg-aiguide, '
                'github MCP, agent: Orchestrator, @plannotator/opencode, and "skills": ["*"].',
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
        self.assertIn("agent: Orchestrator", names)
        self.assertIn("@plannotator/opencode", names)
        self.assertIn('skills:["*"]', names)

    def test_builds_dependency_matrix_for_approved_references(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            opencode = root / "opencode"
            (root / "agents").mkdir()
            (root / "agents" / "alloy-orchestrator.md").write_text(
                "Invoke alloy-tdd, alloy-brainstorm, alloy-debug, @alloy-planner, "
                "use context7, use exa, and run /gsd-plan-phase.",
                encoding="utf-8",
            )
            (opencode / "skills" / "alloy-tdd").mkdir(parents=True)
            (opencode / "skills" / "alloy-tdd" / "SKILL.md").write_text("# Alloy TDD")
            (opencode / "skills" / "alloy-brainstorm").mkdir(parents=True)
            (opencode / "skills" / "alloy-brainstorm" / "SKILL.md").write_text("# Alloy Brainstorm")
            (opencode / "skills" / "alloy-debug").mkdir(parents=True)
            (opencode / "skills" / "alloy-debug" / "SKILL.md").write_text("# Alloy Debug")
            (opencode / "agents").mkdir(parents=True)
            (opencode / "agents" / "alloy-planner.md").write_text("# Alloy Planner")
            (opencode / "commands" / "gsd").mkdir(parents=True)
            (opencode / "commands" / "gsd" / "gsd-plan-phase.md").write_text("# plan")
            (opencode / "opencode.json").write_text(
                '{"mcp":{"context7":{"enabled":true},"exa":{"enabled":true}},"plugin":[]}',
                encoding="utf-8",
            )

            rows = audit.build_dependency_matrix(root, opencode)
            by_ref = {row.reference: row for row in rows}

        self.assertEqual(by_ref["alloy-tdd"].actual_name, "alloy-tdd")
        self.assertTrue(by_ref["alloy-tdd"].opencode_visible)
        self.assertTrue(by_ref["alloy-brainstorm"].opencode_visible)
        self.assertTrue(by_ref["alloy-debug"].opencode_visible)
        self.assertTrue(by_ref["@alloy-planner"].opencode_visible)
        self.assertTrue(by_ref["context7"].opencode_visible)
        self.assertTrue(by_ref["exa"].opencode_visible)
        self.assertTrue(by_ref["/gsd-plan-phase"].opencode_visible)


if __name__ == "__main__":
    unittest.main()
