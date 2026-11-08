import test from 'node:test';
import assert from 'node:assert/strict';
import {
  base58btcDecode,
  base58btcEncode,
  createDidKey,
  generateEd25519KeyPair,
  InMemoryEd25519Signer,
  publicKeyFromDidKey,
  verifyEd25519Signature,
  wrapPrivateKeyPkcs8,
} from '../dist/identity/did.js';

const KNOWN_PUBLIC_KEY = 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a';
const KNOWN_DID = 'did:key:z6MktwupdmLXVVqTzCw4i46r4uGyosGXRnR3XjN4Zq7oMMsw';
const W3C_EXAMPLE_PUBLIC_KEY =
  '2e6fcce36701dc791488e0d0b1745cc1e33a4c1c9fcc41c63bd343dbbe0970e6';
const W3C_EXAMPLE_DID = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';

test('creates and resolves an Ed25519 did:key', () => {
  const publicKey = new Uint8Array(Buffer.from(KNOWN_PUBLIC_KEY, 'hex'));
  const did = createDidKey(publicKey);

  assert.equal(did, KNOWN_DID);
  assert.deepEqual(publicKeyFromDidKey(did), publicKey);
});

test('matches the W3C CCG did:key Ed25519 example vector', () => {
  const publicKey = new Uint8Array(Buffer.from(W3C_EXAMPLE_PUBLIC_KEY, 'hex'));

  assert.deepEqual(publicKeyFromDidKey(W3C_EXAMPLE_DID), publicKey);
  assert.equal(createDidKey(publicKey), W3C_EXAMPLE_DID);
});

test('Base58btc round-trips bytes and rejects invalid characters', () => {
  const bytes = new Uint8Array([0, 0, 0xed, 0x01, 0xff, 0x00]);
  const encoded = base58btcEncode(bytes);

  assert.deepEqual(base58btcDecode(encoded), bytes);
  assert.throws(() => base58btcDecode('0OIl'), /MALFORMED_BASE58/);
});

test('rejects unsupported, malformed, and wrong-length DIDs', () => {
  assert.throws(() => publicKeyFromDidKey('did:example:1234'), /UNSUPPORTED_DID/);
  assert.throws(() => publicKeyFromDidKey('did:key:z'), /MALFORMED_DID/);

  const wrongCodec = new Uint8Array([0xe7, 0x01, ...new Uint8Array(32)]);
  assert.throws(
    () => publicKeyFromDidKey(`did:key:z${base58btcEncode(wrongCodec)}`),
    /UNSUPPORTED_MULTICODEC/
  );
  assert.throws(
    () => publicKeyFromDidKey(`did:key:z1${base58btcEncode(wrongCodec)}`),
    /INVALID_DECODED_LENGTH/
  );
  assert.throws(() => createDidKey(new Uint8Array(31)), /INVALID_KEY_LENGTH/);
});

test('wraps a 32-byte Ed25519 seed in RFC 8410 PKCS#8', () => {
  const seed = new Uint8Array(32).fill(0x5a);
  const wrapped = wrapPrivateKeyPkcs8(seed);

  assert.equal(wrapped.length, 48);
  assert.deepEqual(wrapped.subarray(16), seed);
  assert.throws(() => wrapPrivateKeyPkcs8(new Uint8Array(31)), /INVALID_KEY_LENGTH/);
});

test('WebCrypto signer creates and verifies Ed25519 signatures', async () => {
  const keyPair = await generateEd25519KeyPair();
  assert.equal(keyPair.publicKey.length, 32);
  assert.equal(keyPair.privateKey.length, 32);

  const signer = new InMemoryEd25519Signer(keyPair.publicKey, keyPair.privateKey);
  const message = new TextEncoder().encode('Rohan Midnight Settlement Authorization V1');
  const signature = await signer.sign(message);

  assert.equal(signer.did, createDidKey(keyPair.publicKey));
  assert.equal(signature.length, 64);
  assert.equal(await verifyEd25519Signature(keyPair.publicKey, signature, message), true);
  assert.equal(
    await verifyEd25519Signature(
      keyPair.publicKey,
      signature,
      new TextEncoder().encode('Tampered Authorization Message')
    ),
    false
  );

  signer.destroy();
  await assert.rejects(signer.sign(message), /SIGNER_DESTROYED/);
});

test('signature verification rejects malformed key and signature lengths', async () => {
  assert.equal(
    await verifyEd25519Signature(new Uint8Array(31), new Uint8Array(64), new Uint8Array()),
    false
  );
  assert.equal(
    await verifyEd25519Signature(new Uint8Array(32), new Uint8Array(63), new Uint8Array()),
    false
  );
});
