/**
 * @file buyer.ts
 * @description Buyer side of an A2A escrow handshake.
 *
 * The buyer creates a purchase order, anchors it on Midnight L1 via
 * RohanProtocol, and produces a RohanAuditBundle + confidential payload
 * that can be handed to the seller over any side channel (email, chat, file).
 *
 * Clone & run:
 *   npm install
 *   npm run buyer
 */

import {
  RohanClient,
  InMemoryEd25519Signer,
  computePayloadDigest,
} from '@rohan-protocol/sdk';

const CONTRACT_ADDRESS =
  '585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e';
const RELAYER_URL = 'https://api.rohanprotocol.network';

async function main() {
  // -----------------------------------------------------------------------
  // 1. Create two sovereign agent identities (Buyer + Seller)
  // -----------------------------------------------------------------------
  const buyer = await InMemoryEd25519Signer.generate();
  const seller = await InMemoryEd25519Signer.generate();

  console.log('═══ ROHAN A2A ESCROW — BUYER ═══');
  console.log('Buyer DID :', buyer.did);
  console.log('Seller DID:', seller.did);
  console.log();

  try {
    // -----------------------------------------------------------------------
    // 2. Configure the Rohan client anchored at the Midnight Preprod contract
    // -----------------------------------------------------------------------
    const client = new RohanClient({
      contractAddress: CONTRACT_ADDRESS,
      relayerUrl: RELAYER_URL,
      signer: buyer,
    });

    // -----------------------------------------------------------------------
    // 3. Define the confidential deal (off-chain data)
    // -----------------------------------------------------------------------
    const dealPayload = {
      buyer: 'Buyer-Agent',
      seller: 'Seller-Agent',
      item: 'Server Cluster',
      amountEUR: 12000,
      currency: 'EUR',
      reference: 'PO-2026-001',
      terms: 'Net 30 days, delivery by 2026-12-31',
    } as const;

    // -----------------------------------------------------------------------
    // 4. Submit handshake — anchors commitment on Midnight L1 in ONE call.
    //    The SDK automatically computes payloadDigest (RFC 8785 JCS + SHA-256),
    //    signs the V-08 envelope, and returns receipt.auditBundle ready for
    //    offline verification by the seller. No manual generateHandshakeProof()
    //    or buildAuditBundle() chaining required.
    // -----------------------------------------------------------------------
    console.log('▶ Submitting handshake to Midnight L1 ...');
    const receipt = await client.submitHandshake({
      intent: 'Purchase Order PO-2026-001',
      confidentialPayload: dealPayload,
    });

    const auditBundle = receipt.auditBundle!;

    console.log('✅ Handshake confirmed');
    console.log('   txHash     :', receipt.txHash);
    console.log('   intentHash :', receipt.intentHash);
    console.log('   blockHeight:', receipt.blockHeight);
    console.log();

    // -----------------------------------------------------------------------
    // 5. Output bundle + payload for the seller
    // -----------------------------------------------------------------------
    console.log('═══ BUNDLE FOR SELLER (copy this JSON + payload JSON) ═══');
    console.log('--- RohanAuditBundle ---');
    console.log(JSON.stringify(auditBundle, null, 2));
    console.log();
    console.log('--- Confidential Payload (plaintext) ---');
    console.log(JSON.stringify(dealPayload, null, 2));
    console.log();
    console.log('--- Computed Payload Digest (seller should match this) ---');
    console.log(await computePayloadDigest(dealPayload));
    console.log();
    console.log('Next step: run the seller with:');
    console.log('  npm run seller -- bundle.json payload.json');
  } finally {
    // -----------------------------------------------------------------------
    // Cleanup identities from RAM (always, even on error)
    // -----------------------------------------------------------------------
    buyer.destroy();
    seller.destroy();
  }
}

main().catch((err) => {
  console.error('❌ Buyer failed:', err);
  process.exit(1);
});
