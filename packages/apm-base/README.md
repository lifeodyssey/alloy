# alloy-base

Alloy base package: shared agents, prompts, skills, and the gate plugin. All other alloy packages depend on this one.

## Install (3 steps)

```bash
# 1. Content + upstream method skills
apm install <this-package-source> --target opencode

# 2. Gate plugin (APM installs the files; wire them into OpenCode)
mkdir -p .opencode/plugins
cp .apm/files/opencode-plugin/alloy.ts .opencode/plugins/alloy.ts
cp .apm/files/opencode-plugin/alloy-task-state.mjs .opencode/plugins/alloy-task-state.mjs

# 3. Trellis (original, AGPL-3.0 — installed from upstream, never vendored here)
npx @mindfoldhq/trellis init --opencode
```

State boundary: `.trellis/` belongs to Trellis (spec / journal / workflow-state); `.alloy/tasks/` belongs to alloy (gate checkboxes).
