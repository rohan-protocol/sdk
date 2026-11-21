import { canonicalizeJson } from '../security/jcs.js';
import {
  verifyEnvelope,
  type NetworkId,
  type RequestIdentityV1,
  type SignedHandshakeV1,
} from './envelope.js';
import type { HandshakeCommitmentPayload, HandshakeReceipt } from '../types.js';

export interface RohanAuditBundle {
  schema: 'rohan-audit-bundle/v1';
  agentDid: string;
  network: NetworkId;
  contractAddress: string;
  txHash: string;
  blockHeight?: number | null;
  actionSummary?: string;
  intentHash: string;
  payloadDigest?: string;
  timestamp: number;   // Exact signed timestamp from publicInputs.timestamp
  settledAt?: number;  // Relayer confirmation timestamp (receipt.timestamp)
  identityProof?: RequestIdentityV1;
}

export interface BuildAuditBundleInput {
  commitment: HandshakeCommitmentPayload;
  receipt: Pick<
    HandshakeReceipt,
    'txHash' | 'contractAddress' | 'intentHash' | 'timestamp' | 'blockHeight' | 'payloadDigest'
  >;
  network?: NetworkId;
  actionSummary?: string;
  payloadDigest?: string;
}

export interface VerifyAuditBundleOptions {
  allowUnboundLegacy?: boolean;
}

export interface AuditBundleVerificationResult {
  valid: boolean;
  schemaValid: boolean;
  payloadMatch: boolean | null;
  intentBindingValid: boolean | null;
  signatureValid: boolean | null;
  computedPayloadDigest?: string;
  errors: string[];
  verifiedAt: number;
}

function timingSafeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function sha256Hex(text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('ENVIRONMENT_ERROR: WebCrypto SubtleCrypto is unavailable.');
  }
  const bytes = new TextEncoder().encode(text);
  const hashBuffer = await subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Computes the canonical RFC 8785 JCS SHA-256 digest ('sha256:<64-hex>') of a plaintext payload.
 * Pure WebCrypto (browser & Node safe).
 */
export async function computePayloadDigest(payload: Record<string, unknown>): Promise<string> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('INVALID_PAYLOAD: Plaintext payload must be a non-null object.');
  }

  const serialized = JSON.stringify(payload);
  if (serialized.length > 256 * 1024) {
    throw new Error('PAYLOAD_TOO_LARGE: Plaintext exceeds maximum allowed size of 256 KB.');
  }

  const hex = await sha256Hex(canonicalizeJson(payload));
  return `sha256:${hex}`;
}

/**
 * Seals an action label with an RFC 8785 digest using WebCrypto (isomorphic async).
 */
export async function sealActionIntentAsync(
  actionSummary: string,
  confidentialPayload?: Record<string, unknown>
): Promise<{ sealedIntent: string; payloadDigest?: string }> {
  if (!confidentialPayload || Object.keys(confidentialPayload).length === 0) {
    return { sealedIntent: actionSummary };
  }
  const payloadDigest = await computePayloadDigest(confidentialPayload);
  return {
    sealedIntent: `${actionSummary} (digest: ${payloadDigest})`,
    payloadDigest,
  };
}

/**
 * Splits a sealed intent string ("Label (digest: sha256:<64-hex>)") into its actionSummary and payloadDigest.
 */
export function extractSealedIntentParts(intentString: string): {
  actionSummary: string;
  payloadDigest?: string;
} {
  if (typeof intentString !== 'string') {
    return { actionSummary: '' };
  }
  const match = intentString.match(/^(.*)\s+\(digest:\s*sha256:([0-9a-fA-F]{64})\)\s*$/);
  if (!match) {
    return { actionSummary: intentString };
  }
  return {
    actionSummary: match[1],
    payloadDigest: `sha256:${match[2].toLowerCase()}`,
  };
}

/**
 * Builds a portable, offline-verifiable RohanAuditBundle (v1).
 */
export function buildAuditBundle(input: BuildAuditBundleInput): RohanAuditBundle {
  const { commitment, receipt } = input;
  const contractAddress = (commitment.contractAddress || receipt.contractAddress)
    .replace(/^0x/i, '')
    .toLowerCase();
  const intentHash = (commitment.publicInputs?.intentHash || receipt.intentHash).toLowerCase();
  const payloadDigest = input.payloadDigest ?? receipt.payloadDigest;

  return {
    schema: 'rohan-audit-bundle/v1',
    agentDid: commitment.identity?.did ?? commitment.publicInputs.agentId,
    network: input.network ?? 'preprod',
    contractAddress,
    txHash: receipt.txHash,
    ...(receipt.blockHeight !== undefined ? { blockHeight: receipt.blockHeight } : {}),
    ...(input.actionSummary !== undefined ? { actionSummary: input.actionSummary } : {}),
    intentHash,
    ...(payloadDigest ? { payloadDigest } : {}),
    timestamp: commitment.publicInputs.timestamp,
    ...(receipt.timestamp !== undefined ? { settledAt: receipt.timestamp } : {}),
    ...(commitment.identity ? { identityProof: commitment.identity } : {}),
  };
}

/**
 * Full-chain offline cryptographic verification:
 * 1. Validates bundle schema.
 * 2. Verifies plaintextPayload -> payloadDigest (RFC 8785 SHA-256).
 * 3. Verifies actionSummary + payloadDigest + agentDid + timestamp -> bundle.intentHash (anti-swap binding).
 * 4. Verifies Ed25519 signature over reconstructed SignedHandshakeV1 envelope.
 */
export async function verifyAuditBundle(
  bundle: RohanAuditBundle,
  plaintextPayload?: Record<string, unknown>,
  options?: VerifyAuditBundleOptions
): Promise<AuditBundleVerificationResult> {
  const errors: string[] = [];
  let schemaValid = true;

  if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) {
    return {
      valid: false,
      schemaValid: false,
      payloadMatch: null,
      intentBindingValid: null,
      signatureValid: null,
      errors: ['INVALID_BUNDLE: Expected a non-null RohanAuditBundle object.'],
      verifiedAt: Date.now(),
    };
  }

  if (bundle.schema !== 'rohan-audit-bundle/v1') {
    schemaValid = false;
    errors.push(`UNSUPPORTED_SCHEMA: Expected "rohan-audit-bundle/v1", got "${String((bundle as any).schema)}".`);
  }

  if (typeof bundle.agentDid !== 'string' || bundle.agentDid.trim().length === 0) {
    schemaValid = false;
    errors.push('INVALID_AGENT_DID: agentDid is required.');
  }

  if (bundle.network !== 'preprod' && bundle.network !== 'testnet' && bundle.network !== 'mainnet') {
    schemaValid = false;
    errors.push(`INVALID_NETWORK: Unsupported network "${String((bundle as any).network)}".`);
  }

  const cleanContract =
    typeof bundle.contractAddress === 'string'
      ? bundle.contractAddress.replace(/^0x/i, '').toLowerCase()
      : '';
  if (!/^[0-9a-f]{64}$/.test(cleanContract)) {
    schemaValid = false;
    errors.push('INVALID_CONTRACT_ADDRESS: Must be a 64-character hexadecimal string.');
  }

  const cleanIntentHash = typeof bundle.intentHash === 'string' ? bundle.intentHash.toLowerCase() : '';
  if (!/^[0-9a-f]{64}$/.test(cleanIntentHash)) {
    schemaValid = false;
    errors.push('INVALID_INTENT_HASH: Must be a 64-character lowercase hexadecimal string.');
  }

  if (!Number.isSafeInteger(bundle.timestamp) || bundle.timestamp <= 0) {
    schemaValid = false;
    errors.push('INVALID_TIMESTAMP: Signed timestamp must be a positive safe integer.');
  }

  if (typeof bundle.txHash !== 'string' || bundle.txHash.trim().length === 0) {
    schemaValid = false;
    errors.push('INVALID_TX_HASH: txHash is required.');
  }

  // ── 1. Payload <-> payloadDigest verification ─────────────────────────────
  let payloadMatch: boolean | null = null;
  let computedPayloadDigest: string | undefined;
  let cleanBundleDigest: string | undefined;

  if (bundle.payloadDigest !== undefined) {
    if (typeof bundle.payloadDigest !== 'string') {
      schemaValid = false;
      errors.push('INVALID_PAYLOAD_DIGEST: payloadDigest must be a string.');
    } else {
      const stripped = bundle.payloadDigest.replace(/^(?:sha256:|0x)/i, '').toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(stripped)) {
        schemaValid = false;
        errors.push('INVALID_PAYLOAD_DIGEST: Must be a 64-character hexadecimal SHA-256 digest.');
      } else {
        cleanBundleDigest = stripped;
      }
    }
  }

  if (plaintextPayload !== undefined) {
    if (!cleanBundleDigest) {
      payloadMatch = false;
      errors.push('MISSING_PAYLOAD_DIGEST: Bundle does not contain a valid payloadDigest to verify plaintext against.');
    } else {
      try {
        computedPayloadDigest = await computePayloadDigest(plaintextPayload);
        const computedHex = computedPayloadDigest.slice('sha256:'.length);
        payloadMatch = timingSafeHexEqual(computedHex, cleanBundleDigest);
        if (!payloadMatch) {
          errors.push('PAYLOAD_MISMATCH: Plaintext payload does not match bundle.payloadDigest.');
        }
      } catch (err: any) {
        payloadMatch = false;
        errors.push(err?.message || 'PAYLOAD_VERIFICATION_FAILED');
      }
    }
  }

  // ── 2. Cryptographic Binding: actionSummary + payloadDigest -> intentHash ─
  let intentBindingValid: boolean | null = null;
  if (schemaValid && typeof bundle.actionSummary === 'string' && bundle.actionSummary.length > 0) {
    const sealedIntent = cleanBundleDigest
      ? `${bundle.actionSummary} (digest: sha256:${cleanBundleDigest})`
      : bundle.actionSummary;
    const expectedWitness = `${bundle.agentDid}:${sealedIntent}:{}:${bundle.timestamp}`;
    const recomputedIntentHash = await sha256Hex(expectedWitness);
    intentBindingValid = timingSafeHexEqual(recomputedIntentHash, cleanIntentHash);
    if (!intentBindingValid) {
      errors.push(
        'INTENT_BINDING_MISMATCH: bundle.payloadDigest or actionSummary is not cryptographically bound to bundle.intentHash.'
      );
    }
  } else if (
    (plaintextPayload !== undefined || cleanBundleDigest !== undefined) &&
    !options?.allowUnboundLegacy
  ) {
    intentBindingValid = false;
    errors.push(
      'MISSING_INTENT_BINDING: actionSummary is required to prove payloadDigest is cryptographically bound to intentHash.'
    );
  }

  // ── 3. Ed25519 Envelope Signature Verification ────────────────────────────
  let signatureValid: boolean | null = null;
  if (bundle.identityProof !== undefined) {
    if (!bundle.identityProof || typeof bundle.identityProof !== 'object') {
      signatureValid = false;
      errors.push('INVALID_IDENTITY_PROOF: identityProof must be an object.');
    } else if (bundle.identityProof.did !== bundle.agentDid) {
      signatureValid = false;
      errors.push('IDENTITY_DID_MISMATCH: identityProof.did does not match bundle.agentDid.');
    } else if (!schemaValid) {
      signatureValid = false;
      errors.push('ENVELOPE_UNVERIFIABLE: Cannot verify signature because bundle schema fields are invalid.');
    } else {
      const envelope: SignedHandshakeV1 = {
        domain: 'rohan-handshake',
        version: 1,
        did: bundle.agentDid,
        network: bundle.network,
        contractAddress: cleanContract,
        circuitName: 'verify_batched_handshakes',
        timestamp: bundle.timestamp,
        intentHash: cleanIntentHash,
        nonce: bundle.identityProof.nonce,
      };
      signatureValid = await verifyEnvelope(envelope, bundle.identityProof);
      if (!signatureValid) {
        errors.push(
          'INVALID_SIGNATURE: Ed25519 signature verification failed for reconstructed SignedHandshakeV1 envelope.'
        );
      }
    }
  }

  const valid =
    schemaValid &&
    payloadMatch !== false &&
    intentBindingValid !== false &&
    signatureValid !== false;

  return {
    valid,
    schemaValid,
    payloadMatch,
    intentBindingValid,
    signatureValid,
    ...(computedPayloadDigest ? { computedPayloadDigest } : {}),
    errors,
    verifiedAt: Date.now(),
  };
}
