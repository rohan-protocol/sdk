export interface RohanConfig {
  network?: 'preprod' | 'testnet' | 'mainnet';
  contractAddress?: string;
  relayerUrl?: string;
  apiKey?: string;
}

export interface AgentHandshakeIntent {
  agentId: string;
  intent: string;
  counterpartyId?: string;
  timestamp?: number;
  privateData?: Record<string, unknown>;
}

export interface HandshakeCommitmentPayload {
  proofBlob?: string;
  publicInputs: {
    intentHash: string;
    agentId: string;
    timestamp: number;
  };
  circuitName: string;
  contractAddress: string;
}

export interface HandshakeReceipt {
  success: boolean;
  status: 'confirmed' | 'pending' | 'failed';
  contractAddress: string;
  intentHash: string;
  txHash: string;
  gasPaidBy?: string;
  engine?: string;
  timestamp: number;
}

export interface TransactionRecord {
  txHash: string;
  stateRoot: string;
  intentHash: string;
  blockHeight: number | null;
  status: string;
  timestamp: number;
}

export interface TransactionHistoryResponse {
  success: boolean;
  contractAddress: string;
  network: string;
  count: number;
  transactions: TransactionRecord[];
}
