(() => {
  'use strict';

  const W = 1080;
  const H = 1350;
  const TZ = 'America/Fortaleza';
  const LOGO = 'assets/cim-logo-oficial.webp?v=20260910-1';
  const SITE = 'detohiluy.github.io/clima-cim';
  const RWY = { 13: 109.8, 31: 289.8 };
  const SNAP = 'cim_briefing_visual_snapshot_v2';
  let activeUrl = '';

  const $ = (s) => document.querySelector(s);
  const tx = (s) => $(s)?.textContent?.trim() || '';
  const n = (v) => {
    const m = String(v ?? '').replace(',', '.').match(/-?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : NaN;
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = (s) => String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
  const fmt = (v, u = '', d = 0) => Number.isFinite(v)
    ? `${v.toLocaleString('pt-BR', { maximumFractionDigits: d })}${u}`
    : '—';

  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function rand(seed) {
    let a = seed >>> 0;
    return () => {
      a += 0x6D2B79F5;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function point(r, heading, cx = 540, cy = 606) {
    const q = heading * Math.PI / 180;
    return { x: cx + Math.sin(q) * r, y: cy - Math.cos(q) * r };
  }

  function comp(dir, speed, heading) {
    if (!Number.isFinite(dir) || !Number.isFinite(speed)) return null;
    const delta = ((dir - heading + 540) % 360) - 180;
    const head = speed * Math.cos(delta * Math.PI / 180);
    const cross = speed * Math.sin(delta * Math.PI / 180);
    return {
      head,
      proa: Math.max(0, head),
      cauda: Math.max(0, -head),
      atraves: Math.abs(cross)
    };
  }

  function rwy(dir, speed) {
    const c13 = comp(dir, speed, RWY[13]);
    const c31 = comp(dir, speed, RWY[31]);
    return {
      c13,
      c31,
      preferred: c13 && c31 ? (c13.head >= c31.head ? '13' : '31') : '—'
    };
  }

  function clock(v, fallback = 0) {
    const m = String(v || '').match(/(\d{1,2}):(\d{2})/);
    return m ? +m[1] + (+m[2] / 60) : fallback;
  }

  function dateInfo() {
    const d = new Date();
    return {
      weekday: new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: TZ }).format(d).toUpperCase(),
      date: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ }).format(d).replace('.', '').toUpperCase(),
      time: new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }).format(d)
    };
  }

  function hours() {
    try {
      if (typeof briefingState === 'undefined' || !briefingState.lastData || typeof briefingBuildHours !== 'function') return [];
      return briefingBuildHours(briefingState.lastData, 0, new Date()).hours.slice(0, 4).map((h) => ({
        time: typeof briefingHour === 'function' ? briefingHour(h.time) : '—',
        wind: +h.windSpeed || 0,
        gust: +h.gust || 0,
        pop: +h.pop || 0,
        precip: +h.precip || 0
      }));
    } catch (_) {
      return [];
    }
  }

  function collect() {
    const wind = n(tx('#wind-speed'));
    const dir = n(tx('#wind-direction'));
    const gust = n(tx('#wind-gust'));
    const rain = n(tx('#rain-probability'));
    const rainMeta = tx('#rain-total');
    return {
      ...dateInfo(),
      condition: tx('#weather-description') || 'Condições meteorológicas no campo',
      wind,
      dir,
      gust,
      spread: Number.isFinite(gust) && Number.isFinite(wind) ? Math.max(0, gust - wind) : 0,
      rain,
      rainPop: n(rainMeta),
      vis: n(tx('#visibility')),
      temp: n(tx('#temperature')),
      humidity: n(tx('#humidity')),
      pressure: n(tx('#pressure')),
      sunrise: tx('#sunrise').replace(/^Nascer\s*/i, '') || '—',
      sunset: tx('#sunset') || '—',
      cardinal: tx('#wind-direction-text').replace(/^Direção\s*/i, '').replace(/\s*·.*$/, '').trim(),
      runway: rwy(dir, wind),
      hours: hours(),
      metarAge: tx('#metar-age')
    };
  }

  function loadSnap() {
    try { return JSON.parse(localStorage.getItem(SNAP) || 'null'); } catch (_) { return null; }
  }

  function saveSnap(d) {
    try {
      localStorage.setItem(SNAP, JSON.stringify({
        ts: Date.now(), wind: d.wind, dir: d.dir, gust: d.gust, rain: d.rain, vis: d.vis
      }));
    } catch (_) {}
  }

  function dirDelta(a, b) {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return Math.round(((a - b + 540) % 360) - 180);
  }

  function delta(d, p) {
    if (!p?.ts) return 'PRIMEIRA LEITURA NESTE DISPOSITIVO';
    const mins = Math.max(1, Math.round((Date.now() - p.ts) / 60000));
    const out = [];
    const add = (label, a, b, unit = '') => {
      if (!Number.isFinite(a) || !Number.isFinite(b)) return;
      const x = a - b;
      out.push(Math.abs(x) < .05 ? `${label} =` : `${label} ${x > 0 ? '+' : '−'}${Math.abs(Math.round(x))}${unit}`);
    };
    add('VENTO', d.wind, p.wind);
    const dd = dirDelta(d.dir, p.dir);
    if (dd !== null) out.push(dd ? `DIREÇÃO ${dd > 0 ? '+' : '−'}${Math.abs(dd)}°` : 'DIREÇÃO =');
    add('RAJADA', d.gust, p.gust);
    if (Number.isFinite(d.rain) && Number.isFinite(p.rain)) {
      const x = d.rain - p.rain;
      out.push(Math.abs(x) < .05 ? 'CHUVA =' : `CHUVA ${x > 0 ? '+' : '−'}${Math.abs(x).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mm`);
    }
    add('VIS', d.vis, p.vis, ' km');
    return `${mins} MIN · ${out.slice(0, 4).join(' · ')}`;
  }

  function flow(d) {
    const seed = hash([
      Math.round((d.dir || 0) / 4), Math.round(d.wind || 0), Math.round(d.gust || 0),
      Math.round((d.rain || 0) * 10), Math.round((d.vis || 0) * 10), d.date
    ].join('|'));
    const r = rand(seed);
    const count = Math.round(clamp(30 + (d.wind || 0) * .55 + d.spread * .45, 30, 56));
    const amplitude = clamp(10 + d.spread * 1.7 + (d.rain || 0) * 5, 10, 70);
    const visibility = Number.isFinite(d.vis) ? clamp(d.vis / 10, .32, 1) : .75;
    const paths = [];
    for (let i = 0; i < count; i++) {
      const y = -220 + i * (1750 / Math.max(1, count - 1));
      const a = amplitude * (.35 + r() * 1.15);
      const b = (r() - .5) * a;
      const c = (r() - .5) * a;
      const dash = r() > .78 ? `stroke-dasharray="${45 + Math.round(r() * 100)} ${22 + Math.round(r() * 50)}"` : '';
      paths.push(`<path d="M-380 ${y.toFixed(1)} C70 ${(y + b).toFixed(1)},690 ${(y + c).toFixed(1)},1460 ${y.toFixed(1)}" fill="none" stroke="url(#flow)" stroke-width="${(1 + r() * 2.4 + clamp((d.wind || 0) / 50, 0, 1)).toFixed(1)}" opacity="${((.08 + r() * .25) * visibility).toFixed(2)}" ${dash}/>`);
    }
    return `<g transform="rotate(${(Number.isFinite(d.dir) ? (d.dir + 90) % 360 : 90).toFixed(1)} 540 606)">${paths.join('')}</g>`;
  }

  function rain(d) {
    const mm = Number.isFinite(d.rain) ? d.rain : 0;
    const pop = Number.isFinite(d.rainPop) ? d.rainPop : 0;
    const intensity = Math.max(mm, pop / 110);
    if (intensity < .18) return '';
    const r = rand(hash(`rain|${d.date}|${Math.round(intensity * 100)}|${Math.round(d.dir || 0)}`));
    const parts = [];
    const count = Math.round(clamp(20 + intensity * 30, 20, 95));
    const drift = Number.isFinite(d.dir) ? Math.sin(d.dir * Math.PI / 180) * 24 : 8;
    for (let i = 0; i < count; i++) {
      const x = r() * W;
      const y = 230 + r() * 700;
      const l = 10 + r() * 36;
      parts.push(`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + drift).toFixed(1)}" y2="${(y + l).toFixed(1)}" stroke="#7fd4f6" stroke-width="${(1 + r() * 2).toFixed(1)}" opacity="${(.07 + r() * .24).toFixed(2)}"/>`);
    }
    return `<g>${parts.join('')}</g>`;
  }

  function compassTicks() {
    const ticks = [];
    for (let deg = 0; deg < 360; deg += 10) {
      const outer = point(282, deg);
      const inner = point(deg % 30 === 0 ? 265 : 273, deg);
      ticks.push(`<line x1="${outer.x.toFixed(1)}" y1="${outer.y.toFixed(1)}" x2="${inner.x.toFixed(1)}" y2="${inner.y.toFixed(1)}" stroke="#6fa6c2" stroke-width="${deg % 30 === 0 ? 2 : 1}" opacity="${deg % 30 === 0 ? .5 : .25}"/>`);
    }
    return ticks.join('');
  }

  function compText(c) {
    if (!c) return '—';
    const primary = c.proa >= c.cauda ? `PROA ${Math.round(c.proa)}` : `CAUDA ${Math.round(c.cauda)}`;
    return `${primary} · TRAVÉS ${Math.round(c.atraves)} km/h`;
  }

  function runway(d) {
    const cx = 540, cy = 606, half = 198;
    const p13 = point(half, RWY[31], cx, cy);
    const p31 = point(half, RWY[13], cx, cy);
    const l13 = point(half + 48, RWY[31], cx, cy);
    const l31 = point(half + 48, RWY[13], cx, cy);
    const wf = Number.isFinite(d.dir) ? point(314, d.dir, cx, cy) : null;
    const wt = Number.isFinite(d.dir) ? point(222, (d.dir + 180) % 360, cx, cy) : null;
    const bandA = Number.isFinite(d.dir) ? point(300, d.dir - 3, cx, cy) : null;
    const bandB = Number.isFinite(d.dir) ? point(300, d.dir + 3, cx, cy) : null;
    const bandAT = Number.isFinite(d.dir) ? point(235, d.dir + 177, cx, cy) : null;
    const bandBT = Number.isFinite(d.dir) ? point(235, d.dir + 183, cx, cy) : null;
    return `<g>
      <circle cx="${cx}" cy="${cy}" r="300" fill="#03121d" fill-opacity=".58" stroke="#2b627e" stroke-width="1.5"/>
      <circle cx="${cx}" cy="${cy}" r="282" fill="none" stroke="#2b627e" stroke-width="1" opacity=".34"/>
      <circle cx="${cx}" cy="${cy}" r="238" fill="none" stroke="#17425a" stroke-width="1" stroke-dasharray="4 11"/>
      ${compassTicks()}
      <text x="${cx}" y="${cy - 318}" text-anchor="middle" class="compass-cardinal">N</text>
      <text x="${cx + 318}" y="${cy + 7}" text-anchor="middle" class="compass-cardinal">E</text>
      <text x="${cx}" y="${cy + 327}" text-anchor="middle" class="compass-cardinal">S</text>
      <text x="${cx - 318}" y="${cy + 7}" text-anchor="middle" class="compass-cardinal">W</text>
      ${bandA && bandAT ? `<line x1="${bandA.x}" y1="${bandA.y}" x2="${bandAT.x}" y2="${bandAT.y}" stroke="#65c9f1" stroke-width="2" opacity=".28"/>` : ''}
      ${bandB && bandBT ? `<line x1="${bandB.x}" y1="${bandB.y}" x2="${bandBT.x}" y2="${bandBT.y}" stroke="#65c9f1" stroke-width="2" opacity=".28"/>` : ''}
      ${wf && wt ? `<line x1="${wf.x}" y1="${wf.y}" x2="${wt.x}" y2="${wt.y}" stroke="#7bdcff" stroke-width="8" stroke-linecap="round" marker-end="url(#arrow)" filter="url(#glow)"/>` : ''}
      <line x1="${p31.x}" y1="${p31.y}" x2="${p13.x}" y2="${p13.y}" stroke="#f3f8fb" stroke-width="42" stroke-linecap="round" opacity=".98"/>
      <line x1="${p31.x}" y1="${p31.y}" x2="${p13.x}" y2="${p13.y}" stroke="#102837" stroke-width="31" stroke-linecap="round"/>
      <line x1="${p31.x}" y1="${p31.y}" x2="${p13.x}" y2="${p13.y}" stroke="#fff" stroke-width="3" stroke-dasharray="24 18" opacity=".95"/>
      <text x="${l13.x}" y="${l13.y}" text-anchor="middle" dominant-baseline="middle" class="runway-no ${d.runway.preferred === '13' ? 'preferred' : ''}">13</text>
      <text x="${l31.x}" y="${l31.y}" text-anchor="middle" dominant-baseline="middle" class="runway-no ${d.runway.preferred === '31' ? 'preferred' : ''}">31</text>
    </g>`;
  }

  function daylight(d) {
    const a = clock(d.sunrise, 5.5);
    const b = clock(d.sunset, 17.7);
    const now = clock(d.time, a);
    const x1 = 80, x2 = 1000, y = 1108;
    const x = x1 + (x2 - x1) * clamp((now - a) / Math.max(.1, b - a), 0, 1);
    return `<g>
      <text x="48" y="1062" class="section">PERÍODO DIURNO</text>
      <line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#234d63" stroke-width="6" stroke-linecap="round"/>
      <line x1="${x1}" y1="${y}" x2="${x}" y2="${y}" stroke="#71d4f8" stroke-width="6" stroke-linecap="round"/>
      <circle cx="${x1}" cy="${y}" r="8" fill="#f8c85c"/><circle cx="${x2}" cy="${y}" r="8" fill="#f8c85c"/>
      <circle cx="${x}" cy="${y}" r="11" fill="#fff" stroke="#71d4f8" stroke-width="5"/>
      <text x="${x1}" y="${y + 34}" class="tiny">${esc(d.sunrise)} NASCER</text>
      <text x="${x2}" y="${y + 34}" text-anchor="end" class="tiny">${esc(d.sunset)} PÔR DO SOL</text>
      <text x="${x}" y="${y - 20}" text-anchor="middle" class="micro bright">AGORA</text>
    </g>`;
  }

  function trend(d) {
    const xs = [48, 300, 552, 804];
    if (!d.hours.length) return `<text x="48" y="1220" class="small">Tendência horária ainda não disponível.</text>`;
    return d.hours.slice(0, 4).map((h, i) => {
      const x = xs[i];
      return `<g transform="translate(${x} 0)">
        <text y="1200" class="hour">${esc(h.time)}</text>
        <text y="1235" class="trend-main">${fmt(h.wind)} <tspan class="trend-unit">km/h</tspan></text>
        <text y="1266" class="tiny">RAJ ${fmt(h.gust)} · CHUVA ${fmt(h.precip, ' mm', 1)}</text>
        <text y="1295" class="tiny">PROB. ${fmt(h.pop, '%')}</text>
      </g>`;
    }).join('');
  }

  function metricRibbon(d) {
    const rainLabel = Number.isFinite(d.rain) && d.rain > .05 ? 'CHUVA AGORA' : 'PRECIPITAÇÃO';
    return `<g>
      <line x1="48" y1="875" x2="1032" y2="875" stroke="#2b566c"/>
      <text x="48" y="916" class="metric-main">${fmt(d.temp, '°')}</text><text x="48" y="944" class="metric-label">TEMPERATURA</text>
      <line x1="286" y1="895" x2="286" y2="956" stroke="#2b566c"/>
      <text x="322" y="916" class="metric-main">${fmt(d.rain, '', 1)}</text><text x="322" y="944" class="metric-label">${rainLabel} · MM</text>
      <line x1="540" y1="895" x2="540" y2="956" stroke="#2b566c"/>
      <text x="576" y="916" class="metric-main">${fmt(d.rainPop, '%')}</text><text x="576" y="944" class="metric-label">PRÓXIMA HORA</text>
      <line x1="790" y1="895" x2="790" y2="956" stroke="#2b566c"/>
      <text x="826" y="916" class="metric-main">${fmt(d.vis)}</text><text x="826" y="944" class="metric-label">VISIBILIDADE · KM</text>
    </g>`;
  }

  function svg(d, logo, previous) {
    const vis = Number.isFinite(d.vis) ? d.vis : 10;
    const halo = clamp(300 + vis * 18, 360, 520);
    const currentDir = Number.isFinite(d.dir) ? `${Math.round(d.dir)}°` : '—';
    const currentWind = fmt(d.wind);
    const gust = fmt(d.gust);
    const c13 = compText(d.runway.c13);
    const c31 = compText(d.runway.c31);
    const metarAge = d.metarAge && !/consult|aguard/i.test(d.metarAge) ? ` · ${esc(d.metarAge)}` : '';
    return `<?xml version="1.0" encoding="UTF-8"?>
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <defs>
        <radialGradient id="space" cx="50%" cy="42%" r="76%"><stop offset="0" stop-color="#0c3850"/><stop offset=".48" stop-color="#071f31"/><stop offset="1" stop-color="#020a11"/></radialGradient>
        <linearGradient id="flow" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2e95c5" stop-opacity="0"/><stop offset=".34" stop-color="#4ab8e8"/><stop offset=".7" stop-color="#fff"/><stop offset="1" stop-color="#6dd2f7" stop-opacity=".08"/></linearGradient>
        <radialGradient id="halo"><stop offset="0" stop-color="#61c9f2" stop-opacity=".17"/><stop offset=".5" stop-color="#2b84ad" stop-opacity=".07"/><stop offset="1" stop-color="#071725" stop-opacity="0"/></radialGradient>
        <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#7bdcff"/></marker>
        <filter id="glow"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <style>
          text{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif}
          .micro{fill:#8fb9cd;font-size:20px;font-weight:850;letter-spacing:2.6px}.bright{fill:#c9f1ff}.tiny{fill:#8eafbf;font-size:20px;font-weight:650}.small{fill:#a4c0cf;font-size:24px;font-weight:650}.section{fill:#65c9f1;font-size:20px;font-weight:900;letter-spacing:2.9px}.headline{fill:#fff;font-size:46px;font-weight:900;letter-spacing:-1px}.condition{fill:#d8eef8;font-size:26px;font-weight:700}.wind-value{fill:#fff;font-size:76px;font-weight:920;letter-spacing:-3px}.wind-unit{fill:#8fb9cd;font-size:24px;font-weight:800}.metric-main{fill:#fff;font-size:48px;font-weight:900;letter-spacing:-1.5px}.metric-label{fill:#8fb0c1;font-size:18px;font-weight:800;letter-spacing:1.7px}.hour{fill:#69cdf4;font-size:22px;font-weight:900;letter-spacing:1.8px}.trend-main{fill:#fff;font-size:34px;font-weight:900}.trend-unit{fill:#8fb0c1;font-size:18px;font-weight:800}.runway-no{fill:#91b4c5;font-size:35px;font-weight:950}.runway-no.preferred{fill:#fff;filter:url(#glow)}.compass-cardinal{fill:#719aad;font-size:18px;font-weight:900}.component{fill:#d9edf6;font-size:21px;font-weight:800}.component-label{fill:#67cdf4;font-size:23px;font-weight:950}
        </style>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#space)"/>
      <circle cx="540" cy="606" r="${halo}" fill="url(#halo)"/>
      ${flow(d)}${rain(d)}

      <rect x="48" y="38" width="320" height="126" rx="26" fill="#fff" fill-opacity=".98"/>
      <image href="${logo}" x="66" y="50" width="284" height="102" preserveAspectRatio="xMidYMid meet"/>
      <text x="1032" y="62" text-anchor="end" class="micro">${esc(d.weekday)}</text>
      <text x="1032" y="100" text-anchor="end" fill="#fff" font-size="30" font-weight="900">${esc(d.date)}</text>
      <text x="1032" y="136" text-anchor="end" class="small">ATUALIZADO ${esc(d.time)}</text>

      <text x="48" y="222" class="section">CONDIÇÕES AGORA</text>
      <text x="48" y="274" class="headline">${esc(d.condition)}</text>
      <text x="48" y="310" class="small">CIM · EUSÉBIO · PISTA 13/31 · 230 × 12 m</text>

      <g transform="translate(48 368)">
        <text class="section">VENTO</text>
        <text y="74" class="wind-value">${currentWind}</text>
        <text x="128" y="72" class="wind-unit">KM/H</text>
        <text y="114" class="condition">${currentDir} · ${esc(d.cardinal || 'DIREÇÃO')}</text>
        <text y="154" class="small">RAJADA ${gust} KM/H</text>
      </g>

      ${runway(d)}

      <g transform="translate(48 725)">
        <text class="component-label">13</text><text x="48" class="component">${esc(c13)}</text>
        <text y="42" class="component-label">31</text><text x="48" y="42" class="component">${esc(c31)}</text>
        <text y="92" class="tiny">MAIOR COMPONENTE DE PROA: CABECEIRA ${esc(d.runway.preferred)}</text>
      </g>

      ${metricRibbon(d)}

      <text x="48" y="1004" class="section">DESDE A ÚLTIMA LEITURA</text>
      <text x="48" y="1037" class="tiny">${esc(delta(d, previous))}</text>

      ${daylight(d)}
      <text x="48" y="1170" class="section">TENDÊNCIA · PRÓXIMAS HORAS</text>
      ${trend(d)}

      <line x1="48" y1="1316" x2="1032" y2="1316" stroke="#23485e"/>
      <text x="48" y="1342" fill="#7fa6b8" font-size="16" font-weight="700">DADOS PRINCIPAIS · MODELO NAS COORDENADAS DO CIM  |  METAR SBFZ · REFERÊNCIA REGIONAL${metarAge}</text>
      <text x="1032" y="1342" text-anchor="end" fill="#69cdf4" font-size="16" font-weight="850">${SITE}</text>
    </svg>`;
  }

  async function dataUrl(src) {
    const res = await fetch(src, { cache: 'no-store' });
    if (!res.ok) throw new Error(`asset ${res.status}`);
    const blob = await res.blob();
    return new Promise((ok, fail) => {
      const f = new FileReader();
      f.onload = () => ok(f.result);
      f.onerror = fail;
      f.readAsDataURL(blob);
    });
  }

  async function png(markup) {
    const u = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const img = await new Promise((ok, fail) => {
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = fail;
        i.src = u;
      });
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      c.getContext('2d').drawImage(img, 0, 0, W, H);
      return await new Promise((ok) => c.toBlob(ok, 'image/png', .96));
    } finally {
      URL.revokeObjectURL(u);
    }
  }

  function ui() {
    if ($('#cim-briefing-overlay')) return;
    const style = document.createElement('style');
    style.textContent = '.cim-briefing-overlay{position:fixed;inset:0;background:rgba(1,8,13,.92);backdrop-filter:blur(18px);z-index:9999;display:none;align-items:center;justify-content:center;padding:24px}.cim-briefing-overlay.open{display:flex}.cim-briefing-shell{width:min(94vw,620px);max-height:94vh;display:flex;flex-direction:column;gap:14px}.cim-briefing-preview{background:#020b12;border:1px solid rgba(104,203,244,.28);border-radius:22px;overflow:auto;box-shadow:0 28px 90px rgba(0,0,0,.45)}.cim-briefing-preview img{display:block;width:100%;height:auto}.cim-briefing-actions{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}.cim-briefing-actions button{border:0;border-radius:999px;padding:12px 18px;font:700 14px system-ui;cursor:pointer}.cim-briefing-primary{background:#67cdf4;color:#02111b}.cim-briefing-secondary{background:#173042;color:#e8f5fb}@media(max-width:600px){.cim-briefing-overlay{padding:10px}.cim-briefing-shell{width:100%;max-height:98vh}.cim-briefing-actions{justify-content:stretch}.cim-briefing-actions button{flex:1}}';
    document.head.appendChild(style);
    const o = document.createElement('div');
    o.id = 'cim-briefing-overlay';
    o.className = 'cim-briefing-overlay';
    o.innerHTML = '<div class="cim-briefing-shell" role="dialog" aria-modal="true" aria-label="Prévia do briefing visual do CIM"><div class="cim-briefing-preview"><img id="cim-briefing-preview-image" alt="Briefing visual meteorológico do CIM"></div><div class="cim-briefing-actions"><button id="cim-briefing-close" class="cim-briefing-secondary">Fechar</button><button id="cim-briefing-save" class="cim-briefing-secondary">Salvar PNG</button><button id="cim-briefing-share" class="cim-briefing-primary">Compartilhar</button></div></div>';
    document.body.appendChild(o);
    $('#cim-briefing-close').onclick = () => o.classList.remove('open');
    o.onclick = (e) => { if (e.target === o) o.classList.remove('open'); };
  }

  async function show() {
    const b = $('#today-cim-briefing-visual');
    const old = b?.textContent || 'Gerar briefing visual';
    if (b) { b.disabled = true; b.textContent = 'Gerando briefing…'; }
    try {
      const d = collect();
      if (!Number.isFinite(d.wind) || !Number.isFinite(d.dir) || !Number.isFinite(d.temp)) {
        throw new Error('dados ainda não carregados');
      }
      const previous = loadSnap();
      const mark = svg(d, await dataUrl(LOGO), previous);
      const blob = await png(mark);
      if (!blob) throw new Error('PNG vazio');
      saveSnap(d);
      if (activeUrl) URL.revokeObjectURL(activeUrl);
      activeUrl = URL.createObjectURL(blob);
      const file = new File(
        [blob],
        `cim-condicoes-${new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())}.png`,
        { type: 'image/png' }
      );
      ui();
      $('#cim-briefing-preview-image').src = activeUrl;
      $('#cim-briefing-overlay').classList.add('open');
      $('#cim-briefing-share').onclick = async () => {
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Condições agora · CIM' });
        } else {
          const a = document.createElement('a');
          a.href = activeUrl;
          a.download = file.name;
          a.click();
        }
      };
      $('#cim-briefing-save').onclick = () => {
        const a = document.createElement('a');
        a.href = activeUrl;
        a.download = file.name;
        a.click();
      };
    } catch (e) {
      console.error('[Briefing visual CIM]', e);
      alert('Não foi possível gerar o briefing visual agora. Aguarde os dados do painel e tente novamente.');
    } finally {
      if (b) { b.disabled = false; b.textContent = old; }
    }
  }

  function install() {
    const s = $('#today-cim-share');
    if (!s || $('#today-cim-briefing-visual')) return;
    const b = document.createElement('button');
    b.id = 'today-cim-briefing-visual';
    b.className = 'today-cim-share';
    b.type = 'button';
    b.textContent = 'Gerar briefing visual';
    b.setAttribute('aria-label', 'Gerar briefing visual meteorológico do CIM');
    s.insertAdjacentElement('afterend', b);
    b.onclick = show;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
