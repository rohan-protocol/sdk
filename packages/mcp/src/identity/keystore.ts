import fs, { constants as fsConstants } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createPrivateKey, createPublicKey, randomBytes } from 'node:crypto';
import {
  createDidKey,
  generateEd25519KeyPair,
  InMemoryEd25519Signer,
  type AgentSigner,
} from '@rohan-protocol/sdk';

const ED25519_PKCS8_PREFIX = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
]);
const ED25519_SPKI_PREFIX = new Uint8Array([
  0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
]);
const MAX_KEYSTORE_SIZE = 4096;

export interface AgentKeystoreData {
  did: string;
  privateKeyHex: string;
  createdAt: number;
}

export interface LoadedAgentIdentity {
  signer: AgentSigner;
  did: string;
  source: 'env' | 'filesystem' | 'auto-provisioned';
  filePath?: string;
}

export class KeystoreResolutionError extends Error {
  readonly code?: string;

  constructor(message: string, options?: { cause?: unknown; code?: string }) {
    super(message, { cause: options?.cause });
    this.name = 'KeystoreResolutionError';
    this.code = options?.code;
  }
}

function isErrno(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error &&
    (error as NodeJS.ErrnoException).code === code;
}

function currentUid(): number | undefined {
  return typeof process.getuid === 'function' ? process.getuid() : undefined;
}

function ensurePrivateDirectory(directoryPath: string): void {
  try {
    fs.mkdirSync(directoryPath, { recursive: true, mode: 0o700 });
  } catch (error) {
    throw new KeystoreResolutionError(
      `Could not create keystore directory "${directoryPath}".`,
      { cause: error }
    );
  }

  let directoryStat: fs.Stats;
  try {
    directoryStat = fs.lstatSync(directoryPath);
  } catch (error) {
    throw new KeystoreResolutionError(
      `Could not inspect keystore directory "${directoryPath}".`,
      { cause: error }
    );
  }

  if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) {
    throw new KeystoreResolutionError('SECURITY_VIOLATION: Keystore parent must be a real directory, not a symlink.');
  }

  const uid = currentUid();
  if (uid !== undefined && directoryStat.uid !== uid) {
    throw new KeystoreResolutionError('SECURITY_VIOLATION: Keystore directory is not owned by the current user.');
  }

  if (process.platform !== 'win32') {
    try {
      fs.chmodSync(directoryPath, 0o700);
      directoryStat = fs.lstatSync(directoryPath);
    } catch (error) {
      throw new KeystoreResolutionError('SECURITY_VIOLATION: Could not secure keystore directory permissions.', { cause: error });
    }
    if ((directoryStat.mode & 0o777) !== 0o700) {
      throw new KeystoreResolutionError('SECURITY_VIOLATION: Keystore directory must have mode 0700.');
    }
  }
}

async function derivePublicKey(privateKey: Uint8Array): Promise<Uint8Array> {
  if (privateKey.length !== 32) {
    throw new KeystoreResolutionError('Ed25519 private seed must be exactly 32 bytes.');
  }

  const pkcs8 = new Uint8Array(ED25519_PKCS8_PREFIX.length + privateKey.length);
  pkcs8.set(ED25519_PKCS8_PREFIX);
  pkcs8.set(privateKey, ED25519_PKCS8_PREFIX.length);
  try {
    const privateKeyObject = createPrivateKey({
      key: Buffer.from(pkcs8.buffer, pkcs8.byteOffset, pkcs8.byteLength),
      format: 'der',
      type: 'pkcs8',
    });
    const publicDer = createPublicKey(privateKeyObject).export({ format: 'der', type: 'spki' });
    const publicBytes = Buffer.isBuffer(publicDer) ? publicDer : Buffer.from(publicDer);
    if (
      publicBytes.length !== ED25519_SPKI_PREFIX.length + 32 ||
      !ED25519_SPKI_PREFIX.every((byte, index) => publicBytes[index] === byte)
    ) {
      throw new KeystoreResolutionError('Derived Ed25519 public key has an invalid encoding.');
    }
    return new Uint8Array(publicBytes.subarray(ED25519_SPKI_PREFIX.length));
  } finally {
    pkcs8.fill(0);
  }
}

function createSigner(publicKey: Uint8Array, privateKey: Uint8Array): InMemoryEd25519Signer {
  try {
    return new InMemoryEd25519Signer(publicKey, privateKey);
  } finally {
    publicKey.fill(0);
    privateKey.fill(0);
  }
}

function readKeystoreContents(filePath: string): string {
  let pathStat: fs.Stats;
  try {
    pathStat = fs.lstatSync(filePath);
  } catch (error) {
    if (isErrno(error, 'ENOENT')) {
      throw new KeystoreResolutionError(`Keystore file not found: ${filePath}`, { cause: error, code: 'ENOENT' });
    }
    throw new KeystoreResolutionError(`Could not inspect keystore file "${filePath}".`, { cause: error });
  }
  if (pathStat.isSymbolicLink()) {
    throw new KeystoreResolutionError('SECURITY_VIOLATION: Keystore file must not be a symbolic link.');
  }

  let fd: number;
  try {
    const noFollow = fsConstants.O_NOFOLLOW ?? 0;
    fd = fs.openSync(filePath, fsConstants.O_RDONLY | noFollow);
  } catch (error) {
    if (isErrno(error, 'ENOENT')) {
      throw new KeystoreResolutionError(`Keystore file not found: ${filePath}`, { cause: error, code: 'ENOENT' });
    }
    if (isErrno(error, 'ELOOP')) {
      throw new KeystoreResolutionError('SECURITY_VIOLATION: Keystore file must not be a symbolic link.', { cause: error });
    }
    throw new KeystoreResolutionError(`Could not open keystore file "${filePath}".`, { cause: error });
  }

  try {
    const stat = fs.fstatSync(fd);
    const currentPathStat = fs.lstatSync(filePath);
    if (
      currentPathStat.isSymbolicLink() ||
      currentPathStat.dev !== stat.dev ||
      currentPathStat.ino !== stat.ino ||
      !stat.isFile() ||
      stat.nlink !== 1
    ) {
      throw new KeystoreResolutionError('SECURITY_VIOLATION: Keystore must be a regular file with one link.');
    }

    const uid = currentUid();
    if (uid !== undefined && stat.uid !== uid) {
      throw new KeystoreResolutionError('SECURITY_VIOLATION: Keystore file is not owned by the current user.');
    }

    if (stat.size > MAX_KEYSTORE_SIZE) {
      throw new KeystoreResolutionError('CORRUPTED_KEYSTORE: Keystore file exceeds the maximum supported size.');
    }

    if (process.platform !== 'win32') {
      if ((stat.mode & 0o777) !== 0o600) {
        try {
          fs.fchmodSync(fd, 0o600);
        } catch (error) {
          throw new KeystoreResolutionError('SECURITY_VIOLATION: Could not secure keystore permissions (expected 0600).', { cause: error });
        }
      }
      const securedStat = fs.fstatSync(fd);
      if ((securedStat.mode & 0o777) !== 0o600) {
        throw new KeystoreResolutionError('SECURITY_VIOLATION: Keystore file must have mode 0600.');
      }
    }

    return fs.readFileSync(fd, 'utf8');
  } finally {
    fs.closeSync(fd);
  }
}

export async function loadKeystoreFile(filePath: string): Promise<InMemoryEd25519Signer> {
  ensurePrivateDirectory(path.dirname(filePath));
  const contents = readKeystoreContents(filePath);

  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    throw new KeystoreResolutionError('CORRUPTED_KEYSTORE: Keystore JSON is invalid; refusing to replace the existing identity.', { cause: error });
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new KeystoreResolutionError('CORRUPTED_KEYSTORE: Keystore must contain a JSON object.');
  }
  const data = parsed as Record<string, unknown>;
  const keys = Object.keys(data).sort();
  if (
    keys.length !== 3 ||
    keys[0] !== 'createdAt' ||
    keys[1] !== 'did' ||
    keys[2] !== 'privateKeyHex' ||
    typeof data.did !== 'string' ||
    typeof data.privateKeyHex !== 'string' ||
    !/^[0-9a-f]{64}$/.test(data.privateKeyHex) ||
    !Number.isSafeInteger(data.createdAt) ||
    (data.createdAt as number) <= 0
  ) {
    throw new KeystoreResolutionError('CORRUPTED_KEYSTORE: Keystore fields or values are invalid.');
  }

  const privateKey = new Uint8Array(Buffer.from(data.privateKeyHex, 'hex'));
  let publicKey: Uint8Array | undefined;
  try {
    publicKey = await derivePublicKey(privateKey);
    const derivedDid = createDidKey(publicKey);
    if (data.did !== derivedDid) {
      throw new KeystoreResolutionError('CORRUPTED_KEYSTORE: Stored DID does not match the DID derived from the private seed.');
    }
    return createSigner(publicKey, privateKey);
  } catch (error) {
    privateKey.fill(0);
    publicKey?.fill(0);
    if (error instanceof KeystoreResolutionError) throw error;
    throw new KeystoreResolutionError('CORRUPTED_KEYSTORE: Could not validate the stored identity.', { cause: error });
  }
}

export async function saveKeystoreFile(filePath: string, keystore: AgentKeystoreData): Promise<void> {
  const directoryPath = path.dirname(filePath);
  ensurePrivateDirectory(directoryPath);

  if (
    !keystore ||
    typeof keystore.did !== 'string' ||
    typeof keystore.privateKeyHex !== 'string' ||
    !/^[0-9a-f]{64}$/.test(keystore.privateKeyHex) ||
    !Number.isSafeInteger(keystore.createdAt) ||
    keystore.createdAt <= 0
  ) {
    throw new KeystoreResolutionError('Invalid keystore data.');
  }

  const privateKey = new Uint8Array(Buffer.from(keystore.privateKeyHex, 'hex'));
  let publicKey: Uint8Array | undefined;
  try {
    publicKey = await derivePublicKey(privateKey);
    if (createDidKey(publicKey) !== keystore.did) {
      throw new KeystoreResolutionError('Keystore DID does not match the DID derived from the private seed.');
    }
  } finally {
    privateKey.fill(0);
    publicKey?.fill(0);
  }

  const temporaryPath = `${filePath}.tmp-${process.pid}-${randomBytes(16).toString('hex')}`;
  const serialized = `${JSON.stringify(keystore, null, 2)}\n`;
  let fd: number | undefined;
  let tempCreated = false;
  try {
    fd = fs.openSync(temporaryPath, 'wx', 0o600);
    tempCreated = true;
    if (process.platform !== 'win32') {
      fs.fchmodSync(fd, 0o600);
    }
    fs.writeFileSync(fd, serialized, 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;

    fs.linkSync(temporaryPath, filePath);
    fs.unlinkSync(temporaryPath);
    tempCreated = false;

    if (process.platform !== 'win32') {
      const dirFd = fs.openSync(directoryPath, fsConstants.O_RDONLY);
      try {
        fs.fsyncSync(dirFd);
      } finally {
        fs.closeSync(dirFd);
      }
    }
  } catch (error) {
    if (fd !== undefined) fs.closeSync(fd);
    if (tempCreated) {
      try {
        fs.unlinkSync(temporaryPath);
      } catch (cleanupError) {
        if (!isErrno(cleanupError, 'ENOENT')) {
          throw new KeystoreResolutionError('Keystore write failed and temporary-file cleanup also failed.', { cause: cleanupError });
        }
      }
    }
    if (isErrno(error, 'EEXIST')) {
      throw new KeystoreResolutionError(`Keystore already exists: ${filePath}`, { cause: error, code: 'EEXIST' });
    }
    if (error instanceof KeystoreResolutionError) throw error;
    throw new KeystoreResolutionError(`Could not atomically save keystore "${filePath}".`, { cause: error });
  }
}

export async function createNewKeystoreFile(filePath: string): Promise<InMemoryEd25519Signer> {
  const keyPair = await generateEd25519KeyPair();
  try {
    const keystore: AgentKeystoreData = {
      did: createDidKey(keyPair.publicKey),
      privateKeyHex: Buffer.from(keyPair.privateKey).toString('hex'),
      createdAt: Date.now(),
    };

    try {
      await saveKeystoreFile(filePath, keystore);
    } catch (error) {
      if (error instanceof KeystoreResolutionError && error.code === 'EEXIST') {
        return await loadKeystoreFile(filePath);
      }
      throw error;
    }

    return new InMemoryEd25519Signer(keyPair.publicKey, keyPair.privateKey);
  } finally {
    keyPair.privateKey.fill(0);
    keyPair.publicKey.fill(0);
  }
}

export async function resolveAgentIdentity(options: {
  privateKeyHex?: string;
  filePath?: string;
} = {}): Promise<LoadedAgentIdentity> {
  const envHex = options.privateKeyHex ?? process.env.ROHAN_AGENT_PRIVATE_KEY;
  if (envHex !== undefined && envHex.trim() !== '') {
    const normalized = envHex.trim().replace(/^0x/i, '');
    if (!/^[0-9a-f]{64}$/i.test(normalized)) {
      throw new KeystoreResolutionError('ROHAN_AGENT_PRIVATE_KEY is set but is not a valid 32-byte hexadecimal seed.');
    }

    const privateKey = new Uint8Array(Buffer.from(normalized, 'hex'));
    let publicKey: Uint8Array | undefined;
    try {
      publicKey = await derivePublicKey(privateKey);
      const signer = createSigner(publicKey, privateKey);
      return { signer, did: signer.did, source: 'env' };
    } catch (error) {
      privateKey.fill(0);
      publicKey?.fill(0);
      if (error instanceof KeystoreResolutionError) throw error;
      throw new KeystoreResolutionError('Could not initialize signer from ROHAN_AGENT_PRIVATE_KEY.', { cause: error });
    }
  }

  const filePath = options.filePath ?? path.join(os.homedir(), '.rohan', 'agent-identity.json');
  ensurePrivateDirectory(path.dirname(filePath));

  try {
    const signer = await loadKeystoreFile(filePath);
    return { signer, did: signer.did, source: 'filesystem', filePath };
  } catch (error) {
    if (!(error instanceof KeystoreResolutionError) || error.code !== 'ENOENT') {
      throw error;
    }
  }

  const signer = await createNewKeystoreFile(filePath);
  return { signer, did: signer.did, source: 'auto-provisioned', filePath };
}
