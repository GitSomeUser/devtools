# Devtools — income automation (project scope)

**Scope:** This file applies **only** to the **`GitSomeUser/devtools`** static site (GitHub Pages). It is **not** global Clawd policy. Overnight runners in `~/clawd/overnight/` may reference this repo when work ships here.

## Principle

Agents ship HTML, links, and copy **in this repo**; **Square** (your account) collects payment via **Payment Links**. Master supplies the **public checkout URL** only — never API secrets in the repo or in chat.

### Overnight loop alignment (`~/clawd/overnight/`)

The **Overnight Diary** is intentionally **idea → dollars**, not idea → list. With **`hour_runner.py --slot-sec 3600`**, each **hour** ends with **deploy · sell · distribute** closeout (`hour-close-i*.md`) and the **next hour starts a brand-new idea**. See **`~/clawd/overnight/OVERNIGHT_PURPOSE.md`**.

## Payment ladder (canonical)

| Tier | Amount | `.env` key |
|------|--------|------------|
| 1 | $1 | `SQUARE_PAY_USD_1` |
| 2 | $5 | `SQUARE_PAY_USD_5` |
| 3 | $15 | `SQUARE_PAY_USD_15` |
| 4 | $35 | `SQUARE_PAY_USD_35` |
| 5 | $79 | `SQUARE_PAY_USD_79` |
| 6 | $199 | `SQUARE_PAY_USD_199` |
| donation | variable (buyer chooses in Square) | `SQUARE_PAY_DONATION` |

**Committed references (public URLs):** `payment-links.json`, `automation/index.html`, `commits/index.html` (Commit Copy Deck — `usd_1`).

**Secrets & local parity:** `cp .env.example .env` — fill **payment URLs** in `.env` for scripts; add **API keys / BTC receive (never private keys)** only here. `.env` is **gitignored**.

When a Square link **changes**, update **`.env`**, **`payment-links.json`**, and **`automation/index.html`** together.

**Do not** commit Square **Application Secret**, **Access Token**, or **Refresh Token**.

## Fulfillment — $15 Ship Kit

- **Product:** `docs/SHIP-KIT.md` (12-step checklist + paste-ready HTML).
- **Overview page:** `/ship-kit/` for buyers who want a short summary before Square.
- **SLO:** Email the buyer (address from Square) within **24h** with link to the repo path or raw GitHub URL.
- **Optional after pay:** Square success URL → `https://gitsomeuser.github.io/devtools/automation/?thanks=1` (thanks strip on-page).

## Continuity (Clawd)

- **`~/clawd/overnight/diary.md`** — iteration proof.
- **`~/clawd/STATE.md`** — current objective (may mention this repo).

## What “done” means per iteration (devtools)

1. **Shipped** on `main` with a live Pages URL, **or**
2. **Money rail:** Square tier **`href`s** live on `/automation/` + `payment-links.json`, **or**
3. **Measurement:** analytics/snippet slot filled with a real ID.

Wall-clock minimum for automated multi-agent loops stays in `~/clawd/overnight/hour_runner.py` (not global editor rules).

## Money-flow (this project)

1. Traffic → `https://gitsomeuser.github.io/devtools/` and `/automation/`.
2. Conversion → **Square Payment Links** (tier buttons on `/automation/`).
3. Fulfillment — document in repo (file download, email via Square, or manual) as you define the SKU.

### SKU: `usd_15` (Ship Kit) — fulfillment SLO

- **What:** Markdown **Ship Kit** — 12-step same-day list, paste-ready HTML blocks, tier picker. Source of truth for file content: **`~/clawd/overnight/paid-kit-usd15-v1.md`** (not shipped in public repo so the offer stays a real deliverable).
- **How:** Buyer pays on Square → Master (or agent) emails the kit within **24 hours** using the one-line template in that file.
- **On-page promise:** `/automation/` states the 24h email SLO; keep copy aligned with actual behavior.

### SKU: `usd_1` (Commit Copy Deck) — fulfillment SLO

- **What:** Markdown **Commit Copy Deck** — conventional commit lines, PR title formulas, one-line diff explainers, worksheet. Source of truth: **`~/clawd/overnight/commit-copy-deck-deliverable.md`** (private to Clawd; not the full paid body in the public repo).
- **Landing + SEO:** `/commits/` on Pages — primary CTA → Square `usd_1` URL from `payment-links.json`.
- **How:** Buyer pays on Square → email the deliverable file within **24 hours** to the address Square collects (same muscle as Ship Kit).
- **Optional success URL:** `https://gitsomeuser.github.io/devtools/commits/?thanks=1` for on-page thanks strip.
