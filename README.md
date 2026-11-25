# Rohan Protocol (v0.8.3)

[![NPM Version](https://img.shields.io/npm/v/@rohan-protocol/sdk?style=flat-square&color=blue)](https://www.npmjs.com/package/@rohan-protocol/sdk)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg?style=flat-square)](LICENSE)
[![Midnight Network](https://img.shields.io/badge/Midnight-Preprod-purple?style=flat-square)](https://midnight.network)
[![Rohan Shield MCP server – quality and maintenance score on Glama](https://glama.ai/mcp/servers/rohan-protocol/sdk/badges/score.svg)](https://glama.ai/mcp/servers/rohan-protocol/sdk)
[![Rohan Protocol MCP on mcprush](https://mcprush.com/badge/rohan-protocol-mcp/score.svg)](https://mcprush.com/to/rohan-protocol-mcp?ref=badge)

> **The Sovereign Privacy & Settlement Layer for Autonomous AI Agents on the Midnight Blockchain.**

Rohan Protocol equips autonomous AI agents with zero-knowledge intent commitments, confidential state transitions, and a complete, verifiable audit lifecycle. Sensitive parameters (budgets, vendor contracts, PII) are strictly canonicalized (RFC 8785) and hashed in client RAM—never exposed on-chain or leaked in LLM context windows.

---

## 🔄 The Closed-Loop Multi-Agent Architecture

Rohan Protocol eliminates the classic "dead-end" MCP agent problem by establishing a complete, multi-turn lifecycle between coordinating agents:

```text
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│    Agent Alpha    │   │    Agent Beta     │   │    Agent Beta     │   │    Agent Beta     │
│ (State Mutation)  │   │ (State Inspection)│   │ (History Review)  │   │ (Agreement Audit) │
└─────────┬─────────┘   └─────────┬─────────┘   └─────────┬─────────┘   └─────────┬─────────┘
          │                       │                       │                       │
          │ 1. rohan_execute_handshake│ 2. rohan_get_ledger_state│ 3. rohan_get_transaction_history│ 4. rohan_verify_commitment
          │    (Confidential Payload)│    (Read Anchored Root) │    (Settlement Receipts) │    (RFC 8785 In-Memory JCS)
          ▼                       ▼                       ▼                       ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 Rohan Protocol Relayer                                 │
│                     Midnight Preprod L1 Settlement & Paymaster                         │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

* **Step 1 — Write (`rohan_execute_handshake`):** Agent Alpha commits an intent. The Relayer verifies proof commitments and anchors the state root on Midnight Preprod L1. The legacy `rohan_zk_handshake` name remains accepted.
* **Step 2 — Read (`rohan_get_ledger_state`):** Agent Beta inspects the contract's anchored state root, block height, and transaction receipt from cache (0 Gas, <1 ms).
* **Step 3 — History (`rohan_get_transaction_history`):** Agent Beta lists recorded settlement transactions and receipts (0 Gas).
* **Step 4 — Verify (`rohan_verify_commitment`):** Agent Beta checks plaintext against its canonical SHA-256 payload digest in local RAM (0 Gas). This is the inner payload digest, not the outer on-chain `intentHash`.

---

## 🛠️ The 5 MCP Tools

| Tool | Category | Gas Cost | Latency | Description |
| :--- | :--- | :--- | :--- | :--- |
| `rohan_execute_handshake` | Mutation / Write | Relayer-submitted | ~25s L1 (or <1ms `dryRun`) | Submits a confidential state transition (supports `dryRun: true` and legacy `rohan_zk_handshake` alias). |
| `rohan_get_ledger_state` | Inspection / Read | Read-only (0 Gas) | <5 ms (15s Cache) | Reads the contract state root, block height, and last transaction hash. |
| `rohan_get_transaction_history` | Inspection / Read | Read-only (0 Gas) | <5 ms | Lists recent settlement transactions and receipts. |
| `rohan_verify_commitment` | Audit / Verify | Local RAM (0 Gas) | <1 ms | Checks plaintext against the inner `payloadDigest` via RFC 8785 JCS + SHA-256, or verifies a `RohanAuditBundle`. |
| `rohan_get_agent_status` | Identity / Status | Read-only (0 Gas) | Local / Relayer ping | Reports the configured `did:key` identity, network, and relayer reachability. |

---

## 📦 Monorepo Packages

* [`@rohan-protocol/sdk`](packages/sdk): Zero-dependency Node.js SDK (`>=20.0.0`) with cryptographic zeroization, Ed25519 `did:key` signing, and `RohanAuditBundle` verification. Browser-safe offline verification primitives are exported via `@rohan-protocol/sdk/identity`. *(Client-side Compact ZK-SNARK proving in WASI Preview 2 is active R&D under RFC-006 / Midnight Grants Milestone 1.)*
* [`@rohan-protocol/mcp`](packages/mcp): Official Model Context Protocol (MCP) server & CLI (`init`, `status`, `verify`) for Claude Desktop, Cursor, Cline, and Gemini, with local Ed25519 agent identity (`rohan-shield`).
* [`@rohan-protocol/webmcp`](packages/webmcp): Browser-native WebMCP shield with zero-width character sanitization (V-07).

---

## 📚 Documentation

* [Quickstart: Claude, Cursor & Remote MCP](docs/quickstart.md)
* [SDK & A2A Non-Repudiation Guide](docs/sdk-a2a-guide.md)
* [Architecture & Security Model](docs/architecture-security.md)
* [API & MCP Tool Reference](docs/api-reference.md)
* [Examples](examples/)

---

## 🚀 Quickstart

### 1. Install SDK

```bash
npm install @rohan-protocol/sdk
```

### 2. Basic SDK Usage (Signed V-08 Handshake & Offline Audit)

```ts
import {
  RohanClient,
  InMemoryEd25519Signer,
  verifyAuditBundle,
} from '@rohan-protocol/sdk';

// 1. Create a Sovereign Agent Identity (Ed25519 W3C did:key)
const signer = await InMemoryEd25519Signer.generate();
const client = new RohanClient({
  network: 'preprod',
  signer,
});

// 2. Inspect on-chain state (Read)
const state = await client.getLedgerState();
console.log('Current Root:', state.currentStateRoot, 'Block:', state.blockHeight);

// 3. Submit a signed confidential handshake (Write — agentId defaults to signer.did)
const deal = { budgetUsd: 75000, approvalCode: 'AUTH-99' };
const receipt = await client.submitHandshake({
  intent: 'Vendor Purchase Order #1042',
  confidentialPayload: deal,
});
console.log('Confirmed TxHash:', receipt.txHash);
console.log('Inner PayloadDigest:', receipt.payloadDigest);

// 4. Verify AuditBundle & plaintext commitment offline (0 Gas, 0 Network)
const audit = await verifyAuditBundle(receipt.auditBundle!, deal);
console.log('Cryptographic match?', audit.valid); // true (payloadMatch, intentBindingValid, signatureValid)

signer.destroy();
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
