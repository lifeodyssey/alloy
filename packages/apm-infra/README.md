# alloy-infra

Alloy infra package: Terraform/OpenTofu guidance plus dry-run-evidence gate rules for infrastructure work.

## Install

1. Install `alloy-base` first and complete the three steps in the [apm-base README](../apm-base/README.md).
2. Install this package:

   ```bash
   apm install <this-package-source> --target opencode
   ```

3. Activate the infra domain rules:

   ```bash
   mkdir -p .alloy
   cp .apm/files/alloy/rules.json .alloy/rules.json
   ```
