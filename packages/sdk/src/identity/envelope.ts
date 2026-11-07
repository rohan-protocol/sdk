import type { AgentSigner } from './did.js';
import { publicKeyFromDidKey, verifyEd25519Signature } from './did.js';
import { canonicalizeJson } from '../security/canonicalize.js';

const ENVELOPE_KEYS = [
  'domain',
  'version',
  'did',
  'network',
  'contractAddress',
  'circuitName',
  'timestamp',
  'intentHash',
  'nonce',
];
const SORTED_ENVELOPE_KEYS = [...ENVELOPE_KEYS].sort();

export function toBase64Url(bytes: Uint8Array): string {
  if (!(bytes instanceof Uint8Array)) {
    throw new Error('INVALID_INPUT: Expected Uint8Array.');
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64url');
  }

  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function fromBase64Url(base64url: string): Uint8Array {
  if (typeof base64url !== 'string' || base64url.length === 0) {
    throw new Error('MALFORMED_BASE64URL: Expected a non-empty string.');
  }
  if (base64url.includes('=')) {
    throw new Error('MALFORMED_BASE64URL: Padded base64url is not accepted.');
  }
  if (!/^[A-Za-z0-9_-]+$/.test(base64url)) {
    throw new Error('MALFORMED_BASE64URL: Contains invalid characters.');
  }

  let bytes: Uint8Array;
  if (typeof Buffer !== 'undefined') {
    bytes = new Uint8Array(Buffer.from(base64url, 'base64url'));
  } else {
    let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) base64 += '=';
    const binary = atob(base64);
    bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }

  if (toBase64Url(bytes) !== base64url) {
    throw new Error('MALFORMED_BASE64URL: Non-canonical encoding detected.');
  }
  return bytes;
}

export function generateNonce(): string {
  const cryptoProvider = globalThis.crypto;
  if (!cryptoProvider?.getRandomValues) {
    throw new Error('ENVIRONMENT_ERROR: Cryptographically secure RNG is unavailable.');
  }
  return toBase64Url(cryptoProvider.getRandomValues(new Uint8Array(32)));
}

export type NetworkId = 'preprod' | 'testnet' | 'mainnet';

export interface SignedHandshakeV1 {
  domain: 'rohan-handshake';
  version: 1;
  did: string;
  network: NetworkId;
  contractAddress: string;
  circuitName: 'verify_batched_handshakes';
  timestamp: number;
  intentHash: string;
  nonce: string;
}

export interface RequestIdentityV1 {
  did: string;
  algorithm: 'Ed25519';
  signature: string;
  nonce: string;
}

export function validateSigningEnvelope(envelope: SignedHandshakeV1): void {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    throw new Error('INVALID_ENVELOPE: Envelope must be a non-null object.');
  }
  const keys = Object.keys(envelope).sort();
  if (
    keys.length !== ENVELOPE_KEYS.length ||
    keys.some((key, index) => key !== SORTED_ENVELOPE_KEYS[index])
  ) {
    throw new Error('INVALID_ENVELOPE: Envelope must contain exactly the v1 signed fields.');
  }
  if (envelope.domain !== 'rohan-handshake') {
    throw new Error('INVALID_DOMAIN: Expected "rohan-handshake".');
  }
  if (envelope.version !== 1) {
    throw new Error('UNSUPPORTED_VERSION: Expected version 1.');
  }
  if (typeof envelope.did !== 'string') {
    throw new Error('INVALID_DID: Expected an Ed25519 did:key.');
  }
  publicKeyFromDidKey(envelope.did);
  if (envelope.network !== 'preprod' && envelope.network !== 'testnet' && envelope.network !== 'mainnet') {
    throw new Error('INVALID_NETWORK: Unsupported network.');
  }
  if (
    typeof envelope.contractAddress !== 'string' ||
    !/^[0-9a-f]{64}$/.test(envelope.contractAddress)
  ) {
    throw new Error('INVALID_CONTRACT_ADDRESS: Must be 64 lowercase hexadecimal characters.');
  }
  if (envelope.circuitName !== 'verify_batched_handshakes') {
    throw new Error('UNSUPPORTED_CIRCUIT: Unsupported handshake circuit.');
  }
  if (!Number.isSafeInteger(envelope.timestamp) || envelope.timestamp <= 0) {
    throw new Error('INVALID_TIMESTAMP: Must be a positive safe integer in milliseconds.');
  }
  if (typeof envelope.intentHash !== 'string' || !/^[0-9a-f]{64}$/.test(envelope.intentHash)) {
    throw new Error('INVALID_INTENT_HASH: Must be 64 lowercase hexadecimal characters.');
  }
  if (fromBase64Url(envelope.nonce).length !== 32) {
    throw new Error('INVALID_NONCE_LENGTH: Nonce must decode to exactly 32 bytes.');
  }
}

export function serializeSigningEnvelope(envelope: SignedHandshakeV1): Uint8Array {
  validateSigningEnvelope(envelope);
  return new TextEncoder().encode(canonicalizeJson(envelope));
}

export async function signEnvelope(
  envelope: SignedHandshakeV1,
  signer: AgentSigner
): Promise<RequestIdentityV1> {
  validateSigningEnvelope(envelope);
  if (signer.did !== envelope.did) {
    throw new Error('SIGNER_MISMATCH: Signer DID does not match the envelope DID.');
  }

  const rawSignature = await signer.sign(serializeSigningEnvelope(envelope));
  if (!(rawSignature instanceof Uint8Array) || rawSignature.length !== 64) {
    throw new Error('INVALID_SIGNATURE_LENGTH: Ed25519 signatures must be exactly 64 bytes.');
  }

  return {
    did: envelope.did,
    algorithm: 'Ed25519',
    signature: toBase64Url(rawSignature),
    nonce: envelope.nonce,
  };
}

export async function verifyEnvelope(
  envelope: SignedHandshakeV1,
  identity: RequestIdentityV1
): Promise<boolean> {
  try {
    validateSigningEnvelope(envelope);
    if (
      !identity ||
      identity.algorithm !== 'Ed25519' ||
      identity.did !== envelope.did ||
      identity.nonce !== envelope.nonce
    ) {
      return false;
    }

    const signature = fromBase64Url(identity.signature);
    if (signature.length !== 64) return false;
    return await verifyEd25519Signature(
      publicKeyFromDidKey(identity.did),
      signature,
      serializeSigningEnvelope(envelope)
    );
  } catch {
    return false;
  }
}
