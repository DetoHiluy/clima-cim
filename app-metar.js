function metarTemp(v){if(v==null||!Number.isFinite(Number(v)))return'--';return`${Math.round(Number(v))}°C`}
function metarVisibility(m){
  const raw=m.rawOb||'';
  const match=raw.match(/\s(9999|\d{4})\s/);
  if(match){const n=Number(match[1]);return n===9999?'≥ 10 km':`${(n/1000).toFixed(n%1000?1:0)} km`}
  const n=Number(m.visib);if(Number.isFinite(n)){if(n>=100)return n>=9999?'≥ 10 km':`${(n/1000).toFixed(1)} km`;return `${n} km`}
  return'--';
}
function metarObservationDate(token){
  if(!token)return null;
  if(token instanceof Date)return token;
  if(typeof token==='number'){const d=new Date(token>1e12?token:token*1000);return Number.isNaN(d.getTime())?null:d}
  const text=String(token).trim();const six=text.match(/^(\d{2})(\d{2})(\d{2})Z$/);
  if(six){const now=new Date(),day=+six[1],hour=+six[2],minute=+six[3];let d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),day,hour,minute));if(d-now>3*864e5)d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-1,day,hour,minute));else if(now-d>28*864e5)d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,day,hour,minute));return d}
  const d=new Date(text);return Number.isNaN(d.getTime())?null:d;
}
function rawMetarDate(raw){const m=String(raw||'').match(/(?:^|\s)(\d{6}Z)(?:\s|$)/);return m?metarObservationDate(m[1]):null}
function firstReport(payload){if(Array.isArray(payload))return payload[0]||null;if(Array.isArray(payload?.data))return payload.data[0]||null;if(Array.isArray(payload?.metars))return payload.metars[0]||null;return payload&&typeof payload==='object'?payload:null}
function normalizeMetarsEu(payload){
  const r=firstReport(payload);if(!r)throw new Error('metars.eu sem relatório');const raw=r.rawText||r.raw||r.rawOb;if(!raw)throw new Error('metars.eu sem texto bruto');
  const obs=metarObservationDate(r.timestamp)||rawMetarDate(raw),wind=r.wind||{},temp=r.temperature||{};
  return{source:'metars.eu / NOAA AWC',fetched_at:new Date().toISOString(),metar:{rawOb:raw,obsTime:obs?Math.floor(obs.getTime()/1000):null,wdir:wind.direction??null,wspd:wind.speed??null,wgst:wind.gust??null,temp:temp.temp??null,dewp:temp.dewPoint??null,altim:r.qnh??null,visib:r.visibility?.meters??null}};
}
function normalizeVatsim(payload){
  const rows=Array.isArray(payload)?payload:(Array.isArray(payload?.data)?payload.data:[]),r=rows.find(x=>String(x?.id||'').toUpperCase()==='SBFZ')||rows[0];if(!r)throw new Error('VATSIM sem relatório');
  let raw=String(r.metar||r.raw||r.rawText||'').trim();if(!raw)throw new Error('VATSIM sem texto bruto');if(!/\bSBFZ\b/.test(raw))raw=`METAR SBFZ ${raw}`;
  const obs=rawMetarDate(raw),wind=raw.match(/(?:^|\s)(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT(?:\s|$)/),td=raw.match(/(?:^|\s)(M?\d{2})\/(M?\d{2})(?:\s|$)/),q=raw.match(/(?:^|\s)Q(\d{4})(?:\s|$)/);
  const num=x=>x==null?null:Number(String(x).replace(/^M/,'-'));
  return{source:'VATSIM METAR API',fetched_at:new Date().toISOString(),metar:{rawOb:raw,obsTime:obs?Math.floor(obs.getTime()/1000):null,wdir:wind&&wind[1]!=='VRB'?Number(wind[1]):null,wspd:wind?Number(wind[2]):null,wgst:wind&&wind[3]?Number(wind[3]):null,temp:td?num(td[1]):null,dewp:td?num(td[2]):null,altim:q?Number(q[1]):null,visib:null}};
}
async function fetchJson(url,timeoutMs=7000){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);try{const r=await fetch(`${url}${url.includes('?')?'&':'?'}_=${Date.now()}`,{cache:'no-store',signal:controller.signal,headers:{Accept:'application/json'},credentials:'omit'});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json()}finally{clearTimeout(timer)}}
async function getMetarPayload(){
  const errors=[];for(const source of METAR_SOURCES){try{const raw=await fetchJson(source.url);const payload=source.type==='metarseu'?normalizeMetarsEu(raw):normalizeVatsim(raw);const obs=payload.metar?.obsTime?new Date(payload.metar.obsTime*1000):null,age=ageMinutes(obs);if(!Number.isFinite(age)||age>MAX_METAR_AGE_MIN)throw new Error(`observação com ${Number.isFinite(age)?Math.round(age)+' min':'horário inválido'}`);return payload}catch(e){errors.push(`${source.name}: ${e?.message||e}`)}}throw new Error(errors.join(' · '));
}
async function loadMetar(){
  try{
    const payload=await getMetarPayload(),m=payload.metar,obs=m.obsTime?new Date(m.obsTime*1000):null,obsAge=ageMinutes(obs);
    $('#metar-raw').textContent=m.rawOb;$('#metar-age').textContent=`observado ${formatTime(obs)} · idade ${ageText(obsAge)} · ${payload.source}`;
    const windDir=m.wdir==null?'VRB':`${Math.round(m.wdir)}°`,windKt=m.wspd==null?'--':Math.round(m.wspd),gustKt=m.wgst==null?null:Math.round(m.wgst),alt=m.altim==null?'--':`${Math.round(m.altim)} hPa`;
    $('#metar-details').innerHTML=`<div><dt>Vento</dt><dd>${windDir} · ${windKt} kt${gustKt?` · G${gustKt}`:''}</dd></div><div><dt>Visibilidade</dt><dd>${metarVisibility(m)}</dd></div><div><dt>Temperatura</dt><dd>${metarTemp(m.temp)} · orvalho ${metarTemp(m.dewp)}</dd></div><div><dt>Pressão</dt><dd>${alt}</dd></div>`;
  }catch(e){$('#metar-age').textContent='nenhuma fonte entregou observação válida e recente';$('#metar-raw').textContent='METAR SBFZ temporariamente indisponível.';$('#metar-details').innerHTML=''}
}
