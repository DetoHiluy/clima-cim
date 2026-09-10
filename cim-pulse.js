(() => {
  'use strict';

  const W = 1080;
  const H = 1350;
  const TZ = 'America/Fortaleza';
  const LOGO = 'assets/cim-logo-oficial.webp?v=20260910-1';
  const SITE = 'detohiluy.github.io/clima-cim';
  const RUNWAY = { '13': 109.8, '31': 289.8 };
  const SNAPSHOT_KEY = 'cim_pulse_snapshot_v1';

  const $ = s => document.querySelector(s);
  const text = s => $(s)?.textContent?.trim() || '';
  const num = value => {
    const m = String(value ?? '').replace(',', '.').match(/-?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : NaN;
  };
  const esc = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function hashString(input) {
    let h = 2166136261;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a += 0x6D2B79F5;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function dateInfo() {
    const d = new Date();
    return {
      weekday: new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: TZ }).format(d).toUpperCase(),
      date: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ })
        .format(d).replace('.', '').toUpperCase(),
      time: new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }).format(d)
    };
  }

  function components(direction, speed, heading) {
    if (!Number.isFinite(direction) || !Number.isFinite(speed)) return null;
    const delta = ((direction - heading + 540) % 360) - 180;
    const head = speed * Math.cos(delta * Math.PI / 180);
    const cross = speed * Math.sin(delta * Math.PI / 180);
    return {
      head,
      proa: Math.max(0, head),
      cauda: Math.max(0, -head),
      atraves: Math.abs(cross)
    };
  }

  function runwayData(direction, speed) {
    const c13 = components(direction, speed, RUNWAY['13']);
    const c31 = components(direction, speed, RUNWAY['31']);
    const preferred = c13 && c31 ? (c13.head >= c31.head ? '13' : '31') : '—';
    return { c13, c31, preferred };
  }

  function nextHours() {
    try {
      if (typeof briefingState === 'undefined' || !briefingState.lastData || typeof briefingBuildHours !== 'function') return [];
      const day = briefingBuildHours(briefingState.lastData, 0, new Date());
      return day.hours.slice(0, 4).map(h => ({
        time: typeof briefingHour === 'function' ? briefingHour(h.time) : '—',
        wind: Number(h.windSpeed) || 0,
        gust: Number(h.gust) || 0,
        pop: Number(h.pop) || 0,
        precip: Number(h.precip) || 0
      }));
    } catch (_) {
      return [];
    }
  }

  function collect() {
    const wind = num(text('#wind-speed'));
    const direction = num(text('#wind-direction'));
    const gust = num(text('#wind-gust'));
    const rain = num(text('#rain-probability'));
    const rainMeta = text('#rain-total');
    const visibility = num(text('#visibility'));
    const temperature = num(text('#temperature'));
    const humidity = num(text('#humidity'));
    const pressure = num(text('#pressure'));
    const sunrise = text('#sunrise').replace(/^Nascer\s*/i, '') || '—';
    const sunset = text('#sunset') || '—';
    const date = dateInfo();
    return {
      ...date,
      weather: text('#weather-description') || 'Condição meteorológica',
      wind,
      direction,
      gust,
      spread: Number.isFinite(gust) && Number.isFinite(wind) ? Math.max(0, gust - wind) : 0,
      rain,
      rainPop: num(rainMeta),
      visibility,
      temperature,
      humidity,
      pressure,
      sunrise,
      sunset,
      runway: runwayData(direction, wind),
      hours: nextHours(),
      metarAge: text('#metar-age')
    };
  }

  function parseClock(value, fallback) {
    const m = String(value || '').match(/(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) + Number(m[2]) / 60 : fallback;
  }

  function fmt(value, unit = '', decimals = 0) {
    if (!Number.isFinite(value)) return '—';
    return `${value.toLocaleString('pt-BR', { maximumFractionDigits: decimals })}${unit}`;
  }

  function loadSnapshot() {
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function saveSnapshot(d) {
    try {
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({
        ts: Date.now(),
        wind: d.wind,
        direction: d.direction,
        gust: d.gust,
        rain: d.rain,
        visibility: d.visibility
      }));
    } catch (_) {}
  }

  function signedDirectionDelta(now, before) {
    if (!Number.isFinite(now) || !Number.isFinite(before)) return null;
    let delta = ((now - before + 540) % 360) - 180;
    return Math.round(delta);
  }

  function deltaText(d, previous) {
    if (!previous || !previous.ts) return 'PRIMEIRA LEITURA NESTE DISPOSITIVO';
    const mins = Math.max(1, Math.round((Date.now() - previous.ts) / 60000));
    const items = [];
    const add = (label, now, old, suffix = '') => {
      if (!Number.isFinite(now) || !Number.isFinite(old)) return;
      const diff = now - old;
      if (Math.abs(diff) < 0.05) items.push(`${label} =`);
      else items.push(`${label} ${diff > 0 ? '+' : '−'}${Math.abs(Math.round(diff))}${suffix}`);
    };
    add('VENTO', d.wind, previous.wind, '');
    const dir = signedDirectionDelta(d.direction, previous.direction);
    if (dir !== null) items.push(`DIR ${dir === 0 ? '=' : `${dir > 0 ? '+' : '−'}${Math.abs(dir)}°`}`);
    add('RAJ', d.gust, previous.gust, '');
    if (Number.isFinite(d.rain) && Number.isFinite(previous.rain)) {
      const diff = d.rain - previous.rain;
      if (Math.abs(diff) < 0.05) items.push('CHUVA =');
      else items.push(`CHUVA ${diff > 0 ? '+' : '−'}${Math.abs(diff).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mm`);
    }
    add('VIS', d.visibility, previous.visibility, ' km');
    return `${mins} MIN · ${items.slice(0, 4).join(' · ')}`;
  }

  function fieldLines(d) {
    const seed = hashString([
      Math.round((d.direction || 0) / 5),
      Math.round(d.wind || 0),
      Math.round(d.gust || 0),
      Math.round((d.rain || 0) * 10),
      Math.round((d.visibility || 0) * 10),
      d.date
    ].join('|'));
    const random = rng(seed);
    const count = Math.round(clamp(24 + (d.wind || 0) * .55 + d.spread * .35, 24, 46));
    const amp = clamp(12 + d.spread * 1.6 + (d.rain || 0) * 5, 12, 62);
    const visFactor = Number.isFinite(d.visibility) ? clamp(d.visibility / 10, .35, 1) : .75;
    const flowRotation = Number.isFinite(d.direction) ? (d.direction + 90) % 360 : 90;
    const paths = [];

    for (let i = 0; i < count; i++) {
      const y = -170 + i * (1690 / Math.max(1, count - 1));
      const localAmp = amp * (.45 + random() * .95);
      const bend = (random() - .5) * localAmp;
      const bend2 = (random() - .5) * localAmp;
      const opacity = (.08 + random() * .25) * visFactor;
      const width = .8 + random() * 2.1 + clamp((d.wind || 0) / 55, 0, 1);
      const dash = random() > .72 ? `stroke-dasharray="${40 + Math.round(random()*90)} ${18 + Math.round(random()*45)}"` : '';
      paths.push(`<path d="M -330 ${y.toFixed(1)} C 80 ${(y+bend).toFixed(1)}, 650 ${(y+bend2).toFixed(1)}, 1410 ${y.toFixed(1)}" fill="none" stroke="url(#flow)" stroke-width="${width.toFixed(1)}" opacity="${opacity.toFixed(2)}" ${dash}/>`);
    }
    return `<g transform="rotate(${flowRotation.toFixed(1)} 540 675)">${paths.join('')}</g>`;
  }

  function rainParticles(d) {
    const intensity = Math.max(Number.isFinite(d.rain) ? d.rain : 0, Number.isFinite(d.rainPop) ? d.rainPop / 100 : 0);
    if (intensity < .15) return '';
    const count = Math.round(clamp(18 + intensity * 28, 18, 90));
    const random = rng(hashString(`rain|${d.date}|${Math.round(intensity*100)}|${Math.round(d.direction||0)}`));
    const drift = Number.isFinite(d.direction) ? Math.sin(d.direction * Math.PI / 180) * 26 : 8;
    const parts = [];
    for (let i = 0; i < count; i++) {
      const x = random() * W;
      const y = 250 + random() * 850;
      const len = 12 + random() * 38;
      const opacity = .08 + random() * .28;
      parts.push(`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x+drift).toFixed(1)}" y2="${(y+len).toFixed(1)}" stroke="#7fd4f6" stroke-width="${(1+random()*2).toFixed(1)}" opacity="${opacity.toFixed(2)}"/>`);
    }
    return `<g>${parts.join('')}</g>`;
  }

  function pointForHeading(cx, cy, radius, heading) {
    const rad = heading * Math.PI / 180;
    return { x: cx + Math.sin(rad) * radius, y: cy - Math.cos(rad) * radius };
  }

  function runwayGraphic(d) {
    const cx = 540, cy = 650, half = 198;
    const p13 = pointForHeading(cx, cy, half, RUNWAY['13']);
    const p31 = pointForHeading(cx, cy, half, RUNWAY['31']);
    const label13 = pointForHeading(cx, cy, half + 42, RUNWAY['13']);
    const label31 = pointForHeading(cx, cy, half + 42, RUNWAY['31']);
    const preferred = d.runway.preferred;
    const windFrom = Number.isFinite(d.direction) ? pointForHeading(cx, cy, 285, d.direction) : null;
    const windTo = Number.isFinite(d.direction) ? pointForHeading(cx, cy, 238, (d.direction + 180) % 360) : null;

    return `
      <g>
        <circle cx="${cx}" cy="${cy}" r="256" fill="#03121d" fill-opacity=".64" stroke="#284f66" stroke-width="1.5"/>
        <circle cx="${cx}" cy="${cy}" r="216" fill="none" stroke="#17425a" stroke-width="1" stroke-dasharray="3 10"/>
        <text x="${cx}" y="${cy-280}" text-anchor="middle" class="micro">N</text>
        <line x1="${p31.x}" y1="${p31.y}" x2="${p13.x}" y2="${p13.y}" stroke="#e7f4fa" stroke-width="34" stroke-linecap="round"/>
        <line x1="${p31.x}" y1="${p31.y}" x2="${p13.x}" y2="${p13.y}" stroke="#0c2332" stroke-width="24" stroke-linecap="round"/>
        <line x1="${p31.x}" y1="${p31.y}" x2="${p13.x}" y2="${p13.y}" stroke="#ffffff" stroke-width="2.8" stroke-dasharray="28 22" opacity=".9"/>
        <text x="${label13.x}" y="${label13.y}" text-anchor="middle" dominant-baseline="middle" class="runway-no ${preferred === '13' ? 'preferred' : ''}">13</text>
        <text x="${label31.x}" y="${label31.y}" text-anchor="middle" dominant-baseline="middle" class="runway-no ${preferred === '31' ? 'preferred' : ''}">31</text>
        ${windFrom && windTo ? `<line x1="${windFrom.x}" y1="${windFrom.y}" x2="${windTo.x}" y2="${windTo.y}" stroke="#67cdf4" stroke-width="9" stroke-linecap="round" marker-end="url(#arrow)"/>` : ''}
      </g>`;
  }

  function componentLabel(c) {
    if (!c) return '—';
    return `P ${Math.round(c.proa)} · T ${Math.round(c.atraves)} · C ${Math.round(c.cauda)}`;
  }

  function daylightArc(d) {
    const start = parseClock(d.sunrise, 5.5);
    const end = parseClock(d.sunset, 17.7);
    const now = parseClock(d.time, start);
    const progress = clamp((now - start) / Math.max(.1, end - start), 0, 1);
    const x1 = 128, x2 = 952, y = 1066, x = x1 + (x2 - x1) * progress;
    return `
      <text x="128" y="1022" class="section">LUZ DO DIA</text>
      <line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#224d65" stroke-width="5" stroke-linecap="round"/>
      <line x1="${x1}" y1="${y}" x2="${x}" y2="${y}" stroke="#69cdf4" stroke-width="5" stroke-linecap="round"/>
      <circle cx="${x1}" cy="${y}" r="8" fill="#f7c65b"/><circle cx="${x2}" cy="${y}" r="8" fill="#f7c65b"/>
      <circle cx="${x}" cy="${y}" r="11" fill="#fff" stroke="#69cdf4" stroke-width="5"/>
      <text x="${x1}" y="${y+37}" class="small">${esc(d.sunrise)} · NASCER</text>
      <text x="${x2}" y="${y+37}" text-anchor="end" class="small">${esc(d.sunset)} · PÔR</text>
      <text x="${x}" y="${y-22}" text-anchor="middle" class="micro bright">AGORA</text>`;
  }

  function hourStrip(d) {
    const xs = [128, 350, 572, 794];
    return d.hours.slice(0, 4).map((h, i) => {
      if (!h) return '';
      return `<g transform="translate(${xs[i]} 0)">
        <text x="0" y="1178" class="hour">${esc(h.time)}</text>
        <text x="0" y="1211" class="small">${fmt(h.wind,'',0)} · G${fmt(h.gust,'',0)}</text>
        <text x="0" y="1240" class="small">${fmt(h.precip,' mm',1)} · ${fmt(h.pop,'%',0)}</text>
      </g>`;
    }).join('');
  }

  async function dataUrl(src) {
    const response = await fetch(src, { cache: 'no-store' });
    if (!response.ok) throw new Error(`asset ${response.status}`);
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function buildSvg(d, logo, previous) {
    const delta = deltaText(d, previous);
    const vis = Number.isFinite(d.visibility) ? d.visibility : 10;
    const halo = clamp(340 + vis * 16, 380, 540);
    const rainAccent = (Number.isFinite(d.rain) && d.rain >= .3) || (Number.isFinite(d.rainPop) && d.rainPop >= 60);
    const c13 = componentLabel(d.runway.c13);
    const c31 = componentLabel(d.runway.c31);

    return `<?xml version="1.0" encoding="UTF-8"?>
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <defs>
        <radialGradient id="space" cx="50%" cy="46%" r="70%">
          <stop offset="0" stop-color="#0b3249"/>
          <stop offset=".48" stop-color="#071f31"/>
          <stop offset="1" stop-color="#020b12"/>
        </radialGradient>
        <linearGradient id="flow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#2e95c5" stop-opacity="0"/>
          <stop offset=".35" stop-color="#4ab8e8"/>
          <stop offset=".72" stop-color="#ffffff"/>
          <stop offset="1" stop-color="#6dd2f7" stop-opacity=".1"/>
        </linearGradient>
        <radialGradient id="halo" cx="50%" cy="50%" r="50%">
          <stop offset="0" stop-color="#61c9f2" stop-opacity=".18"/>
          <stop offset=".48" stop-color="#2b84ad" stop-opacity=".08"/>
          <stop offset="1" stop-color="#071725" stop-opacity="0"/>
        </radialGradient>
        <filter id="blur"><feGaussianBlur stdDeviation="22"/></filter>
        <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M0 0L10 5L0 10Z" fill="#67cdf4"/>
        </marker>
        <style>
          text{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif}
          .micro{fill:#8fb4c8;font-size:17px;font-weight:800;letter-spacing:2.4px}
          .micro.bright{fill:#bfeaff}
          .section{fill:#65c9f1;font-size:19px;font-weight:900;letter-spacing:2.8px}
          .big{fill:#fff;font-size:74px;font-weight:900;letter-spacing:-2px}
          .metric{fill:#fff;font-size:42px;font-weight:850}
          .metric-label{fill:#86aabd;font-size:16px;font-weight:700;letter-spacing:1.6px}
          .small{fill:#97b4c4;font-size:16px;font-weight:600}
          .hour{fill:#fff;font-size:25px;font-weight:850}
          .runway-no{fill:#8eafbf;font-size:31px;font-weight:900}
          .runway-no.preferred{fill:#fff;filter:url(#glow)}
        </style>
        <filter id="glow"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>

      <rect width="${W}" height="${H}" fill="url(#space)"/>
      <circle cx="540" cy="650" r="${halo}" fill="url(#halo)" filter="url(#blur)"/>
      ${fieldLines(d)}
      ${rainParticles(d)}

      <rect x="48" y="44" width="312" height="122" rx="26" fill="#fff" fill-opacity=".97"/>
      ${logo ? `<image href="${logo}" x="66" y="56" width="276" height="96" preserveAspectRatio="xMidYMid meet"/>` : ''}

      <text x="1018" y="67" text-anchor="end" class="micro">${esc(d.weekday)}</text>
      <text x="1018" y="97" text-anchor="end" fill="#fff" font-size="27" font-weight="900">${esc(d.date)}</text>
      <text x="1018" y="126" text-anchor="end" class="small">ATUALIZADO ${esc(d.time)}</text>

      <text x="48" y="244" class="micro bright">CIM // METEOROLOGIA EM MOVIMENTO</text>
      <text x="48" y="320" class="big">PULSE</text>
      <text x="48" y="356" class="small">Uma leitura visual do instante no campo.</text>

      <g transform="translate(48 405)">
        <text x="0" y="0" class="section">SINAL</text>
        <text x="0" y="58" class="metric">${fmt(d.wind,'',0)}</text><text x="0" y="84" class="metric-label">VENTO · KM/H</text>
        <text x="188" y="58" class="metric">${fmt(d.gust,'',0)}</text><text x="188" y="84" class="metric-label">RAJADA · KM/H</text>
        <text x="378" y="58" class="metric">${fmt(d.rain,'',1)}</text><text x="378" y="84" class="metric-label">CHUVA · MM</text>
        <text x="568" y="58" class="metric">${fmt(d.visibility,'',0)}</text><text x="568" y="84" class="metric-label">VIS · KM</text>
        <text x="758" y="58" class="metric">${fmt(d.temperature,'',0)}°</text><text x="758" y="84" class="metric-label">TEMPERATURA</text>
      </g>

      ${runwayGraphic(d)}

      <text x="92" y="612" class="section">PISTA 13/31</text>
      <text x="92" y="650" fill="#fff" font-size="24" font-weight="850">CABECEIRA ${esc(d.runway.preferred)}</text>
      <text x="92" y="682" class="small">maior componente de proa</text>
      <text x="92" y="747" class="micro">13 · ${esc(c13)}</text>
      <text x="92" y="782" class="micro">31 · ${esc(c31)}</text>
      <text x="92" y="845" class="small">${Number.isFinite(d.direction) ? `${Math.round(d.direction)}°` : '—'} · ${esc(text('#wind-direction-text').replace(/^Direção\s*/i,'') || 'direção')}</text>

      <g transform="translate(48 914)">
        <text x="0" y="0" class="section">DESDE A ÚLTIMA LEITURA</text>
        <text x="0" y="39" fill="#d8edf7" font-size="19" font-weight="700">${esc(delta)}</text>
      </g>

      ${daylightArc(d)}

      <text x="128" y="1142" class="section">PRÓXIMAS HORAS</text>
      ${hourStrip(d)}

      <line x1="48" y1="1286" x2="1032" y2="1286" stroke="#23485e" stroke-width="1"/>
      <text x="48" y="1318" class="small">MODELO · CIM (-3.845481, -38.460447)</text>
      <text x="48" y="1343" class="small">METAR SBFZ · observação regional${d.metarAge ? ` · ${esc(d.metarAge)}` : ''}</text>
      <text x="1032" y="1334" text-anchor="end" fill="#69cdf4" font-size="15" font-weight="850">${SITE}</text>
      ${rainAccent ? `<rect x="1012" y="405" width="12" height="82" rx="6" fill="#67cdf4"/><text x="990" y="451" text-anchor="end" class="micro bright">CHUVA PRESENTE</text>` : ''}
    </svg>`;
  }

  async function svgToPng(markup) {
    const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const image = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0, W, H);
      return await new Promise(resolve => canvas.toBlob(resolve, 'image/png', .96));
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function ensureUi() {
    if ($('#cim-pulse-overlay')) return;
    const style = document.createElement('style');
    style.textContent = `
      .cim-pulse-overlay{position:fixed;inset:0;background:rgba(1,8,13,.88);backdrop-filter:blur(18px);z-index:9999;display:none;align-items:center;justify-content:center;padding:24px}
      .cim-pulse-overlay.open{display:flex}
      .cim-pulse-shell{width:min(94vw,620px);max-height:94vh;display:flex;flex-direction:column;gap:14px}
      .cim-pulse-preview{background:#020b12;border:1px solid rgba(104,203,244,.28);border-radius:22px;overflow:auto;box-shadow:0 28px 90px rgba(0,0,0,.45)}
      .cim-pulse-preview img{display:block;width:100%;height:auto}
      .cim-pulse-actions{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}
      .cim-pulse-actions button{border:0;border-radius:999px;padding:12px 18px;font:700 14px system-ui;cursor:pointer}
      .cim-pulse-primary{background:#67cdf4;color:#02111b}
      .cim-pulse-secondary{background:#173042;color:#e8f5fb}
      @media(max-width:600px){.cim-pulse-overlay{padding:10px}.cim-pulse-shell{width:100%;max-height:98vh}.cim-pulse-actions{justify-content:stretch}.cim-pulse-actions button{flex:1}}
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'cim-pulse-overlay';
    overlay.className = 'cim-pulse-overlay';
    overlay.innerHTML = `
      <div class="cim-pulse-shell" role="dialog" aria-modal="true" aria-label="Prévia CIM Pulse">
        <div class="cim-pulse-preview"><img id="cim-pulse-preview-image" alt="CIM Pulse meteorológico"></div>
        <div class="cim-pulse-actions">
          <button type="button" id="cim-pulse-close" class="cim-pulse-secondary">Fechar</button>
          <button type="button" id="cim-pulse-save" class="cim-pulse-secondary">Salvar PNG</button>
          <button type="button" id="cim-pulse-share" class="cim-pulse-primary">Compartilhar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    $('#cim-pulse-close').addEventListener('click', () => overlay.classList.remove('open'));
    overlay.addEventListener('click', event => {
      if (event.target === overlay) overlay.classList.remove('open');
    });
  }

  async function showPulse() {
    const trigger = $('#today-cim-pulse');
    const old = trigger?.textContent || 'Gerar CIM Pulse';
    if (trigger) { trigger.disabled = true; trigger.textContent = 'Construindo Pulse…'; }
    try {
      const d = collect();
      if (!Number.isFinite(d.wind) || !Number.isFinite(d.direction) || !Number.isFinite(d.temperature)) {
        throw new Error('dados ainda não carregados');
      }
      const previous = loadSnapshot();
      const logo = await dataUrl(LOGO);
      const markup = buildSvg(d, logo, previous);
      const png = await svgToPng(markup);
      if (!png) throw new Error('PNG vazio');
      const url = URL.createObjectURL(png);
      const file = new File([png], `cim-pulse-${new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())}.png`, { type: 'image/png' });

      ensureUi();
      const overlay = $('#cim-pulse-overlay');
      const img = $('#cim-pulse-preview-image');
      const share = $('#cim-pulse-share');
      const save = $('#cim-pulse-save');
      img.src = url;
      overlay.classList.add('open');

      share.onclick = async () => {
        try {
          if (navigator.share && navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], title: 'CIM Pulse' });
          } else {
            const a = document.createElement('a');
            a.href = url; a.download = file.name; a.click();
          }
        } finally { saveSnapshot(d); }
      };
      save.onclick = () => {
        const a = document.createElement('a');
        a.href = url; a.download = file.name; a.click();
        saveSnapshot(d);
      };
    } catch (error) {
      console.error('[CIM Pulse]', error);
      alert('Não foi possível gerar o CIM Pulse agora. Aguarde os dados do painel e tente novamente.');
    } finally {
      if (trigger) { trigger.disabled = false; trigger.textContent = old; }
    }
  }

  function installButton() {
    const share = $('#today-cim-share');
    if (!share || $('#today-cim-pulse')) return;
    const button = document.createElement('button');
    button.id = 'today-cim-pulse';
    button.className = 'today-cim-share';
    button.type = 'button';
    button.textContent = 'Gerar CIM Pulse';
    button.setAttribute('aria-label', 'Gerar visual meteorológico CIM Pulse');
    share.insertAdjacentElement('afterend', button);
    button.addEventListener('click', showPulse);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installButton, { once: true });
  else installButton();
})();