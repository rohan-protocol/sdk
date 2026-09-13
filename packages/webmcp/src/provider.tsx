import React, { useState, useMemo } from 'react';
import { WebMcpContext } from './hooks.js';
import { WebMcpFirewall } from './firewall.js';

export interface RohanWebMcpProviderProps {
  children: React.ReactNode;
  relayerUrl?: string;
  contractAddress?: string;
  apiKey?: string;
}

export const RohanWebMcpProvider: React.FC<RohanWebMcpProviderProps> = ({
  children,
  relayerUrl = 'http://127.0.0.1:4005/api/v1/handshake',
  contractAddress = '6d2d603235f996424d76c85186a79cc403245ea8ee1ba9087e40967fe71bdc4d',
  apiKey,
}) => {
  const [isProving, setIsProving] = useState(false);

  const value = useMemo(() => ({
    contractAddress,
    isProving,
    shieldAndSubmit: async ({ agentId, intent, formData }: {
      agentId: string;
      intent: string;
      formData: Record<string, unknown>;
    }) => {
      // 1. Pre-Prover Firewall Check (V-07)
      const firewallCheck = WebMcpFirewall.inspect({
        toolName: 'web_form_shield',
        callerOrigin: typeof window !== 'undefined' ? window.location.origin : 'unknown',
        parameters: formData,
      });

      if (!firewallCheck.allowed) {
        throw new Error(`WebMCP Security Alert: ${firewallCheck.reason}`);
      }

      setIsProving(true);
      try {
        // 2. Lokale Hash- und ZK-Vorbereitung
        const timestamp = Date.now();
        const encoder = new TextEncoder();
        const witness = encoder.encode(`${agentId}:${intent}:${JSON.stringify(formData)}:${timestamp}`);
        const hashBuf = await crypto.subtle.digest('SHA-256', witness);
        const intentHash = Array.from(new Uint8Array(hashBuf))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');

        // Memory Wiping (V-02)
        witness.fill(0x00);

        const proofData = {
          proof: btoa(JSON.stringify({ protocol: 'midnight-plonk-v1', commitment: intentHash, timestamp })),
          publicInputs: {
            intentHash,
            agentId,
            timestamp,
          },
          circuitName: 'verify_batched_handshakes',
          contractAddress,
        };

        // 3. Relayer Submission (Gasless für den Browsernutzer)
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-rohan-api-key': apiKey } : {}),
        };
        const res = await fetch(relayerUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(proofData),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Relayer rejection');
        }

        return await res.json();
      } finally {
        setIsProving(false);
      }
    },
  }), [contractAddress, relayerUrl, apiKey, isProving]);

  return <WebMcpContext.Provider value={value}>{children}</WebMcpContext.Provider>;
};
