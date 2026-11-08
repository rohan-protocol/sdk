import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  publicKeyFromDidKey,
  verifyEd25519Signature,
} from '@rohan-protocol/sdk';
import {
  loadKeystoreFile,
  resolveAgentIdentity,
  saveKeystoreFile,
} from '../dist/identity/keystore.js';
import {
  resolveHandshakeAgentId,
  ROHAN_HANDSHAKE_TOOL_SCHEMA,
  validateActionSummary,
  validateHandshakeArguments,
} from '../dist/identity/handshake.js';

const TEST_SEED_HEX = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function createTempKeystorePath() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rohan-identity-'));
  return {
    directory,
    filePath: path.join(directory, 'agent-identity.json'),
    cleanup: () => fs.rmSync(directory, { recursive: true, force: true }),
  };
}

test('auto-provisions a persistent identity and reloads the same signer', async (t) => {
  const temp = createTempKeystorePath();
  t.after(temp.cleanup);

  const created = await resolveAgentIdentity({ privateKeyHex: '', filePath: temp.filePath });
  const loaded = await resolveAgentIdentity({ privateKeyHex: '', filePath: temp.filePath });

  assert.equal(created.source, 'auto-provisioned');
  assert.equal(loaded.source, 'filesystem');
  assert.equal(loaded.did, created.did);
  assert.equal(fs.statSync(temp.directory).mode & 0o777, 0o700);
  assert.equal(fs.statSync(temp.filePath).mode & 0o777, 0o600);
  assert.equal(fs.statSync(temp.filePath).nlink, 1);
});

test('concurrent first-run provisioning never overwrites the winning identity', async (t) => {
  const temp = createTempKeystorePath();
  t.after(temp.cleanup);

  const [first, second] = await Promise.all([
    resolveAgentIdentity({ privateKeyHex: '', filePath: temp.filePath }),
    resolveAgentIdentity({ privateKeyHex: '', filePath: temp.filePath }),
  ]);
  const restored = await resolveAgentIdentity({ privateKeyHex: '', filePath: temp.filePath });

  assert.equal(first.did, second.did);
  assert.equal(restored.did, first.did);
  assert.equal(fs.statSync(temp.filePath).mode & 0o777, 0o600);
});

test('provisioned keystore permissions stay strict under a restrictive umask', async (t) => {
  const temp = createTempKeystorePath();
  t.after(temp.cleanup);
  const previousUmask = process.umask(0o777);
  try {
    await resolveAgentIdentity({ privateKeyHex: '', filePath: temp.filePath });
  } finally {
    process.umask(previousUmask);
  }
  assert.equal(fs.statSync(temp.directory).mode & 0o777, 0o700);
  assert.equal(fs.statSync(temp.filePath).mode & 0o777, 0o600);
});

test('environment seed takes precedence and malformed explicit seed fails closed', async (t) => {
  const temp = createTempKeystorePath();
  t.after(temp.cleanup);
  fs.writeFileSync(temp.filePath, '{ broken', { mode: 0o600 });

  const fromEnv = await resolveAgentIdentity({ privateKeyHex: TEST_SEED_HEX, filePath: temp.filePath });
  const message = new TextEncoder().encode('Rohan Protocol V-08 Verification');
  const signature = await fromEnv.signer.sign(message);
  const publicKey = publicKeyFromDidKey(fromEnv.did);
  assert.equal(fromEnv.source, 'env');
  assert.equal(await verifyEd25519Signature(publicKey, signature, message), true);

  await assert.rejects(
    resolveAgentIdentity({ privateKeyHex: 'malformed', filePath: temp.filePath }),
    /ROHAN_AGENT_PRIVATE_KEY is set/
  );
  assert.equal(fs.readFileSync(temp.filePath, 'utf8'), '{ broken');
});

test('refuses to replace a corrupted or mismatched keystore', async (t) => {
  const temp = createTempKeystorePath();
  t.after(temp.cleanup);
  fs.writeFileSync(temp.filePath, '{ broken', { mode: 0o600 });

  await assert.rejects(
    resolveAgentIdentity({ privateKeyHex: '', filePath: temp.filePath }),
    /CORRUPTED_KEYSTORE/
  );
  assert.equal(fs.readFileSync(temp.filePath, 'utf8'), '{ broken');

  fs.unlinkSync(temp.filePath);
  const validIdentity = await resolveAgentIdentity({ privateKeyHex: TEST_SEED_HEX, filePath: temp.filePath });
  fs.writeFileSync(temp.filePath, JSON.stringify({
    did: `${validIdentity.did}tampered`,
    privateKeyHex: TEST_SEED_HEX,
    createdAt: Date.now(),
  }), { mode: 0o600 });
  await assert.rejects(loadKeystoreFile(temp.filePath), /Stored DID does not match/);
});

test('rejects symlinked keystore paths', async (t) => {
  if (process.platform === 'win32') t.skip('Symlink behavior is platform-dependent on Windows.');
  const temp = createTempKeystorePath();
  t.after(temp.cleanup);
  const target = path.join(temp.directory, 'target.json');
  const link = path.join(temp.directory, 'agent-identity.json');
  fs.writeFileSync(target, '{}', { mode: 0o600 });
  fs.symlinkSync(target, link);

  await assert.rejects(loadKeystoreFile(link), /symbolic link|ELOOP/);
});

test('requires actionSummary and resolves optional agentId to the signer DID', async () => {
  const temp = createTempKeystorePath();
  try {
    const { signer } = await resolveAgentIdentity({ privateKeyHex: TEST_SEED_HEX, filePath: temp.filePath });
    assert.deepEqual(ROHAN_HANDSHAKE_TOOL_SCHEMA.inputSchema.required, ['actionSummary']);
    assert.equal(ROHAN_HANDSHAKE_TOOL_SCHEMA.inputSchema.required.includes('agentId'), false);
    assert.equal(ROHAN_HANDSHAKE_TOOL_SCHEMA.inputSchema.properties.intent.deprecated, true);
    assert.equal(validateActionSummary('   '), 'INVALID_ARGUMENTS: actionSummary is required and cannot be empty.');
    assert.equal(validateActionSummary(undefined), 'INVALID_ARGUMENTS: actionSummary is required and cannot be empty.');
    assert.equal(validateActionSummary('Review settlement'), undefined);
    assert.match(
      validateHandshakeArguments({ actionSummary: 'review', privateKey: TEST_SEED_HEX }),
      /unsupported properties/
    );
    assert.match(
      validateHandshakeArguments({ intent: 'legacy-only' }),
      /actionSummary is required/
    );
    assert.match(
      validateHandshakeArguments({ actionSummary: 'review', intent: {} }),
      /Deprecated intent must be a string/
    );
    assert.deepEqual(resolveHandshakeAgentId(undefined, signer), { agentId: signer.did });
    assert.deepEqual(resolveHandshakeAgentId(signer.did, signer), { agentId: signer.did });
    assert.match(resolveHandshakeAgentId('did:key:other', signer).error, /^IDENTITY_MISMATCH:/);
    assert.match(resolveHandshakeAgentId(undefined).error, /^MISSING_AGENT_ID:/);
  } finally {
    temp.cleanup();
  }
});

test('refuses to overwrite an existing keystore when saving', async (t) => {
  const temp = createTempKeystorePath();
  t.after(temp.cleanup);

  await resolveAgentIdentity({ privateKeyHex: '', filePath: temp.filePath });
  const data = JSON.parse(fs.readFileSync(temp.filePath, 'utf8'));

  await assert.rejects(
    saveKeystoreFile(temp.filePath, data),
    /already exists/
  );
});
