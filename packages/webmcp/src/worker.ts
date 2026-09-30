self.onmessage = async (e: MessageEvent) => {
  const { id, agentId, intent, payload } = e.data;

  try {
    const timestamp = Date.now();
    const encoder = new TextEncoder();
    
    // 1. Thread-isolated private witness allocation
    const witnessData = encoder.encode(`${agentId}:${intent}:${JSON.stringify(payload)}:${timestamp}`);

    // 2. Compute 32-byte Intent Commitment (SHA-256)
    const hashBuffer = await crypto.subtle.digest('SHA-256', witnessData);
    const intentHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // 3. V-02 Memory Sanitation in Worker-Thread (Zeroize)
    crypto.getRandomValues(witnessData);
    witnessData.fill(0x00);

    self.postMessage({
      id,
      success: true,
      data: {
        publicInputs: {
          intentHash,
          agentId,
          timestamp,
        },
        circuitName: 'verify_batched_handshakes',
      },
    });
  } catch (err: any) {
    self.postMessage({ id, success: false, error: err.message || 'Worker Prover Error' });
  }
};
