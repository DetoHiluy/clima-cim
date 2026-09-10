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
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
  const fmt = (v, suffix = '', digits = 0) => Number.isFinite(v)
    ? `${v.toLocaleString('pt-BR', { maximumFractionDigits: digits })}${suffix}`
    : '—';

  function point(r, heading, cx = 540, cy = 650) {
    const q = heading * Math.PI / 180;
    return { x: cx + Math.sin(q) * r, y: cy - Math.cos(q) * r };
  }

  function windComponent(dir, speed, heading) {
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

  function compLabel(c) {
    if (!c) return '—';
    const long = c.proa >= c.cauda ? `PROA ${Math.round(c.proa)}` : `CAUDA ${Math.round(c.cauda)}`;
    return `${long} · TRAVÉS ${Math.round(c.atraves)}`;
  }

  function dateInfo() {
    const d = new Date();
    return {
      weekday: new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: TZ }).format(d).toUpperCase(),
      date: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ }).format(d).replace('.', '').toUpperCase(),
      time: new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }).format(d)
    };
  }

  function nextHours() {
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
    const wind = num(tx('#wind-speed'));
    const dir = num(tx('#wind-direction'));
    const gust = num(tx('#wind-gust'));
    const c13 = windComponent(dir, wind, RWY[13]);
    const c31 = windComponent(dir, wind, RWY[31]);
    const rawCondition = tx('#weather-description') || 'Condições meteorológicas no campo';
    return {
      ...dateInfo(),
      condition: rawCondition.length > 42 ? `${rawCondition.slice(0, 39)}…` : rawCondition,
      temp: num(tx('#temperature')),
      humidity: num(tx('#humidity')),
      pressure: num(tx('#pressure')),
      visibility: num(tx('#visibility')),
      rain: num(tx('#rain-probability')),
      rainPop: num(tx('#rain-total')),
      wind,
      dir,
      gust,
      spread: Number.isFinite(gust) && Number.isFinite(wind) ? Math.max(0, gust - wind) : 0,
      cardinal: tx('#wind-direction-text').replace(/^Direção\s*/i, '').trim(),
      sunrise: tx('#sunrise').replace(/^Nascer\s*/i, '') || '—',
      sunset: tx('#sunset') || '—',
      metarAge: tx('#metar-age'),
      c13,
      c31,
      hours: nextHours()
    };
  }

  function flow(d) {
    const angle = Number.isFinite(d.dir) ? d.dir + 90 : 180;
    const energy = clamp((Number.isFinite(d.wind) ? d.wind : 8) / 35, .25, 1);
    const turbulence = clamp(d.spread / 18, 0, 1);
    const lines = [-180, -120, -65, 0, 65, 120, 180].map((off, i) => {
      const bend = (i - 3) * 7 + turbulence * (i % 2 ? 22 : -18);
      const w = i === 3 ? 7 : 2 + energy * 2.4;
      const op = i === 3 ? .78 : .10 + energy * .16;
      return `<path d="M-360 ${650 + off} C120 ${630 + off + bend}, 760 ${670 + off - bend}, 1440 ${650 + off}" fill="none" stroke="url(#windFlow)" stroke-width="${w.toFixed(1)}" opacity="${op.toFixed(2)}" ${i === 3 ? 'marker-end="url(#flowArrow)"' : ''}/>`;
    }).join('');
    return `<g transform="rotate(${angle.toFixed(1)} 540 650)">
      <path d="M-360 650 C120 628,760 672,1440 650" fill="none" stroke="#48b9ea" stroke-width="44" opacity=".045"/>
      ${lines}
    </g>`;
  }

  function runway(d) {
    const half = 235;
    const p13 = point(half, RWY[31]);
    const p31 = point(half, RWY[13]);
    const l13 = point(half + 74, RWY[31]);
    const l31 = point(half + 74, RWY[13]);
    const a13 = point(half + 118, RWY[31]);
    const a31 = point(half + 118, RWY[13]);
    const centerA = point(95, RWY[31]);
    const centerB = point(95, RWY[13]);

    return `<g>
      <line x1="${p13.x}" y1="${p13.y}" x2="${p31.x}" y2="${p31.y}" stroke="#020b12" stroke-width="82" stroke-linecap="square" opacity=".52"/>
      <line x1="${p13.x}" y1="${p13.y}" x2="${p31.x}" y2="${p31.y}" stroke="#f7fbfd" stroke-width="58" stroke-linecap="square"/>
      <line x1="${p13.x}" y1="${p13.y}" x2="${p31.x}" y2="${p31.y}" stroke="#0b2535" stroke-width="46" stroke-linecap="square"/>
      <line x1="${centerA.x}" y1="${centerA.y}" x2="${centerB.x}" y2="${centerB.y}" stroke="#fff" stroke-width="4" stroke-dasharray="26 18"/>
      <text x="${l13.x}" y="${l13.y}" text-anchor="middle" dominant-baseline="middle" class="threshold">13</text>
      <text x="${l31.x}" y="${l31.y}" text-anchor="middle" dominant-baseline="middle" class="threshold">31</text>
      <text x="${a13.x}" y="${a13.y - 22}" text-anchor="middle" class="component-head">13</text>
      <text x="${a13.x}" y="${a13.y + 9}" text-anchor="middle" class="component-text">${esc(compLabel(d.c13))}</text>
      <text x="${a31.x}" y="${a31.y - 22}" text-anchor="middle" class="component-head">31</text>
      <text x="${a31.x}" y="${a31.y + 9}" text-anchor="middle" class="component-text">${esc(compLabel(d.c31))}</text>
    </g>`;
  }

  function daylight(d) {
    const toHour = (v, fallback) => {
      const m = String(v || '').match(/(\d{1,2}):(\d{2})/);
      return m ? Number(m[1]) + Number(m[2]) / 60 : fallback;
    };
    const rise = toHour(d.sunrise, 5.5);
    const set = toHour(d.sunset, 17.7);
    const now = toHour(d.time, rise);
    const x1 = 72;
    const x2 = 1008;
    const x = x1 + (x2 - x1) * clamp((now - rise) / Math.max(.1, set - rise), 0, 1);
    return `<g>
      <text x="48" y="1040" class="section">PERÍODO DIURNO</text>
      <line x1="${x1}" y1="1082" x2="${x2}" y2="1082" stroke="#24495d" stroke-width="5" stroke-linecap="round"/>
      <line x1="${x1}" y1="1082" x2="${x}" y2="1082" stroke="#62cdf7" stroke-width="5" stroke-linecap="round"/>
      <circle cx="${x1}" cy="1082" r="7" fill="#fff"/><circle cx="${x2}" cy="1082" r="7" fill="#fff"/>
      <circle cx="${x}" cy="1082" r="10" fill="#071a27" stroke="#62cdf7" stroke-width="5"/>
      <text x="${x1}" y="1113" class="tiny">${esc(d.sunrise)} NASCER</text>
      <text x="${x2}" y="1113" text-anchor="end" class="tiny">${esc(d.sunset)} PÔR DO SOL</text>
      <text x="${x}" y="1062" text-anchor="middle" class="now">AGORA</text>
    </g>`;
  }

  function trend(d) {
    if (!d.hours.length) return '<text x="48" y="1200" class="tiny">Tendência horária disponível no painel do CIM.</text>';
    const xs = [48, 298, 548, 798];
    return d.hours.slice(0, 4).map((h, i) => {
      const x = xs[i];
      return `<g transform="translate(${x} 0)">
        ${i ? '<line x1="-26" y1="1160" x2="-26" y2="1287" stroke="#21475b"/>' : ''}
        <text y="1175" class="hour">${esc(h.time)}</text>
        <text y="1227" class="hour-wind">${fmt(h.wind)}</text>
        <text x="74" y="1225" class="hour-unit">KM/H</text>
        <text y="1262" class="hour-detail">RAJ ${fmt(h.gust)} · CHUVA ${fmt(h.precip, ' mm', 1)}</text>
        <text y="1291" class="hour-detail">PROB. ${fmt(h.pop, '%')}</text>
      </g>`;
    }).join('');
  }

  function svg(d, logo) {
    const dir = Number.isFinite(d.dir) ? `${Math.round(d.dir)}°` : '—';
    const wind = fmt(d.wind);
    const gust = fmt(d.gust);
    const metar = d.metarAge && !/consult|aguard/i.test(d.metarAge) ? ` · ${esc(d.metarAge)}` : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#071f30"/><stop offset=".52" stop-color="#061621"/><stop offset="1" stop-color="#02080d"/></linearGradient>
        <linearGradient id="windFlow" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2d9dce" stop-opacity="0"/><stop offset=".22" stop-color="#43b5e6"/><stop offset=".58" stop-color="#fff"/><stop offset=".82" stop-color="#66d4ff"/><stop offset="1" stop-color="#66d4ff" stop-opacity="0"/></linearGradient>
        <radialGradient id="glow"><stop offset="0" stop-color="#48b9ea" stop-opacity=".16"/><stop offset="1" stop-color="#48b9ea" stop-opacity="0"/></radialGradient>
        <marker id="flowArrow" markerWidth="13" markerHeight="13" refX="10" refY="6.5" orient="auto"><path d="M0 0L13 6.5L0 13Z" fill="#dff7ff"/></marker>
        <style>
          text{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif}
          .kicker{fill:#65cff7;font-size:21px;font-weight:900;letter-spacing:3.1px}.condition{fill:#fff;font-size:43px;font-weight:900;letter-spacing:-1.1px}.meta{fill:#89afc1;font-size:20px;font-weight:700}.date{fill:#fff;font-size:28px;font-weight:900}.wind-main{fill:#fff;font-size:124px;font-weight:950;letter-spacing:-6px}.wind-unit{fill:#7fa8bb;font-size:27px;font-weight:900;letter-spacing:1px}.wind-meta{fill:#cbeaf7;font-size:28px;font-weight:800}.wind-gust{fill:#68cff7;font-size:22px;font-weight:900;letter-spacing:1.4px}.threshold{fill:#fff;font-size:70px;font-weight:950;letter-spacing:-2px}.component-head{fill:#65cff7;font-size:22px;font-weight:950}.component-text{fill:#c9e5f0;font-size:18px;font-weight:800;letter-spacing:.3px}.metric-value{fill:#fff;font-size:45px;font-weight:950;letter-spacing:-1.5px}.metric-label{fill:#789fb2;font-size:17px;font-weight:850;letter-spacing:1.4px}.section{fill:#65cff7;font-size:19px;font-weight:950;letter-spacing:2.9px}.tiny{fill:#7fa6b9;font-size:17px;font-weight:750}.now{fill:#dff7ff;font-size:15px;font-weight:950;letter-spacing:1.5px}.hour{fill:#65cff7;font-size:21px;font-weight:950;letter-spacing:1.5px}.hour-wind{fill:#fff;font-size:45px;font-weight:950;letter-spacing:-1.6px}.hour-unit{fill:#7fa8bb;font-size:16px;font-weight:900}.hour-detail{fill:#91b2c1;font-size:16px;font-weight:750}
        </style>
      </defs>

      <rect width="1080" height="1350" fill="url(#bg)"/>
      <circle cx="540" cy="650" r="470" fill="url(#glow)"/>

      <rect x="48" y="38" width="300" height="118" rx="24" fill="#fff"/>
      <image href="${logo}" x="64" y="49" width="268" height="96" preserveAspectRatio="xMidYMid meet"/>
      <text x="1032" y="62" text-anchor="end" class="kicker">${esc(d.weekday)}</text>
      <text x="1032" y="101" text-anchor="end" class="date">${esc(d.date)}</text>
      <text x="1032" y="137" text-anchor="end" class="meta">ATUALIZADO ${esc(d.time)}</text>

      <text x="48" y="222" class="kicker">CONDIÇÕES AGORA</text>
      <text x="48" y="276" class="condition">${esc(d.condition)}</text>
      <text x="48" y="310" class="meta">CIM · EUSÉBIO · PISTA 13/31 · 230 × 12 M</text>

      <text x="48" y="420" class="wind-main">${wind}</text>
      <text x="238" y="397" class="wind-unit">KM/H</text>
      <text x="238" y="432" class="wind-meta">${dir} · ${esc(d.cardinal || 'DIREÇÃO DO VENTO')}</text>
      <text x="48" y="466" class="wind-gust">RAJADA ${gust} KM/H</text>

      ${flow(d)}
      ${runway(d)}

      <line x1="48" y1="900" x2="1032" y2="900" stroke="#234b60"/>
      <g transform="translate(48 0)"><text y="952" class="metric-value">${fmt(d.temp, '°')}</text><text y="981" class="metric-label">TEMPERATURA</text></g>
      <line x1="294" y1="921" x2="294" y2="986" stroke="#234b60"/>
      <g transform="translate(330 0)"><text y="952" class="metric-value">${fmt(d.rain, '', 1)}</text><text y="981" class="metric-label">CHUVA · MM</text></g>
      <line x1="548" y1="921" x2="548" y2="986" stroke="#234b60"/>
      <g transform="translate(584 0)"><text y="952" class="metric-value">${fmt(d.rainPop, '%')}</text><text y="981" class="metric-label">PRÓXIMA HORA</text></g>
      <line x1="796" y1="921" x2="796" y2="986" stroke="#234b60"/>
      <g transform="translate(832 0)"><text y="952" class="metric-value">${fmt(d.visibility)}</text><text y="981" class="metric-label">VISIBILIDADE · KM</text></g>

      ${daylight(d)}
      <text x="48" y="1145" class="section">PRÓXIMAS HORAS</text>
      ${trend(d)}

      <line x1="48" y1="1316" x2="1032" y2="1316" stroke="#1d4052"/>
      <text x="48" y="1341" class="tiny">MODELO NAS COORDENADAS DO CIM · METAR SBFZ É REFERÊNCIA REGIONAL${metar}</text>
      <text x="1032" y="1341" text-anchor="end" fill="#65cff7" font-size="16" font-weight="900">${SITE}</text>
    </svg>`;
  }

  async function dataUrl(src) {
    const res = await fetch(src, { cache: 'no-store' });
    if (!res.ok) throw new Error(`asset ${res.status}`);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function toPng(markup) {
    const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      canvas.getContext('2d').drawImage(img, 0, 0, W, H);
      return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', .96));
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function ensureUi() {
    if ($('#cim-briefing-overlay')) return;
    const style = document.createElement('style');
    style.textContent = '.cim-briefing-overlay{position:fixed;inset:0;background:rgba(1,7,11,.94);backdrop-filter:blur(18px);z-index:9999;display:none;align-items:center;justify-content:center;padding:20px}.cim-briefing-overlay.open{display:flex}.cim-briefing-shell{width:min(94vw,620px);max-height:95vh;display:flex;flex-direction:column;gap:14px}.cim-briefing-preview{background:#020b12;border:1px solid rgba(101,207,247,.28);border-radius:22px;overflow:auto;box-shadow:0 28px 90px rgba(0,0,0,.5)}.cim-briefing-preview img{display:block;width:100%;height:auto}.cim-briefing-actions{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}.cim-briefing-actions button{border:0;border-radius:999px;padding:12px 18px;font:700 14px system-ui;cursor:pointer}.cim-briefing-primary{background:#65cff7;color:#02111b}.cim-briefing-secondary{background:#173042;color:#e8f5fb}@media(max-width:600px){.cim-briefing-overlay{padding:10px}.cim-briefing-shell{width:100%;max-height:98vh}.cim-briefing-actions{justify-content:stretch}.cim-briefing-actions button{flex:1}}';
    document.head.appendChild(style);
    const overlay = document.createElement('div');
    overlay.id = 'cim-briefing-overlay';
    overlay.className = 'cim-briefing-overlay';
    overlay.innerHTML = '<div class="cim-briefing-shell" role="dialog" aria-modal="true" aria-label="Prévia do briefing visual do CIM"><div class="cim-briefing-preview"><img id="cim-briefing-preview-image" alt="Condições meteorológicas atuais do CIM"></div><div class="cim-briefing-actions"><button id="cim-briefing-close" class="cim-briefing-secondary">Fechar</button><button id="cim-briefing-save" class="cim-briefing-secondary">Salvar PNG</button><button id="cim-briefing-share" class="cim-briefing-primary">Compartilhar</button></div></div>';
    document.body.appendChild(overlay);
    $('#cim-briefing-close').onclick = () => overlay.classList.remove('open');
    overlay.onclick = (e) => { if (e.target === overlay) overlay.classList.remove('open'); };
  }

  async function show() {
    const button = $('#today-cim-briefing-visual');
    const old = button?.textContent || 'Gerar briefing visual';
    if (button) { button.disabled = true; button.textContent = 'Gerando briefing…'; }
    try {
      const d = collect();
      if (!Number.isFinite(d.wind) || !Number.isFinite(d.dir) || !Number.isFinite(d.temp)) throw new Error('dados ainda não carregados');
      const markup = svg(d, await dataUrl(LOGO));
      const blob = await toPng(markup);
      if (!blob) throw new Error('PNG vazio');
      if (activeUrl) URL.revokeObjectURL(activeUrl);
      activeUrl = URL.createObjectURL(blob);
      const file = new File([blob], `cim-condicoes-${new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())}.png`, { type: 'image/png' });
      ensureUi();
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
      if (button) { button.disabled = false; button.textContent = old; }
    }
  }

  function install() {
    const share = $('#today-cim-share');
    if (!share || $('#today-cim-briefing-visual')) return;
    const button = document.createElement('button');
    button.id = 'today-cim-briefing-visual';
    button.className = 'today-cim-share';
    button.type = 'button';
    button.textContent = 'Gerar briefing visual';
    button.setAttribute('aria-label', 'Gerar briefing visual meteorológico do CIM');
    share.insertAdjacentElement('afterend', button);
    button.onclick = show;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();