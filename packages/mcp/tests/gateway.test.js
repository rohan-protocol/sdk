import test from 'node:test';
import assert from 'node:assert/strict';
import { RohanMcpGateway } from '../dist/gateway.js';

test('ADK tool defaults to the standardized execute-handshake name', () => {
  const gateway = new RohanMcpGateway();

  assert.equal(gateway.asAdkTool().name, 'rohan_execute_handshake');
  assert.equal(gateway.asLegacyAdkTool().name, 'rohan_zk_handshake');
});

test('standard and legacy ADK tool names share the same execution behavior', async () => {
  const gateway = new RohanMcpGateway();
  let submittedPayload;
  gateway.relayerClient.submitHandshake = async (payload) => {
    submittedPayload = payload;
    return { status: 'confirmed' };
  };
  const params = { agentId: 'agent-1', intent: 'test intent' };

  const standardResult = await gateway.asAdkTool().execute(params);
  const legacyResult = await gateway.asLegacyAdkTool().execute(params);

  assert.deepEqual(submittedPayload, params);
  assert.deepEqual(standardResult, { status: 'confirmed' });
  assert.deepEqual(legacyResult, { status: 'confirmed' });
});
