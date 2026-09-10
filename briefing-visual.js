(() => {
  'use strict';

  const W=1080,H=1350,TZ='America/Fortaleza';
  const LOGO='assets/cim-logo-oficial.webp?v=20260910-1';
  const SITE='detohiluy.github.io/clima-cim';
  const RWY={13:109.8,31:289.8}, SNAP='cim_briefing_visual_snapshot_v1';
  let activeUrl='';

  const $=s=>document.querySelector(s);
  const tx=s=>$(s)?.textContent?.trim()||'';
  const n=v=>{const m=String(v??'').replace(',','.').match(/-?\d+(?:\.\d+)?/);return m?Number(m[0]):NaN};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
  const fmt=(v,u='',d=0)=>Number.isFinite(v)?`${v.toLocaleString('pt-BR',{maximumFractionDigits:d})}${u}`:'—';

  function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
  function rand(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
  function point(r,h,cx=540,cy=650){const q=h*Math.PI/180;return{x:cx+Math.sin(q)*r,y:cy-Math.cos(q)*r}}
  function comp(dir,speed,heading){
    if(!Number.isFinite(dir)||!Number.isFinite(speed))return null;
    const d=((dir-heading+540)%360)-180, head=speed*Math.cos(d*Math.PI/180), cross=speed*Math.sin(d*Math.PI/180);
    return{head,proa:Math.max(0,head),cauda:Math.max(0,-head),atraves:Math.abs(cross)};
  }
  function rwy(dir,speed){
    const a=comp(dir,speed,RWY[13]),b=comp(dir,speed,RWY[31]);
    return{c13:a,c31:b,preferred:a&&b?(a.head>=b.head?'13':'31'):'—'};
  }
  function clock(v,f=0){const m=String(v||'').match(/(\d{1,2}):(\d{2})/);return m?+m[1]+(+m[2]/60):f}
  function dateInfo(){
    const d=new Date();
    return{
      weekday:new Intl.DateTimeFormat('pt-BR',{weekday:'long',timeZone:TZ}).format(d).toUpperCase(),
      date:new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',year:'numeric',timeZone:TZ}).format(d).replace('.','').toUpperCase(),
      time:new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:TZ}).format(d)
    };
  }
  function hours(){
    try{
      if(typeof briefingState==='undefined'||!briefingState.lastData||typeof briefingBuildHours!=='function')return[];
      return briefingBuildHours(briefingState.lastData,0,new Date()).hours.slice(0,4).map(h=>({
        time:typeof briefingHour==='function'?briefingHour(h.time):'—',
        wind:+h.windSpeed||0,gust:+h.gust||0,pop:+h.pop||0,precip:+h.precip||0
      }));
    }catch(_){return[]}
  }
  function collect(){
    const wind=n(tx('#wind-speed')),dir=n(tx('#wind-direction')),gust=n(tx('#wind-gust'));
    const rain=n(tx('#rain-probability')),rainMeta=tx('#rain-total');
    return{
      ...dateInfo(), wind,dir,gust,spread:Number.isFinite(gust)&&Number.isFinite(wind)?Math.max(0,gust-wind):0,
      rain,rainPop:n(rainMeta),vis:n(tx('#visibility')),temp:n(tx('#temperature')),
      sunrise:tx('#sunrise').replace(/^Nascer\s*/i,'')||'—', sunset:tx('#sunset')||'—',
      cardinal:tx('#wind-direction-text').replace(/^Direção\s*/i,'').replace(/\s*·.*$/,'').trim(),
      runway:rwy(dir,wind), hours:hours(), metarAge:tx('#metar-age')
    };
  }

  function loadSnap(){try{return JSON.parse(localStorage.getItem(SNAP)||'null')}catch(_){return null}}
  function saveSnap(d){try{localStorage.setItem(SNAP,JSON.stringify({ts:Date.now(),wind:d.wind,dir:d.dir,gust:d.gust,rain:d.rain,vis:d.vis}))}catch(_){}}
  function dirDelta(a,b){if(!Number.isFinite(a)||!Number.isFinite(b))return null;return Math.round(((a-b+540)%360)-180)}
  function delta(d,p){
    if(!p?.ts)return'PRIMEIRA LEITURA NESTE DISPOSITIVO';
    const out=[],mins=Math.max(1,Math.round((Date.now()-p.ts)/60000));
    const add=(l,a,b,u='')=>{if(!Number.isFinite(a)||!Number.isFinite(b))return;const x=a-b;out.push(Math.abs(x)<.05?`${l} =`:`${l} ${x>0?'+':'−'}${Math.abs(Math.round(x))}${u}`)};
    add('VENTO',d.wind,p.wind); const dd=dirDelta(d.dir,p.dir); if(dd!==null)out.push(dd?`DIR ${dd>0?'+':'−'}${Math.abs(dd)}°`:'DIR =');
    add('RAJ',d.gust,p.gust);
    if(Number.isFinite(d.rain)&&Number.isFinite(p.rain)){const x=d.rain-p.rain;out.push(Math.abs(x)<.05?'CHUVA =':`CHUVA ${x>0?'+':'−'}${Math.abs(x).toLocaleString('pt-BR',{maximumFractionDigits:1})} mm`)}
    add('VIS',d.vis,p.vis,' km');
    return`${mins} MIN · ${out.slice(0,4).join(' · ')}`;
  }

  function flow(d){
    const r=rand(hash([Math.round((d.dir||0)/5),Math.round(d.wind||0),Math.round(d.gust||0),Math.round((d.rain||0)*10),Math.round((d.vis||0)*10),d.date].join('|')));
    const count=Math.round(clamp(24+(d.wind||0)*.55+d.spread*.35,24,46));
    const amp=clamp(12+d.spread*1.6+(d.rain||0)*5,12,62), vis=Number.isFinite(d.vis)?clamp(d.vis/10,.35,1):.75;
    const paths=[];
    for(let i=0;i<count;i++){
      const y=-170+i*(1690/Math.max(1,count-1)),a=amp*(.45+r()*.95),b=(r()-.5)*a,c=(r()-.5)*a;
      const dash=r()>.72?`stroke-dasharray="${40+Math.round(r()*90)} ${18+Math.round(r()*45)}"`:'';
      paths.push(`<path d="M-330 ${y.toFixed(1)} C80 ${(y+b).toFixed(1)},650 ${(y+c).toFixed(1)},1410 ${y.toFixed(1)}" fill="none" stroke="url(#flow)" stroke-width="${(.8+r()*2.1+clamp((d.wind||0)/55,0,1)).toFixed(1)}" opacity="${((.08+r()*.25)*vis).toFixed(2)}" ${dash}/>`);
    }
    return`<g transform="rotate(${(Number.isFinite(d.dir)?(d.dir+90)%360:90).toFixed(1)} 540 675)">${paths.join('')}</g>`;
  }
  function rain(d){
    const intensity=Math.max(Number.isFinite(d.rain)?d.rain:0,Number.isFinite(d.rainPop)?d.rainPop/100:0);
    if(intensity<.15)return'';
    const r=rand(hash(`rain|${d.date}|${Math.round(intensity*100)}|${Math.round(d.dir||0)}`)),parts=[];
    const count=Math.round(clamp(18+intensity*28,18,90)),drift=Number.isFinite(d.dir)?Math.sin(d.dir*Math.PI/180)*26:8;
    for(let i=0;i<count;i++){const x=r()*W,y=250+r()*850,l=12+r()*38;parts.push(`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x+drift).toFixed(1)}" y2="${(y+l).toFixed(1)}" stroke="#7fd4f6" stroke-width="${(1+r()*2).toFixed(1)}" opacity="${(.08+r()*.28).toFixed(2)}"/>`)}
    return`<g>${parts.join('')}</g>`;
  }
  function runway(d){
    const cx=540,cy=650,half=198;
    const p13=point(half,RWY[31]),p31=point(half,RWY[13]),l13=point(half+42,RWY[31]),l31=point(half+42,RWY[13]);
    const wf=Number.isFinite(d.dir)?point(285,d.dir):null,wt=Number.isFinite(d.dir)?point(238,(d.dir+180)%360):null;
    return`<g>
      <circle cx="${cx}" cy="${cy}" r="256" fill="#03121d" fill-opacity=".64" stroke="#284f66" stroke-width="1.5"/>
      <circle cx="${cx}" cy="${cy}" r="216" fill="none" stroke="#17425a" stroke-width="1" stroke-dasharray="3 10"/>
      <text x="${cx}" y="${cy-280}" text-anchor="middle" class="micro">N</text>
      <line x1="${p31.x}" y1="${p31.y}" x2="${p13.x}" y2="${p13.y}" stroke="#e7f4fa" stroke-width="34" stroke-linecap="round"/>
      <line x1="${p31.x}" y1="${p31.y}" x2="${p13.x}" y2="${p13.y}" stroke="#0c2332" stroke-width="24" stroke-linecap="round"/>
      <line x1="${p31.x}" y1="${p31.y}" x2="${p13.x}" y2="${p13.y}" stroke="#fff" stroke-width="2.8" stroke-dasharray="28 22" opacity=".9"/>
      <text x="${l13.x}" y="${l13.y}" text-anchor="middle" dominant-baseline="middle" class="runway-no ${d.runway.preferred==='13'?'preferred':''}">13</text>
      <text x="${l31.x}" y="${l31.y}" text-anchor="middle" dominant-baseline="middle" class="runway-no ${d.runway.preferred==='31'?'preferred':''}">31</text>
      ${wf&&wt?`<line x1="${wf.x}" y1="${wf.y}" x2="${wt.x}" y2="${wt.y}" stroke="#67cdf4" stroke-width="7" stroke-linecap="round" marker-end="url(#arrow)"/>`:''}
    </g>`;
  }
  function ctext(c){return c?`P ${Math.round(c.proa)} · T ${Math.round(c.atraves)} · C ${Math.round(c.cauda)}`:'—'}
  function daylight(d){
    const a=clock(d.sunrise,5.5),b=clock(d.sunset,17.7),now=clock(d.time,a),x1=128,x2=952,y=1066,x=x1+(x2-x1)*clamp((now-a)/Math.max(.1,b-a),0,1);
    return`<text x="128" y="1022" class="section">LUZ DO DIA</text>
      <line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#224d65" stroke-width="5" stroke-linecap="round"/>
      <line x1="${x1}" y1="${y}" x2="${x}" y2="${y}" stroke="#69cdf4" stroke-width="5" stroke-linecap="round"/>
      <circle cx="${x1}" cy="${y}" r="8" fill="#f7c65b"/><circle cx="${x2}" cy="${y}" r="8" fill="#f7c65b"/><circle cx="${x}" cy="${y}" r="11" fill="#fff" stroke="#69cdf4" stroke-width="5"/>
      <text x="${x1}" y="${y+37}" class="small">${esc(d.sunrise)} · NASCER</text><text x="${x2}" y="${y+37}" text-anchor="end" class="small">${esc(d.sunset)} · PÔR</text>
      <text x="${x}" y="${y-22}" text-anchor="middle" class="micro bright">AGORA</text>`;
  }
  function hourStrip(d){
    const xs=[128,350,572,794];
    return d.hours.slice(0,4).map((h,i)=>`<g transform="translate(${xs[i]} 0)"><text y="1178" class="hour">${esc(h.time)}</text><text y="1211" class="small">${fmt(h.wind)} · G${fmt(h.gust)}</text><text y="1240" class="small">${fmt(h.precip,' mm',1)} · ${fmt(h.pop,'%')}</text></g>`).join('');
  }
  async function dataUrl(src){
    const res=await fetch(src,{cache:'no-store'});if(!res.ok)throw new Error(`asset ${res.status}`);const blob=await res.blob();
    return new Promise((ok,fail)=>{const f=new FileReader();f.onload=()=>ok(f.result);f.onerror=fail;f.readAsDataURL(blob)});
  }

  function svg(d,logo,previous){
    const halo=clamp(340+(Number.isFinite(d.vis)?d.vis:10)*16,380,540);
    return`<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <radialGradient id="space" cx="50%" cy="46%" r="70%"><stop offset="0" stop-color="#0b3249"/><stop offset=".48" stop-color="#071f31"/><stop offset="1" stop-color="#020b12"/></radialGradient>
      <linearGradient id="flow" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2e95c5" stop-opacity="0"/><stop offset=".35" stop-color="#4ab8e8"/><stop offset=".72" stop-color="#fff"/><stop offset="1" stop-color="#6dd2f7" stop-opacity=".1"/></linearGradient>
      <radialGradient id="halo"><stop offset="0" stop-color="#61c9f2" stop-opacity=".18"/><stop offset=".48" stop-color="#2b84ad" stop-opacity=".08"/><stop offset="1" stop-color="#071725" stop-opacity="0"/></radialGradient>
      <marker id="arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9Z" fill="#67cdf4"/></marker>
      <filter id="glow"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <style>text{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif}.micro{fill:#8fb4c8;font-size:17px;font-weight:800;letter-spacing:2.4px}.bright{fill:#bfeaff}.section{fill:#65c9f1;font-size:19px;font-weight:900;letter-spacing:2.8px}.big{fill:#fff;font-size:60px;font-weight:900;letter-spacing:-1px}.metric{fill:#fff;font-size:42px;font-weight:850}.metric-label{fill:#86aabd;font-size:16px;font-weight:700;letter-spacing:1.6px}.small{fill:#97b4c4;font-size:16px;font-weight:600}.hour{fill:#fff;font-size:25px;font-weight:850}.runway-no{fill:#8eafbf;font-size:31px;font-weight:900}.runway-no.preferred{fill:#fff;filter:url(#glow)}</style>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#space)"/><circle cx="540" cy="650" r="${halo}" fill="url(#halo)"/>${flow(d)}${rain(d)}
    <rect x="48" y="44" width="312" height="122" rx="26" fill="#fff" fill-opacity=".97"/><image href="${logo}" x="66" y="56" width="276" height="96" preserveAspectRatio="xMidYMid meet"/>
    <text x="1018" y="67" text-anchor="end" class="micro">${esc(d.weekday)}</text><text x="1018" y="97" text-anchor="end" fill="#fff" font-size="27" font-weight="900">${esc(d.date)}</text><text x="1018" y="126" text-anchor="end" class="small">ATUALIZADO ${esc(d.time)}</text>
    <text x="48" y="244" class="micro bright">CIM // CONDIÇÕES AGORA</text><text x="48" y="320" class="big">BRIEFING VISUAL</text><text x="48" y="356" class="small">Leitura visual das condições meteorológicas no campo.</text>
    <g transform="translate(48 405)"><text class="section">CONDIÇÕES</text>
      <text x="0" y="58" class="metric">${fmt(d.wind)}</text><text x="0" y="84" class="metric-label">VENTO · KM/H</text>
      <text x="188" y="58" class="metric">${fmt(d.gust)}</text><text x="188" y="84" class="metric-label">RAJADA · KM/H</text>
      <text x="378" y="58" class="metric">${fmt(d.rain,'',1)}</text><text x="378" y="84" class="metric-label">CHUVA · MM</text>
      <text x="568" y="58" class="metric">${fmt(d.vis)}</text><text x="568" y="84" class="metric-label">VIS · KM</text>
      <text x="758" y="58" class="metric">${fmt(d.temp)}°</text><text x="758" y="84" class="metric-label">TEMPERATURA</text></g>
    ${runway(d)}
    <text x="92" y="612" class="section">PISTA 13/31</text><text x="92" y="650" fill="#fff" font-size="24" font-weight="850">CABECEIRA ${esc(d.runway.preferred)}</text><text x="92" y="682" class="small">maior componente de proa</text>
    <text x="92" y="747" class="micro">13 · ${esc(ctext(d.runway.c13))}</text><text x="92" y="782" class="micro">31 · ${esc(ctext(d.runway.c31))}</text><text x="92" y="845" class="small">${Number.isFinite(d.dir)?`${Math.round(d.dir)}°`:'—'} · ${esc(d.cardinal||'direção')}</text>
    <g transform="translate(48 914)"><text class="section">DESDE A ÚLTIMA LEITURA</text><text y="39" fill="#d8edf7" font-size="19" font-weight="700">${esc(delta(d,previous))}</text></g>
    ${daylight(d)}<text x="128" y="1142" class="section">PRÓXIMAS HORAS</text>${hourStrip(d)}
    <line x1="48" y1="1286" x2="1032" y2="1286" stroke="#23485e"/><text x="48" y="1318" class="small">MODELO · CIM (-3.845481, -38.460447)</text><text x="48" y="1343" class="small">METAR SBFZ · observação regional${d.metarAge?` · ${esc(d.metarAge)}`:''}</text><text x="1032" y="1334" text-anchor="end" fill="#69cdf4" font-size="15" font-weight="850">${SITE}</text>
    </svg>`;
  }

  async function png(markup){
    const u=URL.createObjectURL(new Blob([markup],{type:'image/svg+xml;charset=utf-8'}));
    try{const img=await new Promise((ok,fail)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=fail;i.src=u});const c=document.createElement('canvas');c.width=W;c.height=H;c.getContext('2d').drawImage(img,0,0,W,H);return await new Promise(ok=>c.toBlob(ok,'image/png',.96))}finally{URL.revokeObjectURL(u)}
  }
  function ui(){
    if($('#cim-briefing-overlay'))return;
    const style=document.createElement('style');style.textContent='.cim-briefing-overlay{position:fixed;inset:0;background:rgba(1,8,13,.9);backdrop-filter:blur(18px);z-index:9999;display:none;align-items:center;justify-content:center;padding:24px}.cim-briefing-overlay.open{display:flex}.cim-briefing-shell{width:min(94vw,620px);max-height:94vh;display:flex;flex-direction:column;gap:14px}.cim-briefing-preview{background:#020b12;border:1px solid rgba(104,203,244,.28);border-radius:22px;overflow:auto;box-shadow:0 28px 90px rgba(0,0,0,.45)}.cim-briefing-preview img{display:block;width:100%;height:auto}.cim-briefing-actions{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}.cim-briefing-actions button{border:0;border-radius:999px;padding:12px 18px;font:700 14px system-ui;cursor:pointer}.cim-briefing-primary{background:#67cdf4;color:#02111b}.cim-briefing-secondary{background:#173042;color:#e8f5fb}@media(max-width:600px){.cim-briefing-overlay{padding:10px}.cim-briefing-shell{width:100%;max-height:98vh}.cim-briefing-actions{justify-content:stretch}.cim-briefing-actions button{flex:1}}';document.head.appendChild(style);
    const o=document.createElement('div');o.id='cim-briefing-overlay';o.className='cim-briefing-overlay';o.innerHTML='<div class="cim-briefing-shell" role="dialog" aria-modal="true" aria-label="Prévia do briefing visual do CIM"><div class="cim-briefing-preview"><img id="cim-briefing-preview-image" alt="Briefing visual meteorológico do CIM"></div><div class="cim-briefing-actions"><button id="cim-briefing-close" class="cim-briefing-secondary">Fechar</button><button id="cim-briefing-save" class="cim-briefing-secondary">Salvar PNG</button><button id="cim-briefing-share" class="cim-briefing-primary">Compartilhar</button></div></div>';document.body.appendChild(o);$('#cim-briefing-close').onclick=()=>o.classList.remove('open');o.onclick=e=>{if(e.target===o)o.classList.remove('open')};
  }
  async function show(){
    const b=$('#today-cim-briefing-visual'),old=b?.textContent||'Gerar briefing visual';if(b){b.disabled=true;b.textContent='Gerando briefing…'}
    try{
      const d=collect();if(!Number.isFinite(d.wind)||!Number.isFinite(d.dir)||!Number.isFinite(d.temp))throw new Error('dados ainda não carregados');
      const mark=svg(d,await dataUrl(LOGO),loadSnap()),blob=await png(mark);if(!blob)throw new Error('PNG vazio');
      if(activeUrl)URL.revokeObjectURL(activeUrl);activeUrl=URL.createObjectURL(blob);
      const file=new File([blob],`cim-briefing-${new Intl.DateTimeFormat('en-CA',{timeZone:TZ}).format(new Date())}.png`,{type:'image/png'});
      ui();$('#cim-briefing-preview-image').src=activeUrl;$('#cim-briefing-overlay').classList.add('open');
      $('#cim-briefing-share').onclick=async()=>{try{if(navigator.share&&navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:'Briefing visual do CIM'});else{const a=document.createElement('a');a.href=activeUrl;a.download=file.name;a.click()}}finally{saveSnap(d)}};
      $('#cim-briefing-save').onclick=()=>{const a=document.createElement('a');a.href=activeUrl;a.download=file.name;a.click();saveSnap(d)};
    }catch(e){console.error('[Briefing visual CIM]',e);alert('Não foi possível gerar o briefing visual agora. Aguarde os dados do painel e tente novamente.')}finally{if(b){b.disabled=false;b.textContent=old}}
  }
  function install(){
    const s=$('#today-cim-share');if(!s||$('#today-cim-briefing-visual'))return;
    const b=document.createElement('button');b.id='today-cim-briefing-visual';b.className='today-cim-share';b.type='button';b.textContent='Gerar briefing visual';b.setAttribute('aria-label','Gerar briefing visual meteorológico do CIM');s.insertAdjacentElement('afterend',b);b.onclick=show;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();