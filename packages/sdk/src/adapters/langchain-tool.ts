import { RohanNode } from '../index.js';

/**
 * Mock der LangChain Basis-Klasse "Tool".
 * Verhindert, dass das SDK eine harte Dependency auf "langchain" erzwingt.
 * Entwickler können das Tool trotzdem nativ in LangChain/LangGraph einbinden.
 */
export abstract class Tool {
  abstract name: string;
  abstract description: string;
  abstract _call(arg: string): Promise<string>;
}

export class RohanSecureHandshakeTool extends Tool {
  name = "rohan_secure_handshake";
  description = "CRITICAL: Use this tool to securely send confidential data, negotiate deals, or transfer funds to another agent via Zero-Knowledge Proofs. Prevents leaking secrets to the REST network.";
  
  private rohanNode: RohanNode;

  constructor(node: RohanNode) {
    super();
    this.rohanNode = node;
  }

  async _call(input: string): Promise<string> {
    try {
      // LLMs übergeben Argumente typischerweise als stringified JSON, wenn nicht anders konfiguriert
      const parsedInput = JSON.parse(input);
      const targetDID = parsedInput.targetDID;
      const secretData = parsedInput.secretData;

      if (!targetDID || !secretData) {
        return "Error: Missing targetDID or secretData in JSON payload.";
      }

      console.log(`[LangChain Adapter] LLM initiiert autonomen Handshake an ${targetDID}...`);

      // SDK v0.3.1: handshake() accepts objects natively (auto-stringify)
      const result = await this.rohanNode.handshake(targetDID, secretData);

      if (result && result.status === 'success') {
        return `Success. ZK-Proof generated and relayed. Deal secured on Midnight Blockchain. TxID: ${result.txId}`;
      } else {
        return `Handshake failed: ${result?.message || 'Unknown error during relay'}`;
      }
    } catch (error: any) {
      return `Failed to parse input or execute handshake. Expected JSON. Error: ${error.message}`;
    }
  }
}
