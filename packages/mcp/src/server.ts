#!/usr/bin/env node
declare const process: any;

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { SemanticFirewall } from './firewall.js';
import { RohanClient } from '@rohan-protocol/sdk';

const CONTRACT_ADDRESS = process.env.ROHAN_CONTRACT_ADDRESS || '585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e';
const RELAYER_URL = process.env.ROHAN_RELAYER_URL || 'http://127.0.0.1:4005/api/v1/handshake';
const API_KEY = process.env.ROHAN_API_KEY || '';

const rohanClient = new RohanClient({
  contractAddress: CONTRACT_ADDRESS,
  relayerUrl: RELAYER_URL,
  apiKey: API_KEY,
});

/**
 * ROHAN PROTOCOL MCP SERVER
 * Empowers autonomous LLM agents with native Zero-Knowledge Handshakes via Model Context Protocol.
 */
const server = new Server(
  {
    name: 'rohan-protocol-mcp',
    version: '0.6.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 1. Declare tool schema for LLMs (100% Technical English)
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'rohan_zk_handshake',
        description:
          'Executes a cryptographic zero-knowledge state transition on Midnight Blockchain. Proves an intent, transaction, or inter-agent agreement without exposing confidential parameters.',
        inputSchema: {
          type: 'object',
          properties: {
            agentId: {
              type: 'string',
              description: 'Decentralized Identifier (DID) or identifier of the initiating agent',
            },
            intent: {
              type: 'string',
              description: 'Semantic action plan, payload, or agreement terms to be cryptographically committed',
            },
            counterpartyId: {
              type: 'string',
              description: 'Optional identifier of counterparty agent',
            },
          },
          required: ['agentId', 'intent'],
        },
      },
    ],
  };
});

// 2. Execute tool invocation
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== 'rohan_zk_handshake') {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  const args = request.params.arguments as {
    agentId: string;
    intent: string;
    counterpartyId?: string;
  };

  // A. Semantic Firewall Verification (Security Vector V-01)
  const isValid = SemanticFirewall.validate({
    agentId: args.agentId,
    action: 'rohan_zk_handshake',
    payload: args,
  });

  if (!isValid) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Security Violation: Intent rejected by Semantic Firewall (V-01)',
          }),
        },
      ],
      isError: true,
    };
  }

  try {
    // B. Generate cryptographic commitment & submit via Relayer
    const receipt = await rohanClient.submitHandshake({
      agentId: args.agentId,
      intent: args.intent,
      counterpartyId: args.counterpartyId,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              status: 'success',
              message: 'Zero-Knowledge Handshake successfully settled on Midnight Blockchain.',
              receipt,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (err: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: err.message || 'Handshake execution failed',
          }),
        },
      ],
      isError: true,
    };
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🛡️ Rohan Protocol MCP Server running via stdio (v0.6.0)...');
}

run().catch((error) => {
  console.error('Fatal MCP server error:', error);
  process.exit(1);
});
