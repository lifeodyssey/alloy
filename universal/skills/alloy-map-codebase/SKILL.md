name: alloy-map-codebase
description: Use when a task needs broad source understanding before planning or execution.

# Alloy Map Codebase

Use this skill to produce a bounded source map for a task without burning the main session on repeated exploration.

## Use When

- The codebase is unfamiliar.
- The plan needs entry points, contracts, tests, generated outputs, or ownership boundaries.
- A bug crosses modules and Builder needs a smaller map before debugging.

## Artifact

Write:

```text
.alloy/tasks/<task-id>/codebase-map.md
```

## Map Template

```markdown
# <task-id>: Codebase Map

## Question

## Entry Points
- File:
  - Why it matters:

## Data And Control Flow

## Contracts
- Runtime payloads:
- Generated files:
- Public APIs:

## Tests And Commands

## Risky Boundaries

## Recommended Plan Inputs
- Files likely in scope:
- Files to avoid:
- Verification commands:
```

## Subagent Policy

Planner or Builder may ask a one-shot Explorer to gather this map. The request must include the task id, search scope, and expected return format. Explorer must not edit files.

## Final Output

Report map path, files inspected, important boundaries, commands discovered, and risks for planning.
