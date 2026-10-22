import crypto from 'node:crypto';

/**
 * RFC 8785 — JSON Canonicalization Scheme (JCS)
 * Enforces strictly deterministic, lexicographically sorted JSON serialization.
 */
export function canonicalizeJson(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map(item => item === undefined ? 'null' : canonicalizeJson(item)).join(',') + ']';
  }

  const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs: string[] = [];

  for (const key of sortedKeys) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== undefined && typeof val !== 'function' && typeof val !== 'symbol') {
      pairs.push(JSON.stringify(key) + ':' + canonicalizeJson(val));
    }
  }

  return '{' + pairs.join(',') + '}';
}

/**
 * Hashes canonical JSON via SHA-256 in RAM.
 */
export function hashCanonicalJson(obj: unknown): string {
  const canonical = canonicalizeJson(obj);
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * Seals an action label with an RFC 8785 digest reference of confidential parameters.
 */
export function sealActionIntent(actionSummary: string, confidentialPayload?: Record<string, unknown>): string {
  if (!confidentialPayload || Object.keys(confidentialPayload).length === 0) {
    return actionSummary;
  }
  const digest = hashCanonicalJson(confidentialPayload);
  return `${actionSummary} (digest: sha256:${digest})`;
}
