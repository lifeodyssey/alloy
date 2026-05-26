# Ralph Loop Help

Ralph Loop coordinates repeated work when a task needs a bounded executor, reviewer, tester, or verifier cycle.

Start a loop with `/ralph-loop` and provide:

- the task or card being executed
- the maximum number of iterations
- the checks or reviewers required before another pass
- the condition that stops the loop

Cancel the loop with `/cancel-ralph`. A cancelled loop should preserve artifacts and report the last completed state.
