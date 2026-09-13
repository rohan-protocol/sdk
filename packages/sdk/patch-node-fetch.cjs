const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'node_modules', 'node-fetch', 'src', 'index.js');

if (fs.existsSync(targetPath)) {
    let content = fs.readFileSync(targetPath, 'utf-8');
    
    // Wir wrappen den exportierten fetch in node-fetch
    content = content.replace(
        /export default function fetch\(url, request_\) \{/,
        `export default function fetch(url, request_) {
    request_ = request_ || {};
    request_.headers = request_.headers || {};
    request_.headers['Origin'] = 'chrome-extension://gafhhkghbfjjkeiendbgpfeacokpjlne';
    request_.headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';`
    );
    
    fs.writeFileSync(targetPath, content);
    console.log('✅ node-fetch successfully patched to include WAF headers!');
} else {
    console.error('❌ Could not find node-fetch at', targetPath);
}
