import { RohanRelayerClient } from '../../sdk/dist/index.js';

export interface RohanMcpGatewayOptions {
  transport?: 'stdio' | 'streamable-http';
  relayerUrl?: string;
  contractAddress?: string;
  apiKey?: string;
}

/**
 * ⚡ RohanMcpGateway
 * Connects AI Agent pipelines (Google ADK 2.0, Gemini, Claude, Cursor)
 * to the Rohan Protocol Gas Station via Streamable HTTP (NDJSON) or Stdio.
 */
export class RohanMcpGateway {
  public readonly transport: string;
  public readonly relayerClient: RohanRelayerClient;

  constructor(options: RohanMcpGatewayOptions = {}) {
    this.transport = options.transport || 'streamable-http';
    this.relayerClient = new RohanRelayerClient({
      relayerUrl: options.relayerUrl || 'http://127.0.0.1:4005/api/v1/handshake',
      contractAddress: options.contractAddress || '6d2d603235f996424d76c85186a79cc403245ea8ee1ba9087e40967fe71bdc4d',
      apiKey: options.apiKey,
    });
  }

  /**
   * Generates a tool specification compliant with Google ADK 2.0 and Gemini tool calling.
   */
  asAdkTool() {
    return {
      name: 'rohan_zk_handshake',
      description: 'Executes a zero-knowledge verifiable handshake proof on Midnight Network with zero plaintext leaks.',
      parameters: {
        type: 'object',
        properties: {
          agentId: { type: 'string', description: 'Identifier of calling agent' },
          intent: { type: 'string', description: 'Semantic action intent' },
          proof: { type: 'string', description: 'ZK-SNARK proof payload' },
          publicInputs: { type: 'object', description: 'Public inputs for on-chain verification' },
        },
        required: ['agentId', 'intent'],
      },
      execute: async (params: any) => {
        return await this.relayerClient.submitProof(params);
      },
    };
  }
}
