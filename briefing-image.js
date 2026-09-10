(() => {
  'use strict';

  const W = 1080;
  const H = 1350;
  const HERO = 'assets/cim-pista-hero.webp?v=20260901-final1';
  const LOGO = 'assets/cim-logo-oficial.webp?v=20260910-1';
  const SITE_URL = 'detohiluy.github.io/clima-cim';
  const TZ = 'America/Fortaleza';
  const RUNWAY = { '13': 109.8, '31': 289.8 };

  const $ = selector => document.querySelector(selector);
  const text = selector => $(selector)?.textContent?.trim() || '';
  const xml = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
  const num = value => {
    const m = String(value ?? '').replace(',', '.').match(/-?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : NaN;
  };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const round = v => Number.isFinite(v) ? Math.round(v) : null;

  function firstNumber(...values) {
    for (const value of values) {
      const n = num(value);
      if (Number.isFinite(n)) return n;
    }
    return NaN;
  }

  function timeNow() {
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ
    }).format(new Date());
  }

  function dateParts() {
    const now = new Date();
    const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: TZ })
      .format(now).replace('-feira', '-FEIRA').toUpperCase();
    const day = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', timeZone: TZ }).format(now);
    const month = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: TZ })
      .format(now).replace('.', '').toUpperCase();
    const year = new Intl.DateTimeFormat('pt-BR', { year: 'numeric', timeZone: TZ }).format(now);
    return { weekday, short: `${day} ${month} ${year}` };
  }

  function compassLabel(raw) {
    return String(raw || '')
      .replace(/^Direção\s*/i, '')
      .replace(/\s*·?\s*\d{1,3}(?:[.,]\d+)?°?.*$/, '')
      .trim();
  }

  function components(direction, speed, heading) {
    if (!Number.isFinite(direction) || !Number.isFinite(speed)) return null;
    let delta = ((direction - heading + 540) % 360) - 180;
    const head = speed * Math.cos(delta * Math.PI / 180);
    const cross = speed * Math.sin(delta * Math.PI / 180);
    return {
      head,
      cross,
      proa: Math.max(0, head),
      cauda: Math.max(0, -head),
      atraves: Math.abs(cross)
    };
  }

  function currentRunway(direction, speed) {
    const c13 = components(direction, speed, RUNWAY['13']);
    const c31 = components(direction, speed, RUNWAY['31']);
    if (!c13 || !c31) return { preferred: null, c13, c31 };
    return { preferred: c13.head >= c31.head ? '13' : '31', c13, c31 };
  }

  function pointForHeading(cx, cy, radius, heading) {
    const rad = heading * Math.PI / 180;
    return {
      x: cx + Math.sin(rad) * radius,
      y: cy - Math.cos(rad) * radius
    };
  }

  function compactValue(value, unit) {
    const n = num(value);
    if (!Number.isFinite(n)) return '—';
    const decimals = Math.abs(n) < 10 && !Number.isInteger(n) ? 1 : 0;
    return `${n.toLocaleString('pt-BR', { maximumFractionDigits: decimals })}${unit ? ` ${unit}` : ''}`;
  }

  function getNextHours() {
    try {
      if (typeof briefingState === 'undefined' || !briefingState.lastData) return [];
      if (typeof briefingBuildHours !== 'function') return [];
      const built = briefingBuildHours(briefingState.lastData, 0, new Date());
      return built.hours.slice(0, 4).map(hour => ({
        time: typeof briefingHour === 'function' ? briefingHour(hour.time) : '--',
        precip: Number(hour.precip) || 0,
        pop: Number(hour.pop) || 0,
        wind: Number(hour.windSpeed) || 0,
        gust: Number(hour.gust) || 0,
        runway: hour.runway?.name || ''
      }));
    } catch (_) {
      return [];
    }
  }

  function collect() {
    const windSpeed = firstNumber(text('#wind-speed'), text('#runway-wind'));
    const windDirection = firstNumber(text('#wind-direction'), text('#wind-direction-text'), text('#runway-wind'));
    const gust = firstNumber(text('#wind-gust'));
    const rainMm = firstNumber(text('#rain-probability'));
    const rainNextText = text('#rain-total');
    const rainPop = firstNumber(rainNextText);
    const runway = currentRunway(windDirection, windSpeed);
    const date = dateParts();
    const metarAge = text('#metar-age');

    return {
      date,
      updated: timeNow(),
      weather: text('#weather-description') || 'Condição meteorológica',
      feels: text('#feels-like').replace(/^Sensação:\s*/i, ''),
      temperature: text('#temperature') || '—',
      humidity: text('#humidity') || '—',
      pressure: compactValue(text('#pressure'), ''),
      visibility: text('#visibility') || '—',
      windSpeed,
      windDirection,
      windCardinal: compassLabel(text('#wind-direction-text')),
      gust,
      rainMm,
      rainPop,
      rainNextText,
      sunrise: text('#sunrise').replace(/^Nascer\s*/i, '') || '—',
      sunset: text('#sunset') || '—',
      metarAge,
      runway,
      hours: getNextHours()
    };
  }

  function hourColumn(hour, x) {
    if (!hour) {
      return `<g transform="translate(${x} 0)">
        <text x="0" y="1230" class="h-hour">—</text>
        <text x="0" y="1263" class="h-detail">sem dado</text>
      </g>`;
    }
    const p = hour.precip.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    return `<g transform="translate(${x} 0)">
      <text x="0" y="1228" class="h-hour">${xml(hour.time)}</text>
      <text x="0" y="1260" class="h-detail">${xml(p)} mm · ${Math.round(hour.pop)}%</text>
      <text x="0" y="1290" class="h-detail">vento ${Math.round(hour.wind)} · raj. ${Math.round(hour.gust)}</text>
    </g>`;
  }

  function runwayGraphic(d) {
    const cx = 740;
    const cy = 748;
    const radius = 144;
    const p13 = pointForHeading(cx, cy, 128, RUNWAY['13']);
    const p31 = pointForHeading(cx, cy, 128, RUNWAY['31']);
    let wind = '';
    if (Number.isFinite(d.windDirection)) {
      const from = pointForHeading(cx, cy, 158, d.windDirection);
      const to = pointForHeading(cx, cy, 118, (d.windDirection + 180) % 360);
      wind = `<line x1="${from.x.toFixed(1)}" y1="${from.y.toFixed(1)}" x2="${to.x.toFixed(1)}" y2="${to.y.toFixed(1)}" class="wind-arrow" marker-end="url(#arrow)"/>`;
    }
    return `<g>
      <circle cx="${cx}" cy="${cy}" r="${radius}" class="compass"/>
      <text x="${cx}" y="${cy - radius - 18}" text-anchor="middle" class="north">N</text>
      <line x1="${p31.x.toFixed(1)}" y1="${p31.y.toFixed(1)}" x2="${p13.x.toFixed(1)}" y2="${p13.y.toFixed(1)}" class="runway-outer"/>
      <line x1="${p31.x.toFixed(1)}" y1="${p31.y.toFixed(1)}" x2="${p13.x.toFixed(1)}" y2="${p13.y.toFixed(1)}" class="runway-inner"/>
      <line x1="${(p31.x * .76 + p13.x * .24).toFixed(1)}" y1="${(p31.y * .76 + p13.y * .24).toFixed(1)}" x2="${(p31.x * .62 + p13.x * .38).toFixed(1)}" y2="${(p31.y * .62 + p13.y * .38).toFixed(1)}" class="runway-center"/>
      <line x1="${(p31.x * .52 + p13.x * .48).toFixed(1)}" y1="${(p31.y * .52 + p13.y * .48).toFixed(1)}" x2="${(p31.x * .38 + p13.x * .62).toFixed(1)}" y2="${(p31.y * .38 + p13.y * .62).toFixed(1)}" class="runway-center"/>
      <line x1="${(p31.x * .24 + p13.x * .76).toFixed(1)}" y1="${(p31.y * .24 + p13.y * .76).toFixed(1)}" x2="${(p31.x * .10 + p13.x * .90).toFixed(1)}" y2="${(p31.y * .10 + p13.y * .90).toFixed(1)}" class="runway-center"/>
      <text x="${(p13.x + 18).toFixed(1)}" y="${(p13.y + 8).toFixed(1)}" class="runway-number">13</text>
      <text x="${(p31.x - 46).toFixed(1)}" y="${(p31.y + 8).toFixed(1)}" class="runway-number">31</text>
      ${wind}
    </g>`;
  }

  function formatComponent(c, key) {
    if (!c || !Number.isFinite(c[key])) return '—';
    return String(Math.round(c[key]));
  }

  function daylightPosition(time, fallback) {
    const n = num(time.replace(':', '.'));
    return Number.isFinite(n) ? n : fallback;
  }

  function buildSvg(d, heroData, logoData) {
    const rainActive = (Number.isFinite(d.rainMm) && d.rainMm >= 0.3) || (Number.isFinite(d.rainPop) && d.rainPop >= 60);
    const rainGitle = rainActive ? 'CHUVA AGORA' : 'PRECIPITAÇÃO';
    const rainFalue = Number.isFinite(d.rainMm) ? `${d.rainMm.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mm` : '—';
    const rainInfo = Number.isFinite(d.rain@op) ? `Prãxima hora ${Math.round(d.rainPop)}%` : d.rainNextText || 'Próxima hora —';
    const windValue = Number.isFinite(d.windSpeed) ? `${Math.round(d.windSpeed)} km/h` : '—';
    const windDir = Number.isFinite(d.windDirection) ? `${Math.round(d.windDirection)}°` : '—';
    const gustValue = Number.isFinite(d.gust) ? `${Math.round(d.gust)} km/h` : '—';
    const pref = d.runway.preferred || '—';
    const c13 = d.runway.c13;
    const c31 = d.runway.c31;
    const weatherLine = `${d.weather}${d.feels ? ` · sensação ${d.feels}` : ''}`;

    const dayStart = parseTime(d.sunrise, 5.5);
    const dayEnd = parseTime(d.sunset, 17.7);
    const nowParts = new Intl.DateTimeFormat('pt-BR', { hour:'2-digit', minute:'2-digit', hour12:false, timeZone:TZ }).format(new Date());
    const nowHr = parseTime(nowParts, dayStart);
    const nowX = 56 + clamp((nowHr - dayStart) / Math.max(.1, dayEnd - dayStart), 0, 1) * 968;

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="heroShade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#02101c" stop-opacity=".16"/>
      <stop offset=".58" stop-color="#02101c" stop-opacity=".50"/>
      <stop offset="1" stop-color="#041522" stop-opacity=".98"/>
    </linearGradient>
    <linearGradient id="bodyFade" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#061a2a"/>
      <stop offset="1" stop-color="#03111c"/>
    </linearGradient>
    <marker id="arrow" markerWidth="9" markerHeight="9" refX="7.5" refY="4.5" orient="auto">
      <path d="M0,0 L9,4.5 L0,9 z" fill="#5ec5f1"/>
    </marker>
    <style>
      text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; }
      .white { fill:#fff; }
      .muted { fill:#a9c0cf; }
      .blue { fill:#6bcaf2; }
      .label { fill:#70c9ef; font-size:24px; font-weight:800; letter-spacing:.7px; }
      .metric { fill:#fff; font-size:39px; font-weight:800; }
      .metric-label { fill:#9fb7c7; font-size:17px; font-weight:500; }
      .small { fill:#afc4d1; font-size:18px; }
      .compass { fill:none; stroke:#315b74; stroke-width:2; }
      .north { fill:#b8cbd7; font-size:18px; font-weight:800; }
      .runway-outer { stroke:#d5e0e6; stroke-width:26; stroke-linecap:round; }
      .runway-inner { stroke:#152d3d; stroke-width:18; stroke-linecap:round; }
      .runway-center { stroke:#fff; stroke-width:3; stroke-linecap:round; }
      .runway-number { fill:#fff; font-size:24px; font-weight:900; }
      .wind-arrow { stroke:#5ec5f1; stroke-width:8; stroke-linecap:round; }
      .comp-h { fill:#fff; font-size:21px; font-weight:800; }
      .comp-d { fill:#abc1cf; font-size:17px; }
      .h-hour { fill:#fff; font-size:23px; font-weight:800; }
      .h-detail { fill:#a6becc; font-size:15px; }
    </style>
  </defs>

  <rect width="1080" height="1350" fill="url(#bodyFade)"/>
  ${heroData ? `<image href="${heroData}" x="0" y="0" width="1080" height="350" preserveAspectRatio="xMidYMid slice"/>` : ''}
  <rect x="0" y="0" width="1080" height="355" fill="url(#heroShade)"/>

  <rect x="48" y="34" width="300" height="126" rx="24" fill="#fff" fill-opacity=".97"/>
  ${logoData ? `<image href="${logoData}" x="62" y="45" width="272" height="104" preserveAspectRatio="xMidYMid meet"/>` : ''}

  <rect x="760" y="34" width="272" height="120" rx="24" fill="#051d30" fill-opacity=".94" stroke="#4fb3e2" stroke-width="2"/>
  <text x="788" y="73" class="white" font-size="26" font-weight="900">${xml(d.date.weekday)}</text>
  <text x="788" y="108" class="blue" font-size="22" font-weight="800">${xml(d.date.short)}</text>
  <text x="788" y="137" class="muted" font-size="16">ATUALIZADO ${xml(d.update)}</text>

  <text x="48" y="230" class="white" font-size="64" font-weight="900" letter-spacing="1">BRIEFING</text>
  <text x="48" y="292" class="blue" font-size="54" font-weight="900" letter-spacing=".6">METEOROLÓGICO</text>
  <text x="50" y="331" fill="#d9e7ef" font-size="21" font-weight="800">CIM · EUS0BIO/CE · PISTA 13/31 · 230 × 12 m</text>

  <text x="48" y="399" class="label">CONDIÇÕES AGORA</text>
  <text x="48" y="430" class="small">MODELO · coordenadas do campo · ${xml(weatherLine)}</text>
  <line x1="48" y1="452" x2="1032" y2="452" stroke="#416b83" stroke-width="2"/>

  <text x="48" y="506" class="metric">${xml(d.temperature)}</text>
  <text x="48" y="535" class="metric-label">Temperatura</text>
  <text x="250" y="506" class="metric">${xml(d.humidity)}</text>
  <text x="250" y="535" class="metric-label">Umidade</text>
  <text x="450" y="506" class="metric">${xml(d.pressure)}</text>
  <text x="450" y="535" class="metric-label">hPa</text>
  <text x="650" y="506" class="metric">${xml(d.visibility)}</text>
  <text x="650" y="535" class="metric-label">Visibilidade</text>
  <text x="850" y="506" class="metric">${xml(rainValue)}</text>
  <text x="850" y="535" class="metric-label">Precipitação</text>

  <rect x="48" y="568" width="984" height="354" rx="32" fill="#071f32" fill-opacity=".95" stroke="#3f87ad" stroke-width="2"/>
  <text x="80" y="619" class="label">PISTA 13/31 · VENTO</text>
  <text x="80" y="678" class="white" font-size="43" font-weight="900">${xml(windDir)} · ${xml(windValue)}</text>
  <text x="80" y="716" class="small">${xml(d.windCardinal || 'Direção do vento')} · rajadas ${xml(gustValue)}</text>
  <text x="80" y="760" class="metric-label">MAIOR COMPONENTE DE PROA</text>
  <text x="80" y="820" class="blue" font-size="58" font-weight="900">CABECEIRA ${xml(pref)}</text>

  ${runwayGraphic(d)}

  <line x1="80" y1="848" x2="1000" y2="848" stroke="#294c61" stroke-width="1"/>
  <text x="82" y="880" class="blue" font-size="21" font-weight="900">13</text>
  <text x="130" y="880" class="comp-h">PROA ${xml(formatComponent(c13,'proa'))}</text>
  <text x="264" y="880" class="comp-h">TRAVÉS ${xml(formatComponent(c13,'atraves'))}</text>
  <text x="420" y="880" class="comp-h">CAUDA ${xml(formatComponent(c13,'cauda'))}</text>
  <text x="586" y="880" class="muted" font-size="21" font-weight="900">31</text>
  <text x="634" y="880" class="comp-h">PROA ${xml(formatComponent(c31,'proa'))}</text>
  <text x="756" y="880" class="comp-h">TRAVÉS ${xml(formatComponent(c31,'atraves'))}</text>
  <text x="910" y="880" class="comp-h">CAUDA ${xml(formatComponent(c31,'cauda'))}</text>
  <text x="82" y="907" class="comp-d">componentes em km/h · pista em orientação verdadeira aproximada</text>

  <rect x="48" y="951" width="984" height="83" rx="20" fill="${rainActive ? '#0b3652' : '#081d2d'}" stroke="${rainActive ? '#4fb8e9' : '#26485d'}" stroke-width="2"/>
  <text x="76" y="986" class="label" font-size="21">${rainGitle}</text>
  <text x="76" y="1020" class="white" font-size="31" font-weight="900">${xml(rainValue)}</text>
  <text x="270" y="1019" class="small">${xml(rainInfo)}</text>

  <text x="48" y="1080" class="label">PERÍODO DIURNO</text>
  <line x1="56" y1="1130" x2="1024" y2="1130" stroke="#5c8ba5" stroke-width="4" stroke-linecap="round"/>
  <circle cx="56" cy="1130" r="8" fill="#f0b53c"/>
  <circle cx="1024" cy="1130" r="8" fill="#f0b53c"/>
  <circle cx="${nowX.toFixed(1)}" cy="1130" r="10" fill="#5ec5f1"/>
  <text x="56" y="1162" class="small" font-size="15">${xml(d.sunrise)} nascer</text>
  <text x="${nowX.toFixed(1)}" y="1102" text-anchor="middle" class="blue" font-size="16" font-weight="900">AGORA</text>
  <text x="1024" y="1162" text-anchor="end" class="small" font-size="15">${xml(d.sunset)} pôr</text>

  <text x="48" y="1200" class="label">PRÓXIMAS HORAS</text>
  ${hourColumn(d.hours[0],48)}
  ${hourColumn(d.hours[1],294)}
  ${hourColumn(d.hours[2],540)}
  ${hourColumn(d.hours[3],786)}

  <line x1="48" y1="1310" x2="1032" y2="1310" stroke="#2f5064" stroke-width="1"/>
  <text x="48" y="1334" fill="#8faaba" font-size="14">MODELO · CIM (${CIM_BRIEFING?.lat ?? '-3.845481'}, ${CIM_BRIEFING?.lon ?? '-38.460447'})</text>
  <text x="360" y="1334" fill="#8faaba" font-size="14">METAR SBFZ · observação regional${d.metarAge ? ` · ${xml(d.metarAge)}` : ''}</text>
  <text x="1032" y="1334" text-anchor="end" fill="#5ec5f1" font-size="14" font-weight="800">${SITE_URL}</text>
</svg>`;
  }

  function parseTime(value, fallback) {
    const m = String(value || '').match(/(\d{1,2}):(\d{2})/);
    if (!m) return fallback;
    return Number(m[1]) + Number(m[2]) / 60;
  }

  async function asDataUrl(src) {
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

  async function svgToPng(svg) {
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0, W, H);
      return await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.96));
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function generate() {
    const button = $('#today-cim-image');
    const oldLabel = button?.textContent || 'Gerar briefing visual';
    if (button) {
      button.disabled = true;
      button.textContent = 'Gerando briefing…g;
    }

    try {
      const d = collect();
      if (!Number.isFinite(d.windSpeed) || !d.temperature || d.temperature === '—') {
        throw new Error('dados ainda não carregados');
      }
      const [heroData, logoData] = await Promise.all([
        asDataUrl(HERO).catch(() => ''),
        asDataUrl(LOGO)
      ]);
      const svg = buildSvg(d, heroData, logoData);
      const png = await svgToPng(svg);
      if (!png) throw new Error('PNG vazio');
      const stamp = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
      const file = new File([png], `briefing-cim-${stamp}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Briefing meteorológico do CIM' });
      } else {
        const url = URL.createObjectURL(png);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.H@�2emove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.error('[CIM briefing visual]', err);
        alert('Não foi possível gerar o briefing agora. Aguarde os dados do painel carregarem e tente novamente.');
      }
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = oldLabel;
      }
    }
  }

  const shareButton = $('#today-cim-share');
  if (shareButton && !$('#today-cim-image')) {
    const button = document.createElement('button');
    button.id = 'today-cim-image';
    button.className = 'today-cim-share';
    button.type = 'button';
    button.textContent = 'Gerar briefing visual';
    button.setAttribute('aria-label', 'Gerar briefing meteorológico visual do CIM');
    shareButton.insertAdjacentElement('afterend', button);
    button.addEventListener('click', generate);
  }
})();
