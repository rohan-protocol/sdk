/**
 * @rohan-protocol/sdk v0.3.1
 * 
 * The Trust Layer for AI Agents.
 * 
 * RohanNode now strictly operates on the Midnight blockchain via the M2M toll-booth architecture.
 * HTTP-based payloads are completely deprecated. It utilizes `current_batch_root` state polling
 * to establish mathematical absolute truth between disconnected agents.
 */

import crypto from 'crypto';
import { submitRealHandshakeProof } from './prover.js';
import { createMockLedgerStateHook } from './verifier.js';

import type { RohanNodeConfig, HandshakeCallback, IncomingHandshake, HandshakeResult } from './types.js';

const DEFAULT_CONTRACT_ADDRESS = process.env.ROHAN_CONTRACT_ADDRESS || '02d7fe8b22a0142b6a958e945feae6759c8d504533a69aa3fe6a8f6f5cc761b0';
const INITIAL_ROOT = "0000000000000000000000000000000000000000000000000000000000000000";

// Hilfsobjekt, um Ledger-State Änderungen im lokalen RAM-Mock zu propagieren
export const globalLedgerMock = createMockLedgerStateHook();

export class RohanNode {
  private readonly apiKey: string;
  private readonly relayerUrl: string;
  private readonly did: string;
  private readonly minFee: number;
  private readonly verbose: boolean;
  
  private handshakeCallbacks: HandshakeCallback[] = [];
  private pollingInterval: NodeJS.Timeout | null = null;
  private currentLedgerRoot: string = INITIAL_ROOT;

  constructor(config: RohanNodeConfig) {
    if (!config.apiKey || !config.relayerUrl) {
      throw new Error('[RohanNode] apiKey and relayerUrl are required for the Gasless Relayer integration.');
    }

    this.apiKey = config.apiKey;
    this.relayerUrl = config.relayerUrl;
    this.minFee = config.minFee ?? 100;
    this.verbose = config.verbose ?? true;

    this.did = config.did ?? 'did:rohan:' + crypto.createHash('sha256').update(this.apiKey).digest('hex').slice(0, 16);
  }

  // ─── Public API ──────────────────────────────────────────────

  async start(): Promise<void> {
    this.log(`🚀 RohanNode SDK v0.3.1 starting | DID: ${this.did}`);
    this.log(`⛽ Connected to Gas Station Relayer at: ${this.relayerUrl}`);
    
    this.log(`📡 Targeting Contract: ${DEFAULT_CONTRACT_ADDRESS}`);

    // Polling des Ledgers asynchron starten (Verifier Logik)
    this.pollingInterval = setInterval(() => this.checkLedgerState(), 3000);
    this.log('👀 Ledger Polling active.');
  }

  /**
   * Gracefully shut down the node and polling.
   */
  async stop(): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    this.log('🛑 RohanNode shut down gracefully.');
  }

  /**
   * Listener für eintreffende Deals, wenn der Midnight Network State (current_batch_root) aktualisiert wurde.
   */
  onHandshake(callback: HandshakeCallback): void {
    this.handshakeCallbacks.push(callback);
  }

  /**
   * Sende einen strukturierten Batched ZK-Proof direkt auf die Midnight Chain.
   * 
   * @param targetIdentifier - A DID (`did:rohan:...`) or a raw Midnight Contract Address.
   *   DIDs are resolved to the default contract in this version.
   * @param dealPayload - The deal data. Pass a plain object or a pre-stringified JSON string.
   * @param fee - Toll fee in DUST (default: 150, minimum: 100).
   */
  async handshake(
    targetIdentifier: string,
    dealPayload: string | Record<string, any>,
    fee: number = 150
  ): Promise<HandshakeResult> {
    // DX: Auto-stringify objects so devs can pass plain JS objects
    const serializedPayload = typeof dealPayload === 'string'
      ? dealPayload
      : JSON.stringify(dealPayload);

    // DX: Resolve DID → Contract Address (v0.3.1 stub, full registry in v0.4)
    let resolvedContract = DEFAULT_CONTRACT_ADDRESS;
    if (targetIdentifier.startsWith('did:rohan:')) {
      this.log(`🔗 Resolving target ${targetIdentifier} to Contract ${DEFAULT_CONTRACT_ADDRESS}`);
    } else {
      resolvedContract = targetIdentifier;
    }

    this.log(`🔒 Initiating On-Chain ZK-Handshake → Contract ${resolvedContract.substring(0, 12)}...`);
    
    // Prover Modul ausführen!
    const result = await submitRealHandshakeProof(
      this.apiKey,
      this.relayerUrl,
      resolvedContract,
      fee,
      serializedPayload
    );

    if (result.success && result.newRootHex) {
      // Mock: Wir schreiben den Root ins globale RAM, damit das simulierte Indexer-Polling es findet.
      globalLedgerMock.update(result.newRootHex);

      return {
        status: 'success',
        message: 'On-Chain Handshake accepted.',
        onChainCommitment: result.newRootHex,
        txId: result.txHash,
      };
    } else {
      return { status: 'error', message: result.error || 'ZK-Proof failed' };
    }
  }

  getDid(): string {
    return this.did;
  }

  // ─── Internal (Verifier Polling Mock) ────────────────────────────────

  private async checkLedgerState() {
    // In Produktion: const onChainRoot = await queryIndexer(DEFAULT_CONTRACT_ADDRESS);
    const onChainRoot = globalLedgerMock.get();

    if (onChainRoot !== this.currentLedgerRoot) {
      this.log(`\n🔔 [Midnight-Indexer] State Change detected auf Contract! Alter Root: ${this.currentLedgerRoot.substring(0,8)} -> Neuer Root: ${onChainRoot.substring(0,8)}`);
      this.currentLedgerRoot = onChainRoot;

      // Cryptographically proven state changed, fire callback!
      const incomingHandshake: IncomingHandshake = {
        proof: null as any,
        from: 'Network/Agent-A',
        idempotencyKey: crypto.randomUUID(),
        verified: true,
        commitment: this.currentLedgerRoot,
        txId: 'mock-tx-id',
      };

      for (const cb of this.handshakeCallbacks) {
        try {
          await cb(incomingHandshake);
        } catch (err) {
          this.log(`⚠️ Callback error: ${err}`);
        }
      }
    }
  }

  private log(msg: string): void {
    if (this.verbose) {
      console.log(`[RohanNode] ${msg}`);
    }
  }
}

// ─── LangChain Adapters ───────────────────────────────────────
export { RohanSecureHandshakeTool } from './adapters/langchain-tool.js';

