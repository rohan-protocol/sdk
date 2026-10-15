<div align="center">

# 🛡️ Rohan Protocol

### Official Model Context Protocol (MCP) Server & Security Gateway

**The in-memory security proxy preventing LLM context leaks, credential exfiltration, and prompt injections during tool execution.**

[![NPM Version](https://img.shields.io/npm/v/@rohan-protocol/mcp?style=flat-square&color=black&label=%40rohan-protocol%2Fmcp)](https://www.npmjs.com/package/@rohan-protocol/mcp)
[![Glama Server](https://img.shields.io/badge/Glama-MCP_Server-blue?style=flat-square)](https://glama.ai/mcp/servers)
[![Smithery Server](https://img.shields.io/badge/Smithery-rohanprotocol%2Fshield-blue?style=flat-square&logo=anthropic)](https://smithery.ai/server/rohanprotocol/shield)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![IEEE Paper](https://img.shields.io/badge/IEEE_Spec-v2.0-00629B?style=flat-square&logo=ieee)](https://zenodo.org/records/22730240)
[![Settlement](https://img.shields.io/badge/Midnight-Preprod_Live-8A2BE2?style=flat-square)](https://midnight.network/)

<br />

> 📦 **Official Open-Source MCP Server Monorepo**  
> The core Model Context Protocol (MCP) server implementation is located directly in this repository at [`packages/mcp/`](./packages/mcp) and distributed on npm as **`@rohan-protocol/mcp`**.

[Run from Source](#-running-the-mcp-server-from-source) • [MCP Tools](#-exposed-mcp-tools) • [Client Setup](#-universal-mcp-client-setup) • [Architecture](#-architecture) • [Security](#-security-register-threat--mitigation)

</div>

> ⚠️ Public Beta (v0.6.0): Rohan currently enforces client-side RAM witness isolation, V-01 semantic policy firewalls, and V-02 deterministic memory zeroization (zeroize) to shield MCP tool calls while native client-side WASM ZK-SNARK proving circuits are under active research (Milestone 1).

## ⚡ The Problem: Plaintext Context Leaks in MCP

The Model Context Protocol (MCP) connects autonomous agents to tools. However, transport encryption (TLS) only protects data in flight — at the host boundary, standard MCP tools execute in cleartext:

```text
🔴 WITHOUT ROHAN (Standard MCP)
Agent calls tool ➔ { "api_key": "sk_live_...", "db_password": "secret" } in plaintext
                 ➔ Leaked directly into LLM conversation context & inference logs
                 ➔ Permanent risk of context exfiltration & prompt injection

🟢 WITH ROHAN SHIELD
Agent calls tool ➔ Arguments evaluated strictly in isolated client RAM
                 ➔ V-02 Zeroize wipes witness memory immediately from volatile memory
                 ➔ Zero plaintext parameters ever enter the model context window
```

## 🛠️ Running the MCP Server from Source

This repository contains the complete open-source MCP server implementation. You can clone and run the server locally over standard stdio:

```bash
# 1. Clone the repository
git clone https://github.com/rohan-protocol/sdk.git
cd sdk

# 2. Install dependencies & build packages
npm install
npm run build

# 3. Start the MCP Server directly over stdio
node packages/mcp/dist/server.js
```

Or run directly via `npx` without cloning:

```bash
npx -y @rohan-protocol/mcp@latest
```

## 🔧 Exposed MCP Tools

The `@rohan-protocol/mcp` server registers standard Model Context Protocol tool endpoints over JSON-RPC:

| MCP Tool | Description | Input Parameters |
| :--- | :--- | :--- |
| `rohan_zk_handshake` | Evaluates tool execution parameters in ephemeral RAM, strips prompt injections, generates a cryptographic 32-byte intent commitment, and anchors state transitions gaslessly to Midnight. | `targetAgentId` (string), `intent` (string), `privatePayload` (object) |

## 🚀 Universal MCP Client Setup

### 1. Claude Desktop

Add `rohan-shield` to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "rohan-shield": {
      "command": "npx",
      "args": ["-y", "@rohan-protocol/mcp@latest"],
      "env": {
        "ROHAN_RELAYER_URL": "https://api.rohanprotocol.network/api/v1/handshake"
      }
    }
  }
}
```

### 2. Cursor IDE & Windsurf

1. Navigate to **Settings → Features → MCP Servers → Add New MCP Server**.
2. Set the name to **`rohan-shield`**.
3. Set the type to **`command`**.
4. Use the command: `npx -y @rohan-protocol/mcp@latest`

## 📁 Monorepo Structure

```text
rohan-protocol/sdk
├── packages/
│   ├── mcp/         # 🤖 The Official Model Context Protocol (MCP) Server (Stdio)
│   ├── sdk/         # ⚙️ Core in-memory commitment engine & relayer client
│   └── webmcp/      # 🌐 React / Next.js browser hooks with V-07 DOM isolation
├── contracts/       # 📜 Midnight Compact smart contracts (rohan_handshake.compact)
└── README.md
```

## 🏗️ Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AUTONOMOUS AGENT RUNTIME                          │
│               Claude Desktop / Cursor IDE / Custom Agent Workflows          │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Tool Execution (JSON-RPC)
                                       ▼
 ┌───────────────────────────────────────────────────────────────────────────┐
 │                  [@rohan-protocol/mcp] SERVER (packages/mcp)              │
 │  • Stdio MCP Protocol Server: Compliant with Anthropic MCP Specification  │
 │  • V-01 Semantic Firewall: Filters hidden Unicode & prompt injections     │
 └─────────────────────────────────────┬─────────────────────────────────────┘
                                       │ In-Memory Witness
                                       ▼
 ┌───────────────────────────────────────────────────────────────────────────┐
 │                  [@rohan-protocol/sdk] ENGINE (packages/sdk)              │
 │  • Ephemeral RAM Commitment (32-Byte Intent Hash)                         │
 │  • V-02 Deterministic Zeroize: Overwrites buffers immediately in memory   │
 │  • ZERO disk writes. ZERO swap-file exposure.                             │
 └─────────────────────────────────────┬─────────────────────────────────────┘
                                       │ Streamable HTTP (NDJSON)
                                       │ received ➔ approved ➔ proving ➔ anchored
                                       ▼
 ┌───────────────────────────────────────────────────────────────────────────┐
 │                       ROHAN RELAYER PAYMASTER                             │
 │  • Gasless Transaction Sponsoring ($tDUST covered automatically)          │
 │  • Scale-to-Zero Native (No persistent SSE connection bottlenecks)        │
 └─────────────────────────────────────┬─────────────────────────────────────┘
                                       │ Immutable Replay Protection
                                       ▼
 ┌───────────────────────────────────────────────────────────────────────────┐
 │                      MIDNIGHT BLOCKCHAIN LEDGER                           │
 │  Contract: rohan_handshake.compact (Preprod: 585ac0c4448257507d8ffa2a...) │
 └───────────────────────────────────────────────────────────────────────────┘
```

## 🛡️ Security Register (Threat & Mitigation)

| Threat ID | Threat Vector | Mitigation Mechanism |
| :--- | :--- | :--- |
| V-01 | Adversarial Prompt Injection | Pre-Prover Semantic Firewall: intercepts out-of-bounds payloads and strips zero-width Unicode injection characters ([\u200B-\u200D\uFEFF]). |
| V-02 | Residual Heap Exfiltration | Deterministic Memory Zeroize: multi-pass volatile memory wiping overwriting witness buffers with deterministic `0x00` byte patterns. |
| V-05 | Persistent Socket Exhaustion | Scale-to-Zero NDJSON: uses chunked Streamable HTTP instead of long-lived SSE connections, allowing proxies to spin down on idle. |
| V-07 | DOM / WebWorker Scraping | WebMCP Thread Isolation: isolates execution buffers inside WebWorkers, shielded from malicious third-party browser extensions. |

## 📄 Academic Research

The cryptographic foundations, threat registers, and formal mathematical proofs are documented in our research paper:

> Rohan: A Stateless Zero-Knowledge Trust Gateway for Privacy-Preserving Agentic Workflows via Streamable HTTP  
> Model Context Protocol Working Group & Rohan Protocol Lab  
> Published via Zenodo / IEEE Spec v2.0 • DOI: 10.5281/zenodo.22730240

## 🤝 Community & Contributing

We build in the open.

- 🐛 Found a bug or bypass vector? Open a GitHub Issue.
- ⭐️ Support: consider starring the repository to help other developers discover privacy-first MCP tools.

<div align="center">
<sub>Licensed under the <a href="./LICENSE">MIT License</a>. Maintained by the Rohan Protocol community.</sub>
</div>

