# Devtools — income automation (project scope)

**Scope:** This file applies **only** to the **`GitSomeUser/devtools`** static site (GitHub Pages). It is **not** global Clawd policy. Overnight runners in `~/clawd/overnight/` may reference this repo when work ships here.

## Principle

Agents ship HTML, links, and copy **in this repo**; **Square** (your account) collects payment. **Public** pages never embed API secrets. Use **`docs/SQUARE-FULFILLMENT.md`** for the SKU bridge + webhook flow.

### Overnight loop alignment (`~/clawd/overnight/`)

The **Overnight Diary** is intentionally **idea → dollars**, not idea → list. With **`hour_runner.py --slot-sec 3600`**, each **hour** ends with **deploy · sell · distribute** closeout (`hour-close-i*.md`) and the **next hour starts a brand-new idea**. See **`~/clawd/overnight/OVERNIGHT_PURPOSE.md`**.

**Lifecycle:** Curated offers live at **`/pipeline/`** (Pages: `…/devtools/pipeline/`). **Possible Pipeline** is the **internal** phase name for polish + outreach; public pages use normal product titles. Canonical doc: **`docs/TEAM-LIFECYCLE.md`**. Clawd pointer: **`~/clawd/team-purpose.md`**.

## SKU-aware checkout (production)

| Piece | Role |
|--------|------|
| **`payment-links.json`** | `checkout_bridge_base_url`, `skus` map (`slug` → `tier`), `tiers` (fallback Square URLs). |
| **`js/checkout-resolve.js`** | Rewrites `data-checkout-sku` anchors to the Worker when `checkout_bridge_base_url` is set. |
| **`fulfillment-bridge/`** | Cloudflare Worker: **`GET /pay`**, **`POST /webhook`**, **`GET /health`**. |

When the bridge URL is **empty**, buyers still use static tier links; **you cannot tell which product** they bought from the link alone — enable the bridge for production fulfillment.

## Payment ladder (canonical tiers)

**Fallback:** one Square Payment Link per **tier** in `payment-links.json` when the bridge is off.

| Tier | Amount | `.env` key |
|------|--------|------------|
| 1 | $1 | `SQUARE_PAY_USD_1` |
| 2 | $15 | `SQUARE_PAY_USD_15` |
| 3 | $35 | `SQUARE_PAY_USD_35` |
| 4 | $79 | `SQUARE_PAY_USD_79` |
| 5 | $199 | `SQUARE_PAY_USD_199` |
| donation | variable (buyer chooses in Square) | `SQUARE_PAY_DONATION` |

**Committed references (public URLs):** `payment-links.json`, `automation/index.html`, `commits/index.html` (Commit Copy Deck — `usd_1`).

**Secrets & local parity:** `cp .env.example .env` — fill **payment URLs** in `.env` for scripts; add **API keys** only here. `.env` is **gitignored**. **Checkout API** tokens for the Worker are **never** committed; use `wrangler secret put` (see **`fulfillment-bridge/README.md`**).

When a Square link **changes**, update **`.env`**, **`payment-links.json`**, and product **`href`s** together.

**Do not** commit Square **Application Secret**, **Access Token**, or **Refresh Token** into the public repo.

## Fulfillment (default SLO)

**As soon as Square confirms payment**, email the buyer (address from Square) the deliverable or link—**immediate**, unless a SKU doc states otherwise and operations match it.

Use **webhook logs** or the payment **note** (`devtools:sku=…`) to pick the right deliverable.

## Fulfillment — $15 Ship Kit

- **Product:** `docs/SHIP-KIT.md` (12-step checklist + paste-ready HTML).
- **Overview page:** `/ship-kit/` for buyers who want a short summary before Square.
- **SKU slug:** `ship-kit` (`data-checkout-sku` on the Ship Kit CTA).
- **SLO:** Email the buyer **immediately after payment confirmation** with link to the repo path or raw GitHub URL.
- **Optional after pay:** Square success URL → `https://gitsomeuser.github.io/devtools/automation/?thanks=1` (thanks strip on-page).

## Continuity (Clawd)

- **`~/clawd/overnight/diary.md`** — iteration proof.
- **`~/clawd/STATE.md`** — current objective (may mention this repo).

## What “done” means per iteration (devtools)

1. **Shipped** on `main` with a live Pages URL, **or**
2. **Money rail:** Square **`href`s** live on `/automation/` + `payment-links.json`, **or**
3. **SKU bridge** deployed + `checkout_bridge_base_url` set, **or**
4. **Measurement:** analytics/snippet slot filled with a real ID.

Wall-clock minimum for automated multi-agent loops stays in `~/clawd/overnight/hour_runner.py` (not global editor rules).

## Money-flow (this project)

1. Traffic → `https://gitsomeuser.github.io/devtools/` and `/automation/`.
2. Conversion → **Bridge** (preferred) or **static Payment Links** by tier.
3. Fulfillment — read **SKU** from webhook / payment note; email **immediately** after payment confirms.

### SKU: `usd_15` (Ship Kit) — fulfillment SLO

- **What:** Markdown **Ship Kit** — 12-step same-day list, paste-ready HTML blocks, tier picker. Source of truth for file content: **`~/clawd/overnight/paid-kit-usd15-v1.md`** (not shipped in public repo so the offer stays a real deliverable).
- **How:** Buyer pays on Square → Master (or agent) emails the kit **immediately after payment confirmation** using the one-line template in that file.
- **On-page promise:** `/automation/` and `/ship-kit/` state the immediate SLO; keep copy aligned with actual behavior.

### SKU: `usd_1` (Commit Copy Deck) — fulfillment SLO

- **What:** Markdown **Commit Copy Deck** — conventional commit lines, PR title formulas, one-line diff explainers, worksheet. Source of truth: **`~/clawd/overnight/commit-copy-deck-deliverable.md`** (private to Clawd; not the full paid body in the public repo).
- **Landing + SEO:** `/commits/` on Pages — primary CTA uses slug **`commit-copy-deck`** (bridge) or Square `usd_1` URL as fallback.
- **How:** Buyer pays on Square → email the deliverable **immediately after payment confirmation** to the address Square collects.
- **Optional success URL:** `https://gitsomeuser.github.io/devtools/commits/?thanks=1` for on-page thanks strip.
