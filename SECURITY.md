# Security Policy

## Reporting a vulnerability

Please report security issues privately through GitHub's
[security advisory](https://github.com/rogermsc/diligence-kit/security/advisories/new) form rather
than opening a public issue.

## Scope and expectations

This project handles investment datarooms — documents that are confidential by nature. It is
published as a working starting point, not as hardened software. It has a test suite covering the
pipeline, authorization and the agent seam, but it has never been audited or penetration-tested.
Review it before putting real data through it.

Security-relevant design decisions worth knowing:

- **Tenancy.** Every company belongs to a user (`Company.ownerId`), and that is the root of all access
  control: automations, documents, results and reports are reached through it. The company repository
  takes `ownerId` as a required argument so an unscoped query fails to compile. Records addressed by
  their own id — automations and documents — go through `OwnershipService`, which returns 404 rather
  than 403 so ids cannot be probed for existence.
- **Tokens.** Access and refresh tokens are signed with the same secret, so they carry a `typ` claim
  that both verifiers check; neither is accepted in the other's place. `JWT_SECRET` is required and
  startup fails below 32 characters.
- **Sessions.** The dashboard is a BFF. The JWT lives in an httpOnly cookie set server-side at login
  and never enters client-side JavaScript; there is no endpoint that accepts caller-supplied tokens.
- **Secrets.** Nothing sensitive lives in this repository. Production values are pulled at runtime
  from GCP Secret Manager via the External Secrets Operator, and the manifests contain placeholders.

Known unfixed defects are listed under [Known issues](README.md#known-issues) in the README. They are
correctness bugs rather than access-control bugs, but read them before deploying.
