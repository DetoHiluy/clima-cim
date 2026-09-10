(() => {
  'use strict';

  const nativeFetch = window.fetch.bind(window);
  window.fetch = function(input, init) {
    try {
      const raw = typeof input === 'string' ? input : (input && input.url) || '';
      if (raw.includes('api.open-meteo.com/v1/forecast') && raw.includes('wind_speed_10m')) {
        const url = new URL(raw, window.location.href);
        const hourly = (url.searchParams.get('hourly') || '').split(',').filter(Boolean);
        if (!hourly.includes('temperature_2m')) {
          hourly.unshift('temperature_2m');
          url.searchParams.set('hourly', hourly.join(','));
        }
        if (typeof input === 'string') return nativeFetch(url.toString(), init);
        return nativeFetch(new Request(url.toString(), input), init);
      }
    } catch (_) {}
    return nativeFetch(input, init);
  };
})();