import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  InMemoryEd25519Signer,
  RohanClient,
} from '@rohan-protocol/sdk';
import {
  createRohanMcpServer,
} from '../dist/mcp-app.js';

function createTempIdentityDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rohan-mcp-ax-'));
  return {
    dir,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

function runStdioSession(requests, envOverrides = {}) {
  const expectedIds = new Set(requests.filter((r) => r.id !== undefined).map((r) => r.id));

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['dist/server.js'], {
      cwd: path.resolve('.'),
      env: { ...process.env, ...envOverrides },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdoutBuffer = '';
    let stderr = '';
    const responses = [];
    const seenIds = new Set();
    let ended = false;

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Stdio session timed out waiting for IDs.\nSEEN: ${[...seenIds]}\nSTDERR:\n${stderr}`));
    }, 6000);

    child.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk.toString('utf8');
      let nlIdx;
      while ((nlIdx = stdoutBuffer.indexOf('\n')) !== -1) {
        const line = stdoutBuffer.slice(0, nlIdx).trim();
        stdoutBuffer = stdoutBuffer.slice(nlIdx + 1);
        if (!line) continue;
        const parsed = JSON.parse(line);
        responses.push(parsed);
        if (parsed.id !== undefined) {
          seenIds.add(parsed.id);
        }
      }
      if (!ended && expectedIds.size > 0 && [...expectedIds].every((id) => seenIds.has(id))) {
        ended = true;
        child.stdin.end();
      }
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });

    child.on('close', () => {
      clearTimeout(timer);
      resolve({ responses, stderr });
    });

    for (const msg of requests) {
      child.stdin.write(JSON.stringify(msg) + '\n');
    }
  });
}

test('MCP stdio exposes instructions, resources capability, all 5 annotated tools, rohan://identity, and offline agent status', async (t) => {
  const temp = createTempIdentityDir();
  t.after(temp.cleanup);

  const seedHex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const expectedSigner = await InMemoryEd25519Signer.fromPrivateKeyHex(seedHex);
  t.after(() => expectedSigner.destroy());

  const { responses } = await runStdioSession(
    [
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'ax-test', version: '1.0.0' },
        },
      },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
      { jsonrpc: '2.0', id: 3, method: 'resources/list', params: {} },
      { jsonrpc: '2.0', id: 4, method: 'resources/read', params: { uri: 'rohan://identity' } },
      {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: { name: 'rohan_get_agent_status' }, // Omitted arguments!
      },
      {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: { name: 'rohan_verify_commitment', arguments: {} },
      },
    ],
    {
      HOME: temp.dir,
      ROHAN_AGENT_PRIVATE_KEY: seedHex,
      ROHAN_RELAYER_URL: 'http://127.0.0.1:59999/api/v1/handshake',
    }
  );

  // 1. Initialize response carries instructions and resources capability
  const initRes = responses.find((r) => r.id === 1).result;
  assert.ok(initRes.capabilities.resources);
  assert.ok(initRes.instructions.includes('CORE RULES FOR AGENTS'));
  assert.ok(initRes.instructions.includes('on Midnight Network (Ledger v9)'));
  assert.ok(initRes.instructions.includes('INVALID_SIGNATURE'));
  assert.ok(initRes.instructions.includes('rohan_get_agent_status'));

  // 2. All 5 tools listed with annotations & no top-level anyOf/oneOf in verify schema
  const tools = responses.find((r) => r.id === 2).result.tools;
  assert.equal(tools.length, 5);
  assert.deepEqual(
    tools.map((tool) => tool.name),
    [
      'rohan_execute_handshake',
      'rohan_get_ledger_state',
      'rohan_get_transaction_history',
      'rohan_verify_commitment',
      'rohan_get_agent_status',
    ]
  );

  const verifyTool = tools.find((tool) => tool.name === 'rohan_verify_commitment');
  assert.equal(verifyTool.annotations.readOnlyHint, true);
  assert.equal(verifyTool.annotations.openWorldHint, false);
  assert.equal('anyOf' in verifyTool.inputSchema, false);
  assert.equal('oneOf' in verifyTool.inputSchema, false);
  assert.deepEqual(verifyTool.inputSchema.required, []);

  // 3. Resources list & read rohan://identity
  const resources = responses.find((r) => r.id === 3).result.resources;
  assert.equal(resources[0].uri, 'rohan://identity');

  const readRes = responses.find((r) => r.id === 4).result;
  const identityDoc = JSON.parse(readRes.contents[0].text);
  assert.equal(identityDoc.agentDid, expectedSigner.did);
  assert.equal(identityDoc.signingMode, 'ed25519');
  assert.equal(JSON.stringify(identityDoc).includes(seedHex), false);

  // 4. rohan_get_agent_status gracefully degrades offline (no isError: true)
  const statusCall = responses.find((r) => r.id === 5).result;
  assert.notEqual(statusCall.isError, true);
  assert.equal(statusCall.structuredContent.relayerHealthy, false);
  assert.equal(statusCall.structuredContent.currentBlockHeight, null);
  assert.equal(statusCall.structuredContent.agentDid, expectedSigner.did);
  assert.equal(JSON.stringify(statusCall).includes(seedHex), false);

  // 5. Missing verify args returns structuredContent + recoveryAction + text content
  const verifyErr = responses.find((r) => r.id === 6).result;
  assert.equal(verifyErr.isError, true);
  assert.equal(verifyErr.structuredContent.code, 'INVALID_ARGUMENTS');
  assert.ok(verifyErr.structuredContent.recoveryAction);
  assert.ok(verifyErr.content[0].text);
});

test('agent status default timeout allows a cold-cache lookup longer than 3.5 seconds', async (t) => {
  const client = new RohanClient();
  client.getLedgerState = async () => {
    await new Promise((resolve) => setTimeout(resolve, 3700));
    return {
      success: true,
      status: 'confirmed',
      contractAddress: '585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e',
      currentStateRoot: 'a'.repeat(64),
      blockHeight: 42,
      lastTxHash: null,
      network: 'midnight-preprod',
      isMinedOnChain: true,
      fetchedAt: Date.now(),
    };
  };

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const mcpServer = createRohanMcpServer({
    contractAddress: '585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e',
    relayerUrl: 'https://api.rohanprotocol.network/api/v1/handshake',
    rohanClient: client,
  });
  const mcpClient = new Client({ name: 'timeout-test-client', version: '1.0.0' }, { capabilities: {} });

  try {
    await Promise.all([
      mcpServer.connect(serverTransport),
      mcpClient.connect(clientTransport),
    ]);

    const response = await mcpClient.callTool({
      name: 'rohan_get_agent_status',
      arguments: {},
    });
    assert.equal(response.structuredContent.relayerHealthy, true);
    assert.equal(response.structuredContent.currentBlockHeight, 42);
  } finally {
    await mcpClient.close().catch(() => {});
    await mcpServer.close().catch(() => {});
  }
});

test('MCP InMemoryTransport Client <-> Server: deduplicated auditBundle, offline verification & error taxonomy', async () => {
  const signer = await InMemoryEd25519Signer.generate();
  const originalFetch = globalThis.fetch;
  const deal = { contractId: 'B2B-99', totalUsd: 120000 };
  let callCount = 0;

  globalThis.fetch = async (_url, init) => {
    callCount++;
    if (callCount === 1) {
      const body = JSON.parse(init.body);
      return new Response(
        JSON.stringify({
          success: true,
          status: 'confirmed',
          contractAddress: body.contractAddress,
          intentHash: body.publicInputs.intentHash,
          txHash: '0x00fedcba',
          blockHeight: 3433100,
          timestamp: body.publicInputs.timestamp + 15000,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (callCount === 2) {
      return new Response(
        JSON.stringify({ error: 'Signed request nonce has already been used.' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(
      JSON.stringify({ error: 'INVALID_SIGNATURE: Ed25519 signature verification failed.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new RohanClient({ network: 'preprod', signer });
  const mcpServer = createRohanMcpServer({
    contractAddress: '585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e',
    relayerUrl: 'https://api.rohanprotocol.network/api/v1/handshake',
    rohanClient: client,
    configuredSigner: signer,
    loadedIdentity: { did: signer.did, source: 'env', filePath: undefined },
  });
  const mcpClient = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });

  try {
    await Promise.all([
      mcpServer.connect(serverTransport),
      mcpClient.connect(clientTransport),
    ]);

    // 1. Execute handshake via real MCP Client wire serialization
    const execRes = await mcpClient.callTool({
      name: 'rohan_execute_handshake',
      arguments: {
        actionSummary: 'B2B Escrow Deal',
        confidentialPayload: deal,
      },
    });
    assert.notEqual(execRes.isError, true);
    assert.ok(execRes.structuredContent.auditBundle);
    assert.ok(execRes.structuredContent.payloadDigest);
    // Deduplicated check: receipt must NOT contain auditBundle or payloadDigest a second time!
    assert.equal('auditBundle' in execRes.structuredContent.receipt, false);
    assert.equal('payloadDigest' in execRes.structuredContent.receipt, false);

    // 2. Verify returned auditBundle offline with plaintext
    const verifyOk = await mcpClient.callTool({
      name: 'rohan_verify_commitment',
      arguments: {
        auditBundle: execRes.structuredContent.auditBundle,
        payload: deal,
      },
    });
    assert.notEqual(verifyOk.isError, true);
    assert.equal(verifyOk.structuredContent.valid, true);
    assert.equal(verifyOk.structuredContent.intentBindingValid, true);
    assert.equal(verifyOk.structuredContent.signatureValid, true);

    // 3. Tamper plaintext -> invalid
    const verifyBad = await mcpClient.callTool({
      name: 'rohan_verify_commitment',
      arguments: {
        auditBundle: execRes.structuredContent.auditBundle,
        payload: { ...deal, totalUsd: 120001 },
      },
    });
    assert.equal(verifyBad.structuredContent.valid, false);
    assert.equal(verifyBad.structuredContent.payloadMatch, false);

    // 4. Replay error classification -> REPLAY_DETECTED
    const replayRes = await mcpClient.callTool({
      name: 'rohan_execute_handshake',
      arguments: { actionSummary: 'B2B Escrow Deal', confidentialPayload: deal },
    });
    assert.equal(replayRes.isError, true);
    assert.equal(replayRes.structuredContent.code, 'REPLAY_DETECTED');
    assert.equal(replayRes.structuredContent.retryable, false);

    // 5. 401 Invalid Signature classification -> INVALID_SIGNATURE
    const authErrRes = await mcpClient.callTool({
      name: 'rohan_execute_handshake',
      arguments: { actionSummary: 'B2B Escrow Deal', confidentialPayload: deal },
    });
    assert.equal(authErrRes.isError, true);
    assert.equal(authErrRes.structuredContent.code, 'INVALID_SIGNATURE');
    assert.equal(authErrRes.structuredContent.retryable, false);
    assert.ok(authErrRes.structuredContent.recoveryAction.includes('rohan_get_agent_status'));
  } finally {
    globalThis.fetch = originalFetch;
    await mcpClient.close().catch(() => {});
    await mcpServer.close().catch(() => {});
    signer.destroy();
  }
});
