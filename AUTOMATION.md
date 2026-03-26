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

**Committed references (public URLs):** `payment-links.json`, `automation/index.html`.

**Secrets & local parity:** `cp .env.example .env` — fill **payment URLs** in `.env` for scripts; add **API keys / BTC receive (never private keys)** only here. `.env` is **gitignored**.

When a Square link **changes**, update **`.env`**, **`payment-links.json`**, and **`automation/index.html`** together.

**Do not** commit Square **Application Secret**, **Access Token**, or **Refresh Token**.

## Optional: after payment

If Square offers **redirect after payment**, you can point buyers at:

`https://gitsomeuser.github.io/devtools/automation/?thanks=1`

(Add a small “thanks” banner later if you want.)

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
