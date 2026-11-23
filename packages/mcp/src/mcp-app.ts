import crypto from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  RohanClient,
  sealActionIntent,
  computePayloadDigest,
  extractSealedIntentParts,
  canonicalizeJson,
  verifyAuditBundle,
  type AgentSigner,
  type NetworkId,
  type RohanAuditBundle,
} from '@rohan-protocol/sdk';

import { SemanticFirewall } from './firewall.js';
import {
  resolveHandshakeAgentId,
  ROHAN_HANDSHAKE_TOOL_SCHEMA,
  validateHandshakeArguments,
} from './identity/handshake.js';
import type { LoadedAgentIdentity } from './identity/keystore.js';

export const ROHAN_MCP_VERSION = '0.8.3';

export const ROHAN_MCP_INSTRUCTIONS = `
Rohan Protocol provides gas-free confidential commitments and Ed25519 (W3C did:key) non-repudiation on Midnight Network (Ledger v9).

CORE RULES FOR AGENTS:
1. PRIVACY BOUNDARY: Always place sensitive parameters (budgets, prices, counterparties, PII, contract terms) inside \`confidentialPayload\`. Keep \`actionSummary\` generic and non-sensitive (e.g., "Vendor Procurement Authorization").
2. PRIVATE KEYS: Never ask the user for private keys or pass private keys in tool arguments. Local stdio identity is managed automatically (~/.rohan/agent-identity.json or ROHAN_AGENT_PRIVATE_KEY). Do not invent an \`agentId\` when a local signer is active.
3. IDENTITY & STATUS: To check your active \`did:key\`, network, or relayer health, read \`rohan://identity\` or call \`rohan_get_agent_status\`.
4. AUDIT VERIFICATION: \`rohan_verify_commitment\` checks plaintext against the **inner \`payloadDigest\`** (RFC 8785 JCS + SHA-256, referenced in \`actionSummary\` or \`auditBundle.payloadDigest\`), NOT the outer timestamp-salted \`intentHash\`. You can also pass an entire \`auditBundle\` to verify signature and binding offline.
5. DRY RUN: Use \`dryRun: true\` only when the user explicitly asks to preview, test, or inspect a commitment without settling on-chain. The default is \`false\`; dry runs create no transaction and no \`txHash\`.
6. ERROR RECOVERY:
   - \`REPLAY_DETECTED\` (409): Do NOT retry the same payload/nonce. Call \`rohan_get_transaction_history\` to inspect existing settlements.
   - \`STALE_TIMESTAMP\` (401): Retry with a fresh tool invocation.
   - \`INVALID_SIGNATURE\` (401): Call \`rohan_get_agent_status\` to verify the active identity and relayer status before retrying.
   - \`IDENTITY_MISMATCH\` (403): Omit \`agentId\` so the active signer's DID is used automatically.
`.trim();

// ── Tool Schemas with MCP Annotations ───────────────────────────────────────

export const ROHAN_EXECUTE_TOOL_WITH_ANNOTATIONS = {
  ...ROHAN_HANDSHAKE_TOOL_SCHEMA,
  annotations: {
    title: 'Execute Confidential ZK Handshake',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
};

export const ROHAN_VERIFY_TOOL_SCHEMA = {
  name: 'rohan_verify_commitment',
  description:
    'Cryptographically audits a plaintext payload and/or a portable RohanAuditBundle offline in local memory (0 gas). Usage guidelines:\n- Use to verify a payload digest or audit bundle; do not use to submit a handshake (use rohan_execute_handshake).\n- For expectedDigest mode provide the exact original JSON payload and the inner payloadDigest; never pass the outer timestamp-salted intentHash. For auditBundle mode, provide the complete bundle and optionally the original payload.\n- Verification is local and does not send plaintext to the relayer. Treat valid: false as a cryptographic mismatch, not a tool execution error; use recoveryAction to correct inputs.',
  inputSchema: {
    type: 'object',
    properties: {
      payload: {
        type: 'object',
        description: 'Plaintext contract, agreement, or confidential data object to verify.',
      },
      expectedDigest: {
        type: 'string',
        pattern: '^(?:sha256:|0x)?[0-9a-fA-F]{64}$',
        description: 'Expected inner SHA-256 digest of the canonicalized payload (from actionSummary digest: sha256:<hash> or auditBundle.payloadDigest). Accepts raw hex, 0x, or sha256: prefixes.',
      },
      auditBundle: {
        type: 'object',
        description: 'Optional portable RohanAuditBundle (schema: rohan-audit-bundle/v1) returned by rohan_execute_handshake. Verifies Ed25519 signature, intentHash binding, and payloadDigest.',
      },
    },
    required: [],
  },
  annotations: {
    title: 'Verify Commitment & Audit Bundle',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};

export const ROHAN_LEDGER_STATE_TOOL_SCHEMA = {
  name: 'rohan_get_ledger_state',
  description:
    'Reads the current anchored Rohan Protocol contract state on Midnight. Usage guidelines:\n- Use for the latest state root, block height, or last transaction hash; do not use for transaction lists (use rohan_get_transaction_history) or identity/relayer health (use rohan_get_agent_status).\n- This is a read-only network lookup; do not include confidential payloads. If unavailable, check rohan_get_agent_status before retrying.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  annotations: {
    title: 'Get Midnight Ledger State',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
};

export const ROHAN_HISTORY_TOOL_SCHEMA = {
  name: 'rohan_get_transaction_history',
  description:
    'Lists historical Rohan Protocol settlement transactions and receipts on Midnight. Usage guidelines:\n- Use to find or inspect prior settlements, especially after REPLAY_DETECTED; do not use for the latest state root (use rohan_get_ledger_state) or identity/health (use rohan_get_agent_status).\n- This read-only lookup accepts no confidential payload. If it fails, check rohan_get_agent_status and follow the returned error guidance.',
  inputSchema: {
    type: 'object',
    properties: {
      limit: {
        type: 'integer',
        description: 'Maximum number of historical transactions to return (default: 10, max: 50).',
      },
    },
  },
  annotations: {
    title: 'Get Transaction History',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
};

export const ROHAN_AGENT_STATUS_TOOL_SCHEMA = {
  name: 'rohan_get_agent_status',
  description:
    'Returns the active Sovereign Agent identity (W3C did:key), signing mode, configured network, and relayer reachability (gracefully degrades if offline). Usage guidelines:\n- Use to inspect local identity or diagnose connectivity and signature errors; do not use for transaction details (use rohan_get_transaction_history) or full ledger state (use rohan_get_ledger_state).\n- Never exposes private keys. Do not send secrets as arguments; if offline, inspect configuration and retry only after recovery.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  annotations: {
    title: 'Get Sovereign Agent Status',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
};

// ── Response Builders (Always provide both content[] and structuredContent) ──

function buildSuccessResult(payload: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
  };
}

function buildErrorResult(
  code: string,
  message: string,
  retryable: boolean,
  recoveryAction: string
) {
  const payload = {
    success: false,
    code,
    retryable,
    error: message,
    recoveryAction,
  };
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
    isError: true,
  };
}

function classifyRelayerError(errMessage: string) {
  const msg = errMessage || 'Unknown execution error';
  if (/nonce.*already.*used|REPLAY_DETECTED|409/i.test(msg)) {
    return buildErrorResult(
      'REPLAY_DETECTED',
      msg,
      false,
      'Nonce already consumed. Call rohan_get_transaction_history to retrieve the existing settlement receipt instead of retrying.'
    );
  }
  if (/STALE_TIMESTAMP|timestamp.*skew|window/i.test(msg)) {
    return buildErrorResult(
      'STALE_TIMESTAMP',
      msg,
      true,
      'Request timestamp fell outside the allowed ±5 minute clock window. Retry with a fresh tool invocation.'
    );
  }
  if (/IDENTITY_MISMATCH|SIGNER_MISMATCH/i.test(msg)) {
    return buildErrorResult(
      'IDENTITY_MISMATCH',
      msg,
      false,
      'Omit agentId so the active signer DID is injected automatically, or pass the exact DID from rohan://identity.'
    );
  }
  if (/INVALID_SIGNATURE|UNAUTHORIZED|AUTHENTICATION_FAILED|401/i.test(msg)) {
    return buildErrorResult(
      'INVALID_SIGNATURE',
      msg,
      false,
      'Ed25519 signature verification failed on the relayer. Call rohan_get_agent_status to verify active DID, network alignment, and local keystore integrity.'
    );
  }
  if (/QUEUE_CAPACITY|503|RELAYER_OVERLOADED/i.test(msg)) {
    return buildErrorResult(
      'RELAYER_BUSY',
      msg,
      true,
      'Relayer settlement queue is temporarily full. Wait 5 seconds and retry.'
    );
  }
  return buildErrorResult(
    'EXECUTION_FAILED',
    msg,
    false,
    'Inspect the error details and verify network connectivity or arguments before retrying.'
  );
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

// ── Server Factory ──────────────────────────────────────────────────────────

export interface CreateRohanMcpServerOptions {
  contractAddress: string;
  relayerUrl: string;
  network?: NetworkId;
  rohanClient: RohanClient;
  configuredSigner?: AgentSigner;
  loadedIdentity?: Pick<LoadedAgentIdentity, 'did' | 'source' | 'filePath'>;
  statusTimeoutMs?: number;
}

export function createRohanMcpServer(options: CreateRohanMcpServerOptions): Server {
  const {
    contractAddress,
    relayerUrl,
    network = 'preprod',
    rohanClient,
    configuredSigner,
    loadedIdentity,
    statusTimeoutMs = 8500,
  } = options;

  const cleanRelayerOrigin = relayerUrl.replace(/\/api\/v1\/handshake(?:\/stream)?$/, '');

  const getIdentitySnapshot = () => ({
    agentDid: configuredSigner?.did ?? loadedIdentity?.did ?? null,
    signingMode: configuredSigner ? 'ed25519' : 'unsigned',
    identitySource: loadedIdentity?.source ?? (configuredSigner ? 'injected' : 'remote-gateway'),
    keystorePath: loadedIdentity?.filePath ?? null,
    network: `midnight-${network}`,
    contractAddress,
    relayerUrl: cleanRelayerOrigin,
  });

  const server = new Server(
    {
      name: 'rohan-shield',
      version: ROHAN_MCP_VERSION,
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
      instructions: ROHAN_MCP_INSTRUCTIONS,
    }
  );

  // ── Resources ─────────────────────────────────────────────────────────────

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: 'rohan://identity',
          name: 'Rohan Sovereign Agent Identity',
          description:
            'Read-only metadata describing the active Ed25519 W3C did:key identity, signing mode, keystore path, and Midnight contract context.',
          mimeType: 'application/json',
        },
      ],
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    if (request.params.uri !== 'rohan://identity') {
      throw new Error(`Resource not found: ${request.params.uri}`);
    }
    return {
      contents: [
        {
          uri: 'rohan://identity',
          mimeType: 'application/json',
          text: JSON.stringify(getIdentitySnapshot(), null, 2),
        },
      ],
    };
  });

  // ── Tools Discovery ───────────────────────────────────────────────────────

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        ROHAN_EXECUTE_TOOL_WITH_ANNOTATIONS,
        ROHAN_LEDGER_STATE_TOOL_SCHEMA,
        ROHAN_HISTORY_TOOL_SCHEMA,
        ROHAN_VERIFY_TOOL_SCHEMA,
        ROHAN_AGENT_STATUS_TOOL_SCHEMA,
      ],
    };
  });

  // ── Tool Execution ────────────────────────────────────────────────────────

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const rawArgs = request.params?.arguments === undefined ? {} : request.params.arguments;

    if (!rawArgs || typeof rawArgs !== 'object' || Array.isArray(rawArgs)) {
      return buildErrorResult(
        'INVALID_ARGUMENTS',
        'Expected a valid arguments object.',
        true,
        'Pass a JSON object as tool arguments (or omit arguments for parameterless read tools).'
      );
    }
    const args = rawArgs as Record<string, any>;

    // ── Tool 1: rohan_execute_handshake (legacy alias: rohan_zk_handshake) ──
    if (toolName === 'rohan_execute_handshake' || toolName === 'rohan_zk_handshake') {
      const argumentsError = validateHandshakeArguments(args);
      if (argumentsError) {
        return buildErrorResult(
          'INVALID_ARGUMENTS',
          argumentsError,
          true,
          'Provide a non-empty actionSummary string and an object for confidentialPayload (if included).'
        );
      }

      const identity = resolveHandshakeAgentId(args.agentId, configuredSigner);
      if ('error' in identity) {
        return buildErrorResult(
          'IDENTITY_MISMATCH',
          identity.error,
          false,
          'Omit agentId so the active signer DID is used automatically, or supply the exact DID from rohan://identity.'
        );
      }
      const effectiveAgentId = identity.agentId;
      const actionLabel = args.actionSummary;

      const isValid = SemanticFirewall.validate({
        agentId: effectiveAgentId,
        action: 'rohan_execute_handshake',
        payload: args,
      });

      if (!isValid) {
        return buildErrorResult(
          'FIREWALL_REJECTED',
          'Security Violation: Intent rejected by Semantic Firewall (V-01)',
          false,
          'Ensure actionSummary and confidentialPayload contain valid, non-malicious content under 8 KB.'
        );
      }

      try {
        const finalIntent = sealActionIntent(actionLabel, args.confidentialPayload);

        if (args.dryRun === true) {
          const commitment = await rohanClient.generateHandshakeProof({
            agentId: effectiveAgentId,
            intent: finalIntent,
            counterpartyId: args.counterpartyId,
          });
          const sealedParts = extractSealedIntentParts(finalIntent);
          const payloadDigest =
            args.confidentialPayload && Object.keys(args.confidentialPayload).length > 0
              ? await computePayloadDigest(args.confidentialPayload)
              : sealedParts.payloadDigest;

          return buildSuccessResult({
            status: 'dry_run_only',
            settledOnChain: false,
            agentDid: effectiveAgentId,
            actionSummary: actionLabel,
            ...(payloadDigest ? { payloadDigest } : {}),
            intentHash: commitment.publicInputs.intentHash,
            commitment,
          });
        }

        const receipt = await rohanClient.submitHandshake({
          agentId: effectiveAgentId,
          intent: finalIntent,
          counterpartyId: args.counterpartyId,
        });

        // Deduplicate payloadDigest & auditBundle so we don't double-send them in the LLM context
        const { auditBundle, payloadDigest, ...cleanReceipt } = receipt;

        return buildSuccessResult({
          status: 'success',
          message: 'Zero-Knowledge Handshake successfully settled on Midnight Blockchain with Sovereign Identity (V-08).',
          agentDid: effectiveAgentId,
          ...(payloadDigest ? { payloadDigest } : {}),
          ...(auditBundle ? { auditBundle } : {}),
          receipt: cleanReceipt,
        });
      } catch (err: any) {
        return classifyRelayerError(err?.message || 'Handshake execution failed');
      }
    }

    // ── Tool 2: rohan_get_ledger_state ──────────────────────────────────────
    if (toolName === 'rohan_get_ledger_state') {
      try {
        const ledgerState = await rohanClient.getLedgerState();
        const cacheAgeMs = Date.now() - (ledgerState.fetchedAt || Date.now());

        return buildSuccessResult({
          status: 'success',
          contractAddress: ledgerState.contractAddress,
          currentStateRoot: ledgerState.currentStateRoot,
          blockHeight: ledgerState.blockHeight ?? null,
          lastTxHash: ledgerState.lastTxHash ?? null,
          network: ledgerState.network || `midnight-${network}`,
          isMinedOnChain: ledgerState.isMinedOnChain ?? true,
          cacheAgeMs: ledgerState.cacheAgeMs ?? cacheAgeMs,
          cacheTtlMs: ledgerState.cacheTtlMs ?? 15000,
          fetchedAt: ledgerState.fetchedAt,
        });
      } catch (err: any) {
        return buildErrorResult(
          'RELAYER_UNREACHABLE',
          err?.message || 'Failed to fetch ledger state',
          true,
          'Verify relayer connectivity or call rohan_get_agent_status to inspect relayer health.'
        );
      }
    }

    // ── Tool 3: rohan_get_transaction_history ───────────────────────────────
    if (toolName === 'rohan_get_transaction_history') {
      try {
        const rawLimit = Number(args.limit) || 10;
        const history = await rohanClient.getTransactionHistory(rawLimit);
        return buildSuccessResult({ status: 'success', ...history });
      } catch (err: any) {
        return buildErrorResult(
          'HISTORY_FETCH_FAILED',
          err?.message || 'Failed to fetch transaction history',
          true,
          'Retry shortly or check relayer connectivity via rohan_get_agent_status.'
        );
      }
    }

    // ── Tool 4: rohan_verify_commitment (Digest &/or AuditBundle) ───────────
    if (toolName === 'rohan_verify_commitment') {
      const hasBundle = args.auditBundle !== undefined;
      const hasDigest = args.expectedDigest !== undefined;

      if (!hasBundle && !hasDigest) {
        return buildErrorResult(
          'INVALID_ARGUMENTS',
          'Missing verification target: provide either auditBundle, or expectedDigest together with payload.',
          true,
          'Pass { payload, expectedDigest } using the inner payloadDigest, or pass { auditBundle, payload } from rohan_execute_handshake.'
        );
      }

      if (args.payload !== undefined) {
        if (!args.payload || typeof args.payload !== 'object' || Array.isArray(args.payload)) {
          return buildErrorResult(
            'INVALID_PAYLOAD',
            'Invalid argument: payload must be a non-null JSON object.',
            true,
            'Pass a valid JSON object as payload.'
          );
        }
        const payloadString = JSON.stringify(args.payload);
        if (payloadString.length > 256 * 1024) {
          return buildErrorResult(
            'PAYLOAD_TOO_LARGE',
            'Plaintext exceeds maximum allowed size of 256 KB.',
            false,
            'Reduce payload size below 256 KB before verifying.'
          );
        }
      }

      if (hasBundle) {
        if (!args.auditBundle || typeof args.auditBundle !== 'object' || Array.isArray(args.auditBundle)) {
          return buildErrorResult(
            'INVALID_AUDIT_BUNDLE',
            'Invalid argument: auditBundle must be a non-null JSON object.',
            true,
            'Pass the complete auditBundle object returned by rohan_execute_handshake.'
          );
        }
        try {
          const result = await verifyAuditBundle(
            args.auditBundle as RohanAuditBundle,
            args.payload as Record<string, unknown> | undefined
          );
          const recoveryAction = result.valid
            ? undefined
            : 'Provide the exact original JSON payload used for the handshake and the complete unmodified auditBundle. Check payloadDigest (the inner SHA-256 digest); intentHash is an outer timestamp-salted commitment, not a payload digest. Review the reported schema, signature, and intent-binding errors before trusting the bundle.';
          return buildSuccessResult({
            status: 'success',
            mode: 'audit-bundle',
            ...result,
            ...(recoveryAction ? { recoveryAction } : {}),
          });
        } catch (err: any) {
          return buildErrorResult(
            'VERIFICATION_ERROR',
            err?.message || 'Audit bundle verification failed',
            false,
            'Ensure auditBundle conforms to rohan-audit-bundle/v1.'
          );
        }
      }

      if (!args.payload) {
        return buildErrorResult(
          'MISSING_PAYLOAD',
          'Invalid argument: payload is required when verifying against expectedDigest.',
          true,
          'Pass the confidential plaintext object as payload alongside expectedDigest.'
        );
      }

      if (typeof args.expectedDigest !== 'string') {
        return buildErrorResult(
          'INVALID_DIGEST',
          'Invalid argument: expectedDigest must be a string.',
          true,
          'Pass the 64-character hex SHA-256 payloadDigest (with optional sha256: or 0x prefix).'
        );
      }

      const normalizedExpected = args.expectedDigest.replace(/^(?:sha256:|0x)/i, '').toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(normalizedExpected)) {
        return buildErrorResult(
          'INVALID_DIGEST',
          'Invalid expectedDigest: must resolve to a 64-character hexadecimal SHA-256 hash.',
          true,
          'Pass the inner payloadDigest (NOT the outer salted intentHash if malformed).'
        );
      }

      try {
        const canonicalPayload = canonicalizeJson(args.payload);
        const computedDigest = crypto.createHash('sha256').update(canonicalPayload, 'utf8').digest('hex').toLowerCase();
        const match = crypto.timingSafeEqual(
          Buffer.from(computedDigest, 'hex'),
          Buffer.from(normalizedExpected, 'hex')
        );

        return buildSuccessResult({
          status: 'success',
          mode: 'digest',
          valid: match,
          match,
          expectedDigest: normalizedExpected,
          computedDigest,
          algorithm: 'SHA-256 (RFC 8785 JCS)',
          verifiedAt: Date.now(),
          ...(match
            ? {}
            : {
                recoveryAction:
                  'Use the exact original JSON payload supplied to rohan_execute_handshake and compare its computedDigest with the inner payloadDigest. Do not pass the outer timestamp-salted intentHash as expectedDigest.',
              }),
        });
      } catch (err: any) {
        return buildErrorResult(
          'VERIFICATION_ERROR',
          err?.message || 'Verification execution failed',
          false,
          'Ensure payload is valid JSON under 32 nesting levels.'
        );
      }
    }

    // ── Tool 5: rohan_get_agent_status (Graceful Offline Degradation) ───────
    if (toolName === 'rohan_get_agent_status') {
      const base = getIdentitySnapshot();
      try {
        const state = await withTimeout(
          rohanClient.getLedgerState(),
          statusTimeoutMs,
          `Relayer status check timed out after ${statusTimeoutMs}ms`
        );

        return buildSuccessResult({
          status: 'success',
          ...base,
          relayerHealthy: true,
          currentBlockHeight: state.blockHeight ?? null,
          currentStateRoot: state.currentStateRoot ?? null,
        });
      } catch (err: any) {
        return buildSuccessResult({
          status: 'degraded',
          ...base,
          relayerHealthy: false,
          currentBlockHeight: null,
          currentStateRoot: null,
          relayerError: err?.message || 'Relayer unreachable',
        });
      }
    }

    return buildErrorResult(
      'UNKNOWN_TOOL',
      `Unknown tool: ${toolName}`,
      false,
      'Call tools/list to inspect the 5 supported Rohan Protocol tools.'
    );
  });

  return server;
}
