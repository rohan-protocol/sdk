import type { AgentSigner } from '@rohan-protocol/sdk';

export const ROHAN_HANDSHAKE_TOOL_SCHEMA = {
  name: 'rohan_execute_handshake',
  description:
    'Executes a confidential zero-knowledge state transition on Midnight Blockchain. Confidential parameters are automatically canonicalized (RFC 8785) and hashed in client RAM—never exposed on-chain or in model logs.',
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
    'intent',
  ]);
  if (Object.keys(args).some((key) => !allowedProperties.has(key))) {
    return 'INVALID_ARGUMENTS: Handshake arguments contain unsupported properties.';
  }
  if (args.intent !== undefined && typeof args.intent !== 'string') {
    return 'INVALID_ARGUMENTS: Deprecated intent must be a string when provided.';
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
