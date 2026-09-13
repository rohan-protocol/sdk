import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import type { ProofProvider } from '@midnight-ntwrk/midnight-js-types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class RohanProverEngine {
  private readonly zkAssetsPath: string;
  private readonly proofServerUrl: string;

  constructor(customAssetsPath?: string, proofServerUrl = 'http://127.0.0.1:6300') {
    this.proofServerUrl = proofServerUrl;
    
    // Standardmäßig auf src/generated bündeln
    this.zkAssetsPath = customAssetsPath || path.resolve(__dirname, 'generated');

    if (!fs.existsSync(this.zkAssetsPath)) {
      const fallbackPath = path.resolve(__dirname, '../src/generated');
      if (fs.existsSync(fallbackPath)) {
        this.zkAssetsPath = fallbackPath;
      }
    }
  }

  // 1. Generic Parameter <string> ergänzt
  getZkConfigProvider(): NodeZkConfigProvider<string> {
    return new NodeZkConfigProvider<string>(this.zkAssetsPath);
  }

  // 2. Zweiter Parameter (zkConfigProvider) übergeben
  getProofProvider(): ProofProvider {
    return httpClientProofProvider(
      this.proofServerUrl, 
      this.getZkConfigProvider() as any
    ) as ProofProvider;
  }

  getAssetsPath(): string {
    return this.zkAssetsPath;
  }
}
