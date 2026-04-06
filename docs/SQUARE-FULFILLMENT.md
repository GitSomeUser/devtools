# Square fulfillment — SKU-aware checkout + webhooks

**Agent / automation entry point:** `docs/PAID-PRODUCT-LAUNCH-AUTOMATION.md` — step-by-step product → production with commands and completion criteria.

## Problem

Static **Payment Links** (one URL per price) do not record *which product* the buyer chose. Several different offers can share **$35**.

## Solution (no dashboard link replacement)

1. **Fulfillment bridge** — Cloudflare Worker in **`fulfillment-bridge/`** calls Square’s **Create Payment Link** API for each click. Each session gets a fresh hosted checkout with:

   - **`payment_note`** set to `devtools:sku=<slug>` (appears on the resulting **Payment** in Square and in webhooks).
   - **`quick_pay`** line item name and cents come from repo-root **`payment-links.json`** (`square_line_name`, `amount_cents` per slug).

2. **Static site** — `payment-links.json` lists every slug under **`skus`** and sets **`checkout_bridge_base_url`** to your deployed Worker origin. **`js/checkout-resolve.js`** rewrites `a[data-checkout-sku]` to `GET https://<worker>/pay?sku=…&return_path=…`.

3. **Webhook** — In the Square Developer Dashboard, subscribe **`payment.updated`** (and optionally **`payment.created`**) to **`https://<worker>/webhook`**. The Worker verifies **`x-square-hmacsha256-signature`**, parses `devtools:sku=...`, and on **COMPLETED** payments sends fulfillment email automatically through Resend (if configured).

Your **existing** Square Payment Links stay valid for manual use and for **fallback** when `checkout_bridge_base_url` is empty.

## Hardening checklist

Use this before you call the rail "done" for any paid product.

### Catalog + public shop

1. **Public page exists** — the buyer needs a clean public surface (`/pipeline/`, `/commits/`, `/ship-kit/`, etc.) with one clear CTA and a plain-English delivery line.
2. **Every paid CTA has `data-checkout-sku`** — this is what upgrades a generic tier link into a SKU-aware checkout.
3. **Every SKU lives in repo-root `payment-links.json`** with:

   - `tier`
   - `amount_cents`
   - `square_line_name`

4. **`checkout_bridge_base_url` is set** — otherwise the site falls back to the shared tier URL and loses exact SKU attribution.
5. **`node scripts/verify-skus.mjs` passes** — this is the guardrail that the public shop and the SKU map still agree.

### Worker + checkout bridge

1. **Worker deployed from `fulfillment-bridge/`** after any `payment-links.json` SKU or amount change.
2. **`GET /pay` mints a fresh Square checkout** using the exact slug clicked.
3. **`payment_note` stamps the slug** as `devtools:sku=<slug>` so later webhook handling knows what to deliver.
4. **Return path is explicit** — send the buyer back to the originating public page or thank-you state.

### Square

1. **Production access token stored as a secret** — never in repo.
2. **Webhook subscribed to `payment.updated`** and optionally `payment.created`.
3. **Webhook URL matches exactly** between Square and Worker config (`SQUARE_WEBHOOK_NOTIFICATION_URL`).
4. **Redirect allowlist includes your public Pages URLs** so the hosted checkout can return cleanly.
5. **Idempotent mindset** — treat `payment_id` / `order_id` as the business key for dedupe and replay safety.

### Fulfillment + delivery

1. **Private deliverable body stored off the public site** — current pattern is Worker KV under `product:<sku>`.
2. **Resend configured** with a verified sender (`FULFILL_FROM_EMAIL`).
3. **Fulfillment only marked complete after send succeeds** — current marker is `fulfilled:<payment_id>`.
4. **Retries are safe** — replaying the same Square event must not create duplicate customer delivery.
5. **If email fails, payment is still captured but fulfillment remains pending** until resend/retry succeeds.

### Operations + observability

1. **Worker logs are tail-able** for `payment`, `webhook`, and `fulfillment_email.sent` events.
2. **Webhook signature verification stays on** — never disable it for convenience.
3. **Store provider event IDs / payment IDs in logs** so you can answer "what happened?" quickly.
4. **Use Resend idempotency keys** for fulfillment mail keyed to the payment or order.
5. **Track post-send outcomes** (`delivered`, `bounced`, `complained`) if you want world-class operations instead of just "send attempted."

## Deploy checklist

1. **`fulfillment-bridge/README.md`** — `wrangler deploy`, secrets, vars (`SQUARE_LOCATION_ID`, `SQUARE_WEBHOOK_NOTIFICATION_URL` must match the webhook URL **exactly**).
2. **`payment-links.json`** (repo root) — each **`skus`** entry needs **`tier`**, **`amount_cents`**, **`square_line_name`** (plus top-level **`checkout_bridge_base_url`**). Run `node scripts/verify-skus.mjs` after edits.
3. Push site + JSON to `main`.
4. Square app — **redirect allowlist** for `https://gitsomeuser.github.io/devtools/…` (or your real host).

## Operations

- **Fulfillment:** Automatic when Resend is configured (`RESEND_API_KEY` + `FULFILL_FROM_EMAIL`). Private file bodies live in **Worker KV** under `product:<sku>` (see `fulfillment-bridge/README.md`). SKUs without KV content still get the link-only email until you upload the markdown.
- **Adding a product:** Extend **`payment-links.json` → `skus`**, add **`data-checkout-sku`** on the page, KV `product:<slug>` if needed; redeploy Worker so it bundles the updated JSON.

## Real example — `$1` purchase (`commit-copy-deck`)

This is the reference story for recreating the rail on future paid creations.

### 1. Public shop surface

- Public catalog entry: **`/pipeline/`** lists **`commit-copy-deck`** as the `$1` SKU.
- Public product page: **`/commits/`** gives the sales copy, preview, and CTA.
- Both pages expose a public button with **`data-checkout-sku="commit-copy-deck"`**.

This is the **public shop**: pages, copy, preview, CTA, and the static JSON map that tells the browser which SKU exists.

### 2. Private product definition

In **`payment-links.json`**:

- slug: `commit-copy-deck`
- tier: `usd_1`
- amount: `100`
- Square line name: `Commit Copy Deck`

In private fulfillment storage:

- KV key: **`product:commit-copy-deck`**
- contents: the paid body / deck email copy / delivery text

This is the **private shop**: the real paid payload and the server-side secrets/config needed to charge and deliver it.

### 3. Checkout creation

When the buyer clicked the `$1` CTA:

1. **`js/checkout-resolve.js`** read `payment-links.json`.
2. It saw `checkout_bridge_base_url` was set.
3. Instead of sending the buyer straight to the shared `$1` tier URL, it rewrote the click to:
   **`GET /pay?sku=commit-copy-deck&return_path=...`**
4. The Worker called Square **Create Payment Link** and minted a fresh hosted checkout for that exact SKU.
5. The Worker stamped **`payment_note=devtools:sku=commit-copy-deck`**.

That one stamp is what turns a generic `$1` payment into an attributable purchase of the actual deck.

### 4. Payment + confirmation

1. Buyer completed the hosted Square checkout.
2. Square recorded the payment and later sent **`payment.updated`** to the Worker webhook.
3. The Worker verified the Square signature.
4. The Worker read `payment_note`, extracted `commit-copy-deck`, and confirmed the payment was **`COMPLETED`**.
5. Square also sent the buyer its normal payment receipt.

At this point, money is confirmed but fulfillment is only considered done once delivery succeeds.

### 5. Fulfillment to customer

1. Worker loaded **`product:commit-copy-deck`** from KV.
2. Worker built the fulfillment email from the verified sender.
3. Worker sent the mail through Resend.
4. **Only after a successful email send** did the Worker write **`fulfilled:<payment_id>`**.
5. If Square retries the webhook later, the Worker sees the fulfillment marker and does not deliver the deck twice.

That is the complete pattern:

**public page → bridge checkout → Square payment → signed webhook → private payload lookup → email fulfillment → dedupe marker**

### 6. Why this scales to future paid creations

To launch the next paid asset, you do not need a new commerce system. You repeat the same pattern:

1. New public page or catalog slot
2. New SKU in `payment-links.json`
3. New private deliverable in KV
4. Same Worker
5. Same Square app
6. Same Resend sender
7. Same webhook + dedupe logic

**Checklist (bootstrap, new SKU, smoke):** `docs/STORE-OPEN-PLAYBOOK.md`
