/**
 * @rohan-protocol/sdk – Type Definitions
 * 
 * These interfaces define the cryptographic payload structure for
 * Zero-Knowledge Handshakes between autonomous AI agents.
 */

// ─── Configuration ───────────────────────────────────────────

/** Configuration options for initializing a RohanNode. */
export interface RohanNodeConfig {
  /** Gas Station / Relayer API Key for Sponsored Transactions. */
  apiKey: string;

  /** The full URL of the Gas Station (Relayer) node. */
  relayerUrl: string;

  /** 
   * The Decentralized Identifier for this node.
   * If omitted, a deterministic DID is generated from the api key.
   */
  did?: string;

  /** Minimum toll fee required for incoming handshakes (default: 100). */
  minFee?: number;

  /** Enable verbose logging to stdout (default: true). */
  verbose?: boolean;
}

// ─── ZK-Proof Payload ────────────────────────────────────────

/** The public inputs that are visible on-chain after a handshake. */
export interface PublicInputs {
  /** DID of the proving agent (sender). */
  agent_a_did: string;

  /** DID of the verifying agent (receiver). */
  agent_b_did: string;

  /** The toll fee paid for this interaction. */
  maut_fee: number;

  /** The SHA-256 commitment hash of the private deal data. */
  commitment: string;
}

/** 
 * The complete Zero-Knowledge Proof payload.
 * This is the "envelope" that travels between agents.
 * The `proofData` is cryptographically opaque – it proves correctness
 * without revealing the underlying deal content.
 */
export interface ZKProofPayload {
  /** The raw SNARK proof data (hex-encoded). */
  proofData: string;

  /** The public inputs associated with this proof. */
  publicInputs: PublicInputs;

  /** Reference to the verification key / smart contract on-chain. */
  verificationKeyId: string;
}

// ─── Handshake Result ────────────────────────────────────────

/** The result returned after a successful outbound handshake. */
export interface HandshakeResult {
  /** Whether the handshake was accepted by the remote agent. */
  status: 'success' | 'error';

  /** Human-readable message from the verifier. */
  message: string;

  /** The on-chain commitment hash (publicly verifiable). */
  onChainCommitment?: string;

  /** The transaction ID on the Midnight ledger. */
  txId?: string;
}

// ─── Callback Types ──────────────────────────────────────────

/** Payload delivered to the onHandshake callback. */
export interface IncomingHandshake {
  /** The full proof payload from the remote agent. */
  proof: ZKProofPayload;

  /** The DID of the agent who initiated the handshake. */
  from: string;

  /** The idempotency key for deduplication. */
  idempotencyKey: string;

  /** Whether the proof passed local verification. */
  verified: boolean;

  /** The generated on-chain commitment (if verified). */
  commitment: string;

  /** The mock transaction ID. */
  txId: string;
}

/** The callback signature for incoming handshake events. */
export type HandshakeCallback = (handshake: IncomingHandshake) => void | Promise<void>;
