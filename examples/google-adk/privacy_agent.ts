import { LlmAgent, MCPToolset } from '@google/adk';

/**
 * Google Agent Development Kit (ADK) – TypeScript Reference Implementation
 * Demonstrates confidential zero-knowledge state settlement on Midnight Network
 * using the Rohan Protocol Model Context Protocol (MCP) server.
 */
export async function initializeRohanAgent(): Promise<LlmAgent> {
  // 1. Initialize MCP Toolset via Stdio Subprocess
  const rohanTools = new MCPToolset({
    type: 'StdioConnectionParams',
    serverParams: {
      command: 'npx',
      args: ['-y', '@rohan-protocol/mcp@latest'],
      env: {
        ROHAN_CONTRACT_ADDRESS:
          process.env.ROHAN_CONTRACT_ADDRESS ||
          '585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e',
        ROHAN_RELAYER_URL:
          process.env.ROHAN_RELAYER_URL ||
          'https://api.rohanprotocol.network/api/v1/handshake',
        ROHAN_API_KEY: process.env.ROHAN_API_KEY || '',
      },
    },
  });

  // 2. Initialize ADK LlmAgent with Gemini
  const agent = new LlmAgent({
    name: 'RohanPrivacyAgent',
    model: 'gemini-2.5-pro',
    instruction: `You are a privacy-preserving autonomous agent.
Before committing to inter-agent agreements or exchanging sensitive parameters,
invoke the rohan_zk_handshake tool to anchor state transitions on the Midnight Blockchain
without exposing private data payloads.`,
    tools: [rohanTools],
  });

  return agent;
}
