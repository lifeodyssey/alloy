name: alloy-debug
description: Use when encountering a bug, regression, failing command, or unexpected behavior before attempting a fix.

# Alloy Debug

Use this skill before fixing failures. The goal is root cause, not motion.

## Iron Rule

No fix before root-cause investigation.

## Debug Loop

1. State the symptom and exact failing command or observed behavior.
2. Reproduce it, or document why reproduction is blocked.
3. Identify the smallest failing boundary.
4. Read relevant source, tests, config, generated artifacts, and recent changes.
5. Form one root-cause hypothesis.
6. Test the hypothesis with the smallest check.
7. Only then make a fix.
8. Prove the fix with regression coverage or an equivalent verification guard.

## Artifact Updates

Update `.alloy/tasks/<task-id>/progress.md`:

```markdown
## Gate
- [x] debug - <timestamp> | root cause documented

## Findings
### Debug - <timestamp>
- Symptom:
- Reproduction:
- Root cause:
- Fix:
- Regression guard:
- Commands:
```

## Subagent Policy

Use one-shot Explorer when you cannot find the relevant boundary. Use one-shot Fixer only when the bug spans multiple files and you have a hypothesis plus a failing command.

## Circuit Breaker

If the same fix strategy fails twice:

1. Stop changing code.
2. Record both attempts in `progress.md`.
3. Ask for a narrower Explorer/Fixer investigation or return `BLOCKED`.

## Anti-Patterns

- Guessing from symptoms.
- Applying broad refactors while debugging.
- Declaring success without rerunning the failing command.
- Ignoring generated target files or installer outputs.

## Final Output

Report symptom, root cause, changed files, regression proof, commands run, gate updates, and unresolved risk.
