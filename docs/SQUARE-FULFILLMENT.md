# Square fulfillment — SKU-aware checkout + webhooks

## Problem

Static **Payment Links** (one URL per price) do not record *which product* the buyer chose. Several different offers can share **$35**.

## Solution (no dashboard link replacement)

1. **Fulfillment bridge** — Cloudflare Worker in **`fulfillment-bridge/`** calls Square’s **Create Payment Link** API for each click. Each session gets a fresh hosted checkout with:

   - **`payment_note`** set to `devtools:sku=<slug>` (appears on the resulting **Payment** in Square and in webhooks).
   - **`quick_pay`** line item name = human title from the catalog.

2. **Static site** — `payment-links.json` lists every slug under **`skus`** and sets **`checkout_bridge_base_url`** to your deployed Worker origin. **`js/checkout-resolve.js`** rewrites `a[data-checkout-sku]` to `GET https://<worker>/pay?sku=…&return_path=…`.

3. **Webhook** — In the Square Developer Dashboard, subscribe **`payment.updated`** (and optionally **`payment.created`**) to **`https://<worker>/webhook`**. The Worker verifies **`x-square-hmacsha256-signature`**, then logs JSON including parsed **`devtools:sku=`** for each completed payment. Use Worker logs, or extend the Worker to POST into your queue / email / CRM.

Your **existing** Square Payment Links stay valid for manual use and for **fallback** when `checkout_bridge_base_url` is empty.

## Deploy checklist

1. **`fulfillment-bridge/README.md`** — `wrangler deploy`, secrets, vars (`SQUARE_LOCATION_ID`, `SQUARE_WEBHOOK_NOTIFICATION_URL` must match the webhook URL **exactly**).
2. **`fulfillment-bridge/catalog.json`** — amounts + names; must align with **`payment-links.json` → `skus`**.
3. **`payment-links.json`** — set `checkout_bridge_base_url` to the Worker URL; push to `main`.
4. Square app — **redirect allowlist** for `https://gitsomeuser.github.io/devtools/…` (or your real host).

## Operations

- **Fulfillment:** Use webhook logs (or Square Dashboard payment **note**) to see `devtools:sku=` before sending the deliverable.
- **Adding a product:** Add slug to `catalog.json`, `payment-links.json` skus, and an HTML `data-checkout-sku`; redeploy Worker.
