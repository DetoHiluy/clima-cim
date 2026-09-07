const CIM_ATTENDANCE = {
  lat: -3.845481,
  lon: -38.460447,
  timezone: 'America/Fortaleza',
  configUrl: 'data/attendance-config.json',
  siteUrl: 'https://detohiluy.github.io/clima-cim/'
};

const attendanceState = {
  api: '',
  date: '',
  dayLabel: 'hoje',
  counts: { total: 0, morning: 0, afternoon: 0 },
  selection: null,
  deviceId: '',
  ready: false
};

function attendanceDeviceId() {
  const key = 'cim_attendance_device_v1';
  let id = localStorage.getItem(key);
  if (id && /^[A-Za-z0-9_-]{16,96}$/.test(id)) return id;
  id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(key, id);
  return id;
}

function attendanceDate(value, offsetSeconds) {
  if (!value) return null;
  if (/[zZ]$|[+-]\d\d:\d\d$/.test(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) - (Number(offsetSeconds) || 0) * 1000);
}

function attendanceIncludes(period, part) {
  return period === part || period === 'both';
}

function attendancePeriodLabel(period) {
  return { morning: 'manhã', afternoon: 'tarde', both: 'manhã e tarde' }[period] || '';
}

function attendanceAdjustedCounts(previous, next) {
  const counts = { ...attendanceState.counts };
  if (!previous && next) counts.total++;
  if (previous && !next) counts.total = Math.max(0, counts.total - 1);
  for (const part of ['morning', 'afternoon']) {
    const key = part === 'morning' ? 'morning' : 'afternoon';
    const before = attendanceIncludes(previous, part);
    const after = attendanceIncludes(next, part);
    if (!before && after) counts[key]++;
    if (before && !after) counts[key] = Math.max(0, counts[key] - 1);
  }
  return counts;
}

function attendanceHeadline(total) {
  const suffix = attendanceState.dayLabel === 'amanhã' ? 'amanhã' : 'hoje';
  if (total === 1) return `1 sócio pretende ir ao CIM ${suffix}`;
  return `${total} sócios pretendem ir ao CIM ${suffix}`;
}

function attendanceRender() {
  const card = document.querySelector('#attendance-card');
  if (!card || !attendanceState.ready) return;
  card.hidden = false;
  const { total, morning, afternoon } = attendanceState.counts;
  document.querySelector('#attendance-title').textContent = attendanceHeadline(total);
  document.querySelector('#attendance-morning').textContent = morning;
  document.querySelector('#attendance-afternoon').textContent = afternoon;
  document.querySelector('#attendance-day-label').textContent = attendanceState.dayLabel === 'amanhã' ? 'Intenções para amanhã' : 'Movimento no clube hoje';

  const own = document.querySelector('#attendance-own');
  const mainButton = document.querySelector('#attendance-join');
  if (attendanceState.selection) {
    own.textContent = `Você marcou: ${attendancePeriodLabel(attendanceState.selection)}.`;
    mainButton.textContent = 'Minha intenção · alterar';
  } else {
    own.textContent = total > 0 ? 'Marque também sua intenção e ajude a movimentar o clube.' : 'Se você pretende ir, marque abaixo e ajude a puxar a turma.';
    mainButton.textContent = total > 0 ? 'Eu vou também' : 'Eu vou ao CIM';
  }

  document.querySelector('#attendance-remove').hidden = !attendanceState.selection;
  document.querySelectorAll('[data-attendance-period]').forEach(button => {
    button.classList.toggle('selected', button.dataset.attendancePeriod === attendanceState.selection);
  });
}

function attendanceSetStatus(text, tone = '') {
  const el = document.querySelector('#attendance-status');
  if (!el) return;
  el.textContent = text || '';
  el.dataset.tone = tone;
}

async function attendanceLoadConfig() {
  const response = await fetch(`${CIM_ATTENDANCE.configUrl}?_=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('config');
  const config = await response.json();
  const api = String(config.api_base || '').trim().replace(/\/$/, '');
  if (!/^https:\/\//.test(api)) return '';
  return api;
}

async function attendanceTargetDay() {
  const params = new URLSearchParams({
    latitude: CIM_ATTENDANCE.lat,
    longitude: CIM_ATTENDANCE.lon,
    timezone: CIM_ATTENDANCE.timezone,
    forecast_days: '2',
    daily: 'sunrise,sunset'
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}&_=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('sun');
  const data = await response.json();
  const offset = data.utc_offset_seconds || 0;
  const todaySunset = attendanceDate(data.daily.sunset[0], offset);
  const useTomorrow = todaySunset && new Date() >= todaySunset;
  return {
    date: data.daily.time[useTomorrow ? 1 : 0],
    dayLabel: useTomorrow ? 'amanhã' : 'hoje'
  };
}

async function attendanceLoadCounts() {
  if (!attendanceState.api || !attendanceState.date) return;
  const params = new URLSearchParams({ date: attendanceState.date, device_id: attendanceState.deviceId });
  const response = await fetch(`${attendanceState.api}/attendance?${params}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`attendance ${response.status}`);
  const data = await response.json();
  attendanceState.counts = {
    total: Number(data.total) || 0,
    morning: Number(data.morning) || 0,
    afternoon: Number(data.afternoon) || 0
  };
  attendanceState.selection = ['morning', 'afternoon', 'both'].includes(data.own_selection) ? data.own_selection : null;
  attendanceState.ready = true;
  attendanceSetStatus('');
  attendanceRender();
}

function attendanceDialog(open = true) {
  const dialog = document.querySelector('#attendance-dialog');
  if (!dialog) return;
  if (open) {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  } else if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

async function attendanceSave(period) {
  if (!attendanceState.api) return;
  const previous = attendanceState.selection;
  const previousCounts = { ...attendanceState.counts };
  attendanceState.counts = attendanceAdjustedCounts(previous, period);
  attendanceState.selection = period;
  attendanceRender();
  attendanceDialog(false);
  attendanceSetStatus('Registrando sua intenção…');
  try {
    const response = await fetch(`${attendanceState.api}/attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: attendanceState.date,
        device_id: attendanceState.deviceId,
        period
      })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    attendanceSetStatus('Intenção registrada ✓', 'ok');
    setTimeout(() => attendanceLoadCounts().catch(() => {}), 2500);
  } catch (error) {
    attendanceState.counts = previousCounts;
    attendanceState.selection = previous;
    attendanceRender();
    attendanceSetStatus('Não foi possível registrar agora. Tente novamente.', 'error');
  }
}

async function attendanceRemove() {
  if (!attendanceState.api || !attendanceState.selection) return;
  const previous = attendanceState.selection;
  const previousCounts = { ...attendanceState.counts };
  attendanceState.counts = attendanceAdjustedCounts(previous, null);
  attendanceState.selection = null;
  attendanceRender();
  attendanceDialog(false);
  attendanceSetStatus('Removendo sua intenção…');
  try {
    const response = await fetch(`${attendanceState.api}/attendance`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: attendanceState.date, device_id: attendanceState.deviceId })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    attendanceSetStatus('Intenção removida.', 'ok');
    setTimeout(() => attendanceLoadCounts().catch(() => {}), 2500);
  } catch (error) {
    attendanceState.counts = previousCounts;
    attendanceState.selection = previous;
    attendanceRender();
    attendanceSetStatus('Não foi possível alterar agora. Tente novamente.', 'error');
  }
}

async function attendanceShare() {
  const { total, morning, afternoon } = attendanceState.counts;
  const when = attendanceState.dayLabel;
  const intro = total > 0
    ? `${attendanceHeadline(total)} — manhã ${morning} · tarde ${afternoon}.`
    : `Quem anima aparecer no CIM ${when}?`;
  const text = `✈️ ${intro}\nQuem mais vem?\n${CIM_ATTENDANCE.siteUrl}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'CIM — quem vai hoje?', text });
    } else {
      await navigator.clipboard.writeText(text);
      attendanceSetStatus('Convite copiado ✓', 'ok');
    }
  } catch (error) {
    if (error?.name !== 'AbortError') attendanceSetStatus('Não foi possível compartilhar agora.', 'error');
  }
}

async function attendanceInit() {
  try {
    attendanceState.api = await attendanceLoadConfig();
    if (!attendanceState.api) return;
    attendanceState.deviceId = attendanceDeviceId();
    const target = await attendanceTargetDay();
    attendanceState.date = target.date;
    attendanceState.dayLabel = target.dayLabel;
    await attendanceLoadCounts();
  } catch (error) {
    const card = document.querySelector('#attendance-card');
    if (card && attendanceState.api) {
      card.hidden = false;
      card.classList.add('unavailable');
      document.querySelector('#attendance-title').textContent = 'Presença dos sócios indisponível agora';
      document.querySelector('#attendance-own').textContent = 'O restante do painel continua funcionando normalmente.';
      document.querySelector('#attendance-join').disabled = true;
    }
  }
}

document.querySelector('#attendance-join')?.addEventListener('click', () => attendanceDialog(true));
document.querySelector('#attendance-dialog-close')?.addEventListener('click', () => attendanceDialog(false));
document.querySelector('#attendance-remove')?.addEventListener('click', attendanceRemove);
document.querySelector('#attendance-share')?.addEventListener('click', attendanceShare);
document.querySelectorAll('[data-attendance-period]').forEach(button => {
  button.addEventListener('click', () => attendanceSave(button.dataset.attendancePeriod));
});

attendanceInit();
setInterval(() => {
  if (attendanceState.api) attendanceLoadCounts().catch(() => {});
}, 60 * 1000);
