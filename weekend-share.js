(() => {
  'use strict';

  const LAT = -3.845481;
  const LON = -38.460447;
  const TIMEZONE = 'America/Fortaleza';
  const SITE_URL = 'https://detohiluy.github.io/clima-cim/';
  const HISTORY_KEY = 'cim_weekend_share_history_v1';
  const RUNWAYS = [
    { name: '13', heading: 109.8 },
    { name: '31', heading: 289.8 }
  ];

  const OPENERS = {
    Thu: [
      'O fim de semana já entrou no radar do CIM. ✈️',
      'A primeira leitura do fim de semana já está aí. ✈️',
      'Já dá para começar a olhar o fim de semana no CIM. ✈️',
      'Prévia de fim de semana no CIM. ✈️',
      'O próximo fim de semana começa a ganhar forma. ✈️',
      'Hora de colocar sábado e domingo no radar do CIM. ✈️'
    ],
    Fri: [
      'Fim de semana no radar do CIM. ✈️',
      'Sábado e domingo já estão na tela. ✈️',
      'A previsão mais recente para o fim de semana chegou. ✈️',
      'O fim de semana está logo ali — confira o cenário do CIM. ✈️',
      'Última leitura antes do fim de semana no CIM. ✈️',
      'Sexta-feira pede uma olhada no sábado e no domingo. ✈️'
    ]
  };

  const CLOSERS = [
    'Venha ao CIM neste fim de semana. Voo, modelos, papo e resenha: o clube fica melhor com a turma por lá. ✈️',
    'Venha ao CIM e ajude a movimentar o clube. A decisão de voo fica para a condição real no campo. ✈️',
    'Venha ao CIM. A meteorologia orienta o voo; a presença da turma movimenta o clube. ✈️',
    'Venha ao CIM neste fim de semana. Confira a biruta no campo e aproveite o clube. ✈️',
    'Venha ao CIM. Pista, modelos e resenha fazem o fim de semana render melhor. ✈️',
    'Venha ao CIM e coloque o clube em movimento. O voo se decide no campo; o encontro começa antes. ✈️',
    'Venha ao CIM neste fim de semana. O importante é ter a turma ocupando o clube. ✈️',
    'Venha ao CIM. Com voo ou com mais resenha, o clube merece movimento. ✈️'
  ];

  function localWeekday() {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      timeZone: TIMEZONE
    }).format(new Date());
  }

  function shouldHandle() {
    const day = localWeekday();
    return day === 'Thu' || day === 'Fri';
  }

  function normalizeAngle(value) {
    return ((value % 360) + 360) % 360;
  }

  function signedAngle(a, b) {
    let d = normalizeAngle(a - b);
    if (d > 180) d -= 360;
    return d;
  }

  function preferredRunway(direction, speed) {
    return RUNWAYS
      .map(runway => {
        const delta = signedAngle(direction, runway.heading);
        return {
          ...runway,
          head: speed * Math.cos(delta * Math.PI / 180)
        };
      })
      .sort((a, b) => b.head - a.head)[0];
  }

  function weekdayForDateKey(dateKey) {
    const date = new Date(`${dateKey}T12:00:00Z`);
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      timeZone: TIMEZONE
    }).format(date);
  }

  function weekendKeys(dailyTimes) {
    const saturday = dailyTimes.find(key => weekdayForDateKey(key) === 'Sat');
    if (!saturday) return null;
    const satIndex = dailyTimes.indexOf(saturday);
    const sunday = dailyTimes.slice(satIndex + 1).find(key => weekdayForDateKey(key) === 'Sun');
    if (!sunday) return null;
    return { saturday, sunday };
  }

  function dayAggregate(data, dateKey, label) {
    const dailyIndex = data.daily.time.indexOf(dateKey);
    if (dailyIndex < 0) return null;

    const sunrise = data.daily.sunrise[dailyIndex];
    const sunset = data.daily.sunset[dailyIndex];
    const indices = [];

    for (let i = 0; i < data.hourly.time.length; i++) {
      const time = data.hourly.time[i];
      if (!time.startsWith(dateKey)) continue;
      if (sunrise && time < sunrise) continue;
      if (sunset && time >= sunset) continue;
      indices.push(i);
    }

    if (!indices.length) return null;

    const winds = indices.map(i => Number(data.hourly.wind_speed_10m[i]) || 0);
    const gusts = indices.map(i => Number(data.hourly.wind_gusts_10m[i]) || 0);
    const pops = indices.map(i => Number(data.hourly.precipitation_probability[i]) || 0);
    const runwayVotes = { '13': 0, '31': 0 };

    for (const i of indices) {
      const speed = Number(data.hourly.wind_speed_10m[i]) || 0;
      const direction = Number(data.hourly.wind_direction_10m[i]) || 0;
      runwayVotes[preferredRunway(direction, speed).name] += 1;
    }

    const runway = runwayVotes['13'] >= runwayVotes['31'] ? '13' : '31';
    const windMin = Math.round(Math.min(...winds));
    const windMax = Math.round(Math.max(...winds));
    const gustMax = Math.round(Math.max(...gusts));
    const popMax = Math.round(Math.max(...pops));
    const windText = windMin === windMax ? `${windMin} km/h` : `${windMin}–${windMax} km/h`;

    return `${label} · Cabeceira ${runway} da pista 13/31 · vento ${windText} · rajadas até ${gustMax} km/h · chuva até ${popMax}%`;
  }

  async function fetchWeekendForecast() {
    const params = new URLSearchParams({
      latitude: String(LAT),
      longitude: String(LON),
      timezone: TIMEZONE,
      forecast_days: '7',
      hourly: [
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m',
        'precipitation_probability'
      ].join(','),
      daily: ['sunrise', 'sunset'].join(','),
      wind_speed_unit: 'kmh'
    });

    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}&_=${Date.now()}`, {
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  function readHistory() {
    try {
      const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function writeHistory(history) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-128)));
    } catch (_) {}
  }

  function randomIndex(max) {
    if (max <= 1) return 0;
    try {
      const values = new Uint32Array(1);
      crypto.getRandomValues(values);
      return values[0] % max;
    } catch (_) {
      return Math.floor(Math.random() * max);
    }
  }

  function editorialPair(day) {
    const openers = OPENERS[day] || OPENERS.Fri;
    const history = readHistory();
    const used = new Set(history);
    const candidates = [];

    for (let oi = 0; oi < openers.length; oi++) {
      for (let ci = 0; ci < CLOSERS.length; ci++) {
        const key = `${day}:${oi}:${ci}`;
        if (!used.has(key)) candidates.push({ key, oi, ci });
      }
    }

    const pool = candidates.length ? candidates : (() => {
      const filtered = history.filter(key => !String(key).startsWith(`${day}:`));
      writeHistory(filtered);
      const all = [];
      for (let oi = 0; oi < openers.length; oi++) {
        for (let ci = 0; ci < CLOSERS.length; ci++) all.push({ key: `${day}:${oi}:${ci}`, oi, ci });
      }
      return all;
    })();

    const picked = pool[randomIndex(pool.length)];
    const nextHistory = readHistory();
    nextHistory.push(picked.key);
    writeHistory(nextHistory);

    return { opener: openers[picked.oi], closer: CLOSERS[picked.ci] };
  }

  function attendanceAppend(text) {
    return typeof briefingTextWithAttendance === 'function'
      ? briefingTextWithAttendance(text)
      : text;
  }

  function fallbackShare() {
    const text = typeof briefingState !== 'undefined' && briefingState.shareText
      ? attendanceAppend(briefingState.shareText)
      : `✈️ CIM\nConfira as condições atualizadas no painel.\n${SITE_URL}`;
    window.location.href = `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  async function shareWeekend(event) {
    if (!shouldHandle()) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    try {
      const data = await fetchWeekendForecast();
      const keys = weekendKeys(data.daily.time || []);
      if (!keys) return fallbackShare();

      const saturday = dayAggregate(data, keys.saturday, 'Sábado');
      const sunday = dayAggregate(data, keys.sunday, 'Domingo');
      if (!saturday || !sunday) return fallbackShare();

      const day = localWeekday();
      const editorial = editorialPair(day);
      const uncertainty = day === 'Thu'
        ? 'É uma prévia e ainda pode mudar até o fim de semana.'
        : 'Previsão mais recente; confirme as condições reais no campo.';

      let text = [
        '✈️ CIM — fim de semana',
        saturday,
        sunday,
        '',
        uncertainty,
        '',
        editorial.opener,
        editorial.closer,
        SITE_URL
      ].join('\n');

      text = attendanceAppend(text);
      window.location.href = `https://wa.me/?text=${encodeURIComponent(text)}`;
    } catch (_) {
      fallbackShare();
    }
  }

  const button = document.querySelector('#today-cim-share');
  if (button) {
    // Carregado antes do motor editorial geral. Em quinta/sexta, assume o compartilhamento.
    button.addEventListener('click', shareWeekend, true);
  }
})();
