import crypto from 'node:crypto';

/**
 * Rohan Protocol - Security Vector V-02: Memory Hygiene
 * Guarantees zero-retention of private witnesses and sensitive buffers in client memory.
 */
export class MemorySanitizer {
  /**
   * Overwrites a memory buffer with cryptographically secure pseudo-random noise,
   * followed by deterministic zero-filling to prevent cold-boot and memory scraping attacks.
   */
  static wipe(buffer: Uint8Array | Buffer | number[]): void {
    if (!buffer) return;

    if (buffer instanceof Uint8Array || Buffer.isBuffer(buffer)) {
      try {
        if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
          globalThis.crypto.getRandomValues(buffer);
        } else {
          crypto.randomFillSync(buffer as Buffer);
        }
      } catch (_) {
        buffer.fill(0xff);
      }
      buffer.fill(0x00);
    } else if (Array.isArray(buffer)) {
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = 0;
      }
    }
  }

  /**
   * Executes a cryptographic closure with a sensitive private witness and guarantees
   * that the witness memory is wiped in a `finally` block, even if an exception occurs.
   */
  static async withSecureWitness<T>(
    witness: Uint8Array,
    fn: (w: Uint8Array) => Promise<T>
  ): Promise<T> {
    try {
      return await fn(witness);
    } finally {
      MemorySanitizer.wipe(witness);
    }
  }
}
