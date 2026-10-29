# @rohan-protocol/webmcp (v0.7.0)

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

---

## 📜 License

Apache-2.0
