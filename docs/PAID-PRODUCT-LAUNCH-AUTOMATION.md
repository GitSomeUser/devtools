# Paid product launch — AI agent SOP (product → production)

**Purpose:** One document an AI agent (or human) can follow to take a **new paid digital product** from definition to **one-click checkout** and **email fulfillment** after Square confirms payment.

**Stack (fixed):** GitHub Pages (static site) · Cloudflare Worker (`fulfillment-bridge/`) · Square Payment Links API + webhooks · Resend · Worker KV for private deliverable bodies.

**Do not:** Commit Square tokens, webhook signature keys, or Resend API keys. Never disable webhook signature verification.

---

## 0. Agent preflight (read once per session)

| Resource | Role |
|----------|------|
| This file | Ordered launch procedure |
| `docs/SQUARE-FULFILLMENT.md` | Architecture, hardening checklist, narrative example (`commit-copy-deck`) |
| `docs/STORE-OPEN-PLAYBOOK.md` | Lean bootstrap, smoke table, reuse checklist |
| `fulfillment-bridge/README.md` | Worker deploy, vars, secrets, KV commands |
| `payment-links.json` (repo root) | `checkout_bridge_base_url`, `skus`, `tiers`, `payment_note_prefix` |
| `js/checkout-resolve.js` | Rewrites `a[data-checkout-sku]` → Worker `GET /pay` when bridge URL is set |
| `scripts/verify-skus.mjs` | **Required gate** before commit: tier cents, every SKU in HTML, no orphan attributes |

**External references (verify current behavior if APIs drift):**

- [Square webhooks overview](https://developer.squareup.com/docs/webhooks/overview)
- [Square webhook troubleshooting](https://developer.squareup.com/docs/webhooks/troubleshooting)
- [Square idempotency](https://developer.squareup.com/docs/build-basics/common-api-patterns/idempotency)
- [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys)

---

## 1. Definitions (use consistent naming)

| Term | Meaning |
|------|---------|
| **Slug** | Lowercase identifier, stable forever, e.g. `my-new-pack`. Used in `payment-links.json`, `data-checkout-sku`, and KV key `product:<slug>`. |
| **Tier** | One of `payment-links.json` → `tiers[].id` (e.g. `usd_15`, `usd_35`). Price on the page must match tier `amount` × 100 = `amount_cents`. |
| **Public shop** | HTML on GitHub Pages: copy, preview, CTA. No paid body in repo. |
| **Private shop** | KV `product:<slug>` (markdown body emailed to buyer) + Worker secrets + Square/Resend config. |
| **Bridge** | Worker mints per-click Square checkout, stamps `payment_note` = `payment_note_prefix` + slug, handles webhook → Resend → `fulfilled:<payment_id>`. |

---

## 2. One-time prerequisites (skip if already live)

If the rail is **already** taking real payments and sending email, only run **section 3+** per new product.

1. **Square application** — production access token, location ID, hosted-checkout redirect allowlist for your Pages origin (paths under `PUBLIC_SITE_ORIGIN` + `PUBLIC_SITE_PATH_PREFIX`).
2. **Square webhook** — subscribe `payment.updated` (optional: `payment.created`) to `https://<your-worker-host>/webhook` — URL must match **`SQUARE_WEBHOOK_NOTIFICATION_URL`** in `fulfillment-bridge/wrangler.toml` exactly.
3. **Cloudflare Worker** — deploy from `fulfillment-bridge/`, KV namespace bound as `DELIVERABLES` (see `wrangler.toml`).
4. **Secrets** (Worker, never in git):

   ```bash
   cd fulfillment-bridge
   npx wrangler secret put SQUARE_ACCESS_TOKEN
   npx wrangler secret put SQUARE_WEBHOOK_SIGNATURE_KEY
   npx wrangler secret put RESEND_API_KEY
   ```

5. **Resend** — domain/sender verified; `FULFILL_FROM_EMAIL` in `wrangler.toml` `[vars]` matches that sender. Optional: `FULFILL_TO_OVERRIDE_EMAIL` for internal testing only (remove or empty for real customers).
6. **`payment-links.json`** — `checkout_bridge_base_url` set to Worker origin (no trailing slash path to `/pay`; the script appends `/pay?...`).

---

## 3. New product — ordered procedure (agent checklist)

Execute **in order**. Do not skip verification or deploy.

### Step A — Choose slug, tier, and line name

- Pick **slug**: `^[a-z0-9-]+$`, unique in `skus`.
- Pick **tier** from existing `tiers` **or** add a new tier (new Square Payment Link URL in dashboard + new `tiers[]` entry) first.
- Set **`square_line_name`**: human-readable line on Square receipt/checkout.

### Step B — Add SKU to `payment-links.json`

At repo root, under `skus`:

```json
"your-slug-here": {
  "tier": "usd_15",
  "amount_cents": 1500,
  "square_line_name": "Your Product Title"
}
```

Rules:

- `amount_cents` must equal `Math.round(tier.amount * 100)` for that tier id (enforced by `verify-skus.mjs`).

### Step C — Public page(s)

1. **Minimum:** Add a CTA on an existing page (e.g. `pipeline/index.html`) **or** create a new folder + `index.html` (e.g. `my-pack/index.html`).
2. **Required markup** on the paid button:

   ```html
   <a class="cta" data-checkout-sku="your-slug-here" href="https://square.link/u/XXXX">Pay $15 on Square</a>
   ```

   - `href` must be the **same tier’s** fallback URL from `payment-links.json` → `tiers[].url` for that tier (used when `checkout_bridge_base_url` is empty).
3. **Load the resolver** before `</body>`:

   ```html
   <script src="../js/checkout-resolve.js" defer></script>
   ```

   Adjust path depth (`../` vs `../../`) so `payment-links.json` resolves same-origin (see `checkout-resolve.js` — it fetches `payment-links.json` relative to site base path).
4. **Copy:** State that fulfillment is **by email after Square confirms payment**; Square sends the receipt separately.

### Step D — Private deliverable (KV)

Put the **paid content** (markdown is fine) in KV. **Do not** commit the full paid body to the public repo if it is the product.

From `fulfillment-bridge/`:

```bash
cd fulfillment-bridge
npx wrangler kv key put "product:your-slug-here" --binding=DELIVERABLES --path=/absolute/path/to/body.md
```

- Key format: `product:<slug>` exactly.
- If KV is missing, the Worker may still send a link-only or degraded fulfillment (see `SQUARE-FULFILLMENT.md` operations); for production, always upload before launch.

### Step E — Verify catalog (gate)

From **repo root**:

```bash
node scripts/verify-skus.mjs
```

Must print `ok`. Fix any `amount_cents` / tier / missing HTML reference errors before proceeding.

### Step F — Deploy Worker (required after JSON change)

Worker **bundles** `payment-links.json` at deploy time.

```bash
cd fulfillment-bridge
npm install
npx wrangler deploy
```

### Step G — Publish site

Commit and push HTML + `payment-links.json` to the branch that GitHub Pages serves (typically `main`).

### Step H — Smoke (before announcing)

| Check | How |
|-------|-----|
| Health | `GET https://<worker>/health` → `ok` |
| Bad SKU | `GET https://<worker>/pay?sku=nonexistent` → expect error (e.g. 400) |
| Webhook auth | `POST https://<worker>/webhook` without signature → `403` |
| Real test | Lowest-price SKU, real or sandbox per your Square mode; confirm one email, no duplicate on webhook replay |
| Dedupe | After success, Worker should record `fulfilled:<payment_id>` so retries do not re-send |

### Step I — Optional hardening (post-launch)

- Resend: `Idempotency-Key` on send = stable per payment id (see [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys)).
- Subscribe to Resend webhooks for bounces/complaints if you want ops-grade visibility.
- `sitemap.xml` + hub links if the product has its own path (see `docs/SHIP-KIT.md`).

---

## 4. End-to-end flow (what the customer experiences)

1. Customer opens public page → clicks CTA with `data-checkout-sku`.
2. `checkout-resolve.js` fetches `payment-links.json`; if `checkout_bridge_base_url` is set, navigates to  
   `GET <bridge>/pay?sku=<slug>&return_path=<encoded current path>`.
3. Worker calls Square **Create Payment Link** with correct **cents**, **line name**, and **`payment_note`** = `devtools:sku=<slug>` (prefix from `payment_note_prefix`).
4. Customer pays on Square-hosted checkout; Square emails receipt.
5. Square sends **`payment.updated`** to Worker `/webhook`.
6. Worker verifies **HMAC signature**, ensures payment **COMPLETED**, parses slug from note, loads **`product:<slug>`** from KV, sends email via **Resend**.
7. Worker writes **`fulfilled:<payment_id>`** only after **successful** send — that is the internal “fulfillment committed” signal.

---

## 5. Reference example (copy this mental model)

SKU **`commit-copy-deck`**: public CTAs on `pipeline/index.html` and `commits/index.html`, `$1` tier, KV `product:commit-copy-deck`. Full narrative: `docs/SQUARE-FULFILLMENT.md` § “Real example”.

---

## 6. Troubleshooting (where to look)

| Symptom | Likely cause |
|---------|----------------|
| Click goes to generic tier link, wrong product | `checkout_bridge_base_url` empty or `verify-skus` / deploy skipped |
| Payment succeeds, no email | Resend secret/sender, KV key typo, webhook URL mismatch, or fulfillment error in Worker logs |
| Webhook 403 | Signature key wrong or body altered before verify |
| Duplicate emails | Dedupe marker not written; fix Worker logic — should not happen if `fulfilled:<payment_id>` is honored |
| `verify-skus` fails | `amount_cents` ≠ tier, or SKU not on any `.html`, or `data-checkout-sku` references unknown slug |

Deep dive: `docs/SQUARE-FULFILLMENT.md` (hardening + operations), Square [troubleshooting](https://developer.squareup.com/docs/webhooks/troubleshooting).

---

## 7. Agent completion criteria

A launch is **done** when:

1. `node scripts/verify-skus.mjs` passes.
2. Worker deployed after `payment-links.json` change.
3. `product:<slug>` exists in KV for paid digital body.
4. Public page has `data-checkout-sku` + script + honest fulfillment line.
5. At least one successful test purchase → exactly one fulfillment email → `fulfilled:<payment_id>` behavior confirmed if logs/KV inspected.

---

*Maintainers: when tiers or worker hostname change, update `payment-links.json` and `fulfillment-bridge/wrangler.toml` together, then redeploy and re-run smoke.*
