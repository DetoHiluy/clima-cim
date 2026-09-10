(() => {
  'use strict';

  const HISTORY_KEY = 'cim_whatsapp_editorial_history_v1';
  const SITE_URL = 'https://detohiluy.github.io/clima-cim/';
  const TIMEZONE = 'America/Fortaleza';

  const OPENERS = {
    saturday: [
      'Sábado é dia de CIM! ✈️',
      'Sábado combina com CIM! ✈️',
      'O sábado chegou — venha ao CIM! ✈️',
      'Hoje é dia de movimentar o CIM! ✈️',
      'Sábado com a turma no clube fica melhor. ✈️',
      'O fim de semana pede CIM! ✈️',
      'Sábado: modelos, pista e turma reunida no CIM. ✈️',
      'Dia de tirar os modelos de casa e movimentar o CIM! ✈️'
    ],
    sunday: [
      'Domingo combina com CIM! ✈️',
      'Domingo também é dia de CIM! ✈️',
      'O fim de semana ainda tem CIM! ✈️',
      'Domingo com movimento no CIM fica melhor. ✈️',
      'Ainda tem domingo pela frente — venha ao CIM! ✈️',
      'Domingo: pista, modelos e turma no CIM. ✈️',
      'Hoje o destino pode ser o CIM. ✈️',
      'Feche o fim de semana no CIM! ✈️'
    ],
    friday: [
      'Sexta também combina com CIM! ✈️',
      'A sexta chegou — venha ao CIM! ✈️',
      'Que tal movimentar o CIM nesta sexta? ✈️',
      'Sexta com aeromodelo fora de casa fica melhor. ✈️',
      'Hoje tem espaço para CIM na programação. ✈️',
      'A pista está lá. Falta a turma aparecer. ✈️',
      'Sexta é um bom dia para movimentar o clube. ✈️',
      'Antes do fim de semana engrenar, venha ao CIM! ✈️'
    ],
    weekday: [
      'Hoje tem CIM! ✈️',
      'Dia de movimentar o CIM! ✈️',
      'O CIM merece movimento hoje. ✈️',
      'Que tal colocar o clube em movimento hoje? ✈️',
      'Dia de aeromodelismo também é dia de semana. ✈️',
      'A pista não precisa esperar o fim de semana. ✈️',
      'Hoje é um bom dia para lembrar do CIM. ✈️',
      'Venha colocar um pouco mais de movimento no CIM hoje. ✈️'
    ],
    tomorrowWeekday: [
      'Amanhã tem CIM! ✈️',
      'Amanhã é dia de movimentar o CIM! ✈️',
      'Já deixe o CIM na programação de amanhã. ✈️',
      'A pista também espera a turma amanhã. ✈️',
      'Amanhã combina com aeromodelismo no CIM. ✈️',
      'Que tal CIM amanhã? ✈️',
      'Amanhã vale colocar o clube em movimento. ✈️',
      'O convite para amanhã está feito: CIM. ✈️'
    ]
  };

  const BODIES = {
    good: [
      'Os números estão aí e o cenário está convidativo para voo.',
      'A previsão está interessante para colocar os modelos na pista.',
      'O tempo está colaborando e a pista merece movimento.',
      'O cenário está bom para aeromodelismo e melhor ainda com o clube movimentado.',
      'A previsão ajuda. Agora é hora de dar movimento à pista.',
      'Condição interessante para voo e uma boa razão para aparecer no clube.',
      'O dia tem cara de aeromodelismo. Vale conferir a biruta no campo e aproveitar.',
      'A meteorologia está ajudando a deixar o CIM ainda mais convidativo.'
    ],
    caution: [
      'Para o voo, vale conferir a biruta e as condições reais no campo. Para o clube, o convite é direto.',
      'Atenção normal às condições locais e escolha do modelo; o CIM continua pedindo movimento.',
      'A previsão pede alguma atenção na hora de voar, sem tirar o atrativo de estar no clube.',
      'O voo merece leitura da biruta e decisão de cada piloto. O encontro da turma continua valendo.',
      'Os números pedem atenção, não desânimo. A condição real no campo é que fecha a decisão de voo.',
      'Vale chegar, olhar a biruta e decidir o voo no campo. O clube, por si só, já vale a visita.',
      'Há pontos para observar antes de decolar, mas nada disso transforma o CIM em lugar para ficar vazio.',
      'A meteorologia pede atenção de piloto; a presença da turma só melhora o clube.'
    ],
    challenging: [
      'Para voar, as condições pedem mais atenção e decisão de cada piloto. Para estar no clube, o convite continua inteiro.',
      'O voo hoje merece cautela e conferência da condição real no campo. O encontro da turma continua valendo.',
      'Rajadas e vento merecem atenção antes de qualquer decolagem. Isso não tira o valor de movimentar o CIM.',
      'A decisão de voo é de cada piloto depois de olhar a condição real. O clube continua sendo o ponto de encontro.',
      'Para o voo, sem forçar a barra: biruta, modelo adequado e decisão no campo. Para a turma, CIM continua sendo CIM.',
      'A meteorologia pode deixar o voo mais seletivo, mas não precisa deixar o clube vazio.',
      'O voo pode exigir mais critério hoje. A pista e a resenha continuam esperando movimento.',
      'Condição mais exigente para voar; motivo nenhum para o CIM perder o encontro da turma.'
    ],
    bad: [
      'A meteorologia pode limitar o voo, então nada de insistir. O CIM continua sendo ponto de encontro da turma.',
      'Se as condições não forem adequadas para decolar, o voo fica no chão. O clube não precisa ficar vazio.',
      'Para voo, prevalece a segurança e a condição real no campo. Para convivência, o CIM continua valendo a visita.',
      'Hoje a meteorologia pode mandar nos voos, mas não precisa mandar na movimentação do clube.',
      'Sem condição segura, modelo no chão. Ainda assim, conversa e resenha fazem parte do CIM.',
      'O voo pode ficar limitado hoje; a convivência no clube, não.',
      'Condição ruim não é convite para arriscar voo. É apenas mais um motivo para a resenha ganhar espaço.',
      'Se a biruta e o tempo disserem não ao voo, respeite. O encontro da turma continua possível.'
    ]
  };

  const CLOSERS = [
    'Venha ao CIM. O voo depende das condições; o papo e a resenha, não. ✈️',
    'Venha ao CIM e ajude a movimentar o clube. Pista cheia ou muita resenha, o importante é ter turma por lá. ✈️',
    'Venha ao CIM. Aeromodelismo também é encontro, conversa e clube vivo. ✈️',
    'Venha ao CIM. Quando a turma aparece, o clube ganha vida. ✈️',
    'Venha ao CIM e coloque mais movimento no clube. Voo e resenha fazem parte do pacote. ✈️',
    'Venha ao CIM. Modelo na pista é ótimo; turma reunida também. ✈️',
    'Venha ao CIM. O objetivo é simples: mais gente, mais movimento e mais aeromodelismo no clube. ✈️',
    'Venha ao CIM e faça parte da movimentação. O clube fica melhor com a turma por perto. ✈️'
  ];

  function readHistory() {
    try {
      const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_) {
      return [];
    }
  }

  function writeHistory(history) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-16000)));
    } catch (_) {
      // A mensagem continua funcionando mesmo se o navegador bloquear armazenamento local.
    }
  }

  function randomIndex(max) {
    if (max <= 1) return 0;
    try {
      if (crypto?.getRandomValues) {
        const a = new Uint32Array(1);
        crypto.getRandomValues(a);
        return a[0] % max;
      }
    } catch (_) {}
    return Math.floor(Math.random() * max);
  }

  function targetDate(dayWord) {
    const now = new Date();
    return dayWord === 'amanhã' ? new Date(now.getTime() + 24 * 60 * 60 * 1000) : now;
  }

  function dayContext(dayWord) {
    const date = targetDate(dayWord);
    const weekday = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      timeZone: TIMEZONE
    }).format(date);

    if (weekday === 'Sat') return 'saturday';
    if (weekday === 'Sun') return 'sunday';
    if (weekday === 'Fri') return 'friday';
    return dayWord === 'amanhã' ? 'tomorrowWeekday' : 'weekday';
  }

  function panelLevel() {
    const panel = document.querySelector('#today-cim');
    if (!panel) return 'caution';
    if (panel.classList.contains('bad')) return 'bad';
    if (panel.classList.contains('challenging')) return 'challenging';
    if (panel.classList.contains('good')) return 'good';
    return 'caution';
  }

  function pickEditorial(context, level) {
    const openers = OPENERS[context] || OPENERS.weekday;
    const bodies = BODIES[level] || BODIES.caution;
    const history = readHistory();
    const used = new Set(history);
    const candidates = [];

    for (let oi = 0; oi < openers.length; oi++) {
      for (let bi = 0; bi < bodies.length; bi++) {
        for (let ci = 0; ci < CLOSERS.length; ci++) {
          const key = `${context}:${level}:${oi}:${bi}:${ci}`;
          if (!used.has(key)) candidates.push({ key, oi, bi, ci });
        }
      }
    }

    // São 512 combinações por contexto/condição. Só recicla depois de esgotar todas.
    const pool = candidates.length ? candidates : (() => {
      const prefix = `${context}:${level}:`;
      const filtered = history.filter(key => !String(key).startsWith(prefix));
      writeHistory(filtered);
      const all = [];
      for (let oi = 0; oi < openers.length; oi++) {
        for (let bi = 0; bi < bodies.length; bi++) {
          for (let ci = 0; ci < CLOSERS.length; ci++) all.push({ key: `${context}:${level}:${oi}:${bi}:${ci}`, oi, bi, ci });
        }
      }
      return all;
    })();

    const picked = pool[randomIndex(pool.length)];
    const nextHistory = readHistory();
    nextHistory.push(picked.key);
    writeHistory(nextHistory);

    return {
      opener: openers[picked.oi],
      body: bodies[picked.bi],
      closer: CLOSERS[picked.ci]
    };
  }

  function extractBase(text) {
    const lines = String(text || '').split('\n').map(x => x.trim()).filter(Boolean);
    const header = lines.find(x => /^✈️\s*CIM\s*—/i.test(x)) || '✈️ CIM — hoje';
    const facts = lines.find(x => /^Cabeceira\s+/i.test(x)) || '';
    const daylight = lines.find(x => /^☀️\s*/.test(x)) || '';
    const dayWord = /amanhã/i.test(header) ? 'amanhã' : 'hoje';
    return { header, facts, daylight, dayWord };
  }

  function buildEditorialMessage() {
    if (typeof briefingState === 'undefined' || !briefingState.shareText) return '';

    const base = extractBase(briefingState.shareText);
    const level = panelLevel();
    const context = dayContext(base.dayWord);
    const editorial = pickEditorial(context, level);

    const lines = [base.header];
    if (base.facts) lines.push(base.facts);
    if (base.daylight) lines.push(base.daylight);
    lines.push('', editorial.opener, editorial.body, editorial.closer, SITE_URL);

    let text = lines.join('\n');
    if (typeof briefingTextWithAttendance === 'function') {
      text = briefingTextWithAttendance(text);
    }
    return text;
  }

  function shareEditorial(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    const text = buildEditorialMessage();
    if (!text) return;

    window.location.href = `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  const button = document.querySelector('#today-cim-share');
  if (button) {
    // Captura antes do listener legado de briefing.js, garantindo uma única abertura do WhatsApp.
    button.addEventListener('click', shareEditorial, true);
  }
})();

import('./cim-pulse.js?v=20260910-1').catch(error => console.error('[CIM Pulse loader]', error));
