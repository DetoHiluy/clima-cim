(()=>{
  const RAW_METAR='https://raw.githubusercontent.com/DetoHiluy/clima-cim/main/data/metar.json';
  const TZ='America/Fortaleza';

  function time(v){
    const d=new Date(v);
    if(Number.isNaN(d.getTime()))return'--:--';
    return new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:TZ}).format(d);
  }

  // Compatibilidade: a visualização relativa do vento substitui o conteúdo
  // de .runway-wind-line. Mantemos um slot invisível com o id antigo para
  // impedir que renderizações posteriores falhem ao procurá-lo.
  function ensureLegacyRunwaySlot(){
    const line=document.querySelector('.runway-wind-line');
    if(!line||document.getElementById('runway-wind'))return;
    const slot=document.createElement('strong');
    slot.id='runway-wind';
    slot.hidden=true;
    line.appendChild(slot);
  }
  ensureLegacyRunwaySlot();
  setInterval(ensureLegacyRunwaySlot,1000);

  async function getMetarPayload(){
    const urls=[
      `${RAW_METAR}?t=${Date.now()}`,
      `data/metar.json?t=${Date.now()}`
    ];
    let lastError;
    for(const url of urls){
      try{
        const r=await fetch(url,{cache:'no-store'});
        if(!r.ok)throw new Error(`HTTP ${r.status}`);
        return await r.json();
      }catch(err){lastError=err}
    }
    throw lastError||new Error('METAR indisponível');
  }

  async function refreshMetar(){
    const raw=document.getElementById('metar-raw');
    const age=document.getElementById('metar-age');
    const details=document.getElementById('metar-details');
    if(!raw||!age||!details)return;
    try{
      const payload=await getMetarPayload();
      const m=payload?.metar;
      if(!m)throw new Error('METAR vazio');
      raw.textContent=m.rawOb||m.raw_text||'METAR indisponível';
      const obs=m.obsTime!=null?(typeof m.obsTime==='number'?new Date(m.obsTime*1000):new Date(m.obsTime)):(m.reportTime?new Date(m.reportTime):null);
      const fetched=payload.fetched_at?new Date(payload.fetched_at):null;
      age.textContent=`observado ${obs&&!Number.isNaN(obs.getTime())?time(obs):'--:--'} · feed ${fetched&&!Number.isNaN(fetched.getTime())?time(fetched):'--:--'}`;
      const windDir=m.wdir==null?'VRB':`${Math.round(m.wdir)}°`;
      const windKt=m.wspd==null?'--':Math.round(m.wspd);
      const gustKt=m.wgst==null?null:Math.round(m.wgst);
      const vis=m.visib==null?'--':`${m.visib} SM`;
      const alt=m.altim==null?'--':`${Math.round(m.altim)} hPa`;
      const temp=m.temp==null?'--':`${Math.round(m.temp)}°C`;
      const dewp=m.dewp==null?'--':`${Math.round(m.dewp)}°C`;
      details.innerHTML=`<div><dt>Vento</dt><dd>${windDir} · ${windKt} kt${gustKt?` · G${gustKt}`:''}</dd></div><div><dt>Visibilidade</dt><dd>${vis}</dd></div><div><dt>Temperatura</dt><dd>${temp} · orvalho ${dewp}</dd></div><div><dt>Pressão</dt><dd>${alt}</dd></div>`;
    }catch(err){
      age.textContent='feed indisponível';
    }
  }

  // O app principal já faz a primeira consulta. Estas chamadas tornam a
  // atualização independente dos timers antigos e mais rápida na tela.
  setTimeout(refreshMetar,1200);
  setInterval(refreshMetar,60*1000);
  if(typeof window.loadWeather==='function'){
    setInterval(()=>window.loadWeather(),5*60*1000);
  }
})();
