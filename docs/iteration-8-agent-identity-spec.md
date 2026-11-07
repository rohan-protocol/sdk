# Iteration 8: Sovereign Agent Identity

**Status:** Draft for Midnight developer review
**Scope:** SDK, MCP server, and private relayer
**Security vector:** V-08 — agent authentication and request integrity
**Initial key type:** Ed25519 with W3C `did:key`
**Compatibility:** staged migration; legacy unsigned requests remain configurable

## 1. Summary

Iteration 8 adds proof of control of an Ed25519 key to handshake requests. The SDK derives a W3C-compatible `did:key` from the public key and signs a versioned, canonical request envelope. Before reserving settlement capacity or submitting a state transition, the relayer resolves the public key from the DID and verifies the signature.

The signature authenticates the request as having been signed by the key named by the DID and detects changes to signed fields. It does not by itself establish a real-world identity, prevent replay, protect an unencrypted network connection, authenticate the relayer's response, or keep tool arguments secret from the MCP host/model provider.

## 2. Current implementation context

- `RohanClient.generateHandshakeProof()` currently hashes a concatenated string containing `agentId`, `intent`, `privateData`, and `timestamp`; it does not produce an Ed25519 signature.
- The MCP server seals `confidentialPayload` into an intent digest before calling the SDK. It currently has no signer configuration.
- The relayer validates an `agentId`, action, and payload with the Semantic Firewall and then submits a state transition. It currently does not authenticate the caller's claimed agent identity.
- The relayer already has SQLite state and a serialized settlement queue, which can support durable replay/idempotency handling.

Identity and signature validation must be added to the existing public-input envelope and must happen before chain settlement. Do not treat the current Semantic Firewall as a cryptographic identity verifier.

## 3. Goals and non-goals

### Goals

1. Provide deterministic Ed25519 `did:key` creation and strict DID parsing.
2. Sign a versioned request envelope that binds the intent to its DID and execution context.
3. Verify the DID/signature before any write-side quota reservation that should only apply to authenticated requests, gas spending, or state mutation.
4. Support staged rollout and explicit legacy compatibility.
5. Keep private-key material local to the agent signer and out of MCP schemas, logs, network requests, and relayer storage.

### Non-goals

- Proving that a DID belongs to a named person, company, or approved agent registry.
- Replacing TLS, API-key authorization, rate limiting, or MCP host security.
- Hiding prompts, arguments, or plaintext from the MCP client host or model provider.
- Changing the Compact contract or storing the signature on-chain in this iteration.
- Claiming cryptographic erasure of JavaScript runtime copies of private-key bytes.

## 4. DID method

Use the W3C `did:key` method with the Ed25519 public-key multicodec:

1. Public key: exactly 32 raw Ed25519 bytes.
2. Multicodec prefix: `0xed 0x01` (`ed25519-pub`, unsigned-varint encoding).
3. Multibase encoding: base58btc, prefixed with `z`.
4. DID form: `did:key:z<base58btc(multicodec-prefix || public-key)>`.

The parser must reject unsupported methods/codecs, malformed base58btc, non-canonical encodings, and decoded values that are not exactly 34 bytes including the codec prefix. Re-encode decoded bytes and compare with the original identifier to enforce canonical form.

`did:key` is self-certifying: possession of the matching private key proves control of that key. It does not provide key rotation, revocation, or a link to a civil identity. A changed key creates a different DID. If rotation/revocation or organizational identity is required, define a separate DID method or trusted registry rather than implying those properties here.

## 5. Signed request protocol

### 5.1 Request shape

Add a versioned identity block to `HandshakeCommitmentPayload`:

```ts
interface RequestIdentityV1 {
  did: string;
  algorithm: 'Ed25519';
  signature: string; // 64-byte signature encoded as unpadded base64url
  nonce: string;     // 32 random bytes encoded as unpadded base64url
}
```

Attach it as `identity` to the request body. `publicInputs.agentId` must equal `identity.did` for signed v1 requests. Do not send the private key or an exported private JWK to the MCP server or relayer.

### 5.2 Canonical signing envelope

Do not sign an ambiguous JavaScript string or only the UTF-8 characters of a hex hash. Build a fixed-shape JSON object and serialize it with the repository's RFC 8785-compatible canonicalizer:

```ts
interface SignedHandshakeV1 {
  domain: 'rohan-handshake';
  version: 1;
  did: string;
  network: 'preprod' | 'testnet' | 'mainnet';
  contractAddress: string;
  circuitName: string;
  timestamp: number;
  intentHash: string; // exactly 64 lowercase hex characters
  nonce: string;      // same value as identity.nonce
}
```

Sign the UTF-8 bytes of `canonicalizeJson(envelope)` with Ed25519. The signature is over the complete canonical envelope, not over the serialized identity block. Verification reconstructs the same envelope from validated request fields; it must not trust a caller-supplied signing message.

The `domain` and `version` prevent cross-protocol and cross-version signature reuse. Network, contract, circuit, timestamp, DID, intent hash, and nonce bind the authorization to its intended context.

`intentHash` remains a 32-byte SHA-256 commitment represented as lowercase hex. The existing intent-hash derivation should be captured in compatibility tests before any change. Do not silently change its derivation as part of signature implementation; if canonical intent hashing is desired, make that a separately versioned protocol change.

### 5.3 Encoding and validation

- `timestamp`: safe integer milliseconds since Unix epoch.
- `intentHash`: `/^[0-9a-f]{64}$/`.
- `nonce`: canonical unpadded base64url encoding of exactly 32 bytes.
- `signature`: canonical unpadded base64url encoding of exactly 64 bytes.
- `did`: canonical supported Ed25519 `did:key`.
- Reject unknown `identity` versions/algorithms; do not silently downgrade.
- Use constant-time signature verification provided by the cryptographic implementation; do not compare signature strings as a substitute for verification.

## 6. SDK API proposal

Add `packages/sdk/src/identity/did.ts` with focused, separately testable operations:

```ts
export interface Ed25519KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export function createDidKey(publicKey: Uint8Array): string;
export function publicKeyFromDidKey(did: string): Uint8Array;
export async function generateEd25519KeyPair(): Promise<Ed25519KeyPair>;
export async function signHandshakeV1(
  envelope: SignedHandshakeV1,
  privateKey: Uint8Array
): Promise<Uint8Array>;
export async function verifyHandshakeV1(
  envelope: SignedHandshakeV1,
  signature: Uint8Array,
  publicKey: Uint8Array
): Promise<boolean>;
```

Names and synchronous/asynchronous behavior are subject to dependency selection. Prefer WebCrypto where its Ed25519 implementation is supported and consistent with the package runtime matrix. If using `@noble/ed25519`, pin a reviewed version, follow that version's API, and test browser and Node builds. Do not add a silent crypto fallback with different signature semantics.

Key generation should return raw key bytes only if that is required by the caller. Also consider a signer interface backed by a secure keystore/HSM so application code need not export private bytes:

```ts
interface AgentSigner {
  readonly did: string;
  sign(message: Uint8Array): Promise<Uint8Array>;
}
```

Extend `RohanConfig` with an optional signer (or an explicitly named identity option). `generateHandshakeProof()` must fail clearly if signed mode is required but no signer is configured. Never log signing input, signature material together with confidential plaintext, or private-key bytes.

## 7. MCP integration

- The MCP tool must not accept private keys as tool arguments.
- Configure identity through the local MCP process or an injected signer/keystore.
- When a signer is configured, the MCP server supplies its DID to the SDK and the SDK signs the generated request.
- `agentId` in the tool schema should be documented consistently: either it is the caller's DID and must match the configured signer, or it is removed from signed mode and derived from the signer. Do not allow the caller to choose an unrelated DID while the server signs with another key.
- Return the signed request's DID in the receipt/metadata if useful, but never return the signature unless there is a specific interoperability need.

## 8. Relayer verification and execution order

The relayer must verify signed requests before any settlement side effect:

1. Parse and size-limit the request body.
2. Validate protocol version, required fields, DID encoding, key length, signature/nonce encoding, and timestamp range.
3. Reconstruct the v1 envelope from validated request fields.
4. Derive the Ed25519 public key from `identity.did`.
5. Verify the signature.
6. Confirm `publicInputs.agentId === identity.did`, and validate network, contract, circuit, and intent-hash consistency.
7. Apply the semantic policy/firewall to authenticated request data.
8. Atomically claim the nonce/idempotency key.
9. Reserve quota/credits and enqueue settlement.
10. Submit the state transition; record final status and receipt.

The exact ordering of authentication and quota reservation must be aligned with the existing `rohanAuthGate`; invalid signatures must not consume paid credits. Read-only calls remain outside this signed write protocol unless separately required.

Never fall back from an invalid signature to unsigned handling. Never treat a syntactically valid DID as proof that its signature is valid.

## 9. Replay and idempotency

A timestamp window alone does not prevent replay. Require both:

- A short configurable timestamp tolerance, initially proposed as ±5 minutes, with clock-skew monitoring.
- A cryptographically random 32-byte nonce, unique per signed request.

Persist `(did, nonce)` with a unique database constraint before settlement. A duplicate request must not execute a second state transition. Define whether retries return the existing pending/confirmed receipt or a stable replay error; idempotently returning the original receipt is preferred for client retries. Store enough status to recover after process restart and define expiry/retention cleanup. A bounded in-memory cache alone is insufficient for a relayer restart.

## 10. Legacy compatibility and rollout

Use an explicit relayer mode, for example:

- `optional` (migration): verify v1 signatures when present; accept legacy unsigned requests and emit metrics/warnings.
- `required`: reject unsigned requests for write endpoints.

Recommended deployment:

1. Implement SDK DID primitives and test vectors.
2. Add request signing behind explicit client configuration; do not change default identity semantics silently.
3. Deploy relayer verification in `optional` mode and observe signed/unsigned request metrics without logging payloads or signatures.
4. Enable signing in first-party MCP clients and verify all write paths, including unary and streaming endpoints.
5. Switch to `required` only after external client migration is communicated and a rollback window is agreed.
6. Keep read endpoints and API-key billing semantics unchanged unless explicitly included in the migration plan.

Define behavior for direct SDK callers, stdio MCP, remote MCP handshake calls, the Google ADK gateway, and any streaming proof endpoint. Identity checks must be consistent across all write entry points.

## 11. Test plan and acceptance criteria

### DID tests

- Generate a key pair and create a DID matching an independently checked Ed25519 `did:key` test vector.
- Decode a known DID to the expected 32-byte public key.
- Reject malformed base58btc, wrong multicodec, wrong key length, non-canonical encodings, and unsupported DID methods.

### Signature tests

- A valid signature verifies for the exact envelope.
- Changing each signed field independently (DID, network, contract, circuit, timestamp, intent hash, nonce, version/domain) causes verification failure.
- Wrong key, malformed signature, malformed hash, and unsupported versions are rejected.
- Canonicalization produces identical bytes for equivalent object key orders.
- Cross-runtime test vectors are stable for Node and supported browser runtimes.

### Relayer and integration tests

- Missing signature behavior matches configured mode.
- Invalid signature, DID mismatch, stale timestamp, or replay is rejected before queueing or chain calls.
- Duplicate nonce cannot cause two settlements, including concurrent requests and relayer restart.
- Valid requests pass unary and streaming routes and preserve existing response shapes where possible.
- Existing unsigned clients continue to work in `optional` mode.
- Invalid signatures do not reserve or burn paid credits.
- Logs and error responses do not disclose private keys or confidential payloads.

**Acceptance gate:** no mainnet/production switch to `required` mode until all write paths have integration coverage, replay protection is durable, and legacy-client migration is complete.

## 12. Open decisions for review

1. Confirm Ed25519 support in the supported Node/browser matrix; choose WebCrypto or a pinned `@noble/ed25519` version.
2. Choose signer API: exported raw key pair, callback signer, or both.
3. Confirm whether `agentId` becomes the `did:key` or remains a separate application identifier signed alongside the DID.
4. Agree on timestamp tolerance, nonce persistence/retention, retry semantics, and database migration.
5. Decide how public API-key quota authorization interacts with self-certifying identity and whether identity-to-account binding is required.
6. Confirm whether responses need a separate relayer signature to address response spoofing; request signatures alone do not authenticate responses.
7. Confirm whether DIDs/signatures are request-only for this iteration or must later be verified on-chain.
