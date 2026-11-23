import type { AgentSigner } from '@rohan-protocol/sdk';

export const ROHAN_HANDSHAKE_TOOL_SCHEMA = {
  name: 'rohan_execute_handshake',
  description:
    'Executes or locally previews a confidential handshake commitment on Midnight. Usage guidelines:\n- Use for a user-authorized settlement; set dryRun: true only when the user asks to preview, test, or inspect a commitment without on-chain settlement (default false).\n- Do not use for reads, history, status, or audit; use rohan_get_ledger_state, rohan_get_transaction_history, rohan_get_agent_status, or rohan_verify_commitment instead.\n- Keep sensitive values in confidentialPayload, actionSummary generic, and private keys out of tool arguments. Follow recoveryAction on errors; after replay check transaction history, and after signature errors check agent status. Payloads are canonicalized and hashed locally.',
  inputSchema: {
    type: 'object',
    properties: {
      actionSummary: {
        type: 'string',
        minLength: 1,
        description: 'Required public high-level action label.',
      },
      agentId: {
        type: 'string',
        description: "Optional Sovereign Agent DID. Defaults to the local signer's DID and must match it when provided.",
      },
      confidentialPayload: {
        type: 'object',
        description: 'Optional confidential parameters, canonicalized and hashed locally.',
      },
      counterpartyId: {
        type: 'string',
        description: 'Optional counterparty agent identifier.',
      },
      dryRun: {
        type: 'boolean',
        description: 'Only set true when the user asks to preview, test, or inspect the commitment without settling on-chain. Defaults to false.',
      },
      intent: {
        type: 'string',
        deprecated: true,
        description: 'Deprecated alias. actionSummary remains required.',
      },
    },
    required: ['actionSummary'],
    additionalProperties: false,
  },
} as const;

export function validateActionSummary(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return 'INVALID_ARGUMENTS: actionSummary is required and cannot be empty.';
  }
  return undefined;
}

export function validateHandshakeArguments(args: Record<string, unknown>): string | undefined {
  const allowedProperties = new Set([
    'actionSummary',
    'agentId',
    'confidentialPayload',
    'counterpartyId',
    'dryRun',
    'intent',
  ]);
  if (Object.keys(args).some((key) => !allowedProperties.has(key))) {
    return 'INVALID_ARGUMENTS: Handshake arguments contain unsupported properties.';
  }
  if (args.intent !== undefined && typeof args.intent !== 'string') {
    return 'INVALID_ARGUMENTS: Deprecated intent must be a string when provided.';
  }
  if (args.dryRun !== undefined && typeof args.dryRun !== 'boolean') {
    return 'INVALID_ARGUMENTS: dryRun must be a boolean when provided.';
  }
  if (
    args.confidentialPayload !== undefined &&
    (!args.confidentialPayload ||
      typeof args.confidentialPayload !== 'object' ||
      Array.isArray(args.confidentialPayload))
  ) {
    return 'INVALID_ARGUMENTS: confidentialPayload must be a non-null JSON object when provided.';
  }
  return validateActionSummary(args.actionSummary);
}

export function resolveHandshakeAgentId(
  requestedAgentId: unknown,
  signer?: AgentSigner
): { agentId: string } | { error: string } {
  if (signer) {
    if (requestedAgentId === undefined) return { agentId: signer.did };
    if (typeof requestedAgentId !== 'string' || requestedAgentId !== signer.did) {
      return {
        error: 'IDENTITY_MISMATCH: Declared agentId does not match the armed Sovereign Signer DID.',
      };
    }
    return { agentId: signer.did };
  }

  if (typeof requestedAgentId !== 'string' || requestedAgentId.trim().length === 0) {
    return {
      error: 'MISSING_AGENT_ID: An explicit agentId is required when no Sovereign Signer is armed.',
    };
  }
  return { agentId: requestedAgentId };
}
