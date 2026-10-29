#!/usr/bin/env node
declare const process: any;

import crypto from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { SemanticFirewall } from './firewall.js';
import { RohanClient, sealActionIntent, canonicalizeJson } from '@rohan-protocol/sdk';

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
    version: '0.7.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ── Tool 1 Schema: Write / Settlement ───────────────────────────────────────
export const ROHAN_HANDSHAKE_TOOL_SCHEMA = {
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

// ── Tool 2 Schema: Audit / In-Memory Verification ───────────────────────────
export const ROHAN_VERIFY_TOOL_SCHEMA = {
  name: 'rohan_verify_commitment',
  description:
    'Cryptographically audits and verifies whether a plaintext payload matches an on-chain commitment using RFC 8785 JSON Canonicalization and SHA-256. Zero gas cost, executes instantly in local RAM.',
  inputSchema: {
    type: 'object',
    properties: {
      payload: {
        type: 'object',
        description: 'The plaintext contract, agreement, or intent data to be verified.',
      },
      expectedDigest: {
        type: 'string',
        pattern: '^(?:sha256:|0x)?[0-9a-fA-F]{64}$',
        description: 'The 64-character hexadecimal SHA-256 intent commitment (accepts raw hex, 0x, or sha256: prefixes).',
      },
    },
    required: ['payload', 'expectedDigest'],
  },
};

// ── Tool 3 Schema: Read / Ledger State Inspection ───────────────────────────
export const ROHAN_LEDGER_STATE_TOOL_SCHEMA = {
  name: 'rohan_get_ledger_state',
  description:
    'Reads the current anchored state of the Rohan Protocol smart contract on Midnight Preprod L1. Returns the state root, block height, and last mined transaction hash from memory cache.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      ROHAN_HANDSHAKE_TOOL_SCHEMA,
      ROHAN_VERIFY_TOOL_SCHEMA,
      ROHAN_LEDGER_STATE_TOOL_SCHEMA,
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;

  const rawArgs = request.params?.arguments;
  if (!rawArgs || typeof rawArgs !== 'object' || Array.isArray(rawArgs)) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'INVALID_ARGUMENTS: Expected a valid arguments object.' }) }],
      isError: true,
    };
  }
  const args = rawArgs as Record<string, any>;

  // ── Tool 1: rohan_zk_handshake ────────────────────────────────────────────
  if (toolName === 'rohan_zk_handshake') {
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
  }

  // ── Tool 2: rohan_verify_commitment ───────────────────────────────────────
  if (toolName === 'rohan_verify_commitment') {
    // Payload-Size-Guard (Max 256 KB im RAM)
    const payloadString = JSON.stringify(args.payload);
    if (payloadString.length > 256 * 1024) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'PAYLOAD_TOO_LARGE: Plaintext exceeds maximum allowed size of 256 KB.' }) }],
        isError: true,
      };
    }
    if (!args.payload || typeof args.payload !== 'object' || Array.isArray(args.payload)) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Invalid argument: payload must be a non-null object.' }) }],
        isError: true,
      };
    }

    if (!args.expectedDigest || typeof args.expectedDigest !== 'string') {
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Invalid argument: expectedDigest must be a string.' }) }],
        isError: true,
      };
    }

    try {
      // LLM Prefix Tolerance: Strips 'sha256:' or '0x'
      const normalizedExpected = args.expectedDigest.replace(/^(?:sha256:|0x)/i, '').toLowerCase();

      if (!/^[0-9a-f]{64}$/.test(normalizedExpected)) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Invalid expectedDigest: must resolve to a 64-character hexadecimal SHA-256 hash.' }) }],
          isError: true,
        };
      }

      // Single Source of Truth: Canonicalization via @rohan-protocol/sdk
      const canonicalPayload = canonicalizeJson(args.payload);
      const computedDigest = crypto.createHash('sha256').update(canonicalPayload, 'utf8').digest('hex').toLowerCase();
      const match = computedDigest === normalizedExpected;

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'success',
            valid: match,
            match,
            expectedDigest: normalizedExpected,
            computedDigest,
            algorithm: 'SHA-256 (RFC 8785 JCS)',
            verifiedAt: Date.now(),
          }, null, 2),
        }],
      };
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: false, error: err.message || 'Verification execution failed' }) }],
        isError: true,
      };
    }
  }

  // ── Tool 3: rohan_get_ledger_state ────────────────────────────────────────
  if (toolName === 'rohan_get_ledger_state') {
    try {
      const ledgerState = await rohanClient.getLedgerState();
      const cacheAgeMs = Date.now() - (ledgerState.fetchedAt || Date.now());

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'success',
            contractAddress: ledgerState.contractAddress,
            currentStateRoot: ledgerState.currentStateRoot,
            blockHeight: ledgerState.blockHeight ?? null,
            lastTxHash: ledgerState.lastTxHash ?? null,
            network: ledgerState.network || 'midnight-preprod',
            isMinedOnChain: ledgerState.isMinedOnChain ?? true,
            cacheAgeMs: (ledgerState as any).cacheAgeMs ?? cacheAgeMs,
            cacheTtlMs: (ledgerState as any).cacheTtlMs ?? 15000,
            fetchedAt: ledgerState.fetchedAt,
          }, null, 2),
        }],
      };
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: false, error: err.message || 'Failed to fetch ledger state' }) }],
        isError: true,
      };
    }
  }

  throw new Error(`Unknown tool: ${toolName}`);
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🛡️ Rohan Protocol MCP Server running via stdio (v0.7.0)...');
}

run().catch((error) => {
  console.error('Fatal MCP server error:', error);
  process.exit(1);
});
