import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { RohanClient } from '../dist/client.js';

test('verifyCommitment accepts the canonical payload digest and prefixes', async () => {
  const client = new RohanClient();
  const payload = { amount: 10, recipient: 'alice' };
  const canonical = '{"amount":10,"recipient":"alice"}';
  const digest = crypto.createHash('sha256').update(canonical).digest('hex');

  const result = await client.verifyCommitment(payload, `sha256:${digest}`);

  assert.equal(result.valid, true);
  assert.equal(result.expectedDigest, digest);
});

test('verifyCommitment rejects the distinct outer intent hash', async () => {
  const client = new RohanClient();
  const payload = { amount: 10, recipient: 'alice' };
  const payloadDigest = crypto.createHash('sha256').update('{"amount":10,"recipient":"alice"}').digest('hex');
  const outerIntentHash = crypto.createHash('sha256')
    .update(`agent-1:Agreement (digest: sha256:${payloadDigest}):123`)
    .digest('hex');

  const result = await client.verifyCommitment(payload, outerIntentHash);

  assert.equal(result.valid, false);
  assert.equal(result.match, false);
});

test('getTransactionHistory clamps limits and calls the read endpoint', async () => {
  const client = new RohanClient({
    relayerUrl: 'https://relayer.example/api/v1/handshake',
    apiKey: 'test-key',
  });
  const originalFetch = globalThis.fetch;
  let requestUrl = '';
  let requestInit;

  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return new Response(JSON.stringify({
      success: true,
      contractAddress: 'contract',
      network: 'midnight-preprod',
      count: 0,
      transactions: [],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const result = await client.getTransactionHistory(100);

    assert.equal(requestUrl, 'https://relayer.example/api/v1/transactions?limit=50');
    assert.equal(requestInit.method, 'GET');
    assert.equal(requestInit.headers['x-rohan-api-key'], 'test-key');
    assert.equal(result.count, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
