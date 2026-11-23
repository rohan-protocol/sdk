#!/usr/bin/env node
declare const process: any;

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { RohanClient, type AgentSigner, type NetworkId } from '@rohan-protocol/sdk';

import { resolveAgentIdentity } from './identity/keystore.js';
import { ROHAN_HANDSHAKE_TOOL_SCHEMA } from './identity/handshake.js';
import { runCli } from './cli.js';
import {
  createRohanMcpServer,
  ROHAN_MCP_VERSION,
  ROHAN_MCP_INSTRUCTIONS,
  ROHAN_EXECUTE_TOOL_WITH_ANNOTATIONS,
  ROHAN_VERIFY_TOOL_SCHEMA,
  ROHAN_LEDGER_STATE_TOOL_SCHEMA,
  ROHAN_HISTORY_TOOL_SCHEMA,
  ROHAN_AGENT_STATUS_TOOL_SCHEMA,
} from './mcp-app.js';

export const ROHAN_EXECUTE_TOOL_SCHEMA = ROHAN_EXECUTE_TOOL_WITH_ANNOTATIONS;

export {
  ROHAN_HANDSHAKE_TOOL_SCHEMA,
  ROHAN_MCP_INSTRUCTIONS,
  ROHAN_EXECUTE_TOOL_WITH_ANNOTATIONS,
  ROHAN_VERIFY_TOOL_SCHEMA,
  ROHAN_LEDGER_STATE_TOOL_SCHEMA,
  ROHAN_HISTORY_TOOL_SCHEMA,
  ROHAN_AGENT_STATUS_TOOL_SCHEMA,
  createRohanMcpServer,
};

function resolveConfiguredNetwork(): NetworkId {
  const raw = (process.env.ROHAN_NETWORK || 'preprod').trim().toLowerCase();
  if (raw !== 'preprod' && raw !== 'testnet' && raw !== 'mainnet') {
    throw new Error(`INVALID_CONFIGURATION: Unsupported ROHAN_NETWORK "${raw}". Expected preprod, testnet, or mainnet.`);
  }
  return raw;
}

async function runStdioServer() {
  const CONTRACT_ADDRESS =
    process.env.ROHAN_CONTRACT_ADDRESS ||
    '585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e';
  const RELAYER_URL =
    process.env.ROHAN_RELAYER_URL || 'https://api.rohanprotocol.network/api/v1/handshake';
  const API_KEY = process.env.ROHAN_API_KEY || '';
  const NETWORK = resolveConfiguredNetwork();

  const loadedIdentity = await resolveAgentIdentity();
  const configuredSigner: AgentSigner = loadedIdentity.signer;

  console.error(`🛡️ [MCP V-08] Agent identity active (${loadedIdentity.source}): ${loadedIdentity.did}`);
  if (loadedIdentity.filePath) {
    console.error(`🛡️ [MCP V-08] Keystore path: ${loadedIdentity.filePath}`);
  }

  const rohanClient = new RohanClient({
    network: NETWORK,
    contractAddress: CONTRACT_ADDRESS,
    relayerUrl: RELAYER_URL,
    apiKey: API_KEY,
    signer: configuredSigner,
  });

  const server = createRohanMcpServer({
    contractAddress: CONTRACT_ADDRESS,
    relayerUrl: RELAYER_URL,
    network: NETWORK,
    rohanClient,
    configuredSigner,
    loadedIdentity,
  });

  const transport = new StdioServerTransport();
  if (process.stdin.isTTY === true) {
    console.error(
      'ℹ️ Interactive terminal detected: running MCP stdio JSON-RPC server (waiting on stdin). For CLI setup or diagnostics, run: npx @rohan-protocol/mcp status'
    );
  }
  await server.connect(transport);
  console.error(`🛡️ Rohan Protocol MCP Server running via stdio (v${ROHAN_MCP_VERSION}, network=${NETWORK})...`);
}

async function main() {
  const cliArgs = process.argv.slice(2);
  if (cliArgs.length > 0 && cliArgs[0] !== '--stdio') {
    const exitCode = await runCli(cliArgs);
    process.exit(exitCode);
    return;
  }
  await runStdioServer();
}

main().catch((error) => {
  console.error('Fatal MCP server error:', error);
  process.exit(1);
});
