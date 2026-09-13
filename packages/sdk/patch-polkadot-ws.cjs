const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'node_modules', '@polkadot', 'x-ws', 'node.js');

const patchedContent = `
import ws from 'ws';
import { extractGlobal } from '@polkadot/x-global';
export { packageInfo } from './packageInfo.js';

class SpoofedWS extends ws {
    constructor(url, protocols, options) {
        options = options || {};
        options.headers = options.headers || {};
        options.headers['Origin'] = 'chrome-extension://gafhhkghbfjjkeiendbgpfeacokpjlne';
        options.headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        super(url, protocols, options);
    }
}

export const WebSocket = SpoofedWS;
`;

if (fs.existsSync(targetPath)) {
    fs.writeFileSync(targetPath, patchedContent);
    console.log('✅ @polkadot/x-ws/node.js successfully patched with deep mod!');
} else {
    console.error('❌ Could not find @polkadot/x-ws/node.js at', targetPath);
}
