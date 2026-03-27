# Store open — lean checklist

**Architecture:** `docs/SQUARE-FULFILLMENT.md` · **Worker deploy:** `fulfillment-bridge/README.md`

## Flow (one line)

`data-checkout-sku` → `checkout-resolve.js` → Worker `GET /pay` → Square stamps note (`payment_note_prefix` + slug from `payment-links.json`) → webhook `POST /webhook` → KV `product:<sku>` → Resend → **`fulfilled:<payment_id>` only after send succeeds**

## Repo map

| Path | Role |
|------|------|
| `payment-links.json` | Bridge URL, `skus` (`tier`, `amount_cents`, `square_line_name`), `tiers`, `payment_note_prefix` |
| `js/checkout-resolve.js` | Rewrites checkout anchors |
| `fulfillment-bridge/` | Worker + `wrangler.toml` |
| `scripts/verify-skus.mjs` | Tier cents + **every SKU has `data-checkout-sku` in some `.html`** |

## Prerequisites

GitHub Pages · Cloudflare Worker + KV · Square app + Location ID · Domain verified in Resend · Paid bodies off-repo until uploaded to KV

## Bootstrap

1. **Square:** Access token → `wrangler secret put SQUARE_ACCESS_TOKEN`. Webhook URL **`https://…/webhook`** → copy signature key → `wrangler secret put SQUARE_WEBHOOK_SIGNATURE_KEY`. Set Worker var **`SQUARE_WEBHOOK_NOTIFICATION_URL`** to that **exact** URL. Redirect allowlist → your Pages URLs.
2. **Deploy:** `cd fulfillment-bridge && npm i && npx wrangler deploy`. `wrangler secret put RESEND_API_KEY`. Fill `[vars]` per `README.md`.
3. **KV:** `npx wrangler kv key put "product:<sku>" --binding=DELIVERABLES --path=…`
4. **Site:** `checkout_bridge_base_url` in `payment-links.json`. Paid CTAs: `data-checkout-sku` + tier fallback `href`. Load `js/checkout-resolve.js`.
5. **`node scripts/verify-skus.mjs`** → commit → push.

## New SKU

1. Add `skus.<slug>` in `payment-links.json` (tier + `amount_cents` + `square_line_name`).
2. Add `data-checkout-sku` in HTML.
3. Optional: KV `product:<slug>`.
4. Verify script + **`npx wrangler deploy`** (Worker bundles JSON).

## Smoke

| Check | Pass |
|-------|------|
| `GET /health` | `ok` |
| `GET /pay?sku=bad` | `400` |
| `POST /webhook` (no sig) | `403` |
| Replay webhook | No duplicate email if `fulfilled:<id>` set |

**Never** commit Square tokens or Resend keys.

---

Narrative framing: `docs/TEAM-LIFECYCLE.md`. Static funnel template: `docs/SHIP-KIT.md`.
