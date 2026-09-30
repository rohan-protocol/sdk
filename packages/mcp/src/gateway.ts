import { RohanRelayerClient } from '@rohan-protocol/sdk';

export interface RohanMcpGatewayOptions {
  transport?: 'stdio' | 'streamable-http';
  relayerUrl?: string;
  contractAddress?: string;
  apiKey?: string;
}

/**
 * RohanMcpGateway
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
      contractAddress: options.contractAddress || '585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e',
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
          agentId: { type: 'string', description: 'Decentralized Identifier (DID) of calling agent' },
          intent: { type: 'string', description: 'Semantic action intent or agreement payload' },
          counterpartyId: { type: 'string', description: 'Optional recipient agent identifier' },
        },
        required: ['agentId', 'intent'],
      },
      execute: async (params: any) => {
        return await this.relayerClient.submitHandshake(params);
      },
    };
  }
}
