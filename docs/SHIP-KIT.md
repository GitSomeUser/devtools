# Ship Kit — same-day Square on GitHub Pages

**Offer:** USD $15 · **Repo:** [GitSomeUser/devtools](https://github.com/GitSomeUser/devtools)

## Checklist

1. Repo + **Pages** (`main`, root).
2. Live URL 200s (project Pages use `/<repo>/`).
3. Tier URLs in **`payment-links.json`** match every fallback `href`.
4. One **primary** CTA above fold; full ladder in `<details>` or secondary section.
5. Honest delivery line: email when Square confirms; receipt from Square.
6. **`sitemap.xml`** includes funnel paths; hub links them.
7. Optional thanks: `?thanks=1` + strip (see `/automation/`).
8. Ship: verify links; test lowest-price SKU.

**SKU-aware checkout:** set `checkout_bridge_base_url` + `data-checkout-sku` — `docs/SQUARE-FULFILLMENT.md`.

**Automate new products:** `docs/PAID-PRODUCT-LAUNCH-AUTOMATION.md`.

## Hero pattern

One `<a>` to Square (or `data-checkout-sku` + tier fallback), one fine-print line on receipt + fulfillment.

---

*Update when Square URLs or tiers change.*
