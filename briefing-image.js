(() => {
  'use strict';

  const W = 1080, H = 1350;
  const TZ = 'America/Fortaleza';
  const HERO = 'assets/cim-pista-hero.webp?v=20260901-final1';
  const LOGO = 'assets/cim-logo-oficial.webp?v=20260910-1';
  const SITE = 'detohiluy.github.io/clima-cim';
  const RWY = { '13': 109.8, '31': 289.8 };
  const $ = s => document.querySelector(s);
  const t = s => $(s)?.textContent?.trim() || '';
  const esc = s => String(s ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
  const n = v => { const m = String(v ?? '').replace(',','.').match(/-?\d+(?:\.\d+)?/); return m ? Number(m[0]) : NaN; };
  const fmt = (v, d=0) => Number.isFinite(v) ? v.toLocaleString('pt-BR',{maximumFractionDigits:d}) : '—';

  function nowText() {
    return new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:TZ}).format(new Date());
  }

  function dateText() {
    const d = new Date();
    const weekday = new Intl.DateTimeFormat('pt-BR',{weekday:'long',timeZone:TZ}).format(d).toUpperCase();
    const short = new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',year:'numeric',timeZone:TZ}).format(d).replace('.','').toUpperCase();
    return { weekday, short };
  }

  function components(dir, speed, heading) {
    if (!Number.isFinite(dir) || !Number.isFinite(speed)) return null;
    const delta = ((dir - heading + 540) % 360) - 180;
    const head = speed * Math.cos(delta * Math.PI / 180);
    const cross = speed * Math.sin(delta * Math.PI / 180);
    return { proa: Math.max(0,head), cauda: Math.max(0,-head), atraves: Math.abs(cross), head };
  }

  function runwayData(dir, speed) {
    const a = components(dir,speed,RWY['13']);
    const b = components(dir,speed,RWY['31']);
    return { c13:a, c31:b, preferred: a && b ? (a.head >= b.head ? '13':'31') : '—' };
  }

  function point(cx,cy,r,heading) {
    const q = heading * Math.PI / 180;
    return { x:cx + Math.sin(q)*r, y:cy - Math.cos(q)*r };
  }

  function nextHours() {
    try {
      if (typeof briefingState === 'undefined' || !briefingState.lastData || typeof briefingBuildHours !== 'function') return [];
      const day = briefingBuildHours(briefingState.lastData,0,new Date());
      return day.hours.slice(0,4).map(h => ({
        time: typeof briefingHour === 'function' ? briefingHour(h.time) : '—',
        precip:Number(h.precip)||0, pop:Number(h.pop)||0,
        wind:Number(h.windSpeed)||0, gust:Number(h.gust)||0
      }));
    } catch (_) { return []; }
  }

  function collect() {
    const speed = n(t('#wind-speed'));
    const dir = n(t('#wind-direction'));
    const rain = n(t('#rain-probability'));
    const rainNext = t('#rain-total');
    return {
      date:dateText(), updated:nowText(),
      weather:t('#weather-description') || 'Condição meteorológica',
      feels:t('#feels-like').replace(/^Sensação:\s*/i,''),
      temp:t('#temperature') || '—', humidity:t('#humidity') || '—',
      pressure:t('#pressure') || '—', visibility:t('#visibility') || '—',
      speed, dir, gust:n(t('#wind-gust')),
      cardinal:t('#wind-direction-text').replace(/^Direção\s*/i,'').replace(/\s*·.*$/,'').trim(),
      rain, rainPop:n(rainNext), rainNext,
      sunrise:t('#sunrise').replace(/^Nascer\s*/i,'') || '—', sunset:t('#sunset') || '—',
      metarAge:t('#metar-age'), runway:runwayData(dir,speed), hours:nextHours()
    };
  }

  function runwayGraphic(d) {
    const cx=745, cy=746, p13=point(cx,cy,126,RWY['13']), p31=point(cx,cy,126,RWY['31']);
    let wind='';
    if (Number.isFinite(d.dir)) {
      const from=point(cx,cy,160,d.dir), to=point(cx,cy,112,(d.dir+180)%360);
      wind=`<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" class="wind" marker-end="url(#arrow)"/>`;
    }
    return `<g>
      <circle cx="${cx}" cy="${cy}" r="146" class="compass"/><text x="${cx}" y="582" text-anchor="middle" class="north">N</text>
      <line x1="${p31.x}" y1="${p31.y}" x2="${p13.x}" y2="${p13.y}" class="rwyO"/>
      <line x1="${p31.x}" y1="${p31.y}" x2="${p13.x}" y2="${p13.y}" class="rwyI"/>
      <line x1="${p31.x*.72+p13.x*.28}" y1="${p31.y*.72+p13.y*.28}" x2="${p31.x*.58+p13.x*.42}" y2="${p31.y*.58+p13.y*.42}" class="center"/>
      <line x1="${p31.x*.52+p13.x*.48}" y1="${p31.y*.52+p13.y*.48}" x2="${p31.x*.38+p13.x*.62}" y2="${p31.y*.38+p13.y*.62}" class="center"/>
      <line x1="${p31.x*.30+p13.x*.70}" y1="${p31.y*.30+p13.y*.70}" x2="${p31.x*.16+p13.x*.84}" y2="${p31.y*.16+p13.y*.84}" class="center"/>
      <text x="${p13.x+14}" y="${p13.y+8}" class="rnum">13</text><text x="${p31.x-42}" y="${p31.y+8}" class="rnum">31</text>${wind}
    </g>`;
  }

  function hour(h,x) {
    if (!h) return `<g transform="translate(${x},0)"><text y="1230" class="hour">—</text><text y="1260" class="detail">sem dado</text></g>`;
    return `<g transform="translate(${x},0)"><text y="1228" class="hour">${esc(h.time)}</text><text y="1260" class="detail">${fmt(h.precip,1)} mm · ${Math.round(h.pop)}%</text><text y="1290" class="detail">vento ${Math.round(h.wind)} · raj. ${Math.round(h.gust)}</text></g>`;
  }

  function comp(c,k) { return c && Number.isFinite(c[k]) ? Math.round(c[k]) : '—'; }
  function parseTime(v,fallback) { const m=String(v).match(/(\d{1,2}):(\d{2})/); return m ? Number(m[1])+Number(m[2])/60 : fallback; }

  function svg(d, hero, logo) {
    const rainActive = (Number.isFinite(d.rain) && d.rain >= .3) || (Number.isFinite(d.rainPop) && d.rainPop >= 60);
    const rainTitle = rainActive ? 'CHUVA AGORA' : 'PRECIPITAÇÃO';
    const rainValue = Number.isFinite(d.rain) ? `${fmt(d.rain,1)} mm` : '—';
    const rainInfo = Number.isFinite(d.rainPop) ? `Próxima hora ${Math.round(d.rainPop)}%` : (d.rainNext || 'Próxima hora —');
    const wind = Number.isFinite(d.speed) ? `${Math.round(d.speed)} km/h` : '—';
    const dir = Number.isFinite(d.dir) ? `${Math.round(d.dir)}°` : '—';
    const gust = Number.isFinite(d.gust) ? `${Math.round(d.gust)} km/h` : '—';
    const c13=d.runway.c13, c31=d.runway.c31;
    const ds=parseTime(d.sunrise,5.5), de=parseTime(d.sunset,17.7), now=parseTime(d.updated,ds);
    const nowX=56 + Math.max(0,Math.min(1,(now-ds)/Math.max(.1,de-ds)))*968;
    const weather = `${d.weather}${d.feels ? ` · sensação ${d.feels}`:''}`;

    return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
    <defs>
      <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#01101c" stop-opacity=".12"/><stop offset=".58" stop-color="#01101c" stop-opacity=".48"/><stop offset="1" stop-color="#041522" stop-opacity=".98"/></linearGradient>
      <linearGradient id="body" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#061b2c"/><stop offset="1" stop-color="#03111c"/></linearGradient>
      <marker id="arrow" markerWidth="9" markerHeight="9" refX="7.5" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9Z" fill="#59c4f1"/></marker>
      <style>text{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif}.label{fill:#6bcaf2;font-size:23px;font-weight:800;letter-spacing:.7px}.white{fill:#fff}.muted{fill:#a8c0cf}.metric{fill:#fff;font-size:38px;font-weight:800}.mlabel{fill:#9fb7c7;font-size:17px}.small{fill:#aec4d1;font-size:18px}.compass{fill:none;stroke:#315b74;stroke-width:2}.north{fill:#b8cbd7;font-size:18px;font-weight:800}.rwyO{stroke:#d8e2e8;stroke-width:26;stroke-linecap:round}.rwyI{stroke:#152d3d;stroke-width:18;stroke-linecap:round}.center{stroke:#fff;stroke-width:3;stroke-linecap:round}.rnum{fill:#fff;font-size:24px;font-weight:900}.wind{stroke:#59c4f1;stroke-width:8;stroke-linecap:round}.comp{fill:#fff;font-size:20px;font-weight:800}.hour{fill:#fff;font-size:23px;font-weight:800}.detail{fill:#a6becc;font-size:15px}</style>
    </defs>
    <rect width="1080" height="1350" fill="url(#body)"/>${hero?`<image href="${hero}" x="0" y="0" width="1080" height="350" preserveAspectRatio="xMidYMid slice"/>`:''}<rect width="1080" height="355" fill="url(#shade)"/>
    <rect x="48" y="34" width="300" height="126" rx="24" fill="#fff" fill-opacity=".97"/>${logo?`<image href="${logo}" x="62" y="45" width="272" height="104" preserveAspectRatio="xMidYMid meet"/>`:''}
    <rect x="760" y="34" width="272" height="120" rx="24" fill="#051d30" fill-opacity=".94" stroke="#4fb3e2" stroke-width="2"/><text x="788" y="73" class="white" font-size="25" font-weight="900">${esc(d.date.weekday)}</text><text x="788" y="108" fill="#6bcaf2" font-size="22" font-weight="800">${esc(d.date.short)}</text><text x="788" y="137" class="muted" font-size="16">ATUALIZADO ${esc(d.updated)}</text>
    <text x="48" y="230" class="white" font-size="64" font-weight="900" letter-spacing="1">BRIEFING</text><text x="48" y="292" fill="#6bcaf2" font-size="54" font-weight="900">METEOROLÓGICO</text><text x="50" y="331" fill="#d9e7ef" font-size="21" font-weight="800">CIM · EUSÉBIO/CE · PISTA 13/31 · 230 × 12 m</text>
    <text x="48" y="399" class="label">CONDIÇÕES AGORA</text><text x="48" y="430" class="small">MODELO · coordenadas do campo · ${esc(weather)}</text><line x1="48" y1="452" x2="1032" y2="452" stroke="#416b83" stroke-width="2"/>
    <text x="48" y="506" class="metric">${esc(d.temp)}</text><text x="48" y="535" class="mlabel">Temperatura</text><text x="250" y="506" class="metric">${esc(d.humidity)}</text><text x="250" y="535" class="mlabel">Umidade</text><text x="450" y="506" class="metric">${esc(d.pressure.replace(/\s*hPa/i,''))}</text><text x="450" y="535" class="mlabel">hPa</text><text x="650" y="506" class="metric">${esc(d.visibility)}</text><text x="650" y="535" class="mlabel">Visibilidade</text><text x="850" y="506" class="metric">${esc(rainValue)}</text><text x="850" y="535" class="mlabel">Precipitação</text>
    <rect x="48" y="568" width="984" height="354" rx="32" fill="#071f32" fill-opacity=".96" stroke="#3f87ad" stroke-width="2"/><text x="80" y="619" class="label">PISTA 13/31 · VENTO</text><text x="80" y="678" class="white" font-size="43" font-weight="900">${esc(dir)} · ${esc(wind)}</text><text x="80" y="716" class="small">${esc(d.cardinal || 'Direção do vento')} · rajadas ${esc(gust)}</text><text x="80" y="760" class="mlabel">MAIOR COMPONENTE DE PROA</text><text x="80" y="820" fill="#6bcaf2" font-size="58" font-weight="900">CABECEIRA ${esc(d.runway.preferred)}</text>${runwayGraphic(d)}
    <line x1="80" y1="848" x2="1000" y2="848" stroke="#294c61"/><text x="82" y="880" fill="#6bcaf2" font-size="21" font-weight="900">13</text><text x="130" y="880" class="comp">PROA ${comp(c13,'proa')}</text><text x="264" y="880" class="comp">TRAVÉS ${comp(c13,'atraves')}</text><text x="420" y="880" class="comp">CAUDA ${comp(c13,'cauda')}</text><text x="586" y="880" class="muted" font-size="21" font-weight="900">31</text><text x="634" y="880" class="comp">PROA ${comp(c31,'proa')}</text><text x="756" y="880" class="comp">TRAVÉS ${comp(c31,'atraves')}</text><text x="910" y="880" class="comp">CAUDA ${comp(c31,'cauda')}</text><text x="82" y="907" fill="#abc1cf" font-size="17">componentes em km/h · orientação verdadeira aproximada</text>
    <rect x="48" y="951" width="984" height="83" rx="20" fill="${rainActive?'#0b3652':'#081d2d'}" stroke="${rainActive?'#59c4f1':'#26485d'}" stroke-width="2"/><text x="76" y="986" class="label" font-size="21">${rainTitle}</text><text x="76" y="1020" class="white" font-size="31" font-weight="900">${esc(rainValue)}</text><text x="270" y="1019" class="small">${esc(rainInfo)}</text>
    <text x="48" y="1080" class="label">PERÍODO DIURNO</text><line x1="56" y1="1130" x2="1024" y2="1130" stroke="#5c8ba5" stroke-width="4" stroke-linecap="round"/><circle cx="56" cy="1130" r="8" fill="#f0b53c"/><circle cx="1024" cy="1130" r="8" fill="#f0b53c"/><circle cx="${nowX}" cy="1130" r="10" fill="#59c4f1"/><text x="56" y="1162" class="small" font-size="15">${esc(d.sunrise)} nascer</text><text x="${nowX}" y="1102" text-anchor="middle" fill="#59c4f1" font-size="16" font-weight="900">AGORA</text><text x="1024" y="1162" text-anchor="end" class="small" font-size="15">${esc(d.sunset)} pôr</text>
    <text x="48" y="1200" class="label">PRÓXIMAS HORAS</text>${hour(d.hours[0],48)}${hour(d.hours[1],294)}${hour(d.hours[2],540)}${hour(d.hours[3],786)}
    <line x1="48" y1="1310" x2="1032" y2="1310" stroke="#2f5064"/><text x="48" y="1334" fill="#8faaba" font-size="14">MODELO · CIM (-3.845481, -38.460447)</text><text x="360" y="1334" fill="#8faaba" font-size="14">METAR SBFZ · observação regional${d.metarAge?` · ${esc(d.metarAge)}`:''}</text><text x="1032" y="1334" text-anchor="end" fill="#59c4f1" font-size="14" font-weight="800">${SITE}</text>
    </svg>`;
  }

  async function dataUrl(src) {
    const r=await fetch(src,{cache:'no-store'}); if(!r.ok) throw new Error(`asset ${r.status}`);
    const blob=await r.blob();
    return await new Promise((resolve,reject)=>{ const f=new FileReader(); f.onload=()=>resolve(f.result); f.onerror=reject; f.readAsDataURL(blob); });
  }

  async function toPng(markup) {
    const url=URL.createObjectURL(new Blob([markup],{type:'image/svg+xml;charset=utf-8'}));
    try {
      const img=await new Promise((resolve,reject)=>{ const i=new Image(); i.onload=()=>resolve(i); i.onerror=reject; i.src=url; });
      const c=document.createElement('canvas'); c.width=W; c.height=H; c.getContext('2d').drawImage(img,0,0,W,H);
      return await new Promise(resolve=>c.toBlob(resolve,'image/png',.96));
    } finally { URL.revokeObjectURL(url); }
  }

  async function generate() {
    const button=$('#today-cim-image'), old=button?.textContent || 'Gerar briefing visual';
    if(button){ button.disabled=true; button.textContent='Gerando briefing…'; }
    try {
      const d=collect();
      if(!Number.isFinite(d.speed) || !d.temp || d.temp==='—') throw new Error('dados ainda não carregados');
      const [hero,logo]=await Promise.all([dataUrl(HERO).catch(()=>''),dataUrl(LOGO)]);
      const png=await toPng(svg(d,hero,logo)); if(!png) throw new Error('PNG vazio');
      const stamp=new Intl.DateTimeFormat('en-CA',{timeZone:TZ}).format(new Date());
      const file=new File([png],`briefing-cim-${stamp}.png`,{type:'image/png'});
      if(navigator.share && navigator.canShare?.({files:[file]})) await navigator.share({files:[file],title:'Briefing meteorológico do CIM'});
      else { const u=URL.createObjectURL(png), a=document.createElement('a'); a.href=u; a.download=file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(u),5000); }
    } catch(e) {
      if(e?.name!=='AbortError'){ console.error('[CIM briefing visual]',e); alert('Não foi possível gerar o briefing agora. Aguarde os dados do painel carregarem e tente novamente.'); }
    } finally { if(button){ button.disabled=false; button.textContent=old; } }
  }

  const share=$('#today-cim-share');
  if(share && !$('#today-cim-image')){
    const b=document.createElement('button'); b.id='today-cim-image'; b.className='today-cim-share'; b.type='button'; b.textContent='Gerar briefing visual'; b.setAttribute('aria-label','Gerar briefing meteorológico visual do CIM'); share.insertAdjacentElement('afterend',b); b.addEventListener('click',generate);
  }
})();
