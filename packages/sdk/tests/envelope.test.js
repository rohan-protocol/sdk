import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fromBase64Url,
  generateNonce,
  signEnvelope,
  toBase64Url,
  verifyEnvelope,
} from '../dist/identity/envelope.js';
import {
  generateEd25519KeyPair,
  InMemoryEd25519Signer,
} from '../dist/identity/did.js';

async function createSignedEnvelope() {
  const keyPair = await generateEd25519KeyPair();
  const signer = new InMemoryEd25519Signer(keyPair.publicKey, keyPair.privateKey);
  const envelope = {
    domain: 'rohan-handshake',
    version: 1,
    did: signer.did,
    network: 'preprod',
    contractAddress: '585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e',
    circuitName: 'verify_batched_handshakes',
    timestamp: 1730700000000,
    intentHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    nonce: generateNonce(),
  };
  return { signer, envelope, identity: await signEnvelope(envelope, signer) };
}

test('base64url codec round-trips bytes and rejects non-canonical input', () => {
  const bytes = new Uint8Array([0, 1, 2, 253, 254, 255]);
  const encoded = toBase64Url(bytes);

  assert.deepEqual(fromBase64Url(encoded), bytes);
  assert.throws(() => fromBase64Url(`${encoded}=`), /Padded base64url/);
  assert.throws(() => fromBase64Url('AB'), /Non-canonical/);
  assert.throws(() => fromBase64Url('not+base64url'), /invalid characters/);
});

test('signs and verifies a canonical v1 request envelope', async () => {
  const { envelope, identity } = await createSignedEnvelope();

  assert.equal(identity.did, envelope.did);
  assert.equal(identity.nonce, envelope.nonce);
  assert.equal(fromBase64Url(identity.signature).length, 64);
  assert.equal(await verifyEnvelope(envelope, identity), true);
});

test('rejects tampering with every signed envelope field', async () => {
  const { envelope, identity } = await createSignedEnvelope();
  const otherKeyPair = await generateEd25519KeyPair();
  const otherDid = new InMemoryEd25519Signer(otherKeyPair.publicKey, otherKeyPair.privateKey).did;
  const tamperedEnvelopes = [
    { ...envelope, domain: 'fake-handshake' },
    { ...envelope, version: 2 },
    { ...envelope, did: otherDid },
    { ...envelope, network: 'mainnet' },
    { ...envelope, contractAddress: '0'.repeat(64) },
    { ...envelope, circuitName: 'fake_circuit' },
    { ...envelope, timestamp: envelope.timestamp + 1000 },
    { ...envelope, intentHash: 'f'.repeat(64) },
    { ...envelope, nonce: generateNonce() },
  ];

  for (const tampered of tamperedEnvelopes) {
    assert.equal(await verifyEnvelope(tampered, identity), false);
  }
});

test('rejects signer mismatch and identity metadata mismatch', async () => {
  const { signer, envelope, identity } = await createSignedEnvelope();
  const otherKeyPair = await generateEd25519KeyPair();
  const otherSigner = new InMemoryEd25519Signer(otherKeyPair.publicKey, otherKeyPair.privateKey);

  await assert.rejects(signEnvelope(envelope, otherSigner), /SIGNER_MISMATCH/);
  assert.equal(await verifyEnvelope(envelope, { ...identity, nonce: generateNonce() }), false);
  assert.equal(await verifyEnvelope(envelope, { ...identity, algorithm: 'Other' }), false);

  signer.destroy();
  otherSigner.destroy();
});

test('rejects envelopes with extra fields or malformed values', async () => {
  const { envelope, identity } = await createSignedEnvelope();
  const withExtraField = { ...envelope, extra: true };
  const invalidTimestamp = { ...envelope, timestamp: Number.MAX_SAFE_INTEGER + 1 };

  assert.equal(await verifyEnvelope(withExtraField, identity), false);
  assert.equal(await verifyEnvelope(invalidTimestamp, identity), false);
});
