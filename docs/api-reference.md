# API & MCP Tool Reference (v0.8.3)

**Local Stdio MCP** runs in the local process: canonicalization, hashing, and Ed25519 signing occur in client memory. **Remote HTTP MCP** (`https://api.rohanprotocol.network/mcp`) runs in a hosted sandbox and is a separate trust boundary.

For a confidential object, the local client computes `payloadDigest = SHA-256(UTF-8(JCS(confidentialPayload)))`, where JCS is RFC 8785 canonical JSON. The outer `intentHash` is SHA-256 over the UTF-8 commitment witness `agentId:sealedActionSummary:{}:timestamp`; it is not the payload digest.

* **Base URL:** `https://api.rohanprotocol.network`
* **Network:** `midnight-preprod` (Ledger v9, Protocol `2001100`)
* **Contract Address:** `585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e`

---

## 1. MCP Tools (4 Core + 1 Local Status Tool)

### Tool 1: `rohan_execute_handshake`
Executes a confidential commitment settlement on Midnight Preprod L1 (`readOnlyHint: false`, `0` gas to caller).
For a user-requested local preview, set optional `dryRun: true`. It runs firewall and identity checks, computes the signed commitment locally, and returns `settledOnChain: false`, `payloadDigest` when applicable, and `intentHash` without a network call or `txHash`. The default is `false`; do not use dry run for an authorized settlement.

**Example Input:**

```json
{
  "actionSummary": "Vendor Procurement Authorization",
  "confidentialPayload": { "vendor": "Acme", "maxBudgetUsd": 5000 },
  "counterpartyId": "did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH"
}
```

**Dry-run input:** Add `"dryRun": true` only when the user asks to preview, test, or inspect a commitment without settling. The returned `commitment` includes the locally generated `publicInputs` and Ed25519 identity proof when a signer is configured. No relayer submission occurs.

**Example Output:**

```json
{
  "status": "success",
  "agentDid": "did:key:z6MkkCFLgmYzygPSFZ1pWru5nsYE6M32Hr88ENNU4SMAQSWd",
  "receipt": {
    "status": "confirmed",
    "txHash": "0x0065a0ba4dd1f53b7b122ce1cc586849b2b0ecb4cc7fadcf4a7478a2a3b2b0899a",
    "intentHash": "95912977d0f26be105c0cb74ca1141454552c3d543fb098d56c327253a794164",
    "payloadDigest": "sha256:8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4"
  }
}
```

### Tool 2: `rohan_get_ledger_state`

Reads the current anchored on-chain state root (readOnlyHint: true, idempotentHint: true, 0 gas).

**Example input:** `{}`  
**Example output:**

```json
{
  "status": "success",
  "contractAddress": "585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e",
  "currentStateRoot": "95912977d0f26be105c0cb74ca1141454552c3d543fb098d56c327253a794164",
  "blockHeight": 3432019,
  "lastTxHash": "f1d8aa3ec1737f617d8281e737c0b71fb559242e49c3709bc1d6236b1f2156cc",
  "network": "midnight-preprod",
  "cacheTtlMs": 15000
}
```

### Tool 3: `rohan_get_transaction_history`

Lists confirmed L1 settlement records from the relayer index (readOnlyHint: true, idempotentHint: true, 0 gas).

**Example input:** `{ "limit": 2 }`  
**Example output:**

```json
{
  "status": "success",
  "contractAddress": "585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e",
  "network": "midnight-preprod",
  "count": 2,
  "transactions": [
    {
      "txHash": "0x0065a0ba4dd1f53b7b122ce1cc586849b2b0ecb4cc7fadcf4a7478a2a3b2b0899a",
      "stateRoot": "95912977d0f26be105c0cb74ca1141454552c3d543fb098d56c327253a794164",
      "intentHash": "95912977d0f26be105c0cb74ca1141454552c3d543fb098d56c327253a794164",
      "blockHeight": 3432019,
      "status": "confirmed",
      "timestamp": 1794750008224
    }
  ]
}
```

### Tool 4: `rohan_verify_commitment`

Locally verifies plaintext against the inner payloadDigest using RFC 8785 JCS + SHA-256 (readOnlyHint: true, openWorldHint: false, 0 network, 0 gas).

**Example input:**

```json
{
  "payload": { "vendor": "Acme", "maxBudgetUsd": 5000 },
  "expectedDigest": "sha256:8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4"
}
```

**Example output:**

```json
{
  "status": "success",
  "valid": true,
  "match": true,
  "expectedDigest": "8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4",
  "computedDigest": "8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4",
  "algorithm": "SHA-256 (RFC 8785 JCS)"
}
```

### Tool 5: `rohan_get_agent_status` [Local Stdio MCP / v0.8.3]

Returns real runtime identity and connectivity telemetry (readOnlyHint: true, 0 gas). (Also exposed as MCP Resource rohan://identity.)

**Example input:** `{}`  
**Example output:**

```json
{
  "status": "success",
  "mode": "local-sovereign",
  "agentDid": "did:key:z6MkkCFLgmYzygPSFZ1pWru5nsYE6M32Hr88ENNU4SMAQSWd",
  "signingMode": "Ed25519",
  "network": "midnight-preprod",
  "relayerHealthy": true,
  "currentBlockHeight": 3432019
}
```

### 2. Relayer HTTP Endpoints

| Endpoint | Method | Auth / Rate Limit | Description |
| --- | --- | --- | --- |
| `/api/v1/handshake` | `POST` | V-08 identity (optional/required) + optional API key | Unary L1 settlement |
| `/api/v1/handshake/stream` | `POST` | V-08 identity + optional API key | Chunked NDJSON lifecycle telemetry stream |
| `/api/v1/ledger-state` | `GET` | Public read (20 req/s) | Current L1 stateRoot & blockHeight |
| `/api/v1/transactions` | `GET` | Public read (20 req/s) | Confirmed settlement history (`?limit=1..50`) |
| `/health` | `GET` | Public | 200 OK when ready; 503 while syncing |
| `/mcp` | `POST` | Public / Sandbox | Streamable HTTP Remote MCP |
| `/.well-known/mcp/server-card.json` | `GET` | Public | Static discovery card (Smithery / Glama) |

### 3. Error Codes (HTTP & MCP)

| Status | Error Code | Cause & Recovery |
| --- | --- | --- |
| 400 | `INVALID_IDENTITY_ENVELOPE` / `MALFORMED_DID` | Invalid `did:key` (0xed01 / non-canonical Base58btc), padded Base64URL, or malformed intentHash |
| 401 | `UNAUTHORIZED` | Unsigned request sent when `RELAYER_AUTH_MODE=required` |
| 401 | `INVALID_SIGNATURE` | Ed25519 signature verification failed (rejected before credit deduction) |
| 401 | `STALE_TIMESTAMP` | Request timestamp outside ±5 minutes clock-skew window — rebuild & re-sign |
| 403 | `IDENTITY_MISMATCH` | `publicInputs.agentId` does not match `identity.did` |
| 409 | `REPLAY_DETECTED` | (`did`, `nonce`) already consumed in durable SQLite store — do not reuse nonces; check `GET /api/v1/transactions` |
| 503 | Service Unavailable | Relayer booting / syncing Midnight DUST projections |

### Environment variables (Local Stdio MCP)

| Variable | Purpose |
| --- | --- |
| `ROHAN_RELAYER_URL` | Handshake endpoint; configure this for a self-hosted relayer. |
| `ROHAN_NETWORK` | `preprod`, `testnet`, or `mainnet`. |
| `ROHAN_CONTRACT_ADDRESS` | Contract address used for commitments and reads. |
| `ROHAN_AGENT_PRIVATE_KEY` | Optional 64-hex-character Ed25519 seed; use a secret store and never pass it to tools. |
| `ROHAN_API_KEY` | Optional relayer API key. |

### Independently verify a `txHash`

Query the Midnight Preprod Indexer v4 GraphQL API directly, without relying on Rohan's relayer. Strip a leading `0x` from the transaction hash:

```bash
curl -sS -X POST 'https://midnight-preprod.blockfrost.io/api/v0?project_id=<YOUR_BLOCKFROST_TOKEN>' \
  -H 'content-type: application/json' \
  --data '{"query":"{ transactions(offset: { hash: \"<TX_HASH_WITHOUT_0x>\" }) { hash protocolVersion block { height hash } } }"}'
```