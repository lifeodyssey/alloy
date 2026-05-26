# TDD Policy

Code tasks use TDD by default.

- RED evidence records the failing test or the explicit reason a failing test is not practical.
- GREEN evidence records the passing test or implementation verification.
- Refactor is optional, but verification after refactor is required when behavior changed.
- Use `tdd_skip` evidence only for docs, pure config, generated files, or another explicit reason.
