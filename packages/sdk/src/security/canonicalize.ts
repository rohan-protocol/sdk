import crypto from 'node:crypto';
import { canonicalizeJson } from './jcs.js';

export { canonicalizeJson };

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
