export * from './types.js';
export * from './client.js';
export * from './security/zeroize.js';
export * from './security/canonicalize.js';

// RFC 8785 Canonicalization & Intent Sealing
export { canonicalizeJson, sealActionIntent } from './security/canonicalize.js';
export * from './identity/did.js';
export * from './identity/envelope.js';
