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
  memberCode: '',
  ready: false
};

function attendanceMount() {
  if (document.querySelector('#attendance-card')) return;
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = 'attendance.css?v=20260907-2';
  document.head.appendChild(css);

  const anchor = document.querySelector('#today-cim');
  if (!anchor) return;
  anchor.insertAdjacentHTML('afterend', `
    <section id="attendance-card" class="attendance-card" hidden aria-live="polite">
      <div class="attendance-top">
        <div class="attendance-copy">
          <p class="eyebrow" id="attendance-day-label">Movimento no clube hoje</p>
          <h2 id="attendance-title">Carregando intenção de presença…</h2>
          <p id="attendance-own">Veja quantos sócios pretendem aparecer e marque também sua intenção.</p>
          <div class="attendance-breakdown" aria-label="Intenção de presença por período">
            <span>Manhã <strong id="attendance-morning">0</strong></span>
            <span>Tarde <strong id="attendance-afternoon">0</strong></span>
          </div>
        </div>
      </div>
      <div class="attendance-actions">
        <button id="attendance-join" class="attendance-primary" type="button">Eu vou também</button>
        <button id="attendance-share" class="attendance-secondary" type="button">Convidar no CIM OFICIAL</button>
      </div>
      <small id="attendance-status" class="attendance-status" aria-live="polite"></small>
    </section>

    <dialog id="attendance-dialog" class="attendance-dialog">
      <div class="attendance-dialog-inner">
        <div class="attendance-dialog-head">
          <div>
            <p class="eyebrow">Sua intenção</p>
            <h3>Quando você pretende ir?</h3>
            <p>Isso ajuda os outros sócios a saber quando haverá movimento no clube.</p>
          </div>
          <button id="attendance-dialog-close" class="attendance-dialog-close" type="button" aria-label="Fechar">×</button>
        </div>
        <label id="attendance-member-code-wrap" class="attendance-code-wrap">
          <span>Código dos sócios</span>
          <input id="attendance-member-code" type="password" inputmode="text" autocomplete="off" placeholder="Digite uma vez neste aparelho">
          <small>Usado apenas para validar que a confirmação vem de um sócio do CIM.</small>
        </label>
        <div class="attendance-periods">
          <button class="attendance-period" type="button" data-attendance-period="morning"><strong>Manhã</strong><small>Pretendo ir pela manhã</small></button>
          <button class="attendance-period" type="button" data-attendance-period="afternoon"><strong>Tarde</strong><small>Pretendo ir à tarde</small></button>
          <button class="attendance-period" type="button" data-attendance-period="both"><strong>Manhã e tarde</strong><small>Devo passar boa parte do dia no CIM</small></button>
        </div>
        <div class="attendance-dialog-footer">
          <button id="attendance-remove" class="attendance-remove" type="button" hidden>Remover minha intenção</button>
          <p class="attendance-privacy">O painel exibe somente quantidades. Nenhum nome, telefone ou identificação pessoal é mostrado aos demais usuários.</p>
        </div>
      </div>
    </dialog>
  `);
}

function attendanceBindEvents() {
  document.querySelector('#attendance-join')?.addEventListener('click', () => attendanceDialog(true));
  document.querySelector('#attendance-dialog-close')?.addEventListener('click', () => attendanceDialog(false));
  document.querySelector('#attendance-remove')?.addEventListener('click', attendanceRemove);
  document.querySelector('#attendance-share')?.addEventListener('click', attendanceShare);
  document.querySelectorAll('[data-attendance-period]').forEach(button => {
    button.addEventListener('click', () => attendanceSave(button.dataset.attendancePeriod));
  });
}

function attendanceDeviceId() {
  const key = 'cim_attendance_device_v1';
  let id = localStorage.getItem(key);
  if (id && /^[A-Za-z0-9_-]{16,96}$/.test(id)) return id;
  id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(key, id);
  return id;
}

function attendanceStoredMemberCode() {
  return localStorage.getItem('cim_attendance_member_code_v1') || '';
}

function attendanceSaveMemberCode(value) {
  attendanceState.memberCode = value;
  if (value) localStorage.setItem('cim_attendance_member_code_v1', value);
  else localStorage.removeItem('cim_attendance_member_code_v1');
  attendanceUpdateCodeField();
}

function attendanceUpdateCodeField() {
  const wrap = document.querySelector('#attendance-member-code-wrap');
  const input = document.querySelector('#attendance-member-code');
  if (!wrap || !input) return;
  wrap.hidden = Boolean(attendanceState.memberCode);
  if (!attendanceState.memberCode) input.value = '';
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
    const before = attendanceIncludes(previous, part);
    const after = attendanceIncludes(next, part);
    if (!before && after) counts[part]++;
    if (before && !after) counts[part] = Math.max(0, counts[part] - 1);
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
  attendanceUpdateCodeField();
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
  attendanceUpdateCodeField();
  if (open) {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  } else if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

function attendanceCodeForRequest() {
  const input = document.querySelector('#attendance-member-code');
  return attendanceState.memberCode || String(input?.value || '').trim();
}

async function attendanceSave(period) {
  if (!attendanceState.api) return;
  const memberCode = attendanceCodeForRequest();
  if (!memberCode) {
    attendanceSetStatus('Informe o código dos sócios para registrar sua intenção.', 'error');
    document.querySelector('#attendance-member-code')?.focus();
    return;
  }
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
        member_code: memberCode,
        period
      })
    });
    if (response.status === 401) {
      attendanceSaveMemberCode('');
      throw new Error('member_code');
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    attendanceSaveMemberCode(memberCode);
    attendanceSetStatus('Intenção registrada ✓', 'ok');
    setTimeout(() => attendanceLoadCounts().catch(() => {}), 2500);
  } catch (error) {
    attendanceState.counts = previousCounts;
    attendanceState.selection = previous;
    attendanceRender();
    if (error?.message === 'member_code') {
      attendanceSetStatus('Código dos sócios não reconhecido.', 'error');
      attendanceDialog(true);
      document.querySelector('#attendance-member-code')?.focus();
    } else {
      attendanceSetStatus('Não foi possível registrar agora. Tente novamente.', 'error');
    }
  }
}

async function attendanceRemove() {
  if (!attendanceState.api || !attendanceState.selection) return;
  const memberCode = attendanceCodeForRequest();
  if (!memberCode) {
    attendanceSetStatus('Informe novamente o código dos sócios.', 'error');
    attendanceDialog(true);
    return;
  }
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
      body: JSON.stringify({
        date: attendanceState.date,
        device_id: attendanceState.deviceId,
        member_code: memberCode
      })
    });
    if (response.status === 401) {
      attendanceSaveMemberCode('');
      throw new Error('member_code');
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    attendanceSetStatus('Intenção removida.', 'ok');
    setTimeout(() => attendanceLoadCounts().catch(() => {}), 2500);
  } catch (error) {
    attendanceState.counts = previousCounts;
    attendanceState.selection = previous;
    attendanceRender();
    attendanceSetStatus(error?.message === 'member_code' ? 'Código dos sócios não reconhecido.' : 'Não foi possível alterar agora. Tente novamente.', 'error');
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
    attendanceMount();
    attendanceBindEvents();
    attendanceState.deviceId = attendanceDeviceId();
    attendanceState.memberCode = attendanceStoredMemberCode();
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

attendanceInit();
setInterval(() => {
  if (attendanceState.api) attendanceLoadCounts().catch(() => {});
}, 60 * 1000);
