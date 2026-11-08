# Iteration 8 — Tasklist & Master Execution Roadmap

**Specification:** [Sovereign Agent Identity](./iteration-8-agent-identity-spec.md)
**Status:** SDK Phases 1–2 and relayer verification are implemented; an authorized Preprod smoke rollout ran on 2026-11-07. Independent security review and full acceptance remain pending
**Scope:** SDK, MCP, private relayer, replay protection, staged rollout

> This roadmap follows the developer-provided Phases 1–5. Paths are adjusted to
> this repository's current layout (`packages/sdk/tests/identity.test.js` and
> `tests/*.test.js`). The tasks describe intended work; a checked item only
> means the corresponding local code or test exists, not that it has passed
> review or shipped.

## Phase 1 — Cryptographic Primitives & DID Engine

- [x] **Task 1.1:** Add an in-tree Base58btc codec with canonical re-encoding validation.
- [x] **Task 1.2:** Add the RFC 8410 PKCS#8 DER prefix wrapper for WebCrypto Ed25519 private-key import.
- [x] **Task 1.3:** Add `createDidKey()` and `publicKeyFromDidKey()` with strict 34-byte payload and `0xed01` multicodec validation.
- [x] **Task 1.4:** Add the `AgentSigner` interface and `InMemoryEd25519Signer` reference implementation.
- [ ] **Task 1.5:** Verify the public-key/DID pair against an independent W3C CCG / multicodec test vector and retain tampered-message tests. The DID string supplied in the developer proposal does not match the listed public key; the local fixture is computed from the listed key and still requires independent confirmation.
- [x] **Task 1.6:** Export the DID module from `packages/sdk/src/index.ts`.
- [ ] **Task 1.7:** Review memory-lifetime guarantees. `destroy()` wipes the retained raw private-key bytes and blocks future signing, but JavaScript/WebCrypto cannot guarantee erasure of imported `CryptoKey` material or runtime copies.
- [ ] **Task 1.8:** Confirm Ed25519 WebCrypto support in all supported Node and browser runtimes.
- [ ] **Task 1.9:** Run SDK build and full tests in CI; review the new implementation before marking Phase 1 ready to merge.

**Local validation:** SDK build succeeds and the full SDK test suite passes locally (15/15). CI and developer/security review are still required before marking this phase “ready to commit”.

## Phase 2 — Signed Request Envelope (RFC 8785)

- [x] **Task 2.1:** Implement `SignedHandshakeV1` in `packages/sdk/src/identity/envelope.ts`.
- [x] **Task 2.2:** Define and validate the exact envelope: `{ domain, version, did, network, contractAddress, circuitName, timestamp, intentHash, nonce }`.
- [x] **Task 2.3:** Canonicalize the envelope with the repository's RFC 8785-compatible JCS implementation, then sign its UTF-8 bytes.
- [x] **Task 2.4:** Extend `RohanClient` to accept an `AgentSigner` through configuration; do not accept private keys from tool arguments.
- [x] **Task 2.5:** Ensure `publicInputs.agentId === identity.did` whenever a signed identity block is emitted.
- [x] **Task 2.6:** Generate a cryptographically random 32-byte nonce per request and use strict unpadded base64url encoding.
- [x] **Task 2.7:** Preserve the existing intent-hash derivation while adding signing.
- [x] **Task 2.8:** Test field tampering, signer mismatch, malformed signature encodings, unsupported protocol versions, and envelope validation.

**Validation at Phase 2:** SDK build succeeded and all 23 SDK tests passed locally; MCP build and the 9 tests present at that point passed. This does not replace independent crypto review or relayer integration tests.

## Phase 3 — Relayer Verification Middleware (V-08)

- [x] **Task 3.1:** Add the configurable identity-verification middleware factory in `relayer-node/src/identity/identity-gate.ts`.
- [x] **Task 3.2:** Reconstruct the canonical `SignedHandshakeV1` envelope from validated request fields; never trust a caller-supplied signing message.
- [x] **Task 3.3:** Resolve the Ed25519 public key from `identity.did` and verify the 64-byte signature with Node's Ed25519 crypto implementation.
- [x] **Task 3.4:** Ensure invalid signatures abort with an authentication error before settlement queueing, gas spending, or paid-credit deduction. Identity verification precedes `rohanAuthGate` on both REST write routes.
- [x] **Task 3.5:** Support an explicit `RELAYER_AUTH_MODE=optional|required` setting:
  - `optional`: accept legacy unsigned requests, but verify every signed request and reject invalid signatures without downgrade.
  - `required`: reject requests without valid signatures.
- [x] **Task 3.6:** Apply identical signed-request checks to unary, streaming, and remote MCP write routes.
- [x] **Task 3.7:** Add privacy-safe in-memory counters for accepted signed/unsigned and rejected requests; do not log signatures or confidential payloads.

**Validation and rollout:** The relayer identity tests and TypeScript typecheck pass. The Preprod service was restarted and returned healthy after 10 seconds. Live forged-signature and stale-timestamp requests both returned HTTP 401 before settlement. One SDK-signed unary request was mined and confirmed at block 3,324,264 (`0x00ed130c4574cf3e089bdcadd58dad366e7699ff8cb07234979ab06a0adf49d199`); replaying the exact request returned HTTP 409. This is a Preprod smoke rollout, not an independent security review or a required-mode/full rollout.

## Phase 4 — Durable Replay Protection & Storage

- [x] **Task 4.1:** Add SQLite storage for durable nonce claims:

  ```sql
  CREATE TABLE IF NOT EXISTS used_nonces (
    did TEXT NOT NULL,
    nonce TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    PRIMARY KEY (did, nonce)
  );
  CREATE INDEX IF NOT EXISTS idx_nonces_timestamp ON used_nonces(timestamp);
  ```

- [x] **Task 4.2:** Enforce a ±300,000 ms timestamp tolerance.
- [x] **Task 4.3:** Atomically claim `(did, nonce)` before auth/quota reservation and settlement; duplicates receive HTTP 409 (or an MCP tool error).
- [x] **Task 4.4:** Prune nonce rows older than 600,000 ms, after they can no longer be valid under the timestamp policy.
- [ ] **Task 4.5:** Test concurrent duplicate requests and relayer restart behavior. In-memory-only replay tracking is insufficient.

## Phase 5 — MCP Integration & E2E Acceptance Gate

- [x] **Task 5.1:** Add MCP support for a securely configured signer with environment-seed, validated persistent-keystore, and create-only first-run provisioning paths. The persistent seed is plaintext at rest and requires owner-only filesystem permissions and operator backup/rotation procedures.
- [x] **Task 5.2:** Ensure MCP tool schemas never accept private keys as LLM-supplied arguments; reject unknown tool properties and require a non-empty `actionSummary`.
- [x] **Task 5.6:** Document local identity resolution, key backup/deletion/rotation implications, and the fact that the relayer must enforce signatures for server-side authentication.

**Local identity-onboarding validation:** MCP build and tests cover env precedence/fail-closed behavior, persistent reload, exclusive concurrent provisioning, permission restrictions, corrupt/mismatched keystores, symlink rejection, optional `agentId` with signer-DID binding, and mandatory action summaries. Provisioning persists an unencrypted seed in the user's home directory; do not use this default keystore on shared or untrusted hosts without additional secret protection.
- [ ] **Task 5.3:** Test signed requests through both unary (`/api/v1/handshake`) and streaming (`/api/v1/handshake/stream`) endpoints. Unary was exercised in the Preprod smoke rollout; valid signed streaming E2E remains open.
- [x] **Task 5.4:** Run an explicitly approved Midnight Preprod E2E settlement and confirm the mined L1 receipt. Confirm the target network and transaction cost before submitting. Smoke receipt: block 3,324,264; tx `0x00ed130c4574cf3e089bdcadd58dad366e7699ff8cb07234979ab06a0adf49d199`.
- [ ] **Task 5.5:** Test legacy unsigned clients in `optional` mode and confirm invalid signed requests never downgrade to unsigned.
- [ ] **Task 5.7:** Document client migration, nonce policy, monitoring, rollback, and the switch to `required`.

## Acceptance gate

- DID creation and parsing pass independently verified vectors and reject malformed or unsupported identifiers.
- Every v1 signature covers the complete canonical, domain-separated envelope and fails if any bound field changes.
- Invalid signatures, DID mismatches, stale timestamps, and duplicate nonces are rejected before quota reservation and settlement.
- Duplicate requests cannot cause duplicate state mutations, including across concurrency and relayer restarts.
- All write entry points apply the same identity policy.
- Legacy clients work only when explicitly permitted by migration mode; an invalid signature never falls back to unsigned processing.
- No production/required-mode rollout until integration coverage, client migration, monitoring, and rollback approval are complete.

## Decisions requiring developer/security review

- Select WebCrypto or a pinned `@noble/ed25519` dependency after runtime compatibility testing.
- Decide between an in-memory raw-key signer and a keystore/HSM-backed signer interface.
- Define whether `agentId` is the `did:key` or a separate application identity bound in the signature.
- Approve timestamp tolerance, nonce retention, and retry/idempotency semantics.
- Decide whether identity must bind to API-key accounts or an agent registry.
- Decide whether relayer responses need separate signatures.
- Confirm whether on-chain signature verification is outside Iteration 8.
