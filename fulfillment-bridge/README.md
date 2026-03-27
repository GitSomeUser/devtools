# Square fulfillment bridge (Cloudflare Worker)

**Problem:** Static Payment Links only tell you the **price tier**, not **which product** the buyer intended. This Worker **mints a one-time Square checkout** per click via the **Create Payment Link API**, stamps `payment_note` with `devtools:sku=<slug>`, and exposes **`POST /webhook`** so you can trust Square notifications and route fulfillment by SKU—**without replacing** your existing dashboard links for manual use.

## What you configure (Square Developer Console)

1. Create or reuse an application with **Sandbox** or **Production** access token (scoped for online checkout: `PAYMENTS_WRITE`, `ORDERS_WRITE`, `ORDERS_READ`).
2. **Locations:** copy **Location ID** → `SQUARE_LOCATION_ID`.
3. **Webhooks:** add subscription  
   - URL: `https://<worker-host>/webhook` (must match `SQUARE_WEBHOOK_NOTIFICATION_URL` **exactly**, including path)  
   - Events: at minimum `payment.updated` (and optionally `payment.created`).  
   - Copy **signature key** → `SQUARE_WEBHOOK_SIGNATURE_KEY`.
4. **Allowed redirect URLs** (for hosted checkout): add your Pages origin + path, e.g. `https://gitsomeuser.github.io/devtools/pipeline` and `/devtools/automation`, or use a single `…/devtools/` prefix if Square allows.

## Deploy (Cloudflare)

```bash
cd fulfillment-bridge
npm install
npx wrangler deploy
wrangler secret put SQUARE_ACCESS_TOKEN
wrangler secret put SQUARE_WEBHOOK_SIGNATURE_KEY
```

Non-secret vars (Dashboard → Worker → Settings → Variables) or in `wrangler.toml` `[vars]`:

| Name | Example |
|------|---------|
| `SQUARE_ENVIRONMENT` | `production` or `sandbox` |
| `SQUARE_LOCATION_ID` | `Lxxxxxxxxxxxxx` |
| `SQUARE_WEBHOOK_NOTIFICATION_URL` | `https://devtools-square-bridge.account.workers.dev/webhook` |
| `PUBLIC_SITE_ORIGIN` | `https://gitsomeuser.github.io` |
| `PUBLIC_SITE_PATH_PREFIX` | `/devtools` |

## Connect the static site

In repo root **`payment-links.json`**, set:

```json
"checkout_bridge_base_url": "https://devtools-square-bridge.account.workers.dev"
```

(omit or `""` to keep using static tier links only.)

Pages load **`js/checkout-resolve.js`**, which rewrites `a[data-checkout-sku]` to `GET /pay?sku=…&return_path=…`.

## SKU catalog

**`catalog.json`** (this folder) must stay aligned with **`payment-links.json` → `skus`** (tiers + client fallbacks). When adding a product, update both and redeploy the Worker.

## Webhook log line

Each valid notification logs one JSON line to the Worker tail, e.g.:

```json
{"at":"…","type":"payment.updated","fulfillment":[{"sku":"reply-rescue-pack","payment_id":"…","status":"COMPLETED",…}]}
```

Hook this later to email, Slack, Airtable, or a queue—without changing Square dashboard links.
