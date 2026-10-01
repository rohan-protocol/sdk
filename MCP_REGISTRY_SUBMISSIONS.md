# 🛡️ Rohan Protocol v0.6.0 – Universal MCP & WebMCP Listing & Registration Kit

This document provides the turnkey submissions, PR templates, manifest files, and commands to list **Rohan Protocol** across **all** major Model Context Protocol (MCP) registries, directories, and agent ecosystems (Anthropic, Smithery, Google ADK, Antigravity, Glama, PulseMCP, and WebMCP).

---

## 📋 Registry Submission Matrix Overview

| Platform / Registry | Listing Mechanism | Status / Action Required | Primary URL |
| :--- | :--- | :--- | :--- |
| **Official MCP Registry** (Anthropic/Linux Foundation) | `server.json` + `mcp-publisher` CLI | Ready (`server.json` created in root) | [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io) |
| **Smithery.ai** | `smithery.yaml` + GitHub connect / CLI | Ready (`smithery.yaml` + `Dockerfile`) | [smithery.ai/add](https://smithery.ai/add) |
| **Google ADK** (Agent Dev Kit) | `McpToolset` integration / Package | Native adapter ready (`@rohan-protocol/mcp`) | [adk.dev](https://adk.dev) |
| **Google Antigravity** | Local MCP directory / tool schema | Schema & instructions generated | `~/.gemini/antigravity/mcp/` |
| **Awesome-MCP-Servers** (`punkpeye`) | GitHub PR to `punkpeye/awesome-mcp-servers` | PR template & snippet ready below | [github.com/punkpeye/awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers) |
| **Glama.ai MCP Registry** | Web form submission | Instant submission via GitHub URL | [glama.ai/mcp/servers](https://glama.ai/mcp/servers) |
| **PulseMCP & MCPBundles** | Web submission & config schema | Registry entry prepared | [pulsemcp.com](https://pulsemcp.com) |
| **WebMCP Ecosystem** | Browser-native package (`@rohan-protocol/webmcp`) | v0.6.0 npm published with WebMCP tags | [npmjs.com/package/@rohan-protocol/webmcp](https://www.npmjs.com) |

---

## 1. 🌐 Official Model Context Protocol Registry (Anthropic / MCP Foundation)

The official registry indexes servers using the root `server.json` manifest.

### Root Manifest: `server.json`
The repository root contains the schema-compliant `server.json`:
```json
{
  "$schema": "https://static.modelcontextprotocol.io/schema/server.json",
  "name": "@rohan-protocol/mcp",
  "version": "0.6.0",
  "description": "Stateless zero-knowledge trust gateway and WebMCP shield for autonomous AI agents on Midnight Network.",
  "repository": {
    "type": "git",
    "url": "https://github.com/rohan-protocol/rohan.git"
  },
  "homepage": "https://rohanprotocol.network",
  "license": "MIT",
  "runtime": "node",
  "entrypoint": "packages/mcp/dist/server.js",
  "transport": "stdio",
  "tags": [
    "zero-knowledge",
    "privacy",
    "security",
    "midnight-network",
    "handshake",
    "ai-agents",
    "webmcp"
  ],
  "environment": {
    "ROHAN_CONTRACT_ADDRESS": "585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e",
    "ROHAN_RELAYER_URL": "https://api.rohanprotocol.network/api/v1/handshake"
  }
}
```

### Action to Publish:
Run the official publisher tool from the repository root:
```bash
npx @modelcontextprotocol/publisher@latest publish
```
Or submit a PR to [`modelcontextprotocol/registry`](https://github.com/modelcontextprotocol/registry) adding `@rohan-protocol/mcp` to the indexed servers list.

---

## 2. ⚡ Smithery.ai Marketplace & Registry

Smithery powers one-click MCP installations for Claude Desktop, Cursor, and cloud agents.

### Configuration Files Present in Root:
- `smithery.yaml` (Defines stdio execution, parameters, and contract endpoints)
- `Dockerfile` (Provides containerized execution for Smithery Cloud)

### Actions to List on Smithery:
1. **Web Submission (Instant)**:
   - Visit: [https://smithery.ai/add](https://smithery.ai/add)
   - Connect GitHub account and select repository: `rohan-protocol/rohan` (or your GitHub fork/org).
   - Smithery automatically detects `smithery.yaml`, verifies the build, and publishes the listing.
2. **CLI Publication**:
   ```bash
   npx -y @smithery/cli@latest publish
   ```

---

## 3. ⭐ `punkpeye/awesome-mcp-servers` Pull Request (The #1 MCP List)

This repository (10k+ stars) is the primary directory used by the global AI agent community.

### PR Details:
- **Target Repo**: [`punkpeye/awesome-mcp-servers`](https://github.com/punkpeye/awesome-mcp-servers)
- **Target Section**: Add under `### Security & Privacy` or `### Blockchain & Web3`
- **PR Title**: `Add Rohan Protocol - Zero-Knowledge Trust Gateway for AI Agents`

### Markdown Entry to Add to `README.md`:
```markdown
- [Rohan Protocol](https://github.com/rohan-protocol/rohan) 🔏 ☁️ - Stateless Zero-Knowledge Handshake gateway and WebMCP semantic firewall for autonomous AI agents on Midnight Network.
```

### PR Description Body:
```markdown
### Summary of Changes
Added Rohan Protocol to the Security & Privacy / Web3 section.

- **Name**: Rohan Protocol
- **Repository**: https://github.com/rohan-protocol/rohan
- **Description**: Zero-Knowledge state transition and trust gateway enabling autonomous agents to execute private handshakes, verify identities, and shield web inputs without plaintext parameter leaks.
- **Transports**: `stdio`, `streamable-http`
- **Supported Ecosystems**: Claude Desktop, Cursor, Google ADK, Antigravity, WebMCP
```

---

## 4. 🤖 Google ADK (Agent Development Kit) & Gemini Ecosystem

Google ADK agents connect to MCP servers using `McpToolset`.

### Python Integration Snippet (Google ADK):
```python
from google.adk.agents import Agent
from google.adk.tools import McpToolset

# Initialize Rohan Protocol Zero-Knowledge MCP Gateway
rohan_zk_toolset = McpToolset(
    command="npx",
    args=["-y", "@rohan-protocol/mcp@latest"],
    env={
        "ROHAN_CONTRACT_ADDRESS": "585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e",
        "ROHAN_RELAYER_URL": "https://api.rohanprotocol.network/api/v1/handshake"
    }
)

# Connect to autonomous agent
agent = Agent(
    model="gemini-2.5-pro",
    name="PrivacyPreservingAgent",
    instruction="Execute cross-agent agreements and commitments strictly via Rohan ZK Handshakes.",
    tools=[rohan_zk_toolset]
)
```

### TypeScript Integration Snippet (Google ADK / GenAI):
```typescript
import { McpToolset } from '@google/adk';

export const rohanMcpTools = new McpToolset({
  command: 'npx',
  args: ['-y', '@rohan-protocol/mcp@latest'],
  env: {
    ROHAN_CONTRACT_ADDRESS: '585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e',
    ROHAN_RELAYER_URL: 'https://api.rohanprotocol.network/api/v1/handshake'
  }
});
```

---

## 5. 🚀 Google Antigravity Integration

To enable Google Antigravity to discover and use Rohan MCP directly in pairing sessions:

Create directory: `C:\Users\jette\.gemini\antigravity\mcp\rohan-protocol\`
With tool definition: `rohan_zk_handshake.json`:
```json
{
  "name": "rohan_zk_handshake",
  "description": "Executes a cryptographic zero-knowledge state transition on Midnight Blockchain. Proves an intent, transaction, or inter-agent agreement without exposing confidential parameters.",
  "parameters": {
    "type": "object",
    "properties": {
      "agentId": {
        "type": "string",
        "description": "Decentralized Identifier (DID) or identifier of the initiating agent"
      },
      "intent": {
        "type": "string",
        "description": "Semantic action plan, payload, or agreement terms to be cryptographically committed"
      },
      "counterpartyId": {
        "type": "string",
        "description": "Optional identifier of counterparty agent"
      }
    },
    "required": ["agentId", "intent"]
  }
}
```

---

## 6. 🌐 Glama.ai Registry (`glama.ai/mcp/servers`)

Glama is one of the most active web directories for MCP servers.

### Submission Steps:
1. Navigate to: [https://glama.ai/mcp/servers](https://glama.ai/mcp/servers)
2. Click **"Add MCP Server"**.
3. Input Details:
   - **Repository URL**: `https://github.com/rohan-protocol/rohan`
   - **Display Name**: `Rohan Protocol ZK-Gateway`
   - **Description**: `Zero-Knowledge trust gateway and WebMCP semantic firewall for autonomous AI agents on Midnight Network.`
   - **Primary Categories**: `Security`, `Blockchain`, `Developer Tools`
4. Submit for automatic scanning.

---

## 7. 🛡️ WebMCP & In-Browser AI Agents Ecosystem

WebMCP standardizes tool execution directly inside browser environments (e.g. Chrome Built-in AI / Prompt API, WebLLM, React apps).

### npm Package Discovery Tags:
Ensure `@rohan-protocol/webmcp` package.json contains these search keywords:
```json
"keywords": [
  "webmcp",
  "mcp",
  "model-context-protocol",
  "browser-mcp",
  "zero-knowledge",
  "midnight-network",
  "zk-handshake",
  "prompt-injection-firewall",
  "chrome-ai"
]
```

### Universal Browser Agent Usage:
```tsx
import { RohanWebMcpProvider, useRohanWebMcp } from '@rohan-protocol/webmcp';

// Wraps any web agent UI with the Zero-Knowledge & Semantic Firewall shield
<RohanWebMcpProvider contractAddress="585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e">
  <AgentChatApp />
</RohanWebMcpProvider>
```

---

## 8. 💻 Universal Client Configuration Snippets

### Claude Desktop (`claude_desktop_config.json`) / Cursor (`mcp.json`):
```json
{
  "mcpServers": {
    "rohan-protocol": {
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
