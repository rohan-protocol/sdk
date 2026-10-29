# Rohan Protocol (v0.7.0)

[![NPM Version](https://img.shields.io/npm/v/@rohan-protocol/sdk?style=flat-square&color=blue)](https://www.npmjs.com/package/@rohan-protocol/sdk)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg?style=flat-square)](LICENSE)
[![Midnight Network](https://img.shields.io/badge/Midnight-Preprod%20Verified-purple?style=flat-square)](https://midnight.network)
[![Smithery Verified](https://img.shields.io/badge/Smithery-Verified-green?style=flat-square)](https://smithery.ai/servers/rohanprotocol/shield)
[![Glama Grade](https://img.shields.io/badge/Glama-Grade%20A%20(5.0)-brightgreen?style=flat-square)](https://glama.ai/mcp/servers/rohan-protocol/shield)

> **The Sovereign Privacy & Settlement Layer for Autonomous AI Agents on the Midnight Blockchain.**

Rohan Protocol equips autonomous AI agents with zero-knowledge intent commitments, confidential state transitions, and a complete, verifiable audit lifecycle. Sensitive parameters (budgets, vendor contracts, PII) are strictly canonicalized (RFC 8785) and hashed in client RAM—never exposed on-chain or leaked in LLM context windows.

---

## 🔄 The Closed-Loop Multi-Agent Architecture

Rohan Protocol eliminates the classic "dead-end" MCP agent problem by establishing a complete, multi-turn lifecycle between coordinating agents:

```text
┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│     Agent Alpha      │   │      Agent Beta      │   │      Agent Beta      │
│   (State Mutation)   │   │  (State Inspection)  │   │  (Agreement Audit)   │
└──────────┬───────────┘   └──────────┬───────────┘   └──────────┬───────────┘
           │                          │                          │
           │ 1. rohan_zk_handshake    │ 2. rohan_get_ledger_state│ 3. rohan_verify_commitment
           │    (Confidential Payload)│    (Read Anchored Root)  │    (RFC 8785 In-Memory JCS)
           ▼                          ▼                          ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 Rohan Protocol Relayer                                 │
│                     Midnight Preprod L1 Settlement & Paymaster                         │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

* **Step 1 — Write (`rohan_zk_handshake`):** Agent Alpha commits an intent. The Relayer verifies proof commitments and anchors the state root on Midnight Preprod L1.
* **Step 2 — Read (`rohan_get_ledger_state`):** Agent Beta inspects the contract's anchored state root, block height, and transaction receipt from cache (0 Gas, <1 ms).
* **Step 3 — Verify (`rohan_verify_commitment`):** Agent Beta mathematically audits received plaintext against the on-chain commitment in local RAM (0 Gas, 0 ms).

---

## 🛠️ The 3 MCP Lifecycle Tools

| Tool | Category | Gas Cost | Latency | Description |
| :--- | :--- | :--- | :--- | :--- |
| `rohan_zk_handshake` | Mutation / Write | Subsidized (Paymaster) | ~30s (L1 Block) | Executes a confidential state transition anchored on Midnight Preprod. |
| `rohan_verify_commitment` | Audit / Verify | 0 Gas | <1 ms (Local RAM) | Cryptographically audits plaintext against on-chain commitments via RFC 8785 JCS + SHA-256. |
| `rohan_get_ledger_state` | Inspection / Read | 0 Gas | <1 ms (RAM Cache) | Reads current anchored state root, block height, and tx receipt from the 15s write-through cache. |

---

## 📦 Monorepo Packages

* [`@rohan-protocol/sdk`](./packages/sdk): Core TypeScript SDK with cryptographic zeroization, RFC 8785 canonicalization, and state inspection client.
* [`@rohan-protocol/mcp`](./packages/mcp): Official Model Context Protocol (MCP) server for Claude Desktop, Cursor, Cline, and Gemini.
* [`@rohan-protocol/webmcp`](./packages/webmcp): Browser-native WebMCP shield with zero-width character sanitization (V-07).

---

## 🚀 Quickstart

### 1. Install SDK

```bash
npm install @rohan-protocol/sdk
```

### 2. Basic SDK Usage

```typescript
import { RohanClient, canonicalizeJson } from '@rohan-protocol/sdk';

const client = new RohanClient({
  contractAddress: '585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e',
});

// 1. Inspect on-chain state (Read)
const state = await client.getLedgerState();
console.log('Current Root:', state.currentStateRoot, 'Block:', state.blockHeight);

// 2. Submit a confidential handshake (Write)
const receipt = await client.submitHandshake({
  agentId: 'did:midnight:agent-alpha',
  intent: 'Vendor Purchase Order #1042',
  privateData: { budgetUsd: 75000, approvalCode: 'AUTH-99' },
});
console.log('Confirmed TxHash:', receipt.txHash);

// 3. Verify plaintext commitment locally (Verify)
const audit = await client.verifyCommitment(
  { budgetUsd: 75000, approvalCode: 'AUTH-99' },
  receipt.intentHash
);
console.log('Cryptographic match?', audit.valid);
```

---

## 🛡️ Security & Zero-Trust Principles

* **RFC 8785 JSON Canonicalization Scheme (JCS):** Deterministic, cross-platform key sorting and whitespace elimination.
* **DoS & ReDoS Guarding:** Recursive depth ceiling (max. 32 levels) and RAM payload bounds (max. 256 KB).
* **Zeroize RAM Sanitation:** Sensitive witnesses and private keys are scrubbed from RAM immediately after commitment derivation.
* **Optimistic Credit Escrow:** Atomic balance reservations prevent concurrent quota-drain exploits.

---


## 📜 License

Apache-2.0. Copyright (c) 2026 Rohan Protocol Authors.
