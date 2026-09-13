const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'node_modules', '@midnight-ntwrk', 'wallet-sdk-indexer-client', 'dist', 'effect', 'WsSubscriptionClient.js');

if (fs.existsSync(targetPath)) {
    let content = fs.readFileSync(targetPath, 'utf-8');
    
    // Inject webSocketImpl: globalThis.WebSocket
    content = content.replace(
        /createClient\(\{\s*url:\s*url\.toString\(\),\s*shouldRetry:\s*\(\)\s*=>\s*false,\s*keepAlive:\s*config\.keepAlive\s*\?\?\s*15_000\s*\}\)/,
        'createClient({ url: url.toString(), shouldRetry: () => false, keepAlive: config.keepAlive ?? 15000, webSocketImpl: globalThis.WebSocket })'
    );
    
    fs.writeFileSync(targetPath, content);
    console.log('✅ WsSubscriptionClient successfully patched to use webSocketImpl: globalThis.WebSocket!');
} else {
    console.error('❌ Could not find WsSubscriptionClient at', targetPath);
}
