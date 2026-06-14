name: azure-devops-context
description: Fetch and normalize an Azure DevOps work item into a structured QA context. Wraps `az boards work-item show`.

# Azure DevOps Context

Use when the QA pipeline needs to read an Azure DevOps work item's title, description, acceptance criteria, and comments.

## Trigger

User provides an Azure DevOps work item URL or ID:
- `https://dev.azure.com/<org>/<project>/_workitems/edit/<id>`
- `ADO-12345`
- `az boards work-item show --id 12345`

## Required Env

```bash
AZURE_DEVOPS_ORG=my-org        # fallback if not parsed from URL
AZURE_DEVOPS_PROJECT=my-proj   # fallback if not parsed from URL
```

Or the user provides them inline. The Azure CLI (`az`) must be installed and logged in (`az login`).

## Fetch

Parse the work item ID and org/project from the URL or env, then:

```bash
az boards work-item show --id <id> --org https://dev.azure.com/<org> --project <project> --output json
```

## Output

Write normalized context to `.alloy/tasks/<task-id>/qa/context.md`:

```markdown
# QA Context

## Source
- Azure DevOps Work Item: ADO-<id>
- URL: https://dev.azure.com/<org>/<project>/_workitems/edit/<id>
- Fetched: <timestamp>

## Work Item
- **Title:** <System.Title>
- **State:** <System.State>
- **Assigned To:** <System.AssignedTo>
- **Type:** <System.WorkItemType>

## Description
<System.Description rendered as markdown>

## Acceptance Criteria
<extracted from Description or custom field; if embedded as markdown list, preserve structure>

## Comments / Discussion
<most recent 5 comments, oldest first>

## Linked Artifacts (if any)
<list of related work items, PRs, or attachments with URLs>
```

If `az boards work-item show` fails (not logged in, wrong org, invalid ID):
- Report the exact error
- Suggest `az login` or checking org/project
- Do NOT fabricate context — fail explicitly so Planner knows the source is unavailable

## No Side Effects

This skill only reads Azure DevOps. It never modifies work items, creates comments, or changes state.
