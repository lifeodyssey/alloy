---
description: Run automated end-to-end QA against an Azure DevOps work item or manual acceptance criteria
agent: alloy-qa-e2e
---

# /qa

Run the Alloy QA E2E pipeline against a card's acceptance criteria.

## Usage

```
/qa ADO-12345 --base-url https://app.example.com
/qa "AC: user can submit form and see success message" --base-url https://app.example.com
/qa ADO-12345 --figma https://www.figma.com/file/abc123/Frame?node-id=1-23
```

## Workflow

1. Invoke the `alloy-qa-e2e` skill.
2. The skill collects context (Azure DevOps work item or manual AC, optional Figma).
3. QA Agent spawns and runs the full pipeline.
4. You approve the test plan at the plan gate.
5. You review the report at the report gate.

## Output

- Plan: `.alloy/tasks/<task-id>/qa/plan.md`
- Spec: `tests/e2e/azure-<id>-<slug>.spec.ts`
- Report: `.alloy/tasks/<task-id>/qa/report.html`
- Review: `.alloy/tasks/<task-id>/qa/report-review.md`

## User Task

`$ARGUMENTS`
