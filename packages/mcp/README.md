@rohan-protocol/mcp

![Bild](https://img.shields.io/badge/NPM-v0.6.0-blue?style=for-the-badge)
![Bild](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)

Official Model Context Protocol (MCP) server for Rohan Protocol.
Equips autonomous AI agents (Claude Desktop, Cursor, Gemini, Google ADK) with confidential Zero-Knowledge state transitions on Midnight Blockchain.
Features

    Pre-Prover Semantic Firewall (V-01): Defends autonomous agents from indirect prompt injections and malicious payload expansions.

    Universal Tool Interface: Exposes standard-compliant rohan_zk_handshake tool schema for LLMs in 100% technical English.

    Gasless L1 Anchoring: Routes state commitments through the Rohan Relayer Pool with sponsored $tDUST network gas.

Installation & Setup
Claude Desktop

Add to your claude_desktop_config.json:
code JSON

{
  "mcpServers": {
    "rohan-zk-shield": {
      "command": "npx",
      "args": ["-y", "@rohan-protocol/mcp"],
      "env": {
        "ROHAN_RELAYER_URL": "https://api.rohanprotocol.network/api/v1/handshake",
        "ROHAN_API_KEY": "rohan_live_..."
      }
    }
  }
}

Cursor IDE

Open Settings → Features → MCP Servers → Add New MCP Server:

    Name: rohan-shield

    Type: command

    Command: npx -y @rohan-protocol/mcp

    Environment: ROHAN_API_KEY=rohan_live_...

License

MIT © Rohan Protocol.
