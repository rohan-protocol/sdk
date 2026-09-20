# Rohan Protocol SDK 🛡️ (`@rohan-protocol/sdk`)

[![NPM Version](https://img.shields.io/npm/v/@rohan-protocol/sdk?style=for-the-badge&color=blue)](https://www.npmjs.com/package/@rohan-protocol/sdk)
[![Streamable HTTP](https://img.shields.io/badge/Transport-Streamable_HTTP_%28NDJSON%29-orange?style=for-the-badge)](#streamable-http-lifecycle)
[![Powered by Midnight](https://img.shields.io/badge/Settlement-Midnight_Network-black?style=for-the-badge)](https://midnight.network)
[![MCP Native](https://img.shields.io/badge/MCP-Universal_Adapter-green?style=for-the-badge)](https://modelcontextprotocol.io)
[![Security V-02](https://img.shields.io/badge/Security-Zeroize_RAM_Wiping-red?style=for-the-badge)](#security-architecture)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

> **The Stateless Zero-Knowledge Engine for Autonomous AI Agents & Model Context Protocol (MCP).**  
> Prevent context-data leaks. Verify agent-to-agent transactions without exposing plaintext payloads to LLMs or counterparties — with full **Streamable HTTP (NDJSON)** real-time stage telemetry.

---

## ⚡ The Problem: The Agent Context Leak & Blind Latency

Autonomous AI Agents interacting via **MCP (Model Context Protocol)** execute machine-to-machine handshakes. This introduces two critical vulnerabilities:

1. **Context Leak**: Private context, proprietary prompt templates, and API keys leak directly to LLM logs and central intermediaries in plaintext.
2. **Blind Blockchain Latency**: Traditional on-chain settlement leaves agents and users waiting blindly for 5–20 seconds without granular transaction state feedback.

---

## 🛡️ The Solution: Rohan ZK-Engine + Streamable HTTP

`@rohan-protocol/sdk` is the core cryptographic client engine for the Rohan Protocol. It computes **Zero-Knowledge Proofs (ZK-SNARKs)** locally inside client RAM and streams progressive lifecycle events back to the caller in real-time.

- **Stateless & RAM-Only (V-02 Compliant)**: Private witnesses (`w`) never touch disk. Sensitive buffers are wiped immediately after proof generation using multi-pass cryptographically secure memory sanitation (`zeroize`).
- **⚡ Streamable HTTP (NDJSON)**: Chunked transfer-encoding streams live verification stages (`received` ➔ `firewall_approved` ➔ `subsidizing_gas` ➔ `confirmed`) directly over a standard HTTP connection.
- **Gasless Stripe-DX**: No crypto wallets, seed phrases, or gas token (`tDUST`) management required for clients. Proofs are forwarded to the Rohan Relayer for sponsored on-chain anchoring.
- **Midnight Network Settlement**: Mathematical settlement verified by Compact smart contracts on the privacy-centric Midnight Network.

---

## 📦 Installation

```bash
npm install @rohan-protocol/sdk
```

---

## 🚀 Quickstart: Local ZK Handshake with Streamable HTTP

Generate a compact ~580-Byte ZK-Proof locally in RAM and submit it gasless to the relayer with live NDJSON progress tracking:

```typescript
import { RohanProver, RohanRelayerClient } from '@rohan-protocol/sdk';

// 1. Initialize the Relayer Client (No Web3 Wallet or $tDUST needed)
const relayer = new RohanRelayerClient({
  relayerUrl: process.env.ROHAN_RELAYER_URL || 'https://api.rohanprotocol.network',
  contractAddress: '6d2d603235f996424d76c85186a79cc403245ea8ee1ba9087e40967fe71bdc4d',
  apiKey: process.env.ROHAN_API_KEY // Optional for 10 tx/day sandbox, required for production
});

// 2. Initialize the in-memory WASM Prover
const prover = new RohanProver();

// 3. Generate local ZK-Proof for an agent payload (Data stays confidential!)
const secretPayload = {
  maxBudget: 5000,
  condition: 'NDA_SIGNED',
  proprietaryInstruction: 'execute_settlement_tier_1',
};

const proofData = await prover.generateHandshakeProof({
  agentId: 'did:midnight:agent-alpha-001',
  intent: 'autonomous_data_exchange',
  privateData: secretPayload,
});

console.log('✅ ZK-Proof calculated locally in RAM (~580 Bytes). Raw witness wiped.');

// 4. Stream the proof via Streamable HTTP (NDJSON) with live stage telemetry
const receipt = await relayer.submitProofStream(proofData, (event) => {
  switch (event.stage) {
    case 'received':
      console.log('📡 [1/4] Relayer acknowledged proof payload.');
      break;
    case 'firewall_approved':
      console.log('🛡️ [2/4] Semantic Firewall V-01 validation passed.');
      break;
    case 'subsidizing_gas':
      console.log(`⛽ [3/4] Relayer subsidizing gas (${event.gasPayer}).`);
      break;
    case 'confirmed':
      console.log(`🎉 [4/4] On-Chain Confirmation! TxHash: ${event.txHash}`);
      break;
  }
});

console.log('🎉 Handshake verified on Midnight Blockchain!');
console.log('Final Receipt:', receipt);
```

### Backwards Compatible (Atomic Batch)

If you prefer standard Promise-based resolution without streaming callbacks, use `submitProof`:

```typescript
const receipt = await relayer.submitProof(proofData);
console.log('Confirmed TxHash:', receipt.txHash);
```

---

<a id="streamable-http-lifecycle"></a>
## ⚡ Streamable HTTP (NDJSON) Lifecycle

The Rohan Relayer streams progress events via `POST /api/v1/handshake/stream` using standard HTTP Chunked Transfer-Encoding with Newline-Delimited JSON:

| Stage | Event Payload | Description |
| :--- | :--- | :--- |
| `received` | `{"stage":"received","timestamp":1788903808207}` | Proof ingress acknowledged by Relayer gateway |
| `firewall_approved` | `{"stage":"firewall_approved","v01":"passed"}` | Pre-Prover Semantic Firewall V-01 verified payload |
| `subsidizing_gas` | `{"stage":"subsidizing_gas","gasPayer":"rohan-relayer-node-01"}` | Relayer master wallet sponsors `tDUST` fee |
| `confirmed` | `{"stage":"confirmed","status":"success","txHash":"0x7c92...","intentHash":"0916...","timestamp":1788903808208}` | Proof anchored & finalized on Midnight Preprod |

---

## 🧩 Part of the Rohan Ecosystem

This SDK is the low-level cryptographic primitive. For plug-and-play agent integration, use our specialized domain packages:

| Package | Purpose | Target Environment |
| :--- | :--- | :--- |
| `@rohan-protocol/sdk` | Core ZK Engine & Streamable Relayer Client | Universal (Node.js, Deno, Bun) |
| `@rohan-protocol/mcp` | Model Context Protocol Server with Semantic Firewall (V-01) | Claude Desktop, Cursor, Terminal Bots |
| `@rohan-protocol/webmcp` | React/Next.js Client Wrapper with DOM Protection (V-07) & Live Stages | Browser Frontends, Chrome Extensions |

---

## ⚡ Hosted Relayer & Rate Limits

`@rohan-protocol/sdk` computes ZK-SNARKs locally in RAM for free. To submit proofs on-chain without handling crypto tokens, the SDK routes through the Rohan Relayer:

- **Free Sandbox (Default)**: If no `apiKey` is passed, the client runs on the free community sandbox (10 handshakes/day per IP).
- **Production Access**: Pass an API key (`rohan_live_...`) to unlock dedicated high-throughput pools (25k–125k handshakes/mo). Manage keys at [rohanprotocol.network](https://rohanprotocol.network).

---

<a id="security-architecture"></a>
## 🔒 Security Architecture

```text
┌───────────────────────────────────────────────────────────┐
│              Autonomous Agent / Browser MCP               │
│                                                           │
│  1. Sensitive Data ──► [ @rohan-protocol/sdk (WASM RAM) ] │
│                             │                             │
│                             ▼                             │
│                    ZK-SNARK (~580 Bytes)                  │
│                    (Plaintext zeroized!)                  │
└─────────────────────────────┬─────────────────────────────┘
                              │ HTTP Stream (NDJSON Chunks)
                              │ POST /api/v1/handshake/stream
┌─────────────────────────────▼─────────────────────────────┐
│                    Rohan Relayer Station                  │
│       - Chunk 1: stage: 'received'                        │
│       - Chunk 2: stage: 'firewall_approved' (V-01)        │
│       - Chunk 3: stage: 'subsidizing_gas' (DUST sponsor)  │
│       - Chunk 4: stage: 'confirmed' (on-chain receipt)    │
└─────────────────────────────┬─────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────┐
│             Midnight Network Settlement Layer             │
│             Smart Contract: rohan_handshake               │
│     Address: 6d2d603235f996424d76c85186a79cc403245ea...  │
└───────────────────────────────────────────────────────────┘
```

---

## 📄 License

MIT © Rohan Protocol. Built for the Private Agentic Economy on Midnight.
