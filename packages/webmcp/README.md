# @rohan-protocol/webmcp (v0.8.3)

Browser-native WebMCP Shield with zero-width Unicode detection (V-07) and in-memory cryptographic commitment generation.

## 📦 Installation

```bash
npm install @rohan-protocol/webmcp
```

## 🌟 Browser-Native Features

* **Zero-width Unicode detection (V-07):** Rejects form data containing selected zero-width or formatting characters before hashing; it does not strip or clean the input.
* **Pattern-based prompt-injection checks:** Rejects a small set of configured patterns. This is not comprehensive prompt-injection protection.
* **SubtleCrypto hashing:** Computes the SHA-256 `intentHash` locally in browser memory.
* **Witness buffer clearing:** Overwrites the local witness buffer after successful hashing. JavaScript and WebCrypto may retain internal copies, so this is best-effort memory sanitation, not a guarantee of complete erasure.

## Local commitments and MCP modes

The browser package computes its `intentHash` locally in browser memory as SHA-256 over the UTF-8 witness `agentId:intent:JSON.stringify(formData):timestamp`. Unlike the SDK/Local MCP handshake, this WebMCP path does not currently return a separate RFC 8785 `payloadDigest`. The remote hosted MCP endpoint ([https://api.rohanprotocol.network/mcp](https://api.rohanprotocol.network/mcp)) is a separate processing mode and does not provide the same local-process trust boundary.

The MCP host configuration variables are `ROHAN_RELAYER_URL` (use a self-hosted relayer URL when appropriate), `ROHAN_NETWORK`, `ROHAN_CONTRACT_ADDRESS`, `ROHAN_AGENT_PRIVATE_KEY`, and `ROHAN_API_KEY`. They configure the local Node.js MCP server, not this browser package.

## Links

* [Source code](https://github.com/rohan-protocol/sdk/tree/main/packages/webmcp)
* [npm package](https://www.npmjs.com/package/@rohan-protocol/webmcp)
* [Quickstart](https://github.com/rohan-protocol/sdk/blob/main/docs/quickstart.md) · [Architecture & Security](https://github.com/rohan-protocol/sdk/blob/main/docs/architecture-security.md)

## 📜 License

Apache-2.0
