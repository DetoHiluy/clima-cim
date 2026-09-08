const CIM_BRIEFING = {
  lat: -3.845481,
  lon: -38.460447,
  timezone: 'America/Fortaleza',
  runwayEnds: [
    { name: '13', trueHeading: 109.8 },
    { name: '31', trueHeading: 289.8 }
  ]
};

const briefingState = { shareText: '', lastData: null };

function briefingNormalizeAngle(a) { return ((a % 360) + 360) % 360; }
function briefingSignedAngle(a, b) {
  let d = briefingNormalizeAngle(a - b);
  if (d > 180) d -= 360;
  return d;
}
function briefingRunway(direction, speed) {
  return CIM_BRIEFING.runwayEnds
    .map(runway => {
      const delta = briefingSignedAngle(direction, runway.trueHeading);
      return {
        ...runway,
        delta,
        head: speed * Math.cos(delta * Math.PI / 180),
        cross: speed * Math.sin(delta * Math.PI / 180)
      };
    })
    .sort((a, b) => b.head - a.head)[0];
}

function briefingDate(value, offsetSeconds) {
  if (!value) return null;
  if (/[zZ]$|[+-]\d\d:\d\d$/.test(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) - (Number(offsetSeconds) || 0) * 1000);
}

function briefingTime(date) {
  if (!date || Number.isNaN(date.getTime())) return '--:--';
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: CIM_BRIEFING.timezone
  }).format(date);
}

function briefingHour(date) {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: CIM_BRIEFING.timezone,
    hour12: false
  }).formatToParts(date);
  const h = parts.find(p => p.type === 'hour')?.value || '--';
  const m = parts.find(p => p.type === 'minute')?.value || '00';
  return m === '00' ? `${h}h` : `${h}:${m}`;
}

function briefingDayKey(date) {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: CIM_BRIEFING.timezone
  }).format(date);
}

function briefingDayWord(label) {
  return /amanhã/i.test(label) ? 'amanhã' : 'hoje';
}

function briefingWindText(window) {
  const min = Math.round(window.windMin);
  const max = Math.round(window.windMax);
  return min === max ? `${min} km/h` : `${min}–${max} km/h`;
}

function briefingAssess(hour) {
  const rw = briefingRunway(Number(hour.windDirection) || 0, Number(hour.windSpeed) || 0);
  const cross = Math.abs(rw.cross);
  const gust = Number(hour.gust) || 0;
  const speed = Number(hour.windSpeed) || 0;
  const spread = Math.max(0, gust - speed);
  const pop = Number(hour.pop) || 0;
  const precip = Number(hour.precip) || 0;
  const vis = Number(hour.visibilityKm);
  const code = Number(hour.weatherCode);
  const thunder = [95, 96, 99].includes(code);
  let score = 0;
  let hardStop = false;

  if (cross > 25) { score += 6; hardStop = true; }
  else if (cross > 20) score += 4;
  else if (cross > 12) score += 1;

  if (gust > 45) { score += 6; hardStop = true; }
  else if (gust > 35) score += 4;
  else if (gust > 25) score += 1;

  if (spread > 18) score += 1;
  if (thunder) { score += 8; hardStop = true; }
  else if (precip >= 3 || [65, 82].includes(code)) score += 5;
  else if (precip >= 1 || [63, 81].includes(code)) score += 3;
  else if (precip > 0 || [51, 53, 55, 61, 80].includes(code)) score += 1;

  if (pop >= 70) score += 3;
  else if (pop >= 45) score += 1;

  if (Number.isFinite(vis)) {
    if (vis < 2) { score += 6; hardStop = true; }
    else if (vis < 4) score += 4;
    else if (vis < 8) score += 1;
  }

  let level = 'good';
  if (hardStop || score >= 6) level = 'bad';
  else if (score >= 4) level = 'challenging';
  else if (score >= 1) level = 'caution';

  return { ...hour, runway: rw, cross, spread, score, level };
}

function briefingLevelRank(level) {
  return { good: 0, caution: 1, challenging: 2, bad: 3 }[level] ?? 3;
}

function briefingBuildHours(data, dayIndex, now) {
  const h = data.hourly;
  const d = data.daily;
  const offset = data.utc_offset_seconds || 0;
  const sunrise = briefingDate(d.sunrise[dayIndex], offset);
  const sunset = briefingDate(d.sunset[dayIndex], offset);
  const dayKey = d.time[dayIndex];
  const hours = [];

  for (let i = 0; i < h.time.length; i++) {
    const time = briefingDate(h.time[i], offset);
    if (!time || briefingDayKey(time) !== dayKey) continue;
    if (!sunrise || !sunset || time < sunrise || time >= sunset) continue;
    if (dayIndex === 0 && time < new Date(now.getTime() - 40 * 60 * 1000)) continue;

    hours.push(briefingAssess({
      index: i,
      time,
      windSpeed: h.wind_speed_10m[i],
      windDirection: h.wind_direction_10m[i],
      gust: h.wind_gusts_10m[i],
      pop: h.precipitation_probability[i],
      precip: h.precipitation[i],
      weatherCode: h.weather_code[i],
      visibilityKm: Number(h.visibility[i]) / 1000
    }));
  }

  return { sunrise, sunset, hours, dayKey };
}

function briefingBestRun(hours, maxRank) {
  const runs = [];
  let current = [];
  for (const hour of hours) {
    if (briefingLevelRank(hour.level) <= maxRank) current.push(hour);
    else if (current.length) {
      runs.push(current);
      current = [];
    }
  }
  if (current.length) runs.push(current);
  if (!runs.length) return null;

  return runs.sort((a, b) => {
    const aAvg = a.reduce((s, x) => s + x.score, 0) / a.length;
    const bAvg = b.reduce((s, x) => s + x.score, 0) / b.length;
    if (aAvg !== bAvg) return aAvg - bAvg;
    if (b.length !== a.length) return b.length - a.length;
    return a[0].time - b[0].time;
  })[0];
}

function briefingBestWindow(day) {
  if (!day.hours.length || !day.sunset) return null;
  let run = briefingBestRun(day.hours, 1);
  let windowLevel = 'good';

  if (!run) {
    run = briefingBestRun(day.hours, 2);
    windowLevel = 'challenging';
  } else if (run.some(x => x.level === 'caution')) {
    windowLevel = 'caution';
  }

  if (!run) return null;

  const useful = run.slice(0, 4);
  const start = useful[0].time;
  const last = useful[useful.length - 1].time;
  const end = new Date(Math.min(last.getTime() + 60 * 60 * 1000, day.sunset.getTime()));
  const windMin = Math.min(...useful.map(x => Number(x.windSpeed) || 0));
  const windMax = Math.max(...useful.map(x => Number(x.windSpeed) || 0));
  const gustMax = Math.max(...useful.map(x => Number(x.gust) || 0));
  const popMax = Math.max(...useful.map(x => Number(x.pop) || 0));
  const crossMax = Math.max(...useful.map(x => x.cross));
  const runwayVotes = useful.reduce((acc, x) => {
    acc[x.runway.name] = (acc[x.runway.name] || 0) + 1;
    return acc;
  }, {});
  const runway = Object.entries(runwayVotes).sort((a, b) => b[1] - a[1])[0]?.[0] || useful[0].runway.name;

  return { level: windowLevel, hours: useful, start, end, windMin, windMax, gustMax, popMax, crossMax, runway };
}

function briefingSummary(window, label) {
  const dayWord = briefingDayWord(label);

  if (!window) {
    return {
      className: 'bad',
      kicker: label,
      title: `Sem uma boa janela de voo ${dayWord}`,
      message: `As condições previstas no período diurno de ${dayWord} não oferecem uma janela que o painel considere adequada.`,
      invite: 'Vale acompanhar a próxima atualização.',
      stats: []
    };
  }

  const className = window.level === 'good' ? 'good' : window.level === 'caution' ? 'caution' : 'challenging';
  const title = window.level === 'good'
    ? `Ótima janela para voar ${dayWord}`
    : window.level === 'caution'
      ? `Boa janela para voar ${dayWord}`
      : `Há uma janela de voo ${dayWord}, com condições mais exigentes`;

  const message = `Cabeceira ${window.runway} da pista 13/31 com melhor componente de proa.`;
  const invite = window.level === 'good'
    ? `Quem puder, vale combinar e aparecer no CIM ${dayWord}. ✈️`
    : window.level === 'caution'
      ? `A janela é boa para aproveitar o clube. Quem anima aparecer no CIM ${dayWord}? ✈️`
      : `Para pilotos e modelos adequados às condições, pode ser uma boa oportunidade. Confirme a biruta no campo.`;

  const stats = [
    `Vento ${briefingWindText(window)}`,
    `Rajadas até ${Math.round(window.gustMax)} km/h`,
    `Través até ${window.crossMax.toFixed(0)} km/h`,
    `Chuva até ${Math.round(window.popMax)}%`
  ];

  return { className, kicker: label, title, message, invite, stats };
}

function briefingWhatsappInvite(window, dayWord) {
  if (!window) {
    return `Sócios, vamos ao CIM ${dayWord}! Se o tempo não deixar voar, vai dar muito papo e resenha. O importante é a turma se encontrar no clube. ✈️`;
  }

  if (window.level === 'challenging') {
    return `Sócios, vamos ao CIM ${dayWord}! O voo pode exigir mais atenção, mas o encontro da turma continua valendo. Se não der voo, vai dar muito papo e resenha. ✈️`;
  }

  return `Sócios, vamos ao CIM ${dayWord}! Se der voo, ótimo. Se não der, vai dar muito papo e resenha. O importante é a turma estar no clube. ✈️`;
}

function briefingShareText(summary, window, day, label) {
  const dayWord = briefingDayWord(label);
  const daylight = `☀️ Nascer ${briefingTime(day.sunrise)} · pôr do sol ${briefingTime(day.sunset)}`;
  const invite = briefingWhatsappInvite(window, dayWord);

  if (!window) {
    return `✈️ CIM — ${dayWord}\n${summary.title}.\n${daylight}\n\n${invite}\nhttps://detohiluy.github.io/clima-cim/`;
  }

  return [
    `✈️ CIM — ${dayWord}`,
    `${summary.title}.`,
    `Cabeceira ${window.runway} da pista 13/31 · vento ${briefingWindText(window)} · rajadas até ${Math.round(window.gustMax)} km/h · chuva até ${Math.round(window.popMax)}%`,
    daylight,
    '',
    invite,
    'https://detohiluy.github.io/clima-cim/'
  ].join('\n');
}

function briefingRenderHours(container, hours, sunset, now, isToday) {
  const next = hours.slice(0, 3);
  if (!next.length) {
    container.innerHTML = '<span class="briefing-empty">Sem novos intervalos diurnos para mostrar.</span>';
    return;
  }

  container.innerHTML = next.map(hour => {
    const end = new Date(Math.min(hour.time.getTime() + 3600000, sunset.getTime()));
    const start = isToday && hour.time < now ? now : hour.time;
    const label = hour.level === 'good'
      ? 'favorável'
      : hour.level === 'caution'
        ? 'boa, com atenção'
        : hour.level === 'challenging'
          ? 'mais exigente'
          : 'desfavorável';

    return `<article class="briefing-hour ${hour.level}"><strong>${briefingHour(start)}–${briefingHour(end)}</strong><span>${label}</span><small>${Math.round(hour.windSpeed)} km/h · G${Math.round(hour.gust)} · Cab. ${hour.runway.name}</small></article>`;
  }).join('');
}

function briefingRender(data) {
  briefingState.lastData = data;
  const panel = document.querySelector('#today-cim');
  if (!panel) return;

  const now = new Date();
  const today = briefingBuildHours(data, 0, now);
  const afterSunset = Boolean(today.sunset && now >= today.sunset);
  const beforeSunrise = Boolean(today.sunrise && now < today.sunrise);

  let day = today;
  let window = briefingBestWindow(today);
  let label = 'Hoje no CIM';
  let isToday = true;

  if (afterSunset && data.daily.time.length > 1) {
    day = briefingBuildHours(data, 1, now);
    window = briefingBestWindow(day);
    label = 'Amanhã no CIM';
    isToday = false;
  }

  if (isToday && window && window.start < now && now < window.end) {
    window = { ...window, start: now };
  }

  const summary = briefingSummary(window, label);
  panel.className = `today-cim ${summary.className}`;
  document.querySelector('#today-cim-kicker').textContent = summary.kicker;
  document.querySelector('#today-cim-title').textContent = summary.title;
  document.querySelector('#today-cim-message').textContent = summary.message;
  document.querySelector('#today-cim-invite').textContent = summary.invite;
  document.querySelector('#today-cim-daylight').textContent = `Nascer ${briefingTime(day.sunrise)} · pôr do sol ${briefingTime(day.sunset)} · recomendações limitadas ao período diurno do CIM`;
  document.querySelector('#today-cim-stats').innerHTML = summary.stats.map(x => `<span>${x}</span>`).join('');

  const badge = document.querySelector('#today-cim-badge');
  if (afterSunset && !isToday) {
    badge.textContent = summary.className === 'good'
      ? 'AMANHÃ PROMETE'
      : summary.className === 'caution'
        ? 'BOA JANELA AMANHÃ'
        : summary.className === 'challenging'
          ? 'AMANHÃ EXIGE ATENÇÃO'
          : 'SEM JANELA AMANHÃ';
  } else {
    badge.textContent = beforeSunrise
      ? 'ANTES DO NASCER DO SOL'
      : summary.className === 'good'
        ? 'VALE APARECER'
        : summary.className === 'caution'
          ? 'BOA JANELA'
          : summary.className === 'challenging'
            ? 'MAIS EXIGENTE'
            : 'SEM JANELA';
  }

  briefingRenderHours(document.querySelector('#today-cim-hours'), day.hours, day.sunset, now, isToday);
  briefingState.shareText = briefingShareText(summary, window, day, label);
}

function briefingTextWithAttendance(text) {
  const card = document.querySelector('#attendance-card');
  if (!text || !card || card.hidden || card.classList.contains('unavailable')) return text;

  const totalText = document.querySelector('#attendance-title')?.textContent || '';
  const totalMatch = totalText.match(/^(\d+)\s+sócio/i);
  const total = totalMatch ? Number(totalMatch[1]) : 0;
  if (!Number.isFinite(total) || total <= 0) return text;

  const morning = Number(document.querySelector('#attendance-morning')?.textContent) || 0;
  const afternoon = Number(document.querySelector('#attendance-afternoon')?.textContent) || 0;
  const social = `${total === 1 ? '1 sócio pretende ir' : `${total} sócios pretendem ir`} · Manhã ${morning} · Tarde ${afternoon}`;
  const url = 'https://detohiluy.github.io/clima-cim/';

  return text.includes(`\n${url}`)
    ? text.replace(`\n${url}`, `\n\n✈️ ${social}\n${url}`)
    : `${text}\n\n✈️ ${social}`;
}

function briefingShare() {
  const text = briefingTextWithAttendance(briefingState.shareText);
  if (!text) return;

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.location.href = whatsappUrl;
}

async function loadCimBriefing() {
  const panel = document.querySelector('#today-cim');
  if (!panel) return;

  const hourly = [
    'wind_speed_10m',
    'wind_direction_10m',
    'wind_gusts_10m',
    'precipitation_probability',
    'precipitation',
    'weather_code',
    'visibility'
  ];
  const daily = ['sunrise', 'sunset'];

  const params = new URLSearchParams({
    latitude: CIM_BRIEFING.lat,
    longitude: CIM_BRIEFING.lon,
    timezone: CIM_BRIEFING.timezone,
    forecast_days: '2',
    hourly: hourly.join(','),
    daily: daily.join(','),
    wind_speed_unit: 'kmh',
    precipitation_unit: 'mm'
  });

  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}&_=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    briefingRender(await response.json());
  } catch (error) {
    panel.className = 'today-cim unavailable';
    document.querySelector('#today-cim-kicker').textContent = 'Hoje no CIM';
    document.querySelector('#today-cim-title').textContent = 'Briefing diário indisponível';
    document.querySelector('#today-cim-message').textContent = 'Não foi possível calcular a melhor janela agora. Use os dados meteorológicos abaixo e confirme a biruta no campo.';
    document.querySelector('#today-cim-badge').textContent = 'SEM DADOS';
    document.querySelector('#today-cim-daylight').textContent = 'A recomendação automática só é exibida com dados atuais e horários válidos de nascer e pôr do sol.';
    document.querySelector('#today-cim-stats').innerHTML = '';
    document.querySelector('#today-cim-hours').innerHTML = '';
  }
}

function replaceTextIfNeeded(element, nextText) {
  if (element && element.textContent !== nextText) element.textContent = nextText;
}

function applyRunwayTerminology() {
  const preferred = document.querySelector('#preferred-runway');
  const prefMatch = preferred?.textContent.match(/(?:pista|cabeceira(?:\s+preferencial:)?)\s*(13|31)/i);
  if (preferred && prefMatch) {
    replaceTextIfNeeded(preferred, `Cabeceira preferencial: ${prefMatch[1]}`);
  }

  const summary = document.querySelector('#runway-summary');
  if (summary) {
    const next = summary.textContent.replace(
      /a pista (13|31) oferece/i,
      'a cabeceira $1 da pista 13/31 oferece'
    );
    replaceTextIfNeeded(summary, next);
  }

  document.querySelectorAll('.runway-wind-line span').forEach(span => {
    const next = span.textContent.replace(
      /Vento relativo à pista (13|31)/i,
      'Vento relativo à cabeceira $1'
    );
    replaceTextIfNeeded(span, next);
  });

  document.querySelectorAll('.forecast-wind').forEach(el => {
    const next = el.textContent.replace(/^P(13|31)\s*·/i, 'Cab. $1 ·');
    replaceTextIfNeeded(el, next);
  });
}

function watchRunwayTerminology() {
  const targets = [
    document.querySelector('#preferred-runway'),
    document.querySelector('#runway-summary'),
    document.querySelector('.runway-wind-line'),
    document.querySelector('#hourly-forecast')
  ].filter(Boolean);

  if (!targets.length || typeof MutationObserver !== 'function') return;

  const observer = new MutationObserver(() => {
    observer.disconnect();
    applyRunwayTerminology();
    targets.forEach(target => observer.observe(target, {
      childList: true,
      subtree: true,
      characterData: true
    }));
  });

  targets.forEach(target => observer.observe(target, {
    childList: true,
    subtree: true,
    characterData: true
  }));
}

function loadAttendanceModule() {
  if (document.querySelector('script[data-cim-attendance]')) return;
  const script = document.createElement('script');
  script.src = 'attendance.js?v=20260908-1';
  script.dataset.cimAttendance = 'true';
  document.body.appendChild(script);
}

document.querySelector('#today-cim-share')?.addEventListener('click', briefingShare);
loadCimBriefing();
applyRunwayTerminology();
watchRunwayTerminology();
loadAttendanceModule();
setInterval(loadCimBriefing, 5 * 60 * 1000);