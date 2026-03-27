/**
 * Devtools Square bridge: SKU-aware checkout + webhook fulfillment signals.
 * Deploy to Cloudflare Workers (see README.md). No changes to existing Square dashboard links — uses Checkout API to mint one-off payment links.
 */
import catalog from '../catalog.json';

const NOTE_PREFIX = catalog.payment_note_prefix || 'devtools:sku=';
const DEFAULT_SITE = 'https://gitsomeuser.github.io/devtools';
const SKU_DELIVERABLE_URL = {
  'commit-copy-deck': `${DEFAULT_SITE}/commits/`,
  'ship-kit': `${DEFAULT_SITE}/ship-kit/`,
  'no-show-salvage-sms': `${DEFAULT_SITE}/automation/`,
  'objection-crusher-voice-notes': `${DEFAULT_SITE}/automation/`,
  'founder-call-debrief': `${DEFAULT_SITE}/automation/#cold-homepage-teardown`,
  'google-review-recovery': `${DEFAULT_SITE}/`,
  'cold-homepage-teardown': `${DEFAULT_SITE}/automation/#cold-homepage-teardown`,
  'reply-rescue-pack': `${DEFAULT_SITE}/automation/#reply-rescue-pack`,
  'client-magnet-one-pager': `${DEFAULT_SITE}/automation/#client-magnet-one-pager`,
  'lost-deal-autopsy': `${DEFAULT_SITE}/`,
  'inbox-triage-strike': `${DEFAULT_SITE}/automation/#inbox-triage-strike`,
  'one-day-offer-stress-test': `${DEFAULT_SITE}/automation/#one-day-offer-stress-test`,
  'micro-tip-usd1': `${DEFAULT_SITE}/`,
};

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

function firstPaymentObject(payload) {
  return payload?.data?.object?.payment || payload?.payment || null;
}

function siteRoot(env) {
  const origin = (env.PUBLIC_SITE_ORIGIN || 'https://gitsomeuser.github.io').replace(/\/$/, '');
  const path = (env.PUBLIC_SITE_PATH_PREFIX || '/devtools').replace(/\/$/, '');
  return `${origin}${path}`;
}

function deliverableUrlForSku(sku, env) {
  const base = siteRoot(env);
  const hard = SKU_DELIVERABLE_URL[sku];
  if (hard) return hard.replace(DEFAULT_SITE, base);
  return `${base}/pipeline/#${sku}`;
}

async function sendFulfillmentEmail(env, data) {
  if (!env.RESEND_API_KEY || !env.FULFILL_FROM_EMAIL || !data.to) {
    return { sent: false, reason: 'missing resend config or recipient' };
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.FULFILL_FROM_EMAIL,
      to: [data.to],
      subject: data.subject,
      text: data.text,
    }),
  });
  const body = await response.text();
  if (!response.ok) {
    return { sent: false, reason: `resend ${response.status}`, body };
  }
  return { sent: true, body };
}

async function seenPaymentBefore(env, paymentId) {
  if (!env.FULFILLMENT_KV || !paymentId) return false;
  const key = `fulfilled:${paymentId}`;
  const existing = await env.FULFILLMENT_KV.get(key);
  return !!existing;
}

async function markPaymentSeen(env, paymentId, sku) {
  if (!env.FULFILLMENT_KV || !paymentId) return;
  const key = `fulfilled:${paymentId}`;
  await env.FULFILLMENT_KV.put(
    key,
    JSON.stringify({ sku, at: new Date().toISOString() }),
    { expirationTtl: 60 * 60 * 24 * 30 }
  );
}

function buildFulfillmentEmail(payment, sku, env) {
  const product = catalog.skus?.[sku]?.square_line_name || sku;
  const to = env.FULFILL_TO_OVERRIDE_EMAIL || payment.buyer_email_address || '';
  const amount = payment.amount_money?.amount || 0;
  const currency = payment.amount_money?.currency || 'USD';
  const money = `${(amount / 100).toFixed(2)} ${currency}`;
  const deliverableUrl = deliverableUrlForSku(sku, env);
  const subject = `Your ${product} purchase (${money})`;
  const text = [
    `Thanks for your payment for ${product}.`,
    '',
    `SKU: ${sku}`,
    `Payment ID: ${payment.id}`,
    `Amount: ${money}`,
    '',
    `Deliverable / next step: ${deliverableUrl}`,
    '',
    'If you need anything adjusted, reply to this email.',
  ].join('\n');
  return { to, subject, text, deliverableUrl, product, money };
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
      const payment = firstPaymentObject(payload);
      const sku = extractSkuFromPaymentNote(payment?.note || '');
      const status = payment?.status || '';

      const summary = {
        at: new Date().toISOString(),
        type,
        merchant_id: payload.merchant_id,
        payment_id: payment?.id || null,
        sku: sku || null,
        status: status || null,
      };

      if (sku && payment?.id && status === 'COMPLETED') {
        const alreadyDone = await seenPaymentBefore(env, payment.id);
        if (!alreadyDone) {
          const email = buildFulfillmentEmail(payment, sku, env);
          const result = await sendFulfillmentEmail(env, email);
          await markPaymentSeen(env, payment.id, sku);
          console.log(JSON.stringify({ ...summary, fulfillment_email: result, to: email.to, deliverable: email.deliverableUrl }));
        } else {
          console.log(JSON.stringify({ ...summary, skipped: 'already-fulfilled' }));
        }
      } else {
        console.log(JSON.stringify({ ...summary, skipped: 'no-sku-or-not-completed' }));
      }

      return new Response('', { status: 200 });
    }

    return new Response('devtools Square bridge: GET /pay?sku=…&return_path=/devtools/pipeline/ POST /webhook', {
      status: 404,
    });
  },
};
