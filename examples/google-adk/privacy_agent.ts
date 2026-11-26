import { LlmAgent, MCPToolset } from '@google/adk';

/**
 * Google Agent Development Kit (ADK) — TypeScript Reference Implementation (v0.8.3)
 * Demonstrates Ed25519 did:key request signing, local RFC 8785 SHA-256 commitments,
 * and gas-free Midnight Preprod (Ledger v9) anchoring via @rohan-protocol/mcp.
 */

export async function initializeRohanAgent(): Promise<{
  agent: LlmAgent;
  close: () => Promise<void>;
}> {
  // Preserve PATH, HOME/USERPROFILE, and optional ROHAN_AGENT_PRIVATE_KEY without undefined values
  const baseEnv = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string'
    )
  );

  // 1. Initialize MCP Toolset via Stdio Subprocess
  const rohanTools = new MCPToolset({
    type: 'StdioConnectionParams',
    serverParams: {
      command: 'npx',
      args: ['-y', '--package', '@rohan-protocol/mcp@0.8.3', 'rohan-shield'],
      env: {
        ...baseEnv,
        ROHAN_NETWORK: process.env.ROHAN_NETWORK || 'preprod',
        ROHAN_CONTRACT_ADDRESS:
          process.env.ROHAN_CONTRACT_ADDRESS ||
          '585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e',
        ROHAN_RELAYER_URL:
          process.env.ROHAN_RELAYER_URL ||
          'https://api.rohanprotocol.network/api/v1/handshake',
        ...(process.env.ROHAN_API_KEY ? { ROHAN_API_KEY: process.env.ROHAN_API_KEY } : {}),
      },
    },
  });

  // 2. Initialize ADK LlmAgent with Gemini
  const agent = new LlmAgent({
    name: 'RohanPrivacyAgent',
    model: 'gemini-2.5-pro',
    instruction: `You are a privacy-preserving autonomous B2B agent using Rohan Protocol.
When negotiating agreements, budgets, or cross-agent commitments, NEVER place sensitive figures,
counterparties, or PII inside \`actionSummary\` — keep \`actionSummary\` generic and place all
confidential fields inside \`confidentialPayload\`.
Invoke \`rohan_execute_handshake\` (omit \`agentId\` so the local Ed25519 did:key signer is used)
to anchor commitments on Midnight Preprod, and \`rohan_verify_commitment\` to audit bundles offline.`,
    tools: [rohanTools],
  });

  return {
    agent,
    close: async () => {
      await rohanTools.close();
    },
  };
}
