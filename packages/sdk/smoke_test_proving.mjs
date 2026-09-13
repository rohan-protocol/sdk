import { RohanClient } from './dist/index.js'; // Importiert unser frisch gebautes SDK
import * as dotenv from 'dotenv';
dotenv.config({ path: '../.env' }); // Holt sich die Env vom Root

async function main() {
    console.log('\n════════════════════════════════════════════');
    console.log('  🧪 ROHAN SDK — Local Proving Smoke Test');
    console.log('════════════════════════════════════════════\n');

    // Die Contract Address, die wir vorhin erfolgreich auf Preprod deployt haben
    const CONTRACT_ADDRESS = process.env.ROHAN_CONTRACT_ADDRESS || "6d2d603235f996424d76c85186a79cc403245ea8ee1ba9087e40967fe71bdc4d";

    console.log(`📦 Initialisiere RohanClient für Contract: ${CONTRACT_ADDRESS}`);
    
    // Initialisiere den SDK-Client (Nutzt ab jetzt den internen WASM Prover)
    const client = new RohanClient(CONTRACT_ADDRESS);

    // Fiktive Agenten-Daten für den Test-Handshake
    const testPayload = {
        agentId: "did:rohan:agent-alpha-001",
        intent: "data_exchange",
        timestamp: Date.now()
    };

    console.log("⚡ Generiere lokalen ZK-Proof (WASM) für Payload...", testPayload);
    
    try {
        // Diese Methode muss nun den Proof im RAM berechnen!
        const proofData = await client.generateHandshakeProof(testPayload);
        
        console.log("\n✅ LOKALER ZK-PROOF ERFOLGREICH GENERIERT!");
        console.log("📊 Proof-Größe (Bytes):", JSON.stringify(proofData).length);
        console.log("🔍 Proof-Ausschnitt:", JSON.stringify(proofData).substring(0, 100) + "...");
        
        console.log("\n🚀 Nächster Schritt im Relayer-Flow: HTTP POST -> api.rohanprotocol.network");
    } catch (error) {
        console.error("\n❌ Proof-Generierung fehlgeschlagen:", error);
    }
}

main();
