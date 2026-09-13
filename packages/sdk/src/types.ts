/**
 * Konfiguration zur Initialisierung des RohanClients.
 */
export interface RohanConfig {
  network: 'preprod' | 'testnet' | 'mainnet';
  contractAddress: string;
  indexerUrl?: string;
  indexerWs?: string;
  nodeUrl?: string;
  proofServerUrl?: string; // Optional: Fallback auf Remote/Local Prover falls kein Embedded WASM
  zkAssetsPath?: string;
}

/**
 * Ein diskreter Handshake-Intent zwischen zwei autonomen Agenten.
 */
export interface AgentHandshakeIntent {
  initiatorDid: string;     // z. B. did:midnight:agent-alpha
  counterpartyDid: string;  // z. B. did:midnight:agent-beta
  intentHash: Uint8Array;   // 32-Byte Hash des semantischen Aktionsplans
  nonce: bigint;
  timestamp: number;
}

/**
 * Batch-Payload zur Übermittlung an den ZK-Schaltkreis.
 */
export interface BatchedHandshakePayload {
  handshakes: AgentHandshakeIntent[];
  batchRoot: Uint8Array;    // Merkle Root der gebündelten Handshakes
}

/**
 * Quittung eines bestätigten On-Chain Handshakes.
 */
export interface HandshakeReceipt {
  txHash: string;
  blockHeight?: bigint;
  contractAddress: string;
  verifiedCount: number;
  timestamp: number;
}

/**
 * Rohdaten des On-Chain Ledger States.
 */
export interface RohanContractState {
  rawStatePointer: number;
  contractAddress: string;
  network: string;
}

export interface HandshakeProofData {
  proof: string;             // Base64 oder Hex des generierten ZK-Beweises
  publicInputs: {
    intentHash: string;
    agentId: string;
    timestamp: number;
  };
  circuitName: string;
  contractAddress: string;
}
