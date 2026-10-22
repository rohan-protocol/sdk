import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalizeJson, hashCanonicalJson, sealActionIntent } from '../dist/security/canonicalize.js';
import { MemorySanitizer } from '../dist/security/zeroize.js';

test('RFC 8785: canonicalizeJson produces deterministic, sorted output', () => {
  const obj1 = { z: 10, a: 1, m: { nested_b: 2, nested_a: 1 } };
  const obj2 = { m: { nested_a: 1, nested_b: 2 }, a: 1, z: 10 };

  const canonical1 = canonicalizeJson(obj1);
  const canonical2 = canonicalizeJson(obj2);

  assert.equal(canonical1, '{"a":1,"m":{"nested_a":1,"nested_b":2},"z":10}');
  assert.equal(canonical1, canonical2);
});

test('canonicalizeJson ignores undefined and functions', () => {
  const obj = { a: 1, b: undefined, c: () => {} };
  assert.equal(canonicalizeJson(obj), '{"a":1}');
});

test('hashCanonicalJson produces identical hash regardless of property order', () => {
  const h1 = hashCanonicalJson({ b: 'secret', a: 42 });
  const h2 = hashCanonicalJson({ a: 42, b: 'secret' });
  assert.equal(h1, h2);
  assert.equal(typeof h1, 'string');
  assert.equal(h1.length, 64);
});

test('sealActionIntent correctly appends sha256 digest', () => {
  const unsealed = sealActionIntent('Execute tool');
  assert.equal(unsealed, 'Execute tool');

  const sealed = sealActionIntent('Execute tool', { param: 'confidential' });
  assert.match(sealed, /^Execute tool \(digest: sha256:[a-f0-9]{64}\)$/);
});

test('MemorySanitizer.wipe zeroizes sensitive buffers (Vector V-02)', () => {
  const buf = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
  MemorySanitizer.wipe(buf);
  for (let i = 0; i < buf.length; i++) {
    assert.equal(buf[i], 0);
  }
});

test('MemorySanitizer.withSecureWitness wipes buffer after execution or exception', async () => {
  const witness1 = new Uint8Array([1, 2, 3, 4]);
  const res = await MemorySanitizer.withSecureWitness(witness1, async (w) => {
    assert.equal(w[0], 1);
    return 'ok';
  });
  assert.equal(res, 'ok');
  assert.equal(witness1[0], 0);

  const witness2 = new Uint8Array([5, 6, 7, 8]);
  await assert.rejects(async () => {
    await MemorySanitizer.withSecureWitness(witness2, async () => {
      throw new Error('Simulated failure');
    });
  });
  assert.equal(witness2[0], 0);
});
