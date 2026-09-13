export interface HandshakeIntent {
  agentId: string;
  action: string;
  payload: Record<string, unknown>;
}

export class SemanticFirewall {
  private static readonly INJECTION_REGEX = 
    /(?:ignore\s+(all\s+)?previous\s+instructions|system\s*:\s*override|you\s+are\s+now\s+a|assistant\s*:|\[INST\]|<\|im_start\|>|jailbreak|reveal\s+(your|the)\s+secret)/i;

  static validate(intent: HandshakeIntent): boolean {
    if (!intent.agentId || typeof intent.agentId !== 'string' || intent.agentId.length > 128) {
      return false;
    }
    if (!intent.action || (intent.action !== 'rohan_zk_handshake' && intent.action !== 'verify_batched_handshakes')) {
      return false;
    }
    if (!intent.payload || typeof intent.payload !== 'object') {
      return false;
    }

    const serialized = JSON.stringify(intent.payload);
    if (serialized.length > 8192) {
      return false; // Denial-of-Service Schutz
    }

    if (this.INJECTION_REGEX.test(serialized)) {
      return false; // Prompt Injection blockiert
    }

    return true;
  }
}
