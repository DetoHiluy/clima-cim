(() => {
  'use strict';

  const W = 1080;
  const H = 1350;
  const TZ = 'America/Fortaleza';
  const LOGO = 'assets/cim-logo-oficial.webp?v=20260910-1';
  const SITE = 'detohiluy.github.io/clima-cim';
  const RWY = { 13: 109.8, 31: 289.8 };
  let activeUrl = '';

  const $ = (s) => document.querySelector(s);
  const tx = (s) => $(s)?.textContent?.trim() || '';
  const num = (v) => {
    const m = String(v ?? '').replace(',', '.').match(/-?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : NaN;
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = (s) => String(s ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&apos;');
  const fmt = (v, u = '', d = 0) => Number.isFinite(v)
    ? `${v.toLocaleString('pt-BR', { maximumFractionDigits: d })}${u}` : '—';
  const short = (s, max = 40) => {
    const t = String(s || '').trim();
    return t.length > max ? `${t.slice(0, max - 1).trim()}…` : t;
  };

  function dateInfo() {
    const d = new Date();
    return {
      weekday: new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: TZ }).format(d).toUpperCase(),
      date: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ }).format(d).replace('.', '').toUpperCase(),
      time: new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }).format(d)
    };
  }

  function point(r, heading, cx = 608, cy = 615) {
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

  function components(dir, speed) {
    return {
      c13: comp(dir, speed, RWY[13]),
      c31: comp(dir, speed, RWY[31])
    };
  }

  function clock(v, fallback = 0) {
    const m = String(v || '').match(/(\d{1,2}):(\d{2})/);
    return m ? +m[1] + (+m[2] / 60) : fallback;
  }

  function hourly() {
    try {
      if (typeof briefingState === 'undefined' || !briefingState.lastData || typeof briefingBuildHours !== 'function') return [];
      return briefingBuildHours(briefingState.lastData, 0, new Date()).hours.slice(0, 4).map((h) => ({
        time: typeof briefingHour === 'function' ? briefingHour(h.time) : '—',
        wind: +h.windSpeed || 0,
        gust: +h.gust || 0,
        pop: +h.pop || 0,
        precip: +h.precip || 0
      }));
    } catch (_) { return []; }
  }

  function collect() {
    const wind = num(tx('#wind-speed'));
    const dir = num(tx('#wind-direction'));
    const gust = num(tx('#wind-gust'));
    const rain = num(tx('#rain-probability'));
    const rainMeta = tx('#rain-total');
    return {
      ...dateInfo(),
      condition: short(tx('#weather-description') || 'Condições meteorológicas no campo', 42),
      wind,
      dir,
      gust,
      rain,
      rainPop: num(rainMeta),
      vis: num(tx('#visibility')),
      temp: num(tx('#temperature')),
      humidity: num(tx('#humidity')),
      pressure: num(tx('#pressure')),
      sunrise: tx('#sunrise').replace(/^Nascer\s*/i, '') || '—',
      sunset: tx('#sunset') || '—',
      cardinal: tx('#wind-direction-text').replace(/^Direção\s*/i, '').replace(/\s*·.*$/, '').trim(),
      comps: components(dir, wind),
      hours: hourly(),
      metarAge: tx('#metar-age')
    };
  }

  function flowField(d) {
    const dir = Number.isFinite(d.dir) ? d.dir : 90;
    const count = Math.round(clamp(12 + (d.wind || 0) * .28 + Math.max(0, (d.gust || 0) - (d.wind || 0)) * .18, 12, 24));
    const lines = [];
    for (let i = 0; i < count; i++) {
      const y = 360 + i * (520 / Math.max(1, count - 1));
      const offset = Math.sin(i * 1.37) * (12 + Math.max(0, (d.gust || 0) - (d.wind || 0)) * .8);
      lines.push(`<path d="M-120 ${y} C220 ${y + offset}, 690 ${y - offset}, 1200 ${y}" fill="none" stroke="url(#air)" stroke-width="${i % 4 === 0 ? 2.8 : 1.3}" opacity="${i % 3 === 0 ? .24 : .12}"/>`);
    }
    return `<g transform="rotate(${(dir + 90) % 360} 608 615)">${lines.join('')}</g>`;
  }

  function rainTexture(d) {
    const mm = Number.isFinite(d.rain) ? d.rain : 0;
    const pop = Number.isFinite(d.rainPop) ? d.rainPop : 0;
    if (mm < .15 && pop < 45) return '';
    const opacity = clamp(.12 + mm * .04 + pop / 900, .12, .34);
    const drops = [];
    for (let i = 0; i < 22; i++) {
      const x = 70 + ((i * 197) % 930);
      const y = 330 + ((i * 113) % 560);
      drops.push(`<line x1="${x}" y1="${y}" x2="${x + 13}" y2="${y + 34}" stroke="#7fdcff" stroke-width="2" opacity="${opacity}"/>`);
    }
    return `<g>${drops.join('')}</g>`;
  }

  function compLabel(c) {
    if (!c) return '—';
    const along = c.proa >= c.cauda ? `PROA ${Math.round(c.proa)}` : `CAUDA ${Math.round(c.cauda)}`;
    return `${along} · TRAVÉS ${Math.round(c.atraves)}`;
  }

  function runwayGraphic(d) {
    const cx = 608, cy = 615, half = 214;
    const p13 = point(half, RWY[31], cx, cy);
    const p31 = point(half, RWY[13], cx, cy);
    const l13 = point(half + 62, RWY[31], cx, cy);
    const l31 = point(half + 62, RWY[13], cx, cy);
    const windFrom = Number.isFinite(d.dir) ? point(330, d.dir, cx, cy) : null;
    const windTo = Number.isFinite(d.dir) ? point(210, (d.dir + 180) % 360, cx, cy) : null;
    return `<g>
      <circle cx="${cx}" cy="${cy}" r="320" fill="#061722" fill-opacity=".68" stroke="#2d607a" stroke-width="1.4"/>
      <circle cx="${cx}" cy="${cy}" r="275" fill="none" stroke="#376b84" stroke-width="1" opacity=".28"/>
      <line x1="${cx}" y1="${cy - 304}" x2="${cx}" y2="${cy - 322}" stroke="#6f9fb6"/><text x="${cx}" y="${cy - 338}" text-anchor="middle" class="cardinal">N</text>
      <line x1="${cx + 304}" y1="${cy}" x2="${cx + 322}" y2="${cy}" stroke="#6f9fb6"/><text x="${cx + 344}" y="${cy + 7}" text-anchor="middle" class="cardinal">L</text>
      <line x1="${cx}" y1="${cy + 304}" x2="${cx}" y2="${cy + 322}" stroke="#6f9fb6"/><text x="${cx}" y="${cy + 350}" text-anchor="middle" class="cardinal">S</text>
      <line x1="${cx - 304}" y1="${cy}" x2="${cx - 322}" y2="${cy}" stroke="#6f9fb6"/><text x="${cx - 345}" y="${cy + 7}" text-anchor="middle" class="cardinal">O</text>
      ${windFrom && windTo ? `<line x1="${windFrom.x}" y1="${windFrom.y}" x2="${windTo.x}" y2="${windTo.y}" stroke="#7bdcff" stroke-width="10" stroke-linecap="round" marker-end="url(#arrow)" filter="url(#glow)"/>` : ''}
      <line x1="${p31.x}" y1="${p31.y}" x2="${p13.x}" y2="${p13.y}" stroke="#eff6fa" stroke-width="48" stroke-linecap="round"/>
      <line x1="${p31.x}" y1="${p31.y}" x2="${p13.x}" y2="${p13.y}" stroke="#0e2634" stroke-width="35" stroke-linecap="round"/>
      <line x1="${p31.x}" y1="${p31.y}" x2="${p13.x}" y2="${p13.y}" stroke="#fff" stroke-width="3.2" stroke-dasharray="25 19" opacity=".96"/>
      <text x="${l13.x}" y="${l13.y}" text-anchor="middle" dominant-baseline="middle" class="runway-number">13</text>
      <text x="${l31.x}" y="${l31.y}" text-anchor="middle" dominant-baseline="middle" class="runway-number">31</text>
    </g>`;
  }

  function daylight(d) {
    const a = clock(d.sunrise, 5.5);
    const b = clock(d.sunset, 17.7);
    const now = clock(d.time, a);
    const x1 = 72, x2 = 1008, y = 1045;
    const x = x1 + (x2 - x1) * clamp((now - a) / Math.max(.1, b - a), 0, 1);
    return `<g>
      <text x="48" y="1000" class="section">PERÍODO DIURNO</text>
      <line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#284f63" stroke-width="5" stroke-linecap="round"/>
      <line x1="${x1}" y1="${y}" x2="${x}" y2="${y}" stroke="#7bdcff" stroke-width="5" stroke-linecap="round"/>
      <circle cx="${x1}" cy="${y}" r="7" fill="#f5c75b"/><circle cx="${x2}" cy="${y}" r="7" fill="#f5c75b"/>
      <circle cx="${x}" cy="${y}" r="10" fill="#fff" stroke="#7bdcff" stroke-width="4"/>
      <text x="${x1}" y="${y + 34}" class="tiny">${esc(d.sunrise)} NASCER</text>
      <text x="${x2}" y="${y + 34}" text-anchor="end" class="tiny">${esc(d.sunset)} PÔR DO SOL</text>
    </g>`;
  }

  function trend(d) {
    if (!d.hours.length) return `<text x="48" y="1178" class="small">Tendência horária ainda não disponível.</text>`;
    const xs = [48, 300, 552, 804];
    return d.hours.slice(0, 4).map((h, i) => `<g transform="translate(${xs[i]} 0)">
      <text y="1160" class="hour">${esc(h.time)}</text>
      <text y="1206" class="trend-value">${fmt(h.wind)}</text>
      <text x="66" y="1206" class="trend-unit">km/h</text>
      <text y="1240" class="tiny">RAJ ${fmt(h.gust)} · CHUVA ${fmt(h.precip, ' mm', 1)}</text>
      <text y="1270" class="tiny">PROB. ${fmt(h.pop, '%')}</text>
    </g>`).join('');
  }

  function svg(d, logo) {
    const dir = Number.isFinite(d.dir) ? `${Math.round(d.dir)}°` : '—';
    const metarAge = d.metarAge && !/consult|aguard/i.test(d.metarAge) ? ` · ${esc(d.metarAge)}` : '';
    const rainLabel = Number.isFinite(d.rain) && d.rain > .05 ? 'CHUVA AGORA' : 'PRECIPITAÇÃO';
    return `<?xml version="1.0" encoding="UTF-8"?>
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#07151f"/><stop offset=".52" stop-color="#0b2637"/><stop offset="1" stop-color="#02080d"/></linearGradient>
        <linearGradient id="air" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#65cdf4" stop-opacity="0"/><stop offset=".45" stop-color="#65cdf4"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
        <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#7bdcff"/></marker>
        <filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <style>
          text{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif}
          .eyebrow{fill:#72d2f7;font-size:20px;font-weight:900;letter-spacing:3px}.headline{fill:#fff;font-size:44px;font-weight:900;letter-spacing:-1px}.sub{fill:#a5c2d0;font-size:23px;font-weight:650}.section{fill:#72d2f7;font-size:20px;font-weight:900;letter-spacing:2.8px}.wind{fill:#fff;font-size:96px;font-weight:950;letter-spacing:-4px}.wind-unit{fill:#9ab7c7;font-size:24px;font-weight:800}.wind-meta{fill:#d9edf6;font-size:27px;font-weight:800}.metric{fill:#fff;font-size:48px;font-weight:920}.metric-label{fill:#8eaebe;font-size:17px;font-weight:800;letter-spacing:1.6px}.tiny{fill:#91afbe;font-size:18px;font-weight:650}.small{fill:#a3bfcc;font-size:22px;font-weight:650}.cardinal{fill:#7196aa;font-size:18px;font-weight:900}.runway-number{fill:#fff;font-size:38px;font-weight:950}.component-num{fill:#72d2f7;font-size:28px;font-weight:950}.component-text{fill:#dceef6;font-size:22px;font-weight:800}.hour{fill:#72d2f7;font-size:22px;font-weight:900;letter-spacing:1.5px}.trend-value{fill:#fff;font-size:42px;font-weight:930}.trend-unit{fill:#91afbe;font-size:17px;font-weight:800}
        </style>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#bg)"/>
      <circle cx="608" cy="615" r="420" fill="#0a3449" opacity=".22"/>
      ${flowField(d)}${rainTexture(d)}

      <rect x="48" y="38" width="312" height="122" rx="25" fill="#fff"/>
      <image href="${logo}" x="66" y="50" width="276" height="98" preserveAspectRatio="xMidYMid meet"/>
      <text x="1032" y="66" text-anchor="end" class="eyebrow">${esc(d.weekday)}</text>
      <text x="1032" y="104" text-anchor="end" fill="#fff" font-size="30" font-weight="900">${esc(d.date)}</text>
      <text x="1032" y="138" text-anchor="end" class="sub">${esc(d.time)}</text>

      <text x="48" y="225" class="eyebrow">CIM // CONDIÇÕES AGORA</text>
      <text x="48" y="280" class="headline">${esc(d.condition)}</text>
      <text x="48" y="318" class="sub">EUSÉBIO · PISTA 13/31 · 230 × 12 m</text>

      <g transform="translate(48 388)">
        <text class="section">VENTO</text>
        <text y="93" class="wind">${fmt(d.wind)}</text>
        <text x="178" y="88" class="wind-unit">KM/H</text>
        <text y="138" class="wind-meta">${dir} · ${esc(d.cardinal || 'DIREÇÃO')}</text>
        <text y="178" class="small">RAJADA ${fmt(d.gust)} KM/H</text>
      </g>

      ${runwayGraphic(d)}

      <g transform="translate(48 786)">
        <text class="component-num">13</text><text x="54" class="component-text">${esc(compLabel(d.comps.c13))} KM/H</text>
        <text y="42" class="component-num">31</text><text x="54" y="42" class="component-text">${esc(compLabel(d.comps.c31))} KM/H</text>
      </g>

      <line x1="48" y1="865" x2="1032" y2="865" stroke="#2b566c"/>
      <g transform="translate(48 902)"><text class="metric">${fmt(d.temp, '°')}</text><text y="31" class="metric-label">TEMPERATURA</text></g>
      <g transform="translate(300 902)"><text class="metric">${fmt(d.rain, '', 1)}</text><text y="31" class="metric-label">${rainLabel} · MM</text></g>
      <g transform="translate(552 902)"><text class="metric">${fmt(d.rainPop, '%')}</text><text y="31" class="metric-label">PRÓXIMA HORA</text></g>
      <g transform="translate(804 902)"><text class="metric">${fmt(d.vis)}</text><text y="31" class="metric-label">VISIBILIDADE · KM</text></g>

      ${daylight(d)}
      <text x="48" y="1120" class="section">PRÓXIMAS HORAS</text>
      ${trend(d)}

      <line x1="48" y1="1310" x2="1032" y2="1310" stroke="#23485e"/>
      <text x="48" y="1338" fill="#7f9faf" font-size="15" font-weight="700">MODELO · COORDENADAS DO CIM  |  METAR SBFZ · REFERÊNCIA REGIONAL${metarAge}</text>
      <text x="1032" y="1338" text-anchor="end" fill="#72d2f7" font-size="15" font-weight="850">${SITE}</text>
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
      c.width = W; c.height = H;
      c.getContext('2d').drawImage(img, 0, 0, W, H);
      return await new Promise((ok) => c.toBlob(ok, 'image/png', .96));
    } finally { URL.revokeObjectURL(u); }
  }

  function ui() {
    if ($('#cim-briefing-overlay')) return;
    const style = document.createElement('style');
    style.textContent = '.cim-briefing-overlay{position:fixed;inset:0;background:rgba(1,8,13,.92);backdrop-filter:blur(18px);z-index:9999;display:none;align-items:center;justify-content:center;padding:24px}.cim-briefing-overlay.open{display:flex}.cim-briefing-shell{width:min(94vw,620px);max-height:94vh;display:flex;flex-direction:column;gap:14px}.cim-briefing-preview{background:#020b12;border:1px solid rgba(104,203,244,.28);border-radius:22px;overflow:auto;box-shadow:0 28px 90px rgba(0,0,0,.45)}.cim-briefing-preview img{display:block;width:100%;height:auto}.cim-briefing-actions{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}.cim-briefing-actions button{border:0;border-radius:999px;padding:12px 18px;font:700 14px system-ui;cursor:pointer}.cim-briefing-primary{background:#67cdf4;color:#02111b}.cim-briefing-secondary{background:#173042;color:#e8f5fb}@media(max-width:600px){.cim-briefing-overlay{padding:10px}.cim-briefing-shell{width:100%;max-height:98vh}.cim-briefing-actions{justify-content:stretch}.cim-briefing-actions button{flex:1}}';
    document.head.appendChild(style);
    const o = document.createElement('div');
    o.id = 'cim-briefing-overlay';
    o.className = 'cim-briefing-overlay';
    o.innerHTML = '<div class="cim-briefing-shell" role="dialog" aria-modal="true" aria-label="Prévia do briefing visual do CIM"><div class="cim-briefing-preview"><img id="cim-briefing-preview-image" alt="Condições meteorológicas visuais do CIM"></div><div class="cim-briefing-actions"><button id="cim-briefing-close" class="cim-briefing-secondary">Fechar</button><button id="cim-briefing-save" class="cim-briefing-secondary">Salvar PNG</button><button id="cim-briefing-share" class="cim-briefing-primary">Compartilhar</button></div></div>';
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
      if (!Number.isFinite(d.wind) || !Number.isFinite(d.dir) || !Number.isFinite(d.temp)) throw new Error('dados ainda não carregados');
      const mark = svg(d, await dataUrl(LOGO));
      const blob = await png(mark);
      if (!blob) throw new Error('PNG vazio');
      if (activeUrl) URL.revokeObjectURL(activeUrl);
      activeUrl = URL.createObjectURL(blob);
      const file = new File([blob], `cim-condicoes-${new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())}.png`, { type: 'image/png' });
      ui();
      $('#cim-briefing-preview-image').src = activeUrl;
      $('#cim-briefing-overlay').classList.add('open');
      $('#cim-briefing-share').onclick = async () => {
        if (navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Condições agora · CIM' });
        else { const a = document.createElement('a'); a.href = activeUrl; a.download = file.name; a.click(); }
      };
      $('#cim-briefing-save').onclick = () => { const a = document.createElement('a'); a.href = activeUrl; a.download = file.name; a.click(); };
    } catch (e) {
      console.error('[Briefing visual CIM]', e);
      alert('Não foi possível gerar o briefing visual agora. Aguarde os dados do painel e tente novamente.');
    } finally { if (b) { b.disabled = false; b.textContent = old; } }
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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();