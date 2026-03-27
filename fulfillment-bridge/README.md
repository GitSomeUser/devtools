# Fulfillment bridge (Cloudflare Worker)

Mints Square **Payment Link** per click (`CreatePaymentLink`): line + cents from repo-root **`payment-links.json`** (imported at deploy). Stamps `payment_note` using **`payment_note_prefix`** + slug. **`POST /webhook`** verifies signature, sends Resend mail, writes **`fulfilled:<payment_id>`** only after a successful send.

**Concept:** `docs/SQUARE-FULFILLMENT.md`

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

## KV deliverables

```bash
npx wrangler kv key put "product:<sku>" --binding=DELIVERABLES --path=/path/to/body.md
```

Tail logs in Cloudflare dashboard; each webhook emits one JSON line (`fulfillment_email.sent`, etc.).
