/**
 * Devtools Square bridge: SKU-aware checkout + webhook fulfillment signals.
 * Deploy to Cloudflare Workers (see README.md). No changes to existing Square dashboard links — uses Checkout API to mint one-off payment links.
 */
import catalog from '../catalog.json';

const NOTE_PREFIX = catalog.payment_note_prefix || 'devtools:sku=';

function squareHost(env) {
  return env.SQUARE_ENVIRONMENT === 'sandbox'
    ? 'https://connect.squareupsandbox.com'
    : 'https://connect.squareup.com';
}

async function hmacSha256Base64(payload, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const bytes = new Uint8Array(sig);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function timingSafeEqualStr(a, b) {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

async function verifySquareWebhook(body, signatureHeader, signatureKey, notificationUrl) {
  if (!signatureHeader || !signatureKey || !notificationUrl) return false;
  const expected = await hmacSha256Base64(notificationUrl + body, signatureKey);
  return timingSafeEqualStr(expected, signatureHeader);
}

function normalizeReturnUrl(request, returnPath, env) {
  const base = (env.PUBLIC_SITE_ORIGIN || 'https://gitsomeuser.github.io').replace(/\/$/, '');
  const prefix = (env.PUBLIC_SITE_PATH_PREFIX || '/devtools').replace(/\/$/, '');
  const path = returnPath && returnPath.startsWith('/') ? returnPath : `${prefix}/`;
  try {
    const u = new URL(path, base);
    if (!u.href.startsWith(base)) return `${base}${prefix}/?thanks=1`;
    u.searchParams.set('thanks', '1');
    return u.href;
  } catch {
    return `${base}${prefix}/?thanks=1`;
  }
}

function extractSkuFromPaymentNote(note) {
  if (!note || typeof note !== 'string') return null;
  const m = note.match(/devtools:sku=([a-z0-9-]+)/i);
  return m ? m[1].toLowerCase() : null;
}

/** Walk webhook JSON for payment-like objects with note + id + amount */
function extractFulfillmentHints(obj, out = []) {
  if (!obj || typeof obj !== 'object') return out;
  if (typeof obj.note === 'string' && (obj.id || obj.payment_id)) {
    const sku = extractSkuFromPaymentNote(obj.note);
    if (sku) {
      out.push({
        sku,
        payment_id: obj.id,
        status: obj.status,
        amount_money: obj.amount_money,
        note: obj.note,
      });
    }
  }
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object') extractFulfillmentHints(v, out);
  }
  return out;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return new Response('ok', { status: 200 });
    }

    if (request.method === 'GET' && url.pathname === '/pay') {
      const sku = (url.searchParams.get('sku') || '').toLowerCase().trim();
      const def = catalog.skus[sku];
      if (!def) {
        return new Response(`Unknown sku: ${sku}`, { status: 400 });
      }
      if (!env.SQUARE_ACCESS_TOKEN || !env.SQUARE_LOCATION_ID) {
        return new Response('Server missing SQUARE_ACCESS_TOKEN or SQUARE_LOCATION_ID', { status: 503 });
      }

      const returnPath = url.searchParams.get('return_path') || '';
      const redirect = normalizeReturnUrl(request, returnPath, env);
      const paymentNote = `${NOTE_PREFIX}${sku}`.slice(0, 500);
      const idempotencyKey = crypto.randomUUID();

      const body = {
        idempotency_key: idempotencyKey,
        description: `devtools ${sku}`,
        quick_pay: {
          name: def.square_line_name.slice(0, 255),
          price_money: {
            amount: Number(def.amount_cents),
            currency: def.currency || 'USD',
          },
          location_id: env.SQUARE_LOCATION_ID,
        },
        checkout_options: {
          redirect_url: redirect,
        },
        payment_note: paymentNote,
      };

      const host = squareHost(env);
      const ver = env.SQUARE_API_VERSION || '2024-10-17';
      const res = await fetch(`${host}/v2/online-checkout/payment-links`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'Square-Version': ver,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return new Response(JSON.stringify({ error: data.errors || data }, null, 2), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const payUrl = data.payment_link?.url || data.payment_link?.long_url;
      if (!payUrl) {
        return new Response(JSON.stringify(data), { status: 502, headers: { 'Content-Type': 'application/json' } });
      }
      return Response.redirect(payUrl, 302);
    }

    if (request.method === 'POST' && url.pathname === '/webhook') {
      const raw = await request.text();
      const sig =
        request.headers.get('x-square-hmacsha256-signature') ||
        request.headers.get('X-Square-Hmacsha256-Signature');
      const ok = await verifySquareWebhook(
        raw,
        sig,
        env.SQUARE_WEBHOOK_SIGNATURE_KEY || '',
        env.SQUARE_WEBHOOK_NOTIFICATION_URL || ''
      );
      if (!ok) {
        return new Response('invalid signature', { status: 403 });
      }

      let payload;
      try {
        payload = JSON.parse(raw);
      } catch {
        return new Response('bad json', { status: 400 });
      }

      const type = payload.type || payload.event_type || '';
      const hints = extractFulfillmentHints(payload);
      const line = JSON.stringify({
        at: new Date().toISOString(),
        type,
        fulfillment: hints,
        merchant_id: payload.merchant_id,
      });
      console.log(line);

      return new Response('', { status: 200 });
    }

    return new Response('devtools Square bridge: GET /pay?sku=…&return_path=/devtools/pipeline/ POST /webhook', {
      status: 404,
    });
  },
};
