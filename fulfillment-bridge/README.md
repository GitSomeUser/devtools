# Fulfillment bridge (Cloudflare Worker)

Mints Square **Payment Link** per click (`CreatePaymentLink`): line + cents from repo-root **`payment-links.json`** (imported at deploy). Stamps `payment_note` using **`payment_note_prefix`** + slug. **`POST /webhook`** verifies signature, sends Resend mail, writes **`fulfilled:<payment_id>`** only after a successful send.

**Concept:** `docs/SQUARE-FULFILLMENT.md` · **Agent launch SOP:** `docs/PAID-PRODUCT-LAUNCH-AUTOMATION.md`

## Square dashboard

Production token → **`wrangler secret put SQUARE_ACCESS_TOKEN`** (never commit). Location ID in `[vars]`. Webhook URL **`https://<worker>/webhook`** — same string as **`SQUARE_WEBHOOK_NOTIFICATION_URL`**. **`wrangler secret put SQUARE_WEBHOOK_SIGNATURE_KEY`**. Allow hosted-checkout redirects for your Pages origin paths.

## Deploy

```bash
cd fulfillment-bridge
npm install
npx wrangler deploy
npx wrangler secret put SQUARE_ACCESS_TOKEN
npx wrangler secret put SQUARE_WEBHOOK_SIGNATURE_KEY
npx wrangler secret put RESEND_API_KEY
```

## Vars (non-secret)

| Name | Example |
|------|---------|
| `SQUARE_ENVIRONMENT` | `production` |
| `SQUARE_LOCATION_ID` | `L…` |
| `SQUARE_WEBHOOK_NOTIFICATION_URL` | `https://….workers.dev/webhook` |
| `PUBLIC_SITE_ORIGIN` | `https://gitsomeuser.github.io` |
| `PUBLIC_SITE_PATH_PREFIX` | `/devtools` |
| `SQUARE_API_VERSION` | `2024-10-17` |
| `FULFILL_FROM_EMAIL` | Resend-verified sender |
| `FULFILL_TO_OVERRIDE_EMAIL` | Optional test inbox |

## Site + Worker sync

Edit **`payment-links.json`** at repo root → `node ../scripts/verify-skus.mjs` → **`npx wrangler deploy`**.

## Operating model

- **Public side:** GitHub Pages pages (`/pipeline/`, `/commits/`, `/ship-kit/`, etc.) and repo-root `payment-links.json`
- **Private side:** Worker secrets/vars plus KV deliverables stored as `product:<sku>`
- **Bridge role:** receive a public SKU click, mint a fresh Square checkout, verify payment webhook, deliver the private payload by email

This split is the point: the public site can sell openly while the paid body stays off the static site.

## KV deliverables

```bash
npx wrangler kv key put "product:<sku>" --binding=DELIVERABLES --path=/path/to/body.md
```

Tail logs in Cloudflare dashboard; each webhook emits one JSON line (`fulfillment_email.sent`, etc.).

## Example SKU lifecycle

Reference SKU: **`commit-copy-deck`** (`usd_1`, 100 cents)

1. Public page exposes a CTA with `data-checkout-sku="commit-copy-deck"`.
2. Browser hits Worker `GET /pay`.
3. Worker calls Square Create Payment Link with:
   - exact cents from `payment-links.json`
   - exact line name from `payment-links.json`
   - `payment_note=devtools:sku=commit-copy-deck`
4. Buyer pays on Square-hosted checkout.
5. Square sends `payment.updated` to Worker `/webhook`.
6. Worker verifies signature, checks `COMPLETED`, loads `product:commit-copy-deck`, sends mail via Resend.
7. Worker marks `fulfilled:<payment_id>` only after successful send.

This is the same lifecycle future products should reuse.
