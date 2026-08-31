(()=>{
  'use strict';

  const METAR_DIRECT='https://metars.eu/api/metars/SBFZ';
  const METAR_BACKUP='https://raw.githubusercontent.com/DetoHiluy/clima-cim/metar-data/data/metar.json';
  const nativeFetch=window.fetch.bind(window);
  const nativeSetInterval=window.setInterval.bind(window);
  const state=window.CIM_RELIABILITY={metarSource:'',metarLastSuccess:null,metarLastError:null};

  function isMetarCacheUrl(url){
    return /(?:raw\.githubusercontent\.com\/DetoHiluy\/clima-cim\/main\/data\/metar\.json|(?:^|\/)data\/metar\.json)(?:\?|$)/.test(url);
  }

  async function fetchJson(url,timeoutMs=6000){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const response=await nativeFetch(url,{cache:'no-store',signal:controller.signal,headers:{Accept:'application/json'}});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
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

  function firstReport(payload){
    if(Array.isArray(payload))return payload[0]||null;
    if(Array.isArray(payload?.metars))return payload.metars[0]||null;
    if(Array.isArray(payload?.data))return payload.data[0]||null;
    if(payload?.metar&&typeof payload.metar==='object')return payload.metar;
    return payload&&typeof payload==='object'?payload:null;
  }

  function normalizeMetarsEu(payload){
    const r=firstReport(payload);
    if(!r)throw new Error('resposta METAR vazia');
    const raw=r.rawText||r.raw||r.rawOb||r.raw_text;
    if(!raw)throw new Error('METAR sem texto bruto');

    const wind=r.wind||{};
    const temp=r.temperature||{};
    const obs=nearestMetarDate(r.timestamp||r.observedAt||r.observationTime||r.obsTime||r.reportTime);
    const ageMin=obs?Math.max(0,(Date.now()-obs.getTime())/60000):Infinity;
    if(ageMin>90)throw new Error(`observação direta antiga (${Math.round(ageMin)} min)`);

    return {
      station:'SBFZ',
      source:'metars.eu / NOAA AWC',
      fetched_at:new Date().toISOString(),
      metar:{
        icaoId:'SBFZ',
        rawOb:raw,
        obsTime:obs?Math.floor(obs.getTime()/1000):null,
        reportTime:obs?obs.toISOString():null,
        wdir:wind.direction??r.wdir??null,
        wspd:wind.speed??r.wspd??null,
        wgst:wind.gust??r.wgst??null,
        temp:temp.temp??r.temp??null,
        dewp:temp.dewPoint??r.dewp??null,
        altim:r.qnh??r.altimeter?.value??r.altim??null,
        visib:r.visibility?.meters??r.visib??null,
        fltCat:r.flightCategory??r.fltCat??null
      }
    };
  }

  function jsonResponse(payload){
    return new Response(JSON.stringify(payload),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  }

  async function directMetarResponse(){
    const payload=normalizeMetarsEu(await fetchJson(`${METAR_DIRECT}?t=${Date.now()}`));
    state.metarSource='metars.eu · direto';
    state.metarLastSuccess=new Date().toISOString();
    state.metarLastError=null;
    return jsonResponse(payload);
  }

  async function backupMetarResponse(){
    const payload=await fetchJson(`${METAR_BACKUP}?t=${Date.now()}`);
    if(!payload?.metar)throw new Error('backup METAR vazio');
    state.metarSource='AWC · backup metar-data';
    state.metarLastSuccess=new Date().toISOString();
    return jsonResponse(payload);
  }

  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:(input&&input.url)||'';
    if(isMetarCacheUrl(url)){
      try{
        return await directMetarResponse();
      }catch(directError){
        try{
          state.metarLastError=String(directError?.message||directError);
          return await backupMetarResponse();
        }catch(backupError){
          state.metarLastError=`direto: ${directError?.message||directError}; backup: ${backupError?.message||backupError}`;
          state.metarSource='backup local';
        }
      }
    }
    return nativeFetch(input,init);
  };

  // O METAR normalmente é horário; a fonte direta mantém cache de cerca de 2 min.
  // Aumentamos a frequência do cartão sem alterar a consulta meteorológica principal.
  window.setInterval=function(fn,delay,...args){
    if(typeof fn==='function'&&fn.name==='loadMetar'&&Number(delay)===300000){
      return nativeSetInterval(fn,120000,...args);
    }
    return nativeSetInterval(fn,delay,...args);
  };

  function annotateSource(){
    const el=document.getElementById('metar-age');
    if(!el||!state.metarSource)return;
    if(!el.textContent.includes(state.metarSource))el.textContent=`${el.textContent} · ${state.metarSource}`;
  }

  window.addEventListener('DOMContentLoaded',()=>{
    const el=document.getElementById('metar-age');
    if(!el)return;
    new MutationObserver(annotateSource).observe(el,{childList:true,characterData:true,subtree:true});
    setTimeout(annotateSource,1000);
  });
})();
