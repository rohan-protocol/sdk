@rohan-protocol/webmcp

![Bild](https://img.shields.io/badge/NPM-v0.6.0-blue?style=for-the-badge)
![Bild](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)

Browser-native WebMCP shield with client-side memory sanitization.
Protects front-end copilots and React applications from zero-width Unicode injection attacks and leaks.
Features

    Zero-Width Unicode Defense (V-07): Sanitizes inputs against invisible Unicode character smuggling [\u200B-\u200D\uFEFF].

    In-Memory Witness Zeroization (V-02): Scrubs private web form fields and prompt inputs from browser memory.

    React Hooks & Provider: 3-line drop-in integration for Next.js, React, and browser extensions.

Installation
code Bash

npm install @rohan-protocol/webmcp

Quickstart
code Tsx

import { RohanWebMcpProvider, useRohanWebMcp } from '@rohan-protocol/webmcp';

export default function App() {
  return (
    <RohanWebMcpProvider apiKey={process.env.NEXT_PUBLIC_ROHAN_API_KEY}>
      <YourAgentInterface />
    </RohanWebMcpProvider>
  );
}

function YourAgentInterface() {
  const { shieldAndSubmit, isProving } = useRohanWebMcp();

  const handleAction = async () => {
    const receipt = await shieldAndSubmit({
      agentId: "did:midnight:web-agent",
      intent: "submit_confidential_web_intent",
      formData: { email: "partner@example.com", termsAccepted: true }
    });
    console.log("Confirmed on Midnight:", receipt.txHash);
  };

  return <button onClick={handleAction} disabled={isProving}>Execute ZK Handshake</button>;
}

License

MIT © Rohan Protocol.
