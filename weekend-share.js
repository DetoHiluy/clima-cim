(() => {
  'use strict';

  const SITE_URL = 'https://detohiluy.github.io/clima-cim/';

  function text(selector) {
    return document.querySelector(selector)?.textContent?.trim() || '';
  }

  function useful(value) {
    return value && !/^(--|aguarde|calculando|carregando|consultando)/i.test(value);
  }

  function buildCurrentMessage() {
    const weather = text('#weather-description');
    const temperature = text('#temperature');
    const windSpeed = text('#wind-speed');
    const windDirection = text('#wind-direction-text');
    const gust = text('#wind-gust');
    const rain = text('#rain-probability');
    const rainNext = text('#rain-total');
    const runway = text('#preferred-runway');
    const updated = text('#updated-at');

    const lines = ['✈️ CIM — condições agora'];

    if (useful(weather) || useful(temperature)) {
      lines.push(`🌦️ ${[weather, temperature].filter(useful).join(' · ')}`);
    }

    const windParts = [];
    if (useful(windSpeed)) windParts.push(`vento ${windSpeed} km/h`);
    if (useful(windDirection)) windParts.push(windDirection);
    if (useful(gust)) windParts.push(`rajadas ${gust}`);
    if (windParts.length) lines.push(`💨 ${windParts.join(' · ')}`);

    if (useful(runway)) lines.push(`🛬 ${runway}`);

    const rainParts = [];
    if (useful(rain)) rainParts.push(`precipitação ${rain}`);
    if (useful(rainNext)) rainParts.push(rainNext);
    if (rainParts.length) lines.push(`🌧️ ${rainParts.join(' · ')}`);

    if (useful(updated)) lines.push(`🕒 ${updated}`);

    lines.push(
      '',
      'Dados do painel meteorológico do CIM. Confirme sempre a biruta, o céu e as condições reais no campo antes de voar.',
      SITE_URL
    );

    return lines.join('\n');
  }

  function shareCurrent(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    const message = buildCurrentMessage();
    window.location.href = `https://wa.me/?text=${encodeURIComponent(message)}`;
  }

  const button = document.querySelector('#today-cim-share');
  if (!button) return;

  button.textContent = 'Compartilhar condições de agora';
  button.setAttribute('aria-label', 'Compartilhar no WhatsApp as condições atuais do CIM');

  // O botão público compartilha apenas dados objetivos. A avaliação FAVORÁVEL /
  // ATENÇÃO / DESAFIADOR / DESFAVORÁVEL permanece visível no site, mas não é
  // enviada pelo WhatsApp: o destinatário faz seu próprio julgamento.
  button.addEventListener('click', shareCurrent, true);
})();
