# Store open — lean checklist

**Full agent SOP:** `docs/PAID-PRODUCT-LAUNCH-AUTOMATION.md`

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

## Reusable launch checklist

Use this when cloning the rail for a new paid product.

### Public side

1. Pick the public sales surface:
   - add a slot on `/pipeline/`
   - create a standalone page like `/commits/` or `/ship-kit/`
2. Write the public promise:
   - what it is
   - what the buyer gets
   - how fast fulfillment happens
3. Add one CTA with:
   - `data-checkout-sku="<slug>"`
   - fallback `href` to the matching tier URL
4. Keep only preview/sample material public.

### Private side

1. Add the SKU to `payment-links.json`.
2. Upload the paid body to KV as `product:<slug>`.
3. Confirm Worker secrets/vars are present.
4. Redeploy the Worker after SKU changes.

### Provider side

1. Square webhook still points to the current Worker URL.
2. Square redirect allowlist includes the return page.
3. Resend sender is verified.
4. Optional but recommended: store Resend delivery events later for bounce/complaint handling.

## Real `$1` walkthrough — `commit-copy-deck`

### Public shop

- Catalog page: `/pipeline/`
- Product page: `/commits/`
- Public CTA on both pages: `data-checkout-sku="commit-copy-deck"`

### Private shop

- Public config maps `commit-copy-deck` to:
  - tier `usd_1`
  - amount `100`
  - line name `Commit Copy Deck`
- Private payload lives in KV under `product:commit-copy-deck`

### Payment

1. Buyer clicks the `$1` CTA.
2. `checkout-resolve.js` rewrites the link to Worker `/pay`.
3. Worker creates a fresh Square checkout for the exact SKU.
4. Worker stamps `devtools:sku=commit-copy-deck` into `payment_note`.
5. Buyer pays on Square-hosted checkout.

### Confirmation

1. Square confirms payment and sends `payment.updated`.
2. Worker verifies the signature and checks payment status.
3. Worker extracts the slug from `payment_note`.

### Fulfillment

1. Worker fetches `product:commit-copy-deck`.
2. Worker sends the fulfillment email via Resend.
3. Worker writes `fulfilled:<payment_id>` only after send succeeds.
4. Duplicate webhook delivery does not duplicate customer fulfillment.

### Recreate this for the next product

1. Create the public page or catalog entry.
2. Create the SKU entry.
3. Upload the private payload.
4. Deploy Worker.
5. Run `node scripts/verify-skus.mjs`.
6. Test the lowest price path once before public launch.

**Never** commit Square tokens or Resend keys.

---

Narrative framing: `docs/TEAM-LIFECYCLE.md`. Static funnel template: `docs/SHIP-KIT.md`.
