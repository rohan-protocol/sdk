const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'node_modules', '@midnight-ntwrk', 'wallet', 'dist', 'main.js');

if (fs.existsSync(targetPath)) {
    let content = fs.readFileSync(targetPath, 'utf-8');
    
    // Ersetze new WebSocket( durch new globalThis.WebSocket(
    content = content.replace(/new WebSocket\(/g, 'new globalThis.WebSocket(');
    content = content.replace(/\bfetch\(/g, 'globalThis.fetch(');
    
    fs.writeFileSync(targetPath, content);
    console.log('✅ @midnight-ntwrk/wallet/dist/main.js successfully patched to use globalThis.WebSocket!');
} else {
    console.error('❌ Could not find main.js at', targetPath);
}
