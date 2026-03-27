/**
 * Rewrites checkout anchors to the SKU-aware Worker when checkout_bridge_base_url is set in payment-links.json.
 * Fallback: static Square tier URL from the same JSON.
 */
(function () {
  function siteBasePath() {
    var parts = location.pathname.split('/').filter(Boolean);
    var leaf = parts[parts.length - 1];
    var subs = {
      pipeline: 1,
      automation: 1,
      commits: 1,
      'ship-kit': 1,
      'yaml-json': 1,
      'unix-timestamp': 1,
      cron: 1,
      multilang: 1,
    };
    if (parts.length >= 2 && subs[leaf]) {
      return '/' + parts.slice(0, -1).join('/') + '/';
    }
    if (parts.length >= 1) return '/' + parts.join('/') + '/';
    return '/';
  }

  function resolveConfigUrl() {
    return new URL('payment-links.json', location.origin + siteBasePath()).href;
  }

  function run(cfg) {
    var bridge = (cfg.checkout_bridge_base_url || '').replace(/\/$/, '');
    var tiers = {};
    (cfg.tiers || []).forEach(function (t) {
      tiers[t.id] = t;
    });

    document.querySelectorAll('a[data-checkout-sku]').forEach(function (a) {
      var sku = (a.getAttribute('data-checkout-sku') || '').trim().toLowerCase();
      var def = (cfg.skus || {})[sku];
      if (!def) return;
      var tier = tiers[def.tier];
      if (bridge) {
        var ret = location.pathname + location.search;
        a.href = bridge + '/pay?sku=' + encodeURIComponent(sku) + '&return_path=' + encodeURIComponent(ret);
        a.setAttribute('data-checkout-mode', 'bridge');
      } else if (tier && tier.url) {
        a.href = tier.url;
        a.setAttribute('data-checkout-mode', 'tier-fallback');
        if (!a.title) a.title = 'Using shared tier link — set checkout_bridge_base_url in payment-links.json for exact SKU tracking.';
      }
    });
  }

  fetch(resolveConfigUrl(), { credentials: 'same-origin' })
    .then(function (r) {
      if (!r.ok) throw new Error('payment-links.json ' + r.status);
      return r.json();
    })
    .then(run)
    .catch(function (e) {
      console.warn('[checkout-resolve]', e.message || e);
    });
})();
