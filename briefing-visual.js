(() => {
  'use strict';

  const W = 1080;
  const H = 1350;
  const TZ = 'America/Fortaleza';
  const LOGO = 'assets/cim-logo-oficial.webp?v=20260910-1';
  const PHOTO = 'assets/cim-pista-hero.webp?v=20260901-final1';
  let activeUrl = '';

  const $ = (s) => document.querySelector(s);
  const text = (s) => $(s)?.textContent?.trim() || '';
  const number = (v) => {
    const m = String(v ?? '').replace(',', '.').match(/-?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : NaN;
  };
  const esc = (v) => String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
  const fmt = (v, suffix = '', digits = 0) => Number.isFinite(v) ? `${v.toLocaleString('pt-BR', { maximumFractionDigits: digits })}${suffix}` : '—';
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

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

  function daylightForecast() {
    try {
      if (typeof briefingState === 'undefined' || !briefingState.lastData || typeof briefingDate !== 'function' || typeof briefingDayKey !== 'function') return [];
      const data = briefingState.lastData;
      const hourly = data.hourly;
      const daily = data.daily;
      const offset = data.utc_offset_seconds || 0;
      if (!hourly?.time?.length || !daily?.time?.length) return [];

      const sunrise = briefingDate(daily.sunrise?.[0], offset);
      const sunset = briefingDate(daily.sunset?.[0], offset);
      const dayKey = daily.time[0];
      if (!sunrise || !sunset) return [];

      const result = [];
      for (let i = 0; i < hourly.time.length; i++) {
        const time = briefingDate(hourly.time[i], offset);
        if (!time || briefingDayKey(time) !== dayKey || time < sunrise || time >= sunset) continue;
        result.push({
          time: typeof briefingHour === 'function' ? briefingHour(time) : '—',
          temp: Number(hourly.temperature_2m?.[i]),
          wind: Number(hourly.wind_speed_10m?.[i]),
          gust: Number(hourly.wind_gusts_10m?.[i]),
          pop: Number(hourly.precipitation_probability?.[i]),
          precip: Number(hourly.precipitation?.[i])
        });
      }
      return result.slice(0, 12);
    } catch (_) {
      return [];
    }
  }

  function collect() {
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
      sunrise: text('#sunrise').replace(/^Nascer\s*/i, '') || '—',
      sunset: text('#sunset') || '—',
      hours: daylightForecast()
    };
  }

  function clockValue(v, fallback) {
    const m = String(v || '').match(/(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) + Number(m[2]) / 60 : fallback;
  }

  function daylight(d) {
    const rise = clockValue(d.sunrise, 5.5);
    const set = clockValue(d.sunset, 17.7);
    const now = clockValue(d.time, rise);
    const x1 = 268;
    const x2 = 830;
    const x = x1 + (x2 - x1) * clamp((now - rise) / Math.max(0.1, set - rise), 0, 1);
    return `<g>
      <rect x="34" y="934" width="1012" height="108" rx="20" fill="#021a2a" fill-opacity=".94" stroke="#25afe7" stroke-width="1.4"/>
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

  function hoursBlock(d) {
    const data = d.hours.length ? d.hours : Array.from({ length: 12 }, () => ({}));
    const left = 62;
    const top = 1117;
    const colW = 160;
    const rowH = 76;
    return data.slice(0, 12).map((h, i) => {
      const col = i % 6;
      const row = Math.floor(i / 6);
      const x = left + col * colW;
      const y = top + row * rowH;
      const divider = col ? `<line x1="${x - 18}" y1="${y - 12}" x2="${x - 18}" y2="${y + 54}" stroke="#79bedb" stroke-opacity=".42"/>` : '';
      return `${divider}<g transform="translate(${x} ${y})">
        <text x="0" y="0" class="hourTimeSmall">${esc(h.time || '—')}</text>
        <text x="58" y="0" class="hourTemp">${fmt(h.temp, '°')}</text>
        <text x="0" y="25" class="hourWindSmall">${fmt(h.wind)} km/h</text>
        <text x="0" y="47" class="hourDetailSmall">Raj ${fmt(h.gust)} · Ch ${fmt(h.precip, ' mm', 1)}</text>
        <text x="0" y="66" class="hourPop">${fmt(h.pop, '%')} chuva</text>
      </g>`;
    }).join('');
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

  function svg(d, logo, photo) {
    const wind = fmt(d.wind);
    const dir = Number.isFinite(d.dir) ? `${Math.round(d.dir)}°` : '—';
    const gust = fmt(d.gust);
    return `<?xml version="1.0" encoding="UTF-8"?>
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <defs>
        <linearGradient id="photoShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#02101b" stop-opacity=".14"/><stop offset=".48" stop-color="#02101b" stop-opacity=".12"/><stop offset=".66" stop-color="#02101b" stop-opacity=".42"/><stop offset="1" stop-color="#020b12" stop-opacity=".98"/></linearGradient>
        <linearGradient id="leftShade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#021423" stop-opacity=".72"/><stop offset=".62" stop-color="#021423" stop-opacity=".23"/><stop offset="1" stop-color="#021423" stop-opacity="0"/></linearGradient>
        <radialGradient id="warm" cx="70%" cy="35%" r="60%"><stop offset="0" stop-color="#ff9e2b" stop-opacity=".22"/><stop offset="1" stop-color="#ff9e2b" stop-opacity="0"/></radialGradient>
        <filter id="logoShadow"><feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#000" flood-opacity=".42"/></filter>
        <style>
          text{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif}.kicker{fill:#fff;font-size:22px;font-weight:800;letter-spacing:6px}.condition{fill:#fff;font-size:84px;font-weight:950;letter-spacing:-3px}.windMain{fill:#fff;font-size:150px;font-weight:950;letter-spacing:-8px}.windUnit{fill:#fff;font-size:46px;font-weight:950}.windDir{fill:#fff;font-size:32px;font-weight:900}.gust{fill:#6dd0fa;font-size:30px;font-weight:950}.meta{fill:#fff;font-size:18px;font-weight:720;letter-spacing:1px}.date1{fill:#fff;font-size:24px;font-weight:850}.date2{fill:#fff;font-size:19px;font-weight:900}.date3{fill:#d9e6ed;font-size:16px}.metricV{fill:#fff;font-size:38px;font-weight:950}.metricL{fill:#fff;font-size:18px;font-weight:500}.section{fill:#fff;font-size:16px;font-weight:700;letter-spacing:4px}.sunTime{fill:#fff;font-size:27px;font-weight:950}.sunLabel{fill:#d2dce2;font-size:17px}.now{fill:#fff;font-size:17px;font-weight:850}.hourTitle{fill:#fff;font-size:18px;font-weight:750;letter-spacing:4px}.hourTimeSmall{fill:#55c8f7;font-size:19px;font-weight:950}.hourTemp{fill:#fff;font-size:19px;font-weight:950}.hourWindSmall{fill:#fff;font-size:15px;font-weight:800}.hourDetailSmall{fill:#fff;font-size:13px;font-weight:650}.hourPop{fill:#8ec4db;font-size:12px;font-weight:700}.footer{fill:#dbe5ea;font-size:14px;font-weight:550}
        </style>
      </defs>
      <image href="${photo}" x="0" y="0" width="1080" height="1350" preserveAspectRatio="xMidYMid slice"/>
      <rect width="1080" height="1350" fill="url(#photoShade)"/>
      <rect x="0" y="180" width="650" height="570" fill="url(#leftShade)"/>
      <rect width="1080" height="760" fill="url(#warm)"/>
      <rect x="0" y="758" width="1080" height="592" fill="#02111c" fill-opacity=".68"/>

      <g filter="url(#logoShadow)"><rect x="50" y="48" width="342" height="138" rx="24" fill="#fff"/><image href="${logo}" x="66" y="60" width="310" height="114" preserveAspectRatio="xMidYMid meet"/></g>
      <g transform="translate(770 58)"><g transform="translate(0 3)">${calendarIcon()}</g><text x="62" y="22" class="date1">${esc(d.weekday)}</text><text x="62" y="52" class="date2">${esc(d.date)}</text><line x1="62" y1="67" x2="260" y2="67" stroke="#fff" stroke-opacity=".7"/><text x="62" y="94" class="date3">ATUALIZAÇÃO: ${esc(d.time)} (BT)</text></g>

      <text x="64" y="248" class="kicker">CONDIÇÕES AGORA</text><line x1="64" y1="272" x2="162" y2="272" stroke="#34c1f5" stroke-width="6" stroke-linecap="round"/>
      <text x="64" y="360" class="condition">${esc(d.condition)}</text>
      <g transform="translate(64 438)">${windIcon(1.05)}</g><text x="178" y="540" class="windMain">${wind}</text><text x="390" y="540" class="windUnit">KM/H</text>
      <text x="178" y="586" class="windDir">${dir} · VENTO DE ${esc(d.cardinal)}</text><line x1="178" y1="607" x2="455" y2="607" stroke="#fff" stroke-opacity=".72"/>
      <text x="178" y="644" class="gust">RAJADA ${gust} KM/H</text><text x="64" y="692" class="meta">CIM · EUSÉBIO · PISTA 13/31 · 230 × 12 M</text>

      <g><rect x="34" y="796" width="1012" height="126" rx="20" fill="#021a2a" fill-opacity=".94" stroke="#25afe7" stroke-width="1.4"/>
        <g transform="translate(78 823)">${thermometerIcon(.95)}</g><text x="142" y="850" class="metricV">${fmt(d.temp,'°')}</text><text x="142" y="884" class="metricL">Temperatura</text><line x1="292" y1="818" x2="292" y2="900" stroke="#74b9d5" stroke-opacity=".65"/>
        <g transform="translate(328 823)">${dropIcon(.95)}</g><text x="396" y="850" class="metricV">${fmt(d.rain,' mm',1)}</text><text x="396" y="884" class="metricL">Chuva</text><line x1="545" y1="818" x2="545" y2="900" stroke="#74b9d5" stroke-opacity=".65"/>
        <g transform="translate(574 823)">${rainIcon(.82)}</g><text x="652" y="850" class="metricV">${fmt(d.rainPop,'%')}</text><text x="652" y="884" class="metricL">Próxima hora</text><line x1="790" y1="818" x2="790" y2="900" stroke="#74b9d5" stroke-opacity=".65"/>
        <g transform="translate(830 826)">${eyeIcon(.88)}</g><text x="902" y="850" class="metricV">${fmt(d.visibility,' km')}</text><text x="902" y="884" class="metricL">Visibilidade</text>
      </g>
      ${daylight(d)}
      <g><rect x="34" y="1055" width="1012" height="229" rx="20" fill="#021a2a" fill-opacity=".95" stroke="#25afe7" stroke-width="1.4"/><text x="64" y="1087" class="hourTitle">PREVISÃO DO PERÍODO DIURNO</text><line x1="64" y1="1102" x2="208" y2="1102" stroke="#34c1f5" stroke-width="5" stroke-linecap="round"/><line x1="58" y1="1191" x2="1022" y2="1191" stroke="#79bedb" stroke-opacity=".28"/>${hoursBlock(d)}</g>
      <line x1="160" y1="1316" x2="260" y2="1316" stroke="#fff" stroke-opacity=".66"/><text x="540" y="1323" text-anchor="middle" class="footer">MODELO NAS COORDENADAS DO CIM · METAR SBFZ É REFERÊNCIA REGIONAL</text><line x1="820" y1="1316" x2="920" y2="1316" stroke="#fff" stroke-opacity=".66"/>
    </svg>`;
  }

  async function dataUrl(src) {
    const res = await fetch(src, { cache: 'no-store' });
    if (!res.ok) throw new Error(`asset ${res.status}`);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob);
    });
  }

  async function toPng(markup) {
    const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url; });
      const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, 0, 0, W, H);
      return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', .96));
    } finally { URL.revokeObjectURL(url); }
  }

  function ensureUi() {
    if ($('#cim-briefing-overlay')) return;
    const style = document.createElement('style');
    style.textContent = '.cim-briefing-overlay{position:fixed;inset:0;background:rgba(1,7,11,.94);backdrop-filter:blur(18px);z-index:9999;display:none;align-items:center;justify-content:center;padding:20px}.cim-briefing-overlay.open{display:flex}.cim-briefing-shell{width:min(94vw,620px);max-height:95vh;display:flex;flex-direction:column;gap:14px}.cim-briefing-preview{background:#020b12;border:1px solid rgba(101,207,247,.28);border-radius:22px;overflow:auto;box-shadow:0 28px 90px rgba(0,0,0,.5)}.cim-briefing-preview img{display:block;width:100%;height:auto}.cim-briefing-actions{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}.cim-briefing-actions button{border:0;border-radius:999px;padding:12px 18px;font:700 14px system-ui;cursor:pointer}.cim-briefing-primary{background:#65cff7;color:#02111b}.cim-briefing-secondary{background:#173042;color:#e8f5fb}@media(max-width:600px){.cim-briefing-overlay{padding:10px}.cim-briefing-shell{width:100%;max-height:98vh}.cim-briefing-actions{justify-content:stretch}.cim-briefing-actions button{flex:1}}';
    document.head.appendChild(style);
    const overlay = document.createElement('div'); overlay.id = 'cim-briefing-overlay'; overlay.className = 'cim-briefing-overlay';
    overlay.innerHTML = '<div class="cim-briefing-shell" role="dialog" aria-modal="true" aria-label="Prévia do briefing visual do CIM"><div class="cim-briefing-preview"><img id="cim-briefing-preview-image" alt="Condições meteorológicas atuais do CIM"></div><div class="cim-briefing-actions"><button id="cim-briefing-close" class="cim-briefing-secondary">Fechar</button><button id="cim-briefing-save" class="cim-briefing-secondary">Salvar PNG</button><button id="cim-briefing-share" class="cim-briefing-primary">Compartilhar</button></div></div>';
    document.body.appendChild(overlay);
    $('#cim-briefing-close').onclick = () => overlay.classList.remove('open');
    overlay.onclick = (e) => { if (e.target === overlay) overlay.classList.remove('open'); };
  }

  async function show() {
    const button = $('#today-cim-briefing-visual'); const old = button?.textContent || 'Gerar briefing visual';
    if (button) { button.disabled = true; button.textContent = 'Gerando briefing…'; }
    try {
      const d = collect();
      if (!Number.isFinite(d.wind) || !Number.isFinite(d.dir) || !Number.isFinite(d.temp)) throw new Error('dados ainda não carregados');
      const [logo, photo] = await Promise.all([dataUrl(LOGO), dataUrl(PHOTO)]);
      const blob = await toPng(svg(d, logo, photo));
      if (!blob) throw new Error('PNG vazio');
      if (activeUrl) URL.revokeObjectURL(activeUrl); activeUrl = URL.createObjectURL(blob);
      const file = new File([blob], `cim-condicoes-${new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())}.png`, { type: 'image/png' });
      ensureUi(); $('#cim-briefing-preview-image').src = activeUrl; $('#cim-briefing-overlay').classList.add('open');
      $('#cim-briefing-share').onclick = async () => { if (navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Condições agora · CIM' }); else { const a = document.createElement('a'); a.href = activeUrl; a.download = file.name; a.click(); } };
      $('#cim-briefing-save').onclick = () => { const a = document.createElement('a'); a.href = activeUrl; a.download = file.name; a.click(); };
    } catch (error) { console.error('[Briefing visual CIM]', error); alert('Não foi possível gerar o briefing visual agora. Aguarde os dados do painel e tente novamente.'); }
    finally { if (button) { button.disabled = false; button.textContent = old; } }
  }

  function install() {
    const share = $('#today-cim-share'); if (!share || $('#today-cim-briefing-visual')) return;
    const button = document.createElement('button'); button.id = 'today-cim-briefing-visual'; button.className = 'today-cim-share'; button.type = 'button'; button.textContent = 'Gerar briefing visual'; button.setAttribute('aria-label', 'Gerar briefing visual meteorológico do CIM'); share.insertAdjacentElement('afterend', button); button.onclick = show;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();