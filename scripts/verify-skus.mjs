/**
 * Assert payment-links.json skus:
 * - tier exists, amount_cents === tier amount * 100
 * - every sku appears as data-checkout-sku on at least one .html
 * - every data-checkout-sku references a defined sku
 * Run from repo root: node scripts/verify-skus.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const pl = JSON.parse(fs.readFileSync(path.join(root, 'payment-links.json'), 'utf8'));
const tierById = Object.fromEntries((pl.tiers || []).map((t) => [t.id, t]));

function collectHtmlFiles(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith('.') || ent.name === 'node_modules') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...collectHtmlFiles(p));
    else if (ent.name.endsWith('.html')) out.push(p);
  }
  return out;
}

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

const htmlFiles = collectHtmlFiles(root);
const blob = htmlFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const found = new Set();
for (const m of blob.matchAll(/data-checkout-sku="([^"]+)"/g)) {
  found.add(m[1].trim().toLowerCase());
}

for (const sku of Object.keys(pl.skus || {})) {
  const low = sku.toLowerCase();
  if (!found.has(low)) {
    console.error(`[verify-skus] sku "${sku}" missing data-checkout-sku in any .html`);
    err++;
  }
}

for (const x of found) {
  if (!pl.skus?.[x]) {
    console.error(`[verify-skus] HTML references unknown sku "${x}"`);
    err++;
  }
}

if (err) process.exit(1);
console.log(`[verify-skus] ok — ${Object.keys(pl.skus || {}).length} skus, ${htmlFiles.length} html files`);
