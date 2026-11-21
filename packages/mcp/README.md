# @rohan-protocol/mcp (v0.8.2)

Local stdio Model Context Protocol server for handshake submission, ledger and history reads, identity status, and offline verification.

## Install and configure

Start with Node.js using:

```bash
npx -y @rohan-protocol/mcp@0.8.2
```

On first startup, the local server provisions an Ed25519 identity at `~/.rohan/agent-identity.json`. The directory and file use `0700` and `0600` permissions on POSIX systems. `ROHAN_AGENT_PRIVATE_KEY`, when set, overrides the file and must be a 32-byte seed encoded as 64 hexadecimal characters (optional `0x` prefix).

Example Claude Desktop or Cursor stdio entry:

```json
{
  "mcpServers": {
    "rohan-shield": {
      "command": "npx",
      "args": ["-y", "@rohan-protocol/mcp@0.8.2"]
    }
  }
}
```

Never put private keys in tool arguments, prompts, source control, or logs. A `did:key` proves control of a key, not a real-world identity.

## MCP tools

The server exposes five tools, each with MCP `annotations`:

| Tool | Purpose | Annotation hints |
| --- | --- | --- |
| `rohan_execute_handshake` | Submit a handshake; `actionSummary` is required. With a local signer, `agentId` defaults to its DID and must match if supplied. | `readOnlyHint: false`, `idempotentHint: false` |
| `rohan_get_ledger_state` | Read current contract state from the relayer. | Read-only, idempotent |
| `rohan_get_transaction_history` | Read settlement history; optional `limit` (default 10, maximum 50). | Read-only, idempotent |
| `rohan_verify_commitment` | Verify a plaintext digest and/or a portable audit bundle locally. | Read-only, idempotent, `openWorldHint: false` |
| `rohan_get_agent_status` | Report local identity metadata and relayer reachability. | Read-only, idempotent |

The legacy tool name `rohan_zk_handshake` remains accepted by the handler. `rohan_verify_commitment` accepts `auditBundle` with an optional plaintext payload, or `expectedDigest` together with a payload. Verify against the inner `payloadDigest`, not the outer timestamp-salted `intentHash`.

## Resource and agent instructions

- **Resource:** `rohan://identity` returns identity metadata, signing mode, configured network, contract, and relayer URL. It never includes private key material.
- **Instructions:** `ROHAN_MCP_INSTRUCTIONS` is sent in the MCP initialization response. It describes the privacy boundary, local identity handling, status checks, audit verification, and recovery guidance for replay, timestamp, signature, and identity errors.

## CLI

The same executable provides:

```text
npx -y @rohan-protocol/mcp@0.8.2 init
npx -y @rohan-protocol/mcp@0.8.2 status
npx -y @rohan-protocol/mcp@0.8.2 verify <payload.json> <audit-bundle.json|sha256-digest>
npx -y @rohan-protocol/mcp@0.8.2 --help
```

`init` provisions or verifies the identity and prints an MCP configuration snippet. `status` checks the existing identity without creating a keystore and queries relayer state. `verify` performs offline audit-bundle or digest verification.

## Remote MCP

The separately hosted remote MCP endpoint is `https://api.rohanprotocol.network/mcp`; this package's zero-config command starts the local stdio server.

## License

Apache-2.0
