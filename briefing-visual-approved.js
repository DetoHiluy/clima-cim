(() => {
  'use strict';

  const W = 1080;
  const H = 1350;
  const TZ = 'America/Fortaleza';
  const LAT = -3.845481;
  const LON = -38.460447;
  const LOGO = 'assets/cim-logo-oficial.webp?v=20260910-1';
  const PHOTO = 'assets/cim-pista-hero.webp?v=20260901-final1';
  let activeUrl = '';

  const $ = (selector) => document.querySelector(selector);
  const text = (selector) => $(selector)?.textContent?.trim() || '';
  const number = (value) => {
    const match = String(value ?? '').replace(',', '.').match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : NaN;
  };
  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
  const fmt = (value, suffix = '', digits = 0) => Number.isFinite(value)
    ? `${value.toLocaleString('pt-BR', { maximumFractionDigits: digits })}${suffix}`
    : '—';
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function cardinal(deg) {
    if (!Number.isFinite(deg)) return '—';
    const names = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO'];
    return names[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
  }

  function dateInfo() {
    const now = new Date();
    const weekday = new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      timeZone: TZ
    }).format(now).toUpperCase();
    const parts = new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: TZ
    }).formatToParts(now);
    const day = parts.find((part) => part.type === 'day')?.value || '';
    const month = (parts.find((part) => part.type === 'month')?.value || '').toUpperCase();
    const year = parts.find((part) => part.type === 'year')?.value || '';
    const time = new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: TZ
    }).format(now);
    return { weekday, date: `${day} DE ${month} DE ${year}`, time };
  }

  function parseForecastDate(value, offsetSeconds) {
    if (!value) return null;
    if (/[zZ]$|[+-]\d\d:\d\d$/.test(value)) {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return null;
    return new Date(
      Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5], +(match[6] || 0))
      - (Number(offsetSeconds) || 0) * 1000
    );
  }

  function dayKey(date) {
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: TZ
    }).format(date);
  }

  function hourLabel(date) {
    const parts = new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: TZ
    }).formatToParts(date);
    const hour = parts.find((part) => part.type === 'hour')?.value || '--';
    const minute = parts.find((part) => part.type === 'minute')?.value || '00';
    return minute === '00' ? `${hour}h` : `${hour}:${minute}`;
  }

  function timeLabel(date) {
    if (!date || Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: TZ
    }).format(date);
  }

  function currentData() {
    const dir = number(text('#wind-direction'));
    const rawCondition = text('#weather-description');
    return {
      ...dateInfo(),
      condition: rawCondition && rawCondition !== '--'
        ? rawCondition.charAt(0).toUpperCase() + rawCondition.slice(1)
        : 'Condições no CIM',
      temp: number(text('#temperature')),
      visibility: number(text('#visibility')),
      rain: number(text('#rain-probability')),
      nextPop: number(text('#rain-total')),
      wind: number(text('#wind-speed')),
      dir,
      gust: number(text('#wind-gust')),
      cardinal: cardinal(dir),
      sunrise: text('#sunrise').replace(/^Nascer\s*/i, '') || '—',
      sunset: text('#sunset') || '—'
    };
  }

  async function fetchDaylightForecast() {
    const params = new URLSearchParams({
      latitude: String(LAT),
      longitude: String(LON),
      timezone: TZ,
      forecast_days: '1',
      hourly: [
        'wind_speed_10m',
        'wind_gusts_10m',
        'precipitation_probability',
        'precipitation'
      ].join(','),
      daily: ['sunrise', 'sunset'].join(','),
      wind_speed_unit: 'kmh',
      precipitation_unit: 'mm'
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}&_=${Date.now()}`, {
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`Open-Meteo ${response.status}`);
    const data = await response.json();
    const offset = Number(data.utc_offset_seconds) || 0;
    const sunrise = parseForecastDate(data.daily?.sunrise?.[0], offset);
    const sunset = parseForecastDate(data.daily?.sunset?.[0], offset);
    const targetDay = data.daily?.time?.[0];
    const hours = [];

    if (sunrise && sunset && targetDay && data.hourly?.time?.length) {
      for (let i = 0; i < data.hourly.time.length; i++) {
        const time = parseForecastDate(data.hourly.time[i], offset);
        if (!time || dayKey(time) !== targetDay || time < sunrise || time >= sunset) continue;
        hours.push({
          time,
          label: hourLabel(time),
          wind: Number(data.hourly.wind_speed_10m?.[i]),
          gust: Number(data.hourly.wind_gusts_10m?.[i]),
          precip: Number(data.hourly.precipitation?.[i]),
          pop: Number(data.hourly.precipitation_probability?.[i])
        });
      }
    }

    return {
      sunrise,
      sunset,
      hours: hours.slice(0, 13)
    };
  }

  function clockValue(value, fallback) {
    const match = String(value || '').match(/(\d{1,2}):(\d{2})/);
    return match ? Number(match[1]) + Number(match[2]) / 60 : fallback;
  }

  function conditionFontSize(value) {
    const length = String(value || '').length;
    if (length <= 12) return 84;
    if (length <= 18) return 68;
    if (length <= 24) return 54;
    return 46;
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

  function daylightBlock(data) {
    const rise = clockValue(data.sunrise, 5.5);
    const set = clockValue(data.sunset, 17.7);
    const now = clockValue(data.time, rise);
    const x1 = 268;
    const x2 = 830;
    const x = x1 + (x2 - x1) * clamp((now - rise) / Math.max(0.1, set - rise), 0, 1);
    return `<g>
      <rect x="34" y="926" width="1012" height="108" rx="20" fill="#021a2a" stroke="#25afe7" stroke-width="1.4"/>
      <text x="540" y="952" text-anchor="middle" class="section">PERÍODO DIURNO</text>
      <line x1="${x1}" y1="986" x2="${x2}" y2="986" stroke="#42c2f2" stroke-width="4" stroke-linecap="round"/>
      <circle cx="${x}" cy="986" r="10" fill="#fff" stroke="#42c2f2" stroke-width="4"/>
      <g transform="translate(78 964)">${sunriseIcon(0.9)}</g>
      <text x="144" y="978" class="sunTime">${esc(data.sunrise)}</text><text x="144" y="1008" class="sunLabel">Nascer</text>
      <g transform="translate(1001 964) scale(-1 1)">${sunriseIcon(0.9)}</g>
      <text x="936" y="978" text-anchor="end" class="sunTime">${esc(data.sunset)}</text><text x="936" y="1008" text-anchor="end" class="sunLabel">Pôr do sol</text>
      <text x="${x}" y="1017" text-anchor="middle" class="now">Agora</text>
    </g>`;
  }

  function forecastBlock(hours) {
    const safeHours = hours.length ? hours : Array.from({ length: 12 }, (_, index) => ({ label: `${String(index + 6).padStart(2, '0')}h` }));
    const count = Math.max(1, safeHours.length);
    const left = 64;
    const right = 1016;
    const colW = (right - left) / count;
    const small = count > 12;
    const hourSize = small ? 16 : 18;
    const windSize = small ? 21 : 24;
    const unitSize = small ? 9 : 10;
    const detailSize = small ? 12 : 13;
    const rainSize = small ? 11 : 13;

    const cells = safeHours.map((hour, index) => {
      const x = left + index * colW;
      const center = x + colW / 2;
      const divider = index
        ? `<line x1="${x.toFixed(1)}" y1="1118" x2="${x.toFixed(1)}" y2="1264" stroke="#78bfdc" stroke-opacity=".28"/>`
        : '';
      return `${divider}<g>
        <text x="${center.toFixed(1)}" y="1142" text-anchor="middle" fill="#55c9f8" font-size="${hourSize}" font-weight="950">${esc(hour.label || '—')}</text>
        <text x="${center.toFixed(1)}" y="1182" text-anchor="middle" fill="#fff" font-size="${windSize}" font-weight="950">${fmt(hour.wind)}</text>
        <text x="${center.toFixed(1)}" y="1200" text-anchor="middle" fill="#fff" font-size="${unitSize}" font-weight="800">KM/H</text>
        <text x="${center.toFixed(1)}" y="1230" text-anchor="middle" fill="#dce7ed" font-size="${detailSize}" font-weight="750">Raj. ${fmt(hour.gust)}</text>
        <text x="${center.toFixed(1)}" y="1260" text-anchor="middle" fill="#71ccef" font-size="${rainSize}" font-weight="800">${fmt(hour.precip, ' mm', 1)}</text>
      </g>`;
    }).join('');

    return `<g>
      <rect x="34" y="1048" width="1012" height="236" rx="20" fill="#021a2a" stroke="#25afe7" stroke-width="1.4"/>
      <text x="64" y="1080" class="hourTitle">PREVISÃO DO PERÍODO DIURNO</text>
      <line x1="64" y1="1095" x2="208" y2="1095" stroke="#34c1f5" stroke-width="5" stroke-linecap="round"/>
      ${cells}
    </g>`;
  }

  function buildSvg(data, logo, photo) {
    const wind = fmt(data.wind);
    const dir = Number.isFinite(data.dir) ? `${Math.round(data.dir)}°` : '—';
    const gust = fmt(data.gust);
    const conditionSize = conditionFontSize(data.condition);

    return `<?xml version="1.0" encoding="UTF-8"?>
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <defs>
        <linearGradient id="leftCover" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#061522" stop-opacity="1"/>
          <stop offset=".78" stop-color="#061522" stop-opacity="1"/>
          <stop offset="1" stop-color="#061522" stop-opacity="0"/>
        </linearGradient>
        <filter id="logoShadow"><feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#000" flood-opacity=".42"/></filter>
        <style>
          text{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif}
          .kicker{fill:#fff;font-size:22px;font-weight:800;letter-spacing:6px}
          .condition{fill:#fff;font-size:${conditionSize}px;font-weight:950;letter-spacing:-3px}
          .windMain{fill:#fff;font-size:150px;font-weight:950;letter-spacing:-8px}
          .windUnit{fill:#fff;font-size:45px;font-weight:950;letter-spacing:0}
          .windDir{fill:#fff;font-size:31px;font-weight:900}
          .gust{fill:#68cff7;font-size:30px;font-weight:950}
          .meta{fill:#fff;font-size:18px;font-weight:720;letter-spacing:1px}
          .date1{fill:#fff;font-size:24px;font-weight:900}
          .date2{fill:#fff;font-size:19px;font-weight:900}
          .date3{fill:#d8e5eb;font-size:16px}
          .metricV{fill:#fff;font-size:36px;font-weight:950}
          .metricL{fill:#fff;font-size:18px;font-weight:500}
          .section{fill:#fff;font-size:16px;font-weight:750;letter-spacing:4px}
          .sunTime{fill:#fff;font-size:27px;font-weight:950}
          .sunLabel{fill:#d2dde4;font-size:17px}
          .now{fill:#fff;font-size:16px;font-weight:850}
          .hourTitle{fill:#fff;font-size:17px;font-weight:800;letter-spacing:4px}
          .footer{fill:#dbe5ea;font-size:14px;font-weight:600}
        </style>
      </defs>

      <image href="${photo}" x="0" y="0" width="1080" height="1350" preserveAspectRatio="xMidYMid slice"/>
      <rect x="0" y="202" width="700" height="535" fill="url(#leftCover)"/>
      <rect x="24" y="770" width="1032" height="548" fill="#031521"/>

      <g filter="url(#logoShadow)">
        <rect x="35" y="45" width="365" height="150" rx="26" fill="#fff"/>
        <image href="${logo}" x="62" y="62" width="310" height="112" preserveAspectRatio="xMidYMid meet"/>
      </g>

      <g>
        <rect x="730" y="45" width="330" height="155" rx="24" fill="#071b2b"/>
        <g transform="translate(765 60)">${calendarIcon()}</g>
        <text x="825" y="82" class="date1">${esc(data.weekday)}</text>
        <text x="825" y="114" class="date2">${esc(data.date)}</text>
        <line x1="825" y1="130" x2="1023" y2="130" stroke="#fff" stroke-opacity=".65"/>
        <text x="825" y="158" class="date3">ATUALIZAÇÃO: ${esc(data.time)} (BT)</text>
      </g>

      <text x="64" y="248" class="kicker">CONDIÇÕES AGORA</text>
      <line x1="64" y1="272" x2="162" y2="272" stroke="#34c1f5" stroke-width="6" stroke-linecap="round"/>
      <text x="64" y="360" class="condition">${esc(data.condition)}</text>

      <g transform="translate(64 438)">${windIcon(1.05)}</g>
      <text x="178" y="540" class="windMain">${wind}<tspan dx="24" class="windUnit">KM/H</tspan></text>
      <text x="178" y="586" class="windDir">${dir} · VENTO DE ${esc(data.cardinal)}</text>
      <line x1="178" y1="607" x2="455" y2="607" stroke="#fff" stroke-opacity=".72"/>
      <text x="178" y="644" class="gust">RAJADA ${gust} KM/H</text>
      <text x="64" y="692" class="meta">CIM · EUSÉBIO · PISTA 13/31 · 230 × 12 M</text>

      <g>
        <rect x="34" y="786" width="1012" height="126" rx="20" fill="#021a2a" stroke="#25afe7" stroke-width="1.4"/>
        <line x1="292" y1="808" x2="292" y2="890" stroke="#74b9d5" stroke-opacity=".65"/>
        <line x1="545" y1="808" x2="545" y2="890" stroke="#74b9d5" stroke-opacity=".65"/>
        <line x1="790" y1="808" x2="790" y2="890" stroke="#74b9d5" stroke-opacity=".65"/>
        <g transform="translate(72 808)">${thermometerIcon(0.95)}</g><text x="142" y="840" class="metricV">${fmt(data.temp, '°')}</text><text x="142" y="874" class="metricL">Temperatura</text>
        <g transform="translate(320 807)">${dropIcon(0.95)}</g><text x="396" y="840" class="metricV">${fmt(data.rain, ' mm', 1)}</text><text x="396" y="874" class="metricL">Chuva</text>
        <g transform="translate(565 808)">${rainIcon(0.82)}</g><text x="652" y="840" class="metricV">${fmt(data.nextPop, '%')}</text><text x="652" y="874" class="metricL">Próxima hora</text>
        <g transform="translate(818 812)">${eyeIcon(0.88)}</g><text x="902" y="840" class="metricV">${fmt(data.visibility, ' km')}</text><text x="902" y="874" class="metricL">Visibilidade</text>
      </g>

      ${daylightBlock(data)}
      ${forecastBlock(data.hours)}

      <rect x="0" y="1284" width="1080" height="66" fill="#031521"/>
      <line x1="160" y1="1316" x2="260" y2="1316" stroke="#fff" stroke-opacity=".66"/>
      <text x="540" y="1323" text-anchor="middle" class="footer">MODELO NAS COORDENADAS DO CIM · METAR SBFZ É REFERÊNCIA REGIONAL</text>
      <line x1="820" y1="1316" x2="920" y2="1316" stroke="#fff" stroke-opacity=".66"/>
    </svg>`;
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

  async function toPng(markup) {
    const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const image = await new Promise((resolve, reject) => {
        const item = new Image();
        item.onload = () => resolve(item);
        item.onerror = reject;
        item.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const context = canvas.getContext('2d');
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, 0, 0, W, H);
      return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.96));
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
    overlay.onclick = (event) => {
      if (event.target === overlay) overlay.classList.remove('open');
    };
  }

  async function show() {
    const button = $('#today-cim-briefing-visual');
    const oldLabel = button?.textContent || 'Gerar briefing visual';
    if (button) {
      button.disabled = true;
      button.textContent = 'Gerando briefing…';
    }

    try {
      const current = currentData();
      if (!Number.isFinite(current.wind) || !Number.isFinite(current.dir) || !Number.isFinite(current.temp)) {
        throw new Error('dados atuais ainda não carregados');
      }

      const [forecast, logo, photo] = await Promise.all([
        fetchDaylightForecast(),
        dataUrl(LOGO),
        dataUrl(PHOTO)
      ]);

      const data = {
        ...current,
        sunrise: forecast.sunrise ? timeLabel(forecast.sunrise) : current.sunrise,
        sunset: forecast.sunset ? timeLabel(forecast.sunset) : current.sunset,
        hours: forecast.hours
      };

      const blob = await toPng(buildSvg(data, logo, photo));
      if (!blob) throw new Error('PNG vazio');
      if (activeUrl) URL.revokeObjectURL(activeUrl);
      activeUrl = URL.createObjectURL(blob);

      const file = new File(
        [blob],
        `cim-condicoes-${new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())}.png`,
        { type: 'image/png' }
      );

      ensureUi();
      $('#cim-briefing-preview-image').src = activeUrl;
      $('#cim-briefing-overlay').classList.add('open');
      $('#cim-briefing-share').onclick = async () => {
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Condições agora · CIM' });
        } else {
          const anchor = document.createElement('a');
          anchor.href = activeUrl;
          anchor.download = file.name;
          anchor.click();
        }
      };
      $('#cim-briefing-save').onclick = () => {
        const anchor = document.createElement('a');
        anchor.href = activeUrl;
        anchor.download = file.name;
        anchor.click();
      };
    } catch (error) {
      console.error('[Briefing visual CIM]', error);
      alert('Não foi possível gerar o briefing visual agora. Aguarde os dados do painel e tente novamente.');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = oldLabel;
      }
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
