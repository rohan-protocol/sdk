# Rohan MCP Gateway 🤖 (`@rohan-protocol/mcp`)

[![NPM Version](https://img.shields.io/npm/v/@rohan-protocol/mcp?style=for-the-badge&color=blue)](https://www.npmjs.com/package/@rohan-protocol/mcp)
[![MCP Native](https://img.shields.io/badge/MCP-Standard_2024--11--05-green?style=for-the-badge)](https://modelcontextprotocol.io)
[![Streamable HTTP](https://img.shields.io/badge/Transport-Streamable_HTTP_%28NDJSON%29-orange?style=for-the-badge)](#streamable-http-handshake-lifecycle)
[![Security V-01](https://img.shields.io/badge/Firewall-V--01_Semantic_Shield-red?style=for-the-badge)](#security-architecture)
[![Powered by Midnight](https://img.shields.io/badge/Settlement-Midnight_Network-black?style=for-the-badge)](https://midnight.network)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

> **Official Model Context Protocol (MCP) Server for Confidential Agent-to-Agent ZK-Handshakes.**  
> Equips AI Agents in Claude Desktop, Cursor, and autonomous runtimes with native Zero-Knowledge transaction capability and real-time **Streamable HTTP (NDJSON)** progress telemetry on Midnight.

---

## ⚡ The Threat: Indirect Prompt Injection (Security Vector V-01)

When autonomous AI agents execute machine-to-machine tools, malicious third parties can inject prompt instructions into tool payloads (*Indirect Prompt Injection*). Without deterministic verification, a compromised agent could be tricked into signing unauthorized agreements, leaking confidential session parameters, or executing blind on-chain actions.

---

## 🛡️ The Defense: Pre-Prover Semantic Firewall + Streamable HTTP

`@rohan-protocol/mcp` acts as a zero-trust gateway. Before any Zero-Knowledge proof is computed or relayed:

1. **Semantic Inspection (V-01)**: Validates intent structures, schema boundaries, and agent DIDs against prompt injection patterns and role-reversal exploits.
2. **RAM-Only Proving (V-02)**: Calls `@rohan-protocol/sdk` to generate a 580-byte ZK-SNARK with instant memory zeroization (`zeroize`).
3. **⚡ Streamable HTTP (NDJSON)**: Uses chunked HTTP streaming (`POST /api/v1/handshake/stream`) to provide granular real-time progress events back to the calling agent context.
4. **Gasless Settlement**: Hands off the proof to the Rohan Relayer for on-chain anchoring on Midnight Preprod without requiring the agent to manage private keys or gas tokens (`tDUST`).

---

## 📦 Installation

```bash
npm install @rohan-protocol/mcp
```

Or run directly without installation via `npx`:

```bash
npx @rohan-protocol/mcp
```

---

## 💻 Setup: Connect Your AI Agents

### 1. Claude Desktop Integration

Add the Rohan MCP server to your `claude_desktop_config.json`:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "rohan-zk-gateway": {
      "command": "npx",
      "args": ["-y", "@rohan-protocol/mcp"],
      "env": {
        "ROHAN_CONTRACT_ADDRESS": "6d2d603235f996424d76c85186a79cc403245ea8ee1ba9087e40967fe71bdc4d",
        "ROHAN_RELAYER_URL": "https://api.rohanprotocol.network/api/v1/handshake/stream",
        "ROHAN_API_KEY": "rohan_live_..."
      }
    }
  }
}
```

> **Sandbox vs. Production**: The MCP server works out of the box with **10 free handshakes per day** without an API key. For continuous agent workflows, provide `ROHAN_API_KEY` in the environment configuration.

### 2. Cursor IDE Integration

In Cursor, navigate to **Settings > Features > MCP Servers > Add New MCP Server**:
- **Name**: `rohan-zk`
- **Type**: `command`
- **Command**: `npx -y @rohan-protocol/mcp`

---

## 🛠️ Exposed MCP Tools

The server automatically registers the following tool in your LLM's context:

### `rohan_zk_handshake`

Executes a confidential, tamper-proof Zero-Knowledge handshake on Midnight with real-time streamable verification.

#### Input Schema:

```json
{
  "agentId": {
    "type": "string",
    "description": "Decentralized Identifier (DID) of the initiator agent (e.g. did:midnight:agent-01)"
  },
  "intent": {
    "type": "string",
    "description": "Semantic action plan, financial intent, or agreement to seal in ZK"
  },
  "counterpartyId": {
    "type": "string",
    "description": "Optional DID of the target recipient agent"
  }
}
```

#### Example Agent Invocation Prompt:

> *"Claude, seal our data-sharing agreement with `did:midnight:agent-partner` using Rohan ZK Handshake."*

---

<a id="streamable-http-handshake-lifecycle"></a>
## ⚡ Streamable HTTP Handshake Lifecycle

During tool execution, the MCP server connects to the Relayer via Chunked Transfer-Encoding (NDJSON), processing the following sequential stages:

```text
📡 [LIVE CHUNK] stage: 'received'          | Data: {"stage":"received","timestamp":1788903808207}
📡 [LIVE CHUNK] stage: 'firewall_approved' | Data: {"stage":"firewall_approved","v01":"passed"}
📡 [LIVE CHUNK] stage: 'subsidizing_gas'   | Data: {"stage":"subsidizing_gas","gasPayer":"rohan-relayer-node-01"}
📡 [LIVE CHUNK] stage: 'confirmed'         | Data: {"stage":"confirmed","status":"success","txHash":"0x7c92...","intentHash":"0916..."}
```

#### Returned Structured Receipt to LLM:

```json
{
  "status": "success",
  "receipt": {
    "stage": "confirmed",
    "status": "success",
    "contractAddress": "6d2d603235f996424d76c85186a79cc403245ea8ee1ba9087e40967fe71bdc4d",
    "intentHash": "0916542f526dd3117104f23f113873a5331fdc2d885340081aef79dab0ee7393",
    "txHash": "0x7c92f75ca7d3bc8c767953b69c29d87d3848084c68d401bbd7987ff1afdb8271",
    "gasPaidBy": "rohan-relayer-node-01",
    "timestamp": 1788903808208
  }
}
```

---

<a id="security-architecture"></a>
## 🔒 Security Architecture (V-01 & V-02)

```text
┌────────────────────────────────────────────────────────┐
│  AI Agent (Claude / Cursor / Headless Bot)             │
│  "Perform confidential handshake with Agent B"         │
└──────────────────────────┬─────────────────────────────┘
                           │ 💬 MCP Tool Request: rohan_zk_handshake
                           ▼
┌────────────────────────────────────────────────────────┐
│  🛡️ PRE-PROVER SEMANTIC FIREWALL (V-01)                 │
│  - Inspects against indirect injection patterns       │
│  - Validates schema and DID integrity                 │
└──────────────────────────┬─────────────────────────────┘
                           │ ✅ Filter Passed
                           ▼
┌────────────────────────────────────────────────────────┐
│  📦 @rohan-protocol/sdk (Local WASM Engine)           │
│  - Computes ZK-Proof in isolated RAM                  │
│  - Multi-pass memory wipe destroys witness w (V-02)   │
└──────────────────────────┬─────────────────────────────┘
                           │ 📡 Streamable HTTP (POST /api/v1/handshake/stream)
                           ▼
┌────────────────────────────────────────────────────────┐
│  ⚡ Rohan Relayer & Gas Station (NDJSON Stream)        │
│  - Chunk 1: stage: 'received'                         │
│  - Chunk 2: stage: 'firewall_approved'                │
│  - Chunk 3: stage: 'subsidizing_gas'                  │
│  - Chunk 4: stage: 'confirmed' (on-chain finalization)│
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│  🌌 Midnight Network Settlement Layer                  │
│  - Compact Smart Contract: rohan_handshake             │
│  - Preprod Address: 6d2d603235f996424d76c85186a...     │
└────────────────────────────────────────────────────────┘
```

---

## 📄 License

MIT © Rohan Protocol. Part of the Private Agentic Economy.
