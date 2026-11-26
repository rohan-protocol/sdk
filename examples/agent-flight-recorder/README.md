# Rohan Agent Flight Recorder

**Clone & run in 60 seconds.** A minimal AI-agent wrapper that writes a Rohan audit
bundle to Midnight L1 **before** every expensive tool or API call. If the call later
fails, is disputed, or needs auditing, the bundle proves exactly what was requested
and when.

Built with `@rohan-protocol/sdk@0.8.3`.

---

## What it does

`FlightRecorder` wraps any async function (LLM call, payment, external API, etc.):

1. Canonicalizes the call parameters (`tool`, `args`, `timestamp`, `agentDid`) via RFC 8785 JCS.
2. Computes a `payloadDigest` (SHA-256).
3. `client.submitHandshake({ intent, confidentialPayload })` — one idiomatic SDK call — anchors
   the ZK handshake commitment on Midnight L1 and returns `receipt.auditBundle` ready for
   offline forensic verification.
4. Executes the actual expensive call only after the anchor is confirmed.
   A `try/finally` around the wrapped call ensures `signer.destroy()` runs even on error,
   while the on-chain anchor persists for later dispute resolution.

No wallet, no gas fees — paymaster-subsidized on Midnight Preprod.

---

## Prerequisites

- Node.js ≥ 20
- Internet access (Midnight Preprod relayer)

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Run the demo
npm start
```

### Example output

```
Flight recorder agent DID: did:key:z6Mkf...

[FlightRecorder] llm.generateCompletion — payload digest: sha256:b5363863e979492e9721dc9d386323b0c1d2e74c1720a60b2f1794632e19bcc7
[FlightRecorder] llm.generateCompletion — anchored on L1: 0x00b3f0acac304e152b5027a50d7ed7380fdf5348c5cc129435d089b9c48e88b35d
[FlightRecorder] llm.generateCompletion — audit bundle intentHash: 86b3bfe89cd7f8cd31d63a93092b0cd991667aad1cbe258fa90ae2c4ff802fe4
[FlightRecorder] llm.generateCompletion — executed successfully
API result: {
  completion: 'Synthetic response for: "Summarize Q4 SLA compliance" (model: gpt-5)',
  costUsd: 0.002,
  latencyMs: 500
}
```

---

## Files

| File | Purpose |
|------|---------|
| `index.ts` | `FlightRecorder` class + demo expensive API call |
| `package.json` | `@rohan-protocol/sdk@0.8.3` + `tsx` runner |
| `tsconfig.json` | TypeScript config (ES2022, ESM) |

---

## Using FlightRecorder in your own agent

```typescript
import { FlightRecorder } from './index';

const recorder = new FlightRecorder();
await recorder.init();

const result = await recorder.record(
  'llm.generateCompletion',
  { prompt: 'Analyze SLA compliance', model: 'gpt-5' },
  () => myExpensiveLLMCall({ prompt: 'Analyze SLA compliance', model: 'gpt-5' })
);

await recorder.destroy();
```

Every `record()` call produces an on-chain txHash + offline-verifiable audit bundle,
giving you a tamper-proof flight recorder for autonomous agent behavior.

---

## Security notes

- Call parameters are canonicalized and hashed locally; only the commitment hash is on-chain.
- `did:key` identities are generated per recorder instance and destroyed from RAM after use.
- The audit bundle can be verified offline later with `verifyAuditBundle(bundle, payload)` —
  no relayer call needed for the cryptographic check.

---

## License

Apache-2.0
