import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {
  InMemoryEd25519Signer,
  RohanClient,
  verifyAuditBundle,
  computePayloadDigest,
  sealActionIntent,
} from '../dist/index.js';
import {
  verifyAuditBundle as verifyAuditBundleBrowserSafe,
  canonicalizeJson as jcsBrowserSafe,
} from '@rohan-protocol/sdk/identity';

test('identity subpath has zero static node:crypto imports (browser-safe for PR 4)', () => {
  const bundleJs = fs.readFileSync(new URL('../dist/identity/bundle.js', import.meta.url), 'utf8');
  const envJs = fs.readFileSync(new URL('../dist/identity/envelope.js', import.meta.url), 'utf8');
  const jcsJs = fs.readFileSync(new URL('../dist/security/jcs.js', import.meta.url), 'utf8');
  assert.equal(bundleJs.includes('node:crypto'), false);
  assert.equal(envJs.includes('node:crypto'), false);
  assert.equal(jcsJs.includes('node:crypto'), false);
  assert.equal(typeof verifyAuditBundleBrowserSafe, 'function');
  assert.equal(jcsBrowserSafe({ b: 2, a: 1 }), '{"a":1,"b":2}');
});

test('InMemoryEd25519Signer.generate() and fromPrivateKeyHex() work and keep keys intact after finally fill(0)', async () => {
  const gen = await InMemoryEd25519Signer.generate();
  assert.match(gen.did, /^did:key:z6Mk/);
  const sig1 = await gen.sign(new TextEncoder().encode('test-msg'));
  assert.equal(sig1.length, 64);

  const seedHex = '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60';
  const signerA = await InMemoryEd25519Signer.fromPrivateKeyHex(seedHex);
  const signerB = await InMemoryEd25519Signer.fromPrivateKeyHex(`0x${seedHex.toUpperCase()}`);
  assert.equal(signerA.did, signerB.did);

  const pkcs8Prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
  const privObj = crypto.createPrivateKey({
    key: Buffer.concat([pkcs8Prefix, Buffer.from(seedHex, 'hex')]),
    format: 'der',
    type: 'pkcs8',
  });
  const pubObj = crypto.createPublicKey(privObj);
  const msg = Buffer.from('roundtrip-check');
  const sig2 = await signerA.sign(new Uint8Array(msg));
  assert.equal(crypto.verify(null, msg, pubObj, Buffer.from(sig2)), true);

  await assert.rejects(() => InMemoryEd25519Signer.fromPrivateKeyHex('short'), /INVALID_KEY_FORMAT/);
  gen.destroy();
  signerA.destroy();
  signerB.destroy();
});

test('rejects passing both confidentialPayload and legacy privateData', async () => {
  const signer = await InMemoryEd25519Signer.generate();
  const client = new RohanClient({ signer });

  await assert.rejects(
    () =>
      client.submitHandshake({
        intent: 'Ambiguous',
        confidentialPayload: { a: 1 },
        privateData: { a: 1 },
      }),
    /INVALID_PAYLOAD/
  );
  signer.destroy();
});

test('full cryptographic chain: plaintext -> payloadDigest -> sealedIntent -> intentHash -> Ed25519 signature', async () => {
  const signer = await InMemoryEd25519Signer.generate();
  const originalFetch = globalThis.fetch;

  const dealA = { currency: 'EUR', amount: 50000, vendor: 'Acme GmbH' };
  const dealB = { vendor: 'Acme GmbH', amount: 50000, currency: 'EUR' };
  const expectedDigest = await computePayloadDigest(dealA);

  let sentBody = null;
  globalThis.fetch = async (_url, init) => {
    sentBody = JSON.parse(init.body);
    return new Response(
      JSON.stringify({
        success: true,
        status: 'confirmed',
        contractAddress: sentBody.contractAddress,
        intentHash: sentBody.publicInputs.intentHash,
        txHash: '0x00abc123',
        blockHeight: 3432999,
        timestamp: sentBody.publicInputs.timestamp + 27000, // +27s Relayer drift
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  try {
    const client = new RohanClient({ network: 'preprod', signer });
    const receipt = await client.submitHandshake({
      intent: 'Vendor Settlement (EU)',
      confidentialPayload: dealA,
    });

    assert.equal(receipt.payloadDigest, expectedDigest);
    assert.ok(receipt.auditBundle);
    assert.equal(receipt.auditBundle.actionSummary, 'Vendor Settlement (EU)');
    assert.equal(receipt.auditBundle.timestamp, sentBody.publicInputs.timestamp);
    assert.equal(receipt.auditBundle.settledAt, sentBody.publicInputs.timestamp + 27000);

    // 1. Valid full-chain offline verification
    const ok = await verifyAuditBundleBrowserSafe(receipt.auditBundle, dealB);
    assert.equal(ok.valid, true);
    assert.equal(ok.payloadMatch, true);
    assert.equal(ok.intentBindingValid, true);
    assert.equal(ok.signatureValid, true);

    // 2. Blocker-2 Attack A: Attacker swaps payloadDigest + plaintext while keeping valid outer intentHash + signature!
    const fakeDeal = { amount: 999999, vendor: 'Attacker Corp' };
    const fakeDigest = await computePayloadDigest(fakeDeal);
    const swappedDigestBundle = { ...receipt.auditBundle, payloadDigest: fakeDigest };
    const swapResult = await verifyAuditBundle(swappedDigestBundle, fakeDeal);
    assert.equal(swapResult.valid, false);
    assert.equal(swapResult.payloadMatch, true);       // Fake payload matches swapped digest
    assert.equal(swapResult.signatureValid, true);     // Outer signature still valid
    assert.equal(swapResult.intentBindingValid, false); // CAUGHT! Swapped digest is NOT bound to intentHash!

    // 3. Blocker-2 Attack B: Attacker deletes actionSummary to bypass binding check!
    const strippedBundle = { ...swappedDigestBundle };
    delete strippedBundle.actionSummary;
    const strippedResult = await verifyAuditBundle(strippedBundle, fakeDeal);
    assert.equal(strippedResult.valid, false);
    assert.equal(strippedResult.intentBindingValid, false);
  } finally {
    globalThis.fetch = originalFetch;
    signer.destroy();
  }
});

test('extracts actionSummary and payloadDigest automatically from sealActionIntent()', async () => {
  const signer = await InMemoryEd25519Signer.generate();
  const originalFetch = globalThis.fetch;
  const deal = { secretRate: 99, tier: 'enterprise' };
  const sealed = sealActionIntent('SLA Agreement (DACH)', deal);

  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    return new Response(
      JSON.stringify({
        success: true,
        status: 'confirmed',
        contractAddress: body.contractAddress,
        intentHash: body.publicInputs.intentHash,
        txHash: '0x00def456',
        timestamp: body.publicInputs.timestamp + 5000,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  try {
    const client = new RohanClient({ signer });
    const receipt = await client.submitHandshake({ intent: sealed });
    assert.equal(receipt.auditBundle.actionSummary, 'SLA Agreement (DACH)');
    const res = await verifyAuditBundle(receipt.auditBundle, deal);
    assert.equal(res.valid, true);
    assert.equal(res.intentBindingValid, true);
    assert.equal(res.signatureValid, true);
  } finally {
    globalThis.fetch = originalFetch;
    signer.destroy();
  }
});
