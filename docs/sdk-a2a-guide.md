
# SDK A2A Guide (v0.8.3)

When Agent A (Company A) authorizes a purchase, API trigger, or SLA with Agent B (Company B), disputes happen: *"Our agent never authorized that price or payload."*

With `@rohan-protocol/sdk`, Agent A signs a canonical request envelope (`Ed25519` / `did:key`), anchors a commitment on Midnight L1, and hands Agent B a self-contained proof to verify offline.

---

## Installation

```bash
npm install @rohan-protocol/sdk
```

### Step 1: Agent A Signs & Anchors the Action

```typescript
import {
  RohanClient,
  InMemoryEd25519Signer,
  generateEd25519KeyPair,
} from '@rohan-protocol/sdk';

// Option 1 (v0.8.0+): Standard keypair generation
const keyPair = await generateEd25519KeyPair();
const signer = new InMemoryEd25519Signer(keyPair.publicKey, keyPair.privateKey);

// Option 2 (v0.8.3): One-liner helper (or fromPrivateKeyHex in Node.js)
// const signer = await InMemoryEd25519Signer.generate();

const client = new RohanClient({
  contractAddress: '585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e',
  relayerUrl: 'https://api.rohanprotocol.network',
  signer,
  // Optional for enterprise quota tier: apiKey: process.env.ROHAN_API_KEY
});

const dealPayload = {
  vendor: 'Acme Compute Corp',
  maxBudgetUsd: 5000,
  sku: 'H200-CLUSTER-24H',
  orderId: 'PO-2026-8841',
};

// Plaintext dealPayload stays in local RAM; only commitment hashes leave the machine
const receipt = await client.submitHandshake({
  agentId: signer.did,
  actionSummary: 'Compute Cluster Procurement Authorization',
  confidentialPayload: dealPayload,
});

console.log('Agent DID:     ', signer.did);
console.log('L1 TxHash:     ', receipt.txHash);
console.log('IntentHash:    ', receipt.intentHash);
console.log('PayloadDigest: ', receipt.payloadDigest);
```

The SDK computes `payloadDigest = SHA-256(UTF-8(JCS(confidentialPayload)))` locally, with RFC 8785 JCS. The sealed action summary incorporates this inner digest. The outer `intentHash` is locally computed as SHA-256 of the UTF-8 witness `agentId:sealedActionSummary:{}:timestamp`, not the same digest. The plaintext payload stays in the client process.

Local SDK/MCP mode computes and signs in local process memory. The hosted Remote HTTP MCP endpoint at `https://api.rohanprotocol.network/mcp` runs in a sandbox and has a separate trust boundary.

> **Enterprise KMS / HSM support:** Never force raw keys into production code. Implement `AgentSigner` (`{ readonly did: string; sign(message: Uint8Array): Promise<Uint8Array> }`) backed by AWS KMS, GCP KMS, or HashiCorp Vault.

### Step 2: Agent A Sends the RohanAuditBundle to Agent B

Agent A transmits the auditBundle (and the confidential dealPayload over your private B2A API/TLS channel) to Agent B:

```json
{
  "schema": "rohan-audit-bundle/v1",
  "agentDid": "did:key:z6MkkCFLgmYzygPSFZ1pWru5nsYE6M32Hr88ENNU4SMAQSWd",
  "network": "preprod",
  "contractAddress": "585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e",
  "txHash": "0x0065a0ba4dd1f53b7b122ce1cc586849b2b0ecb4cc7fadcf4a7478a2a3b2b0899a",
  "blockHeight": 3432019,
  "intentHash": "95912977d0f26be105c0cb74ca1141454552c3d543fb098d56c327253a794164",
  "payloadDigest": "sha256:8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4",
  "timestamp": 1794750008224,
  "identityProof": {
    "did": "did:key:z6MkkCFLgmYzygPSFZ1pWru5nsYE6M32Hr88ENNU4SMAQSWd",
    "algorithm": "Ed25519",
    "signature": "<unpadded_base64url_64_bytes>",
    "nonce": "<unpadded_base64url_32_bytes>"
  }
}
```

### Step 3: Agent B Verifies Offline (`verifyAuditBundle` / `verifyCommitment`)

Agent B checks both payload integrity and Ed25519 non-repudiation in local RAM (0 gas, 0 trust in Agent A), plus optional on-chain settlement confirmation:

```typescript
import {
  verifyAuditBundle,
  canonicalizeJson,
  RohanClient,
} from '@rohan-protocol/sdk';
import crypto from 'node:crypto';

// A) Full Audit Bundle verification (checks RFC 8785 payloadDigest + Ed25519 signature)
const audit = await verifyAuditBundle(auditBundle, dealPayload);
if (!audit.valid) {
  throw new Error(`Dispute check failed: ${audit.reason}`);
}

// B) Manual digest verification (available since v0.8.0 via verifyCommitment / canonicalizeJson)
const expectedHex = auditBundle.payloadDigest.replace(/^sha256:/, '');
const computedHex = crypto.createHash('sha256').update(canonicalizeJson(dealPayload)).digest('hex');
if (computedHex !== expectedHex) {
  throw new Error('Payload was tampered with!');
}

// C) Optional read-only check on Midnight Preprod L1 (0 gas)
const reader = new RohanClient({
  contractAddress: auditBundle.contractAddress,
  relayerUrl: 'https://api.rohanprotocol.network',
});
const history = await reader.getTransactionHistory(20);
const isMined = history.transactions.some((tx) => tx.txHash === auditBundle.txHash);
console.log('Verified & Mined on Midnight L1:', isMined);
```

Or directly in the terminal:

```bash
npx -y --package @rohan-protocol/mcp@0.8.3 rohan-shield verify deal.json audit-bundle.json
```

---