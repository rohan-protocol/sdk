# Quickstart: Connect Claude or Cursor in 30 Seconds

Rohan Protocol gives AI agents cryptographic non-repudiation and confidential commitments on **Midnight Network (Preprod, Ledger v9)** with **zero blockchain wallets and zero gas management**.

---

## Local Stdio vs. Remote HTTP MCP (Which Should You Use?)

| Mode | Best For | Agent Identity (V-08) | Private Keys |
| :--- | :--- | :--- | :--- |
| **Local Stdio MCP** (`@rohan-protocol/mcp`) | Claude Desktop, Cursor, Windsurf, local agent hosts | **Own Sovereign Ed25519 `did:key`** (auto-provisioned locally) | Stays 100% on your machine (`~/.rohan/agent-identity.json`) |
| **Remote HTTP MCP** (`https://api.rohanprotocol.network/mcp`) | Smithery, Glama, cloud sandboxes without Node.js | Relayer gateway / sandbox mode | Never sent to the remote server |

---

## Setup A: Local Stdio MCP (30-Second Copy-Paste)

You do **not** need to manually generate a key first. On first startup, `@rohan-protocol/mcp` automatically creates a persistent Ed25519 `did:key` at **`~/.rohan/agent-identity.json`** (`0600` file permissions) and signs every handshake locally.

### 1. Paste into Claude Desktop or Cursor (Zero Key Setup)

* **Claude Desktop (macOS):** `~/Library/Application Support/Claude/claude_desktop_config.json`
* **Claude Desktop (Windows):** `%APPDATA%\Claude\claude_desktop_config.json`
* **Cursor:** `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global)

```json
{
  "mcpServers": {
    "rohan-shield": {
      "command": "npx",
      "args": ["-y", "@rohan-protocol/mcp@latest"],
      "env": {
        "ROHAN_CONTRACT_ADDRESS": "585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e",
        "ROHAN_RELAYER_URL": "https://api.rohanprotocol.network/api/v1/handshake"
      }
    }
  }
}
```

### 2. Optional: Initialize and inspect via CLI

Verify your local identity, check relayer reachability, or print the client config from your terminal:

```bash
npx @rohan-protocol/mcp init
npx @rohan-protocol/mcp status
```

### 3. Optional: Explicit key via `ROHAN_AGENT_PRIVATE_KEY` (Docker / CI / Web Generator)

Only needed if you run stateless containers or want to pin a specific key generated in our browser-side Agent Identity Generator:

```json
{
  "env": {
    "ROHAN_CONTRACT_ADDRESS": "585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e",
    "ROHAN_RELAYER_URL": "https://api.rohanprotocol.network/api/v1/handshake",
    "ROHAN_AGENT_PRIVATE_KEY": "<64_HEX_PRIVATE_KEY>"
  }
}
```

> **Security rule:** Never paste private keys into chat prompts or MCP tool arguments. `ROHAN_AGENT_PRIVATE_KEY` is read exclusively by the local MCP host process.

## Setup B: Remote MCP (Hosted Sandbox)

For cloud platforms that cannot spawn local npx processes:

- **Streamable HTTP endpoint:** <https://api.rohanprotocol.network/mcp>
- **Discovery server card:** <https://api.rohanprotocol.network/.well-known/mcp/server-card.json>
- **Smithery registry:** `rohanprotocol/shield`

---
