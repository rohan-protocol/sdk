# @rohan-protocol/sdk — Enterprise Node.js SDK (v0.8.1)

Zero-Docker TypeScript client library for confidential state transitions, cryptographic commitments, and on-chain state inspection on the Midnight Blockchain.

---

## 📦 Installation

```bash
npm install @rohan-protocol/sdk
```

---

## 🌟 Key Features

* **Zero-Docker Client Stack:** In-memory cryptographic witness synthesis and SHA-256 Intent Commitments without container virtualization.
* **RFC 8785 Canonicalization (`canonicalizeJson`):** Strict, deterministic JSON Canonicalization Scheme.
* **On-Chain State Inspection (`getLedgerState`):** 0 Gas, cached state root and block height queries.
* **Settlement History (`getTransactionHistory`):** 0 Gas, read-only access to the relayer's recent transaction receipts.
* **Sovereign Agent Identity (`did:key`):** Optional Ed25519 signer support for versioned, canonical handshake requests.
* **In-Memory Audit Engine (`verifyCommitment`):** Verifies the canonical SHA-256 digest of a confidential payload; use the inner payload digest, not the timestamp-salted on-chain `intentHash`.
* **Memory Sanitation (`MemorySanitizer`):** Zeroizes sensitive witness buffers after cryptographic operations.

### Runtime Support

The SDK is an Enterprise Node.js SDK. Node.js 22 is the current supported and
CI-tested runtime. Browser use is not supported: SDK modules also depend on
`node:crypto` and `Buffer`, even though the Ed25519 signer uses WebCrypto.
Isomorphic browser support is a separate R&D goal for RFC-006, Midnight Grants
Milestone 1; it is not part of this package's current support contract.

---

## 💻 API Reference & Code Examples

### 1. Initialize Client

```typescript
import { RohanClient } from '@rohan-protocol/sdk';

const client = new RohanClient({
  contractAddress: '585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e',
  relayerUrl: 'https://api.rohanprotocol.network/api/v1/handshake',
  apiKey: 'rohan_live_...' // Optional: Leave empty for free sandbox
});
```

### 2. Inspect Anchored Ledger State (Read / Inspect)

```typescript
const state = await client.getLedgerState();
const history = await client.getTransactionHistory(10);
console.log(state);
console.log(history);
// {
//   success: true,
//   contractAddress: '585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e',
//   currentStateRoot: '1eaf4a0cd4e7dea3a969885c65193240ee5d68039dba0c162765a6c9b82eb6d7',
//   blockHeight: 3192001,
//   lastTxHash: 'da2d26611dc37d6c6914d317762d46a5944ad42c3100129630e9e6fad638000a',
//   cacheAgeMs: 154,
//   cacheTtlMs: 15000,
//   isMinedOnChain: true
// }
```

### 3. Verify a Confidential Commitment (Audit / Verify)

```typescript
const audit = await client.verifyCommitment(
  { deal: 'Acquisition', valuationUsd: 5000000 },
  'sha256:7f465a3d7e5d8ecae5e3b9aaec54b9cb76136be9f2a0df8b2c4cfa0980dfd322'
);

if (audit.valid) {
  console.log('✅ Payload matches its canonical SHA-256 digest!');
}
```

### 4. Execute a Handshake (Write / Settle)

```typescript
const receipt = await client.submitHandshake({
  agentId: 'did:midnight:agent-104',
  intent: 'Procurement Settlement',
  privateData: { vendorIban: 'DE89370400440532013000', amountEur: 12500 }
});
console.log('Settlement TxHash:', receipt.txHash);
console.log('Anchored IntentHash:', receipt.intentHash);
```

### 5. Sign Handshakes with an Agent Identity (Optional)

Configure an `AgentSigner` locally. In signed mode, the handshake `agentId`
must equal the signer's `did:key`; the private key is never sent to the relayer.
The relayer must support signed v1 requests for the signature to be enforced.

```typescript
import {
  generateEd25519KeyPair,
  InMemoryEd25519Signer,
  RohanClient,
} from '@rohan-protocol/sdk';

const keyPair = await generateEd25519KeyPair();
const signer = new InMemoryEd25519Signer(keyPair.publicKey, keyPair.privateKey);
const signedClient = new RohanClient({ signer });

const signedReceipt = await signedClient.submitHandshake({
  agentId: signer.did,
  intent: 'Signed procurement settlement',
});

console.log('Agent DID:', signer.did);
console.log('Settlement TxHash:', signedReceipt.txHash);
signer.destroy();
keyPair.privateKey.fill(0);
```

`InMemoryEd25519Signer.destroy()` wipes its retained raw private-key byte array
and prevents subsequent signing. It is best-effort cleanup, not cryptographic
erasure: a `CryptoKey` already imported by WebCrypto, runtime copies, and copies
held by the caller or garbage collector cannot be reliably wiped by JavaScript.
Drop references to the signer and caller-owned key arrays when finished. Persist
and manage identity keys with an appropriate secure keystore in production.

---

## 📜 License

Apache-2.0
