---
name: alloy-debug
description: Use for bugs, test failures, regressions, and unexpected behavior before proposing or applying fixes.
---

# Alloy Debug

Debug systematically. Do not guess.

## Loop

1. Reproduce the issue or record why it cannot be reproduced yet.
2. Minimize the failing path.
3. Read the relevant code and configuration.
4. Form one hypothesis.
5. Gather evidence with targeted logs, tests, diffs, or inspections.
6. Apply the smallest fix only after evidence supports the cause.
7. Add or update a regression test when code changes.
8. Re-run the original reproduction and the regression test.

## Stop Conditions

Stop and report when credentials, services, data, or external state are required and unavailable. Include the exact missing dependency and the next diagnostic command.
