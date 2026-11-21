### Architecture & Security Model (No-BS Technical Spec)

Rohan Protocol separates **confidential business execution** (local RAM) from **immutable state anchoring** (Midnight Network L1) and **gas payment** (Stripe-backed Paymaster Relayer).

---

### 1. What Happens in Local RAM (Client / MCP Host)

1. **Canonicalization (RFC 8785 JCS):** `confidentialPayload` is deterministically serialized (`canonicalizeJson()` with depth guard `<= 32`) so key order never changes hashes.
2. **Double-Layer Commitment:**
   * **Inner `payloadDigest`:** `SHA-256(canonicalJson(confidentialPayload))` — used for auditing plaintext against the commitment.
   * **Outer `intentHash`:** `SHA-256(agentId : finalIntentText : timestamp)` — 32-byte commitment anchored on-chain.
   * `MemorySanitizer.withSecureWitness()` overwrites temporary witness byte buffers (`fill(0)`) immediately after hashing.
3. **V-08 Sovereign Signing:** The client builds a fixed 9-field `SignedHandshakeV1` envelope (`domain`, `version`, `did`, `network`, `contractAddress`, `circuitName`, `timestamp`, `intentHash`, `nonce`), canonicalizes it via RFC 8785, and signs the UTF-8 bytes with Ed25519 (`did:key`).

---

### 2. What Hits the Relayer vs. Midnight Preprod L1

| Data Element | Leaves Client? | Stored by Relayer (SQLite)? | Written to Midnight L1? |
| :--- | :---: | :---: | :---: |
| Private Key (`ROHAN_AGENT_PRIVATE_KEY`) | **Never** | **Never** | **Never** |
| `confidentialPayload` (Budgets, Deals, PII) | **Never** | **Never** | **Never** |
| `actionSummary` | Yes (Relayer) | No (only hashed into `intentHash`) | **Never** |
| `did:key`, `signature`, `nonce`, `timestamp` | Yes (Relayer) | `(did, nonce, timestamp)` in `used_nonces` | Not on-chain in v0.8 |
| `intentHash` / `stateRoot` (32 bytes) | Yes (Relayer) | Yes (`settlement_history`) | **Yes (Cell 0 `state_root`)** |

On Midnight Preprod L1 (Ledger v9, Protocol `2001100`), the Relayer invokes `verify_batched_handshakes(previous_root, new_root, proof_commitment, caller_identity, toll_amount)` via native `Midnight.js 5.0.0` + `Proof Server 9.0.0`. Only opaque 32-byte commitments advance on-chain.

---

### 3. Honest Boundaries: What `did:key` Proves (and What It Does Not)

* **Proof-of-Control, NOT Human KYC:** A W3C `did:key:z6Mk...` (Ed25519 multicodec `0xed01`, verified with strict Base58btc re-encoding anti-malleability) proves mathematically that the caller controls a specific private keypair. It does **not** prove civil identity, corporate KYB, or key revocation without an external Verifiable Credential issuer.
* **Client Commitments vs. Client-Side ZK-SNARKs:** Client packages (`@rohan-protocol/sdk`, `@rohan-protocol/mcp`, `@rohan-protocol/webmcp`) generate RFC 8785 + SHA-256 commitments in memory without requiring Docker. Compact circuit proving (`verify_batched_handshakes`) currently executes on the Paymaster Relayer + Proof Server `9.0.0`. Client-side Compact ZK-SNARK proving in WASI Preview 2 is our funded R&D milestone under **RFC-006 (Midnight Ecosystem Grant)**.
* **JavaScript Memory Realism:** Calling `signer.destroy()` wipes retained raw `Uint8Array` private-key bytes (`fill(0)`), but ECMAScript/WebCrypto engines cannot deterministically purge opaque V8/C++ `CryptoKey` handles prior to garbage collection. High-assurance deployments should implement `AgentSigner` backed by KMS/HSM.
* **LLM Host Visibility:** When invoking Rohan through an LLM chat host (e.g., Claude Desktop), parameters generated inside the chat are visible to that model provider. For zero-provider-visibility workloads, call `@rohan-protocol/sdk` directly from backend code.

---

### 4. How the Stripe-Paymaster Works (No `$tDUST` Wallets for Customers)

1. **Zero Crypto Accounting:** Enterprise customers never buy `$NIGHT`, never hold `$tDUST`, and never manage 24-word seed phrases.
2. **SaaS Billing (`rohanAuthGate`):** Customers authenticate via standard HTTPS API keys (`x-rohan-api-key`) backed by Stripe subscriptions in SQLite (`api_keys.db`), or use the rate-limited public sandbox tier (`public_read` / optional migration mode).
3. **Credit-Protection Execution Order (V-08):**
   ```text
   Request ➔ 1. identityVerificationGate (DID, Ed25519 Sig, ±5m Skew, Atomic Nonce 409)
           ➔ 2. rohanAuthGate (Quota / Stripe Subscription Check)
           ➔ 3. SemanticFirewall + Serialized Queue ➔ Midnight L1 Settlement ($tDUST paid by Relayer)
   ```

Invalid signatures (401) or identity mismatches (403) abort before rohanAuthGate — attackers can never drain a customer's paid quota with forged signatures.

---