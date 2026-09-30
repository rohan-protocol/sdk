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
  relayerUrl = 'https://api.rohanprotocol.network/api/v1/handshake',
  contractAddress = '585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e',
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
      // 1. Pre-Commitment Firewall Inspection (Security Vector V-07)
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
        // 2. In-Memory Witness Allocation & Commitment Generation
        const timestamp = Date.now();
        const encoder = new TextEncoder();
        const witness = encoder.encode(`${agentId}:${intent}:${JSON.stringify(formData)}:${timestamp}`);
        
        const hashBuf = await crypto.subtle.digest('SHA-256', witness);
        const intentHash = Array.from(new Uint8Array(hashBuf))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');

        // Memory Sanitation (Vector V-02): Zeroize private witness
        witness.fill(0x00);

        const commitmentPayload = {
          publicInputs: {
            intentHash,
            agentId,
            timestamp,
          },
          circuitName: 'verify_batched_handshakes',
          contractAddress,
        };

        // 3. Relayer Submission (Gasless for client browser)
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-rohan-api-key': apiKey } : {}),
        };
        const res = await fetch(relayerUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(commitmentPayload),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error(err.error || `Relayer rejected submission with HTTP ${res.status}`);
        }

        return await res.json();
      } finally {
        setIsProving(false);
      }
    },
  }), [contractAddress, relayerUrl, apiKey, isProving]);

  return <WebMcpContext.Provider value={value}>{children}</WebMcpContext.Provider>;
};
