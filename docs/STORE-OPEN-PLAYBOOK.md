# Store open playbook — static site, Square, Worker bridge, Resend, private deliverables

**Purpose:** Single source of truth for everything built to turn **`GitHub Pages + Square`** into a **real micro-store**: SKU-aware checkout, verified webhooks, **automatic email fulfillment** with **private file attachments**, without exposing API secrets in static HTML.

**Audience:** You (or an agent) repeating this on a new project, or extending this store.

---

## 1. Narrative — what we built and why

### 1.1 The business arc (team context)

Work is staged as:

1. **Overnight Diary** — fast experiments, drafts in Clawd (`~/clawd/overnight/`).
2. **Possible Pipeline** (internal name) — curated public offers on **`/pipeline/`**, outbound, measurement.
3. **Alive Management** — real customers, support, iteration from live usage.

This playbook is the **rails** that let Diary → Pipeline offers **accept money** and **deliver** professionally.

### 1.2 The core technical problem

**Square Payment Links (dashboard) are keyed by price tier**, not product identity. Many different products can share **`$35`**. If every “Buy” button hits the same static `square.link`, **you cannot tell from Square alone which product the buyer meant** — bad for fulfillment and accounting.

### 1.3 The fix (no dashboard link replacement required)

A **Cloudflare Worker** (“fulfillment bridge”) uses Square’s **Create Payment Link API** to mint a **fresh checkout** per click:

- **`payment_note`** is set to `devtools:sku=<slug>` (bounded length; appears on the **Payment** in Square and in **webhooks**).
- **`quick_pay`** sets human-readable line name and exact **amount in cents** from repo-root **`payment-links.json`** (same **`skus`** map the Pages site uses).

Static **dashboard links remain** as **fallback** when `checkout_bridge_base_url` is empty.

### 1.4 The static site integration

`payment-links.json` includes:

- `checkout_bridge_base_url` — Worker origin (no trailing slash).
- `skus` — each slug maps to a **tier** (`usd_15`, etc.) for **fallback** URLs.
- `tiers` — static Square URLs.

`js/checkout-resolve.js` runs in the browser, fetches `payment-links.json`, rewrites every `a[data-checkout-sku]` to:

`GET https://<worker>/pay?sku=<slug>&return_path=<encoded current path>`

### 1.5 Webhooks → trust → automate

Square posts a signed payload to **`POST /webhook`**. The Worker:

1. Verifies **`x-square-hmacsha256-signature`** using Square’s rule: **HMAC-SHA256 of `notificationUrl + rawBody`** (must match subscription URL **exactly**).
2. Parses **`payment`**, reads **`note`**, extracts **sku**.
3. On **`COMPLETED`**, sends fulfillment.

### 1.6 Email fulfillment (Resend)

**Resend** sends from your domain (e.g. **`fulfill@stratumsatoshi.com`**) after you:

1. **Buy/register a domain** (e.g. `stratumsatoshi.com`).
2. Add the domain in Resend, paste **DNS records** at the registrar, wait **Verified**.
3. Set **`RESEND_API_KEY`** (Worker secret) and **`FULFILL_FROM_EMAIL`** (verified sender).

**Receiving in Resend** stays **off** unless you want inbound parsing (support@, etc.).

### 1.7 Private “stash” deliverables (not in public repo)

Buyer-facing HTML is public; **paid file bodies** should not be. We store them in **Cloudflare Worker KV**:

- Key: **`product:<sku>`** — full markdown (or text) body.
- Worker attaches **`.md`** via Resend **attachments** (base64). Plain-text body stays short when an attachment exists (buyers open the file or the hub link).

**Operational rule:** When you add a SKU, **upload** the private file:

```bash
cd fulfillment-bridge
npx wrangler kv key put "product:<sku>" --binding=DELIVERABLES --path=$HOME/clawd/overnight/<your-file>.md
```

### 1.8 Idempotency

Same webhook can be delivered more than once. The Worker writes **`fulfilled:<payment_id>`** to KV **only after Resend succeeds**, so failed sends can retry and successful sends still dedupe.

---

## 2. Architecture diagram (mental model)

```
Buyer → GitHub Pages (data-checkout-sku)
     → checkout-resolve.js → Worker GET /pay?sku=…
     → Square CreatePaymentLink (note = devtools:sku=…)
     → Buyer pays → Square Payment COMPLETED
     → Square webhook POST /webhook
     → Verify signature → read sku + payment id
     → KV get product:<sku> → Resend email (attachment + short text)
     → (if send ok) KV put fulfilled:<payment_id>
```

---

## 3. Repository map (devtools)

| Path | Role |
|------|------|
| `payment-links.json` | `checkout_bridge_base_url`, `skus` (tier + `amount_cents` + `square_line_name`), `tiers`, donation — **Worker imports this file** |
| `js/checkout-resolve.js` | Rewrites checkout links client-side |
| `scripts/verify-skus.mjs` | Asserts each sku’s `amount_cents` matches its tier |
| `fulfillment-bridge/src/index.js` | `/pay`, `/webhook`, `/health`, Resend, KV |
| `fulfillment-bridge/wrangler.toml` | Vars + `DELIVERABLES` KV binding |
| `docs/SQUARE-FULFILLMENT.md` | Short architecture summary |
| `docs/STORE-OPEN-PLAYBOOK.md` | **This file** |
| `pipeline/index.html`, `automation/index.html`, etc. | `data-checkout-sku` on buy buttons |
| `AUTOMATION.md` | Project scope + fulfillment policy |

**Clawd (private, not public repo):**

| Path | Role |
|------|------|
| `~/clawd/overnight/*-deliverable*.md` | Source files **uploaded** to KV |
| `~/clawd/team-purpose.md` | Three-phase team framing |
| `~/clawd/.env` (if used locally) | Operator secrets — never commit |

---

## 4. Prerequisites checklist

- [ ] **GitHub repo** for static site + Pages enabled (`main` / root or `/docs`).
- [ ] **Cloudflare** account (Workers + KV).
- [ ] **Square** seller account + **Developer** application (production or sandbox).
- [ ] **Domain** you control (for Resend sending identity).
- [ ] **Resend** account + domain verified.
- [ ] **Private deliverable files** for each paid SKU you will attach.

---

## 5. Step-by-step — Square (developer + seller)

### 5.1 Create / open application

1. Square Developer Dashboard → **Applications** → your app.
2. **Production** access token (or Sandbox for tests).  
   **Never** commit the token to git; use **Wrangler secret** `SQUARE_ACCESS_TOKEN`.

### 5.2 Permissions / scopes

For Create Payment Link + payment reads, use a token with at least what Square documents for **Online Checkout / Payment Links** (typically **payments** + **orders** write/read as per your app’s OAuth scope UI — follow Square for your account type).

### 5.3 Location ID

1. Square Dashboard → **Locations** (or API).
2. Copy **Location ID** (starts with `L…`).
3. Set Worker var `SQUARE_LOCATION_ID`.

### 5.4 Hosted checkout redirect allowlist

Workers pass `checkout_options.redirect_url` when creating links. In Square Developer settings, **allow** your Pages origin + paths, e.g.:

- `https://<user>.github.io/<repo>/pipeline/`
- `https://<user>.github.io/<repo>/automation/`

Exact rules depend on Square’s current “Allowed redirect URLs” UI.

### 5.5 Webhook subscription

1. **URL:** `https://<your-worker-subdomain>.workers.dev/webhook`  
   **Must include `/webhook` path** — root URL alone will **not** match Worker route.
2. **Events (minimum):** `payment.updated`  
   **Optional:** `payment.created` (worker still requires `COMPLETED` status for fulfillment send).
3. Copy **signature key** → `wrangler secret put SQUARE_WEBHOOK_SIGNATURE_KEY`.
4. Set Worker var **`SQUARE_WEBHOOK_NOTIFICATION_URL`** to the **exact same URL** string Square shows (signature verification uses URL + body).

### 5.6 Static Payment Links (tiers)

Keep dashboard links in `payment-links.json` → `tiers[].url` for:

- fallback when bridge URL empty
- donation / manual use

---

## 6. Step-by-step — Cloudflare Worker

### 6.1 Install & deploy

```bash
cd fulfillment-bridge
npm install
npx wrangler deploy
```

First time, Wrangler may prompt for **`*.workers.dev` subdomain** — e.g. `devtools-square-bridge.stratumsatoshi.workers.dev`.

### 6.2 Secrets (encrypted)

```bash
npx wrangler secret put SQUARE_ACCESS_TOKEN
npx wrangler secret put SQUARE_WEBHOOK_SIGNATURE_KEY
npx wrangler secret put RESEND_API_KEY
```

### 6.3 KV namespace for deliverables + dedup

Create once:

```bash
npx wrangler kv namespace create DELIVERABLES
```

Put the returned `id` into `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "DELIVERABLES"
id = "<namespace_id>"
```

### 6.4 Non-secret vars (`wrangler.toml` `[vars]`)

Typical production set:

| Var | Example |
|-----|---------|
| `SQUARE_ENVIRONMENT` | `production` |
| `SQUARE_LOCATION_ID` | `L…` |
| `SQUARE_WEBHOOK_NOTIFICATION_URL` | `https://…workers.dev/webhook` |
| `PUBLIC_SITE_ORIGIN` | `https://gitsomeuser.github.io` |
| `PUBLIC_SITE_PATH_PREFIX` | `/devtools` |
| `SQUARE_API_VERSION` | `2024-10-17` (update when Square requires) |
| `FULFILL_FROM_EMAIL` | `fulfill@yourdomain.com` |
| `FULFILL_TO_OVERRIDE_EMAIL` | `""` or your inbox for **testing only** |

### 6.5 Health check

```bash
curl https://<worker>/health
# expect: ok
```

### 6.6 Negative tests

```bash
# HEAD not implemented for /pay — use GET
curl -i 'https://<worker>/pay?sku=bad-sku'
# expect 400

curl -i -X POST https://<worker>/webhook -d '{"x":1}'
# expect 403 invalid signature
```

---

## 7. Step-by-step — Domain + Resend

### 7.1 Buy a domain

Any registrar; point **DNS** where Resend tells you.

### 7.2 Resend → Domains

1. Add **apex** domain (`example.com`).
2. Add TXT/CNAME records for **verification**, **DKIM**, **return-path** (per Resend UI).
3. Wait until status **Verified**.

### 7.3 Choose sender

Use an address on that domain: `fulfill@example.com` → `FULFILL_FROM_EMAIL`.

### 7.4 API key

Create **API key** with send permission → `RESEND_API_KEY` secret on Worker.

**Do not** leak keys in chat, screenshots, or public repos. Rotate if exposed.

---

## 8. Step-by-step — GitHub Pages site wiring

### 8.1 `payment-links.json`

Set:

```json
"checkout_bridge_base_url": "https://<worker-subdomain>.workers.dev"
```

Commit + push; Pages serves updated JSON.

### 8.2 Buttons

On every paid CTA:

```html
<a href="https://square.link/u/FALLBACK"
   data-checkout-sku="reply-rescue-pack">Pay $35</a>
```

Fallback `href` matters when JS fails or bridge URL blank.

### 8.3 Load resolver

Before `</body>` on pages with checkout:

```html
<script src="/<repo>/js/checkout-resolve.js" defer></script>
```

(Path depends on whether site is project Pages or user Pages.)

---

## 9. Step-by-step — Private deliverables into KV

For each SKU with a real file:

```bash
cd fulfillment-bridge
npx wrangler kv key put "product:commit-copy-deck" --binding=DELIVERABLES \
  --path=$HOME/clawd/overnight/commit-copy-deck-deliverable.md
```

Rules:

- Key **must** be `product:<sku>` where `<sku>` equals:
  - `payment-links.json` → `skus` keys
  - HTML `data-checkout-sku`
- After updating a file, **re-run** `kv key put` (no redeploy needed unless Worker code changed).

---

## 10. Adding a new product (repeatable checklist)

1. **Business:** name, price, promise, fulfillment SLO (still “immediate” unless you change policy).
2. **`payment-links.json` → `skus`:** add `{ tier, amount_cents, square_line_name }` (run `node scripts/verify-skus.mjs`).
3. **HTML:** add card/button with `data-checkout-sku="<slug>"` and tier fallback `href`.
4. **KV:** `wrangler kv key put "product:<slug>" --binding=DELIVERABLES --path=…`
5. **`docs/TEAM-LIFECYCLE` / hub:** optional copy updates.
6. **Deploy:** push site; **`npx wrangler deploy`** so the Worker bundles the updated `payment-links.json`.
7. **Test:** pay smallest SKU, verify Square **note**, Resend **attachment**, dedup on replay, **replay webhook after a forced Resend failure** still delivers once a send succeeds.

---

## 11. Testing matrix (sign-off)

| Test | Pass criteria |
|------|----------------|
| `/health` | `200 ok` |
| `/pay` unknown SKU | `400` |
| `/pay` valid SKU (GET) | `302` to `square.link/...` |
| Webhook fake body | `403` |
| Square test event | `200` (payload may be sample, not your SKU) |
| Real payment | `COMPLETED`, note `devtools:sku=…` |
| Resend | buyer receives email from branded address |
| Attachment | `.md` present if `product:<sku>` in KV |
| Dedup | replay webhook does not resend |

---

## 12. Security & ops hygiene

- **Rotate** Square token + Resend key if pasted anywhere public.
- **Never** put `SQUARE_APPLICATION_SECRET` in the Worker unless you truly need OAuth (you don’t for this flow).
- **Webhook URL + signature key** must stay in lockstep with Square dashboard.
- **KV** holds paid content — restrict Cloudflare dashboard access.
- **Keep Clawd deliverables out of public git**; KV is the distribution layer to buyers.

---

## 13. One-prompt redo (paste as a single instruction)

Use this verbatim to reproduce the stack on a fresh machine/repo (adjust names):

> Build a static micro-store on GitHub Pages with: (1) `payment-links.json` listing tiers + `skus` (each with `amount_cents`, `square_line_name`, `tier`) + `checkout_bridge_base_url`; (2) `js/checkout-resolve.js` rewriting `data-checkout-sku` links to a Cloudflare Worker; (3) Worker routes `GET /pay` calling Square `CreatePaymentLink` with `quick_pay` from that same `payment-links.json` and `payment_note=devtools:sku=<slug>`; (4) `POST /webhook` verifying `x-square-hmacsha256-signature`, on `COMPLETED` loading `product:<sku>` from KV, sending via Resend with attachment when present, and writing `fulfilled:<payment_id>` only after a successful send; (5) Resend verified + secrets; (6) `scripts/verify-skus.mjs` + playbook for onboarding. Follow `docs/STORE-OPEN-PLAYBOOK.md`.

---

## 14. Known limitations / future upgrades

- **HEAD /pay** not implemented — monitoring tools using HEAD may see `404`; use GET.
- **Non-KV SKUs** get link-only emails until you upload `product:<sku>`.
- **Large files:** Resend attachment limits apply — huge assets may need **R2 signed URLs** instead of inline attachment.
- **OAuth “Production Redirect URL”** in Square is for **multi-merchant OAuth**, not required for this single-merchant token flow.

---

## 15. What “officially open” means operationally

The store is **open** when all are true:

1. Pages live with bridge URL set.
2. Worker deployed with secrets + vars + KV binding.
3. At least one **real** payment shows correct **SKU note**.
4. Resend **Verified** + test buyer receives **attachment** (for SKUs with KV body).
5. Webhook logs show **200** and Worker logs show send success.

---

*Last updated: 2026-03-27 — reflects Square + Cloudflare Workers + Resend + KV fulfillment path used in production for this project.*
