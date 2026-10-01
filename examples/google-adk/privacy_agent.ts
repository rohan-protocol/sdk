import { Agent } from '@google/adk';
import { McpToolset } from '@google/adk/tools';

/**
 * Google Agent Development Kit (ADK) – TypeScript Reference Implementation
 * Uses Rohan Protocol MCP for Zero-Knowledge trust and prompt injection shielding.
 */
export async function initializeRohanAgent() {
  const rohanTools = new McpToolset({
    command: 'npx',
    args: ['-y', '@rohan-protocol/mcp@latest'],
    env: {
      ROHAN_CONTRACT_ADDRESS: process.env.ROHAN_CONTRACT_ADDRESS || '585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e',
      ROHAN_RELAYER_URL: process.env.ROHAN_RELAYER_URL || 'https://api.rohanprotocol.network/api/v1/handshake',
      ROHAN_FIREWALL_LEVEL: 'V-01_STRICT'
    }
  });

  const agent = new Agent({
    name: 'RohanPrivacyAgent',
    model: 'gemini-2.5-pro',
    systemPrompt: `You are a privacy-preserving autonomous agent.
Before confirming commitments or exchanging sensitive tokens, invoke rohan_zk_handshake
to generate zero-knowledge cryptographic state transitions on Midnight Network.`,
    tools: [rohanTools]
  });

  return agent;
}
