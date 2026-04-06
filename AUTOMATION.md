# Devtools — income automation

**Scope:** `GitSomeUser/devtools` on GitHub Pages. Overnight / Clawd may reference this repo; charter: `~/clawd/OVERNIGHT_PURPOSE.md`.

## Rails

| Piece | Role |
|-------|------|
| `payment-links.json` | Tiers, SKU map (`amount_cents`, `square_line_name`, `tier`), `checkout_bridge_base_url` |
| `js/checkout-resolve.js` | Worker `/pay` when bridge set; else static tier URL |
| `fulfillment-bridge/` | `GET /pay`, `POST /webhook`, `GET /health` |

**How it works:** `docs/SQUARE-FULFILLMENT.md` · **Repeatable ops:** `docs/STORE-OPEN-PLAYBOOK.md` · **Agent SOP (new product → prod):** `docs/PAID-PRODUCT-LAUNCH-AUTOMATION.md`

If `checkout_bridge_base_url` is empty, tier links still work but **shared-price products are ambiguous** in Square—run the bridge in production.

## Fulfillment

Email as soon as Square **COMPLETED**. SKU from payment note + webhook. Attachments from KV `product:<sku>`; source files stay private (e.g. `~/clawd/paid-deliverables/`).

## Lifecycle copy

Public library: **`/pipeline/`**. Internal phase name **Possible Pipeline** — **`docs/TEAM-LIFECYCLE.md`**.

## Notable SKUs

- **Ship Kit** — `/ship-kit/`, slug `ship-kit` · `docs/SHIP-KIT.md`
- **Commit Copy Deck** — `/commits/`, slug `commit-copy-deck`

`.env.example` / `.env` for local scripts only; Worker secrets via `wrangler secret put`.
