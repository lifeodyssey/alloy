# Credits & Attribution

Alloy v3 absorbs ideas, prompts, and reference content from multiple upstream projects. This file lists every source we draw from, with license and attribution.

Our own first-party Alloy content is **MIT** unless otherwise noted in the individual file. Vendored third-party content keeps its upstream license.

## First-party Alloy skills (MIT, our authorship)

Skills under `skills/` that we author and own:

- `alloy-using`, `alloy-plan`, `alloy-execute`, `alloy-tdd`, `alloy-debug`, `alloy-verify`, `alloy-discuss`, `alloy-map-codebase`, `alloy-autopilot`, `alloy-qa`
- `frontend-ui-ux`, `playwright-cli`, `git-master`, `humanizer`, `using-sandboxes`

Authors:  contributors of the `alloy` (Alloy) project.

These skills absorb design ideas from the projects listed below; see each SKILL.md's "Attribution" section for specifics.

## Inline content inside first-party Alloy skills

The following first-party `universal/skills/alloy-*` files include upstream text inline so agents can use the source material without lazy-loading separate reference files. Upstream license notices remain preserved here and in each skill's Attribution section.

| Alloy skill | Inline sources | Source repo | License |
|---|---|---|---|
| `alloy-tdd` | `skills/test-driven-development/SKILL.md`, `testing-anti-patterns.md` | obra/superpowers v5.1.0 | MIT |
| `alloy-tdd` | `skills/engineering/tdd/tests.md`, `mocking.md`, `deep-modules.md`, `interface-design.md`, `refactoring.md` | mattpocock/skills | MIT |
| `alloy-tdd` | historical Team TDD body from `git show 60a9207:skills/team-tdd/SKILL.md` | Alloy git history | MIT / first-party Alloy |
| `alloy-brainstorm` | `skills/brainstorming/SKILL.md` | obra/superpowers v5.1.0 | MIT |
| `alloy-debug` | `skills/systematic-debugging/SKILL.md`, `root-cause-tracing.md`, `defense-in-depth.md`, `condition-based-waiting.md`, `condition-based-waiting-example.ts`, `find-polluter.sh` | obra/superpowers v5.1.0 | MIT |
| `alloy-execute` | `skills/subagent-driven-development/SKILL.md`, `implementer-prompt.md`, `spec-reviewer-prompt.md`, `code-quality-reviewer-prompt.md` | obra/superpowers v5.1.0 | MIT |
| `alloy-verify` | `skills/verification-before-completion/SKILL.md` | obra/superpowers v5.1.0 | MIT |
| `alloy-plan` | `skills/writing-plans/SKILL.md` | obra/superpowers v5.1.0 | MIT |

Some inline Superpowers and historical Alloy text references retired entrypoint names in upstream form. In `universal/skills/`, those dependency names are normalized to current Alloy skill names where required by `scripts/audit_prompt_dependencies.py`; the source chain remains documented here.

## Absorbed concepts (we re-authored, kept the ideas)

### obra/superpowers (MIT)

- **Iron Law pattern** (no production code without failing test, no fixes without root cause investigation, no completion claims without fresh evidence) — adopted in `alloy-tdd`, `alloy-debug`, `alloy-verify`
- **HARD-GATE blocks** for required user approval — adopted in `alloy-plan`
- **Red-Green-Refactor cycle structure** + Good/Bad examples — adopted in `alloy-tdd`
- **Multi-component debug instrumentation pattern** — adopted in `alloy-debug`
- **3+ failed-fixes = question architecture** — adopted in `alloy-debug`
- **Bite-sized plan task structure** + no-placeholder rules — adopted in `alloy-plan`
- **4-status executor codes (DONE/CONCERNS/NEEDS_CONTEXT/BLOCKED)** — extended in `alloy-execute`
- **Anti-rationalization tables** — adopted across multiple skills

Repo: https://github.com/obra/superpowers (v5.1.0)

### Matt Pocock — mattpocock/skills (MIT)

- **Vertical slicing TDD anti-pattern** — adopted in `alloy-tdd`
- **Design-first TDD workflow** — adopted in `alloy-tdd`
- **Integration-style test philosophy** (test public behavior, not implementation) — adopted in `alloy-tdd`

Repo: https://github.com/mattpocock/skills

### GSD (rokicool/gsd-opencode, gsd-build/get-shit-done — MIT)

- **Phase model** (spec / plan / execute / verify with artifacts and gates) — adopted as Alloy's 3-phase pipeline
- **User-as-Reporter / Claude-as-Investigator framing** — adopted in `alloy-debug`
- **Gray-area extraction interview** with D-NN decision IDs — adopted in `alloy-discuss`
- **Source coverage audit** + vocabulary blocklist — adopted in `alloy-plan`
- **Wave execution with files_modified intersection check** — adopted in `alloy-execute`
- **Brownfield codebase mapping** (3-artifact pattern) — adopted in `alloy-map-codebase`
- **Bounded iteration with stall detection** — adopted in `alloy-autopilot`
- **Codebase mapper agent prompt structure** — adopted in `alloy-map-codebase`

Repos:
- https://github.com/rokicool/gsd-opencode
- https://github.com/gsd-build/get-shit-done

**Note:** GSD requires its `gsd-sdk` CLI runtime. We absorbed concepts only — none of GSD's command files or agent prompts are vendored, all skills are re-authored to use Alloy's `.alloy/state/*.jsonl` ledger instead.

For Task 7, this concept-only treatment remains intentional for `alloy-discuss`, `alloy-map-codebase`, and the GSD portions of `alloy-plan` / `alloy-autopilot`: the workflows are rewritten into Alloy's portable skill vocabulary rather than copying GSD runtime-dependent files.

### gstack (MIT)

- **`/qa` 11-phase workflow** with health-score rubric — adopted in `alloy-qa`
- **WTF-likelihood self-regulator** for fix loops — adopted in `alloy-qa`
- **Issue taxonomy** (4-tier severity × 7 categories) + per-page checklist — adopted in `alloy-qa`
- **Framework-specific QA hints** (Next.js / Spring / SPA) — adopted in `alloy-qa`

Repo: https://github.com/garrytan/gstack (local fork at `~/.gstack/repos/gstack/`)

**Note:** gstack requires its 60-script `bin/` runtime + `~/.gstack/` state directory. We absorbed `qa` content only — gstack's preamble/telemetry/learnings/brain runtime are all stripped.

For Task 7, `alloy-qa` remains rewritten rather than vendored. It adopts the 11-phase workflow, 8-category health rubric, WTF-likelihood self-regulator, and Phase 8e.5 regression discipline, while replacing gstack runtime calls with `playwright-cli`, `.alloy/qa-reports/`, and Alloy evidence ledger events.

### OMO Slim (alvinunreal/oh-my-opencode-slim — MIT)

- **`filter-available-skills` hook pattern** (per-agent skill visibility via `experimental.chat.messages.transform`) — planned for Alloy plugin
- **`json-error-recovery` hook concept** — planned port to Alloy plugin
- **`delegate-task-retry` hook concept** — planned port
- **`preset-manager` runtime config hot-swap** — design influence on `alloy add/remove`

Repo: https://github.com/alvinunreal/oh-my-opencode-slim

### axledbetter/claude-autopilot (MIT)

- **Phase-per-skill chaining** for unattended execution — adopted in `alloy-autopilot`
- **Risk-tier review depth** (low/med/high) — adopted in `alloy-autopilot`

Repo: https://github.com/axledbetter/claude-autopilot

For Task 7, `alloy-autopilot` stays concept-only because no local upstream skill file was available in this sandbox; the skill remains an Alloy rewrite around phase chaining, risk-tier review depth, and resumable on-disk state.

### Anthropic skills (anthropics/skills — MIT)

- **`webapp-testing/scripts/with_server.py`** server lifecycle helper — vendored to `skills/alloy-qa/scripts/with_server.py` (planned)

Repo: https://github.com/anthropics/skills

## Vendored content (we keep upstream as-is, Renovate tracks)

Files copied verbatim, license preserved, recorded in `vendor.lock.json` with sha256:

### Skills

| Skill | Upstream | License | Renovate target |
|---|---|---|---|
| grill-me | mattpocock/skills | MIT | github-releases |
| grill-with-docs | mattpocock/skills | MIT | github-releases |
| handoff | mattpocock/skills | MIT | github-releases |
| caveman | mattpocock/skills | MIT | github-releases |
| zoom-out | mattpocock/skills | MIT | github-releases |
| to-prd | mattpocock/skills | MIT | github-releases |
| to-issues | mattpocock/skills | MIT | github-releases |
| improve-codebase-architecture | mattpocock/skills | MIT | github-releases |
| plannotator-review | backnotprop/plannotator | MIT | github-releases |
| plannotator-annotate | backnotprop/plannotator | MIT | github-releases |
| planning-with-files | OthmanAdi/planning-with-files | MIT | github-releases |
| refactoring | anthropics/claude-plugins-official | MIT | github-releases |
| qa | gstack (concept; we rewrote as alloy-qa) | MIT | n/a — we own |
| harden | gstack-derived (frontend production-readiness) | MIT | n/a — concept |
| using-git-worktrees | obra/superpowers | MIT | github-releases |
| finishing-a-development-branch | obra/superpowers | MIT | github-releases |
| requesting-code-review | obra/superpowers | MIT | github-releases |
| receiving-code-review | obra/superpowers | MIT | github-releases |
| haacked/create-pr | haacked/dotfiles | undeclared (vendor with attribution) | manual review |
| vercel-react-best-practices | vercel-labs/agent-skills | MIT | github-releases |
| next-best-practices | vercel-labs/agent-skills | MIT | github-releases |
| next-cache-components | vercel-labs/agent-skills | MIT | github-releases |
| kotlin-backend-jpa-entity-mapping | Kotlin/kotlin-agent-skills | Apache-2.0 | github-releases |
| sivalabs/spring-boot | sivaprasadreddy/sivalabs-agent-skills | MIT | github-releases |
| jooq-best-practices | jvm-skills/jvm-skills | Apache-2.0 | github-releases |
| postgres (router) | timescale/pg-aiguide | Apache-2.0 | github-releases |
| terraform-skill | antonbabenko/terraform-skill | Apache-2.0 | github-releases |
| hashicorp/terraform-style-guide | hashicorp | MPL-2.0 | github-releases |
| aws-agent-skills/ecs+lambda+iam+secrets+cloudwatch+rds+s3 | itsmostafa/aws-agent-skills | MIT | github-releases |

ralph-loop — MIT, anthropics/claude-plugins-official, vendored at vendor/skills/external/ralph-loop/

### Skill sub-references (vendored within first-party skills)

| Skill | Reference files | Source | License |
|---|---|---|---|
| alloy-tdd | tests.md, mocking.md, deep-modules.md, interface-design.md, refactoring.md | mattpocock/skills/engineering/tdd/ | MIT |
| alloy-debug | root-cause-tracing.md, defense-in-depth.md, condition-based-waiting.md (+ .ts example), find-polluter.sh | obra/superpowers/skills/systematic-debugging/ | MIT |
| alloy-execute | implementer-prompt.md, spec-reviewer-prompt.md, code-quality-reviewer-prompt.md | obra/superpowers/skills/subagent-driven-development/ | MIT |

### Plugins (referenced via OpenCode/CLI, not vendored)

| Plugin | Use | Source | License |
|---|---|---|---|
| cc-safety-net | dangerous-command guard | kenryu42/claude-code-safety-net | MIT |
| container-use | sandbox runtime | dagger/container-use | Apache-2.0 |
| opencode-working-memory | cross-session memory | sdwolf4103/opencode-working-memory | MIT |

### MCP servers (referenced, not vendored)

| MCP | Use | Source | License |
|---|---|---|---|
| context7 | doc search | upstash/context7 | MIT |
| grep_app | public code search | grep.app | proprietary (free) |
| exa | web search | exa.ai | proprietary (free) |
| chrome-devtools-mcp | browser debug | ChromeDevTools/chrome-devtools-mcp | Apache-2.0 |
| sequential-thinking | step-by-step thinking | modelcontextprotocol/servers | MIT |
| Figma MCP (official) | design import | Figma Inc. | proprietary (free) |
| priyankark/a11y-mcp | a11y axe-core loops | priyankark | MIT |

### CLIs (recommended in README, not vendored)

`gh`, `az devops`, `psql`, `aws`, `aws-vault`, `saml2aws`, `terraform`, `terragrunt`, `tflint`, `tfsec`, `checkov`, `colima`, `npx skills` (vercel-labs/skills) — each follows its own upstream license.

## License Summary

Alloy v3 itself: **MIT**.

Vendored content retains upstream licenses. No copyleft (no GPL/AGPL) content is vendored or required. All vendored content is permissive (MIT / Apache-2.0 / MPL-2.0) and commercially usable.

Where upstream content is incorporated into first-party Alloy skills (absorbed concepts rather than verbatim copies), the Attribution section of each SKILL.md identifies the source.

If you believe content has been misattributed or used outside its license terms, please open an issue at [alloy issues](https://github.com/lifeodyssey/alloy/issues).

## v0.1.2 Additions

### Matt Pocock handoff skill (MIT)

- **`handoff` productivity skill** — vendored verbatim to `vendor/skills/external/mattpocock/main/handoff/`

Repo: https://github.com/mattpocock/skills
Upstream path: `skills/productivity/handoff`

### OpenCode Dynamic Context Pruning (AGPL-3.0-or-later)

- **`@tarquinen/opencode-dcp` optional OpenCode plugin** — referenced by the opt-in `dcp` pack, not vendored
- **Dynamic context pruning** for token reduction, with the cache trade-off documented in `packs/dcp.json`

Package: https://www.npmjs.com/package/@tarquinen/opencode-dcp

### CodeGraph + RTK core infrastructure (TBD - vendoring strategy)

- **CodeGraph** — intended AST/code graph infrastructure, but `codegraph` and `@anthropic-ai/codegraph` did not resolve as npm plugin packages during this pass
- **RTK / Rust Token Killer** — intended CLI output/token compression infrastructure, but `rtk` did not resolve as an npm plugin package during this pass

Strategy: keep `core-infrastructure` as an empty plugin atom until the install source is confirmed, then add the exact package/source with its license and lock metadata.
