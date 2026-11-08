# Security Review — Iteration 8 Agent Identity

Review scope: SDK signing and DID handling, MCP identity provisioning, and
relayer identity verification and replay protection.

## Findings

### Medium — Remote MCP writes can settle without authentication

- **Confidence:** 9/10
- **Affected code:** `relayer-node/src/identity/identity-gate.ts` and
  `relayer-node/src/mcp-gateway.ts`
- **Impact:** With the default `RELAYER_AUTH_MODE=optional`, the identity gate
  accepts requests without an identity. The remote MCP handshake route can
  then reach settlement without the API-key/quota middleware used by the REST
  write routes. An unauthenticated remote caller may therefore trigger
  settlement side effects.
- **Recommended remediation:** Require signed identity for remote MCP writes
  and apply the appropriate authorization/quota checks before settlement.
  Keep the REST compatibility mode separate if unsigned legacy REST clients
  still need a migration window.
- **Status:** Mitigated on the active VPS on 2026-11-08. Remote MCP settlement
  now rejects unsigned requests regardless of the global optional mode, and
  valid signed requests pass through the existing settlement auth/quota gate
  before execution. The relayer source is gitignored, so this deployment fix
  is not included in the public release branch; it must be transferred to the
  private relayer source repository for durable source control and CI coverage.

The deployment was built and the service health check passed after restart.
An independent repository-level relayer test is still required when the
gitignored source is transferred to its maintained repository.
