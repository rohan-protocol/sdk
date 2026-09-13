export class SemanticFirewall {
    static validate(intent) {
        // JSON-Guardrail & Intent Validation vor der ZK-Beweisführung
        if (!intent.agentId || !intent.action)
            return false;
        return true;
    }
}
