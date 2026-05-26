---
name: ralph-loop
description: Use when a task needs a bounded retry loop between execution, review, testing, and follow-up fixes
---

# Ralph Loop

Ralph Loop runs recurring work as a bounded retry loop. Use it when an implementation needs repeated executor, reviewer, tester, or verifier passes, but keep the loop finite: define the goal, the stopping condition, the maximum iteration count, and the evidence required before another pass starts.

Start the loop with `/ralph-loop` and include the task, the reviewers or checks to run, and the maximum number of iterations. Each pass should record what changed, what was verified, and whether the next pass is still justified by concrete findings instead of momentum.

Cancel the active loop with `/cancel-ralph`. Cancellation should leave all current artifacts intact, summarize the latest completed iteration, and return control to the user without starting another executor pass.
