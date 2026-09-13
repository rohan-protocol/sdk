const fetch = require('node-fetch').default || require('node-fetch');

const INDEXER_URL = 'https://indexer.preprod.midnight.network/api/v4/graphql';
const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Origin': 'chrome-extension://gafhhkghbfjjkeiendbgpfeacokpjlne'
};

async function main() {
    const introspectionQuery = `
    {
      __schema {
        queryType {
          fields {
            name
            args {
              name
              type {
                name
                kind
              }
            }
          }
        }
      }
    }`;

    const res = await fetch(INDEXER_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: introspectionQuery })
    });
    const data = await res.json();
    const fields = data.data.__schema.queryType.fields;
    console.log("ALL AVAILABLE FIELDS UNDER QUERY:");
    fields.forEach(f => {
        console.log(`- ${f.name} (args: ${f.args.map(a => `${a.name}: ${a.type.name || a.type.kind}`).join(', ')})`);
    });
}
main().catch(console.error);
