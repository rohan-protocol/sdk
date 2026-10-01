<h1 align="center">Rohan Protocol</h1>

<p align="center">
  <strong>Stateless zero-knowledge trust and gasless settlement layer for autonomous AI agents.</strong><br>
  <em>Universal MCP gateway, WebMCP browser shield, and zero-leakage cryptographic state machine on Midnight.</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@rohan-protocol/sdk"><img src="https://img.shields.io/badge/NPM-v0.6.0-blue?style=for-the-badge" alt="NPM Version v0.6.0"></a>
  <a href="https://rohanprotocol.network/"><img src="https://img.shields.io/badge/Spec-IEEE_Paper_v2.0-00629B?style=for-the-badge&logo=ieee" alt="IEEE Spec v2.0"></a>
  <a href="https://midnight.network/"><img src="https://img.shields.io/badge/Settlement-Midnight_Preprod_Live-black?style=for-the-badge" alt="Midnight Preprod"></a>
  <a href="#streamable-http-ndjson-lifecycle"><img src="https://img.shields.io/badge/Transport-Streamable_HTTP_(NDJSON)-orange?style=for-the-badge" alt="Streamable HTTP"></a>
  <a href="#formal-threat-and-mitigation-register"><img src="https://img.shields.io/badge/Security-V--01_|_V--02_|_V--05_|_V--07-red?style=for-the-badge" alt="Security Register"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge" alt="License: MIT"></a>
</p>

> **Foundational Research Paper**  
> [*Rohan: A Stateless Zero-Knowledge Trust Gateway for Privacy-Preserving Agentic Workflows via Streamable HTTP*](https://zenodo.org/records/22730240)  
> Model Context Protocol Working Group & Rohan Protocol Lab.

---

## Table of Contents

- [The Problem: Context Leaks and Unbounded Surface in Agentic AI](#the-problem-context-leaks-and-unbounded-surface-in-agentic-ai)
- [Architecture: The Rohan Engine](#architecture-the-rohan-engine)
- [Ecosystem Packages](#ecosystem-packages)
- [Universal MCP Client Setup](#universal-mcp-client-setup)
- [Developer Quickstart: Node.js and TypeScript](#developer-quickstart-nodejs-and-typescript)
- [Streamable HTTP (NDJSON) Lifecycle](#streamable-http-ndjson-lifecycle)
- [Hosted Relayer Infrastructure and Access Tiers](#hosted-relayer-infrastructure-and-access-tiers)
- [Threat and Mitigation Register](#threat-and-mitigation-register)
- [Live Settlement Infrastructure](#live-settlement-infrastructure)
- [Academic Citation](#academic-citation)
- [License](#license)

---

## The Problem: Context Leaks and Unbounded Surface in Agentic AI

When autonomous AI agents negotiate, exchange tools, or commit actions across heterogeneous environments using the **Model Context Protocol (MCP)** or **WebMCP**, enterprise infrastructure faces three existential vulnerabilities:

1. **Context and Credential Exfiltration** — Sensitive prompt parameters, private negotiation terms, and internal API keys are exposed in plaintext across model gateways and centralized proxies.
2. **Adversarial Prompt Injection (V-01 / V-07)** — Malicious counterparties or web forms inject hidden adversarial payloads (e.g., zero-width Unicode characters `[\\u200B-\\u200D\\uFEFF]`) to manipulate autonomous agents into unauthorized transactions.
3. **Wallet and Key-Management Friction** — Requiring agents or end-users to manage native Web3 wallets, seed phrases, and gas balances creates unacceptable operational overhead for Web2 and AI engineering teams.

---

## Architecture: The Rohan Engine

Rohan shifts the security perimeter from network firewalls to **stateless, client-side cryptographic commitments**. 

Clients process sensitive witnesses in RAM and use `zeroize` for best-effort buffer clearing. Cryptographic commitments are transmitted via **Streamable HTTP (NDJSON)** to the Rohan Relayer, which may sponsor execution fees (`$tDUST`) and anchor state transitions on the **Midnight Blockchain**.

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│                          AUTONOMOUS AGENT RUNTIME                             │
│     Claude Desktop / Cursor IDE         │        Web Copilots / React Apps    │
│                  │                      │                    │                │
│                  ▼                      │                    ▼                │
│     [@rohan-protocol/mcp]               │       [@rohan-protocol/webmcp]      │
│     • Pre-Prover Firewall (V-01)        │       • DOM Sanitizer (V-07)        │
│     • Stdio MCP Protocol Server         │       • WebWorker Thread Isolation  │
└──────────────────┬──────────────────────┴─────────────────┬───────────────────┘
                   │                                        │
                   └──────────────────┬─────────────────────┘
                                      │ Private local witness (w)
                                      ▼
                   ┌───────────────────────────────────────┐
                   │       [@rohan-protocol/sdk]           │
                   │  • In-memory witness generation       │
                   │  • Deterministic zeroize (V-02)       │
                   │  • 32-Byte Cryptographic Commitment   │
                   │  • ZERO Docker dependency for clients │
                   └──────────────────┬────────────────────┘
                                      │ Streamable HTTP (NDJSON)
                                      │ POST /api/v1/handshake/stream
                                      ▼
                   ┌───────────────────────────────────────┐
                   │        Rohan Relayer Gateway          │
                   │  • Native Midnight.js In-Memory Engine│
                   │  • Gas fee subsidization ($tDUST)     │
                   │  • Queue Backpressure & Rate Guards   │
                   └──────────────────┬────────────────────┘
                                      │ Substrate WebSocket Settlement (wss://)
                                      ▼
                   ┌───────────────────────────────────────┐
                   │        Midnight Blockchain Ledger     │
                   │  Contract: rohan_handshake.compact    │
                   │  Preprod: 585ac0c4448257507d8ffa2a... │
                   └───────────────────────────────────────┘
```

## Ecosystem Packages

| Package | Version | Description | Target runtime |
| --- | --- | --- | --- |
| `@rohan-protocol/sdk` | v0.6.0 | TypeScript SDK and relayer client | Node.js, Deno, Bun, Edge |
| `@rohan-protocol/mcp` | v0.6.0 | MCP server integration for agent tools | MCP-compatible clients |
| `@rohan-protocol/webmcp` | v0.6.0 | Browser-oriented WebMCP integration | React, Next.js, browsers |

## Universal MCP Client Setup

The examples below show how to configure Rohan in supported MCP clients.

### Claude Desktop

Add Rohan to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "rohan-zk-shield": {
      "command": "npx",
      "args": ["-y", "@rohan-protocol/mcp"],
      "env": {
        "ROHAN_RELAYER_URL": "https://api.rohanprotocol.network/api/v1/handshake",
        "ROHAN_API_KEY": "rohan_live_..."
      }
    }
  }
}
```

### Cursor IDE and Windsurf

Open **Settings → Features → MCP Servers → Add New MCP Server** and use:

- **Name:** `rohan-shield`
- **Type:** command
- **Command:** `npx -y @rohan-protocol/mcp`
- **Environment variable:** `ROHAN_API_KEY=YOUR_API_KEY`

### Google ADK 2.0 and Gemini

Register the gateway as a tool in your agent pipeline:

```typescript
import { GoogleAgent } from "@google/adk";
import { RohanMcpGateway } from "@rohan-protocol/mcp";

const gateway = new RohanMcpGateway({
  transport: "streamable-http",
  relayerUrl: "https://api.rohanprotocol.network/api/v1/handshake",
  apiKey: process.env.ROHAN_API_KEY
});

// Mount as standard tool declaration
agent.registerTool(gateway.asAdkTool());
```

## Developer Quickstart: Node.js and TypeScript

Install the SDK:

```bash
npm install @rohan-protocol/sdk
```

### Direct handshake submission

```typescript
import { RohanClient } from "@rohan-protocol/sdk";

// Initialize client (defaults to live Midnight Preprod settlement)
const client = new RohanClient({
  contractAddress: "585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e",
  relayerUrl: "https://api.rohanprotocol.network", // Automatically normalizes to /api/v1/handshake
  apiKey: process.env.ROHAN_API_KEY // Optional: 10 handshakes/day free sandbox
});

// Generate in-memory commitment & settle on Midnight
const receipt = await client.submitHandshake({
  agentId: "did:midnight:agent-alpha-01",
  intent: "execute_confidential_sla_settlement",
  privateData: { dealValue: 150000, clearanceLevel: "TIER_1" }
});

console.log("✅ Handshake confirmed on Midnight Blockchain!");
console.log(`   TxHash: ${receipt.txHash}`);
console.log(`   Status: ${receipt.status}`);
```

### Streamable HTTP with lifecycle events

For long-running workflows, the SDK can report lifecycle events from the
NDJSON stream:

```typescript
import { RohanRelayerClient } from "@rohan-protocol/sdk";

const relayer = new RohanRelayerClient({
  relayerUrl: "https://api.rohanprotocol.network",
  apiKey: process.env.ROHAN_API_KEY
});

// Generate local commitment
const commitment = await relayer.generateHandshakeProof({
  agentId: "did:midnight:agent-streamer",
  intent: "real_time_multilateral_accord"
});

// Stream progress events
const receipt = await relayer.submitProofStream(commitment, (event) => {
  switch (event.stage) {
    case "received":
      console.log("[1/4] Ingress acknowledged by relayer.");
      break;
    case "firewall_approved":
      console.log("[2/4] Semantic Firewall (V-01) validation passed.");
      break;
    case "subsidizing_gas":
      console.log(`[3/4] Relayer subsidizing $tDUST gas via ${event.gasPayer}.`);
      break;
    case "confirmed":
      console.log(`[4/4] State transition confirmed on-chain! TxHash: ${event.txHash}`);
      break;
  }
});
```

## Streamable HTTP (NDJSON) Lifecycle

When streaming over `POST /api/v1/handshake/stream`, lifecycle events are
returned as newline-delimited JSON:

```jsonl
{"stage":"received","timestamp":1790616560000}
{"stage":"firewall_approved","v01":"passed"}
{"stage":"subsidizing_gas","gasPayer":"rohan-relayer-node-01"}
{"stage":"confirmed","status":"success","txHash":"0x0048ef6ae559371537b2becd6e4361b9eeba1c170f79ae6fe8b5fa310c99a01b83","intentHash":"4444444444444444444444444444444444444444444444444444444444444444","timestamp":1790616560392}
```

## Hosted Relayer Infrastructure and Access Tiers

The tiers and fee-sponsorship details below are project-provided examples;
confirm current quotas and pricing before relying on them.

| Tier | Target use case | Included quota | Rate limit / speed | Price |
| --- | --- | --- | --- | --- |
| Sandbox | Testing and evaluation | 10 handshakes / day | Shared queue | Free |
| Developer | Staging and development | 500 handshakes / month | Standard tier | $0 |
| Pro Agent | Production agents and startups | 25,000 handshakes / month | High-speed dedicated pool | $49 / month |
| Scale | High-throughput workloads | 125,000 handshakes / month | Priority lane SLA | $199 / month |

Manage API keys and subscriptions at [rohanprotocol.network](https://rohanprotocol.network/).

## Threat and Mitigation Register

The following table summarizes documented threat areas and example
mitigations. These controls reduce risk; they do not guarantee prevention.

| ID | Threat | Example mitigation |
| --- | --- | --- |
| V-01 — Semantic / MCP layer | Indirect prompt injection via tool descriptions or inputs | Validate tool inputs and enforce explicit policy checks in the MCP integration |
| V-02 — Runtime memory | Sensitive values may remain in process memory | Minimize secret lifetime and use supported memory-clearing primitives; this is not a guarantee that every copy is erased |
| V-03 — Relayer availability | Request floods, quota abuse, or queue exhaustion | Apply rate limits, API-key quotas, and queue backpressure |
| V-05 — Contract state | Unauthorized or invalid state transitions | Verify contract authorization and sequence checks against the deployed contract |
| V-07 — Browser / WebMCP | Untrusted page content may influence agent actions | Treat DOM content as untrusted input and validate browser isolation and sanitization |

## Live Settlement Infrastructure

- **Network:** Midnight Preprod testnet
- **Settlement contract:** `rohan_handshake.compact`
- **Contract address listed in project materials:**
  `585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e`
- **Public gateway:** <https://api.rohanprotocol.network/api/v1/handshake>

Testnet deployments and endpoints can change. Confirm the current network,
contract address, and service status before use.

## Academic Citation

The Rohan preprint is available on [Zenodo](https://zenodo.org/records/22730240):

> Julian von Bordelius. “Rohan: A Stateless Zero-Knowledge Trust Gateway for
> Privacy-Preserving Agentic Workflows via Streamable HTTP.” Preprint, 2026.
> <https://doi.org/10.5281/zenodo.22730240>

```bibtex
@misc{vonbordelius2026rohan,
  author    = {Julian von Bordelius},
  title     = {Rohan: A Stateless Zero-Knowledge Trust Gateway for
               Privacy-Preserving Agentic Workflows via Streamable HTTP},
  year      = {2026},
  publisher = {Zenodo},
  doi       = {10.5281/zenodo.22730240},
  url       = {https://doi.org/10.5281/zenodo.22730240}
}
```

## License

MIT © Rohan Protocol.

