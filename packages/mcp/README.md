# @rohan-protocol/mcp (v0.8.1)

Official Model Context Protocol (MCP) server providing confidential state transitions, ledger inspection, and cryptographic audit tools for Claude Desktop, Cursor, Cline, and Gemini.

[![Rohan Shield MCP server – quality and maintenance score on Glama](https://glama.ai/mcp/servers/rohan-protocol/sdk/badges/card.svg)](https://glama.ai/mcp/servers/rohan-protocol/sdk)
[![Smithery Verified](https://img.shields.io/badge/Smithery-Verified-green?style=flat-square)](https://smithery.ai/servers/rohanprotocol/shield)

---

## 🛠️ The 4 MCP Tools

### 1. `rohan_execute_handshake` (Write / Settlement)
Executes a confidential state transition on Midnight Blockchain. Confidential parameters are automatically canonicalized (RFC 8785) and hashed in client RAM—never exposed on-chain or in model logs.
* **Arguments:** `actionSummary` (non-empty string, required), `agentId` (string, optional when a local signer is configured), `confidentialPayload` (object, optional). If supplied with a signer, `agentId` must match its DID. The legacy `rohan_zk_handshake` tool name remains accepted.

### 2. `rohan_get_ledger_state` (Read / State Inspection)
Reads the current anchored state of the Rohan Protocol smart contract on Midnight Preprod L1. Returns state root, block height, and last mined transaction hash from memory cache.
* **Arguments:** None.

### 3. `rohan_get_transaction_history` (Read / Settlement History)
Lists recent settlement transactions and receipts recorded by the relayer.
* **Arguments:** `limit` (integer, optional — defaults to 10, maximum 50).

### 4. `rohan_verify_commitment` (Audit / Verify)
Verifies a plaintext confidential payload against its canonical SHA-256 digest in local memory.
* **Arguments:** `payload` (object, required), `expectedDigest` (string, required — accepts raw hex, `sha256:`, or `0x` prefixes). Supply the inner payload digest referenced in `actionSummary`, not the timestamp-salted outer on-chain `intentHash`.

---

## 🚀 Setup & Configuration

### Option A: Claude Desktop Setup
Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "rohan-shield": {
      "command": "npx",
      "args": ["-y", "@rohan-protocol/mcp@0.8.1"],
      "env": {
        "ROHAN_API_KEY": ""
      }
    }
  }
}
```

### Option B: Cursor MCP Setup
1. Go to **Settings → Features → MCP**.
2. Click **Add New MCP Server**:
   * **Name:** `rohan-shield`
   * **Type:** `command`
   * **Command:** `npx -y @rohan-protocol/mcp@0.8.1`

### Option C: Remote MCP (Smithery / Cloud Agents)
Connect directly to the hosted endpoint:
* **Server Card:** `https://api.rohanprotocol.network/.well-known/mcp/server-card.json`
* **JSON-RPC Endpoint:** `https://api.rohanprotocol.network/mcp`

### Local agent identity and signing (V-08)
The local stdio server loads identity in this order:

1. `ROHAN_AGENT_PRIVATE_KEY`, if set, as a 32-byte Ed25519 seed encoded in
   exactly 64 hexadecimal characters (an optional `0x` prefix is accepted).
   Invalid configured values fail startup; they never fall back to another key.
2. The existing `~/.rohan/agent-identity.json` keystore, after checking its
   permissions and verifying that its DID matches the public key derived from
   the stored seed.
3. If no keystore exists, the server provisions one with exclusive,
   create-only semantics. It is stored as plaintext key material in the
   user-only file `~/.rohan/agent-identity.json`; the directory is restricted
   to `0700` and the file to `0600` on POSIX systems. Corrupt or mismatched
   existing files fail closed and are never silently replaced.

With the local signer active, `agentId` may be omitted and the server supplies
the signer's DID. If provided, it must exactly match. A non-empty
`actionSummary` is always required; the `intent` property is deprecated and
cannot replace it. The DID is reported at startup so operators can record it
for their agent configuration.

Protect and back up the keystore as a secret. Deleting it provisions a new key
and therefore a new DID; restoring it preserves the identity. Never put key
material in tool arguments, prompts, source control, or logs. JavaScript and
WebCrypto cannot guarantee erasure of all in-memory key copies. A `did:key`
proves control of a key, not a real-world identity, and the relayer must enforce
signature verification for server-side authentication.

---

## 📜 License

Apache-2.0
