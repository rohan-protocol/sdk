/**
 * @rohan-protocol/sdk – Basic Handshake Example
 * 
 * This example shows two agents performing a ZK-Handshake:
 * Agent B listens for incoming deals, Agent A sends one.
 * 
 * Run: npx tsx examples/basic-handshake.ts
 */

import { RohanNode } from '../src/index.js';

async function main() {

  // ─── Agent B: The Verifier (listens on port 4001) ───────────

  const agentB = new RohanNode({
    port: 4001,
    walletKey: 'agent_b_secret_key_never_hardcode_this',
  });

  agentB.onHandshake((handshake) => {
    console.log(`\n🤝 [Agent B] Deal received from ${handshake.from}`);
    console.log(`   Commitment: ${handshake.commitment}`);
    console.log(`   Transaction: ${handshake.txId}`);
    console.log(`   Verified: ${handshake.verified}`);
  });

  await agentB.start();
  console.log(`Agent B DID: ${agentB.getDid()}\n`);

  // ─── Agent A: The Prover (sends the deal) ──────────────────

  const agentA = new RohanNode({
    port: 4002,
    walletKey: 'agent_a_secret_key_never_hardcode_this',
  });

  await agentA.start();
  console.log(`Agent A DID: ${agentA.getDid()}\n`);

  // ─── The Handshake ─────────────────────────────────────────

  const result = await agentA.handshake(
    'http://localhost:4001/api/zk-handshake',
    'NDA for Project Rohan – Confidential Value: $50,000',
    150
  );

  console.log('\n📋 Final Result:', result);

  // Cleanup
  await agentA.stop();
  await agentB.stop();
}

main().catch(console.error);
