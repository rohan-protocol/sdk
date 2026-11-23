import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  RohanClient,
  computePayloadDigest,
  verifyAuditBundle,
  type NetworkId,
  type RohanAuditBundle,
} from '@rohan-protocol/sdk';

import {
  KeystoreResolutionError,
  loadKeystoreFile,
  resolveAgentIdentity,
} from './identity/keystore.js';
import { ROHAN_MCP_VERSION } from './mcp-app.js';

export interface CliIo {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
}

const DEFAULT_IO: CliIo = {
  stdout: (line) => process.stdout.write(line + '\n'),
  stderr: (line) => process.stderr.write(line + '\n'),
};

function resolveConfiguredNetwork(): NetworkId {
  const raw = (process.env.ROHAN_NETWORK || 'preprod').trim().toLowerCase();
  if (raw !== 'preprod' && raw !== 'testnet' && raw !== 'mainnet') {
    throw new Error(`INVALID_CONFIGURATION: Unsupported ROHAN_NETWORK "${raw}". Expected preprod, testnet, or mainnet.`);
  }
  return raw;
}

function defaultKeystorePath(): string {
  return path.join(os.homedir(), '.rohan', 'agent-identity.json');
}

function printUsage(io: CliIo, target: 'stdout' | 'stderr' = 'stdout'): void {
  const write = io[target];
  write(`Rohan Protocol MCP & Sovereign Identity CLI (v${ROHAN_MCP_VERSION})`);
  write('');
  write('Usage:');
  write('  rohan-shield                         Start MCP server over stdio (default, no arguments)');
  write('  rohan-shield init                    Provision/verify local Ed25519 identity & print MCP config');
  write('  rohan-shield status                  Show active DID, keystore state & live relayer reachability');
  write('  rohan-shield verify <payload.json> <bundle.json|digest>');
  write('                                       Offline cryptographic audit of payload vs bundle or SHA-256');
  write('  rohan-shield --help                  Show this help message');
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function handleInit(io: CliIo): Promise<number> {
  try {
    const loaded = await resolveAgentIdentity();
    try {
      const network = resolveConfiguredNetwork();
      const relayerUrl =
        process.env.ROHAN_RELAYER_URL || 'https://api.rohanprotocol.network/api/v1/handshake';

      io.stdout(`🛡️  Rohan Sovereign Agent Identity ready (${loaded.source})`);
      io.stdout(`   • Agent DID:  ${loaded.did}`);
      io.stdout(`   • Network:    midnight-${network}`);
      if (loaded.filePath) {
        io.stdout(`   • Keystore:   ${loaded.filePath} (permissions: 0600, private key kept offline)`);
      } else {
        io.stdout('   • Source:     ROHAN_AGENT_PRIVATE_KEY environment variable');
      }

      const mcpEntry: Record<string, unknown> = {
        command: 'npx',
        args: ['-y', '--package', `@rohan-protocol/mcp@${ROHAN_MCP_VERSION}`, 'rohan-shield'],
      };

      if (network !== 'preprod' || relayerUrl !== 'https://api.rohanprotocol.network/api/v1/handshake') {
        mcpEntry.env = {
          ...(network !== 'preprod' ? { ROHAN_NETWORK: network } : {}),
          ...(relayerUrl !== 'https://api.rohanprotocol.network/api/v1/handshake'
            ? { ROHAN_RELAYER_URL: relayerUrl }
            : {}),
        };
      }

      const configSnippet = {
        mcpServers: {
          'rohan-shield': mcpEntry,
        },
      };

      io.stdout('');
      io.stdout('📋 Claude Desktop / Cursor MCP Config (copy & paste):');
      io.stdout(JSON.stringify(configSnippet, null, 2));
      if (loaded.source === 'env') {
        io.stdout('');
        io.stdout('ℹ️  Note: ROHAN_AGENT_PRIVATE_KEY is active in this shell; ensure it is set in your MCP host env if you want to override ~/.rohan/agent-identity.json.');
      }
      return 0;
    } finally {
      if (typeof (loaded.signer as any).destroy === 'function') {
        (loaded.signer as any).destroy();
      }
    }
  } catch (err: any) {
    io.stderr(`❌ Initialization failed: ${err?.message || err}`);
    return 1;
  }
}

async function handleStatus(io: CliIo): Promise<number> {
  let network: NetworkId;
  try {
    network = resolveConfiguredNetwork();
  } catch (err: any) {
    io.stderr(`❌ Configuration error: ${err?.message || err}`);
    return 1;
  }

  const relayerUrl =
    process.env.ROHAN_RELAYER_URL || 'https://api.rohanprotocol.network/api/v1/handshake';
  const contractAddress =
    process.env.ROHAN_CONTRACT_ADDRESS ||
    '585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e';

  let agentDid: string | null = null;
  let identityStatus = 'not-initialized';
  let keystorePath: string | null = null;

  const envHex = process.env.ROHAN_AGENT_PRIVATE_KEY?.trim();
  if (envHex) {
    try {
      const loaded = await resolveAgentIdentity({ privateKeyHex: envHex });
      agentDid = loaded.did;
      identityStatus = 'env (ROHAN_AGENT_PRIVATE_KEY)';
      if (typeof (loaded.signer as any).destroy === 'function') {
        (loaded.signer as any).destroy();
      }
    } catch (err: any) {
      io.stderr(`❌ Invalid ROHAN_AGENT_PRIVATE_KEY: ${err?.message || err}`);
      return 1;
    }
  } else {
    const targetPath = defaultKeystorePath();
    keystorePath = targetPath;
    let exists = false;
    try {
      // Read-only lstat check so 'status' never creates ~/.rohan on uninitialized machines
      fs.lstatSync(targetPath);
      exists = true;
    } catch (err: any) {
      if (err?.code !== 'ENOENT') {
        io.stderr(`❌ Could not inspect keystore "${targetPath}": ${err?.message || err}`);
        return 1;
      }
    }

    if (exists) {
      try {
        const signer = await loadKeystoreFile(targetPath);
        agentDid = signer.did;
        identityStatus = 'filesystem (verified)';
        signer.destroy();
      } catch (err: any) {
        const msg = err instanceof KeystoreResolutionError ? err.message : String(err?.message || err);
        io.stderr(`❌ Keystore verification failed: ${msg}`);
        return 1;
      }
    }
  }

  // Match RohanClient.getLedgerState's 8s request timeout with a small buffer.
  const client = new RohanClient({
    network,
    contractAddress,
    relayerUrl,
    apiKey: process.env.ROHAN_API_KEY || '',
  });

  let relayerHealthy = false;
  let blockHeight: number | null = null;
  let stateRoot: string | null = null;
  let relayerError: string | null = null;

  try {
    const state = await withTimeout(
      client.getLedgerState(),
      8500,
      'Timed out after 8500ms'
    );
    relayerHealthy = true;
    blockHeight = state.blockHeight ?? null;
    stateRoot = state.currentStateRoot ?? null;
  } catch (err: any) {
    relayerError = err?.message || 'Unreachable';
  }

  io.stdout(`🛡️  Rohan Protocol Status (v${ROHAN_MCP_VERSION})`);
  io.stdout(`   • Identity:      ${agentDid ?? 'Not initialized (run "rohan-shield init" to provision)'}`);
  io.stdout(`   • Source:        ${identityStatus}`);
  if (keystorePath) {
    io.stdout(`   • Keystore Path: ${keystorePath}`);
  }
  io.stdout(`   • Network:       midnight-${network}`);
  io.stdout(`   • Contract:      ${contractAddress}`);
  io.stdout(`   • Relayer:       ${relayerHealthy ? 'ONLINE' : `OFFLINE (${relayerError})`}`);
  if (relayerHealthy) {
    io.stdout(`   • Block Height:  ${blockHeight ?? 'n/a'}`);
    io.stdout(`   • State Root:    ${stateRoot ?? 'n/a'}`);
  }

  return 0;
}

function constantTimeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function handleVerify(args: string[], io: CliIo): Promise<number> {
  if (args.length < 2) {
    io.stderr('❌ Usage: rohan-shield verify <payload.json> <audit-bundle.json|sha256-digest>');
    return 1;
  }

  const [payloadPath, target] = args;

  let payloadRaw: string;
  try {
    payloadRaw = fs.readFileSync(payloadPath, 'utf8');
  } catch (err: any) {
    io.stderr(`❌ FILE_NOT_FOUND: Could not read payload file "${payloadPath}": ${err?.message || err}`);
    return 1;
  }

  let payloadObj: unknown;
  try {
    payloadObj = JSON.parse(payloadRaw);
  } catch (err: any) {
    io.stderr(`❌ INVALID_JSON: Payload file "${payloadPath}" is not valid JSON: ${err?.message || err}`);
    return 1;
  }

  if (!payloadObj || typeof payloadObj !== 'object' || Array.isArray(payloadObj)) {
    io.stderr('❌ INVALID_PAYLOAD: Plaintext payload file must contain a JSON object.');
    return 1;
  }
  const payload = payloadObj as Record<string, unknown>;

  // Distinguish between a file path and a digest string
  const looksLikePath =
    target.endsWith('.json') || target.includes('/') || target.includes('\\') || fs.existsSync(target);

  if (looksLikePath) {
    if (!fs.existsSync(target)) {
      io.stderr(`❌ FILE_NOT_FOUND: Audit bundle file "${target}" does not exist.`);
      return 1;
    }

    let bundleObj: RohanAuditBundle;
    try {
      bundleObj = JSON.parse(fs.readFileSync(target, 'utf8'));
    } catch (err: any) {
      io.stderr(`❌ INVALID_JSON: Bundle file "${target}" is not valid JSON: ${err?.message || err}`);
      return 1;
    }

    const result = await verifyAuditBundle(bundleObj, payload);

    io.stdout(result.valid ? '✅ AUDIT RESULT: VALID (Offline Cryptographic Verification Passed)' : '❌ AUDIT RESULT: INVALID / TAMPERED');
    io.stdout(`   • Schema Valid:         ${result.schemaValid}`);
    io.stdout(`   • Payload Match:        ${result.payloadMatch}`);
    io.stdout(`   • Intent Binding Valid: ${result.intentBindingValid}`);
    io.stdout(`   • Ed25519 Signature:    ${result.signatureValid === null ? 'unsigned (no identityProof)' : result.signatureValid}`);
    if (bundleObj?.agentDid) io.stdout(`   • Agent DID:            ${bundleObj.agentDid}`);
    if (bundleObj?.txHash) io.stdout(`   • L1 TxHash:            ${bundleObj.txHash}`);
    if (result.errors.length > 0) {
      io.stderr(`   • Errors:               ${result.errors.join(' | ')}`);
    }

    return result.valid ? 0 : 1;
  }

  // Raw SHA-256 digest mode
  const cleanExpected = target.replace(/^(?:sha256:|0x)/i, '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(cleanExpected)) {
    io.stderr('❌ INVALID_DIGEST: Expected a valid audit-bundle.json path or 64-character SHA-256 hex digest.');
    return 1;
  }

  try {
    const computed = await computePayloadDigest(payload);
    const computedHex = computed.slice('sha256:'.length);
    const match = constantTimeHexEqual(computedHex, cleanExpected);

    io.stdout(match ? '✅ DIGEST MATCH: VALID (RFC 8785 JCS + SHA-256)' : '❌ DIGEST MISMATCH: INVALID / TAMPERED');
    io.stdout(`   • Expected: ${cleanExpected}`);
    io.stdout(`   • Computed: ${computedHex}`);
    return match ? 0 : 1;
  } catch (err: any) {
    io.stderr(`❌ VERIFICATION_ERROR: ${err?.message || err}`);
    return 1;
  }
}

export async function runCli(argv: string[], io: CliIo = DEFAULT_IO): Promise<number> {
  const [command, ...rest] = argv;

  if (command === '--help' || command === '-h' || command === 'help') {
    printUsage(io, 'stdout');
    return 0;
  }

  if (command === '--version' || command === '-v') {
    io.stdout(ROHAN_MCP_VERSION);
    return 0;
  }

  if (command === 'init') {
    return handleInit(io);
  }

  if (command === 'status') {
    return handleStatus(io);
  }

  if (command === 'verify') {
    return handleVerify(rest, io);
  }

  io.stderr(`❌ UNKNOWN_COMMAND: "${command}" is not a recognized subcommand.`);
  io.stderr('');
  printUsage(io, 'stderr');
  return 1;
}
