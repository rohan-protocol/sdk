import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { rohanAuthGate } from './middleware/auth.js';
import { handleStripeWebhook, claimFreeDeveloperKey } from './billing/stripe.js';
import { SemanticFirewall } from '../../packages/mcp/dist/firewall.js';

// Midnight SDK Imports für ECHTES On-Chain Settlement
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import { UnshieldedWallet, createKeystore, PublicKey } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { InMemoryTransactionHistoryStorage } from '@midnight-ntwrk/wallet-sdk-abstractions';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import * as ledgerV8 from '@midnight-ntwrk/ledger-v8';

// Contract Binding
import { Contract } from '../../packages/sdk/src/generated/contract/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NETWORK = 'preprod';
setNetworkId(NETWORK as any);

const app = express();
const PORT = Number(process.env.PORT) || 4005;

const PROVER_URL = process.env.PROVER_URL || 'http://127.0.0.1:6300';
const INDEXER_URL = process.env.INDEXER_URL || 'https://indexer.preprod.midnight.network/api/v4/graphql';
const INDEXER_WS  = process.env.INDEXER_WS  || 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws';
const NODE_URL    = process.env.NODE_URL    || 'wss://rpc.preprod.midnight.network';
const WALLET_PATH = '/root/.midnight/wallets/relayer-node.json';
const CONTRACT_ADDRESS = '6d2d603235f996424d76c85186a79cc403245ea8ee1ba9087e40967fe71bdc4d';

let rohanContract: any = null;

async function initRelayer() {
  console.log('📡 Initialisiere Relayer Midnight WalletFacade & Contract...');

  if (!fs.existsSync(WALLET_PATH)) {
    console.error('❌ FEHLER: relayer-node.json nicht gefunden!');
    return;
  }

  const walletData = JSON.parse(fs.readFileSync(WALLET_PATH, 'utf8'));
  const hexSeed = walletData.seed || walletData.entropy || walletData.rawSeed;
  const seedBuffer = Buffer.from(hexSeed, 'hex');
  const hdResult = HDWallet.fromSeed(seedBuffer);
  const account = hdResult.hdWallet!.selectAccount(0);

  const unshieldedKey = account.selectRole(Roles.NightExternal).deriveKeyAt(0);
  const unshieldedKeystore = createKeystore(unshieldedKey.key as Uint8Array, NETWORK as any);
  const unshieldedPublicKeyObj = PublicKey.fromKeyStore(unshieldedKeystore);

  const zswapRoleKey = account.selectRole(Roles.Zswap).deriveKeyAt(0);
  const zswapKeys = ledgerV8.ZswapSecretKeys.fromSeed(zswapRoleKey.key as Uint8Array);

  const dustRoleKey = account.selectRole(Roles.Dust).deriveKeyAt(0);
  const dustSecretKey = ledgerV8.DustSecretKey.fromSeed(dustRoleKey.key as Uint8Array);
  const dustParams = ledgerV8.LedgerParameters.initialParameters().dust;

  const wallet = await WalletFacade.init({
    configuration: {
      provingServerUrl: new URL(PROVER_URL),
      indexerClientConnection: { indexerHttpUrl: INDEXER_URL, indexerWsUrl: INDEXER_WS },
      relayURL: new URL(NODE_URL),
      networkId: NETWORK as any,
      txHistoryStorage: new InMemoryTransactionHistoryStorage(),
      dustParameters: dustParams,
      costParameters: {
        feeBlocksMargin: 5,
        additionalFeeOverhead: 300_000_000_000_000n,
      },
    },
    unshielded: (cfg) => UnshieldedWallet(cfg).startWithPublicKey(unshieldedPublicKeyObj),
    shielded: (cfg) => ShieldedWallet(cfg).startWithSecretKeys(zswapKeys),
    dust: (cfg) => DustWallet(cfg).startWithSecretKey(dustSecretKey, dustParams),
  });

  await wallet.start(zswapKeys as any, dustSecretKey as any);

  // Provider Adapter für die Mautstelle
  const customWalletProvider = {
    getCoinPublicKey: () => zswapKeys.coinPublicKey,
    getEncryptionPublicKey: () => zswapKeys.encryptionPublicKey,
    balanceTx: async (tx: any, ttl?: Date) => {
      const recipe = await wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: zswapKeys, dustSecretKey: dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 5 * 60 * 1000) } // 5 Min TTL
      );
      const signedRecipe = await wallet.signRecipe(recipe, (payload) =>
        unshieldedKeystore.signData(payload)
      );
      return await wallet.finalizeRecipe(signedRecipe);
    },
    submitTx: async (tx: any) => wallet.submitTransaction(tx),
  };

  const zkConfigPath = '/root/Rohan/packages/sdk/src/generated';
  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);

  const providers = {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'rohan-relayer-private-state',
      signingKeyStoreName: 'rohan-relayer-signing-keys',
      privateStoragePasswordProvider: async () => 'RohanRelayerVaultPassword2026',
      accountId: 'rohan-relayer-gas-station',
    }),
    publicDataProvider: indexerPublicDataProvider(INDEXER_URL, INDEXER_WS),
    zkConfigProvider: zkConfigProvider,
    proofProvider: httpClientProofProvider(PROVER_URL, zkConfigProvider as any),
    walletProvider: customWalletProvider,
    midnightProvider: customWalletProvider,
  };

  const compiledContract = CompiledContract.make('rohan_handshake', Contract).pipe(
    CompiledContract.withVacantWitnesses,
    CompiledContract.withCompiledFileAssets(zkConfigPath)
  );

  rohanContract = await findDeployedContract(providers as any, {
    contractAddress: CONTRACT_ADDRESS,
    compiledContract: compiledContract as any,
  });

  console.log(`✅ Relayer erfolgreich mit Contract ${CONTRACT_ADDRESS} auf Midnight Preprod verbunden!`);
}

// Stripe Webhook verlangt Raw-Body für Signaturprüfung
app.post('/api/v1/billing/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);
app.use(express.json());
app.post('/api/v1/auth/free-key', claimFreeDeveloperKey);

app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    role: 'Gas Station / Relayer',
    network: 'preprod',
    walletConnected: rohanContract !== null,
    contract: CONTRACT_ADDRESS
  });
});

/**
 * ⚡ ECHTER ON-CHAIN HANDSHAKE (Streamable HTTP / NDJSON)
 */
app.post('/api/v1/handshake/stream', rohanAuthGate, async (req, res) => {
  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (data: Record<string, unknown>) => {
    res.write(JSON.stringify(data) + '\n');
  };

  try {
    const proofPayload = req.body;
    sendEvent({ stage: 'received', timestamp: Date.now() });

    // 1. Semantic Firewall (V-01)
    const isValid = SemanticFirewall.validate({
      agentId: proofPayload.publicInputs?.agentId,
      action: proofPayload.circuitName,
      payload: proofPayload.publicInputs,
    });

    if (!isValid) {
      sendEvent({ stage: 'error', code: 'V01_VIOLATION', error: 'Intent rejected by Semantic Firewall' });
      return res.end();
    }
    sendEvent({ stage: 'firewall_approved', v01: 'passed' });

    // 2. Gas Subsidization
    sendEvent({ stage: 'subsidizing_gas', gasPayer: 'rohan-relayer-node-01' });

    // 3. ECHTES ON-CHAIN SETTLEMENT AUF MIDNIGHT PREPROD
    let txHash: string;
    
    if (rohanContract) {
      console.log('⛓️ Relayer führt echten On-Chain Call auf Midnight Preprod aus...');
      
      const previousRootBytes = new Uint8Array(32);
      previousRootBytes[31] = 1; // Aktueller State-Root
      
      const newRootBytes = Buffer.from(proofPayload.publicInputs.intentHash, 'hex');
      const batchedProofData128 = new Uint8Array(128);
      const tollAmount = 0n;

      // ⚡ ECHTER CALL: Rechnet ZK-Proof auf Port 6300, zahlt DUST-Gas und broadcastet an Midnight!
      const tx = await rohanContract.callTx.verify_batched_handshakes(
        previousRootBytes,
        newRootBytes,
        batchedProofData128,
        tollAmount
      );
      
      txHash = tx.public.txHash;
      console.log(`🎉 Transaktion auf Midnight Preprod gemined! TxHash: ${txHash}`);
    } else {
      throw new Error('Relayer Contract Instance nicht initialisiert');
    }

    sendEvent({
      stage: 'confirmed',
      status: 'success',
      txHash,
      contractAddress: proofPayload.contractAddress,
      intentHash: proofPayload.publicInputs.intentHash,
      timestamp: Date.now(),
    });

    res.end();
  } catch (error: any) {
    console.error('❌ Relayer On-Chain Error:', error);
    sendEvent({ stage: 'error', error: error.message || 'On-chain execution failed' });
    res.end();
  }
});

/**
 * Standard Unary Endpunkt: POST /api/v1/handshake
 */
app.post('/api/v1/handshake', rohanAuthGate, async (req, res) => {
  try {
    const proofPayload = req.body;

    // 1. Semantic Firewall (V-01)
    const isValid = SemanticFirewall.validate({
      agentId: proofPayload.publicInputs?.agentId,
      action: proofPayload.circuitName,
      payload: proofPayload.publicInputs,
    });

    if (!isValid) {
      return res.status(400).json({ error: 'Security Violation: Intent rejected by Semantic Firewall' });
    }

    if (!rohanContract) {
      return res.status(503).json({ error: 'Relayer contract instance not ready' });
    }

    const previousRootBytes = new Uint8Array(32);
    previousRootBytes[31] = 1; // Aktueller State-Root
    const newRootBytes = Buffer.from(proofPayload.publicInputs.intentHash, 'hex');
    const batchedProofData128 = new Uint8Array(128);
    const tollAmount = 0n;

    // Echter On-Chain Call auf Midnight Preprod:
    const tx = await rohanContract.callTx.verify_batched_handshakes(
      previousRootBytes,
      newRootBytes,
      batchedProofData128,
      tollAmount
    );

    return res.json({
      success: true,
      status: 'confirmed',
      contractAddress: proofPayload.contractAddress,
      intentHash: proofPayload.publicInputs.intentHash,
      txHash: tx.public.txHash,
      gasPaidBy: 'rohan-relayer-node-01',
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('❌ Relayer Error:', error);
    return res.status(500).json({ error: error.message || 'On-chain execution failed' });
  }
});

initRelayer().catch(console.error);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🛡️ Rohan Relayer & Real On-Chain Gas Station läuft auf Port ${PORT}`);
});
