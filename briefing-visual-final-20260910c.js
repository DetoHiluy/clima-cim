(() => {
  'use strict';

  const W = 1080;
  const H = 1480;
  const TZ = 'America/Fortaleza';
  const LOGO = 'assets/cim-logo-oficial.webp?v=20260910-1';
  const PHOTO = 'assets/cim-briefing-hero-clean.webp?v=20260910-clean2';
  const CIM = { lat: -3.845481, lon: -38.460447 };
  let activeUrl = '';

  const LAYOUT = Object.freeze({
    hero: { x: 0, y: 0, w: 1080, h: 760 },
    leftMask: { x: 0, y: 0, w: 610, h: 760 },
    date: { x: 650, y: 38, w: 380, h: 142, textX: 728, textW: 276 },
    metrics: { x: 34, y: 796, w: 1012, h: 126 },
    daylight: { x: 34, y: 934, w: 1012, h: 108 },
    forecast: { x: 34, y: 1055, w: 1012, h: 360 },
    forecastGrid: { x: 62, y1: 1138, y2: 1268, colW: 160, cellW: 144, cellH: 104 },
    footerY: 1450
  });

  function validateLayout() {
    const { hero, leftMask, date, metrics, daylight, forecast, forecastGrid: g, footerY } = LAYOUT;
    const fail = (m) => { throw new Error(`[Briefing CIM] layout inválido: ${m}`); };
    if (hero.y !== 0 || hero.x !== 0 || hero.w !== W || hero.h > 760) fail('recorte do hero fora do limite seguro');
    if (leftMask.w < 600 || leftMask.h < hero.h) fail('máscara esquerda insuficiente para contraste do texto');
    if (date.x < 630 || date.x + date.w > W - 40 || date.y < 20 || date.y + date.h > 200) fail('caixa de data fora da área segura');
    if (date.textX + date.textW > date.x + date.w - 20) fail('texto da data ultrapassa a margem interna');
    if (metrics.y + metrics.h >= daylight.y) fail('métricas invadem período diurno');
    if (daylight.y + daylight.h >= forecast.y) fail('período diurno invade previsão');
    if (g.y1 + g.cellH + 18 >= g.y2) fail('linhas da previsão se sobrepõem');
    if (g.y2 + g.cellH > forecast.y + forecast.h - 16) fail('segunda linha sai do quadro');
    if (g.x + 5 * g.colW + g.cellW > forecast.x + forecast.w - 18) fail('sexta coluna sai do quadro');
    if (forecast.y + forecast.h >= footerY) fail('previsão invade rodapé');
  }
  validateLayout();

  const $ = (s) => document.querySelector(s);
  const text = (s) => $(s)?.textContent?.trim() || '';
  const number = (v) => {
    const m = String(v ?? '').replace(',', '.').match(/-?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : NaN;
  };
  const esc = (v) => String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
  const fmt = (v, suffix = '', digits = 0) => Number.isFinite(v)
    ? `${v.toLocaleString('pt-BR', { maximumFractionDigits: digits })}${suffix}`
    : '—';
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  function fitTextPx(value, maxWidth, baseSize, minSize, weight = 800) {
    if (!measureCtx) return minSize;
    const family = "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif";
    let size = baseSize;
    while (size > minSize) {
      measureCtx.font = `${weight} ${size}px ${family}`;
      if (measureCtx.measureText(String(value || '')).width <= maxWidth) break;
      size -= 0.5;
    }
    return Math.max(minSize, size);
  }

  function cardinal(deg) {
    if (!Number.isFinite(deg)) return '—';
    const names = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO'];
    return names[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
  }

  function dateInfo() {
    const now = new Date();
    const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: TZ }).format(now).toUpperCase();
    const parts = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: TZ }).formatToParts(now);
    const day = parts.find((p) => p.type === 'day')?.value || '';
    const month = (parts.find((p) => p.type === 'month')?.value || '').toUpperCase();
    const year = parts.find((p) => p.type === 'year')?.value || '';
    const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }).format(now);
    return { weekday, date: `${day} DE ${month} DE ${year}`, time };
  }

  function localHourLabel(iso) {
    const m = String(iso || '').match(/T(\d{2}):(\d{2})/);
    if (!m) return '—';
    return m[2] === '00' ? `${m[1]}h` : `${m[1]}:${m[2]}`;
  }

  function shortTime(iso) {
    const m = String(iso || '').match(/T(\d{2}):(\d{2})/);
    return m ? `${m[1]}:${m[2]}` : '—';
  }

  async function fetchDaylightForecast() {
    const params = new URLSearchParams({
      latitude: String(CIM.lat),
      longitude: String(CIM.lon),
      timezone: TZ,
      forecast_days: '1',
      hourly: ['temperature_2m','wind_speed_10m','wind_gusts_10m','precipitation_probability','precipitation'].join(','),
      daily: ['sunrise','sunset'].join(','),
      wind_speed_unit: 'kmh',
      precipitation_unit: 'mm'
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}&_=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Open-Meteo ${response.status}`);
    const data = await response.json();
    const sunrise = data.daily?.sunrise?.[0];
    const sunset = data.daily?.sunset?.[0];
    const h = data.hourly || {};
    const hours = [];
    for (let i = 0; i < (h.time?.length || 0); i++) {
      const t = h.time[i];
      if (!sunrise || !sunset || t < sunrise || t >= sunset) continue;
      hours.push({
        time: localHourLabel(t),
        temp: Number(h.temperature_2m?.[i]),
        wind: Number(h.wind_speed_10m?.[i]),
        gust: Number(h.wind_gusts_10m?.[i]),
        pop: Number(h.precipitation_probability?.[i]),
        precip: Number(h.precipitation?.[i])
      });
    }
    return { sunrise: shortTime(sunrise), sunset: shortTime(sunset), hours: hours.slice(0, 12) };
  }

  async function collect() {
    const forecast = await fetchDaylightForecast();
    const dir = number(text('#wind-direction'));
    const raw = text('#weather-description');
    return {
      ...dateInfo(),
      condition: raw && raw !== '--' ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Condições no CIM',
      temp: number(text('#temperature')),
      visibility: number(text('#visibility')),
      rain: number(text('#rain-probability')),
      rainPop: number(text('#rain-total')),
      wind: number(text('#wind-speed')),
      dir,
      gust: number(text('#wind-gust')),
      cardinal: cardinal(dir),
      sunrise: forecast.sunrise !== '—' ? forecast.sunrise : (text('#sunrise').match(/\d{2}:\d{2}/)?.[0] || '—'),
      sunset: forecast.sunset !== '—' ? forecast.sunset : (text('#sunset').match(/\d{2}:\d{2}/)?.[0] || '—'),
      hours: forecast.hours
    };
  }

  function clockValue(v, fallback) {
    const m = String(v || '').match(/(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) + Number(m[2]) / 60 : fallback;
  }

  function windIcon(scale = 1) {
    return `<g transform="scale(${scale})" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"><path d="M0 18H58c22 0 22-30 2-30-9 0-16 5-19 12"/><path d="M0 48H78c19 0 19 28 2 28-9 0-15-5-18-11"/><path d="M0 76H48"/></g>`;
  }
  function thermometerIcon(scale = 1) {
    return `<g transform="scale(${scale})" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"><path d="M20 4a8 8 0 0 0-8 8v29a14 14 0 1 0 16 0V12a8 8 0 0 0-8-8Z"/><line x1="20" y1="18" x2="20" y2="48"/><circle cx="20" cy="54" r="7"/></g>`;
  }
  function dropIcon(scale = 1) {
    return `<g transform="scale(${scale})" fill="none" stroke="#fff" stroke-width="4"><path d="M28 3C22 13 9 27 9 39a19 19 0 0 0 38 0C47 27 34 13 28 3Z"/></g>`;
  }
  function rainIcon(scale = 1) {
    return `<g transform="scale(${scale})" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"><path d="M13 39h35c9 0 13-6 13-13 0-8-6-14-14-14-3-7-9-10-16-10-10 0-18 7-20 17C4 20 0 25 0 30c0 5 5 9 13 9Z"/><line x1="18" y1="47" x2="14" y2="55"/><line x1="34" y1="47" x2="30" y2="55"/><line x1="50" y1="47" x2="46" y2="55"/></g>`;
  }
  function eyeIcon(scale = 1) {
    return `<g transform="scale(${scale})" fill="none" stroke="#fff" stroke-width="4"><path d="M2 28S13 10 31 10s29 18 29 18-11 18-29 18S2 28 2 28Z"/><circle cx="31" cy="28" r="9"/></g>`;
  }
  function sunriseIcon(scale = 1) {
    return `<g transform="scale(${scale})" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><path d="M2 36h54"/><path d="M12 36a17 17 0 0 1 34 0"/><line x1="29" y1="3" x2="29" y2="10"/><line x1="7" y1="14" x2="13" y2="20"/><line x1="51" y1="14" x2="45" y2="20"/></g>`;
  }
  function calendarIcon() {
    return `<g fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"><rect x="0" y="8" width="44" height="40" rx="4"/><line x1="0" y1="20" x2="44" y2="20"/><line x1="11" y1="0" x2="11" y2="13"/><line x1="33" y1="0" x2="33" y2="13"/><rect x="10" y="27" width="6" height="6" fill="#fff" stroke="none"/><rect x="26" y="27" width="6" height="6" fill="#fff" stroke="none"/></g>`;
  }

  function daylight(d) {
    const rise = clockValue(d.sunrise, 5.5);
    const set = clockValue(d.sunset, 17.7);
    const now = clockValue(d.time, rise);
    const x1 = 268;
    const x2 = 830;
    const x = x1 + (x2 - x1) * clamp((now - rise) / Math.max(0.1, set - rise), 0, 1);
    return `<g>
      <rect x="34" y="934" width="1012" height="108" rx="20" fill="#021a2a" fill-opacity=".98" stroke="#25afe7" stroke-width="1.4"/>
      <text x="540" y="960" text-anchor="middle" class="section">PERÍODO DIURNO</text>
      <line x1="${x1}" y1="994" x2="${x2}" y2="994" stroke="#42c2f2" stroke-width="4" stroke-linecap="round"/>
      <circle cx="${x}" cy="994" r="10" fill="#fff" stroke="#42c2f2" stroke-width="4"/>
      <g transform="translate(78 972)">${sunriseIcon(0.9)}</g>
      <text x="144" y="986" class="sunTime">${esc(d.sunrise)}</text><text x="144" y="1016" class="sunLabel">Nascer</text>
      <g transform="translate(1001 972) scale(-1 1)">${sunriseIcon(0.9)}</g>
      <text x="936" y="986" text-anchor="end" class="sunTime">${esc(d.sunset)}</text><text x="936" y="1016" text-anchor="end" class="sunLabel">Pôr do sol</text>
      <text x="${x}" y="1025" text-anchor="middle" class="now">Agora</text>
    </g>`;
  }

  function forecastClipDefs() {
    const g = LAYOUT.forecastGrid;
    const defs = [];
    for (let i = 0; i < 12; i++) {
      const col = i % 6;
      const row = Math.floor(i / 6);
      const x = g.x + col * g.colW;
      const y = row ? g.y2 : g.y1;
      defs.push(`<clipPath id="fc${i}"><rect x="${x}" y="${y - 22}" width="${g.cellW}" height="${g.cellH + 28}"/></clipPath>`);
    }
    return defs.join('');
  }

  function hoursBlock(d) {
    const data = d.hours.length ? d.hours : Array.from({ length: 12 }, () => ({}));
    const g = LAYOUT.forecastGrid;
    return data.slice(0, 12).map((h, i) => {
      const col = i % 6;
      const row = Math.floor(i / 6);
      const x = g.x + col * g.colW;
      const y = row ? g.y2 : g.y1;
      const divider = col ? `<line x1="${x - 18}" y1="${y - 18}" x2="${x - 18}" y2="${y + 96}" stroke="#79bedb" stroke-opacity=".34"/>` : '';
      const rainLine = `${fmt(h.precip, ' mm', 1)} · ${fmt(h.pop, '%')}`;
      return `${divider}<g clip-path="url(#fc${i})">
        <text x="${x}" y="${y}" class="hourTime">${esc(h.time || '—')}</text>
        <text x="${x + 70}" y="${y}" class="hourTemp">${fmt(h.temp, '°')}</text>
        <text x="${x}" y="${y + 30}" class="hourDetail">Vento ${fmt(h.wind)} km/h</text>
        <text x="${x}" y="${y + 55}" class="hourDetail">Raj. ${fmt(h.gust)} km/h</text>
        <text x="${x}" y="${y + 80}" class="hourRain">Ch ${rainLine}</text>
      </g>`;
    }).join('');
  }

  function svg(d, logo, photo) {
    const wind = fmt(d.wind);
    const dir = Number.isFinite(d.dir) ? `${Math.round(d.dir)}°` : '—';
    const gust = fmt(d.gust);
    const conditionSize = fitTextPx(d.condition, 510, 84, 54, 950);
    const dateSize = fitTextPx(d.date, LAYOUT.date.textW, 18, 14.5, 900);
    const updateText = `ATUALIZAÇÃO: ${d.time} (BT)`;
    const updateSize = fitTextPx(updateText, LAYOUT.date.textW, 16, 13.5, 500);
    return `<?xml version="1.0" encoding="UTF-8"?>
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <defs>
        <linearGradient id="photoShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#02101b" stop-opacity=".08"/><stop offset=".56" stop-color="#02101b" stop-opacity=".18"/><stop offset=".86" stop-color="#02101b" stop-opacity=".58"/><stop offset="1" stop-color="#020b12" stop-opacity=".95"/></linearGradient>
        <linearGradient id="leftFade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#031522" stop-opacity=".98"/><stop offset=".42" stop-color="#031522" stop-opacity=".94"/><stop offset=".78" stop-color="#031522" stop-opacity=".58"/><stop offset="1" stop-color="#031522" stop-opacity="0"/></linearGradient>
        <radialGradient id="warm" cx="73%" cy="36%" r="56%"><stop offset="0" stop-color="#ff9e2b" stop-opacity=".14"/><stop offset="1" stop-color="#ff9e2b" stop-opacity="0"/></radialGradient>
        <filter id="logoShadow"><feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#000" flood-opacity=".42"/></filter>
        <clipPath id="dateBoxClip"><rect x="${LAYOUT.date.x}" y="${LAYOUT.date.y}" width="${LAYOUT.date.w}" height="${LAYOUT.date.h}" rx="22"/></clipPath>
        ${forecastClipDefs()}
        <style>
          text{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif}.kicker{fill:#fff;font-size:22px;font-weight:800;letter-spacing:6px}.condition{fill:#fff;font-weight:950;letter-spacing:-3px}.windMain{fill:#fff;font-size:150px;font-weight:950;letter-spacing:-8px}.windUnit{fill:#fff;font-size:46px;font-weight:950}.windDir{fill:#fff;font-size:32px;font-weight:900}.gust{fill:#6dd0fa;font-size:30px;font-weight:950}.meta{fill:#fff;font-size:18px;font-weight:720;letter-spacing:1px}.date1{fill:#fff;font-size:22px;font-weight:850}.date2{fill:#fff;font-weight:900}.date3{fill:#d9e6ed;font-weight:500}.metricV{fill:#fff;font-size:38px;font-weight:950}.metricL{fill:#fff;font-size:18px;font-weight:500}.section{fill:#fff;font-size:16px;font-weight:700;letter-spacing:4px}.sunTime{fill:#fff;font-size:27px;font-weight:950}.sunLabel{fill:#d2dce2;font-size:17px}.now{fill:#fff;font-size:17px;font-weight:850}.hourTitle{fill:#fff;font-size:18px;font-weight:750;letter-spacing:4px}.hourTime{fill:#55c8f7;font-size:20px;font-weight:950}.hourTemp{fill:#fff;font-size:20px;font-weight:950}.hourDetail{fill:#fff;font-size:14px;font-weight:720}.hourRain{fill:#9fc8da;font-size:13px;font-weight:700}.footer{fill:#dbe5ea;font-size:14px;font-weight:550}
        </style>
      </defs>

      <image href="${photo}" x="0" y="0" width="1080" height="760" preserveAspectRatio="xMidYMin slice"/>
      <rect x="0" y="0" width="1080" height="760" fill="url(#photoShade)"/>
      <rect x="0" y="0" width="610" height="760" fill="#031522" fill-opacity=".97"/>
      <rect x="560" y="0" width="330" height="760" fill="url(#leftFade)"/>
      <rect x="0" y="0" width="1080" height="760" fill="url(#warm)"/>
      <rect x="0" y="760" width="1080" height="720" fill="#020d16" fill-opacity=".98"/>

      <g filter="url(#logoShadow)"><rect x="50" y="48" width="342" height="138" rx="24" fill="#fff"/><image href="${logo}" x="66" y="60" width="310" height="114" preserveAspectRatio="xMidYMid meet"/></g>

      <g clip-path="url(#dateBoxClip)">
        <rect x="650" y="38" width="380" height="142" rx="22" fill="#071e30" fill-opacity=".97" stroke="#65cff7" stroke-opacity=".24"/>
        <g transform="translate(674 59)">${calendarIcon()}</g>
        <text x="728" y="78" class="date1">${esc(d.weekday)}</text>
        <text x="728" y="108" class="date2" style="font-size:${dateSize}px">${esc(d.date)}</text>
        <line x1="728" y1="124" x2="1004" y2="124" stroke="#fff" stroke-opacity=".62"/>
        <text x="728" y="154" class="date3" style="font-size:${updateSize}px">${esc(updateText)}</text>
      </g>

      <text x="64" y="248" class="kicker">CONDIÇÕES AGORA</text><line x1="64" y1="272" x2="162" y2="272" stroke="#34c1f5" stroke-width="6" stroke-linecap="round"/>
      <text x="64" y="360" class="condition" style="font-size:${conditionSize}px">${esc(d.condition)}</text>
      <g transform="translate(64 438)">${windIcon(1.05)}</g><text x="178" y="540" class="windMain">${wind}</text><text x="390" y="540" class="windUnit">KM/H</text>
      <text x="178" y="586" class="windDir">${dir} · VENTO DE ${esc(d.cardinal)}</text><line x1="178" y1="607" x2="455" y2="607" stroke="#fff" stroke-opacity=".72"/>
      <text x="178" y="644" class="gust">RAJADA ${gust} KM/H</text><text x="64" y="692" class="meta">CIM · EUSÉBIO · PISTA 13/31 · 230 × 12 M</text>

      <g><rect x="34" y="796" width="1012" height="126" rx="20" fill="#021a2a" fill-opacity=".99" stroke="#25afe7" stroke-width="1.4"/>
        <g transform="translate(78 823)">${thermometerIcon(.95)}</g><text x="142" y="850" class="metricV">${fmt(d.temp,'°')}</text><text x="142" y="884" class="metricL">Temperatura</text><line x1="292" y1="818" x2="292" y2="900" stroke="#74b9d5" stroke-opacity=".65"/>
        <g transform="translate(328 823)">${dropIcon(.95)}</g><text x="396" y="850" class="metricV">${fmt(d.rain,' mm',1)}</text><text x="396" y="884" class="metricL">Chuva</text><line x1="545" y1="818" x2="545" y2="900" stroke="#74b9d5" stroke-opacity=".65"/>
        <g transform="translate(574 823)">${rainIcon(.82)}</g><text x="652" y="850" class="metricV">${fmt(d.rainPop,'%')}</text><text x="652" y="884" class="metricL">Próxima hora</text><line x1="790" y1="818" x2="790" y2="900" stroke="#74b9d5" stroke-opacity=".65"/>
        <g transform="translate(830 826)">${eyeIcon(.88)}</g><text x="902" y="850" class="metricV">${fmt(d.visibility,' km')}</text><text x="902" y="884" class="metricL">Visibilidade</text>
      </g>
      ${daylight(d)}
      <g><rect x="34" y="1055" width="1012" height="360" rx="20" fill="#021a2a" fill-opacity=".99" stroke="#25afe7" stroke-width="1.4"/><text x="64" y="1090" class="hourTitle">PREVISÃO DO PERÍODO DIURNO</text><line x1="64" y1="1106" x2="224" y2="1106" stroke="#34c1f5" stroke-width="5" stroke-linecap="round"/><line x1="58" y1="1247" x2="1022" y2="1247" stroke="#79bedb" stroke-opacity=".26"/>${hoursBlock(d)}</g>
      <line x1="160" y1="1450" x2="260" y2="1450" stroke="#fff" stroke-opacity=".66"/><text x="540" y="1457" text-anchor="middle" class="footer">MODELO NAS COORDENADAS DO CIM · METAR SBFZ É REFERÊNCIA REGIONAL</text><line x1="820" y1="1450" x2="920" y2="1450" stroke="#fff" stroke-opacity=".66"/>
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
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, W, H);
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
      const d = await collect();
      if (!Number.isFinite(d.wind) || !Number.isFinite(d.dir) || !Number.isFinite(d.temp)) throw new Error('dados atuais ainda não carregados');
      if (d.hours.length < 8) throw new Error(`previsão diurna incompleta (${d.hours.length} horas)`);
      const [logo, photo] = await Promise.all([dataUrl(LOGO), dataUrl(PHOTO)]);
      const blob = await toPng(svg(d, logo, photo));
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
    } catch (error) {
      console.error('[Briefing visual CIM]', error);
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