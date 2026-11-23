# @rohan-protocol/sdk — Enterprise Node.js SDK (v0.8.3)

TypeScript client for handshake commitments, optional Ed25519 request signing, ledger-state reads, and audit-bundle verification.

## Installation

```bash
npm install @rohan-protocol/sdk
```

## Runtime support and package entry points

The root `@rohan-protocol/sdk` entry point is an Enterprise Node.js SDK, currently CI-tested with Node.js 22. Its package manifest has no external runtime dependencies.

The `@rohan-protocol/sdk/identity` subpath exposes identity, envelope, audit-bundle, and canonicalization APIs without statically importing Node built-ins; it can be used in browser environments with WebCrypto. `InMemoryEd25519Signer.fromPrivateKeyHex()` is Node-only. The root SDK client is not a browser-supported entry point.

## Create an identity and sign a handshake

```typescript
import { InMemoryEd25519Signer, RohanClient } from '@rohan-protocol/sdk';

const signer = await InMemoryEd25519Signer.generate();
const client = new RohanClient({ signer });

const receipt = await client.submitHandshake({
  agentId: signer.did,
  intent: 'Procurement authorization',
  confidentialPayload: { vendor: 'Acme', budget: 5000 },
});

console.log(receipt.txHash, receipt.intentHash);
console.log(receipt.auditBundle);
signer.destroy();
```

For a Node.js process that receives a 32-byte Ed25519 seed as 64 hex characters:

```typescript
const signer = await InMemoryEd25519Signer.fromPrivateKeyHex(process.env.AGENT_PRIVATE_KEY!);
```

Do not pass private-key material in prompts, tool arguments, or source control. `destroy()` clears the signer's retained raw byte array and prevents further signing; JavaScript and WebCrypto cannot guarantee erasure of every runtime copy.

## Audit bundles and identity subpath

`RohanAuditBundle` is the portable receipt type returned as `receipt.auditBundle`. `verifyAuditBundle()` validates the bundle schema and verifies any included Ed25519 identity proof, intent binding, and optional plaintext payload digest.

```typescript
import {
  verifyAuditBundle,
  type RohanAuditBundle,
} from '@rohan-protocol/sdk/identity';

const result = await verifyAuditBundle(bundle as RohanAuditBundle, plaintextPayload);
if (!result.valid) throw new Error(result.errors.join('; '));
```

When checking only a payload digest, `computePayloadDigest()` returns an RFC 8785 JCS SHA-256 digest. Use the inner `payloadDigest`, not the timestamp-salted outer `intentHash`.

## What is hashed locally

The client computes `payloadDigest = SHA-256(UTF-8(JCS(confidentialPayload)))`, where JCS is RFC 8785 canonical JSON. It seals that digest into the public action summary. The outer `intentHash` is computed in local memory as SHA-256 over the UTF-8 witness `agentId:sealedActionSummary:{}:timestamp`; the two hashes serve different purposes. `confidentialPayload` is not submitted to the relayer.

The SDK can be configured through `RohanClient` options (`network`, `contractAddress`, `relayerUrl`, `apiKey`, and `signer`). The local MCP additionally reads `ROHAN_RELAYER_URL` (including self-hosted relayers), `ROHAN_NETWORK`, `ROHAN_CONTRACT_ADDRESS`, `ROHAN_AGENT_PRIVATE_KEY`, and `ROHAN_API_KEY`.

Local SDK hashing and signing occur in the caller's process. This differs from the hosted Remote HTTP MCP at `https://api.rohanprotocol.network/mcp`, which runs in a hosted sandbox.

## Other client operations

`RohanClient` also provides `getLedgerState()`, `getTransactionHistory(limit?)`, and `verifyCommitment(payload, expectedDigest)`. The state and history methods make HTTP reads against the configured relayer; `verifyCommitment()` performs local digest verification.

## License

Apache-2.0
