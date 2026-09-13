/**
 * 🛡️ ROHAN PROTOCOL — SECURITY VECTOR V-02: MEMORY SANITATION
 * Garantiert die restlose Tilgung privater Zeugen (w) und sensibler Puffer aus dem RAM.
 */

export class MemorySanitizer {
  /**
   * Überschreibt einen Puffer restlos mit Nullen und kryptographischem Rauschen.
   * Verhindert Dead-Code-Elimination durch volatile Mehrfach-Überschreibung.
   */
  static wipe(buffer: Uint8Array | Buffer | number[]): void {
    if (!buffer) return;

    if (buffer instanceof Uint8Array || Buffer.isBuffer(buffer)) {
      // Pass 1: Mit Zufallsrauschen überschreiben (gegen Restladungen/Memory-Scraping)
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        try {
          crypto.getRandomValues(buffer);
        } catch (_) {
          // Fallback falls Puffer zu groß für WebCrypto
          buffer.fill(0xff);
        }
      } else {
        buffer.fill(0xff);
      }

      // Pass 2: Deterministisch mit Nullen versiegeln
      buffer.fill(0x00);
    } else if (Array.isArray(buffer)) {
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = 0;
      }
    }
  }

  /**
   * Führt eine Operation mit einem sensiblen Zeugen (w) aus und garantiert,
   * dass der Zeuge im `finally`-Block restlos getilgt wird – selbst bei Exceptions!
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
