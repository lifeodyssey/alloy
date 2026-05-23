# OpenCode Alloy GSD Policy

This repo uses GSD as a project-local workflow state machine only when the `workflow-gsd` profile is installed.

- `.planning` is the only workflow state source.
- GSD artifacts are evidence only after the relevant command has actually run.
- Alloy profiles decide which skills, agents, MCPs, and model roles are visible to the repo.
- OMO Slim is not part of the default runtime.
