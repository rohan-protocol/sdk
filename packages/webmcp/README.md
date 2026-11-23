# @rohan-protocol/webmcp (v0.8.3)

Browser-native WebMCP Shield with Zero-Width Unicode Sanitization (V-07) and in-memory cryptographic commitment generation.

---

## 📦 Installation

```bash
npm install @rohan-protocol/webmcp
```

---

## 🌟 Browser-Native Features

* **Zero-Width Character Sanitizer (V-07):** Strips invisible Unicode steganography and prompt-injection vectors from DOM inputs before processing.
* **SubtleCrypto Native Hashing:** Derives 32-byte SHA-256 intent commitments directly via `window.crypto.subtle` in client RAM.
* **Safe In-Memory Zeroize:** Clears sensitive witness buffers on client execution completion.

## Local commitments and MCP modes

The browser package computes its `intentHash` locally in browser memory as SHA-256 over the UTF-8 witness `agentId:intent:JSON.stringify(formData):timestamp`. Unlike the SDK/Local MCP handshake, this WebMCP path does not currently return a separate RFC 8785 `payloadDigest`. The remote hosted MCP endpoint (`https://api.rohanprotocol.network/mcp`) is a separate processing mode and does not provide the same local-process trust boundary.

The MCP host configuration variables are `ROHAN_RELAYER_URL` (use a self-hosted relayer URL when appropriate), `ROHAN_NETWORK`, `ROHAN_CONTRACT_ADDRESS`, `ROHAN_AGENT_PRIVATE_KEY`, and `ROHAN_API_KEY`. They configure the local Node.js MCP server, not this browser package.

---

## 📜 License

Apache-2.0
