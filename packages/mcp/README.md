# @rohan-protocol/mcp (v0.7.0)

Official Model Context Protocol (MCP) server providing confidential state transitions, ledger inspection, and cryptographic audit tools for Claude Desktop, Cursor, Cline, and Gemini.

[![Glama Grade](https://img.shields.io/badge/Glama-Grade%20A%20(5.0)-brightgreen?style=flat-square)](https://glama.ai/mcp/servers/rohan-protocol/shield)
[![Smithery Verified](https://img.shields.io/badge/Smithery-Verified-green?style=flat-square)](https://smithery.ai/servers/rohanprotocol/shield)

---

## 🛠️ The 3 MCP Tools

### 1. `rohan_zk_handshake` (Write / Settlement)
Executes a confidential state transition on Midnight Blockchain. Confidential parameters are automatically canonicalized (RFC 8785) and hashed in client RAM—never exposed on-chain or in model logs.
* **Arguments:** `agentId` (string, required), `actionSummary` (string), `confidentialPayload` (object).

### 2. `rohan_verify_commitment` (Audit / Verify)
Cryptographically audits and verifies whether a plaintext payload matches an on-chain commitment using RFC 8785 JSON Canonicalization and SHA-256. Zero gas cost, executes instantly in local RAM.
* **Arguments:** `payload` (object, required), `expectedDigest` (string, required — accepts raw hex, `sha256:`, or `0x` prefixes).

### 3. `rohan_get_ledger_state` (Read / State Inspection)
Reads the current anchored state of the Rohan Protocol smart contract on Midnight Preprod L1. Returns state root, block height, and last mined transaction hash from memory cache.
* **Arguments:** None.

---

## 🚀 Setup & Configuration

### Option A: Claude Desktop Setup
Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "rohan-shield": {
      "command": "npx",
      "args": ["-y", "@rohan-protocol/mcp@0.7.0"],
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
   * **Command:** `npx -y @rohan-protocol/mcp@0.7.0`

### Option C: Remote MCP (Smithery / Cloud Agents)
Connect directly to the hosted endpoint:
* **Server Card:** `https://api.rohanprotocol.network/.well-known/mcp/server-card.json`
* **JSON-RPC Endpoint:** `https://api.rohanprotocol.network/mcp`

---

## 📜 License

Apache-2.0
