(() => {
  'use strict';

  // Uma única fotografia limpa alimenta o briefing visual.
  // Este redirecionamento existe apenas para isolar a foto do briefing da foto usada no cabeçalho do site.
  const CLEAN_BRIEFING_PHOTO = 'assets/cim-briefing-hero-clean.webp?v=20260910-clean2';
  const nativeFetch = window.fetch.bind(window);

  window.fetch = function(input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.includes('assets/cim-pista-hero.webp') && init && init.cache === 'no-store') {
      return nativeFetch(CLEAN_BRIEFING_PHOTO, { ...init, cache: 'no-store' });
    }
    return nativeFetch(input, init);
  };
})();
