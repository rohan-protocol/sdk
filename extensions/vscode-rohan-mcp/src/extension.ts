import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  // 1. Command: Copy MCP Config Snippet
  const configCommand = vscode.commands.registerCommand('rohan.configureMcp', async () => {
    const configSnippet = {
      mcpServers: {
        "rohan-zk-shield": {
          command: "npx",
          args: ["-y", "@rohan-protocol/mcp@latest"],
          env: {
            ROHAN_CONTRACT_ADDRESS: "585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e",
            ROHAN_RELAYER_URL: "https://api.rohanprotocol.network/api/v1/handshake"
          }
        }
      }
    };

    await vscode.env.clipboard.writeText(JSON.stringify(configSnippet, null, 2));
    vscode.window.showInformationMessage('🛡️ Rohan Protocol MCP config copied to clipboard! Paste into your Claude Desktop, Cursor, or Cline settings.');
  });

  // 2. Command: Test Live Connection to Midnight Preprod Gateway
  const testCommand = vscode.commands.registerCommand('rohan.testHandshake', async () => {
    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "Rohan: Pinging Midnight Preprod Gateway...",
      cancellable: false
    }, async () => {
      try {
        const res = await fetch('https://api.rohanprotocol.network/health');
        if (!res.ok) throw new Error(`Gateway returned HTTP ${res.status}`);
        const data: any = await res.json();
        
        vscode.window.showInformationMessage(
          `✅ Rohan Gateway Online! Engine: ${data.engine} | Contract: ${data.contract?.slice(0, 10)}... | Root: ${data.currentRoot?.slice(0, 10)}...`
        );
      } catch (err: any) {
        vscode.window.showErrorMessage(`❌ Rohan Gateway Error: ${err.message || 'Connection failed'}`);
      }
    });
  });

  context.subscriptions.push(configCommand, testCommand);
}

export function deactivate() {}
