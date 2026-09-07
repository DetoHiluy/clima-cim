const DEFAULT_ORIGINS = 'https://detohiluy.github.io';
const TIMEZONE = 'America/Fortaleza';
const PERIODS = new Set(['morning', 'afternoon', 'both']);
const TTL_SECONDS = 3 * 24 * 60 * 60;

function localDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const pick = type => parts.find(p => p.type === type)?.value;
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

function allowedDates() {
  const now = new Date();
  return new Set([localDateKey(now), localDateKey(new Date(now.getTime() + 86400000))]);
}

function cleanOriginList(env) {
  return new Set(String(env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(',').map(x => x.trim()).filter(Boolean));
}

function requestOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return DEFAULT_ORIGINS;
  if (cleanOriginList(env).has(origin)) return origin;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return null;
}

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(request, env, data, status = 200) {
  const origin = requestOrigin(request, env) || DEFAULT_ORIGINS;
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...cors(origin)
    }
  });
}

function validDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) && allowedDates().has(date);
}

function validDeviceId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{16,96}$/.test(value);
}

async function hashDevice(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
}

function keyFor(date, hash) {
  return `attendance:${date}:${hash}`;
}

async function listRecords(env, date) {
  const prefix = `attendance:${date}:`;
  let cursor;
  const records = [];
  do {
    const page = await env.ATTENDANCE.list({ prefix, cursor, limit: 1000 });
    for (const key of page.keys) {
      let period = key.metadata?.period;
      if (!PERIODS.has(period)) period = await env.ATTENDANCE.get(key.name);
      if (PERIODS.has(period)) records.push(period);
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return records;
}

async function summary(env, date) {
  const records = await listRecords(env, date);
  let morning = 0;
  let afternoon = 0;
  for (const period of records) {
    if (period === 'morning' || period === 'both') morning++;
    if (period === 'afternoon' || period === 'both') afternoon++;
  }
  return { date, total: records.length, morning, afternoon };
}

async function ownSelection(env, date, deviceId) {
  if (!validDeviceId(deviceId)) return null;
  const hash = await hashDevice(deviceId);
  const period = await env.ATTENDANCE.get(keyFor(date, hash));
  return PERIODS.has(period) ? period : null;
}

async function readBody(request) {
  try { return await request.json(); } catch { return null; }
}

export default {
  async fetch(request, env) {
    const origin = requestOrigin(request, env);
    if (request.headers.get('Origin') && !origin) {
      return new Response('Forbidden', { status: 403 });
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin || DEFAULT_ORIGINS) });
    }
    if (!env.ATTENDANCE) return json(request, env, { error: 'kv_not_configured' }, 503);

    const url = new URL(request.url);
    if (url.pathname === '/health' && request.method === 'GET') {
      return json(request, env, { ok: true, service: 'CIM attendance', date: localDateKey(), time: new Date().toISOString() });
    }

    if (url.pathname !== '/attendance') return json(request, env, { error: 'not_found' }, 404);

    if (request.method === 'GET') {
      const date = url.searchParams.get('date') || localDateKey();
      if (!validDate(date)) return json(request, env, { error: 'invalid_date' }, 400);
      const deviceId = url.searchParams.get('device_id');
      return json(request, env, {
        ...(await summary(env, date)),
        own_selection: await ownSelection(env, date, deviceId)
      });
    }

    if (request.method === 'POST') {
      const body = await readBody(request);
      const date = body?.date;
      const period = body?.period;
      const deviceId = body?.device_id;
      if (!validDate(date)) return json(request, env, { error: 'invalid_date' }, 400);
      if (!PERIODS.has(period)) return json(request, env, { error: 'invalid_period' }, 400);
      if (!validDeviceId(deviceId)) return json(request, env, { error: 'invalid_device' }, 400);
      const hash = await hashDevice(deviceId);
      await env.ATTENDANCE.put(keyFor(date, hash), period, {
        expirationTtl: TTL_SECONDS,
        metadata: { period }
      });
      return json(request, env, { ok: true, own_selection: period, ...(await summary(env, date)) });
    }

    if (request.method === 'DELETE') {
      const body = await readBody(request);
      const date = body?.date;
      const deviceId = body?.device_id;
      if (!validDate(date)) return json(request, env, { error: 'invalid_date' }, 400);
      if (!validDeviceId(deviceId)) return json(request, env, { error: 'invalid_device' }, 400);
      const hash = await hashDevice(deviceId);
      await env.ATTENDANCE.delete(keyFor(date, hash));
      return json(request, env, { ok: true, own_selection: null, ...(await summary(env, date)) });
    }

    return json(request, env, { error: 'method_not_allowed' }, 405);
  }
};
