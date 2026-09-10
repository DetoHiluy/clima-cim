(() => {
  'use strict';

  const W = 1080;
  const H = 1350;
  const SITE_URL = 'detohiluy.github.io/clima-cim';
  const HERO = 'assets/cim-pista-hero.webp?v=20260901-final1';

  const $ = s => document.querySelector(s);
  const txt = s => $(s)?.textContent?.trim() || '';
  const valid = v => v && !/^(--|aguarde|calculando|carregando|consultando)/i.test(v);

  function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
  }

  function fitText(ctx, text, x, y, maxWidth, fontSize, weight = 700) {
    let size = fontSize;
    do {
      ctx.font = `${weight} ${size}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      if (ctx.measureText(text).width <= maxWidth) break;
      size -= 2;
    } while (size > 20);
    ctx.fillText(text, x, y);
  }

  function label(ctx, text, x, y) {
    ctx.fillStyle = '#f5c400';
    ctx.font = '800 26px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(text.toUpperCase(), x, y);
  }

  function metric(ctx, x, y, w, title, value, detail = '') {
    roundRect(ctx, x, y, w, 126, 22, 'rgba(5,29,50,.92)', 'rgba(56,150,205,.75)');
    ctx.fillStyle = '#9eb7c9';
    ctx.font = '600 20px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(title, x + 24, y + 34);
    ctx.fillStyle = '#fff';
    fitText(ctx, value || '—', x + 24, y + 78, w - 48, 34, 800);
    if (detail) {
      ctx.fillStyle = '#9eb7c9';
      ctx.font = '500 17px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      fitText(ctx, detail, x + 24, y + 106, w - 48, 17, 500);
    }
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function collect() {
    const now = new Date();
    const date = new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Fortaleza'
    }).format(now);
    const time = new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Fortaleza'
    }).format(now);

    return {
      date,
      time,
      weather: txt('#weather-description'),
      temperature: txt('#temperature'),
      humidity: txt('#humidity'),
      pressure: txt('#pressure'),
      visibility: txt('#visibility'),
      windSpeed: txt('#wind-speed'),
      windDirection: txt('#wind-direction-text'),
      gust: txt('#wind-gust'),
      runway: txt('#preferred-runway'),
      headwind: txt('#headwind-component'),
      headwindLabel: txt('#headwind-label'),
      crosswind: txt('#crosswind-component'),
      crosswindSide: txt('#crosswind-side'),
      rain: txt('#rain-probability'),
      rainNext: txt('#rain-total'),
      sunrise: txt('#sunrise'),
      sunset: txt('#sunset'),
      dew: txt('#dew-point'),
      feels: txt('#feels-like'),
      updated: txt('#updated-at'),
      hours: Array.from(document.querySelectorAll('#today-cim-hours > *')).slice(0, 4).map(el => el.textContent.trim().replace(/\s+/g, ' '))
    };
  }

  async function render() {
    const d = collect();
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#06192a';
    ctx.fillRect(0, 0, W, H);

    try {
      const hero = await loadImage(HERO);
      const scale = Math.max(W / hero.width, 430 / hero.height);
      const dw = hero.width * scale;
      const dh = hero.height * scale;
      ctx.drawImage(hero, (W - dw) / 2, (430 - dh) / 2, dw, dh);
      const grad = ctx.createLinearGradient(0, 0, 0, 440);
      grad.addColorStop(0, 'rgba(3,16,28,.20)');
      grad.addColorStop(.58, 'rgba(3,16,28,.45)');
      grad.addColorStop(1, '#06192a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, 455);
    } catch (_) {}

    ctx.fillStyle = '#fff';
    ctx.font = '900 70px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText('BRIEFING', 54, 98);
    ctx.fillStyle = '#f5c400';
    ctx.font = '900 63px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText('METEOROLÓGICO', 54, 158);
    ctx.fillStyle = '#fff';
    ctx.font = '800 27px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText('CENTRO INTEGRADO DE MODELISMO · CIM', 56, 204);
    ctx.font = '600 23px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText('Eusébio · Ceará · Pista 13/31 · 230 × 12 m', 56, 239);

    roundRect(ctx, 698, 46, 326, 118, 18, 'rgba(5,29,50,.92)', 'rgba(56,150,205,.75)');
    ctx.fillStyle = '#fff';
    ctx.font = '800 20px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    fitText(ctx, d.date.toUpperCase(), 720, 83, 280, 20, 800);
    ctx.fillStyle = '#f5c400';
    ctx.font = '700 22px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(`Atualização ${d.time}`, 720, 126);

    label(ctx, 'Condições atuais', 54, 402);
    const col = 306;
    metric(ctx, 54, 425, col, 'Tempo', d.weather, d.feels);
    metric(ctx, 387, 425, col, 'Temperatura', d.temperature, d.dew);
    metric(ctx, 720, 425, col, 'Umidade', d.humidity, d.pressure ? `Pressão ${d.pressure}` : '');

    metric(ctx, 54, 568, col, 'Vento', valid(d.windSpeed) ? `${d.windSpeed} km/h` : '—', d.windDirection);
    metric(ctx, 387, 568, col, 'Rajadas', d.gust, d.visibility ? `Visibilidade ${d.visibility}` : '');
    metric(ctx, 720, 568, col, 'Precipitação', d.rain, d.rainNext);

    label(ctx, 'Pista 13/31', 54, 744);
    roundRect(ctx, 54, 768, 972, 246, 24, 'rgba(5,29,50,.94)', '#f5c400');
    ctx.fillStyle = '#9eb7c9';
    ctx.font = '600 21px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText('Cabeceira preferencial', 84, 814);
    ctx.fillStyle = '#fff';
    fitText(ctx, d.runway || '—', 84, 862, 430, 42, 900);

    ctx.strokeStyle = '#58758a';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(420, 856);
    ctx.lineTo(918, 856);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '900 38px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText('13', 386, 870);
    ctx.fillText('31', 930, 870);

    ctx.fillStyle = '#9eb7c9';
    ctx.font = '600 20px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText('Componente longitudinal', 84, 934);
    ctx.fillText('Componente de través', 540, 934);
    ctx.fillStyle = '#fff';
    fitText(ctx, d.headwind || '—', 84, 974, 390, 31, 800);
    fitText(ctx, d.crosswind || '—', 540, 974, 390, 31, 800);

    label(ctx, 'Sol e tendência', 54, 1061);
    metric(ctx, 54, 1085, 306, 'Nascer do sol', d.sunrise.replace(/^Nascer\s*/i, '') || '—', 'Operação visual');
    metric(ctx, 387, 1085, 306, 'Pôr do sol', d.sunset || '—', 'Período diurno');
    const tendency = d.hours.length ? d.hours[0] : 'Consulte a tendência horária no painel.';
    metric(ctx, 720, 1085, 306, 'Próximas horas', tendency, 'Veja o detalhamento no site');

    ctx.fillStyle = '#8fa8b9';
    ctx.font = '500 17px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText('Dados informativos. Confirme biruta, céu e condições reais no campo antes do voo.', 54, 1268);
    ctx.fillStyle = '#f5c400';
    ctx.font = '700 19px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(SITE_URL, 54, 1306);

    return canvas;
  }

  async function generateImage() {
    const button = $('#today-cim-image');
    const old = button?.textContent;
    if (button) { button.disabled = true; button.textContent = 'Gerando briefing…'; }
    try {
      const canvas = await render();
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.95));
      if (!blob) throw new Error('Falha ao gerar PNG');
      const file = new File([blob], `briefing-cim-${new Date().toISOString().slice(0,10)}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Briefing meteorológico do CIM' });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    } catch (err) {
      if (err?.name !== 'AbortError') alert('Não foi possível gerar o briefing agora. Atualize o painel e tente novamente.');
    } finally {
      if (button) { button.disabled = false; button.textContent = old || 'Gerar briefing em imagem'; }
    }
  }

  const shareButton = $('#today-cim-share');
  if (shareButton && !$('#today-cim-image')) {
    const button = document.createElement('button');
    button.id = 'today-cim-image';
    button.className = 'today-cim-share';
    button.type = 'button';
    button.textContent = 'Gerar briefing em imagem';
    button.setAttribute('aria-label', 'Gerar briefing meteorológico do CIM em imagem');
    shareButton.insertAdjacentElement('afterend', button);
    button.addEventListener('click', generateImage);
  }
})();
