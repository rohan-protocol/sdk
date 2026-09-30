import crypto from 'node:crypto';
import { MemorySanitizer } from './security/zeroize.js';
import type { 
  RohanConfig, 
  AgentHandshakeIntent, 
  HandshakeCommitmentPayload, 
  HandshakeReceipt 
} from './types.js';

/**
 * Normalizes relayer URL to ensure valid API endpoint routing.
 */
function normalizeRelayerUrl(url?: string): string {
  if (!url) return 'https://api.rohanprotocol.network/api/v1/handshake';
  const clean = url.replace(/\/+$/, '');
  if (clean.endsWith('/api/v1/handshake') || clean.endsWith('/api/v1/handshake/stream')) {
    return clean;
  }
  return `${clean}/api/v1/handshake`;
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
