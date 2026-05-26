# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| `v0.1.x` | Yes |
| `< v0.1.0` | No |

Only the active `v0.1.x` release line receives security fixes. Older internal
v2-era layouts are outside the public support window.

## Reporting A Vulnerability

Please report suspected vulnerabilities through GitHub Security Advisories:

https://github.com/lifeodyssey/opencode-alloy/security/advisories/new

Do not open a public issue for an active vulnerability.

Include as much of the following as you can:

- affected Alloy version or commit
- affected file path or installed output path
- reproduction steps
- expected impact
- whether the issue requires local access, repository write access, or a
  malicious dependency
- any known workaround

## Response Timeline

We aim to provide an initial response within 5 business days.

For confirmed vulnerabilities, we target coordinated disclosure within 90 days.
The exact fix and disclosure schedule may be adjusted if the issue depends on an
upstream vendor package or OpenCode behavior.

## Scope

Security reports are in scope for:

- `bin/alloy.mjs`
- `templates/opencode/*`
- `skills/*`
- `vendor/*`
- generated `.opencode/` content that Alloy directly installs
- generated `.alloy/` state or policy content that Alloy directly installs

Vendored skills are bundled for distribution, but they remain upstream projects.
If you find a vulnerability in vendored content, report it here and also report
it to the upstream project when the upstream project has a security process.

## Out Of Scope

The following are out of scope for this repository:

- vulnerabilities introduced by target repositories that use Alloy
- application code generated or edited by an agent after Alloy is installed
- secrets committed to a target repository by that repository's maintainers
- unsafe local shell aliases, local MCP credentials, or personal machine config
- third-party services that Alloy recommends but does not operate
- denial-of-service claims that require unrealistic local resource exhaustion

## Handling And Credit

We will keep reports confidential until a fix or advisory is ready.

When appropriate, we will credit reporters in the advisory unless they request
otherwise.

## Security Design Notes

Alloy v0.1.x is designed to reduce accidental risk by:

- keeping first-party config inspectable in plain files
- using JSONL ledgers for evidence and claims
- avoiding telemetry
- separating first-party Alloy code from vendored skill content
- planning dangerous-command interception through `cc-safety-net`
- avoiding default cloud-provider MCP credentials in the baseline install
