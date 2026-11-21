/**
 * RFC 8785 — JSON Canonicalization Scheme (JCS) with Stack-Depth-Guard against ReDoS & Call-Stack-Overflow.
 * Pure isomorphic implementation (zero Node.js dependencies).
 */
export function canonicalizeJson(obj: unknown, depth = 0): string {
  if (depth > 32) {
    throw new Error('PAYLOAD_TOO_DEEP: Maximum nesting depth of 32 exceeded.');
  }
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map((item) => (item === undefined ? 'null' : canonicalizeJson(item, depth + 1))).join(',') + ']';
  }

  const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs: string[] = [];

  for (const key of sortedKeys) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== undefined && typeof val !== 'function' && typeof val !== 'symbol') {
      pairs.push(JSON.stringify(key) + ':' + canonicalizeJson(val, depth + 1));
    }
  }

  return '{' + pairs.join(',') + '}';
}
