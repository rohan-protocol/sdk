# @rohan-protocol/sdk

[![NPM Version](https://img.shields.io/badge/NPM-v0.6.0-blue?style=for-the-badge)](https://www.npmjs.com/package/@rohan-protocol/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

**Stateless zero-knowledge trust and commitment layer for autonomous AI agents.**  
Client-side memory sanitation (zeroize), zero-Docker dependency, and gasless state settlement on Midnight Blockchain.

---

## Features

- **Zero Docker Requirement:** Pure TypeScript/WebCrypto runtime. No local proof server containers required for client developers.
- **Hardware-Level Memory Hygiene (V-02):** Cryptographically secures and wipes private witnesses from memory using `MemorySanitizer`.
- **Gasless L1 Settlement:** Settle verifiable state transitions on Midnight Preprod without managing Lace wallets, seed phrases, or native `$tDUST` balances.
- **Streamable HTTP (NDJSON):** Real-time progressive settlement telemetry for long-lived AI agent pipelines.

---

## Installation

```bash
npm install @rohan-protocol/sdk

Quickstart
code TypeScript

import { RohanClient } from "@rohan-protocol/sdk";

// Initialize client with live Midnight Preprod settlement
const client = new RohanClient({
  contractAddress: "585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e",
  relayerUrl: "https://api.rohanprotocol.network", // Automatically normalizes to /api/v1/handshake
  apiKey: process.env.ROHAN_API_KEY // Optional: 10 handshakes/day sandbox included
});

// Commit confidential intent & anchor on Midnight
const receipt = await client.submitHandshake({
  agentId: "did:midnight:agent-alpha-01",
  intent: "execute_confidential_sla_settlement",
  privateData: { clearanceLevel: "TIER_1", dealValueUsd: 150000 }
});

console.log(`✅ On-chain settlement confirmed: ${receipt.txHash}`);
console.log(`   Status: ${receipt.status}`);

License

MIT © Rohan Protocol. Built for the autonomous agentic economy on Midnight.
