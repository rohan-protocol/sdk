/**
 * @file index.ts
 * @description Rohan Agent Flight Recorder — middleware wrapper.
 *
 * Wraps expensive tool/API calls so that a Rohan audit bundle is written
 * to Midnight L1 *before* the call executes. If the call later fails or is
 * disputed, the bundle proves exactly what was requested and when.
 *
 * Clone & run:
 *   npm install
 *   npm start
 */

import {
  RohanClient,
  InMemoryEd25519Signer,
  computePayloadDigest,
} from '@rohan-protocol/sdk';

const CONTRACT_ADDRESS =
  '585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e';
const RELAYER_URL = 'https://api.rohanprotocol.network';

/**
 * FlightRecorder wraps any async function (tool call, API request, etc.)
 * and anchors its parameters on Midnight L1 before execution.
 */
export class FlightRecorder {
  private client: RohanClient;
  private signer: InMemoryEd25519Signer | null = null;

  constructor() {
    this.client = new RohanClient({
      contractAddress: CONTRACT_ADDRESS,
      relayerUrl: RELAYER_URL,
    });
  }

  async init() {
    this.signer = await InMemoryEd25519Signer.generate();
    this.client = new RohanClient({
      contractAddress: CONTRACT_ADDRESS,
      relayerUrl: RELAYER_URL,
      signer: this.signer,
    });
    console.log('Flight recorder agent DID:', this.signer.did);
  }

  /**
   * Wrap a tool call: anchor params first, then execute.
   */
  async record<T>(
    toolName: string,
    args: Record<string, unknown>,
    fn: () => Promise<T>
  ): Promise<T> {
    if (!this.signer) {
      throw new Error('FlightRecorder not initialized — call init() first');
    }

    const payload = {
      tool: toolName,
      args,
      recordedAt: Date.now(),
      agentDid: this.signer.did,
    } as const;

    // 1. Compute digest of the plaintext call parameters
    const digest = await computePayloadDigest(payload);
    console.log(`[FlightRecorder] ${toolName} — payload digest: ${digest}`);

    // 2. Anchor commitment on Midnight L1 before executing the expensive call
    //    Single idiomatic SDK call — receipt.auditBundle is ready for
    //    offline verification without manual buildAuditBundle().
    const receipt = await this.client.submitHandshake({
      intent: `Tool call: ${toolName}`,
      confidentialPayload: payload,
    });

    const auditBundle = receipt.auditBundle!;

    console.log(
      `[FlightRecorder] ${toolName} — anchored on L1: ${receipt.txHash}`
    );
    console.log(
      `[FlightRecorder] ${toolName} — audit bundle intentHash: ${receipt.intentHash}`
    );

    // 3. Execute the actual (expensive) tool/API call.
    //    The anchor is already on-chain, so even if fn() throws, the
    //    attempted call is cryptographically attested.
    try {
      const result = await fn();
      console.log(`[FlightRecorder] ${toolName} — executed successfully`);
      return result;
    } finally {
      // auditBundle remains available for post-failure forensic verification
    }
  }

  async destroy() {
    if (this.signer) {
      this.signer.destroy();
    }
  }
}

/**
 * Example: expensive external API (LLM inference, payment, data lookup)
 */
async function expensiveExternalApi(input: { prompt: string; model: string }) {
  // Simulate network latency + cost
  await new Promise((resolve) => setTimeout(resolve, 500));
  return {
    completion: `Synthetic response for: "${input.prompt}" (model: ${input.model})`,
    costUsd: 0.002,
    latencyMs: 500,
  };
}

async function main() {
  const recorder = new FlightRecorder();
  await recorder.init();

  try {
    // Wrap an expensive LLM call — it gets anchored on L1 before execution
    const result = await recorder.record(
      'llm.generateCompletion',
      {
        prompt: 'Summarize Q4 SLA compliance',
        model: 'gpt-5',
        maxTokens: 500,
      },
      () => expensiveExternalApi({
        prompt: 'Summarize Q4 SLA compliance',
        model: 'gpt-5',
      })
    );

    console.log('API result:', result);
  } finally {
    await recorder.destroy();
  }
}

main().catch((err) => {
  console.error('❌ Flight recorder failed:', err);
  process.exit(1);
});
