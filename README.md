<h1 align="center">Project Rohan 🛡️ (@rohan-protocol/sdk)</h1>

<p align="center">
  <b>The Universal Trust Layer for AI Agents.</b><br>
  <i>Stop leaking agent data. Replace insecure REST APIs with local Zero-Knowledge Proofs.</i>
</p>

<p align="center">
  <a href="#-langchain-integration-god-mode"><img src="https://img.shields.io/badge/LangChain-Native-blue?style=for-the-badge&logo=langchain" alt="LangChain"></a>
  <a href="#architecture"><img src="https://img.shields.io/badge/Powered_by-Midnight_Blockchain-black?style=for-the-badge" alt="Midnight"></a>
  <a href="#quickstart"><img src="https://img.shields.io/badge/DX-Stripe_for_ZK-008CDD?style=for-the-badge" alt="Stripe DX"></a>
  <a href="https://github.com/rohan-protocol/sdk/stargazers"><img src="https://img.shields.io/badge/GitHub-Trending_🔥-orange?style=for-the-badge" alt="Trending"></a>
</p>

> **🚨 v0.3.1 "The Gasless Update" is live:** We achieved **Stripe-DX for ZK-Proofs**. No wallets, no DUST-tokens, no cryptography PhD required. Just an API key.

### 🛑 The Problem: AI Agents leak data via REST
When your agent talks to another agent via API, the payload is exposed. Centralized servers see your agent's confidential logic, system prompts, and negotiation limits. 

### ⚡ The Solution: Rohan ZK-Handshakes
Rohan enables agents to negotiate confidential deals (NDAs, payments, secrets) using **Zero-Knowledge Proofs (zk-SNARKs)** on the Midnight Blockchain. 
* **Private Deals:** The actual deal content *never* leaves your server.
* **Public Proof:** Only an encrypted cryptographic commitment lands on-chain.
* **Zero Web3 Friction:** Our Relayer Node handles gas fees. You just code.

---

## What is this?

Rohan enables AI agents to negotiate confidential deals (NDAs, payments, secrets) with each other using **Zero-Knowledge Proofs (zk-SNARKs)** on the Midnight Blockchain. The actual deal content never leaves your server. Only an encrypted cryptographic commitment lands on-chain.

With **SDK v0.3.1**, we refined the **"Gas Station / Relayer"** architecture (Stripe-DX). You no longer need to manage DUST-Token balances, blockchain wallets, or complex cryptography. You simply provide an API Key, and our Relayer pays the gas fees and manages the chain interactions for your agent.

## Install

```bash
npm install @rohan-protocol/sdk
```

## Quickstart

```typescript
import { RohanNode } from '@rohan-protocol/sdk';

// 1. Create an agent connected to the Relayer (No Wallets required!)
const agent = new RohanNode({
  apiKey: process.env.ROHAN_API_KEY || 'rohan_sk_test',
  relayerUrl: 'https://api.rohanprotocol.network'
});

// 2. Listen for incoming deals (Trustless Verification via Network Ledger)
agent.onHandshake((deal) => {
  console.log(`Deal confirmed on-chain! From: ${deal.from}`);
  console.log(`Commitment Hash: ${deal.commitment}`);
});

// 3. Connect to the Blockchain Tracker
await agent.start();
```

## Send a Confidential Handshake

You can prompt your agent to execute a confidential data transfer utilizing our ZK Proof flow:

```typescript
const result = await agent.handshake(
  'did:rohan:partner_agent',           // Target DID (or raw Contract Address)
  { nda: 'Project Alpha', blueprints: true }, // Secret data (remains offline, auto-stringified)
  150  // Toll fee in DUST
);

console.log(result.status);            // "success"
console.log(result.txId);              // "tx_mid_892f7dbf..."
console.log(result.onChainCommitment); // "ca5ab9c2..."
```

## 🤖 LangChain Integration (God Mode)

Turn your standard LLM into an autonomous Web3 protocol user. We provide a drop-in LangChain `Tool` wrapper. Your agent can decide by itself when it is appropriate to use a ZK-Handshake to protect confidential data.

```typescript
import { RohanSecureHandshakeTool } from '@rohan-protocol/sdk';

// Inject the Tool into LangChain/LangGraph
const handshakeTool = new RohanSecureHandshakeTool(agent);
const tools = [handshakeTool, /* other system tools */];

// The LLM will now autonomously construct the ZK-Handshake payload 
// when its system prompt instructs it to securely transmit money or data.
```

## API Reference

### `new RohanNode(config)`

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `apiKey` | `string` | ✅ | – | API key for the Gas Station / Relayer |
| `relayerUrl` | `string` | ✅ | – | The URL of the Rohan Gas Station |
| `did` | `string` | ❌ | Auto-generated| Decentralized Identifier for this node |

### `agent.start(): Promise<void>`
Initializes the Ledger Poller. It watches the Midnight Blockchain for status updates relevant to this node.

### `agent.onHandshake(callback): void`
Fires automatically when a cryptographic ZK-Proof addressed to this agent is successfully verified on the Midnight Ledger.

### `agent.handshake(targetIdentifier, dealPayload, fee): Promise<HandshakeResult>`
Generates a Zero-Knowledge Proof locally and relays it via the Gas Station API.
- **targetIdentifier**: A DID (`did:rohan:...`) or a raw Midnight Contract Address. DIDs are resolved automatically.
- **dealPayload**: `string | object` — The confidential data you are masking. Objects are auto-stringified.
- **fee**: Toll fee in DUST (default: `150`, minimum: `100`).

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Your AI Agent                      │
│                                                      │
│   const agent = new RohanNode({ apiKey, relayerUrl })│
│   agent.handshake("did:rohan:partner", { secret })   │
└──────────────────┬───────────────────────────────────┘
                   │
        ┌──────────▼──────────┐
        │  @rohan-protocol/sdk│
        │  (Prover Module)    │ ← Generates ZK-Proof locally
        └──────────┬──────────┘
                   │ HTTP POST (Proof Blob + API Key)
        ┌──────────▼──────────┐
        │  Rohan Relayer Node │ ← Verifies API Key & Pays DUST Fee
        └──────────┬──────────┘
                   │ Submit transaction to Midnight
        ┌──────────▼──────────┐
        │  Midnight Network   │ ← The ZK-Settlement Layer
        └─────────────────────┘
```

## Security

- **Gasless Architecture**: API Keys replace vulnerable Wallet Seeds on the client side.
- **Zero-Knowledge**: The deal content is hashed prior to proof generation. Only mathematical assurances are broadcasted.
- **Trustless Execution**: Webhooks are deprecated. Incoming deals trigger strictly based on cryptographic changes on the Ledger.

Seeking Alpha Access? We are currently hand-picking our first 50 validators. Send your Agent DID and use-case to alpha@rohanprotocol.network


## License

MIT © Rohan Protocol



