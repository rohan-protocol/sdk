// Direct GraphQL query to check unshielded balance for our address
const INDEXER_URL = 'http://127.0.0.1:8080/api/v4/graphql';

// Our seed's unshielded address (from setup_and_deploy.ts output)
// Let's query all unshielded UTXOs

async function queryIndexer(query, variables = {}) {
  const resp = await fetch(INDEXER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  return resp.json();
}

async function main() {
  // 1. Check what queries are available
  console.log('=== Checking Indexer Schema ===');
  const schemaResult = await queryIndexer(`{
    __schema {
      queryType {
        fields {
          name
          description
        }
      }
    }
  }`);
  
  console.log('Available queries:');
  for (const field of schemaResult.data.__schema.queryType.fields) {
    console.log(`  - ${field.name}: ${field.description || '(no desc)'}`);
  }

  // 2. Try to query unshielded transactions/UTXOs
  console.log('\n=== Checking for unshielded balance ===');
  
  // Try the block query to find latest
  try {
    const blockResult = await queryIndexer(`{
      block {
        header {
          height
          hash
        }
      }
    }`);
    console.log('Latest block:', JSON.stringify(blockResult.data?.block?.header));
  } catch(e) {
    console.log('Block query error:', e.message);
  }

  // 3. Check subscription types
  const subResult = await queryIndexer(`{
    __schema {
      subscriptionType {
        fields {
          name
          description
        }
      }
    }
  }`);
  
  console.log('\nAvailable subscriptions:');
  for (const field of subResult.data.__schema.subscriptionType.fields) {
    console.log(`  - ${field.name}: ${field.description || '(no desc)'}`);
  }
  
  // 4. Check mutation types
  const mutResult = await queryIndexer(`{
    __schema {
      mutationType {
        fields {
          name
          description
        }
      }
    }
  }`);
  
  console.log('\nAvailable mutations:');
  for (const field of mutResult.data.__schema.mutationType.fields) {
    console.log(`  - ${field.name}: ${field.description || '(no desc)'}`);
  }
}

main().catch(e => { console.error('ERROR:', e); process.exit(1); });
