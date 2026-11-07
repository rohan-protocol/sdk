import test from 'node:test';
import assert from 'node:assert/strict';
import { RohanClient } from '../dist/client.js';
import { verifyEnvelope } from '../dist/identity/envelope.js';
import {
  generateEd25519KeyPair,
  InMemoryEd25519Signer,
} from '../dist/identity/did.js';

test('generateHandshakeProof signs the request and binds agentId to signer DID', async () => {
  const keyPair = await generateEd25519KeyPair();
  const signer = new InMemoryEd25519Signer(keyPair.publicKey, keyPair.privateKey);
  const client = new RohanClient({ signer, network: 'testnet' });
  const timestamp = 1730700000000;

  const request = await client.generateHandshakeProof({
    agentId: signer.did,
    intent: 'test intent',
    timestamp,
  });

  assert.equal(request.publicInputs.agentId, signer.did);
  assert.equal(request.identity?.did, signer.did);
  assert.equal(request.contractAddress, '585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e');
  assert.equal(await verifyEnvelope({
    domain: 'rohan-handshake',
    version: 1,
    did: signer.did,
    network: 'testnet',
    contractAddress: request.contractAddress,
    circuitName: 'verify_batched_handshakes',
    timestamp,
    intentHash: request.publicInputs.intentHash,
    nonce: request.identity.nonce,
  }, request.identity), true);

  await assert.rejects(
    client.generateHandshakeProof({ agentId: 'unrelated-agent', intent: 'test intent', timestamp }),
    /SIGNER_MISMATCH/
  );
  signer.destroy();
});

test('generateHandshakeProof remains unsigned without a configured signer', async () => {
  const client = new RohanClient();
  const request = await client.generateHandshakeProof({ agentId: 'agent-1', intent: 'legacy intent' });

  assert.equal(request.identity, undefined);
  assert.equal(request.publicInputs.agentId, 'agent-1');
});

test('submitHandshake sends the signed identity block to the relayer', async () => {
  const keyPair = await generateEd25519KeyPair();
  const signer = new InMemoryEd25519Signer(keyPair.publicKey, keyPair.privateKey);
  const client = new RohanClient({ signer });
  const originalFetch = globalThis.fetch;
  let submittedBody;

  globalThis.fetch = async (_url, init) => {
    submittedBody = JSON.parse(init.body);
    return new Response(JSON.stringify({
      success: true,
      status: 'confirmed',
      contractAddress: submittedBody.contractAddress,
      intentHash: submittedBody.publicInputs.intentHash,
      txHash: '0x' + '1'.repeat(64),
      timestamp: submittedBody.publicInputs.timestamp,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    await client.submitHandshake({ agentId: signer.did, intent: 'signed intent' });
    assert.equal(submittedBody.identity.did, signer.did);
    assert.equal(submittedBody.identity.algorithm, 'Ed25519');
    assert.equal(submittedBody.identity.nonce.length, 43);
  } finally {
    globalThis.fetch = originalFetch;
    signer.destroy();
  }
});
