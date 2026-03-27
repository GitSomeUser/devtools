/**
 * Devtools Square bridge: SKU-aware checkout + webhook fulfillment signals.
 * Deploy to Cloudflare Workers (see README.md). No changes to existing Square dashboard links — uses Checkout API to mint one-off payment links.
 * Canonical money + line names: repo-root payment-links.json (Square-friendly pointer file).
 */
import paymentLinks from '../../payment-links.json';

const NOTE_PREFIX = paymentLinks.payment_note_prefix || 'devtools:sku=';
const DEFAULT_CCY = paymentLinks.currency || 'USD';

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
  const idx = note.indexOf(NOTE_PREFIX);
  if (idx === -1) return null;
  const rest = note.slice(idx + NOTE_PREFIX.length);
  const m = rest.match(/^([a-z0-9-]+)/i);
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

/** Human page: most SKUs → pipeline; narrow exceptions stay explicit */
function deliverableUrlForSku(sku, env) {
  const base = siteRoot(env);
  if (sku === 'commit-copy-deck') return `${base}/commits/`;
  if (sku === 'ship-kit') return `${base}/ship-kit/`;
  return `${base}/pipeline/`;
}

/** Base64 (UTF-8) for Resend attachment bodies */
function base64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

async function sendFulfillmentEmail(env, data) {
  if (!env.RESEND_API_KEY || !env.FULFILL_FROM_EMAIL || !data.to) {
    return { sent: false, reason: 'missing resend config or recipient' };
  }
  const payload = {
    from: env.FULFILL_FROM_EMAIL,
    to: [data.to],
    subject: data.subject,
    text: data.text,
  };
  if (data.attachments?.length) {
    payload.attachments = data.attachments;
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = await response.text();
  if (!response.ok) {
    return { sent: false, reason: `resend ${response.status}`, body };
  }
  return { sent: true, body };
}

function kv(env) {
  return env.DELIVERABLES;
}

async function seenPaymentBefore(env, paymentId) {
  const store = kv(env);
  if (!store || !paymentId) return false;
  const key = `fulfilled:${paymentId}`;
  const existing = await store.get(key);
  return !!existing;
}

async function markPaymentSeen(env, paymentId, sku) {
  const store = kv(env);
  if (!store || !paymentId) return;
  const key = `fulfilled:${paymentId}`;
  await store.put(
    key,
    JSON.stringify({ sku, at: new Date().toISOString() }),
    { expirationTtl: 60 * 60 * 24 * 30 }
  );
}

async function loadDeliverableBody(env, sku) {
  const store = kv(env);
  if (!store || !sku) return null;
  return store.get(`product:${sku}`);
}

async function buildFulfillmentEmail(payment, sku, env) {
  const def = paymentLinks.skus?.[sku];
  const product = def?.square_line_name || sku;
  const to = env.FULFILL_TO_OVERRIDE_EMAIL || payment.buyer_email_address || '';
  const amount = payment.amount_money?.amount || 0;
  const currency = payment.amount_money?.currency || DEFAULT_CCY;
  const money = `${(amount / 100).toFixed(2)} ${currency}`;
  const deliverableUrl = deliverableUrlForSku(sku, env);
  const subject = `Your ${product} purchase (${money})`;
  const bodyMd = await loadDeliverableBody(env, sku);
  const hasBody = !!(bodyMd && bodyMd.trim());

  const sharedHead = [
    `Thanks for your payment for ${product}.`,
    '',
    `SKU: ${sku}`,
    `Payment ID: ${payment.id}`,
    `Amount: ${money}`,
    '',
  ];

  const text = hasBody
    ? [
        ...sharedHead,
        'Your file is attached (.md). Browser copy lives here:',
        '',
        deliverableUrl,
        '',
        'Reply if you need anything.',
      ].join('\n')
    : [
        ...sharedHead,
        'We will send the full file as soon as it is loaded into fulfillment storage. Until then:',
        '',
        deliverableUrl,
        '',
        'If you need anything adjusted, reply to this email.',
      ].join('\n');

  const attachments = [];
  if (hasBody) {
    attachments.push({
      filename: `${sku}.md`,
      content: base64Utf8(bodyMd),
    });
  }

  return {
    to,
    subject,
    text,
    attachments: attachments.length ? attachments : undefined,
    deliverableUrl,
    product,
    money,
    hasBody,
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return new Response('ok', { status: 200 });
    }

    if (request.method === 'GET' && url.pathname === '/pay') {
      const sku = (url.searchParams.get('sku') || '').toLowerCase().trim();
      const def = paymentLinks.skus?.[sku];
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
      const ccy = def.currency || DEFAULT_CCY;

      const body = {
        idempotency_key: idempotencyKey,
        description: `devtools ${sku}`,
        quick_pay: {
          name: def.square_line_name.slice(0, 255),
          price_money: {
            amount: Number(def.amount_cents),
            currency: ccy,
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
          const email = await buildFulfillmentEmail(payment, sku, env);
          const result = await sendFulfillmentEmail(env, email);
          if (result.sent) {
            await markPaymentSeen(env, payment.id, sku);
          }
          console.log(
            JSON.stringify({
              ...summary,
              fulfillment_email: result,
              to: email.to,
              deliverable: email.deliverableUrl,
              attachment: !!email.attachments?.length,
            })
          );
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
