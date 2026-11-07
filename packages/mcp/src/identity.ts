import { webcrypto } from 'node:crypto';
import {
  InMemoryEd25519Signer,
  type AgentSigner,
} from '@rohan-protocol/sdk';

const ED25519_PKCS8_PREFIX = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
]);

export async function resolveSignerFromEnv(
  rawPrivateKeyHex = process.env.ROHAN_AGENT_PRIVATE_KEY
): Promise<AgentSigner | undefined> {
  if (rawPrivateKeyHex === undefined || rawPrivateKeyHex.trim() === '') {
    return undefined;
  }

  const normalizedHex = rawPrivateKeyHex.trim().replace(/^0x/i, '');
  if (!/^[0-9a-f]{64}$/i.test(normalizedHex)) {
    throw new Error('ROHAN_AGENT_PRIVATE_KEY must be exactly 32 bytes encoded as 64 hex characters.');
  }

  const privateKey = new Uint8Array(Buffer.from(normalizedHex, 'hex'));
  const pkcs8Key = new Uint8Array(ED25519_PKCS8_PREFIX.length + privateKey.length);
  pkcs8Key.set(ED25519_PKCS8_PREFIX);
  pkcs8Key.set(privateKey, ED25519_PKCS8_PREFIX.length);

  try {
    const cryptoKey = await webcrypto.subtle.importKey(
      'pkcs8',
      pkcs8Key,
      { name: 'Ed25519' },
      true,
      ['sign']
    );
    const jwk = await webcrypto.subtle.exportKey('jwk', cryptoKey);
    if (!jwk.x) {
      throw new Error('Could not derive the Ed25519 public key from ROHAN_AGENT_PRIVATE_KEY.');
    }

    const publicKey = new Uint8Array(Buffer.from(jwk.x, 'base64url'));
    if (publicKey.length !== 32) {
      throw new Error('Derived Ed25519 public key has an invalid length.');
    }

    return new InMemoryEd25519Signer(publicKey, privateKey);
  } catch (error) {
    throw new Error(
      'Failed to initialize the Ed25519 signer from ROHAN_AGENT_PRIVATE_KEY.',
      { cause: error }
    );
  } finally {
    privateKey.fill(0);
    pkcs8Key.fill(0);
  }
}
