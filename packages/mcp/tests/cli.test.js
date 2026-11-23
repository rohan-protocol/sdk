import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import {
  InMemoryEd25519Signer,
  RohanClient,
  computePayloadDigest,
} from '@rohan-protocol/sdk';

function createTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rohan-cli-test-'));
  return {
    dir,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

function runCliSubprocess(args, envOverrides = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['dist/server.js', ...args], {
      cwd: path.resolve('.'),
      env: { ...process.env, ...envOverrides },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => { stdout += c.toString('utf8'); });
    child.stderr.on('data', (c) => { stderr += c.toString('utf8'); });

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`CLI subprocess timed out for args: ${args.join(' ')}`));
    }, 6000);

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });

    child.stdin.end();
  });
}

test('CLI init provisions keystore safely, prints Claude config, and never leaks privateKeyHex', async (t) => {
  const temp = createTempDir();
  t.after(temp.cleanup);

  const env = { HOME: temp.dir };
  delete env.ROHAN_AGENT_PRIVATE_KEY;

  const res = await runCliSubprocess(['init'], {
    HOME: temp.dir,
    ROHAN_AGENT_PRIVATE_KEY: '',
  });
  assert.equal(res.code, 0);
  assert.match(res.stdout, /did:key:z6Mk/);
  assert.match(res.stdout, /"rohan-shield"/);
  assert.match(res.stdout, /--package/);

  const keystorePath = path.join(temp.dir, '.rohan', 'agent-identity.json');
  assert.equal(fs.existsSync(keystorePath), true);
  assert.equal(fs.statSync(keystorePath).mode & 0o777, 0o600);

  const stored = JSON.parse(fs.readFileSync(keystorePath, 'utf8'));
  assert.equal(res.stdout.includes(stored.privateKeyHex), false, 'Private key must NEVER appear on stdout!');
  assert.equal(res.stderr.includes(stored.privateKeyHex), false, 'Private key must NEVER appear on stderr!');
});

test('CLI status is strictly read-only on uninitialized HOME and fails closed on corrupted keystore', async (t) => {
  const temp = createTempDir();
  t.after(temp.cleanup);

  // 1. Uninitialized HOME -> exit 0, must NOT create ~/.rohan directory!
  const cleanRes = await runCliSubprocess(['status'], {
    HOME: temp.dir,
    ROHAN_AGENT_PRIVATE_KEY: '',
    ROHAN_RELAYER_URL: 'http://127.0.0.1:59999/api/v1/handshake',
  });
  assert.equal(cleanRes.code, 0);
  assert.match(cleanRes.stdout, /Not initialized/);
  assert.match(cleanRes.stdout, /OFFLINE/);
  assert.equal(fs.existsSync(path.join(temp.dir, '.rohan')), false);

  // 2. Corrupted keystore -> fail closed with exit code 1!
  const rohanDir = path.join(temp.dir, '.rohan');
  fs.mkdirSync(rohanDir, { mode: 0o700 });
  fs.writeFileSync(path.join(rohanDir, 'agent-identity.json'), '{ broken json', { mode: 0o600 });

  const corruptRes = await runCliSubprocess(['status'], {
    HOME: temp.dir,
    ROHAN_AGENT_PRIVATE_KEY: '',
  });
  assert.equal(corruptRes.code, 1);
  assert.match(corruptRes.stderr, /CORRUPTED_KEYSTORE/);
});

test('CLI verify audits RohanAuditBundle (valid, tampered plaintext, swapped digest) and raw SHA-256 digests', async (t) => {
  const temp = createTempDir();
  t.after(temp.cleanup);

  const signer = await InMemoryEd25519Signer.generate();
  t.after(() => signer.destroy());

  const deal = { customer: 'Acme AG', amountEur: 75000 };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    return new Response(
      JSON.stringify({
        success: true,
        status: 'confirmed',
        contractAddress: body.contractAddress,
        intentHash: body.publicInputs.intentHash,
        txHash: '0x00cli999',
        blockHeight: 3433500,
        timestamp: body.publicInputs.timestamp + 4000,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  let bundle;
  try {
    const client = new RohanClient({ network: 'preprod', signer });
    const receipt = await client.submitHandshake({
      intent: 'CLI Verification Deal',
      confidentialPayload: deal,
    });
    bundle = receipt.auditBundle;
  } finally {
    globalThis.fetch = originalFetch;
  }

  const payloadPath = path.join(temp.dir, 'deal.json');
  const tamperedPayloadPath = path.join(temp.dir, 'tampered-deal.json');
  const bundlePath = path.join(temp.dir, 'audit-bundle.json');
  const swappedBundlePath = path.join(temp.dir, 'swapped-bundle.json');

  fs.writeFileSync(payloadPath, JSON.stringify(deal));
  fs.writeFileSync(tamperedPayloadPath, JSON.stringify({ ...deal, amountEur: 75001 }));
  fs.writeFileSync(bundlePath, JSON.stringify(bundle));

  const fakeDigest = await computePayloadDigest({ ...deal, amountEur: 75001 });
  fs.writeFileSync(swappedBundlePath, JSON.stringify({ ...bundle, payloadDigest: fakeDigest }));

  // 1. Valid bundle + plaintext -> exit 0
  const okRes = await runCliSubprocess(['verify', payloadPath, bundlePath]);
  assert.equal(okRes.code, 0);
  assert.match(okRes.stdout, /AUDIT RESULT: VALID/);

  // 2. Tampered plaintext -> exit 1
  const badPlainRes = await runCliSubprocess(['verify', tamperedPayloadPath, bundlePath]);
  assert.equal(badPlainRes.code, 1);
  assert.match(badPlainRes.stdout, /INVALID/);

  // 3. Swapped digest attack -> exit 1 (INTENT_BINDING_MISMATCH)
  const swapRes = await runCliSubprocess(['verify', tamperedPayloadPath, swappedBundlePath]);
  assert.equal(swapRes.code, 1);
  assert.match(swapRes.stderr, /INTENT_BINDING_MISMATCH/);

  // 4. Raw digest string -> exit 0 on match, exit 1 on mismatch
  const digestOk = await runCliSubprocess(['verify', payloadPath, bundle.payloadDigest]);
  assert.equal(digestOk.code, 0);
  assert.match(digestOk.stdout, /DIGEST MATCH: VALID/);

  const digestBad = await runCliSubprocess(['verify', tamperedPayloadPath, bundle.payloadDigest]);
  assert.equal(digestBad.code, 1);

  // 5. Missing .json path -> FILE_NOT_FOUND (not invalid digest)
  const missingFileRes = await runCliSubprocess(['verify', payloadPath, path.join(temp.dir, 'missing.json')]);
  assert.equal(missingFileRes.code, 1);
  assert.match(missingFileRes.stderr, /FILE_NOT_FOUND/);
});

test('CLI rejects unknown subcommand immediately and default 0-arg invocation keeps stdout clean for stdio JSON-RPC', async (t) => {
  const temp = createTempDir();
  t.after(temp.cleanup);

  // 1. Unknown command exits 1 immediately
  const badCmd = await runCliSubprocess(['unknown-cmd']);
  assert.equal(badCmd.code, 1);
  assert.match(badCmd.stderr, /UNKNOWN_COMMAND/);

  // 2. --help exits 0
  const helpCmd = await runCliSubprocess(['--help']);
  assert.equal(helpCmd.code, 0);
  assert.match(helpCmd.stdout, /Usage:/);

  // 3. Default 0-arg mode emits 0 non-JSON-RPC bytes on stdout
  const seedHex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const stdioRes = await runCliSubprocess([], {
    HOME: temp.dir,
    ROHAN_AGENT_PRIVATE_KEY: seedHex,
  });
  assert.equal(stdioRes.stdout.trim(), '');
});
