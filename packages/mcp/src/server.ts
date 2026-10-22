#!/usr/bin/env node
declare const process: any;

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { SemanticFirewall } from './firewall.js';
import { RohanClient, sealActionIntent } from '@rohan-protocol/sdk';

const CONTRACT_ADDRESS = process.env.ROHAN_CONTRACT_ADDRESS || '585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e';
const RELAYER_URL = process.env.ROHAN_RELAYER_URL || 'https://api.rohanprotocol.network/api/v1/handshake';
const API_KEY = process.env.ROHAN_API_KEY || '';

const rohanClient = new RohanClient({
  contractAddress: CONTRACT_ADDRESS,
  relayerUrl: RELAYER_URL,
  apiKey: API_KEY,
});

const server = new Server(
  {
    name: 'rohan-protocol-mcp',
    version: '0.6.1',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

export const ROHAN_TOOL_SCHEMA = {
  name: 'rohan_zk_handshake',
  description:
    'Executes a confidential zero-knowledge state transition on Midnight Blockchain. Confidential parameters are automatically canonicalized (RFC 8785) and hashed in client RAM—never exposed on-chain or in model logs.',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: {
        type: 'string',
        description: 'Decentralized Identifier (DID) of the initiating agent',
      },
      actionSummary: {
        type: 'string',
        description: "Public high-level action label (e.g. 'Vendor Agreement Execution', 'Database Audit Anchor')",
      },
      confidentialPayload: {
        type: 'object',
        description: 'OPTIONAL confidential parameters (budgets, deals, PII). Automatically canonicalized via RFC 8785 and hashed in local memory.',
      },
      counterpartyId: {
        type: 'string',
        description: 'Optional counterparty agent identifier',
      },
      intent: {
        type: 'string',
        description: 'Legacy fallback for actionSummary',
      },
    },
    required: ['agentId'],
  },
};

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: [ROHAN_TOOL_SCHEMA] };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== 'rohan_zk_handshake') {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  const args = request.params.arguments as {
    agentId: string;
    actionSummary?: string;
    confidentialPayload?: Record<string, unknown>;
    counterpartyId?: string;
    intent?: string;
  };

  const actionLabel = args.actionSummary || args.intent;
  if (!actionLabel) {
    throw new Error('Invalid arguments: Either actionSummary or intent is required.');
  }

  const isValid = SemanticFirewall.validate({
    agentId: args.agentId,
    action: 'rohan_zk_handshake',
    payload: args,
  });

  if (!isValid) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Security Violation: Intent rejected by Semantic Firewall (V-01)' }) }],
      isError: true,
    };
  }

  try {
    // Elegant & DRY: SDK handles RFC 8785 canonicalization and RAM hashing
    const finalIntent = sealActionIntent(actionLabel, args.confidentialPayload);

    const receipt = await rohanClient.submitHandshake({
      agentId: args.agentId,
      intent: finalIntent,
      counterpartyId: args.counterpartyId,
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          status: 'success',
          message: 'Zero-Knowledge Handshake successfully settled on Midnight Blockchain.',
          receipt,
        }, null, 2),
      }],
    };
  } catch (err: any) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, error: err.message || 'Handshake execution failed' }) }],
      isError: true,
    };
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🛡️ Rohan Protocol MCP Server running via stdio (v0.6.1)...');
}

run().catch((error) => {
  console.error('Fatal MCP server error:', error);
  process.exit(1);
});
