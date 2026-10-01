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
- [Developer Quickstart: Node.js & TypeScript SDK](#developer-quickstart-nodejs--typescript-sdk)
- [Streamable HTTP (NDJSON) Lifecycle](#streamable-http-ndjson-lifecycle)
- [Hosted Relayer Infrastructure and Access Tiers](#hosted-relayer-infrastructure-and-access-tiers)
- [Formal Threat and Mitigation Register](#formal-threat-and-mitigation-register)
- [Live Settlement Infrastructure](#live-settlement-infrastructure)
- [Academic Citation](#academic-citation)
- [License](#license)

---

## The Problem: Context Leaks and Unbounded Surface in Agentic AI

When autonomous AI agents negotiate, exchange tools, or commit actions across heterogeneous environments using the **Model Context Protocol (MCP)** or **WebMCP**, enterprise infrastructure faces three existential vulnerabilities:

1. **Context and Credential Exfiltration** — Sensitive prompt parameters, private negotiation terms, and internal API keys are exposed in plaintext across model gateways and centralized proxies.
2. **Adversarial Prompt Injection (V-01 / V-07)** — Malicious counterparties or web forms inject hidden adversarial payloads (e.g., zero-width Unicode characters `[\u200B-\u200D\uFEFF]`) to manipulate autonomous agents into unauthorized transactions.
3. **Wallet and Key-Management Friction** — Requiring agents or end-users to manage native Web3 wallets, seed phrases, and gas balances creates unacceptable operational overhead for Web2 and AI engineering teams.

---

## Architecture: The Rohan Engine

Rohan shifts the security perimeter from network firewalls to **stateless, client-side cryptographic commitments**. 

Clients allocate and wipe sensitive witnesses in RAM using hardware-level memory sanitization (`zeroize`). Cryptographic commitments are transmitted via **Streamable HTTP (NDJSON)** to the sovereign **Rohan Relayer Pool**, which sponsors execution fees (`$tDUST`) and anchors state transitions on the **Midnight Blockchain**.

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

Ecosystem Packages
Package	Version	Description	Target Runtime
@rohan-protocol/sdk	v0.6.0	Ultra-lightweight TypeScript SDK, memory-wiping commitment engine, and relayer client	Node.js, Deno, Bun, Edge
@rohan-protocol/mcp	v0.6.0	Official MCP server with Pre-Prover Semantic Firewall (V-01) for LLM tools	Claude Desktop, Cursor, Gemini, CLI
@rohan-protocol/webmcp	v0.6.0	Browser-native WebMCP shield with zero-width Unicode sanitizer (V-07)	React, Next.js, Web Copilots
Universal MCP Client Setup

Rohan is fully compliant with the open Model Context Protocol (MCP) specification. Any agentic runtime or IDE can establish verifiable, zero-knowledge handshakes out of the box.
Claude Desktop

Add Rohan to your claude_desktop_config.json (see the MCP user guide):
code JSON

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

Cursor IDE and Windsurf

Open Settings → Features → MCP Servers → Add New MCP Server:

    Name: rohan-shield

    Type: command

    Command: npx -y @rohan-protocol/mcp

    Environment Variables: ROHAN_API_KEY=rohan_live_...

Google ADK 2.0 and Gemini

Register Rohan as a progressive ZK tool in your autonomous agent pipelines:
code TypeScript

import { GoogleAgent } from "@google/adk";
import { RohanMcpGateway } from "@rohan-protocol/mcp";

const gateway = new RohanMcpGateway({
  transport: "streamable-http",
  relayerUrl: "https://api.rohanprotocol.network/api/v1/handshake",
  apiKey: process.env.ROHAN_API_KEY
});

// Mount as standard tool declaration
agent.registerTool(gateway.asAdkTool());

Developer Quickstart: Node.js & TypeScript SDK

Install the lightweight client library (pure TypeScript, zero Docker containers required):
code Bash

npm install @rohan-protocol/sdk

1. Direct Handshake Submission
code TypeScript

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

console.log(`✅ Handshake confirmed on Midnight Blockchain!`);
console.log(`   TxHash: ${receipt.txHash}`);
console.log(`   Status: ${receipt.status}`);

2. Streamable HTTP with Real-Time Lifecycle Telemetry

For long-lived workflows, track the settlement lifecycle in real time via chunked NDJSON streaming:
code TypeScript

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

Streamable HTTP (NDJSON) Lifecycle

When streaming over POST /api/v1/handshake/stream, progressive stage telemetry is returned as single-line JSON chunks:
code JSON

{"stage":"received","timestamp":1790616560000}
{"stage":"firewall_approved","v01":"passed"}
{"stage":"subsidizing_gas","gasPayer":"rohan-relayer-node-01"}
{"stage":"confirmed","status":"success","txHash":"0x0048ef6ae559371537b2becd6e4361b9eeba1c170f79ae6fe8b5fa310c99a01b83","intentHash":"4444444444444444444444444444444444444444444444444444444444444444","timestamp":1790616560392}

Hosted Relayer Infrastructure and Access Tiers

The client SDK (@rohan-protocol/sdk) executes in client RAM with zero computational cost to Rohan. On-chain settlement fees on Midnight ($tDUST) are fully subsidized by the Rohan Relayer Gateway.
<table>
<thead>
<tr>
<th>Tier</th>
<th>Target Use Case</th>
<th>Included Quota</th>
<th>Rate Limit / Speed</th>
<th>Price</th>
</tr>
</thead>
<tbody>
<tr>
<td><strong>Sandbox</strong></td>
<td>Testing & Evaluation</td>
<td>10 handshakes / day</td>
<td>Shared queue</td>
<td><strong>Free</strong></td>
</tr>
<tr>
<td><strong>Developer</strong></td>
<td>Staging & Development</td>
<td>500 handshakes / month</td>
<td>Standard tier</td>
<td><strong>$0</strong></td>
</tr>
<tr>
<td><strong>Pro Agent</strong></td>
<td>Production Agents & Startups</td>
<td>25,000 handshakes / month</td>
<td>High-speed dedicated pool</td>
<td><strong>$49 / month</strong></td>
</tr>
<tr>
<td><strong>Scale</strong></td>
<td>High-throughput Swarms</td>
<td>125,000 handshakes / month</td>
<td>Priority lane SLA</td>
<td><strong>$199 / month</strong></td>
</tr>
</tbody>
</table>

Claim API keys and manage subscriptions at rohanprotocol.network.
Formal Threat and Mitigation Register

Rohan maps each architectural boundary to formal protocol-level defenses:
V-01 — Semantic / MCP Layer

    Threat: Indirect prompt injection via tool descriptions or inputs.

    Impact: Compromised agents performing unauthorized actions.

    Mitigation: Pre-Prover Semantic Firewall with regex filters and token guardrails in @rohan-protocol/mcp.

V-02 — Runtime Memory Residue

    Threat: Memory scraping and cold-boot heap exfiltration.

    Impact: Recovery of private witness data (w).

    Mitigation: MemorySanitizer.withSecureWitness performs cryptographically secure multi-pass overwrites (0x00) immediately after commitment generation.

V-03 — Relayer Exhaustion / DDoS

    Threat: Gas-drain flooding and queue exhaustion attacks.

    Impact: Depleting relayer $tDUST reserves or causing proxy timeouts.

    Mitigation: Express-native IP rate limiting (req.ip), strict API-key quota validation, and queue backpressure guards (HTTP 503 + Retry-After).

V-05 — Smart Contract State Integrity

    Threat: Re-initialization or unauthorized Merkle root mutation.

    Impact: Total lockout or subversion of on-chain state.

    Mitigation: Cryptographic caller authorization (assert caller_identity == authorized_relayer) and monotonic sequence verification in rohan_handshake.compact.

V-07 — Browser DOM / WebMCP

    Threat: Client-side prompt injection via hidden web contents.

    Impact: Session hijacking or unauthorized web form settlement.

    Mitigation: Strict zero-width Unicode sanitization [\u200B-\u200D\uFEFF] and thread-isolated WebWorker execution in @rohan-protocol/webmcp.

Live Settlement Infrastructure

    Network: Midnight Preprod Testnet

    Settlement Smart Contract: rohan_handshake.compact (compiled via compactc v0.30.0)

    Active Contract Address: 585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e

    Native Relayer Engine: Midnight.js Native (In-Memory WalletFacade v3.0.0)

    Public Gateway: https://api.rohanprotocol.network/api/v1/handshake

Academic Citation

If you utilize Rohan Protocol or its Model Context Protocol gateway architecture in academic research or production systems, please cite the foundational specification:
code Bibtex

@inproceedings{vonbordelius2026rohan,
  author    = {Julian von Bordelius},
  title     = {Rohan: A Stateless Zero-Knowledge Trust Gateway for Privacy-Preserving Agentic Workflows via Streamable HTTP},
  booktitle = {Model Context Protocol Working Group & Rohan Protocol Lab},
  year      = {2026},
  url       = {https://rohanprotocol.network/}
}

License

MIT © Rohan Protocol. Built for the autonomous agentic economy on Midnight.
