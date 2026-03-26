# Devtools — income automation (project scope)

**Scope:** This file applies **only** to the **`GitSomeUser/devtools`** static site (GitHub Pages). It is **not** global Clawd policy. Overnight runners in `~/clawd/overnight/` may reference this repo when work ships here.

## Principle

Agents ship HTML, links, and copy **in this repo**; **Square** (your account) collects payment via **Payment Links**. Master supplies the **public checkout URL** only — never API secrets in the repo or in chat.

## Square Payment Link — what Master does

1. Log into **Square Dashboard** (the account that receives deposits).
2. Go to **Online Checkout** or **Payment links** (wording varies by Square UI generation).
3. **Create** a payment link: name, description, price, tax if needed.
4. Publish/copy the **customer-facing link** (starts with `https://` — often `checkout.square.site` or similar).
5. **Paste that URL** in one of two ways:
   - **Preferred:** Paste it in chat or drop it here so it can be wired into `automation/index.html` (`#pay` `href`), **or**
   - Edit `automation/index.html` yourself: set `<a id="pay" href="YOUR_LINK_HERE">`.

**Do not** paste Square **Application Secret**, **Access Token**, **Refresh Token**, or location secrets. The **payment link URL** is public by design (same as sharing the link with a buyer).

## Optional: after payment

If Square offers **redirect after payment**, you can point buyers at:

`https://gitsomeuser.github.io/devtools/automation/?thanks=1`

(Add a small “thanks” banner later if you want.)

## Continuity (Clawd)

- **`~/clawd/overnight/diary.md`** — iteration proof.
- **`~/clawd/STATE.md`** — current objective (may mention this repo).

## What “done” means per iteration (devtools)

1. **Shipped** on `main` with a live Pages URL, **or**
2. **Money rail:** real **`href`** on `#pay` (Square link), **or**
3. **Measurement:** analytics/snippet slot filled with a real ID.

Wall-clock minimum for automated multi-agent loops stays in `~/clawd/overnight/hour_runner.py` (not global editor rules).

## Money-flow (this project)

1. Traffic → `https://gitsomeuser.github.io/devtools/` and `/automation/`.
2. Conversion → **Square Payment Link** (`#pay`).
3. Fulfillment — document in repo (file download, email via Square, or manual) as you define the SKU.
