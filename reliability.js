(()=>{
  'use strict';

  const METAR_DIRECT='https://metars.eu/api/metars/SBFZ';
  const METAR_SECONDARY='https://metar.vatsim.net/SBFZ?format=json';
  const METAR_BACKUP='https://raw.githubusercontent.com/DetoHiluy/clima-cim/metar-data/data/metar.json';
  const MAX_DIRECT_AGE_MIN=90;
  const MAX_BACKUP_AGE_MIN=120;
  const nativeFetch=window.fetch.bind(window);
  const nativeSetInterval=window.setInterval.bind(window);
  const state=window.CIM_RELIABILITY={metarSource:'',metarLastSuccess:null,metarLastError:null};

  function isMetarCacheUrl(url){
    return /(?:raw\.githubusercontent\.com\/DetoHiluy\/clima-cim\/main\/data\/metar\.json|(?:^|\/)data\/metar\.json)(?:\?|$)/.test(url);
  }

  async function fetchJson(url,timeoutMs=6500){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const response=await nativeFetch(url,{cache:'no-store',signal:controller.signal,headers:{Accept:'application/json'},credentials:'omit'});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const type=response.headers.get('content-type')||'';
      if(!type.toLowerCase().includes('json'))throw new Error('resposta não JSON');
      return await response.json();
    }finally{
      clearTimeout(timer);
    }
  }

  function nearestMetarDate(value){
    if(value==null)return null;
    if(typeof value==='number'){
      const d=new Date(value>1e12?value:value*1000);
      return Number.isNaN(d.getTime())?null:d;
    }
    const text=String(value).trim();
    const six=text.match(/^(\d{2})(\d{2})(\d{2})Z$/);
    if(six){
      const now=new Date();
      const day=Number(six[1]),hour=Number(six[2]),minute=Number(six[3]);
      let candidate=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),day,hour,minute));
      if(candidate.getTime()-now.getTime()>3*24*3600*1000)candidate=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-1,day,hour,minute));
      else if(now.getTime()-candidate.getTime()>28*24*3600*1000)candidate=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,day,hour,minute));
      return candidate;
    }
    const normalized=/^\d{4}\/\d{2}\/\d{2}\s/.test(text)?text.replace(/^(\d{4})\/(\d{2})\/(\d{2})\s/,'$1-$2-$3T')+'Z':text;
    const d=new Date(normalized);
    return Number.isNaN(d.getTime())?null:d;
  }

  function metarAge(date){return date&&!Number.isNaN(date.getTime())?Math.max(0,(Date.now()-date.getTime())/60000):Infinity}
  function rawObservationDate(raw){const m=String(raw||'').match(/(?:^|\s)(\d{6}Z)(?:\s|$)/);return m?nearestMetarDate(m[1]):null}
  function metarNumber(token){if(token==null)return null;const s=String(token).toUpperCase();const n=Number(s.replace(/^M/,'-'));return Number.isFinite(n)?n:null}
  function validateObservation(obs,maxAge,label){const age=metarAge(obs);if(!Number.isFinite(age)||age>maxAge)throw new Error(`${label} sem observação atual (${Number.isFinite(age)?Math.round(age)+' min':'horário inválido'})`);return age}

  function firstReport(payload){
    if(Array.isArray(payload))return payload[0]||null;
    if(Array.isArray(payload?.metars))return payload.metars[0]||null;
    if(Array.isArray(payload?.data))return payload.data[0]||null;
    if(payload?.metar&&typeof payload.metar==='object')return payload.metar;
    return payload&&typeof payload==='object'?payload:null;
  }

  function normalizeMetarsEu(payload){
    const r=firstReport(payload);
    if(!r)throw new Error('metars.eu sem relatório');
    const raw=r.rawText||r.raw||r.rawOb||r.raw_text;
    if(!raw)throw new Error('metars.eu sem texto bruto');
    const wind=r.wind||{},temp=r.temperature||{};
    const obs=nearestMetarDate(r.timestamp||r.observedAt||r.observationTime||r.obsTime||r.reportTime)||rawObservationDate(raw);
    validateObservation(obs,MAX_DIRECT_AGE_MIN,'metars.eu');
    return {
      station:'SBFZ',source:'metars.eu / NOAA AWC',fetched_at:new Date().toISOString(),
      metar:{icaoId:'SBFZ',rawOb:raw,obsTime:Math.floor(obs.getTime()/1000),reportTime:obs.toISOString(),wdir:wind.direction??r.wdir??null,wspd:wind.speed??r.wspd??null,wgst:wind.gust??r.wgst??null,temp:temp.temp??r.temp??null,dewp:temp.dewPoint??r.dewp??null,altim:r.qnh??r.altimeter?.value??r.altim??null,visib:r.visibility?.meters??r.visib??null,fltCat:r.flightCategory??r.fltCat??null}
    };
  }

  function normalizeVatsim(payload){
    const rows=Array.isArray(payload)?payload:(Array.isArray(payload?.data)?payload.data:[]);
    const r=rows.find(x=>String(x?.id||x?.icao||'').toUpperCase()==='SBFZ')||rows[0];
    if(!r)throw new Error('VATSIM sem relatório');
    let raw=String(r.metar||r.raw||r.rawText||'').trim();
    if(!raw)throw new Error('VATSIM sem texto bruto');
    if(!/\bSBFZ\b/.test(raw))raw=`METAR SBFZ ${raw}`;
    const obs=rawObservationDate(raw);validateObservation(obs,MAX_DIRECT_AGE_MIN,'VATSIM');
    const wind=raw.match(/(?:^|\s)(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT(?:\s|$)/);
    const td=raw.match(/(?:^|\s)(M?\d{2})\/(M?\d{2})(?:\s|$)/);
    const q=raw.match(/(?:^|\s)Q(\d{4})(?:\s|$)/);
    return {
      station:'SBFZ',source:'VATSIM METAR API',fetched_at:new Date().toISOString(),
      metar:{icaoId:'SBFZ',rawOb:raw,obsTime:Math.floor(obs.getTime()/1000),reportTime:obs.toISOString(),wdir:wind&&wind[1]!=='VRB'?Number(wind[1]):null,wspd:wind?Number(wind[2]):null,wgst:wind&&wind[3]?Number(wind[3]):null,temp:td?metarNumber(td[1]):null,dewp:td?metarNumber(td[2]):null,altim:q?Number(q[1]):null,visib:null,fltCat:null}
    };
  }

  function validateBackup(payload){
    const m=payload?.metar;if(!m)throw new Error('backup AWC vazio');
    const raw=m.rawOb||m.raw_text||'';
    const obs=nearestMetarDate(m.obsTime??m.reportTime)||rawObservationDate(raw);
    validateObservation(obs,MAX_BACKUP_AGE_MIN,'backup AWC');
    const fetched=nearestMetarDate(payload.fetched_at);
    if(fetched&&metarAge(fetched)>MAX_BACKUP_AGE_MIN)throw new Error(`snapshot AWC vencido (${Math.round(metarAge(fetched))} min)`);
    return payload;
  }

  function jsonResponse(payload){return new Response(JSON.stringify(payload),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})}
  function unavailableResponse(){return new Response(JSON.stringify({error:'METAR atual indisponível'}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})}

  async function metarsEuResponse(){
    const payload=normalizeMetarsEu(await fetchJson(`${METAR_DIRECT}?t=${Date.now()}`));
    state.metarSource='metars.eu · direto';state.metarLastSuccess=new Date().toISOString();state.metarLastError=null;return jsonResponse(payload);
  }
  async function vatsimResponse(){
    const sep=METAR_SECONDARY.includes('?')?'&':'?';
    const payload=normalizeVatsim(await fetchJson(`${METAR_SECONDARY}${sep}t=${Date.now()}`));
    state.metarSource='VATSIM · redundância direta';state.metarLastSuccess=new Date().toISOString();state.metarLastError=null;return jsonResponse(payload);
  }
  async function backupMetarResponse(){
    const payload=validateBackup(await fetchJson(`${METAR_BACKUP}?t=${Date.now()}`));
    state.metarSource='NOAA/AWC · snapshot GitHub';state.metarLastSuccess=new Date().toISOString();state.metarLastError=null;return jsonResponse(payload);
  }

  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:(input&&input.url)||'';
    if(isMetarCacheUrl(url)){
      const errors=[];
      try{return await metarsEuResponse()}catch(e){errors.push(`metars.eu: ${e?.message||e}`)}
      try{return await vatsimResponse()}catch(e){errors.push(`VATSIM: ${e?.message||e}`)}
      try{return await backupMetarResponse()}catch(e){errors.push(`AWC/GitHub: ${e?.message||e}`)}
      state.metarLastError=errors.join(' · ');state.metarSource='sem fonte válida';return unavailableResponse();
    }
    return nativeFetch(input,init);
  };

  // O METAR é normalmente horário; duas consultas por intervalo permitem detectar mudanças
  // sem fazer polling excessivo das fontes públicas.
  window.setInterval=function(fn,delay,...args){
    if(typeof fn==='function'&&fn.name==='loadMetar'&&Number(delay)===300000)return nativeSetInterval(fn,120000,...args);
    return nativeSetInterval(fn,delay,...args);
  };

  function annotateSource(){
    const el=document.getElementById('metar-age');if(!el||!state.metarSource)return;
    if(!el.textContent.includes(state.metarSource))el.textContent=`${el.textContent} · ${state.metarSource}`;
  }

  window.addEventListener('DOMContentLoaded',()=>{
    const el=document.getElementById('metar-age');if(!el)return;
    new MutationObserver(annotateSource).observe(el,{childList:true,characterData:true,subtree:true});setTimeout(annotateSource,1000);
  });
})();
