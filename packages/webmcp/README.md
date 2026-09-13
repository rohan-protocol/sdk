# Rohan WebMCP Shield 🌐 (`@rohan-protocol/webmcp`)

[![NPM Version](https://img.shields.io/npm/v/@rohan-protocol/webmcp?style=for-the-badge&color=blue)](https://www.npmjs.com/package/@rohan-protocol/webmcp)
[![React Compatible](https://img.shields.io/badge/React-18_%7C_19-61dafb?style=for-the-badge&logo=react)](https://react.dev)
[![Streamable HTTP](https://img.shields.io/badge/Transport-Streamable_HTTP_%28NDJSON%29-orange?style=for-the-badge)](#real-time-streamable-http-telemetry)
[![Security V-07](https://img.shields.io/badge/Security-V--07_DOM_Injection_Defense-red?style=for-the-badge)](#security-vectors)
[![Powered by Midnight](https://img.shields.io/badge/Settlement-Midnight_Network-black?style=for-the-badge)](https://midnight.network)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

> **Browser-Native Zero-Knowledge Shield for WebMCP, AI Web Agents & React/Next.js Frontends.**  
> Shields form inputs, user intents, and autonomous browser transactions directly in client-side RAM before data ever reaches a server — featuring real-time **Streamable HTTP (NDJSON)** live event tracking for reactive UIs.

---

## ⚡ The Threat: Client-Side Injection & Blind Settlement

When autonomous web agents (browser extensions, web copilots, or embedded WebMCP tools) interact with web forms, hostile websites can mount **Client-Side Prompt Injections**:

- **Invisible Text Smuggling**: Malicious override instructions hidden in zero-width Unicode spaces (`\u200B-\u200D`, `\uFEFF`).
- **WebMCP Tool Spoofing**: Counterfeit WebMCP tools tricking agents into leaking session cookies or credentials.
- **Plaintext Data Exposure**: Raw form payloads sent over the wire expose private financial and identity constraints.
- **Opaque UI Latency**: Traditional ZK & blockchain submissions leave users staring at static loading spinners with zero progress visibility.

---

## 🛡️ The Solution: In-Browser ZK-Shielding + Live NDJSON Streaming

`@rohan-protocol/webmcp` brings the power of the Midnight Blockchain directly into modern frontend stacks:

1. **Pre-Prover DOM Firewall (V-07)**: Real-time heuristic scanning of form inputs for prompt injection patterns and invisible zero-width characters.
2. **Thread-Isolated WebWorker Proving**: ZK-SNARK computations run on a dedicated background WebWorker thread. Your UI remains locked at a buttery-smooth 60 FPS.
3. **Browser Memory Sanitation (V-02)**: Private inputs are scrubbed from browser RAM (`0x00` wipe) immediately after commitment hashing.
4. **⚡ Streamable HTTP (NDJSON) Telemetry**: Consumes chunked NDJSON events directly from the Rohan Relayer (`POST /api/v1/handshake/stream`) via the native browser `ReadableStream` API, driving progressive UI steppers in real time.
5. **Zero-Gas Client DX**: Users and agents do not need Web3 wallets. Proofs are forwarded to the Rohan Relayer for gasless on-chain settlement.

---

## 📦 Installation

```bash
npm install @rohan-protocol/webmcp @rohan-protocol/sdk
```

---

## 🚀 Quickstart: React / Next.js Integration

### 1. Wrap Your App with `<RohanWebMcpProvider>`

```tsx
// app/layout.tsx or src/App.tsx
import React from 'react';
import { RohanWebMcpProvider } from '@rohan-protocol/webmcp';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <RohanWebMcpProvider
      contractAddress="6d2d603235f996424d76c85186a79cc403245ea8ee1ba9087e40967fe71bdc4d"
      relayerUrl="https://api.rohanprotocol.network/api/v1/handshake/stream"
    >
      {children}
    </RohanWebMcpProvider>
  );
}
```

### 2. Shield Form Data with Live Progressive Stage Telemetry

Use the `useRohanWebMcp` hook to shield form submissions and reflect the 4 streaming stages directly in your UI:

```tsx
// components/ConfidentialCheckout.tsx
import React, { useState } from 'react';
import { useRohanWebMcp, StreamStage } from '@rohan-protocol/webmcp';

const STAGE_LABELS: Record<StreamStage, string> = {
  idle: 'Ready',
  received: '📡 [1/4] Relayer Ingress Confirmed',
  firewall_approved: '🛡️ [2/4] Semantic Firewall V-01 Passed',
  subsidizing_gas: '⛽ [3/4] Relayer Subsidizing Gas (tDUST)',
  confirmed: '🎉 [4/4] Finalized on Midnight Blockchain',
};

export function ConfidentialCheckout() {
  const { shieldAndSubmitStream, isProving, currentStage } = useRohanWebMcp();
  const [amount, setAmount] = useState('250');
  const [receipt, setReceipt] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      // 🛡️ 1. Scanned by DOM Firewall (V-07)
      // ⚡ 2. Proved inside WebWorker in client RAM (V-02 zeroize)
      // 📡 3. Streamed via Streamable HTTP (NDJSON) with live stage updates
      const res = await shieldAndSubmitStream({
        agentId: 'did:midnight:web-shopper-01',
        intent: 'confidential_settlement',
        formData: {
          amount: Number(amount),
          currency: 'USDC',
          merchantVault: 'vault_tier_alpha',
        },
      });

      setReceipt(res);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={handleTransaction} className="p-6 border rounded-xl max-w-md mx-auto shadow-sm">
      <h3 className="text-xl font-bold mb-4">ZK-Shielded Transaction</h3>
      
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="border p-2 rounded mb-4 w-full"
        placeholder="Amount"
        disabled={isProving}
      />

      <button
        type="submit"
        disabled={isProving}
        className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
      >
        {isProving ? 'Computing ZK-Proof...' : 'Shield & Execute'}
      </button>

      {/* Live Streamable HTTP Stage Stepper */}
      {currentStage !== 'idle' && (
        <div className="mt-4 p-3 bg-blue-50 text-blue-900 rounded-lg text-sm">
          <p className="font-semibold">{STAGE_LABELS[currentStage]}</p>
        </div>
      )}

      {error && <p className="text-red-500 mt-3 font-mono text-sm">{error}</p>}

      {receipt && (
        <div className="mt-4 p-3 bg-green-50 text-green-800 rounded font-mono text-xs break-all">
          <p className="font-bold mb-1">Status: Confirmed On-Chain!</p>
          <p>TxHash: {receipt.txHash}</p>
          <p>IntentHash: {receipt.intentHash}</p>
        </div>
      )}
    </form>
  );
}
```

---

<a id="real-time-streamable-http-telemetry"></a>
## ⚡ Real-Time Streamable HTTP Telemetry

The client-side `ReadableStream` reader consumes incoming NDJSON chunks progressively from `POST /api/v1/handshake/stream`:

```text
Chunk 1: {"stage":"received","timestamp":1788903808207}
Chunk 2: {"stage":"firewall_approved","v01":"passed"}
Chunk 3: {"stage":"subsidizing_gas","gasPayer":"rohan-relayer-node-01"}
Chunk 4: {"stage":"confirmed","status":"success","txHash":"0x7c92...","intentHash":"0916..."}
```

---

<a id="security-vectors"></a>
## 🔒 Security Vectors (V-07 & V-02)

| Threat | Impact | Mitigation in `@rohan-protocol/webmcp` |
| :--- | :--- | :--- |
| **Zero-Width Character Injection** | Injected instructions bypass standard string matching | Scans regex `[\u200B-\u200D\uFEFF]` across all parameters before processing |
| **System Override Prompts** | Rogue web elements hijack browser copilot intents | Heuristic inspection blocks strings like `ignore previous instructions` |
| **Browser Heap Scraping** | Plaintext form secrets reside in memory | WebWorker zero-fill (`0x00`) purges arrays immediately after hash generation |
| **Opaque Intermediary Tampering** | Counterfeit relay nodes alter handshake parameters | Cryptographic commitment hashing anchored to Midnight Preprod smart contract |

---

## 🧩 Part of the Rohan Ecosystem

| Package | Purpose | Target Environment |
| :--- | :--- | :--- |
| `@rohan-protocol/sdk` | Core ZK Engine & Streamable Relayer Client | Universal (Node.js, Deno, Bun) |
| `@rohan-protocol/mcp` | Model Context Protocol Server with Semantic Firewall (V-01) | Claude Desktop, Cursor, Terminal Bots |
| `@rohan-protocol/webmcp` | React/Next.js Client Wrapper with DOM Protection (V-07) & Live Stages | Browser Frontends, Chrome Extensions |

---

## 📄 License

MIT © Rohan Protocol. Part of the Private Agentic Economy on Midnight.
