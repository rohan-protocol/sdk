import { Request, Response, NextFunction } from 'express';
import Database from 'better-sqlite3';
import path from 'node:path';
import crypto from 'node:crypto';

const dbPath = path.resolve(process.cwd(), 'api_keys.db');
const db = new Database(dbPath);

// In-Memory IP-Tracker für kostenlose Sandbox (10 Tx / 24h)
const ipUsage = new Map<string, { count: number; resetTime: number }>();

export function rohanAuthGate(req: Request, res: Response, next: NextFunction): any {
  const apiKey = req.headers['x-rohan-api-key'] as string;
  const clientIp = req.socket.remoteAddress || 'unknown';

  // 1. Authentifizierter Modus (API-Key vorhanden)
  if (apiKey) {
    try {
      const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
      
      // Robust gegen beide Schemas (apiKeyHash ODER apiKey):
      let record: any;
      try {
        const stmt = db.prepare('SELECT quotaRemaining, active, tier FROM api_keys WHERE apiKeyHash = ? OR apiKey = ?');
        record = stmt.get(apiKeyHash, apiKey);
      } catch (_) {
        // Fallback falls die Spalte apiKeyHash in der bestehenden DB noch nicht existiert
        const stmt = db.prepare('SELECT quotaRemaining, active, tier FROM api_keys WHERE apiKey = ?');
        record = stmt.get(apiKey);
      }

      // 🎯 WENN DER KEY NICHT EXISTIERT ODER INAKTIV IST: SAUBERES 403 FORBIDDEN!
      if (!record || record.active !== 1) {
        return res.status(403).json({
          error: 'Forbidden: Invalid or inactive API key. Access portal at https://rohanprotocol.network'
        });
      }

      if (record.quotaRemaining <= 0) {
        return res.status(402).json({
          error: 'Payment Required: Quota exhausted. Upgrade tier at https://rohanprotocol.network'
        });
      }

      // 1 Credit abziehen
      try {
        db.prepare('UPDATE api_keys SET quotaRemaining = quotaRemaining - 1 WHERE apiKeyHash = ? OR apiKey = ?').run(apiKeyHash, apiKey);
      } catch (_) {
        db.prepare('UPDATE api_keys SET quotaRemaining = quotaRemaining - 1 WHERE apiKey = ?').run(apiKey);
      }

      (req as any).auth = { tier: record.tier, apiKey };
      return next();
    } catch (err: any) {
      console.error('Auth-Gate unexpected failure:', err);
      return res.status(500).json({ error: 'Auth system internal failure' });
    }
  }

  // 2. Sandbox-Modus (Kein API-Key -> IP-Rate-Limit: 10 Tx / 24h)
  const now = Date.now();
  const usage = ipUsage.get(clientIp);

  if (!usage || now > usage.resetTime) {
    ipUsage.set(clientIp, { count: 1, resetTime: now + 24 * 60 * 60 * 1000 });
    (req as any).auth = { tier: 'sandbox_free' };
    return next();
  }

  if (usage.count >= 10) {
    return res.status(429).json({
      error: 'Too Many Requests: Free sandbox limit (10 handshakes/day) reached. Claim your API key at https://rohanprotocol.network'
    });
  }

  usage.count += 1;
  (req as any).auth = { tier: 'sandbox_free' };
  return next();
}
