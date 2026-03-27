/**
 * Assert payment-links.json skus: tier exists, amount_cents === tier*(100).
 * Run from repo root: node scripts/verify-skus.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const pl = JSON.parse(fs.readFileSync(path.join(root, 'payment-links.json'), 'utf8'));
const tierById = Object.fromEntries((pl.tiers || []).map((t) => [t.id, t]));

let err = 0;
for (const [sku, def] of Object.entries(pl.skus || {})) {
  const t = tierById[def.tier];
  if (!t) {
    console.error(`[verify-skus] missing tier "${def.tier}" for sku "${sku}"`);
    err++;
    continue;
  }
  const expected = Math.round(Number(t.amount) * 100);
  if (def.amount_cents !== expected) {
    console.error(
      `[verify-skus] amount_cents mismatch sku "${sku}": got ${def.amount_cents}, tier ${def.tier} expects ${expected}`
    );
    err++;
  }
}

if (err) process.exit(1);
console.log(`[verify-skus] ok — ${Object.keys(pl.skus || {}).length} skus`);
