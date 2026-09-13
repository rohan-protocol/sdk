import * as facade from '@midnight-ntwrk/wallet-sdk-facade';
import * as dust from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import * as netId from '@midnight-ntwrk/midnight-js-network-id';
import * as ledger from '@midnight-ntwrk/ledger-v8';
import * as wallet from '@midnight-ntwrk/wallet';

console.log('Facade exports:', Object.keys(facade).filter(k => k.toLowerCase().includes('dust')));
console.log('Dust exports:', Object.keys(dust).filter(k => k.toLowerCase().includes('dust')));
console.log('Network ID exports:', Object.keys(netId));

// Can we get DustParameters from NetworkId?
try {
  console.log('NetworkId.getNetworkId():', netId.getNetworkId());
} catch(e) {}

// Let's check how wallet package creates DustParameters
const builder = wallet.WalletBuilder.build.toString();
console.log('\nWalletBuilder.build contains DustParameters?', builder.includes('DustParameters'));

// Check what getNetworkId() actually returns? Maybe it has parameters?
console.log('\nLooking for default DustParameters...');
for (const key of Object.keys(ledger)) {
  if (key.toLowerCase().includes('dust')) {
    console.log(`ledger.${key} = ${typeof ledger[key]}`);
  }
}
