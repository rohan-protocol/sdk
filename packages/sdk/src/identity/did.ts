const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_INDEX = new Map(
  Array.from(BASE58_ALPHABET, (character, index) => [character, index] as const)
);

const ED25519_MULTICODEC_PREFIX = new Uint8Array([0xed, 0x01]);
const ED25519_PKCS8_PREFIX = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
]);

function copyToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export interface Ed25519KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface AgentSigner {
  readonly did: string;
  sign(message: Uint8Array): Promise<Uint8Array>;
}

export function base58btcEncode(source: Uint8Array): string {
  if (!(source instanceof Uint8Array)) {
    throw new TypeError('INVALID_INPUT: Base58btc source must be a Uint8Array.');
  }
  if (source.length === 0) return '';

  let zeroes = 0;
  while (zeroes < source.length && source[zeroes] === 0) zeroes++;

  let value = 0n;
  for (const byte of source) {
    value = (value << 8n) | BigInt(byte);
  }

  let encoded = '';
  while (value > 0n) {
    const remainder = Number(value % 58n);
    value /= 58n;
    encoded = BASE58_ALPHABET[remainder] + encoded;
  }

  return '1'.repeat(zeroes) + encoded;
}

export function base58btcDecode(source: string): Uint8Array {
  if (typeof source !== 'string') {
    throw new TypeError('INVALID_INPUT: Base58btc input must be a string.');
  }
  if (source.length === 0) return new Uint8Array(0);

  let zeroes = 0;
  while (zeroes < source.length && source[zeroes] === '1') zeroes++;

  let value = 0n;
  for (const character of source) {
    const digit = BASE58_INDEX.get(character);
    if (digit === undefined) {
      throw new Error(`MALFORMED_BASE58: Invalid character '${character}' in identifier.`);
    }
    value = value * 58n + BigInt(digit);
  }

  const decoded: number[] = [];
  while (value > 0n) {
    decoded.push(Number(value & 0xffn));
    value >>= 8n;
  }
  decoded.reverse();

  const result = new Uint8Array(zeroes + decoded.length);
  result.set(decoded, zeroes);

  if (base58btcEncode(result) !== source) {
    throw new Error('MALFORMED_BASE58: Non-canonical Base58btc encoding rejected.');
  }
  return result;
}

export function createDidKey(publicKey: Uint8Array): string {
  if (!(publicKey instanceof Uint8Array) || publicKey.length !== 32) {
    throw new Error('INVALID_KEY_LENGTH: Ed25519 public key must be exactly 32 bytes.');
  }

  const prefixed = new Uint8Array(ED25519_MULTICODEC_PREFIX.length + publicKey.length);
  prefixed.set(ED25519_MULTICODEC_PREFIX);
  prefixed.set(publicKey, ED25519_MULTICODEC_PREFIX.length);
  return `did:key:z${base58btcEncode(prefixed)}`;
}

export function publicKeyFromDidKey(did: string): Uint8Array {
  if (typeof did !== 'string' || !did.startsWith('did:key:z')) {
    throw new Error('UNSUPPORTED_DID: Must start with "did:key:z".');
  }

  const multibasePayload = did.slice('did:key:z'.length);
  if (multibasePayload.length === 0) {
    throw new Error('MALFORMED_DID: Missing multibase payload.');
  }

  const decoded = base58btcDecode(multibasePayload);
  if (decoded.length !== 34) {
    throw new Error(`INVALID_DECODED_LENGTH: Expected 34 bytes, got ${decoded.length}.`);
  }
  if (
    decoded[0] !== ED25519_MULTICODEC_PREFIX[0] ||
    decoded[1] !== ED25519_MULTICODEC_PREFIX[1]
  ) {
    throw new Error('UNSUPPORTED_MULTICODEC: Identifier is not an Ed25519 public key (0xed01).');
  }

  return decoded.slice(ED25519_MULTICODEC_PREFIX.length);
}

export function wrapPrivateKeyPkcs8(rawPrivateKey: Uint8Array): Uint8Array {
  if (!(rawPrivateKey instanceof Uint8Array) || rawPrivateKey.length !== 32) {
    throw new Error('INVALID_KEY_LENGTH: Ed25519 raw private key must be exactly 32 bytes.');
  }

  const pkcs8Key = new Uint8Array(ED25519_PKCS8_PREFIX.length + rawPrivateKey.length);
  pkcs8Key.set(ED25519_PKCS8_PREFIX);
  pkcs8Key.set(rawPrivateKey, ED25519_PKCS8_PREFIX.length);
  return pkcs8Key;
}

export async function generateEd25519KeyPair(): Promise<Ed25519KeyPair> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('ENVIRONMENT_ERROR: WebCrypto SubtleCrypto is unavailable.');
  }

  const keyPair = await subtle.generateKey(
    { name: 'Ed25519' },
    true,
    ['sign', 'verify']
  ) as CryptoKeyPair;
  const publicKey = new Uint8Array(await subtle.exportKey('raw', keyPair.publicKey));
  const pkcs8PrivateKey = new Uint8Array(await subtle.exportKey('pkcs8', keyPair.privateKey));

  try {
    if (
      pkcs8PrivateKey.length !== ED25519_PKCS8_PREFIX.length + 32 ||
      !ED25519_PKCS8_PREFIX.every((byte, index) => pkcs8PrivateKey[index] === byte)
    ) {
      throw new Error('INVALID_PKCS8: WebCrypto returned an unexpected Ed25519 private-key encoding.');
    }
    return {
      publicKey,
      privateKey: pkcs8PrivateKey.slice(ED25519_PKCS8_PREFIX.length),
    };
  } finally {
    pkcs8PrivateKey.fill(0);
  }
}

export class InMemoryEd25519Signer implements AgentSigner {
  public readonly did: string;
  private cryptoKeyPromise: Promise<CryptoKey> | undefined;
  private readonly publicKey: Uint8Array;
  private readonly privateKey: Uint8Array;
  private destroyed = false;

  constructor(publicKey: Uint8Array, privateKey: Uint8Array) {
    if (!(publicKey instanceof Uint8Array) || publicKey.length !== 32) {
      throw new Error('INVALID_KEY_LENGTH: Ed25519 public key must be exactly 32 bytes.');
    }
    if (!(privateKey instanceof Uint8Array) || privateKey.length !== 32) {
      throw new Error('INVALID_KEY_LENGTH: Ed25519 private key must be exactly 32 bytes.');
    }

    this.publicKey = publicKey.slice();
    this.privateKey = privateKey.slice();
    this.did = createDidKey(this.publicKey);
  }


  static async generate(): Promise<InMemoryEd25519Signer> {
    const { publicKey, privateKey } = await generateEd25519KeyPair();
    try {
      return new InMemoryEd25519Signer(publicKey, privateKey);
    } finally {
      privateKey.fill(0);
      publicKey.fill(0);
    }
  }

  /**
   * Node-only helper: derives the matching Ed25519 public key from a 32-byte hex seed.
   * Uses dynamic import("node:crypto") to keep browser bundlers safe.
   */
  static async fromPrivateKeyHex(privateKeyHex: string): Promise<InMemoryEd25519Signer> {
    if (typeof privateKeyHex !== "string") {
      throw new TypeError("INVALID_INPUT: Private key hex must be a string.");
    }
    const cleanHex = privateKeyHex.trim().replace(/^0x/i, "");
    if (!/^[0-9a-f]{64}$/i.test(cleanHex)) {
      throw new Error("INVALID_KEY_FORMAT: Expected a 64-character hexadecimal Ed25519 private key.");
    }

    let nodeCrypto: typeof import("node:crypto");
    try {
      nodeCrypto = await import("node:crypto");
      if (typeof nodeCrypto.createPrivateKey !== "function" || typeof nodeCrypto.createPublicKey !== "function") {
        throw new Error("Node crypto key APIs unavailable");
      }
    } catch {
      throw new Error("ENVIRONMENT_ERROR: InMemoryEd25519Signer.fromPrivateKeyHex requires Node.js crypto support.");
    }

    const privateKey = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      privateKey[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
    }
    const pkcs8Bytes = wrapPrivateKeyPkcs8(privateKey);

    try {
      const privKeyObj = nodeCrypto.createPrivateKey({
        key: Buffer.from(pkcs8Bytes),
        format: "der",
        type: "pkcs8",
      });
      const pubKeyObj = nodeCrypto.createPublicKey(privKeyObj);
      const spkiDer = pubKeyObj.export({ format: "der", type: "spki" });
      const publicKey = new Uint8Array(spkiDer.subarray(spkiDer.length - 32));
      return new InMemoryEd25519Signer(publicKey, privateKey);
    } finally {
      pkcs8Bytes.fill(0);
      privateKey.fill(0);
    }
  }

  private async getSigningKey(): Promise<CryptoKey> {
    if (!this.cryptoKeyPromise) {
      const subtle = globalThis.crypto?.subtle;
      if (!subtle) {
        throw new Error('ENVIRONMENT_ERROR: WebCrypto SubtleCrypto is unavailable.');
      }

      const pkcs8Bytes = wrapPrivateKeyPkcs8(this.privateKey);
      this.cryptoKeyPromise = subtle.importKey(
        'pkcs8',
        copyToArrayBuffer(pkcs8Bytes),
        { name: 'Ed25519' },
        false,
        ['sign']
      ).finally(() => pkcs8Bytes.fill(0));
    }
    return this.cryptoKeyPromise;
  }

  async sign(message: Uint8Array): Promise<Uint8Array> {
    if (this.destroyed) {
      throw new Error('SIGNER_DESTROYED: This signer has been destroyed.');
    }
    if (!(message instanceof Uint8Array)) {
      throw new TypeError('INVALID_INPUT: Signing message must be a Uint8Array.');
    }

    const subtle = globalThis.crypto?.subtle;
    if (!subtle) {
      throw new Error('ENVIRONMENT_ERROR: WebCrypto SubtleCrypto is unavailable.');
    }

    const signingKey = await this.getSigningKey();
    if (this.destroyed) {
      throw new Error('SIGNER_DESTROYED: This signer has been destroyed.');
    }

    const signature = await subtle.sign(
      { name: 'Ed25519' },
      signingKey,
      copyToArrayBuffer(message)
    );
    return new Uint8Array(signature);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.privateKey.fill(0);
    this.destroyed = true;
    this.cryptoKeyPromise = undefined;
  }
}

export async function verifyEd25519Signature(
  publicKey: Uint8Array,
  signature: Uint8Array,
  message: Uint8Array
): Promise<boolean> {
  if (!(publicKey instanceof Uint8Array) || publicKey.length !== 32) return false;
  if (!(signature instanceof Uint8Array) || signature.length !== 64) return false;
  if (!(message instanceof Uint8Array)) {
    throw new TypeError('INVALID_INPUT: Verification message must be a Uint8Array.');
  }

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('ENVIRONMENT_ERROR: WebCrypto SubtleCrypto is unavailable.');
  }
  const cryptoKey = await subtle.importKey(
    'raw',
    copyToArrayBuffer(publicKey),
    { name: 'Ed25519' },
    false,
    ['verify']
  );
  return subtle.verify(
    { name: 'Ed25519' },
    cryptoKey,
    copyToArrayBuffer(signature),
    copyToArrayBuffer(message)
  );
}
