/**
 * @file seller.ts
 * @description Seller side of an A2A escrow handshake.
 *
 * The seller receives the RohanAuditBundle and plaintext payload from the buyer
 * (via any side channel), verifies the cryptographic binding offline, and then
 * confirms the on-chain anchor via the Rohan relayer.
 *
 * Clone & run:
 *   npm install
 *   npm run seller -- '<BUNDLE_JSON>' '<PAYLOAD_JSON>'
 */

import {
  RohanClient,
  verifyAuditBundle,
} from '@rohan-protocol/sdk';

const CONTRACT_ADDRESS =
  '585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e';
const RELAYER_URL = 'https://api.rohanprotocol.network';

async function main() {
  // -----------------------------------------------------------------------
  // 1. Receive bundle + payload file paths from buyer (CLI args)
  // -----------------------------------------------------------------------
  const bundlePath = process.argv[2];
  const payloadPath = process.argv[3];

  if (!bundlePath || !payloadPath) {
    console.error('Usage: npm run seller -- <BUNDLE_FILE.json> <PAYLOAD_FILE.json>');
    process.exit(1);
  }

  const fs = await import('node:fs');
  const stripBom = (s: string) => s.replace(/^\uFEFF/, '');
  let bundle: any;
  let payload: any;
  try {
    bundle = JSON.parse(stripBom(fs.readFileSync(bundlePath, 'utf-8')));
    payload = JSON.parse(stripBom(fs.readFileSync(payloadPath, 'utf-8')));
  } catch (err) {
    console.error('❌ Failed to read/parse input files:', (err as Error).message);
    process.exit(1);
  }

  console.log('═══ ROHAN A2A ESCROW — SELLER ═══');
  console.log();

  // -----------------------------------------------------------------------
  // 2. Offline cryptographic verification (no network required)
  // -----------------------------------------------------------------------
  console.log('▶ Running offline bundle verification ...');
  const result = await verifyAuditBundle(bundle, payload);

  console.log('   valid             :', result.valid);
  console.log('   schemaValid       :', result.schemaValid);
  console.log('   payloadMatch      :', result.payloadMatch);
  console.log('   intentBindingValid:', result.intentBindingValid);
  console.log('   signatureValid    :', result.signatureValid);
  console.log('   computedDigest    :', result.computedPayloadDigest);
  console.log();

  if (!result.valid) {
    console.error('❌ Bundle verification failed!');
    if (result.errors?.length) {
      result.errors.forEach((e) => console.error('   -', e));
    }
    process.exit(1);
  }

  console.log('✅ Offline verification passed — payload cryptographically matches bundle.');
  console.log();

  // -----------------------------------------------------------------------
  // 3. On-chain anchor verification (relayer query)
  // -----------------------------------------------------------------------
  console.log('▶ Checking on-chain anchor via relayer ...');
  const client = new RohanClient({
    contractAddress: CONTRACT_ADDRESS,
    relayerUrl: RELAYER_URL,
  });

  const history = await client.getTransactionHistory(10);
  const found = history.transactions.find((tx) => tx.txHash === bundle.txHash);

  if (found) {
    console.log('✅ On-chain anchor confirmed');
    console.log('   txHash     :', found.txHash);
    console.log('   blockHeight:', found.blockHeight);
    console.log('   status     :', found.status);
    console.log('   timestamp  :', new Date(found.timestamp).toISOString());
  } else {
    console.warn(
      '⚠️  Transaction not found in last 10 history entries. It may still be propagating.'
    );
  }

  // -----------------------------------------------------------------------
  // 4. Ledger state cross-check
  // -----------------------------------------------------------------------
  const state = await client.getLedgerState();
  console.log();
  console.log('Ledger state root :', state.currentStateRoot);
  console.log('Ledger block height:', state.blockHeight);
  console.log('Network           :', state.network);
  console.log('Contract          :', state.contractAddress);

  console.log();
  console.log('═══ SELLER VERIFICATION COMPLETE ═══');
}

main().catch((err) => {
  console.error('❌ Seller failed:', err);
  process.exit(1);
});
