import { createContext, useContext } from 'react';

export interface WebMcpContextValue {
  shieldAndSubmit: (params: {
    agentId: string;
    intent: string;
    formData: Record<string, unknown>;
  }) => Promise<any>;
  isProving: boolean;
  contractAddress: string;
}

export const WebMcpContext = createContext<WebMcpContextValue | null>(null);

export function useRohanWebMcp(): WebMcpContextValue {
  const ctx = useContext(WebMcpContext);
  if (!ctx) {
    throw new Error('useRohanWebMcp must be used within a <RohanWebMcpProvider>.');
  }
  return ctx;
}
