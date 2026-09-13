import { Request, Response } from 'express';
import Stripe from 'stripe';
import Database from 'better-sqlite3';
import path from 'node:path';
import crypto from 'node:crypto';

const dbPath = path.resolve(process.cwd(), 'api_keys.db');
const db = new Database(dbPath);

// Sicherstellen, dass die Tabelle existiert und um Email / Stripe-Referenzen erweitert ist
db.exec(`
  CREATE TABLE IF NOT EXISTS api_keys (
    apiKey TEXT PRIMARY KEY,
    tier TEXT NOT NULL,
    quotaRemaining INTEGER NOT NULL,
    createdAt INTEGER NOT NULL,
    active INTEGER DEFAULT 1,
    customerEmail TEXT,
    stripeSubscriptionId TEXT
  )
`);

try {
  db.prepare('ALTER TABLE api_keys ADD COLUMN customerEmail TEXT').run();
} catch (_) {
  // Spalte existiert bereits
}

try {
  db.prepare('ALTER TABLE api_keys ADD COLUMN stripeSubscriptionId TEXT').run();
} catch (_) {
  // Spalte existiert bereits
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2024-06-20' as any,
});

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

/**
 * Erzeugt einen kryptographischen API-Key mit Präfix.
 */
function generateApiKey(prefix = 'rohan_live'): string {
  const entropy = crypto.randomBytes(16).toString('hex');
  return `${prefix}_${entropy}`;
}

/**
 * ⚡ STRIPE WEBHOOK HANDLER: POST /api/v1/billing/webhook
 */
export async function handleStripeWebhook(req: Request, res: Response): Promise<any> {
  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  try {
    // Roh-Body zur Signaturprüfung nutzen
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error(`⚠️ Webhook Signatur-Fehler: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 1. Erfolgreicher Erstkauf (Checkout Session)
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const customerEmail = session.customer_details?.email || 'unknown';
    const tier = (session.metadata?.tier as string) || 'pro';
    
    // Quota anhand des Tiers bestimmen
    const quota = tier === 'scale' ? 125000 : 25000;
    const newApiKey = generateApiKey(tier === 'scale' ? 'rohan_scale' : 'rohan_live');

    db.prepare(`
      INSERT INTO api_keys (apiKey, tier, quotaRemaining, createdAt, active, customerEmail, stripeSubscriptionId)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `).run(newApiKey, tier, quota, Date.now(), customerEmail, session.subscription as string);

    console.log(`🎉 Neuer ${tier.toUpperCase()} Kunde! Key generiert: ${newApiKey} für ${customerEmail}`);
  }

  // 2. Monatliche Verlängerung (Invoice Payment Succeeded -> Quota wieder aufladen)
  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object as Stripe.Invoice;
    const subId = (invoice as any).subscription as string;

    if (subId) {
      const record = db.prepare('SELECT tier FROM api_keys WHERE stripeSubscriptionId = ?').get(subId) as { tier: string } | undefined;
      if (record) {
        const refill = record.tier === 'scale' ? 125000 : 25000;
        db.prepare('UPDATE api_keys SET quotaRemaining = ? WHERE stripeSubscriptionId = ?').run(refill, subId);
        console.log(`🔄 Quota für Subscription ${subId} wieder auf ${refill} aufgeladen!`);
      }
    }
  }

  // 3. Kündigung (Subscription Deleted -> Key deaktivieren)
  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription;
    db.prepare('UPDATE api_keys SET active = 0 WHERE stripeSubscriptionId = ?').run(sub.id);
    console.log(`🛑 Subscription ${sub.id} beendet. API-Key deaktiviert.`);
  }

  return res.json({ received: true });
}

/**
 * 🎁 $0 DEVELOPER TIER: POST /api/v1/auth/free-key
 * Gibt sofort einen Test-Key mit 500 Credits aus (ohne Google Forms!)
 */
export async function claimFreeDeveloperKey(req: Request, res: Response): Promise<any> {
  const { email } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  // Prüfen, ob Email bereits einen Key hat
  const existing = db.prepare('SELECT apiKey FROM api_keys WHERE customerEmail = ?').get(email) as { apiKey: string } | undefined;
  if (existing) {
    return res.json({ apiKey: existing.apiKey, message: 'Existing key retrieved' });
  }

  const freeKey = generateApiKey('rohan_dev');
  db.prepare(`
    INSERT INTO api_keys (apiKey, tier, quotaRemaining, createdAt, active, customerEmail)
    VALUES (?, 'developer', 500, ?, 1, ?)
  `).run(freeKey, Date.now(), email);

  console.log(`🎁 Kostenloser Developer-Key ausgegeben: ${freeKey} für ${email}`);
  return res.json({ apiKey: freeKey, credits: 500 });
}
