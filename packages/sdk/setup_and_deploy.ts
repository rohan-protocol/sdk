/**
 * setup_and_deploy.ts — Clean Slate All-in-One
 * 
 * Flow: Seed → Unshielded-Adresse → Faucet → Shield → tDUST → Deploy
 * 
 * 1. Generiert/lädt einen 32-Byte Hex-Seed
 * 2. Leitet die Unshielded-Adresse ab (für Faucet)
 * 3. Initialisiert WalletBuilder (Preprod, Prover auf VPS)
 * 4. Pollt den State alle 15s
 * 5. Wenn tNIGHT > 0: Shieldet automatisch
 * 6. Wenn tDUST > 0: Deployt den Contract
 */

// WAF Bypass MUSS vor allen SDK-Imports stehen
import './polyfill.js';

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

// Wallet & Zswap
import { WalletBuilder } from '@midnight-ntwrk/wallet';
import { NetworkId } from '@midnight-ntwrk/zswap';
import { firstValueFrom } from 'rxjs';

// HD Wallet für Unshielded-Adresse
import * as hd from '@midnight-ntwrk/wallet-sdk-hd';
import { createKeystore } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';

// Midnight-JS für Contract-Deployment
import { contracts, networkId } from '@midnight-ntwrk/midnight-js';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { Contract } from '../src/generated/contract/index.js';
import { CompiledContract } from '@midnight-ntwrk/compact-js';

// ─────────────────────────────────────────────
// KONFIGURATION
// ─────────────────────────────────────────────
const INDEXER_URL = 'https://indexer.preprod.midnight.network/api/v4/graphql';
const INDEXER_WS  = 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws';
const PROVER_URL  = 'http://127.0.0.1:6300';  // Docker Proof-Server lokal auf VPS
const NODE_URL    = 'wss://rpc.preprod.midnight.network';
const ENV_PATH    = path.resolve(process.cwd(), '.env');

// tNIGHT = native token (35 Bytes = 70 hex chars, all zeros)
const NATIVE_TOKEN_TYPE = '00'.repeat(35);

// ─────────────────────────────────────────────
// HILFSFUNKTIONEN
// ─────────────────────────────────────────────

function generateOrLoadSeed(): string {
    const existingSeed = process.env.RELAYER_HOT_WALLET_SEED;

    // Wenn bereits ein 32-Byte Hex-Seed in .env steht, nutzen wir den
    if (existingSeed && !existingSeed.includes(' ') && existingSeed.length === 64) {
        console.log(`🔑 Vorhandener 32-Byte Hex-Seed gefunden: ${existingSeed.substring(0, 16)}...`);
        return existingSeed;
    }

    // Frischen Seed generieren
    console.log('🔑 Generiere frischen 32-Byte nativen Hex-Seed...');
    const seed = crypto.randomBytes(32).toString('hex');

    // In .env schreiben/überschreiben
    let envContent = '';
    if (fs.existsSync(ENV_PATH)) {
        envContent = fs.readFileSync(ENV_PATH, 'utf-8');
        envContent = envContent.split('\n')
            .filter(line => !line.startsWith('RELAYER_HOT_WALLET_SEED='))
            .join('\n');
    }
    envContent = `RELAYER_HOT_WALLET_SEED=${seed}\n${envContent}`.trim() + '\n';
    fs.writeFileSync(ENV_PATH, envContent);
    console.log(`✅ Seed in .env gespeichert: ${seed.substring(0, 16)}...`);

    return seed;
}

function deriveUnshieldedAddress(seedHex: string): string {
    const seedBytes = Buffer.from(seedHex, 'hex');
    const hdResult = hd.HDWallet.fromSeed(seedBytes);
    if (hdResult.type !== 'seedOk') throw new Error(`HDWallet Seed-Fehler: ${hdResult.type}`);
    
    const account = hdResult.hdWallet.selectAccount(0);
    const role = account.selectRole(hd.Roles.NightExternal);
    const keyResult = role.deriveKeyAt(0);
    if (keyResult.type !== 'keyDerived') throw new Error(`Key-Ableitung fehlgeschlagen: ${keyResult.type}`);
    
    const keystore = createKeystore(keyResult.key, 'preprod');
    return keystore.getBech32Address().asString();
}

function formatBalance(balances: Record<string, bigint>): string {
    const entries = Object.entries(balances);
    if (entries.length === 0) return '(leer)';
    return entries.map(([type, amount]) => {
        if (type === NATIVE_TOKEN_TYPE) return `tNIGHT: ${amount}`;
        return `${type.substring(0, 12)}...: ${amount}`;
    }).join(' | ');
}

// ─────────────────────────────────────────────
// HAUPTLOGIK
// ─────────────────────────────────────────────

async function main() {
    console.log('\n══════════════════════════════════════════════════');
    console.log('  🚀 ROHAN — Clean Slate Setup & Deploy');
    console.log('══════════════════════════════════════════════════\n');

    // ── PHASE 1: Seed & Adressen ──
    const seed = generateOrLoadSeed();
    const unshieldedAddr = deriveUnshieldedAddress(seed);

    console.log('\n══════════════════════════════════════════════════');
    console.log('  📋 ADRESSEN');
    console.log('══════════════════════════════════════════════════');
    console.log(`  Unshielded: ${unshieldedAddr}`);
    console.log('══════════════════════════════════════════════════\n');
    console.log('  ╔═══════════════════════════════════════════════════════════╗');
    console.log(`  ║  👉 FAUCET ZIEL: ${unshieldedAddr}`);
    console.log('  ║  Sende tNIGHT an diese Unshielded-Adresse!');
    console.log('  ╚═══════════════════════════════════════════════════════════╝\n');

    // ── PHASE 2: WalletBuilder ──
    console.log('📡 Initialisiere WalletBuilder (Midnight Preprod)...');
    console.log(`   Indexer:  ${INDEXER_URL}`);
    console.log(`   Prover:   ${PROVER_URL} (VPS Docker)`);
    console.log(`   Node:     ${NODE_URL}\n`);

    const wallet = await WalletBuilder.build(
        INDEXER_URL,
        INDEXER_WS,
        PROVER_URL,
        NODE_URL,
        seed,
        NetworkId.TestNet,
        'info'
    );

    // Wallet-Resource starten
    (wallet as any).start?.();

    // Warte auf ersten State
    console.log('⏳ Warte auf initialen Wallet-State...');
    const initialState = await firstValueFrom(wallet.state());

    console.log(`  Shielded Address:  ${initialState.address}`);
    console.log(`  CoinPublicKey:     ${initialState.coinPublicKey}`);
    console.log(`  SyncProgress:      ${initialState.syncProgress ? `${initialState.syncProgress.synced}/${initialState.syncProgress.total}` : 'starting...'}`);
    console.log(`  Balances:          ${formatBalance(initialState.balances)}`);

    // ── PHASE 3: Auto-Shield & Deploy Loop ──
    console.log('\n⏳ Starte Auto-Shield & Deploy Loop (Polling alle 15s)...');
    console.log('   Warte auf Faucet-Funding...\n');
    
    const keepAlive = setInterval(() => {}, 1000);
    const startTime = Date.now();
    let shieldingDone = false;
    let deployDone = false;

    while (!deployDone) {
        const elapsed = Math.floor((Date.now() - startTime) / 60000);

        try {
            const state = await firstValueFrom(wallet.state());
            const balances = state.balances;
            const totalBalance = Object.values(balances).reduce((sum, v) => sum + v, 0n);

            const syncInfo = state.syncProgress
                ? `${state.syncProgress.synced}/${state.syncProgress.total}`
                : 'init';
            console.log(`[${elapsed}min] Sync: ${syncInfo} | Coins: ${state.availableCoins.length} | Balance: ${formatBalance(balances)}`);

            // ── SHIELDING: tNIGHT auf eigene Shielded-Adresse transferieren ──
            if (!shieldingDone && totalBalance > 0n) {
                console.log('\n🔥 ════════════════════════════════════════════');
                console.log('   FUNDS DETECTED! Starte Auto-Shield...');
                console.log('   ════════════════════════════════════════════\n');

                const shieldAmount = balances[NATIVE_TOKEN_TYPE] ?? totalBalance;
                console.log(`   Shielde ${shieldAmount} tNIGHT → ${state.address}`);

                try {
                    // transferTransaction sendet an die eigene Shielded-Adresse
                    const transferRecipe = await wallet.transferTransaction([{
                        amount: shieldAmount,
                        type: NATIVE_TOKEN_TYPE,
                        receiverAddress: state.address
                    }]);

                    console.log('   📝 Transfer-Intent erstellt. Erzeuge ZK-Proof (VPS)...');
                    const provenTx = await wallet.proveTransaction(transferRecipe);

                    console.log('   📤 Submitte Shield-Transaktion...');
                    const txId = await wallet.submitTransaction(provenTx);
                    console.log(`   ✅ SHIELDING ERFOLGREICH! TxID: ${txId}`);
                    shieldingDone = true;

                    console.log('   ⏳ Warte 30s auf Confirmation...');
                    await new Promise(r => setTimeout(r, 30000));
                    continue;
                } catch (shieldErr: any) {
                    console.error(`   ❌ Shield-Fehler: ${shieldErr.message}`);
                    console.error(`   Stack: ${shieldErr.stack?.split('\n').slice(0, 3).join('\n')}`);
                }
            }

            // ── DEPLOYMENT: Sobald tDUST vorhanden ──
            const dustEntries = Object.entries(balances).filter(([type]) => type !== NATIVE_TOKEN_TYPE);
            const hasDust = dustEntries.some(([, amount]) => amount > 0n);

            if (shieldingDone && hasDust) {
                console.log('\n🚀 ════════════════════════════════════════════');
                console.log('   tDUST DETECTED! Starte Contract Deployment...');
                console.log('   ════════════════════════════════════════════\n');

                try {
                    networkId.setNetworkId('test');
                    const genDir = path.resolve(process.cwd(), './src/generated');

                    const providers = {
                        walletProvider: {
                            getCoinPublicKey: () => state.coinPublicKey,
                            getEncryptionPublicKey: () => state.encryptionPublicKey,
                            balanceTx: (unprovenTx: any, newCoins: any) =>
                                wallet.balanceTransaction(unprovenTx, newCoins || []),
                        },
                        proofProvider: httpClientProofProvider(PROVER_URL),
                        publicDataProvider: indexerPublicDataProvider(INDEXER_URL, INDEXER_WS),
                        privateStateProvider: levelPrivateStateProvider({
                            databasePath: path.resolve(process.cwd(), '.private-state'),
                            privateStoragePasswordProvider: () =>
                                Promise.resolve(`rohan-hot-wallet-${seed.substring(0, 32)}`),
                            accountId: state.address,
                        }),
                        zkConfigProvider: new NodeZkConfigProvider(genDir),
                        midnightProvider: {
                            submitTx: wallet.submitTransaction.bind(wallet),
                        },
                    };

                    let compiledContract = CompiledContract.make('rohan_handshake', Contract);
                    compiledContract = CompiledContract.withCompiledFileAssets(compiledContract, genDir);
                    compiledContract = CompiledContract.withVacantWitnesses(compiledContract);

                    console.log('   📦 CompiledContract Artifact erstellt');
                    console.log('   🔨 Building Transaction & Deploying...');

                    const deployedContract = await contracts.deployContract(
                        providers as any,
                        { compiledContract } as any
                    );

                    const contractAddress = (deployedContract as any).deployTxData?.public?.contractAddress;
                    console.log('\n   ════════════════════════════════════════════');
                    console.log(`   ✅ CONTRACT DEPLOYED!`);
                    console.log(`   📍 Address: ${contractAddress}`);
                    console.log('   ════════════════════════════════════════════\n');

                    // Contract-Adresse in .env speichern
                    let envContent = fs.readFileSync(ENV_PATH, 'utf-8');
                    envContent = envContent.split('\n')
                        .filter(line => !line.startsWith('ROHAN_CONTRACT_ADDRESS='))
                        .join('\n');
                    envContent += `\nROHAN_CONTRACT_ADDRESS=${contractAddress}\n`;
                    fs.writeFileSync(ENV_PATH, envContent.trim() + '\n');
                    console.log('   ✅ Contract-Adresse in .env gespeichert');

                    deployDone = true;
                } catch (deployErr: any) {
                    console.error(`   ❌ Deploy-Fehler: ${deployErr.message}`);
                    console.error(`   Stack: ${deployErr.stack?.split('\n').slice(0, 5).join('\n')}`);
                }
            }

        } catch (err: any) {
            console.error(`[${elapsed}min] ❌ State-Fehler: ${err.message}`);
        }

        if (!deployDone) {
            await new Promise(r => setTimeout(r, 15000));
        }
    }

    clearInterval(keepAlive);
    console.log('\n══════════════════════════════════════════════════');
    console.log('  🎉 ROHAN SETUP COMPLETE!');
    console.log('══════════════════════════════════════════════════\n');
    process.exit(0);
}

main().catch(err => {
    console.error('❌ FATALER FEHLER:', err.message || err);
    console.error(err.stack);
    process.exit(1);
});
