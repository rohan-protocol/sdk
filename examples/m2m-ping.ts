import { RohanNode } from '../src/index.js';

// Ein e2e M2M Ping Test für Phase 1
async function runM2MPing() {
  console.log("=== Rohan Protocol v0.2.0: M2M Ping Test ===\n");

  // 1. Initialisiere Agent B (Verkäufer / Verifier)
  const agentB = new RohanNode({
    apiKey: "rohan_sk_test",
    relayerUrl: "http://localhost:4005",
    did: "did:rohan:seller",
    port: 4001, // Deprecated, nur für Legacy
    minFee: 100
  });

  // Registriere den Callback (Observer-Pattern)
  agentB.onHandshake((handshakePayload) => {
    console.log(`\n💰 [Agent B] Deal bestätigt auf Chain! ZK-Proof verifiziert.`);
    console.log(`[Agent B] Gebe Daten frei für Root-Update: ${handshakePayload.commitment}`);
    
    // Test successfully wrapped up!
    setTimeout(() => {
        agentB.stop();
        process.exit(0);
    }, 1000);
  });

  await agentB.start();

  // 2. Initialisiere Agent A (Käufer / Prover)
  const agentA = new RohanNode({
    apiKey: "rohan_sk_test",
    relayerUrl: "http://localhost:4005",
    did: "did:rohan:buyer",
    port: 4000
  });

  await agentA.start();

  // 3. Der autonome Trigger
  console.log("\n[Test] Agent A startet autonomen Deal in 2 Sekunden...");
  setTimeout(async () => {
    try {
      // "targetUrl" ist in v0.2.0 obsolet, der Contract übernimmt die Adressierung
      await agentA.handshake("contract", "Erster M2M Ping", 150);
    } catch (e) {
      console.error("Deal fehlgeschlagen:", e);
    }
  }, 2000);

  // 4. Die Beobachtung
  // Das Skript macht nichts weiter. Agent B MUSS dank seines Pollers
  // autonom auf den State-Change von Agent A reagieren. 
}

runM2MPing().catch(console.error);
