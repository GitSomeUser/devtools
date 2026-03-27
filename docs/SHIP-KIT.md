# Ship Kit — Square checkout on GitHub Pages (same day)

**Version:** 1.0 · **Matching offer:** USD $15 (`vrnZ4R19`) · **Repo:** [GitSomeUser/devtools](https://github.com/GitSomeUser/devtools)

Use this in order. Check each box before moving on.

---

## 12-step checklist

1. **Repo** — Empty `devtools`-style repo on GitHub; `main` only is fine.
2. **Pages** — Settings → Pages → branch `main`, folder `/ (root)`.
3. **Static proof** — `index.html` loads at `https://<user>.github.io/<repo>/` (200, not 404 on bare `username.github.io` without project path).
4. **Square** — Dashboard → Payment Links → fixed-price links per tier; copy each **customer-facing** `square.link` (or equivalent).
5. **Single source of truth** — `payment-links.json` at repo root: every `url` must match a button `href` (when you add the ladder).
6. **Hero discipline** — One **primary** CTA above the fold; bury the full ladder in `<details>` or a secondary section.
7. **Checkout** — Hero CTA points at **one** Square URL (here: $15 kit link or your SKU).
8. **Return trip** — Optional Square success URL → `https://…/automation/?thanks=1` (or your path); add the small strip + `hidden` + JS `URLSearchParams` unhide.
9. **Honesty copy** — State delivery (e.g. “email as soon as Square confirms payment”) and that the **receipt is from Square** — no fake scarcity.
10. **JSON-LD** — `WebPage` + `Product`/`Offer` for the **primary** SKU; `ItemList` optional for the rest (keep prices in sync with Square).
11. **Discoverability** — `sitemap.xml` lists `/`, `/automation/`, any new paths; hub links to the funnel.
12. **Verify** — `curl -sI` the live URLs; click your own link to Square **sandbox or $1 test** if available; fix mobile layout.

---

## Paste-ready: hero block (swap `HREF` + title)

```html
<section class="hero">
  <h2>Ship Square checkout on static Pages this afternoon</h2>
  <p class="lead">Static HTML, Square-hosted checkout, no backend.</p>
  <a class="cta cta-primary" href="REPLACE_WITH_SQUARE_PAYMENT_LINK">Pay — $15 Ship Kit</a>
  <p class="fine-print">Receipt from Square. Fulfillment: email as soon as payment confirms.</p>
</section>
```

---

## Paste-ready: thanks strip (above `<header>` or below `<body>`)

```html
<div id="thanks-banner" class="thanks-banner" hidden>Thanks — your receipt is from Square.</div>
```

```html
<script>
(function () {
  try {
    if (new URLSearchParams(location.search).get('thanks') === '1') {
      var el = document.getElementById('thanks-banner');
      if (el) el.removeAttribute('hidden');
    }
  } catch (e) {}
})();
</script>
```

---

## Distribution (when you’re ready)

- One **Show HN** or community post with **disclosure**; link the live `/automation/` (or your funnel path).
- Keep a **`distribution-draft-*.md`** in-repo so you’re not rewriting copy from memory.

---

## When you’re stuck

| Symptom | Fix |
|--------|-----|
| Pages 404 on root URL | Use `/<repo>/` path for **project** Pages, not bare `user.github.io`. |
| Branch picker empty | Push `main` first; refresh Settings. |
| JSON-LD ≠ buttons | Diff `payment-links.json` against every `href` in HTML. |
| “No sales” | Traffic + one clear hero CTA beat six equal buttons. |

---

*— End of Ship Kit. Re-publish when tiers or Square links change.*
