import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const configCommand = vscode.commands.registerCommand('rohan.configureMcp', async () => {
    const configSnippet = {
      mcpServers: {
        "rohan-protocol": {
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
    vscode.window.showInformationMessage('🛡️ Rohan Protocol MCP config copied to clipboard! Paste into your Cline, Claude, or Copilot MCP settings.');
  });

  context.subscriptions.push(configCommand);
}

export function deactivate() {}
