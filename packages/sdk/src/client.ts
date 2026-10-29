import crypto from 'node:crypto';
import { MemorySanitizer } from './security/zeroize.js';
import { canonicalizeJson } from './index.js';
import type { 
  RohanConfig, 
  AgentHandshakeIntent, 
  HandshakeCommitmentPayload, 
  HandshakeReceipt 
} from './types.js';

export interface LedgerState {
  success: boolean;
  status: string;
  contractAddress: string;
  currentStateRoot: string;
  blockHeight: number | null;
  lastTxHash: string | null;
  network: string;
  isMinedOnChain: boolean;
  cacheAgeMs?: number;
  cacheTtlMs?: number;
  fetchedAt: number;
}

export interface VerificationResult {
  valid: boolean;
  match: boolean;
  expectedDigest: string;
  computedDigest: string;
  canonicalPayload: string;
  algorithm: 'SHA-256 (RFC 8785 JCS)';
  verifiedAt: number;
}

/**
 * Normalizes relayer URL to ensure valid API endpoint routing.
 */
function normalizeRelayerUrl(url?: string): string {
  if (!url) return 'https://api.rohanprotocol.network/api/v1/handshake';
  let clean = url.trim();
  while (clean.endsWith('/')) {
    clean = clean.slice(0, -1);
  }
  if (clean.endsWith('/api/v1/handshake') || clean.endsWith('/api/v1/handshake/stream')) {
    return clean;
  }
  return `${clean}/api/v1/handshake`;
}

/**
 * Resolves the ledger state read endpoint from the configured relayer URL.
 */
function resolveLedgerStateUrl(relayerUrl: string): string {
  let base = relayerUrl.trim();
  while (base.endsWith('/')) {
    base = base.slice(0, -1);
  }
  return base.replace(/\/api\/v1\/handshake(?:\/stream)?$/, '') + '/api/v1/ledger-state';
}

export class RohanClient {
  public readonly config: Required<RohanConfig>;

  constructor(config: RohanConfig | string = {}) {
    if (typeof config === 'string') {
      this.config = {
        contractAddress: config,
        network: 'preprod',
        relayerUrl: 'https://api.rohanprotocol.network/api/v1/handshake',
        apiKey: '',
      };
    } else {
      this.config = {
        contractAddress: config.contractAddress || '585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e',
        network: config.network || 'preprod',
        relayerUrl: normalizeRelayerUrl(config.relayerUrl),
        apiKey: config.apiKey || '',
      };
    }
  }

  async generateHandshakeProof(payload: AgentHandshakeIntent): Promise<HandshakeCommitmentPayload> {
    const timestamp = payload.timestamp || Date.now();
    const encoder = new TextEncoder();
    
    const rawWitness = encoder.encode(
      `${payload.agentId}:${payload.intent}:${JSON.stringify(payload.privateData || {})}:${timestamp}`
    );

    return await MemorySanitizer.withSecureWitness(rawWitness, async (witness) => {
      let intentHashHex: string;
      if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
        const digest = await globalThis.crypto.subtle.digest('SHA-256', witness as unknown as BufferSource);
        intentHashHex = Array.from(new Uint8Array(digest))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
      } else {
        intentHashHex = crypto.createHash('sha256').update(witness).digest('hex');
      }

      return {
        publicInputs: {
          intentHash: intentHashHex,
          agentId: payload.agentId,
          timestamp,
        },
        circuitName: 'verify_batched_handshakes',
        contractAddress: this.config.contractAddress,
      };
    });
  }

  async submitHandshake(payload: AgentHandshakeIntent): Promise<HandshakeReceipt> {
    const commitment = await this.generateHandshakeProof(payload);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.config.apiKey ? { 'x-rohan-api-key': this.config.apiKey } : {}),
    };

    const response = await fetch(this.config.relayerUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(commitment),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(err.error || `Relayer submission failed with HTTP ${response.status}`);
    }

    return await response.json();
  }

  /**
   * [TASK 2.2 / BLOCK 2] - Reads current on-chain ledger state from Relayer memory cache.
   * Zero gas cost, <1 ms latency.
   */
  async getLedgerState(): Promise<LedgerState> {
    const url = resolveLedgerStateUrl(this.config.relayerUrl);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.config.apiKey ? { 'x-rohan-api-key': this.config.apiKey } : {}),
    };

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(err.error || `Failed to fetch ledger state with HTTP ${response.status}`);
    }

    return await response.json();
  }

  /**
   * [TASK 2.1 / BLOCK 2] - Pure in-memory cryptographic verification of intent commitment.
   * RFC 8785 JCS canonicalization + SHA-256. Zero gas cost.
   */
  async verifyCommitment(
    payload: Record<string, unknown>, 
    expectedDigest: string
  ): Promise<VerificationResult> {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('Invalid argument: payload must be a non-null object.');
    }
    // Payload-Size-Guard (Max 256 KB im RAM)
    const payloadString = JSON.stringify(payload);
    if (payloadString.length > 256 * 1024) {
      throw new Error('PAYLOAD_TOO_LARGE: Plaintext exceeds maximum allowed size of 256 KB.');
    }
    if (!expectedDigest || typeof expectedDigest !== 'string') {
      throw new Error('Invalid argument: expectedDigest must be a string.');
    }

    // Tolerant prefix handling: removes sha256: or 0x
    const cleanExpected = expectedDigest.replace(/^(?:sha256:|0x)/i, '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(cleanExpected)) {
      throw new Error('Invalid expectedDigest: must be a 64-character hexadecimal SHA-256 hash.');
    }

    const canonicalPayload = canonicalizeJson(payload);
    let computedDigest: string;

    if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
      const encoder = new TextEncoder();
      const digestBuffer = await globalThis.crypto.subtle.digest('SHA-256', encoder.encode(canonicalPayload));
      computedDigest = Array.from(new Uint8Array(digestBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } else {
      computedDigest = crypto.createHash('sha256').update(canonicalPayload, 'utf8').digest('hex').toLowerCase();
    }

    const match = computedDigest === cleanExpected;

    return {
      valid: match,
      match,
      expectedDigest: cleanExpected,
      computedDigest,
      canonicalPayload,
      algorithm: 'SHA-256 (RFC 8785 JCS)',
      verifiedAt: Date.now(),
    };
  }
}

export class RohanRelayerClient extends RohanClient {
  async submitProof(proofData: HandshakeCommitmentPayload): Promise<HandshakeReceipt> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.config.apiKey ? { 'x-rohan-api-key': this.config.apiKey } : {}),
    };

    const response = await fetch(this.config.relayerUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(proofData),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(err.error || `Relayer submission failed with HTTP ${response.status}`);
    }

    return await response.json();
  }

  async submitProofStream(proofData: HandshakeCommitmentPayload, onProgress?: (event: any) => void): Promise<HandshakeReceipt> {
    const streamUrl = this.config.relayerUrl.endsWith('/stream') 
      ? this.config.relayerUrl 
      : `${this.config.relayerUrl.replace(/\/handshake$/, '')}/handshake/stream`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.config.apiKey ? { 'x-rohan-api-key': this.config.apiKey } : {}),
    };

    const response = await fetch(streamUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(proofData),
    });

    if (!response.body) {
      throw new Error('ReadableStream is not supported in current environment.');
    }

    const reader = (response.body as any).getReader();
    const decoder = new TextDecoder();
    let finalReceipt: any = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunkText = decoder.decode(value, { stream: true });
      const lines = chunkText.split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          if (onProgress) onProgress(event);
          if (event.stage === 'confirmed') finalReceipt = event;
          if (event.stage === 'error') throw new Error(event.error || 'On-chain stream error');
        } catch (e: any) {
          if (e.message?.includes('On-chain stream error')) throw e;
        }
      }
    }

    if (!finalReceipt) {
      throw new Error('Stream closed before confirmation was received from Midnight Node.');
    }

    return finalReceipt;
  }
}
