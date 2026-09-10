(() => {
  'use strict';

  const CLEAN_BRIEFING_PHOTO = 'assets/cim-briefing-hero-clean.webp?v=20260910-clean1';
  const nativeFetch = window.fetch.bind(window);

  window.fetch = function(input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.includes('assets/cim-pista-hero.webp') && init && init.cache === 'no-store') {
      return nativeFetch(CLEAN_BRIEFING_PHOTO, { ...init, cache: 'no-store' });
    }
    return nativeFetch(input, init);
  };
})();
