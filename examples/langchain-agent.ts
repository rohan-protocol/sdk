// Rohan SDK v0.3.1 - LangChain God Mode Demo
import { RohanSecureHandshakeTool } from '../src/index.js';
import { RohanNode } from '../src/index.js';

/**
 * Mocking a LangChain Agent Execution Environment.
 * In a real scenario, this would be wrapped by LangChain's 'AgentExecutor' or LangGraph.
 */

async function runLangChainGodMode() {
    console.log("🤖 [AI Core] Booting LangChain Agent Environment...\n");

    // 1. SDK Gasless Initialization (The Trojan Horse)
    const agentNode = new RohanNode({
        apiKey: "rohan_sk_test",
        relayerUrl: "https://api.rohanprotocol.network" // Pointing straight to the secure VPS Bank!
    });

    // 2. Injecting the SDK into the LLM Tool Repertoire
    const handshakeTool = new RohanSecureHandshakeTool(agentNode);

    const tools = [handshakeTool /*, searchTool, dbQueryTool */];
    console.log(`🔌 [AI Core] Tools loaded: ${tools.map(t => t.name).join(', ')}`);

    // --- MOCK LANGCHAIN REASONING LOOP ---
    console.log("\n💭 [LLM Reasoning]: 'The user requested to transfer secret data (Project Alpha Schematics) to Agent Beta (DID: did:rohan:beta).'");
    console.log("💭 [LLM Reasoning]: 'This data is highly confidential. I must not send it via standard HTTP REST API.'");
    console.log("💭 [LLM Reasoning]: 'I have access to the 'rohan_secure_handshake' tool. I will invoke it.'\n");

    // LLM Formats the call payload autonomously:
    const llmToolPayload = JSON.stringify({
        targetDID: "02d7fe8b22a0142b6a958e945feae6759c8d504533a69aa3fe6a8f6f5cc761b0", // Contract Ref
        secretData: "PROJECT ALPHA: Blueprints attached."
    });

    console.log(`🛠️ [LangChain Executor] Invoking tool '${handshakeTool.name}' with payload: ${llmToolPayload}\n`);

    // 3. The magic happens: The Tool wraps Web3 completely away from the LLM
    const toolResponse = await handshakeTool._call(llmToolPayload);

    console.log("\n💭 [LLM Reasoning]: 'Tool response received.'");
    console.log(`🤖 [AI Core] Output to User: "${toolResponse}"`);
}

runLangChainGodMode().catch(console.error);
