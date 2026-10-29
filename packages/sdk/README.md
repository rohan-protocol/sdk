# @rohan-protocol/sdk (v0.7.0)

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
* **In-Memory Audit Engine (`verifyCommitment`):** Instant verification of confidential payloads against intent commitments.
* **Memory Sanitation (`MemorySanitizer`):** Zeroizes sensitive witness buffers after cryptographic operations.

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
console.log(state);
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
  console.log('✅ Agreement verified byte-for-byte against on-chain commitment!');
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

---

## 📜 License

Apache-2.0
