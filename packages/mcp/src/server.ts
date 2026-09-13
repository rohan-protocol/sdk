#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { SemanticFirewall } from './firewall.js';
import { RohanClient } from '../../sdk/dist/index.js';

// Midnight Preprod Contract Adresse
const CONTRACT_ADDRESS = process.env.ROHAN_CONTRACT_ADDRESS || '6d2d603235f996424d76c85186a79cc403245ea8ee1ba9087e40967fe71bdc4d';
const RELAYER_URL = process.env.ROHAN_RELAYER_URL || 'http://127.0.0.1:4005/api/v1/handshake';

const rohanClient = new RohanClient(CONTRACT_ADDRESS);

/**
 * 🛡️ ROHAN PROTOCOL MCP SERVER
 * Ermöglicht KI-Agenten native Zero-Knowledge Handshakes über das Model Context Protocol.
 */
const server = new Server(
  {
    name: 'rohan-protocol-mcp',
    version: '0.5.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 1. Tool-Liste für LLMs deklarieren
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'rohan_zk_handshake',
        description:
          'Führt einen kryptographischen Zero-Knowledge Handshake auf der Midnight Blockchain aus. Beweist einen Intent oder eine Vereinbarung zwischen Agenten ohne Preisgabe vertraulicher Inhalte.',
        inputSchema: {
          type: 'object',
          properties: {
            agentId: {
              type: 'string',
              description: 'Die dezentrale Identität (DID) oder ID des initiierenden Agenten',
            },
            intent: {
              type: 'string',
              description: 'Der semantische Aktionsplan oder Vereinbarungsinhalt, der im ZK-Proof versiegelt wird',
            },
            counterpartyId: {
              type: 'string',
              description: 'Optionale ID des Empfänger-Agenten',
            },
          },
          required: ['agentId', 'intent'],
        },
      },
    ],
  };
});

// 2. Tool-Aufruf ausführen
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== 'rohan_zk_handshake') {
    throw new Error(`Unbekanntes Tool: ${request.params.name}`);
  }

  const args = request.params.arguments as {
    agentId: string;
    intent: string;
    counterpartyId?: string;
  };

  // A. Semantic Firewall Prüfung (Sicherheits-Vektor V-01)
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
    // B. ZK-Proof im Client-RAM generieren (inkl. V-02 Memory Sanitation!)
    const proofData = await rohanClient.generateHandshakeProof({
      agentId: args.agentId,
      intent: args.intent,
    });

    // C. Proof an Relayer (Gas Station) übermitteln
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (process.env.ROHAN_API_KEY) {
      headers['x-rohan-api-key'] = process.env.ROHAN_API_KEY;
    }

    const response = await fetch(RELAYER_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(proofData),
    });

    const receipt = await response.json();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              status: 'success',
              message: 'Zero-Knowledge Handshake erfolgreich auf Midnight Blockchain verankert!',
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
  console.error('🛡️ Rohan Protocol MCP Server läuft via Stdio...');
}

run().catch((error) => {
  console.error('Fataler Serverfehler:', error);
  process.exit(1);
});
