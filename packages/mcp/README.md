# @rohan-protocol/mcp (v0.8.3)

Local stdio Model Context Protocol server for handshake submission, ledger and history reads, identity status, and offline verification.

## Install and configure

Start with Node.js using:

```bash
npx -y --package @rohan-protocol/mcp@0.8.3 rohan-shield
```

On first startup, the local server provisions an Ed25519 identity at `~/.rohan/agent-identity.json`. The directory and file use `0700` and `0600` permissions on POSIX systems. `ROHAN_AGENT_PRIVATE_KEY`, when set, overrides the file and must be a 32-byte seed encoded as 64 hexadecimal characters (optional `0x` prefix).

Example Claude Desktop or Cursor stdio entry:

```json
{
  "mcpServers": {
    "rohan-shield": {
      "command": "npx",
      "args": ["-y", "--package", "@rohan-protocol/mcp@0.8.3", "rohan-shield"]
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

The legacy tool name `rohan_zk_handshake` remains accepted by the handler. Every tool description includes `Usage guidelines:` describing routing, privacy, and recovery. `rohan_verify_commitment` accepts `auditBundle` with an optional plaintext payload, or `expectedDigest` together with a payload. Verify against the inner `payloadDigest`, not the outer timestamp-salted `intentHash`.

`rohan_execute_handshake` accepts optional `dryRun: true` only when the user asks to preview, test, or inspect a commitment without settling on-chain. The default is `false`. A dry run runs the firewall and local identity checks, canonicalizes and hashes in process memory, and returns the signed `commitment`, `payloadDigest` (when present), and `intentHash` with `settledOnChain: false`. It makes no relayer request and returns no fake `txHash`.

## Resource and agent instructions

- **Resource:** `rohan://identity` returns identity metadata, signing mode, configured network, contract, and relayer URL. It never includes private key material.
- **Instructions:** `ROHAN_MCP_INSTRUCTIONS` is sent in the MCP initialization response. It describes the privacy boundary, local identity handling, status checks, audit verification, and recovery guidance for replay, timestamp, signature, and identity errors.

## CLI

The same executable provides:

```text
npx -y --package @rohan-protocol/mcp@0.8.3 rohan-shield init
npx -y --package @rohan-protocol/mcp@0.8.3 rohan-shield status
npx -y --package @rohan-protocol/mcp@0.8.3 rohan-shield verify <payload.json> <audit-bundle.json|sha256-digest>
npx -y --package @rohan-protocol/mcp@0.8.3 rohan-shield --help
```

The executable names are `rohan-shield` and `rohan-mcp`; no generic `mcp` binary is installed. A no-argument invocation starts the stdio JSON-RPC server. In an interactive terminal it prints a brief usage hint to stderr; stdout remains reserved for MCP JSON-RPC.

`init` provisions or verifies the identity and prints an MCP configuration snippet. `status` checks the existing identity without creating a keystore and queries relayer state. `verify` performs offline audit-bundle or digest verification.

## Remote MCP

The separately hosted **Remote HTTP MCP** endpoint is `https://api.rohanprotocol.network/mcp` and runs in a hosted sandbox. This package starts **Local Stdio MCP**, where hashing and signing happen in local process memory.

## Local hashing, environment, and transaction verification

For confidential data, local hashing uses `payloadDigest = SHA-256(UTF-8(JCS(confidentialPayload)))`, with RFC 8785 JCS. The sealed action summary includes that inner digest. The outer `intentHash` is SHA-256 of the UTF-8 witness `agentId:sealedActionSummary:{}:timestamp`. It is computed locally and is not interchangeable with `payloadDigest`.

| Variable | Purpose |
| --- | --- |
| `ROHAN_RELAYER_URL` | Relayer handshake URL; set this to self-host. |
| `ROHAN_NETWORK` | `preprod`, `testnet`, or `mainnet` (default: `preprod`). |
| `ROHAN_CONTRACT_ADDRESS` | Target Midnight contract (default: `585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e`). |
| `ROHAN_AGENT_PRIVATE_KEY` | Optional 64-hex-character Ed25519 seed; overrides the local keystore. Keep in a secret store. |
| `ROHAN_API_KEY` | Optional relayer API key. |

Verify a settlement independently using the Midnight Preprod Indexer v4 GraphQL API, without Rohan's relayer. Strip any leading `0x` from `txHash`:

```bash
curl -sS -X POST 'https://midnight-preprod.blockfrost.io/api/v0?project_id=<YOUR_BLOCKFROST_TOKEN>' \
  -H 'content-type: application/json' \
  --data '{"query":"{ transactions(offset: { hash: \"<TX_HASH_WITHOUT_0x>\" }) { hash protocolVersion block { height hash } } }"}'
```

## Source, docs & registries

- **Source:** [GitHub repository](https://github.com/rohan-protocol/sdk)
- **Docs:** [Quickstart](https://github.com/rohan-protocol/sdk/blob/main/docs/quickstart.md), [Architecture & Security](https://github.com/rohan-protocol/sdk/blob/main/docs/architecture-security.md), [API reference](https://github.com/rohan-protocol/sdk/blob/main/docs/api-reference.md)
- **Registries:** [Official MCP Registry](https://registry.modelcontextprotocol.io/) (`io.github.rohan-protocol/mcp`), [Glama](https://glama.ai/mcp/servers/rohan-protocol/sdk), [MCP Rush](https://mcprush.com/to/rohan-protocol-mcp?ref=badge)

## License

Apache-2.0
