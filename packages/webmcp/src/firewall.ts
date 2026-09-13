export interface WebMcpToolCall {
  toolName: string;
  callerOrigin: string;
  parameters: Record<string, unknown>;
}

export class WebMcpFirewall {
  // Vollständiger Schutz gegen unsichtbaren Unicode-Schmuggel & Bidi-Overrides
  private static readonly INVISIBLE_UNICODE = 
    /[\u00AD\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFE00-\uFE0F\uFEFF]/;

  private static readonly INJECTION_PATTERNS = [
    /ignore\s+(all\s+)?previous\s+instructions/i,
    /system\s*:\s*override/i,
    /you\s+are\s+now\s+a/i,
    /jailbreak/i,
    /reveal\s+(your|the)\s+secret/i,
  ];

  static inspect(call: WebMcpToolCall): { allowed: boolean; reason?: string } {
    if (!call.toolName || !call.callerOrigin) {
      return { allowed: false, reason: 'Malformed Tool Call: Missing Origin or ToolName' };
    }

    const payloadString = JSON.stringify(call.parameters);

    if (this.INVISIBLE_UNICODE.test(payloadString)) {
      return { allowed: false, reason: 'Security Violation: Hidden Zero-Width / Formatting Unicode detected (V-07)' };
    }

    for (const pattern of this.INJECTION_PATTERNS) {
      if (pattern.test(payloadString)) {
        return { allowed: false, reason: `Security Violation: Prompt Injection Pattern detected (${pattern})` };
      }
    }

    return { allowed: true };
  }
}
