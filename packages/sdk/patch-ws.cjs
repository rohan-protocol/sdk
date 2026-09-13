const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'node_modules', 'isomorphic-ws', 'node.js');

const patchedContent = `
"use strict";
const WebSocket = require('ws');
class SpoofedWebSocket extends WebSocket {
    constructor(url, protocols, options) {
        options = options || {};
        options.headers = options.headers || {};
        options.headers['Origin'] = 'chrome-extension://gafhhkghbfjjkeiendbgpfeacokpjlne';
        options.headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        super(url, protocols, options);
    }
}
Object.assign(SpoofedWebSocket, WebSocket);
SpoofedWebSocket.WebSocket = SpoofedWebSocket;
module.exports = SpoofedWebSocket;
`;

if (fs.existsSync(targetPath)) {
    fs.writeFileSync(targetPath, patchedContent);
    console.log('✅ isomorphic-ws/node.js successfully patched with deep mod!');
} else {
    console.error('❌ Could not find isomorphic-ws/node.js at', targetPath);
}
