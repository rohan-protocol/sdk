# Rohan A2A Escrow Handshake

**Clone & run in 60 seconds.** A minimal, end-to-end example of two autonomous agents
(Buyer and Seller) using `@rohan-protocol/sdk@0.8.3` to sign, anchor, and verify a
confidential purchase order on Midnight Blockchain Preprod.

---

## What it does

1. **Buyer** creates a purchase order (`confidentialPayload`), anchors a ZK handshake
   commitment on Midnight L1 via `submitHandshake()`, and exports a portable
   `RohanAuditBundle` + plaintext payload.
2. **Seller** receives the bundle + payload (via any side channel: file, email, chat),
   verifies the cryptographic binding **offline** with `verifyAuditBundle()`, and
   cross-checks the on-chain anchor via `getTransactionHistory()`.

No wallet, no `$NIGHT`, no `$tDUST` gas — 100% paymaster-subsidized.

---

## Prerequisites

- Node.js ≥ 20
- Internet access (Midnight Preprod relayer)

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Run the buyer (anchors the deal on L1)
npm run buyer

# 3. Copy the printed Bundle JSON and Payload JSON

# 4. Run the seller (offline + on-chain verification)
npm run seller -- bundle.json payload.json
```

### Example output

**Buyer:**
```
═══ ROHAN A2A ESCROW — BUYER ═══
Buyer DID : did:key:z6Mkf...
Seller DID: did:key:z6Mkf...

▶ Submitting handshake to Midnight L1 ...
✅ Handshake confirmed
   txHash     : 0x00b3f0acac304e152b5027a50d7ed7380fdf5348c5cc129435d089b9c48e88b35d
   intentHash : 86b3bfe89cd7f8cd31d63a93092b0cd991667aad1cbe258fa90ae2c4ff802fe4
   blockHeight: 3575175
...
```

**Seller:**
```
═══ ROHAN A2A ESCROW — SELLER ═══

▶ Running offline bundle verification ...
   valid             : true
   schemaValid       : true
   payloadMatch      : true
   intentBindingValid: true
   signatureValid    : true
   computedDigest    : sha256:99f3c24ec27f7766b0e75c33f9d04e2e786cd39a9fd90fb4d7000b19af86cb84

✅ Offline verification passed — payload cryptographically matches bundle.

▶ Checking on-chain anchor via relayer ...
✅ On-chain anchor confirmed
   txHash     : 0x00b3f0acac304e152b5027a50d7ed7380fdf5348c5cc129435d089b9c48e88b35d
   blockHeight: 3575175
   status     : confirmed
...
```

---

## Files

| File | Purpose |
|------|---------|
| `buyer.ts` | Creates deal, submits handshake, builds audit bundle |
| `seller.ts` | Offline bundle verification + on-chain anchor check |
| `package.json` | `@rohan-protocol/sdk@0.8.3` + `tsx` runner |
| `tsconfig.json` | TypeScript config (ES2022, ESM) |

---

## How it works (under the hood)

1. `InMemoryEd25519Signer.generate()` creates a local Ed25519 `did:key` identity.
2. `client.submitHandshake({ intent, confidentialPayload })` — one idiomatic SDK call —
   canonicalizes the `confidentialPayload` via RFC 8785 JCS, hashes it to a
   `payloadDigest`, signs the V-08 envelope, anchors only the `intentHash` on-chain,
   and returns `receipt.auditBundle` ready for offline verification. No manual
   `generateHandshakeProof()` or `buildAuditBundle()` chaining required.
3. `verifyAuditBundle(bundle, payload)` locally re-computes the SHA-256 digest over the
   plaintext payload and compares it against `bundle.payloadDigest` — no network call.
4. `client.getTransactionHistory()` confirms the transaction exists on Midnight Preprod.

---

## Security notes

- `confidentialPayload` never leaves the buyer's RAM in plaintext — only the digest is on-chain.
- The seller receives the plaintext payload over a side channel you control; the SDK does not transport it.
- Agent identities are destroyed from RAM after use (`signer.destroy()`).
- `did:key` proves cryptographic control only — it is not a real-world KYC identity.

---

## License

Apache-2.0
