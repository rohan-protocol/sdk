import assert from 'node:assert/strict';
import test from 'node:test';
import {
  publicKeyFromDidKey,
  verifyEd25519Signature,
} from '@rohan-protocol/sdk';
import { resolveSignerFromEnv } from '../dist/identity.js';

const TEST_SEED_HEX = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

test('derives a matching Ed25519 signer from a 32-byte hex seed', async () => {
  const signer = await resolveSignerFromEnv(TEST_SEED_HEX);
  assert.ok(signer);

  const message = new TextEncoder().encode('Rohan Protocol V-08 Verification');
  const signature = await signer.sign(message);
  const publicKey = publicKeyFromDidKey(signer.did);

  assert.equal(await verifyEd25519Signature(publicKey, signature, message), true);
});

test('does not configure a signer when no private key is provided', async () => {
  assert.equal(await resolveSignerFromEnv(undefined), undefined);
  assert.equal(await resolveSignerFromEnv('  '), undefined);
});

test('fails explicitly when a configured private key is malformed', async () => {
  await assert.rejects(
    resolveSignerFromEnv('not-a-private-key'),
    /ROHAN_AGENT_PRIVATE_KEY must be exactly 32 bytes/
  );
});
